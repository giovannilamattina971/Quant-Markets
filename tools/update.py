"""Aggiornamento notturno dei dati della piattaforma Quant Markets.

Eseguito ogni notte da GitHub Actions (.github/workflows/update.yml).
Regole:
  * le serie storiche esistenti non vengono riscritte: si aggiungono solo le date nuove;
  * le serie di prezzo (rettificate per dividendi) vengono "agganciate" con il rapporto
    sul periodo di sovrapposizione, e l'aggancio viene verificato: se la nuova fonte non
    coincide con la vecchia, la serie NON viene toccata e l'errore finisce nel log;
  * i dati mensili si aggiungono solo a mese chiuso (tranne gli indicatori "ultimi valori").
Ogni serie riporta in data/meta.js l'ultima data e l'esito, che la piattaforma mostra.
"""
import datetime as dt
import io
import json
import math
import os
import sys
import time
import traceback

import pandas as pd
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dataio as D  # noqa: E402

TODAY = dt.date.today()
CUR_M = TODAY.strftime('%Y-%m')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) QuantMarkets-updater/1.0'}
LOG = {'run': dt.datetime.utcnow().isoformat(timespec='seconds') + 'Z', 'series': {}, 'errors': []}
META = {}


def log(key, status, last=None, note='', src=''):
    LOG['series'][key] = {'status': status, 'last': last, 'note': note, 'src': src}
    print(f'[{status:8}] {key:28} {last or "":12} {note}', flush=True)


def get(url, params=None, headers=None, tries=3, timeout=40):
    err = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers={**UA, **(headers or {})}, timeout=timeout)
            if r.status_code == 200:
                return r
            err = f'HTTP {r.status_code}'
        except Exception as e:  # noqa: BLE001
            err = str(e)
        time.sleep(2 + 3 * i)
    raise RuntimeError(f'{url}: {err}')


# ------------------------------------------------------------------ fonti
_FRED = {}


def fred(sid):
    """Serie FRED completa (pd.Series, indice data)."""
    if sid in _FRED:
        return _FRED[sid]
    r = get('https://fred.stlouisfed.org/graph/fredgraph.csv', {'id': sid})
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ['date', 'v']
    df['v'] = pd.to_numeric(df['v'], errors='coerce')
    s = df.dropna().set_index(pd.to_datetime(df.dropna()['date']))['v']
    _FRED[sid] = s
    return s


def sdmx_csv(url, params=None):
    r = get(url, params, headers={'Accept': 'text/csv'})
    df = pd.read_csv(io.StringIO(r.text))
    tcol = [c for c in df.columns if c.upper() == 'TIME_PERIOD'][0]
    vcol = [c for c in df.columns if c.upper() == 'OBS_VALUE'][0]
    df[vcol] = pd.to_numeric(df[vcol], errors='coerce')
    df = df.dropna(subset=[vcol])
    idx = pd.to_datetime(df[tcol].astype(str).str.slice(0, 10), errors='coerce')
    return pd.Series(df[vcol].values, index=idx).sort_index().dropna()


def ecb(key):
    flow, rest = key.split('/', 1)
    return sdmx_csv(f'https://data-api.ecb.europa.eu/service/data/{flow}/{rest}', {'format': 'csvdata'})


def bbk(key):
    flow, rest = key.split('.', 1)
    return sdmx_csv(f'https://api.statistiken.bundesbank.de/rest/data/{flow}/{rest}', {'format': 'csv', 'lang': 'en'})


_YH = {}


def yahoo(sym, start, adjusted=True):
    """Chiusure giornaliere da Yahoo (prima yfinance, poi API chart diretta)."""
    k = (sym, str(start), adjusted)
    if k in _YH:
        return _YH[k]
    s = None
    try:
        import yfinance as yf
        df = yf.Ticker(sym).history(start=str(start), auto_adjust=adjusted, actions=False, timeout=30)
        if df is not None and len(df):
            s = df[['Close', 'Volume']].copy()
    except Exception as e:  # noqa: BLE001
        print('  yfinance', sym, e)
    if s is None or not len(s):
        p1 = int(time.mktime(pd.Timestamp(start).timetuple()))
        r = get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',
                {'period1': p1, 'period2': int(time.time()) + 86400, 'interval': '1d', 'events': 'div,splits'})
        j = r.json()['chart']['result'][0]
        ts = pd.to_datetime(j['timestamp'], unit='s')
        q = j['indicators']
        c = (q.get('adjclose') or [{}])[0].get('adjclose') if adjusted else None
        c = c or q['quote'][0]['close']
        s = pd.DataFrame({'Close': c, 'Volume': q['quote'][0].get('volume')}, index=ts)
    s = s.dropna(subset=['Close'])
    s.index = pd.to_datetime([str(x)[:10] for x in s.index])
    s = s[~s.index.duplicated(keep='last')]
    # oggi la seduta potrebbe essere ancora aperta: si tiene solo fino a ieri
    s = s[s.index.date < TODAY]
    _YH[k] = s
    return s


def msci(code, variant, ccy, start='2015-01-01'):
    r = get('https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph',
            {'currency_symbol': ccy, 'index_variant': variant, 'start_date': start.replace('-', ''),
             'end_date': TODAY.strftime('%Y%m%d'), 'data_frequency': 'END_OF_MONTH', 'index_codes': code})
    rows = r.json()['indexes']['INDEX_LEVELS']
    s = pd.Series({pd.Timestamp(str(x['calc_date'])): float(x['level_eod']) for x in rows}).sort_index()
    return s


# ------------------------------------------------------------------ agganci
def splice_levels(old_d, old_c, new, key, tol=0.006, min_overlap=3, monthly=False, extra=None):
    """Aggiunge a una serie di livelli i nuovi valori agganciati col rapporto sulla sovrapposizione.
    new: pd.Series indicizzata per data. Restituisce (d, c, n_aggiunti) oppure solleva ValueError."""
    if monthly:
        old_k = [x[:7] for x in old_d]
        nk = new.index.strftime('%Y-%m')
    else:
        old_k = list(old_d)
        nk = new.index.strftime('%Y-%m-%d')
    newm = dict(zip(nk, new.values))
    om = dict(zip(old_k, old_c))
    ov = [k for k in old_k[-40:] if k in newm and newm[k] and om[k]]
    if len(ov) < min_overlap:
        raise ValueError(f'sovrapposizione insufficiente ({len(ov)} date)')
    ratios = [om[k] / newm[k] for k in ov]
    rec = ratios[-min(len(ratios), 10):]
    rr = sorted(rec)[len(rec) // 2]
    disp = max(abs(r / rr - 1) for r in rec)
    if disp > tol:
        raise ValueError(f'la nuova fonte non coincide con lo storico (scarto {disp:.2%} sulle ultime {len(rec)} date)')
    last = old_k[-1]
    add = [(k, newm[k] * rr) for k in sorted(newm) if k > last]
    if monthly:
        add = [(k, v) for k, v in add if k < CUR_M]
        fmt = old_d[-1]
        add_d = []
        for k, _ in add:
            if len(fmt) == 7:
                add_d.append(k)
            elif fmt.endswith('-01'):
                add_d.append(k + '-01')
            else:  # ultimo giorno del mese (di calendario o di borsa: si usa quello effettivo della fonte)
                dd = [i for i in new.index if i.strftime('%Y-%m') == k]
                add_d.append(max(dd).strftime('%Y-%m-%d') if dd else k + '-28')
    else:
        add_d = [k for k, _ in add]
    return list(old_d) + add_d, list(old_c) + [v for _, v in add], len(add), rr, disp


def month_end(s):
    s = s.dropna()
    g = s.groupby(s.index.to_period('M'))
    out = g.last()
    out.index = [g.get_group(p).index.max() for p in out.index]
    return out


def month_avg(s):
    s = s.dropna()
    out = s.groupby(s.index.to_period('M')).mean()
    out.index = out.index.to_timestamp()
    return out


def append_values(obj, new, key, fmt, vkey='v', complete_months=True, check_tol=None, allow_last_revise=True):
    """Serie di valori (tassi, indici macro): aggiunge le date nuove, controlla la coerenza sull'ultimo tratto."""
    d, v = obj['d'], obj[vkey]
    if fmt == 'M':
        nk = new.index.strftime('%Y-%m')
    elif fmt == 'M01':
        nk = new.index.strftime('%Y-%m-01')
    else:
        nk = new.index.strftime('%Y-%m-%d')
    nm = dict(zip(nk, new.values))
    if fmt == 'MEND':  # data = ultimo giorno disponibile del mese, chiave per mese
        nm = {i.strftime('%Y-%m'): (i.strftime('%Y-%m-%d'), x) for i, x in new.items()}
        ok = [x[:7] for x in d]
    else:
        ok = list(d)
    if check_tol is not None:
        ov = [(i, k) for i, k in enumerate(ok[-24:], start=len(ok) - min(24, len(ok))) if k in nm]
        if len(ov) >= 2:
            diffs = [abs((nm[k][1] if fmt == 'MEND' else nm[k]) - v[i]) for i, k in ov[:-1]]
            if diffs and max(diffs) > check_tol:
                raise ValueError(f'fonte diversa dallo storico (scarto max {max(diffs):.3f})')
    n = 0
    last = ok[-1]
    for k in sorted(nm):
        if fmt in ('M', 'M01', 'MEND') and complete_months and k[:7] >= CUR_M:
            continue
        if k > last:
            if fmt == 'MEND':
                d.append(nm[k][0]); v.append(float(nm[k][1]))
            else:
                d.append(k); v.append(float(nm[k]))
            n += 1
        elif k == last and allow_last_revise:
            val = nm[k][1] if fmt == 'MEND' else nm[k]
            if fmt == 'MEND':
                d[-1] = nm[k][0]
            v[-1] = float(val)
    return n


def run(key, fn):
    try:
        fn()
    except Exception as e:  # noqa: BLE001
        log(key, 'ERRORE', None, f'{type(e).__name__}: {e}'[:300])
        LOG['errors'].append({'key': key, 'err': traceback.format_exc()[-1500:]})


# ------------------------------------------------------------------ 1. indici USA giornalieri (MKT)
def upd_mkt():
    M = D.load('MKT')
    for sym, o in M.items():
        def one(sym=sym, o=o):
            start = pd.Timestamp(o['d'][-1]) - pd.Timedelta(days=45)
            s = yahoo(sym, start.date(), adjusted=False)
            d, c, n, rr, disp = splice_levels(o['d'], o['c'], s['Close'], sym, tol=0.002)
            if 'v' in o:
                vm = dict(zip(s.index.strftime('%Y-%m-%d'), s['Volume'].fillna(0)))
                o['v'] = list(o['v']) + [int(vm.get(x, 0) or 0) for x in d[len(o['d']):]]
            o['d'], o['c'] = d, c
            log('MKT.' + sym, 'ok', d[-1], f'+{n} sedute', 'Yahoo ' + sym)
        run('MKT.' + sym, one)
    D.save('MKT', M)


# ------------------------------------------------------------------ 2. ASSETS
YH_DAILY = {k: k for k in ['IEF', 'TLT', 'SHY', 'AGG', 'GLD', 'EEM', 'VWO', 'EFA', 'URTH', 'SWDA.MI', 'XEON.DE', 'VWRL.AS',
                           'VUSA.AS', 'VAGF.DE', 'CSBGE3.MI', 'IBGX.AS', 'SXRQ.DE', 'SXRT.DE', 'DJP',
                           'XLK', 'XLF', 'XLV', 'XLE', 'XLY', 'XLI', 'XLP', 'XLB', 'XLU', 'XLRE', 'XLC']}
# serie nate da justETF: si cerca il ticker Yahoo in EUR che coincide con lo storico
YH_CAND = {'AGGI': ['AGGH.MI', 'EUNA.DE', 'AGGH.AS'], 'IE15': ['IE15.MI', 'EUN5.DE', 'IE15.AS'],
           'CMOD': ['CMOD.MI', 'CMOD.DE', 'CMOD.L'], 'EMBE': ['EMBE.MI', 'IS3C.DE', 'EMBE.AS'],
           'CRUD': ['CRUD.MI', 'CRUD.DE'], 'BRNT': ['BRNT.MI', 'OD7F.DE'], 'IGLN': ['IGLN.MI', 'IS0E.DE', 'SGLN.MI'],
           'XGLD': ['4GLD.DE', '4GLD.F'], 'PHAG': ['PHAG.MI', 'VZLC.DE', 'PHAG.AS']}
YH_MONTHLY = {'FSPV': ['IVE'], 'FSPG': ['IVW'], 'FSPEW': ['RSP'], 'FSDY': ['SDY'], 'FSPHD': ['SPYD'], 'FSPY': ['SPY'],
              'FSPEWU': ['XDEW.DE', 'XDEW.MI'], 'FSDYU': ['USDV.MI', 'SPYD.DE', 'USDV.DE']}
MSCI_MAP = {'MSCIEM': ('891800', 'NETR', 'USD'), 'MSCIEM_EUR': ('891800', 'NETR', 'EUR'),
            'MSCIWD': ('990100', 'NETR', 'USD'), 'MSCIWD_EUR': ('990100', 'NETR', 'EUR'),
            'MSCIEMP': ('891800', 'STRD', 'USD'), 'MSCIEMP_EUR': ('891800', 'STRD', 'EUR'),
            'MSCIWDP': ('990100', 'STRD', 'USD'), 'MSCIWDP_EUR': ('990100', 'STRD', 'EUR'),
            'FWORLD': ('990100', 'NETR', 'USD'), 'FWORLD_EUR': ('990100', 'NETR', 'EUR')}
for k, code in {'CN': '302400', 'IN': '935600', 'KR': '941000', 'TW': '915800', 'BR': '907600', 'SA': '705405',
                'ZA': '971000', 'MX': '848400'}.items():
    MSCI_MAP['MSCI_' + k] = (code, 'NETR', 'USD'); MSCI_MAP['MSCI_' + k + '_EUR'] = (code, 'NETR', 'EUR')
for k, code in {'FVAL': '105868', 'FMOM': '703755', 'FQUAL': '702787', 'FSNQ': '705169', 'FMINV': '129896',
                'FSMALL': '106230', 'FEQW': '129857', 'FHDY': '136064'}.items():
    MSCI_MAP[k] = (code, 'NETR', 'USD'); MSCI_MAP[k + '_EUR'] = (code, 'NETR', 'EUR')


def par_bond_ret(y0, y1, n):
    c, yy = y0 / 100, y1 / 100
    k = (n - 1 / 12) * 2
    if abs(yy) < 1e-9:
        P = c / 2 * k + 1
    else:
        P = c / 2 * (1 - (1 + yy / 2) ** (-k)) / (yy / 2) + (1 + yy / 2) ** (-k)
    return P - 1 + c / 12


def upd_assets():
    A = D.load('ASSETS')
    chosen = LOG.setdefault('tickers', {})

    def daily(key, cands, tol=0.006):
        o = A[key]
        start = (pd.Timestamp(o['d'][-1]) - pd.Timedelta(days=60)).date()
        errs = []
        for sym in cands:
            try:
                s = yahoo(sym, start)['Close']
                d, c, n, rr, disp = splice_levels(o['d'], o['c'], s, key, tol=tol)
                o['d'], o['c'] = d, c
                chosen[key] = sym
                log('ASSETS.' + key, 'ok', d[-1], f'+{n} sedute (Yahoo {sym}, scarto aggancio {disp:.2%})', 'Yahoo ' + sym)
                return
            except Exception as e:  # noqa: BLE001
                errs.append(f'{sym}: {e}')
        raise RuntimeError(' | '.join(errs))

    for key, sym in YH_DAILY.items():
        if key in A:
            run('ASSETS.' + key, lambda key=key, sym=sym: daily(key, [sym]))
    for key, c in YH_CAND.items():
        if key in A:
            run('ASSETS.' + key, lambda key=key, c=c: daily(key, c, tol=0.012))

    def monthly_yh(key, cands):
        o = A[key]
        start = (pd.Timestamp(o['d'][-1]) - pd.Timedelta(days=130)).date()
        errs = []
        for sym in cands:
            try:
                s = month_end(yahoo(sym, start)['Close'])
                d, c, n, rr, disp = splice_levels(o['d'], o['c'], s, key, tol=0.012, min_overlap=2, monthly=True)
                o['d'], o['c'] = d, c
                log('ASSETS.' + key, 'ok', d[-1], f'+{n} mesi (Yahoo {sym})', 'Yahoo ' + sym)
                return
            except Exception as e:  # noqa: BLE001
                errs.append(f'{sym}: {e}')
        raise RuntimeError(' | '.join(errs))

    for key, c in YH_MONTHLY.items():
        if key in A:
            run('ASSETS.' + key, lambda key=key, c=c: monthly_yh(key, c))

    def msci_one(key):
        code, var, ccy = MSCI_MAP[key]
        o = A[key]
        s = msci(code, var, ccy, start=str(int(o['d'][-1][:4]) - 1) + '-01-01')
        d, c, n, rr, disp = splice_levels(o['d'], o['c'], s, key, tol=0.002, min_overlap=2, monthly=True)
        o['d'], o['c'] = d, c
        log('ASSETS.' + key, 'ok', d[-1], f'+{n} mesi', f'MSCI {code} {var} {ccy}')

    for key in MSCI_MAP:
        if key in A:
            run('ASSETS.' + key, lambda key=key: msci_one(key))

    def fred_daily(key, sid):
        o = A[key]
        s = fred(sid)
        d, c, n, rr, disp = splice_levels(o['d'], o['c'], s, key, tol=0.001)
        o['d'], o['c'] = d, c
        log('ASSETS.' + key, 'ok', d[-1], f'+{n} giorni', 'FRED ' + sid)

    run('ASSETS.BRENT', lambda: fred_daily('BRENT', 'DCOILBRENTEU'))
    run('ASSETS.WTI', lambda: fred_daily('WTI', 'DCOILWTICO'))

    def cpi(key, sid):
        o = A[key]
        s = fred(sid)
        s = s[s.index.strftime('%Y-%m') < CUR_M]
        d, c, n, rr, disp = splice_levels(o['d'], o['c'], s, key, tol=0.004, min_overlap=2, monthly=True)
        # le date di queste serie sono fine mese di calendario
        d = d[:len(o['d'])] + [(pd.Timestamp(x[:7] + '-01') + pd.offsets.MonthEnd(0)).strftime('%Y-%m-%d') for x in d[len(o['d']):]]
        o['d'], o['c'] = d, c
        log('ASSETS.' + key, 'ok', d[-1], f'+{n} mesi', 'FRED ' + sid)

    run('ASSETS.CPI_EA', lambda: cpi('CPI_EA', 'CP0000EZ19M086NEST'))
    run('ASSETS.CPI_IT', lambda: cpi('CPI_IT', 'CP0000ITM086NEST'))

    # obbligazioni a scadenza costante ricostruite dai rendimenti + liquidità
    def bond(key, sid, n_years, how):
        o = A[key]
        ys = fred(sid)
        ym = month_end(ys) if how == 'eop' else ys
        ymap = dict(zip(ym.index.strftime('%Y-%m'), ym.values))
        last = o['d'][-1][:7]
        k = sorted(x for x in ymap if x > last and x < CUR_M)
        n = 0
        for m in k:
            prev = (pd.Period(m, 'M') - 1).strftime('%Y-%m')
            if prev not in ymap:
                break
            r = par_bond_ret(ymap[prev], ymap[m], n_years) if n_years else ymap[prev] / 1200
            o['c'].append(o['c'][-1] * (1 + r))
            o['d'].append((pd.Timestamp(m + '-01') + pd.offsets.MonthEnd(0)).strftime('%Y-%m-%d'))
            n += 1
        log('ASSETS.' + key, 'ok', o['d'][-1], f'+{n} mesi (calcolato)', 'FRED ' + sid)

    run('ASSETS.UST10C', lambda: bond('UST10C', 'DGS10', 10, 'eop'))
    run('ASSETS.UST2C', lambda: bond('UST2C', 'DGS2', 2, 'eop'))
    run('ASSETS.BTP10C', lambda: bond('BTP10C', 'IRLTLT01ITM156N', 10, 'avg'))
    run('ASSETS.CASH', lambda: bond('CASH', 'TB3MS', 0, 'avg'))

    for k in A:
        if k not in YH_DAILY and k not in YH_CAND and k not in YH_MONTHLY and k not in MSCI_MAP and \
                k not in ('BRENT', 'WTI', 'CPI_EA', 'CPI_IT', 'UST10C', 'UST2C', 'BTP10C', 'CASH'):
            log('ASSETS.' + k, 'manuale', A[k]['d'][-1], 'fonte senza accesso automatico (aggiornamento manuale)')
    D.save('ASSETS', A)


# ------------------------------------------------------------------ 3. tassi, macro, segnali
def upd_rates():
    Y = D.load('YIELDS')
    for k, sid, how in [('DGS10', 'DGS10', 'eop'), ('DGS2', 'DGS2', 'eop'), ('TB3MS', 'TB3MS', 'm'),
                        ('IRLTLT01ITM156N', 'IRLTLT01ITM156N', 'm')]:
        def one(k=k, sid=sid, how=how):
            s = fred(sid)
            s = month_end(s) if how == 'eop' else s
            s.index = [(pd.Timestamp(i.strftime('%Y-%m-01')) + pd.offsets.MonthEnd(0)) for i in s.index]
            n = append_values(Y[k], s, k, 'D', check_tol=0.06)
            Y[k]['d'] = [x for x in Y[k]['d']]
            # niente mese in corso
            while Y[k]['d'][-1][:7] >= CUR_M:
                Y[k]['d'].pop(); Y[k]['v'].pop()
            log('YIELDS.' + k, 'ok', Y[k]['d'][-1], f'+{n}', 'FRED ' + sid)
        run('YIELDS.' + k, one)

    def changes(k, sid):  # serie a "punti di variazione" (tassi ufficiali)
        o = Y['_rates'][k]
        s = fred(sid)
        last = o['d'][-1]
        n = 0
        for i, x in s.items():
            ds = i.strftime('%Y-%m-%d')
            if ds > last and abs(float(x) - o['v'][-1]) > 1e-9:
                o['d'].append(ds); o['v'].append(float(x)); n += 1
        log('YIELDS._rates.' + k, 'ok', s.index.max().strftime('%Y-%m-%d'), f'{n} variazioni nuove', 'FRED ' + sid)

    for k in ('DFF', 'ECBDFR', 'ECBMRRFR'):
        run('YIELDS._rates.' + k, lambda k=k: changes(k, k))

    def fedfunds():
        o = Y['_rates']['FEDFUNDS']
        n = append_values(o, fred('FEDFUNDS'), 'FEDFUNDS', 'M01', check_tol=0.05)
        log('YIELDS._rates.FEDFUNDS', 'ok', o['d'][-1], f'+{n}', 'FRED FEDFUNDS')
    run('YIELDS._rates.FEDFUNDS', fedfunds)
    D.save('YIELDS', Y)

    MF = D.load('MACROF')
    for k in MF:
        def one(k=k):
            n = append_values(MF[k], fred(k), k, 'M', check_tol=0.3 if k.startswith('CP') else 0.06)
            log('MACROF.' + k, 'ok', MF[k]['d'][-1], f'+{n}', 'FRED ' + k)
        run('MACROF.' + k, one)
    D.save('MACROF', MF)

    MA = D.load('MACRO')

    def cpi():
        n = append_values(MA['cpi'], fred('CPIAUCNS'), 'cpi', 'M', check_tol=0.3)
        log('MACRO.cpi', 'ok', MA['cpi']['d'][-1], f'+{n}', 'FRED CPIAUCNS')

    def eur():
        n = append_values(MA['eur'], fred('DEXUSEU'), 'eur', 'D', check_tol=0.01)
        log('MACRO.eur', 'ok', MA['eur']['d'][-1], f'+{n}', 'FRED DEXUSEU')
    run('MACRO.cpi', cpi); run('MACRO.eur', eur)
    D.save('MACRO', MA)

    B = D.load('BUND')

    def de10o():
        n = append_values(B['DE10_OECD'], fred('IRLTLT01DEM156N'), 'DE10_OECD', 'M01', check_tol=0.05)
        log('BUND.DE10_OECD', 'ok', B['DE10_OECD']['d'][-1], f'+{n}', 'FRED IRLTLT01DEM156N')

    def de10e():
        n = append_values(B['DE10_ECB'], ecb('IRS/M.DE.L.L40.CI.0000.EUR.N.Z'), 'DE10_ECB', 'M01', check_tol=0.05)
        log('BUND.DE10_ECB', 'ok', B['DE10_ECB']['d'][-1], f'+{n}', 'BCE IRS')

    def bbk_one(k, mat):
        errs = []
        for key in [f'BBSIS.M.I.UMR.RD.EUR.S1311.B.A604.R{mat}XX.R.A.A._Z._Z.A',
                    f'BBSIS.M.I.ZST.ZI.EUR.S1311.B.A604.R{mat}XX.R.A.A._Z._Z.A']:
            try:
                n = append_values(B[k], bbk(key), k, 'M01', check_tol=0.05)
                log('BUND.' + k, 'ok', B[k]['d'][-1], f'+{n}', 'Bundesbank ' + key)
                return
            except Exception as e:  # noqa: BLE001
                errs.append(f'{key}: {e}')
        raise RuntimeError(' | '.join(errs))
    run('BUND.DE10_OECD', de10o); run('BUND.DE10_ECB', de10e)
    for k, m in (('DE10_BBK', '10'), ('DE5_BBK', '05'), ('DE2_BBK', '02')):
        run('BUND.' + k, lambda k=k, m=m: bbk_one(k, m))
    D.save('BUND', B)

    S = D.load('SIGNALS')
    for k, sid in (('T10Y2Y', 'T10Y2Y'), ('HY', 'BAMLH0A0HYM2'), ('BAA10Y', 'BAA10Y')):
        def one(k=k, sid=sid):
            n = append_values(S[k], month_end(fred(sid)), k, 'M', complete_months=False, check_tol=0.08)
            log('SIGNALS.' + k, 'ok', S[k]['d'][-1], f'+{n} (ultimo mese = ultimo valore)', 'FRED ' + sid)
        run('SIGNALS.' + k, one)

    def usrec():
        n = append_values(S['USREC'], fred('USREC'), 'USREC', 'M', check_tol=0.5)
        log('SIGNALS.USREC', 'ok', S['USREC']['d'][-1], f'+{n}', 'FRED USREC')
    run('SIGNALS.USREC', usrec)

    # CAPE e P/E: si estendono con il prezzo medio mensile dell'S&P 500 (utili invariati) -> stima
    def ext(k):
        M = D.load('MKT')['^GSPC']
        px = pd.Series(M['c'], index=pd.to_datetime(M['d']))
        avg = month_avg(px)
        am = dict(zip(avg.index.strftime('%Y-%m'), avg.values))
        o = S[k]
        base_k = o.get('base', o['d'][-1])
        if 'base' not in o:
            o['base'] = base_k; o['baseV'] = o['v'][-1]
        n = 0
        for m in sorted(am):
            if m > base_k and am.get(base_k):
                val = o['baseV'] * am[m] / am[base_k]
                if m in o['d']:
                    o['v'][o['d'].index(m)] = val
                else:
                    o['d'].append(m); o['v'].append(val); n += 1
        log('SIGNALS.' + k, 'stima', o['d'][-1], f'esteso dal {base_k} con il prezzo S&P 500 (utili fermi all\'ultimo dato pubblicato)', 'Shiller/multpl + prezzo')
    run('SIGNALS.CAPE', lambda: ext('CAPE')); run('SIGNALS.PE', lambda: ext('PE'))
    D.save('SIGNALS', S)


# ------------------------------------------------------------------ 4. nuovi dataset per il Cruscotto
CURVE_FRED = ['DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30',
              'DFII5', 'DFII10', 'T10YIE', 'T5YIFR', 'T10Y3M', 'T10Y2Y', 'BAMLH0A0HYM2', 'BAMLC0A0CM',
              'BAMLHE00EHYIOAS', 'BAA10Y', 'NFCI', 'STLFSI4', 'SOFR', 'DTWEXBGS']


def upd_curve():
    C = D.load('CURVE') or {'_info': 'Rendimenti e spread giornalieri (FRED)'}
    for sid in CURVE_FRED:
        def one(sid=sid):
            s = fred(sid)
            if sid not in ('NFCI', 'STLFSI4', 'BAA10Y'):
                s = s[s.index >= '1990-01-01']
            C[sid] = {'d': list(s.index.strftime('%Y-%m-%d')), 'v': [float(x) for x in s.values]}
            log('CURVE.' + sid, 'ok', C[sid]['d'][-1], f'{len(s)} osservazioni', 'FRED ' + sid)
        run('CURVE.' + sid, one)
    D.save('CURVE', C)

    E = D.load('EUCURVE') or {}
    for tag, mats in (('AAA', 'G_N_A'), ('ALL', 'G_N_C')):
        for m in ('3M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'):
            def one(tag=tag, mats=mats, m=m):
                s = ecb(f'YC/B.U2.EUR.4F.{mats}.SV_C_YM.SR_{m}')
                E[f'{tag}_{m}'] = {'d': list(s.index.strftime('%Y-%m-%d')), 'v': [float(x) for x in s.values]}
                log(f'EUCURVE.{tag}_{m}', 'ok', E[f'{tag}_{m}']['d'][-1], f'{len(s)} oss.', 'BCE YC')
            run(f'EUCURVE.{tag}_{m}', one)
    for cc in ('IT', 'DE', 'FR', 'ES'):
        def one(cc=cc):
            s = ecb(f'IRS/M.{cc}.L.L40.CI.0000.EUR.N.Z')
            E['GOV10_' + cc] = {'d': list(s.index.strftime('%Y-%m')), 'v': [float(x) for x in s.values]}
            log('EUCURVE.GOV10_' + cc, 'ok', E['GOV10_' + cc]['d'][-1], '', 'BCE IRS')
        run('EUCURVE.GOV10_' + cc, one)
    D.save('EUCURVE', E)


XTRA = {'SPY': 'S&P 500 (SPY, total return)', 'RSP': 'S&P 500 equal weight (RSP)', 'QQQ': 'Nasdaq 100 (QQQ)',
        'IWM': 'Russell 2000 (IWM)', 'GC=F': 'Oro future ($/oncia)', 'HG=F': 'Rame future ($/libbra)',
        'CL=F': 'Petrolio WTI future ($/barile)', 'BZ=F': 'Petrolio Brent future ($/barile)',
        'NG=F': 'Gas naturale future', 'SI=F': 'Argento future', 'DX-Y.NYB': 'Indice dollaro (DXY)',
        'EURUSD=X': 'Cambio EUR/USD', '^VIX': 'VIX (volatilità implicita 30 gg)', '^VIX3M': 'VIX 3 mesi',
        '^VIX9D': 'VIX 9 giorni', '^MOVE': 'MOVE (volatilità implicita Treasury)', '^SKEW': 'CBOE SKEW',
        'HYG': 'High yield USA (HYG)', 'LQD': 'Corporate IG USA (LQD)', 'TIP': 'TIPS USA (TIP)',
        'BTC-USD': 'Bitcoin', '^STOXX50E': 'EURO STOXX 50', '^GDAXI': 'DAX', 'FTSEMIB.MI': 'FTSE MIB',
        '^N225': 'Nikkei 225', 'EEM': 'Emergenti (EEM)', 'ACWI': 'MSCI ACWI (ACWI)', 'URTH': 'MSCI World (URTH)',
        'XLK': 'Tecnologia', 'XLF': 'Finanziari', 'XLV': 'Salute', 'XLE': 'Energia', 'XLY': 'Beni voluttuari',
        'XLI': 'Industriali', 'XLP': 'Beni di prima necessità', 'XLB': 'Materiali', 'XLU': 'Servizi pubblici',
        'XLRE': 'Immobiliare', 'XLC': 'Comunicazione', 'SMH': 'Semiconduttori (SMH)', 'TLT': 'Treasury 20+ (TLT)',
        'IEF': 'Treasury 7-10 (IEF)', 'GLD': 'Oro (GLD)'}
XTRA_RAW = {'GC=F', 'HG=F', 'CL=F', 'BZ=F', 'NG=F', 'SI=F', 'DX-Y.NYB', 'EURUSD=X', '^VIX', '^VIX3M', '^VIX9D',
            '^MOVE', '^SKEW', 'BTC-USD', '^STOXX50E', '^GDAXI', '^N225'}


def upd_xtra():
    X = D.load('XTRA') or {}
    for sym, name in XTRA.items():
        def one(sym=sym, name=name):
            s = yahoo(sym, '1990-01-01', adjusted=sym not in XTRA_RAW)['Close']
            s = s[s > 0]
            if len(s) < 50:
                raise ValueError('serie troppo corta')
            X[sym] = {'name': name, 'd': list(s.index.strftime('%Y-%m-%d')), 'c': [float(x) for x in s.values]}
            log('XTRA.' + sym, 'ok', X[sym]['d'][-1], f'{len(s)} sedute', 'Yahoo ' + sym)
        run('XTRA.' + sym, one)
    D.save('XTRA', X)


PE_TICKERS = ['SPY', 'QQQ', 'IWM', 'RSP', 'URTH', 'ACWI', 'EFA', 'EEM', 'EZU', 'EWJ', 'EWI', 'EWG', 'MCHI', 'INDA',
              'XLK', 'XLF', 'XLV', 'XLE', 'XLY', 'XLI', 'XLP', 'XLB', 'XLU', 'XLRE', 'XLC', 'SMH', 'IVE', 'IVW']


def upd_pe():
    """Fotografia giornaliera di P/E, P/B e dividendo degli ETF (Yahoo). Lo storico si accumula giorno per giorno."""
    import yfinance as yf
    P = D.load('PESNAP') or {'_info': 'P/E trailing, P/B e rendimento da dividendo degli ETF (Yahoo), una riga al giorno'}
    day = (TODAY - dt.timedelta(days=1)).isoformat()
    n_ok = 0
    for t in PE_TICKERS:
        try:
            info = yf.Ticker(t).info or {}
            row = {'pe': info.get('trailingPE'), 'pb': info.get('priceToBook'), 'dy': info.get('yield') or info.get('dividendYield')}
            if row['pe'] is None and row['pb'] is None:
                continue
            o = P.setdefault(t, {'name': info.get('shortName') or t, 'd': [], 'pe': [], 'pb': [], 'dy': []})
            if o['d'] and o['d'][-1] == day:
                for k in ('pe', 'pb', 'dy'): o[k][-1] = row[k]
            else:
                o['d'].append(day)
                for k in ('pe', 'pb', 'dy'): o[k].append(row[k])
            n_ok += 1
        except Exception as e:  # noqa: BLE001
            print('  pe', t, e)
        time.sleep(0.4)
    log('PESNAP', 'ok' if n_ok else 'ERRORE', day, f'{n_ok}/{len(PE_TICKERS)} ETF', 'Yahoo (quoteSummary)')
    D.save('PESNAP', P)


# ------------------------------------------------------------------ main
def write_meta():
    ser = {k: {'last': v['last'], 'status': v['status'], 'note': v['note'][:160], 'src': v['src']} for k, v in LOG['series'].items()}
    oks = sum(1 for v in ser.values() if v['status'] in ('ok', 'stima'))
    meta = {'updated': LOG['run'], 'ok': oks, 'errors': sum(1 for v in ser.values() if v['status'] == 'ERRORE'),
            'manual': sum(1 for v in ser.values() if v['status'] == 'manuale'), 'series': ser}
    open(os.path.join(D.DATA, 'meta.js'), 'w', encoding='utf-8').write(
        'window.DATA_META=' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    json.dump(LOG, open(os.path.join(D.DATA, 'update_log.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    only = set(sys.argv[1:])
    steps = [('mkt', upd_mkt), ('assets', upd_assets), ('rates', upd_rates), ('curve', upd_curve), ('xtra', upd_xtra), ('pe', upd_pe)]
    for name, fn in steps:
        if only and name not in only:
            continue
        print('==', name, flush=True)
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            LOG['errors'].append({'key': name, 'err': traceback.format_exc()[-2000:]})
            print('FATAL step', name, e)
    write_meta()
    print(f"Fine. ok={sum(1 for v in LOG['series'].values() if v['status']=='ok')} errori={sum(1 for v in LOG['series'].values() if v['status']=='ERRORE')}")
