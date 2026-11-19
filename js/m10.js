"use strict";
/* ===== Multi-asset: correlazioni, simulatore di portafoglio, frontiera efficiente, peso EM / oro ===== */
const AS = window.ASSETS || {};
// universo mensile (livelli a fine mese). Il mese in corso (incompleto) è escluso.
const CUR_M = new Date().toISOString().slice(0, 7);
const UNI = {
  US: { n: "Azioni USA (S&P 500 Total Return)", src: "^SP500TR", cur: "USD" },
  EXUS: { n: "Azioni sviluppati ex-USA (EFA)", src: "EFA", cur: "USD" },
  EM: { n: "Azioni Emergenti (indice MSCI EM Net TR, dal 2001)", src: "MSCIEM", cur: "USD" },
  UST: { n: "Treasury USA 10 anni (calcolato da DGS10)", src: "UST10C", cur: "USD" },
  BTP: { n: "BTP 10 anni (calcolato da rendimento OCSE)", src: "BTP10C", cur: "EUR" },
  GOLD: { n: "Oro (GLD)", src: "GLD", cur: "USD" },
  CASH: { n: "Liquidità USD (T-Bill 3 mesi)", src: "CASH", cur: "USD" },
  WORLDI: { n: "Azioni MSCI World (indice Net TR, dal 2001)", src: "MSCIWD", cur: "USD" },
  SWDA: { n: "Azioni MSCI World in EUR (SWDA.MI, dal 2009)", src: "SWDA.MI", cur: "EUR" },
  XEON: { n: "Liquidità EUR €STR (XEON, dal 2008)", src: "XEON.DE", cur: "EUR" },
  AGGH: { n: "Obbligazioni globali Bloomberg Global Aggregate EUR hedged (ETF Vanguard VAGF, IE00BG47KH54)", src: "VAGF.DE", cur: "EUR" },
  IBGS: { n: "Governativi euro 1-3 anni (iShares Acc, IE00B3VTMJ91)", src: "CSBGE3.MI", cur: "EUR" },
  IBGX: { n: "Governativi euro 3-5 anni (iShares IBGX Dist, cedole reinvestite)", src: "IBGX.AS", cur: "EUR" },
  IBGM: { n: "Governativi euro 7-10 anni (iShares Acc, IE00B3VTN290)", src: "SXRQ.DE", cur: "EUR" },
  VWRL: { n: "Azioni mondo FTSE All-World (ETF Vanguard VWRL, EUR)", src: "VWRL.AS", cur: "EUR" },
  SX5E: { n: "EURO STOXX 50 (iShares Core Acc, IE00B53L3W79)", src: "SXRT.DE", cur: "EUR" },
  VUSA: { n: "S&P 500 (ETF Vanguard VUSA, EUR)", src: "VUSA.AS", cur: "EUR" },
  XLK: { n: "Tecnologia (SPDR XLK)", src: "XLK", cur: "USD" }, XLF: { n: "Finanziari (SPDR XLF)", src: "XLF", cur: "USD" }, XLV: { n: "Salute (SPDR XLV)", src: "XLV", cur: "USD" },
  XLE: { n: "Energia (SPDR XLE)", src: "XLE", cur: "USD" }, XLY: { n: "Beni voluttuari (SPDR XLY)", src: "XLY", cur: "USD" }, XLI: { n: "Industriali (SPDR XLI)", src: "XLI", cur: "USD" },
  XLP: { n: "Beni di prima necessità (SPDR XLP)", src: "XLP", cur: "USD" }, XLB: { n: "Materiali (SPDR XLB)", src: "XLB", cur: "USD" }, XLU: { n: "Servizi pubblici (SPDR XLU)", src: "XLU", cur: "USD" },
  XLRE: { n: "Immobiliare (SPDR XLRE)", src: "XLRE", cur: "USD" }, XLC: { n: "Servizi di comunicazione (SPDR XLC)", src: "XLC", cur: "USD" },
  FVAL: { n: "MSCI World Value (indice Net TR)", src: "FVAL", cur: "USD" }, FMOM: { n: "MSCI World Momentum (indice Net TR; ETF IWMO)", src: "FMOM", cur: "USD" },
  FQUAL: { n: "MSCI World Quality (indice Net TR)", src: "FQUAL", cur: "USD" }, FSNQ: { n: "MSCI World Sector Neutral Quality (indice Net TR; ETF IWQU)", src: "FSNQ", cur: "USD" },
  FMINV: { n: "MSCI World Minimum Volatility (indice Net TR; ETF MVOL)", src: "FMINV", cur: "USD" }, FSMALL: { n: "MSCI World Small Cap (indice Net TR; ETF WSML)", src: "FSMALL", cur: "USD" },
  FEQW: { n: "MSCI World Equal Weighted (indice Net TR)", src: "FEQW", cur: "USD" }, FHDY: { n: "MSCI World High Dividend Yield (indice Net TR)", src: "FHDY", cur: "USD" },
  FSPV: { n: "S&P 500 Value (ETF iShares IVE)", src: "FSPV", cur: "USD" }, FSPG: { n: "S&P 500 Growth (ETF iShares IVW)", src: "FSPG", cur: "USD" },
  FSPEW: { n: "S&P 500 Equal Weight (ETF Invesco RSP)", src: "FSPEW", cur: "USD" }, FSDY: { n: "S&P High Yield Dividend Aristocrats (ETF SPDR SDY)", src: "FSDY", cur: "USD" },
  FSPHD: { n: "S&P 500 High Dividend (ETF SPDR SPYD)", src: "FSPHD", cur: "USD" },
  FSPEWU: { n: "S&P 500 Equal Weight – Xtrackers UCITS 1C (XDEW, acc, EUR)", src: "FSPEWU", cur: "EUR" }, FSDYU: { n: "S&P US Dividend Aristocrats – SPDR UCITS (USDV, EUR)", src: "FSDYU", cur: "EUR" },
  MCN: { n: "MSCI Cina (Net TR)", src: "MSCI_CN", cur: "USD" }, MIN: { n: "MSCI India (Net TR)", src: "MSCI_IN", cur: "USD" }, MKR: { n: "MSCI Corea del Sud (Net TR)", src: "MSCI_KR", cur: "USD" },
  MTW: { n: "MSCI Taiwan (Net TR)", src: "MSCI_TW", cur: "USD" }, MBR: { n: "MSCI Brasile (Net TR)", src: "MSCI_BR", cur: "USD" }, MSA: { n: "MSCI Arabia Saudita (Net TR)", src: "MSCI_SA", cur: "USD" },
  MZA: { n: "MSCI Sudafrica (Net TR)", src: "MSCI_ZA", cur: "USD" }, MMX: { n: "MSCI Messico (Net TR)", src: "MSCI_MX", cur: "USD" },
  CORP15: { n: "Corporate euro 1-5 anni (iShares IE00B4L60045, cedole reinvestite)", src: "IE15", cur: "EUR" },
  EMBE: { n: "Obbligazioni emergenti in $ EUR hedged (iShares EMBE, cedole reinvestite)", src: "EMBE", cur: "EUR" },
  AGGI: { n: "Global Aggregate EUR hedged (iShares Core Acc, IE00BDBRDM35)", src: "AGGI", cur: "EUR" },
  BCOM: { n: "Bloomberg Commodity TR (ETN iPath DJP)", src: "DJP", cur: "USD" }, CMOD: { n: "Bloomberg Commodity (Invesco CMOD Acc, IE00BD6FTQ80)", src: "CMOD", cur: "EUR" },
  IGLN: { n: "Oro fisico – iShares Physical Gold ETC (IGLN)", src: "IGLN", cur: "EUR" }, XGLD: { n: "Oro fisico – Xetra-Gold (4GLD)", src: "XGLD", cur: "EUR" },
  PHAG: { n: "Argento fisico – WisdomTree Physical Silver (PHAG)", src: "PHAG", cur: "EUR" }, CRUD: { n: "Petrolio WTI – ETC WisdomTree (CRUD, future)", src: "CRUD", cur: "EUR" }, BRNT: { n: "Petrolio Brent – ETC WisdomTree (BRNT, future)", src: "BRNT", cur: "EUR" },
  BRENT: { n: "Petrolio Brent – prezzo spot (EIA/FRED), non replicabile", src: "BRENT", cur: "USD" }, WTI: { n: "Petrolio WTI – prezzo spot (EIA/FRED), non replicabile", src: "WTI", cur: "USD" },
};
// classificazione per il selettore (colonne da sinistra a destra)
window.__btp = window.__btp || { mode: "CM", cp: "R", tax: "G" };
const BTPM = { BTP1: 1, BTP2: 2, BTP3: 3, BTP5: 5, BTP10Y: 10, BTP13Y: 13 };
Object.entries(BTPM).forEach(([id, m]) => { UNI[id] = { n: m === 13 ? "BTP 1-3 anni (media 1/2/3 anni, investing.com + Banca d'Italia)" : `BTP ${m} ${m === 1 ? "anno" : "anni"} (investing.com + Banca d'Italia)`, cur: "EUR" };
  Object.defineProperty(UNI[id], "src", { enumerable: true, get() { const b = window.__btp, mode = (m === 1 || m === 13) ? "CM" : b.mode; return `BTPY${m}_${mode}_${b.cp}_${b.tax}`; } }); });
const btpCtl = () => `<div class="form btpctl"><label title="Scadenza costante: ogni mese si ricompra un titolo nuovo della stessa durata. Tenuta a scadenza: si compra a 100, si tiene fino al rimborso e poi si rinnova.">Metodo <select data-btp="mode"><option value="CM" ${window.__btp.mode === "CM" ? "selected" : ""}>Scadenza costante</option><option value="HTM" ${window.__btp.mode === "HTM" ? "selected" : ""}>Tenuta a scadenza e rinnovo</option></select></label><label title="Reinvestite: le cedole ricomprano titoli. Incassate: restano in liquidità a 0%.">Cedole <select data-btp="cp"><option value="R" ${window.__btp.cp === "R" ? "selected" : ""}>Reinvestite</option><option value="P" ${window.__btp.cp === "P" ? "selected" : ""}>Incassate (a 0%)</option></select></label><label title="Ritenuta del 12,5% sulle cedole dei titoli di Stato (le plusvalenze non sono tassate nel calcolo).">Tasse <select data-btp="tax"><option value="G" ${window.__btp.tax === "G" ? "selected" : ""}>Lordo</option><option value="N" ${window.__btp.tax === "N" ? "selected" : ""}>Netto 12,5% sulle cedole</option></select></label></div>`;
document.addEventListener("change", e => { const k = e.target && e.target.dataset && e.target.dataset.btp; if (!k) return; window.__btp[k] = e.target.value; document.querySelectorAll(`[data-btp=${k}]`).forEach(x => x.value = e.target.value); if (e.target.closest("#aaOut") && window.aaRun) aaRun(); });
const SECT = ["XLK", "XLF", "XLV", "XLE", "XLY", "XLI", "XLP", "XLB", "XLU", "XLRE", "XLC"], FW = ["FVAL", "FMOM", "FQUAL", "FSNQ", "FMINV", "FSMALL", "FEQW", "FHDY"], FS = ["FSPV", "FSPG", "FSPEW", "FSPEWU", "FSDY", "FSDYU", "FSPHD"], EMC = ["MCN", "MIN", "MKR", "MTW", "MBR", "MSA", "MZA", "MMX"];
const GROUPS = [["AZIONI", [["Globali", ["WORLDI", "SWDA", "VWRL"], 1], ["Fattoriali – MSCI World", FW], ["Fattoriali – S&P 500", FS], ["Europa", ["SX5E", "EXUS"]], ["USA", ["US", "VUSA"]], ["S&P 500 SECTOR", SECT], ["Emergenti", ["EM"], 1], ["Emergenti – singoli paesi", EMC]]],
  ["OBBLIGAZIONI E LIQUIDITÀ", [["Governativi euro", ["IBGS", "IBGX", "IBGM"], 1], ["BTP", ["BTP1", "BTP2", "BTP3", "BTP5", "BTP10Y", "BTP13Y", "BTP"]], ["Corporate", ["CORP15"]], ["Emergenti", ["EMBE"]], ["Globali", ["AGGH", "AGGI", "UST"]], ["Monetario", ["XEON", "CASH"], 1]]],
  ["ALTERNATIVI", [["Oro", ["GOLD"], 1], ["Commodity", ["BCOM", "CMOD"]], ["ETC (investibili, EUR)", ["IGLN", "XGLD", "PHAG", "CRUD", "BRNT"]], ["Petrolio – prezzo spot (non replicabile)", ["BRENT", "WTI"]]]]];
const BGROUPS = [["Azionari", ["SP", "MW", "B6040", "BSX5E"]], ["Mercati emergenti (MSCI EM + 8 paesi)", ["BEM", ...EMC.map(x => "B" + x)]], ["Fattoriali (MSCI World e S&P 500)", [...FW, ...FS].map(x => "B" + x)], ["S&P 500 SECTOR", SECT.map(x => "B" + x)], ["Bilanciati su indici (ribil. mensile)", ["IX20", "IX40", "IX60", "IX80", "IB20", "IB40", "IB60", "IB80", "IXG60", "IS20", "IS40", "IS60", "IS80"]], ["Bilanciati ETF Vanguard (VWRL / VAGF, ribil. mensile)", ["LS20", "LS40", "LS60", "LS80"]], ["Obbligazionari", ["BBTP1", "BBTP2", "BBTP3", "BBTP5", "BBTP10Y", "BBTP13Y", "IBGS", "IBGX", "IBGM", "AGGB", "BAGGI", "BCORP15", "BEMBE"]], ["Alternativi", ["BGOLD", "BIGLN", "BXGLD", "BPHAG", "BCRUD", "BBRNT", "BBCOM", "BBRENT", "BWTI"]], ["Liquidità / Inflazione", ["CASHPP"]]];
window.__infl = window.__infl || "IT";
const startY = id => { try { const [, src, cur] = keyOf(id); const L = monthlyLv(src, cur, "EUR"); const k = [...L.keys()].sort()[0]; return k ? +k.slice(0, 4) : null; } catch (e) { return null; } };
const benchY = k => Math.max(...Object.keys(BENCH[k][1]).map(startY).filter(x => x));
const EXTRA = { NDX: ["Nasdaq 100 (prezzo)", "^NDX"], RUT: ["Russell 2000 (prezzo)", "^RUT"], IEF: ["Treasury 7-10 anni (IEF)", "IEF"], TLT: ["Treasury 20+ anni (TLT)", "TLT"], SHY: ["Treasury 1-3 anni (SHY)", "SHY"], AGG: ["Obbligazioni USA aggregate (AGG)", "AGG"], VWO: ["Emergenti (VWO)", "VWO"], UST2: ["Treasury 2 anni (calcolato da DGS2)", "UST2C"],
  EEM: ["Emergenti (ETF EEM)", "EEM"], SPP: ["S&P 500 (solo prezzo, dal 1928)", "^GSPC"], MWP: ["MSCI World (solo prezzo, dal 1997)", "MSCIWDP"], EMP: ["MSCI EM (solo prezzo, dal 1997)", "MSCIEMP"], URTH: ["MSCI World (ETF URTH)", "URTH"], GOLDWB: ["Oro spot (Banca Mondiale, media mensile, dal 1960)", "GOLDWB"],
  VAGF: ["Obbligazioni globali EUR hedged (ETF Vanguard VAGF)", "VAGF.DE"] };
const BENCH = {
  IS20: ["20/80 indici (MSCI World / Gov. euro 1-3a iShares)", { WORLDI: 0.2, IBGS: 0.8 }, "monthly"],
  IS40: ["40/60 indici (MSCI World / Gov. euro 1-3a iShares)", { WORLDI: 0.4, IBGS: 0.6 }, "monthly"],
  IS60: ["60/40 indici (MSCI World / Gov. euro 1-3a iShares)", { WORLDI: 0.6, IBGS: 0.4 }, "monthly"],
  IS80: ["80/20 indici (MSCI World / Gov. euro 1-3a iShares)", { WORLDI: 0.8, IBGS: 0.2 }, "monthly"],
  IX20: ["20/80 indici (MSCI World / BTP 10a)", { WORLDI: .2, BTP: .8 }, "monthly"], IX40: ["40/60 indici (MSCI World / BTP 10a)", { WORLDI: .4, BTP: .6 }, "monthly"],
  IX60: ["60/40 indici (MSCI World / BTP 10a)", { WORLDI: .6, BTP: .4 }, "monthly"], IX80: ["80/20 indici (MSCI World / BTP 10a)", { WORLDI: .8, BTP: .2 }, "monthly"],
  IXG60: ["60/40 indici (MSCI World / Gov. euro 7-10a iShares)", { WORLDI: .6, IBGM: .4 }, "monthly"],
  SP: ["S&P 500 Total Return", { US: 1 }], MW: ["MSCI World (indice Net TR)", { WORLDI: 1 }], B6040: ["60/40 USA (S&P 500 / Treasury 10a)", { US: .6, UST: .4 }],
  LS20: ["20/80 ETF Vanguard", { VWRL: .2, VAGF: .8 }, "monthly"], LS40: ["40/60 ETF Vanguard", { VWRL: .4, VAGF: .6 }, "monthly"],
  LS60: ["60/40 ETF Vanguard", { VWRL: .6, VAGF: .4 }, "monthly"], LS80: ["80/20 ETF Vanguard", { VWRL: .8, VAGF: .2 }, "monthly"],
  AGGB: ["Bloomberg Global Agg. EUR hedged (ETF Vanguard VAGF)", { VAGF: 1 }], IBGS: ["Governativi euro 1-3a (iShares Acc)", { IBGS: 1 }], IBGX: ["Governativi euro 3-5a (iShares IBGX, cedole reinvestite)", { IBGX: 1 }],
  IBGM: ["Governativi euro 7-10a (iShares Acc)", { IBGM: 1 }], CASHPP: ["Contante sotto il materasso (perde l'inflazione)", { CASHPP: 1 }] };
["SX5E", "EM", ...Object.keys(BTPM), ...SECT, ...EMC, ...FW, ...FS, "AGGI", "CORP15", "EMBE", "GOLD", "IGLN", "XGLD", "PHAG", "CRUD", "BRNT", "BCOM", "BRENT", "WTI"].forEach(k => { BENCH["B" + k] = [UNI[k].n.replace(/ \(.*\)$/, "") + (/SPDR|MSCI/.test(UNI[k].n) ? "" : ""), { [k]: 1 }]; });
const groupedChecks = (cls, pool, isOn) => { const seen = new Set(); const sec = GROUPS.flatMap(([g, SUB]) => SUB.map(([sg, L]) => [g.split(" ")[0] + " · " + sg, L.filter(id => pool.includes(id))])); sec.forEach(([, L]) => L.forEach(x => seen.add(x))); const rest = pool.filter(x => !seen.has(x)); if (rest.length) sec.push(["Altri (ETF e indici di prezzo)", rest]);
  return `<div class="pickcols">${sec.filter(([, L]) => L.length).map(([g, L]) => `<details class="more sub" ${L.some(isOn) ? "open" : ""}><summary>${g} <small class="muted">(${L.length})</small></summary><div class="checks">${L.map(id => `<label><input type="checkbox" class="${cls}" value="${id}" ${isOn(id) ? "checked" : ""}> ${keyOf(id)[0]} <small class="muted">· dal ${startY(id) || "–"}</small></label>`).join("")}</div></details>`).join("")}</div>`; };
[20, 40, 60, 80].forEach(p => { BENCH["IB" + p] = [`${p}/${100 - p} indici (MSCI World / BTP 1-3a)`, { WORLDI: p / 100, BTP13Y: 1 - p / 100 }, "monthly"]; });
window.__bm = window.__bm || new Set();
window.__pfSaved = window.__pfSaved || [];
function rawSeries(src) { if (FULL[src]) return { d: FULL[src].d, c: FULL[src].c, freq: "D" }; const a = AS[src]; return a ? { d: a.d, c: a.c, freq: a.freq } : null; }
const FXm = (() => { const m = new Map(); if (window.MACRO && MACRO.eur) MACRO.eur.d.forEach((d, i) => m.set(d.slice(0, 7), MACRO.eur.v[i])); return m; })(); // ultimo cambio del mese (USD per EUR)
function cpiMap(ccy) { const m = new Map(); const S = ccy === "EUR" ? (window.__infl === "EA" ? AS.CPI_EA : AS.CPI_IT) : (window.MACRO && MACRO.cpi ? { d: MACRO.cpi.d, c: MACRO.cpi.v } : null); if (S) S.d.forEach((d, i) => { if (d.slice(0, 7) < CUR_M) m.set(d.slice(0, 7), S.c[i]); }); return m; }
function monthlyLv(src, cur, ccy) { // Map "YYYY-MM" -> livello nella valuta ccy
  if (src === "CASHPP") { const o = new Map(); for (const [k, v] of cpiMap(ccy)) o.set(k, 100 / v); return o; } // contante a 0% in termini reali
  const r = rawSeries(src); if (!r) return new Map(); const m = new Map();
  r.d.forEach((d, i) => { const k = d.slice(0, 7); if (k < CUR_M) m.set(k, r.c[i]); });
  if (cur === ccy) return m;
  const o = new Map(); for (const [k, v] of m) { const fx = FXm.get(k); if (fx) o.set(k, ccy === "EUR" ? v / fx : v * fx); }
  const e = ccy === "EUR" ? rawSeries(src + "_EUR") : null; // serie ufficiale MSCI in EUR (WM/Reuters) dove disponibile
  if (e && e.d.length) { const em = new Map(); e.d.forEach((d, i) => { const k = d.slice(0, 7); if (k < CUR_M) em.set(k, e.c[i]); });
    const k0 = [...em.keys()].sort()[0], sc = o.has(k0) ? em.get(k0) / o.get(k0) : null; const out = new Map();
    if (sc) for (const [k, v] of o) if (k < k0) out.set(k, v * sc); for (const [k, v] of em) out.set(k, v); return out; }
  return o;
}
const keyOf = id => id === "CASHPP" ? ["Contante (potere d'acquisto, " + (window.__infl === "EA" ? "HICP area euro" : "inflazione Italia ISTAT") + " in EUR)", "CASHPP", "ANY"] : UNI[id] ? [UNI[id].n, UNI[id].src, UNI[id].cur] : [EXTRA[id][0], EXTRA[id][1], AS[EXTRA[id][1]] ? AS[EXTRA[id][1]].cur : "USD"];
function monthlyRets(ids, ccy, from, to) { // matrice rendimenti mensili sul periodo comune
  const L = ids.map(id => { const [, src, cur] = keyOf(id); return monthlyLv(src, cur, ccy); });
  let months = [...L[0].keys()].filter(k => L.every(m => m.has(k))).sort();
  const f = from.slice(0, 7), t = to.slice(0, 7); months = months.filter(k => k >= f && k <= t);
  const R = ids.map((_, j) => months.slice(1).map((k, i) => L[j].get(k) / L[j].get(months[i]) - 1));
  return { months: months.slice(1), start: months[0], R };
}
const cashRets = (months, ccy) => { const m = monthlyLv("CASH", "USD", "USD"); const keys = [...m.keys()].sort(); const out = []; months.forEach(k => { const i = keys.indexOf(k); out.push(i > 0 ? m.get(k) / m.get(keys[i - 1]) - 1 : 0); }); return out; };
function pstats(rets, rf) {
  const n = rets.length, eq = [1]; rets.forEach(r => eq.push(eq[eq.length - 1] * (1 + r)));
  const cagr = eq[n] ** (12 / n) - 1, vol = std(rets) * Math.sqrt(12), ex = rets.map((r, i) => r - (rf[i] || 0)), exm = mean(ex);
  const dn = Math.sqrt(mean(ex.map(x => Math.min(0, x) ** 2))) * Math.sqrt(12);
  let pk = 1, pkI = 0, md = 0, rec = 0, uw = 0; eq.forEach((v, i) => { if (v >= pk) { pk = v; pkI = i; uw = 0; } else { uw = i - pkI; rec = Math.max(rec, uw); } md = Math.min(md, v / pk - 1); });
  return { cagr, vol, sharpe: exm * 12 / vol, sortino: exm * 12 / dn, md, rec, eq, tot: eq[n] - 1 };
}
const RB = { none: 0, annual: 12, quarterly: 3, monthly: 1 };
function simulate(R, w, reb, months, pac = 0, init = 10000) { // R: [asset][t]
  const k = R.length, T = R[0].length; let h = w.map(x => x * init), invested = init; const ret = [], val = [init], cap = [init];
  for (let t = 0; t < T; t++) {
    const before = h.reduce((a, b) => a + b, 0); h = h.map((x, j) => x * (1 + R[j][t])); const after = h.reduce((a, b) => a + b, 0);
    ret.push(after / before - 1);
    if (pac) { h = h.map((x, j) => x + pac * w[j]); invested += pac; }
    const mo = +months[t].slice(5, 7); const per = RB[reb];
    if (per && (per === 1 || mo % per === 0)) { const tot = h.reduce((a, b) => a + b, 0); h = w.map(x => x * tot); }
    val.push(h.reduce((a, b) => a + b, 0)); cap.push(invested);
  }
  return { ret, val, cap, invested };
}
const FE_DEF = ["WORLDI", "EM", "IBGS", "IBGM", "GOLD"];
const PRESETS = {
  "60/40 euro (MSCI World / Gov. euro)": { WORLDI: 60, IBGM: 25, IBGS: 15 }, "Bilanciato euro prudente": { WORLDI: 35, IBGS: 25, IBGX: 20, XEON: 15, GOLD: 5 },
  "60/40": { US: 60, UST: 40 }, "70/30": { US: 70, UST: 30 }, "80/20": { US: 80, UST: 20 }, "100% azioni USA": { US: 100 },
  "Stile All Weather (semplificato)": { US: 30, UST: 55, GOLD: 15 }, "Globale bilanciato": { US: 40, EXUS: 15, EM: 10, UST: 20, GOLD: 10, CASH: 5 },
  "Investitore italiano 50/50": { US: 35, EXUS: 10, EM: 5, BTP: 40, GOLD: 5, CASH: 5 }, "Personalizzato": null };

function renderMulti() {
  window.__drawFE = null;
  const ids = Object.keys(UNI);
  const [e1, ei1] = div("chart tall"), [dd1, ddi1] = div(), [y1, yi1] = div(), [rc1, rci1] = div(), [f1, fi1] = div("chart tall fechart"), [st1, sti1] = div("chart");
  const YOPT = l => `<option value="">${l}</option>` + Array.from({ length: new Date().getFullYear() - 1971 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => `<option value="${y}">${y}</option>`).join("");
  window.__feC = window.__feC || "0.6"; if (window.__feAlt == null) window.__feAlt = 10; window.__feB = window.__feB || {};
  const allIds = [...ids, ...Object.keys(EXTRA)];
  $("#multiOut").innerHTML = `${TB("multiOut", "multi_asset")}
  <div class="card"><h3>Simulatore di portafoglio</h3>
   <div class="form"><label>Modello <select id="pfPreset">${Object.keys(PRESETS).map(k => `<option>${k}</option>`).join("")}</select></label>
    <label title="Primo anno della simulazione. Se un asset o benchmark scelto non ha dati così indietro, si parte dal primo anno comune e lo si segnala.">Anno di partenza <select id="pfY0"><option value="">Massimo disponibile</option>${Array.from({length: new Date().getFullYear() - 1971 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => `<option value="${y}">${y}</option>`).join("")}</select></label>
    <label>Anno di fine <select id="pfY1"><option value="">Ultimo disponibile</option>${Array.from({length: new Date().getFullYear() - 1971 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => `<option value="${y}">${y}</option>`).join("")}</select></label>
    <label>Ribilanciamento <select id="pfReb"><option value="annual">Annuale</option><option value="quarterly">Trimestrale</option><option value="monthly">Mensile</option><option value="none">Nessuno</option></select></label>
    <label>Valuta <select id="pfCcy"><option value="EUR" selected>EUR (dal 1999)</option><option value="USD">USD</option></select></label>
    <label>Capitale iniziale <input id="pfInit" type="number" value="10000" min="0"></label><label>PAC mensile (0 = nessuno) <input id="pfPac" type="number" value="0" min="0"></label>
    <button id="pfGo" class="primary">Simula</button></div>
   <h4 class="pick-h">1 · Scegli gli strumenti del portafoglio (pesi in %)</h4>
   <div id="pfW" class="pickcols">${GROUPS.map(([g, SUB]) => `<div class="pickcol"><div class="pickhead">${g}</div>${SUB.map(([sg, L, op]) => `<details class="more sub" ${op ? "open" : ""}><summary>${sg} <small class="muted">(${L.length})</small></summary>${sg === "BTP" ? btpCtl() : ""}${L.filter(id => UNI[id]).map(id => `<div class="wrow"><span title="${UNI[id].src} · ${UNI[id].cur}">${UNI[id].n}<small class="muted"> · ${UNI[id].cur} · dal ${startY(id) || "–"}</small></span><input type="range" min="0" max="100" step="1" data-w="${id}" value="0"><input type="number" min="0" max="100" step="1" data-wn="${id}" value="0"><span>%</span></div>`).join("")}</details>`).join("")}</div>`).join("")}</div>
   <div id="pfSum" class="muted"></div>
   <p class="note">Periodo = selettore date/«Ultimi N anni» in alto, limitato alla storia comune degli asset con peso &gt; 0. Rendimenti mensili, nessun costo/tassa. Sharpe e Sortino calcolati sull'eccesso rispetto ai T-Bill a 3 mesi. I benchmark si attivano solo cliccandoli; puoi salvare fino a 4 portafogli per confrontarli. Emergenti = indice ufficiale MSCI EM (msci.com), non un fondo.</p>
   <div class="bmbox"><h4 class="pick-h">2 · Benchmark da confrontare <span class="muted">(clicca per attivare/disattivare)</span></h4>
   <div class="bmgroups">${BGROUPS.map(([g, L]) => `<div class="bmgroup">${g !== "Azionari" && !g.startsWith("Liquidità") ? `<details class="more" ${L.some(k => window.__bm.has(k)) || g.startsWith("Mercati emergenti") ? "open" : ""}><summary class="pickhead">${g} (${L.length})</summary>` : `<div class="pickhead">${g}</div>`}<div class="chips">${L.filter(k => BENCH[k]).map(k => `<button class="chip${window.__bm.has(k) ? " on" : ""}" data-bm="${k}">${BENCH[k][0]} <small>· dal ${benchY(k)}</small></button>`).join("")}</div>${g.startsWith("Liquidità") ? `<label class="muted">Inflazione per il contante (EUR) <select id="pfInfl"><option value="IT" ${window.__infl === "IT" ? "selected" : ""}>Italia – ISTAT NIC (FRED ITACPIALLMINMEI; da apr-2025 IPCA Italia)</option><option value="EA" ${window.__infl === "EA" ? "selected" : ""}>Area euro – HICP Eurostat (FRED CP0000EZ19M086NEST)</option></select></label>` : ""}${g !== "Azionari" && !g.startsWith("Liquidità") ? "</details>" : ""}</div>`).join("")}</div>
   <div class="form"><label>Nome portafoglio <input id="pfName" value="Portafoglio ${window.__pfSaved.length + 1}"></label><button id="pfSave">➕ Salva nel confronto</button><button id="pfClear">Svuota salvati</button><span id="pfSavedL" class="muted"></span></div></div>
   <div id="pfOut"></div>${e1}<div class="grid2"><div>${dd1}</div><div>${y1}</div></div><div id="pfYT"></div><div id="pfDD"></div></div>
  <div class="card"><h3>Correlazione tra due asset nel tempo</h3>
   <div class="form"><label>Asset A <select id="rcA">${allIds.map(id => `<option value="${id}" ${id === "US" ? "selected" : ""}>${keyOf(id)[0]}</option>`).join("")}</select></label>
    <label>Asset B <select id="rcB">${allIds.map(id => `<option value="${id}" ${id === "UST" ? "selected" : ""}>${keyOf(id)[0]}</option>`).join("")}</select></label>
    <label>Finestra (mesi) <select id="rcW"><option>12</option><option selected>36</option><option>60</option></select></label>
    <label title="Primo anno da analizzare. Se i dati dei due asset partono dopo, si usa il primo anno disponibile e lo si segnala.">Dall'anno <select id="rcY0">${YOPT("Primo disponibile")}</select></label>
    <label>All'anno <select id="rcY1">${YOPT("Ultimo disponibile")}</select></label></div>
   <div id="rcTxt"></div>${rc1}</div>
  <div class="card" id="feCard"><h3>Frontiera efficiente: trova il mix ideale per il rischio che accetti</h3>
   <details class="more nopdf"><summary class="pickhead">Come leggere il grafico</summary><div class="feHelp">
    <ul><li><b>Asse orizzontale = rischio</b> (volatilità annua): quanto il valore oscilla in un anno tipico. Più a destra, più sali e scendi.</li>
    <li><b>Asse verticale = rendimento</b> medio annuo ottenuto nel periodo scelto. Più in alto, meglio.</li>
    <li><b>Nuvola di puntini</b>: tanti portafogli possibili con gli asset e i vincoli scelti. Il colore indica lo Sharpe (rendimento per unità di rischio: più dorato = più efficiente).</li>
    <li><b>Linea bianca (frontiera)</b>: i portafogli migliori, cioè quelli che a parità di rischio hanno dato il rendimento più alto. Conviene stare sulla linea, non sotto.</li>
    <li><b>◆ verde = Minima volatilità</b>: il mix che ha oscillato meno. <b>★ rossa = Massimo Sharpe</b>: il miglior rapporto rendimento/rischio.</li>
    <li><b>Punti blu = singoli asset</b> presi da soli. Un asset da solo può sembrare rischioso, ma nel mix può <i>ridurre</i> il rischio complessivo se si muove diversamente dagli altri (diversificazione).</li>
    <li><b>Cerchio bianco = portafoglio selezionato</b>: cliccando un punto della linea o muovendo il cursore «Volatilità che accetto» lo scegli, e sotto vedi le percentuali.</li></ul>
    <p class="warn">Attenzione: tutto è calcolato sul passato. I pesi «ideali» cambiano molto se cambi il periodo e non sono una previsione né una raccomandazione personalizzata.</p></div></details>
   <div class="nopdf"><h4 class="pick-h">1 · Scegli gli asset <button id="feFromPf" class="chip" title="Seleziona gli stessi asset del portafoglio impostato in alto e lo confronta con la frontiera">↺ Usa il portafoglio in alto</button></h4>
   ${groupedChecks("fek", ids, id => FE_DEF.includes(id))}</div>
   <h4 class="pick-h">2 · Periodo, vincoli e rischio</h4>
   <div class="form"><label title="Primo anno usato per stimare rendimenti, rischi e correlazioni.">Dall'anno <select id="feY0">${YOPT("Primo disponibile")}</select></label>
    <label>All'anno <select id="feY1">${YOPT("Ultimo disponibile")}</select></label>
    <span class="fecons">Azioni / Obbligazioni ${[["0.4", "40/60"], ["0.5", "50/50"], ["0.6", "60/40"], ["free", "Libero"]].map(([v, l]) => `<button class="chip${window.__feC === v ? " on" : ""}" data-fec="${v}">${l}</button>`).join("")}</span>
</div>
   <details class="more nopdf feadv" id="feAdv"${window.__feAdvOpen ? " open" : ""}><summary class="pickhead">⚙ Opzioni avanzate (limiti min/max per asset, massimo alternativi)</summary>
   <div class="form"><label title="Oro, commodity e petrolio sono «alternativi»: con un vincolo azioni/obbligazioni prendono posto dentro la quota azionaria, fino a questo massimo.">Max alternativi (% del totale) <input id="feAlt" type="number" min="0" max="100" step="1" value="${window.__feAlt}"></label></div>
   <p class="note" id="feConsNote"></p>
   <div id="feBounds"></div></details>
   <div class="form feslider nopdf"><label>Volatilità che accetto: <b id="feVolL">–</b> <input id="feVol" type="range" min="0" max="1" step="0.1" value="0.5" style="width:420px"></label> <span id="feVolR" class="muted"></span><div id="feLive" class="felive"></div></div>
   <div id="feCmp"></div><div id="feTxt"></div>${f1}<div id="feTab"></div>
   <details class="more nopdf" id="feStk"><summary class="pickhead">Come cambiano i pesi salendo con il rischio</summary>${st1}</details>
   <p class="note">Calcolo: rendimenti mensili in EUR (asset in dollari convertiti senza copertura del cambio) sul periodo scelto; frontiera calcolata con un ottimizzatore vincolato (gradiente proiettato su pesi ≥ 0, limiti min/max per asset e quote azioni/obbligazioni esatte), più 4.000 portafogli casuali che rispettano gli stessi vincoli. Calo massimo storico simulato con ribilanciamento mensile. Sharpe calcolato rispetto ai T-Bill USA a 3 mesi. Nessun costo né tassa.</p></div>
`;
  // --- pesi
  const setW = o => ids.forEach(id => { const v = (o && o[id]) || 0; document.querySelector(`[data-w=${id}]`).value = v; document.querySelector(`[data-wn=${id}]`).value = v; });
  const getW = () => Object.fromEntries(ids.map(id => [id, +document.querySelector(`[data-wn=${id}]`).value || 0]));
  const showSum = () => { const s = Object.values(getW()).reduce((a, b) => a + b, 0); $("#pfSum").innerHTML = s === 100 ? `Totale pesi: <b class="pos">100%</b>` : `<span class="warn">Totale pesi: ${s}% — deve essere 100%</span>`; return s; };
  document.querySelectorAll("[data-w]").forEach(r => r.oninput = () => { document.querySelector(`[data-wn=${r.dataset.w}]`).value = r.value; $("#pfPreset").value = "Personalizzato"; showSum(); });
  document.querySelectorAll("[data-wn]").forEach(r => r.oninput = () => { document.querySelector(`[data-w=${r.dataset.wn}]`).value = r.value; $("#pfPreset").value = "Personalizzato"; showSum(); });
  $("#pfPreset").onchange = () => { const p = PRESETS[$("#pfPreset").value]; if (p) { setW(p); showSum(); runPf(); } };
  setW(window.__pfW || PRESETS["60/40 euro (MSCI World / Gov. euro)"]); if (window.__pfP) $("#pfPreset").value = window.__pfP; showSum();
  const runPf = () => {
    window.__pfW = getW(); window.__pfP = $("#pfPreset").value;
    $("#pfSavedL").textContent = window.__pfSaved.length ? "Salvati: " + window.__pfSaved.map(p => p.name).join(", ") : "";
    if (showSum() !== 100) { $("#pfOut").innerHTML = `<p class="warn">I pesi devono sommare a 100% prima di simulare.</p>`; return; }
    const ccy0 = $("#pfCcy").value; { const ids = Object.entries(getW()).filter(([, v]) => v > 0).map(([k]) => k).concat([...window.__bm].flatMap(b => BENCH[b] ? Object.keys(BENCH[b][1]) : [])); const other = ids.filter(id => { const k = keyOf(id); return k[2] !== "ANY" && k[2] !== ccy0 && !(ccy0 === "EUR" && rawSeries(k[1] + "_EUR")); }).map(id => keyOf(id)[0]);
      let n = document.getElementById("pfFxNote"); if (!n) { n = document.createElement("div"); n.id = "pfFxNote"; n.className = "note"; $("#pfCcy").closest("div").after(n); }
      n.innerHTML = `Valuta di calcolo: <b>${ccy0}</b>. ` + (other.length ? `⚠️ Strumenti quotati in un'altra valuta, convertiti in ${ccy0} senza copertura (il rendimento include l'effetto cambio): ${[...new Set(other)].join(", ")}.` : "Tutti gli strumenti sono già espressi in questa valuta."); }
    const W = getW(), ccy = $("#pfCcy").value, reb = $("#pfReb").value, pac = +$("#pfPac").value || 0, init = +$("#pfInit").value || 0;
    if (init <= 0 && pac <= 0) { $("#pfOut").innerHTML = `<p class="warn">Inserire capitale iniziale o PAC.</p>`; return; }
    const ports = [{ name: "Il tuo portafoglio", w: Object.fromEntries(Object.entries(W).filter(([, v]) => v > 0).map(([k, v]) => [k, v / 100])), main: true },
      ...window.__pfSaved.map(p => ({ name: p.name, w: p.w })), ...[...window.__bm].map(k => ({ name: BENCH[k][0], w: BENCH[k][1], bm: true, reb: BENCH[k][2] }))];
    const need = [...new Set(ports.flatMap(p => Object.keys(p.w)))], y0 = $("#pfY0").value, y1 = $("#pfY1").value;
    if (y0 && y1 && +y1 < +y0) { $("#pfOut").innerHTML = `<p class="warn">L'anno di fine (${y1}) è precedente all'anno di partenza (${y0}).</p>`; return; }
    const fromQ = y0 ? `${+y0 - 1}-12-01` : st.from, toQ = y1 ? `${y1}-12-31` : st.to;
    const M = monthlyRets(need, ccy, fromQ > st.from ? fromQ : st.from, toQ < st.to ? toQ : st.to);
    const firstM = id => { const [, src, cur] = keyOf(id); const k = [...monthlyLv(src, cur, ccy).keys()].sort(); return k[0]; };
    const nm = id => keyOf(id)[0], inBm = id => ports.filter(p => p.bm && p.w[id] !== undefined).map(p => p.name);
    const fm = Object.fromEntries(need.map(id => [id, firstM(id)])), wantM = y0 ? `${+y0 - 1}-12` : null;
    const lim = M.start ? need.filter(id => fm[id] === M.start || (fm[id] > (wantM || "")) && fm[id] >= M.start) : [];
    const fmtM = k => { const [a, b] = k.split("-").map(Number); const d = new Date(Date.UTC(a, b - 1, 1)); return d.toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }); };
    const limTxt = !lim.length ? `conversione in ${ccy} disponibile da ${fmtM(M.start)}` : lim.map(id => `<b>${nm(id)}</b> disponibile da ${fmtM(fm[id])}${inBm(id).length && !(id in ports[0].w) ? ` (nel benchmark ${inBm(id).join(", ")})` : ""}`).join("; ");
    const startY = M.months.length ? M.months[0] : "";
    const periodNote = !M.months.length ? "" : (y0 && startY > `${y0}-01`) ? `<p class="warn pfperiod">⚠️ Hai chiesto dal ${y0}, ma l'analisi parte da ${fmtM(startY)}: ${limTxt}. Per partire prima, togli o sostituisci questi strumenti.</p>`
      : `<p class="note pfperiod">Periodo analizzato: <b>${fmtM(startY)} → ${fmtM(M.months[M.months.length - 1])}</b>${y0 ? ` (dal ${y0}, come richiesto)` : ` (massimo disponibile in comune${lim.length ? "; limitato da " + limTxt : ""})`}${y1 && M.months[M.months.length - 1].slice(0, 4) < y1 ? ` · ultimo dato disponibile ${fmtM(M.months[M.months.length - 1])}` : ""}.</p>`;
    if (M.months.length < 12) { $("#pfOut").innerHTML = `<p class="warn">Storia comune insufficiente nel periodo selezionato (servono almeno 12 mesi; trovati ${M.months.length}). Alcuni asset/benchmark hanno storie brevi (es. VAGF dal 2019): disattivali o allarga il periodo.</p>`; return; }
    if (lim.length) { const x = lim.map(id => `${nm(id)} da ${fmtM(fm[id])}`).join("; "); /* usato nella nota */ }
    const rf = cashRets(M.months, ccy), xs = [M.start, ...M.months];
    const mEnd = k => { const [y, m] = k.split("-").map(Number); return new Date(Date.UTC(y, m, 0)); };
    const recDays = eq => { let pk = 0, pkI = 0, best = 0, open = false; eq.forEach((v, i) => { if (v >= eq[pkI]) { if (i > pkI) best = Math.max(best, (mEnd(xs[i]) - mEnd(xs[pkI])) / 864e5); pkI = i; open = false; } else open = true; }); const cur = open ? (mEnd(xs[xs.length - 1]) - mEnd(xs[pkI])) / 864e5 : 0; return { days: Math.round(Math.max(best, cur)), open: open && cur >= best }; };
    const ddEps = eq => { const out = []; let pkI = 0, tI = 0, inDD = false; for (let i = 1; i <= eq.length; i++) { const v = eq[i]; if (i < eq.length && v < eq[pkI]) { if (!inDD) { inDD = true; tI = i; } if (v < eq[tI]) tI = i; } else { if (inDD) out.push({ p: xs[pkI], t: xs[tI], r: i < eq.length ? xs[i] : null, d: eq[tI] / eq[pkI] - 1, days: Math.round(((i < eq.length ? mEnd(xs[i]) : mEnd(xs[xs.length - 1])) - mEnd(xs[pkI])) / 864e5) }); inDD = false; if (i < eq.length) pkI = i; } } return out.sort((a, b) => a.d - b.d); };
    const res = ports.map(p => { const ids2 = Object.keys(p.w), sim = simulate(ids2.map(id => M.R[need.indexOf(id)]), ids2.map(id => p.w[id]), p.reb || reb, M.months, p.main ? pac : 0, p.main ? (init || 1e-9) : 10000); const S2 = pstats(sim.ret, rf);
      const A = {}; sim.ret.forEach((r, i) => { const y = M.months[i].slice(0, 4); A[y] = (A[y] || 1) * (1 + r); }); const full = Object.keys(A).filter(y => M.months.filter(m => m.startsWith(y)).length === 12);
      return { ...p, sim, S: S2, A, full, am: (1 + mean(sim.ret)) ** 12 - 1, rd: recDays(S2.eq) }; });
    const P = res[0], sim = P.sim, Ys = Object.keys(P.A);
    const irr = pac ? (() => { const fl = [[0, -init], ...M.months.map((m, i) => [i + 1, -pac])]; fl[fl.length - 1][1] += sim.val[sim.val.length - 1] + pac; let lo = -0.9, hi = 1; const npv = r => fl.reduce((s, [t, v]) => s + v / (1 + r) ** (t / 12), 0); for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; npv(m) > 0 ? lo = m : hi = m; } return (lo + hi) / 2; })() : null;
    const head = ["", "CAGR", "Rend. medio annuo", "Volatilità", "Max drawdown", "Giorni di recupero (max)", "Sharpe", "Sortino", "Anno peggiore", "Anno migliore"];
    const rows = res.map(r => [r.main ? `<b>${r.name}</b>` : r.bm ? `${r.name} <span class="muted">(benchmark)</span>` : r.name, pc(r.S.cagr, 2), pc(r.am, 2), pct(r.S.vol), pc(r.S.md), num(r.rd.days, 0) + (r.rd.open ? " (in corso)" : ""), num(r.S.sharpe), num(r.S.sortino), r.full.length ? pc(Math.min(...r.full.map(y => r.A[y] - 1))) : "–", r.full.length ? pc(Math.max(...r.full.map(y => r.A[y] - 1))) : "–"]);
    const wtxt = w => Object.entries(w).map(([k, v]) => `${keyOf(k)[0]} ${Math.round(v * 100)}%`).join(", ");
    $("#pfOut").innerHTML = `${periodNote}<div class="answer">Periodo comune effettivo: <b>${M.months[0]} → ${M.months[M.months.length - 1]}</b> (${M.months.length} mesi, ${ccy}). Portafoglio: ${wtxt(P.w)}. Rendimento annuo composto ${pc(P.S.cagr, 2)}, volatilità ${pct(P.S.vol)}, massimo calo ${pc(P.S.md)}, recupero più lungo ${num(P.rd.days, 0)} giorni.${pac ? ` Con PAC di ${num(pac, 0)}/mese: versati ${num(sim.invested, 0)}, valore finale <b>${num(sim.val[sim.val.length - 1], 0)}</b>, rendimento annuo money-weighted ${pc(irr, 2)}.` : ` ${num(init, 0)} diventano <b>${num(sim.val[sim.val.length - 1], 0)}</b>.`}${res.length === 1 ? " Attiva uno o più benchmark qui sopra per confrontarli." : ""}</div>
    ${table(head, rows)}<p class="note">Rendimento medio annuo = media aritmetica dei rendimenti mensili, annualizzata ((1 + media)^12 − 1), sullo stesso periodo del CAGR (è sempre ≥ CAGR: la differenza cresce con la volatilità). Giorni di recupero = giorni di calendario tra un massimo e il ritorno sopra quel massimo (da dati di fine mese). Tutti i portafogli calcolati sullo stesso periodo comune, con lo stesso ribilanciamento, senza costi né tasse.</p>
    ${M.months.length < 60 ? `<p class="warn">⚠ Meno di 5 anni di dati: statistiche poco significative.</p>` : ""}`;
    const COL = [C.gold, C.text, C.red, C.blue, C.green, "#b08bd9", "#e07b39", "#5fb3b3", "#999", "#d4a5a5", "#8fbf6f", "#c08bc0", "#7a9cc6", "#bbb"];
    plot(ei1, res.map((r, k) => ({ x: xs, y: r.S.eq.map(v => v * 100), name: r.name, line: { color: COL[k % COL.length], width: r.main ? 2.4 : 1.2 }, type: "scatter" })).concat(pac ? [{ x: xs, y: sim.val, name: "Valore con PAC", yaxis: "y2", line: { color: C.red, width: 1, dash: "dot" }, type: "scatter" }] : []), { title: T("Crescita di 100 (rendimento ponderato nel tempo)" + (pac ? " · tratteggio: valore PAC (asse destro)" : "")), yaxis: { type: "log", gridcolor: C.grid }, yaxis2: { overlaying: "y", side: "right", showgrid: false } });
    const ddS = eq => { let pk = 0; return eq.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; }); };
    plot(ddi1, res.map((r, k) => ({ x: xs, y: ddS(r.S.eq), name: r.name, fill: r.main ? "tozeroy" : undefined, line: { color: COL[k % COL.length], width: r.main ? 1.4 : 1 }, type: "scatter" })), { title: T("Drawdown"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
    plot(yi1, res.map((r, k) => ({ x: Ys, y: Ys.map(y => (r.A[y] - 1) * 100), name: r.name, type: "bar", marker: { color: COL[k % COL.length] } })), { title: T("Rendimenti annuali (anni parziali inclusi)"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    // tabella annuale a colori: portafogli/benchmark + singoli asset del portafoglio
    const assetCols = Object.keys(P.w).map(id => { const A = {}; M.R[need.indexOf(id)].forEach((r, i) => { const y = M.months[i].slice(0, 4); A[y] = (A[y] || 1) * (1 + r); }); return { name: keyOf(id)[0], A }; });
    const cols = [...res.map(r => ({ name: r.name, A: r.A })), ...assetCols];
    const heat = v => { const x = Math.max(-1, Math.min(1, v / 0.3)); return x >= 0 ? `background:rgba(46,160,90,${(0.15 + 0.6 * x).toFixed(2)})` : `background:rgba(200,50,50,${(0.15 + 0.6 * -x).toFixed(2)})`; };
    $("#pfYT").innerHTML = `<h3>Rendimenti per anno solare</h3><div class="scrollx"><table class="heat"><tr><th>Anno</th>${cols.map(c => `<th>${c.name}</th>`).join("")}</tr>${Ys.slice().reverse().map(y => `<tr><td>${y}${M.months.filter(m => m.startsWith(y)).length < 12 ? "*" : ""}</td>${cols.map(c => `<td style="${heat(c.A[y] - 1)}">${pct(c.A[y] - 1)}</td>`).join("")}</tr>`).join("")}</table></div><p class="note">* anno parziale. Verde = positivo, rosso = negativo (intensità proporzionale).</p>`;
    const E = ddEps(P.S.eq).slice(0, 8);
    $("#pfDD").innerHTML = `<h3>Principali drawdown del portafoglio e giorni di recupero</h3>${table(["Picco", "Minimo", "Calo", "Ritorno ai massimi", "Giorni dal picco al recupero"], E.map(e => [e.p, e.t, pc(e.d), e.r || "non ancora", num(e.days, 0) + (e.r ? "" : " (in corso)")]))}`;
    window.__pfLast = { M, res, ccy, reb, pac, init, irr, head, rows, wtxt: wtxt(P.w), cols, Ys, E, charts: [ei1, ddi1, yi1] };
    if (window.__drawFE) window.__drawFE();
  };
  document.querySelectorAll("[data-bm]").forEach(b => b.onclick = () => { const k = b.dataset.bm; window.__bm.has(k) ? window.__bm.delete(k) : window.__bm.add(k); b.classList.toggle("on"); runPf(); });
  $("#pfSave").onclick = () => { if (showSum() !== 100) return; const W = getW(); if (window.__pfSaved.length >= 4) window.__pfSaved.shift(); window.__pfSaved.push({ name: $("#pfName").value || "Portafoglio", w: Object.fromEntries(Object.entries(W).filter(([, v]) => v > 0).map(([k, v]) => [k, v / 100])) }); $("#pfName").value = "Portafoglio " + (window.__pfSaved.length + 1); runPf(); };
  $("#pfClear").onclick = () => { window.__pfSaved = []; runPf(); };
  $("#pfGo").onclick = runPf; ["#pfReb", "#pfCcy", "#pfY0", "#pfY1"].forEach(s => $(s).onchange = runPf); if ($("#pfInfl")) $("#pfInfl").onchange = () => { window.__infl = $("#pfInfl").value; runPf(); }; runPf();
  // --- correlazione tra due asset (con selettore anni)
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return n / Math.sqrt(x * y); };
  const fmtM = k => { const [a, b] = k.split("-").map(Number); return new Date(Date.UTC(a, b - 1, 1)).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }); };
  // finestra anni con avviso se i dati non coprono la richiesta
  const yearWin = (idsW, ccy, y0, y1) => {
    if (y0 && y1 && +y1 < +y0) return { err: `L'anno finale (${y1}) è precedente a quello iniziale (${y0}).` };
    const full = monthlyRets(idsW, ccy, "1900-01-01", "2999-12-31");
    const M = monthlyRets(idsW, ccy, y0 ? `${+y0 - 1}-12-01` : "1900-01-01", y1 ? `${y1}-12-31` : "2999-12-31");
    if (!M.months.length) return { err: `Nessun dato comune nel periodo scelto. Storia comune disponibile: ${full.months.length ? fmtM(full.months[0]) + " → " + fmtM(full.months[full.months.length - 1]) : "nessuna"}.`, M };
    const a = M.months[0], b = M.months[M.months.length - 1], lim = [];
    if (y0 && a > `${y0}-01`) lim.push(`hai chiesto dal ${y0}, ma i dati comuni partono da <b>${fmtM(a)}</b> (${idsW.map(id => `${keyOf(id)[0].replace(/ \(.*\)/, "")} dal ${startY(id) || "–"}`).join(", ")})`);
    if (y1 && b < `${y1}-12` && b.slice(0, 4) <= y1) { if (b.slice(0, 4) < y1) lim.push(`hai chiesto fino al ${y1}, ma l'ultimo dato comune è <b>${fmtM(b)}</b>`); }
    const note = lim.length ? `<p class="warn">⚠️ Periodo adattato ai dati: ${lim.join("; ")}. Periodo usato: <b>${fmtM(a)} → ${fmtM(b)}</b>.</p>` : `<p class="note">Periodo analizzato: <b>${fmtM(a)} → ${fmtM(b)}</b> (${M.months.length} mesi)${!y0 && !y1 ? ", massimo disponibile in comune" : ", come richiesto"}.</p>`;
    return { M, note };
  };
  const drawRC = () => {
    const a = $("#rcA").value, b = $("#rcB").value, w = +$("#rcW").value; if (a === b) { $("#rcTxt").innerHTML = `<p class="warn">Scegli due asset diversi.</p>`; return; }
    const W = yearWin([a, b], "USD", $("#rcY0").value, $("#rcY1").value); if (W.err) { $("#rcTxt").innerHTML = `<p class="warn">${W.err}</p>`; Plotly.purge(rci1); return; }
    const M = W.M, x = [], y = [];
    for (let i = w; i <= M.months.length; i++) { x.push(M.months[i - 1]); y.push(corr(M.R[0].slice(i - w, i), M.R[1].slice(i - w, i))); }
    if (!y.length) { $("#rcTxt").innerHTML = W.note + `<p class="warn">Periodo troppo breve per una finestra di ${w} mesi (servono almeno ${w + 1} mesi, trovati ${M.months.length}): scegli una finestra più corta o allarga gli anni.</p>`; Plotly.purge(rci1); return; }
    $("#rcTxt").innerHTML = W.note + `<div class="answer">Correlazione mobile a ${w} mesi tra <b>${keyOf(a)[0]}</b> e <b>${keyOf(b)[0]}</b>: sull'intero periodo ${num(corr(M.R[0], M.R[1]))}; ultima finestra ${num(y[y.length - 1])}, minima ${num(Math.min(...y))}, massima ${num(Math.max(...y))}. Vicino a +1 = si muovono insieme; vicino a 0 = indipendenti; negativa = tendono a compensarsi (utile per diversificare). La correlazione non è stabile nel tempo.</div>`;
    plot(rci1, [{ x, y, type: "scatter", line: { color: C.gold, width: 1.3 }, fill: "tozeroy", fillcolor: "rgba(201,165,76,.12)", hovertemplate: "%{x}: %{y:.2f}<extra></extra>" }], { title: T(`Correlazione mobile ${w} mesi (rendimenti mensili, USD)`), yaxis: { range: [-1, 1], gridcolor: C.grid, zerolinecolor: "#888" } });
  };
  ["#rcA", "#rcB", "#rcW", "#rcY0", "#rcY1"].forEach(s => $(s).onchange = drawRC); drawRC();
  // --- frontiera efficiente vincolata
  const CLS = {}; GROUPS.forEach(([g, SUB]) => SUB.forEach(([, L]) => L.forEach(id => CLS[id] = g.startsWith("AZIONI") ? "eq" : g.startsWith("OBBL") ? "bd" : "alt")));
  const CLN = { eq: "azioni", bd: "obbligazioni/liquidità", alt: "alternativi" };
  const p2 = x => (x * 100).toFixed(2).replace(".", ",") + "%";
  const short = id => keyOf(id)[0].replace(/ \(.*\)/, "");
  // proiezione su {lo ≤ w ≤ hi, somma = s} (bisezione sullo shift)
  const projBox = (v, lo, hi, s) => { let a = Math.min(...v.map((x, i) => x - hi[i])) - 1, b = Math.max(...v.map((x, i) => x - lo[i])) + 1;
    const f = t => v.reduce((q, x, i) => q + Math.min(hi[i], Math.max(lo[i], x - t)), 0);
    for (let it = 0; it < 100; it++) { const m = (a + b) / 2; f(m) > s ? a = m : b = m; } const t = (a + b) / 2; return v.map((x, i) => Math.min(hi[i], Math.max(lo[i], x - t))); };
  const drawFE = () => {
    window.__feLast = null;
    const sel = [...document.querySelectorAll(".fek:checked")].map(x => x.value);
    const B = window.__feB; sel.forEach(id => { if (!B[id]) B[id] = [0, 100]; });
    const bKey = sel.join(","); if (window.__feBK !== bKey || !$("#feBounds").innerHTML) { window.__feBK = bKey; $("#feBounds").innerHTML = sel.length ? `<div class="scrollx"><table class="febt"><tr><th>Asset</th><th>Classe</th><th>Dati dal</th><th title="Facoltativo: lascia 0 per far decidere l'ottimizzatore">Min % (facoltativo)</th><th title="Facoltativo: lascia 100 per nessun limite">Max % (facoltativo)</th></tr>${sel.map(id => `<tr><td>${short(id)}</td><td>${CLN[CLS[id]]}</td><td>${startY(id) || "–"}</td><td><input type="number" min="0" max="100" step="1" data-feb="${id}" data-k="0" value="${B[id][0]}"></td><td><input type="number" min="0" max="100" step="1" data-feb="${id}" data-k="1" value="${B[id][1]}"></td></tr>`).join("")}</table></div>` : "";
    document.querySelectorAll("[data-feb]").forEach(x => x.onchange = () => { B[x.dataset.feb][+x.dataset.k] = Math.max(0, Math.min(100, +x.value || 0)); x.value = B[x.dataset.feb][+x.dataset.k]; setTimeout(drawFE, 0); }); }
    const cons = window.__feC, E = cons === "free" ? null : +cons, cap = Math.max(0, Math.min(100, +$("#feAlt").value || 0)) / 100; window.__feAlt = cap * 100;
    $("#feConsNote").innerHTML = E == null ? "Modalità <b>Libero</b>: l'ottimizzatore può mettere qualsiasi percentuale in ogni classe (rispettando solo i min/max per asset); il limite agli alternativi non si applica."
      : `Vincolo <b>${E * 100}/${100 - E * 100}</b>: le obbligazioni/liquidità sommano esattamente al ${100 - E * 100}%; azioni + alternativi sommano esattamente al ${E * 100}%. Gli alternativi (oro, commodity) sono al massimo il ${num(cap * 100, 0)}% del totale e vengono presi dalla quota azionaria (es. 60/40 con 10% oro = 50% azioni + 10% oro + 40% obbligazioni).`;
    const fail = m => { $("#feTxt").innerHTML = `<p class="warn">${m}</p>`; $("#feTab").innerHTML = ""; [fi1, sti1].forEach(c => Plotly.purge(c)); };
    if (sel.length < 2) return fail("Seleziona almeno 2 asset.");
    const k = sel.length, loU = sel.map(id => B[id][0] / 100), hiU = sel.map(id => Math.max(B[id][0], B[id][1]) / 100);
    let lo = sel.map(() => 0), hi = sel.map(() => 1); const custom = loU.some(x => x > 0) || hiU.some(x => x < 1);
    const gi = g => sel.map((id, i) => i).filter(i => CLS[sel[i]] === g), I = { eq: gi("eq"), bd: gi("bd"), alt: gi("alt") };
    // gruppi con somma fissa
    const sum = (a, idx) => idx.reduce((q, i) => q + a[i], 0);
    if (E != null) {
      if (!I.bd.length) return fail(`Con il vincolo ${E * 100}/${100 - E * 100} serve almeno un asset obbligazionario o di liquidità.`);
      if (!I.eq.length && !I.alt.length) return fail(`Con il vincolo ${E * 100}/${100 - E * 100} serve almeno un asset azionario.`);
      if (!I.eq.length && sum(lo, I.alt) <= cap && cap < E) return fail(`Solo alternativi nella quota azionaria: con il massimo del ${num(cap * 100, 0)}% non si raggiunge il ${E * 100}%. Aggiungi un'azione o alza il limite.`);
      if (sum(lo, I.bd) > 1 - E + 1e-9 || sum(hi, I.bd) < 1 - E - 1e-9) return fail(`I min/max degli asset obbligazionari non permettono di arrivare esattamente al ${100 - E * 100}%.`);
      const A = [...I.eq, ...I.alt]; if (sum(lo, A) > E + 1e-9 || sum(hi, A) < E - 1e-9) return fail(`I min/max degli asset azionari/alternativi non permettono di arrivare esattamente al ${E * 100}%.`);
      if (sum(lo, I.alt) > cap + 1e-9) return fail(`I minimi degli alternativi superano il limite del ${num(cap * 100, 0)}%.`);
    } else if (sum(lo, sel.map((_, i) => i)) > 1 + 1e-9 || sum(hi, sel.map((_, i) => i)) < 1 - 1e-9) return fail("I minimi sommano a più del 100% (o i massimi a meno del 100%): correggi i limiti.");
    const sub = (v, idx, s) => { const r = projBox(idx.map(i => v[i]), idx.map(i => lo[i]), idx.map(i => hi[i]), s); return r; };
    const proj = v => { const w = v.slice(); const put = (idx, r) => idx.forEach((i, j) => w[i] = r[j]);
      if (E == null) { put(sel.map((_, i) => i), sub(v, sel.map((_, i) => i), 1)); return w; }
      put(I.bd, sub(v, I.bd, 1 - E)); const A = [...I.eq, ...I.alt], rA = sub(v, A, E);
      if (!I.alt.length || A.reduce((q, i, j) => q + (CLS[sel[i]] === "alt" ? rA[j] : 0), 0) <= cap + 1e-12) { put(A, rA); return w; }
      // vincolo alternativi attivo: somma alternativi = cap, azioni = E - cap
      put(I.alt, sub(v, I.alt, Math.min(cap, E))); if (I.eq.length) put(I.eq, sub(v, I.eq, E - Math.min(cap, E))); return w; };
    const Wf = yearWin(sel, "EUR", "", ""); let limNote = "";
    if (!Wf.err && Wf.M && Wf.M.months.length) { const f0 = Wf.M.months[0], f1 = Wf.M.months[Wf.M.months.length - 1]; $("#feY0").options[0].text = `${fmtM(f0)} (primo mese comune)`; $("#feY1").options[0].text = `${fmtM(f1)} (ultimo dato)`;
      const lim = sel.reduce((a, id) => (+startY(id) || 0) > (+startY(a) || 0) ? id : a, sel[0]); limNote = `<p class="note">Dati disponibili: ${sel.map(id => `${short(id)} dal ${startY(id) || "–"}`).join(" · ")}. Il periodo comune parte da <b>${fmtM(f0)}</b> perché <b>${short(lim)}</b> ha dati solo da allora.</p>`; }
    const W = yearWin(sel, "EUR", $("#feY0").value, $("#feY1").value);
    if (W.err) return fail(W.err);
    const M = W.M; if (M.months.length < 36) { fail(`Servono almeno 36 mesi comuni (trovati ${M.months.length}).`); $("#feTxt").innerHTML = W.note + $("#feTxt").innerHTML; return; }
    const mu = M.R.map(a => mean(a) * 12), rfS = cashRets(M.months, "USD"), rf = mean(rfS) * 12;
    const cov = M.R.map(a => M.R.map(b => { const ma = mean(a), mb = mean(b); return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (a.length - 1) * 12; }));
    const ev = w => { const r = w.reduce((s, x, i) => s + x * mu[i], 0); let v = 0; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) v += w[i] * w[j] * cov[i][j]; v = Math.sqrt(Math.max(v, 0)); return { r, v, s: (r - rf) / v, w }; };
    const Lc = 2 * Math.max(...cov.map(r => r.reduce((q, x) => q + Math.abs(x), 0))) + 1e-9; // limite superiore (2 × autovalore massimo)
    // max mu·w − λ w'Σw con gradiente proiettato accelerato (FISTA)
    const solve = (lam, w0) => { let w = proj(w0 || sel.map(() => 1 / k)), y = w.slice(), t = 1; const step = 1 / (lam * Lc + 1e-9) ;
      for (let it = 0; it < 1500; it++) { const g = sel.map((_, i) => { let q = 0; for (let j = 0; j < k; j++) q += cov[i][j] * y[j]; return (lam === Infinity ? 0 : mu[i]) - 2 * (lam === Infinity ? 1 : lam) * q; });
        const st2 = lam === Infinity ? 1 / Lc : Math.min(step, 50); const wn = proj(y.map((x, i) => x + st2 * g[i])); const tn = (1 + Math.sqrt(1 + 4 * t * t)) / 2; y = wn.map((x, i) => x + (t - 1) / tn * (x - w[i])); 
        if (wn.every((x, i) => Math.abs(x - w[i]) < 1e-10)) { w = wn; break; } w = wn; t = tn; } return ev(w); };
    const minV = solve(Infinity);
    const lams = Array.from({ length: 70 }, (_, i) => 10 ** (3 - i * 5 / 69)); // 1000 → 0,01
    let FR = [minV], prev = minV.w; lams.forEach(l => { const p = solve(l, prev); prev = p.w; FR.push(p); });
    // portafoglio di massimo rendimento (λ → 0): proietta un passo grande verso mu
    FR.push(ev(proj(mu.map(x => x * 1e4))));
    FR = FR.sort((a, b) => a.v - b.v).filter((p, i, a) => i === 0 || (p.v - a[i - 1].v > 1e-5 && p.r > a[i - 1].r - 1e-9));
    const vmin = FR[0].v, vmax = FR[FR.length - 1].v;
    let maxS = FR.reduce((a, b) => b.s > a.s ? b : a);
    // frontiera con i limiti min/max dell'utente (facoltativi): mostrata a parte, non sostituisce quella libera
    let FRc = null, cWarn = ""; const sLo = loU.reduce((a, b) => a + b, 0);
    if (custom) { const sm2 = (a, idx) => idx.reduce((q, i) => q + a[i], 0), A2 = [...I.eq, ...I.alt];
      const bad = E != null ? (sm2(loU, I.bd) > 1 - E + 1e-9 || sm2(hiU, I.bd) < 1 - E - 1e-9 || sm2(loU, A2) > E + 1e-9 || sm2(hiU, A2) < E - 1e-9 || sm2(loU, I.alt) > cap + 1e-9) : (sLo > 1 + 1e-9 || hiU.reduce((a, b) => a + b, 0) < 1 - 1e-9);
      if (bad) cWarn = `⚠️ I limiti min/max inseriti non sono compatibili con il vincolo ${E == null ? "Libero" : E * 100 + "/" + (100 - E * 100)}${E != null ? ` (obbligazioni ${p2(sm2(loU, I.bd))} minimo contro ${p2(1 - E)} richiesto)` : ""}: li ignoriamo e mostriamo la frontiera libera.`;
      else { lo = loU; hi = hiU; const m0 = solve(Infinity); FRc = [m0]; let pv = m0.w; lams.filter((_, i) => i % 3 === 0).forEach(l => { const p = solve(l, pv); pv = p.w; FRc.push(p); }); FRc.push(ev(proj(mu.map(x => x * 1e4)))); FRc.sort((a, b) => a.v - b.v); lo = sel.map(() => 0); hi = sel.map(() => 1);
        const span = FRc[FRc.length - 1].v - FRc[0].v;
        cWarn = sLo > 0.999 ? `⚠️ <b>I minimi che hai inserito sommano al 100%: c'è un solo portafoglio possibile</b> (${p2(FRc[0].v)} di volatilità, ${p2(FRc[0].r)} di rendimento), per questo il cursore non si muoveva. Lo trattiamo come «il tuo portafoglio» e lo confrontiamo con la frontiera libera. I campi Min/Max sono limiti facoltativi: lasciali a 0 e 100 per lasciar scegliere l'ottimizzatore.`
          : span < 0.005 ? `⚠️ Con i limiti min/max inseriti i portafogli possibili sono pochissimi (volatilità tra ${p2(FRc[0].v)} e ${p2(FRc[FRc.length - 1].v)}): la linea arancione tratteggiata li mostra; cursore e portafoglio ideale usano la frontiera libera.`
          : `Con i tuoi limiti min/max la frontiera è la linea arancione tratteggiata (volatilità ${p2(FRc[0].v)}–${p2(FRc[FRc.length - 1].v)}); linea bianca, cursore e portafoglio ideale usano solo il vincolo azioni/obbligazioni.`; } }
    // il tuo portafoglio: minimi che sommano a 100% oppure il portafoglio impostato in alto
    const topW = window.__pfW || {}, topTot = Object.values(topW).reduce((a, b) => a + b, 0), topIn = sel.reduce((q, id) => q + (topW[id] || 0), 0);
    let U = null, uSrc = "", uMiss = "";
    if (custom && Math.abs(sLo - 1) < 1e-3) { U = ev(loU.slice()); uSrc = "i pesi inseriti nella colonna Min %"; }
    else if (topTot > 0 && topIn >= topTot - 0.5) { U = ev(sel.map(id => (topW[id] || 0) / topTot)); uSrc = "il portafoglio impostato in alto"; }
    else if (topTot > 0) uMiss = `<p class="note">Il portafoglio impostato in alto contiene asset non selezionati qui: clicca «↺ Usa il portafoglio in alto» per confrontarlo con la frontiera.</p>`;
    const atRet = tr => { if (tr <= FR[0].r) return FR[0]; if (tr > FR[FR.length - 1].r + 1e-9) return null; let a = -2, b = 3, best = FR[FR.length - 1], w0 = FR[FR.length - 1].w;
      for (let it = 0; it < 28; it++) { const m = (a + b) / 2, p = solve(10 ** m, w0); if (p.r >= tr) { a = m; best = p; w0 = p.w; } else b = m; } return best; };
    // portafoglio con il massimo rendimento per volatilità ≤ target (bisezione su λ)
    const atVol = tv => { if (tv <= vmin + 1e-6) return FR[0]; if (tv >= vmax - 1e-6) return FR[FR.length - 1]; let a = -2, b = 3, best = FR[0], w0 = FR[0].w;
      for (let it = 0; it < 28; it++) { const m = (a + b) / 2, p = solve(10 ** m, w0); if (p.v > tv) a = m; else { b = m; best = p; w0 = p.w; } } return best; };
    // nuvola casuale nei vincoli
    let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const P = []; for (let n = 0; n < 4000; n++) { const g = sel.map(() => (-Math.log(rnd() + 1e-12)) ** (n % 3 === 0 ? 3 : 1)); const s = g.reduce((a, b) => a + b, 0); P.push(ev(proj(g.map(x => x / s)))); }
    const comp = p => "<b>Pesi:</b><br>" + sel.map((id, i) => `${short(id)}: <b>${p2(Math.max(0, p.w[i]))}</b>`).join("<br>");
    const hov = p => `<b>Rendimento ${p2(p.r)}</b> · Volatilità ${p2(p.v)} · Sharpe ${p.s.toFixed(2).replace(".", ",")}<br>${comp(p)}`;
    const HL = { bgcolor: "#000000", bordercolor: C.gold, font: { color: "#ffffff", size: 16 }, align: "left" };
    const round2 = w => { const c = w.map(x => Math.floor(x * 10000)), rem = 10000 - c.reduce((a, b) => a + b, 0); w.map((x, i) => [x * 10000 - c[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rem).forEach(([, i]) => c[i]++); return c.map(x => x / 10000); };
    const dd = p => { const sm = simulate(M.R, p.w, "monthly", M.months); return pstats(sm.ret, rfS); };
    const sl = $("#feVol"); sl.min = (Math.ceil(vmin * 1000) / 10).toFixed(1); sl.max = (Math.floor(vmax * 1000) / 10).toFixed(1); sl.step = 0.1;
    $("#feVolR").textContent = `da ${p2(vmin)} (minima) a ${p2(vmax)} (massimo rendimento) · passi di 0,1%`;
    let selP = window.__feSelV != null ? atVol(Math.min(vmax, Math.max(vmin, window.__feSelV))) : U ? atVol(Math.min(vmax, Math.max(vmin, U.v))) : maxS;
    let IV = null, IR = null, Su = null, mism = false, uE = 0;
    const sh2 = x => x.toFixed(2).replace(".", ",");
    const dif = x => Math.abs(x) < 0.00005 ? `<span class="muted">0,00%</span>` : `<span class="${x > 0.0005 ? "pos" : x < -0.0005 ? "neg" : "muted"}">${x > 0 ? "+" : ""}${p2(x)}</span>`;
    const show = p => {
      selP = p; window.__feSelV = p.v; sl.value = (p.v * 100).toFixed(1); $("#feVolL").textContent = p2(p.v); $("#feLive").innerHTML = "";
      const S2 = dd(p), wr = round2(p.w.map(x => Math.max(0, x))), grp = (w, g) => sel.reduce((q, id, i) => q + (CLS[id] === g ? w[i] : 0), 0);
      const wu = U ? round2(U.w.map(x => Math.max(0, x))) : null, same = U && Math.abs(p.v - U.v) < 0.0015;
      const idT = !U ? `Portafoglio ideale (volatilità ${p2(p.v)})` : same ? "Portafoglio ideale <small>(stessa volatilità)</small>" : `Portafoglio ideale <small>(volatilità ${p2(p.v)})</small>`;
      const per = `${fmtM(M.months[0])} → ${fmtM(M.months[M.months.length - 1])}`;
      // frase principale
      let head = "";
      if (U && mism) head = `⚠️ Il tuo portafoglio ha <b>${p2(uE)} tra azioni e alternativi</b>, ma il vincolo scelto è <b>${E * 100}/${100 - E * 100}</b>: il confronto non è alla pari. Scegli il vincolo corrispondente o «Libero».`;
      else if (U) { const d = sel.map((id, i) => [wr[i] - wu[i], id]), dec = d.filter(x => x[0] < -0.005).sort((a, b) => a[0] - b[0]), inc = d.filter(x => x[0] > 0.005).sort((a, b) => b[0] - a[0]);
        const pt = x => num(Math.abs(x) * 100, 1).replace(/,0$/, "") + " punti";
        head = (p.r > U.r + 0.001 ? `${same ? "Con lo <b>stesso rischio</b>" : `Con una volatilità del <b>${p2(p.v)}</b>`} (${p2(p.v)}) il portafoglio ideale avrebbe reso <b>${p2(p.r)}</b> l'anno invece di ${p2(U.r)}: <b class="pos">+${p2(p.r - U.r)}</b>. ` : same ? "Il tuo portafoglio è già (quasi) sulla frontiera: per il periodo scelto è efficiente. " : `Con una volatilità del ${p2(p.v)} il rendimento sarebbe stato ${p2(p.r)} (il tuo: ${p2(U.r)} con ${p2(U.v)} di volatilità). `)
          + (dec.length && inc.length ? `Cosa cambia: <b>${dec.slice(0, 2).map(([x, id]) => `meno ${short(id)} (−${pt(x)})`).join(", ")}</b>, <b>${inc.slice(0, 2).map(([x, id]) => `più ${short(id)} (+${pt(x)})`).join(", ")}</b>.` : "")
          + (IR && IR.v < U.v - 0.001 && same ? ` Oppure: lo stesso rendimento (${p2(U.r)}) con <b>${p2(U.v - IR.v)} di volatilità in meno</b>.` : ""); }
      else head = `Pesi del portafoglio ideale con una volatilità del <b>${p2(p.v)}</b>: rendimento medio <b>${p2(p.r)}</b> l'anno, calo massimo ${p2(-S2.md)}. Per confrontarlo con il tuo, clicca «↺ Usa il portafoglio in alto».`;
      const rows = sel.map((id, i) => [`<b>${short(id)}</b><br><span class="muted">${CLN[CLS[id]]}</span>`, p2(mu[i]), p2(Math.sqrt(cov[i][i])), ...(U ? [p2(wu[i])] : []), `<b>${p2(wr[i])}</b>`, ...(U ? [dif(wr[i] - wu[i])] : [])]);
      const tot = (lab, fu, fi, d) => [`<b>${lab}</b>`, "", "", ...(U ? [fu] : []), `<b>${fi}</b>`, ...(U ? [d] : [])];
      const T2 = [tot("Rendimento medio annuo", U && p2(U.r), p2(p.r), U && dif(p.r - U.r)), tot("Volatilità annua", U && p2(U.v), p2(p.v), U && dif(p.v - U.v)), tot("Calo massimo storico", U && p2(Su.md), p2(S2.md), U && dif(S2.md - Su.md)), tot("Rend. annuo composto (CAGR)", U && p2(Su.cagr), p2(S2.cagr), U && dif(S2.cagr - Su.cagr)), tot("Sharpe", U && sh2(U.s), sh2(p.s), U ? `<span class="${p.s > U.s + 0.005 ? "pos" : p.s < U.s - 0.005 ? "neg" : "muted"}">${p.s - U.s >= 0 ? "+" : ""}${sh2(p.s - U.s)}</span>` : ""), tot("Azioni / obbligazioni / alternativi", U && `${p2(grp(wu, "eq"))} / ${p2(grp(wu, "bd"))} / ${p2(grp(wu, "alt"))}`, `${p2(grp(wr, "eq"))} / ${p2(grp(wr, "bd"))} / ${p2(grp(wr, "alt"))}`, "")];
      const H = ["Asset", "Rendimento annuo dell'asset", "Volatilità dell'asset", ...(U ? ["Il tuo portafoglio"] : []), idT, ...(U ? ["Differenza"] : [])];
      $("#feCmp").innerHTML = `<div class="febox"><h4 class="pick-h">${U ? "Il tuo portafoglio contro il portafoglio ideale" : "Portafoglio ideale"} <span class="muted">· ${per}</span></h4><div class="answer">${head}</div>
        <div class="scrollx"><table class="full fecmp"><tr>${H.map((h, j) => `<th class="${j >= 3 && h === idT ? "feid" : ""}">${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map((c, j) => `<td class="${H[j] === idT ? "feid" : ""}">${c}</td>`).join("")}</tr>`).join("")}<tr class="fesep"><td colspan="${H.length}"></td></tr>${T2.map(r => `<tr class="fetot">${r.map((c, j) => `<td class="${H[j] === idT ? "feid" : ""}">${c == null || c === false ? "" : c}</td>`).join("")}</tr>`).join("")}</table></div>
        <p class="note">${U ? `«Il tuo portafoglio» = ${uSrc}. ` : ""}Muovi il cursore «Volatilità che accetto» o clicca un punto della linea bianca per cambiare il portafoglio ideale${U ? " (riportalo sul quadrato arancione «Il tuo» per lo stesso rischio)" : ""}. Rendimento e volatilità degli asset = valori di ciascun asset da solo nel periodo. Pesi ideali calcolati sul passato: non sono una previsione né una raccomandazione.</p></div>`;
      $("#feTab").innerHTML = "";
      window.__feLast = { sel, w: p.w, wr, r: p.r, v: p.v, s: p.s, md: S2.md, cons, cap, maxS, minV, from: M.months[0], to: M.months[M.months.length - 1], months: M.months.length, grp: { eq: grp(wr, "eq"), bd: grp(wr, "bd"), alt: grp(wr, "alt") }, lo, hi };
      Plotly.restyle(fi1, { x: [[p.v * 100]], y: [[p.r * 100]], hovertext: [[hov(p)]] }, [5]);
      if (document.getElementById(sti1).data) Plotly.relayout(sti1, { shapes: [{ type: "line", x0: p.v * 100, x1: p.v * 100, yref: "paper", y0: 0, y1: 1, line: { color: "#fff", width: 3, dash: "dot" } }], annotations: [{ x: p.v * 100, y: 1.02, yref: "paper", text: `Selezionato: ${p2(p.v)}`, showarrow: false, font: { color: "#fff", size: 13 }, bgcolor: "#000" }] });
    };
    if (U) { IV = atVol(Math.min(vmax, Math.max(vmin, U.v))); IR = atRet(U.r); Su = dd(U); uE = sel.reduce((q, id, i) => q + (CLS[id] !== "bd" ? U.w[i] : 0), 0); mism = E != null && Math.abs(uE - E) > 0.005; }
    else if (uMiss) $("#feCmp").innerHTML = uMiss;
    window.__feCmp = U ? { U: { r: U.r, v: U.v, w: U.w }, IV: { r: IV.r, v: IV.v, w: IV.w }, IR: IR ? { r: IR.r, v: IR.v, w: IR.w } : null, vmin, vmax, sel, from: M.months[0], to: M.months[M.months.length - 1], uSrc } : { vmin, vmax, sel };
    $("#feTxt").innerHTML = limNote + W.note + (cWarn ? `<p class="warn">${cWarn}</p>` : "") + `<p class="note">Vincolo: <b>${E == null ? "Libero" : E * 100 + "/" + (100 - E * 100)}</b>. <b>Minima volatilità</b>: ${p2(minV.v)} di volatilità, ${p2(minV.r)} di rendimento. <b>Massimo Sharpe</b> (${maxS.s.toFixed(2).replace(".", ",")}): ${p2(maxS.v)} di volatilità, ${p2(maxS.r)} di rendimento. Muovi il cursore o clicca un punto della linea bianca per vedere i pesi.</p>`;
    const tr = [{ x: P.map(p => p.v * 100), y: P.map(p => p.r * 100), mode: "markers", type: "scatter", marker: { size: 4, color: P.map(p => p.s), colorscale: [[0, "#2a2a32"], [1, C.gold]], showscale: true, colorbar: { title: { text: "Sharpe" }, len: .6, tickformat: ".2f" } }, name: "Portafogli possibili", hovertext: P.map(hov), hoverinfo: "text", hoverlabel: HL },
      { x: FR.map(p => p.v * 100), y: FR.map(p => p.r * 100), mode: "lines+markers", type: "scatter", line: { color: "#ffffff", width: 3 }, marker: { size: 6, color: "#ffffff" }, name: "Frontiera efficiente", hovertext: FR.map(hov), hoverinfo: "text", hoverlabel: HL },
      { x: sel.map((_, i) => Math.sqrt(cov[i][i]) * 100), y: mu.map(v => v * 100), text: sel.map(short), mode: "markers+text", textposition: "top center", textfont: { color: C.text }, type: "scatter", marker: { color: C.blue, size: 11 }, name: "Singoli asset (da soli)", hovertext: sel.map((id, i) => `<b>${short(id)} da solo</b><br>Rendimento ${p2(mu[i])} · Volatilità ${p2(Math.sqrt(cov[i][i]))}`), hoverinfo: "text", hoverlabel: HL },
      { x: [maxS.v * 100], y: [maxS.r * 100], mode: "markers", type: "scatter", marker: { color: C.red, size: 18, symbol: "star" }, name: "Massimo Sharpe", hovertext: [hov(maxS)], hoverinfo: "text", hoverlabel: HL },
      { x: [minV.v * 100], y: [minV.r * 100], mode: "markers", type: "scatter", marker: { color: C.green, size: 15, symbol: "diamond" }, name: "Minima volatilità", hovertext: [hov(minV)], hoverinfo: "text", hoverlabel: HL },
      { x: [selP.v * 100], y: [selP.r * 100], mode: "markers", type: "scatter", marker: { color: "rgba(0,0,0,0)", size: 22, symbol: "circle-open", line: { width: 4, color: "#ffffff" } }, name: "Portafoglio selezionato (cursore)", hovertext: [hov(selP)], hoverinfo: "text", hoverlabel: HL }];
    if (U) { tr.push({ x: [U.v * 100], y: [U.r * 100], mode: "markers+text", text: ["Il tuo"], textposition: "bottom center", textfont: { color: "#e07b39" }, type: "scatter", marker: { color: "#e07b39", size: 16, symbol: "square", line: { color: "#000", width: 1 } }, name: "Il tuo portafoglio", hovertext: ["<b>Il tuo portafoglio</b><br>" + hov(U)], hoverinfo: "text", hoverlabel: HL },
      { x: [IV.v * 100], y: [IV.r * 100], mode: "markers", type: "scatter", marker: { color: C.gold, size: 16, symbol: "circle", line: { color: "#000", width: 1 } }, name: "Ideale, stessa volatilità", hovertext: ["<b>Ideale con la stessa volatilità</b><br>" + hov(IV)], hoverinfo: "text", hoverlabel: HL });
      if (IR) tr.push({ x: [IR.v * 100], y: [IR.r * 100], mode: "markers", type: "scatter", marker: { color: C.green, size: 16, symbol: "triangle-up", line: { color: "#000", width: 1 } }, name: "Ideale, stesso rendimento", hovertext: ["<b>Ideale con lo stesso rendimento</b><br>" + hov(IR)], hoverinfo: "text", hoverlabel: HL }); }
    if (FRc) tr.push({ x: FRc.map(p => p.v * 100), y: FRc.map(p => p.r * 100), mode: "lines+markers", type: "scatter", line: { color: "#e07b39", width: 2, dash: "dash" }, marker: { size: 5, color: "#e07b39" }, name: "Frontiera con i tuoi min/max", hovertext: FRc.map(hov), hoverinfo: "text", hoverlabel: HL });
    plot(fi1, tr, { xaxis: { title: { text: "Rischio: volatilità annua" }, ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: { text: "Rendimento medio annuo" }, ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest", hoverdistance: 12, legend: { orientation: "h", y: -0.18 }, margin: { t: 20, b: 90 } });
    const PAL = [C.gold, C.blue, C.green, C.red, "#b08bd9", "#e07b39", "#5fb3b3", "#d4a5a5", "#8fbf6f", "#7a9cc6", "#bbb", "#c08bc0"];
    plot(sti1, sel.map((id, i) => ({ x: FR.map(p => p.v * 100), y: FR.map(p => p.w[i] * 100), type: "scatter", mode: "lines", stackgroup: "w", name: short(id), line: { width: .5, color: PAL[i % PAL.length] }, hovertemplate: `${short(id)}: %{y:.2f}%<extra></extra>`, hoverlabel: HL })),
      { title: T("Come cambia la composizione salendo con il rischio (pesi lungo la frontiera)"), xaxis: { title: { text: "Volatilità annua del portafoglio" }, ticksuffix: "%" }, yaxis: { title: { text: "Peso nel portafoglio" }, ticksuffix: "%", range: [0, 100] }, hovermode: "x unified", hoverlabel: HL });
    fi1El().removeAllListeners && fi1El().removeAllListeners("plotly_click");
    fi1El().on("plotly_click", ev2 => { const pt = ev2.points[0]; if (!pt) return; const c = pt.curveNumber; show(c === 1 ? FR[pt.pointIndex] : c === 3 ? maxS : c === 4 ? minV : c === 0 ? P[pt.pointIndex] : atVol(Math.min(vmax, Math.max(vmin, pt.x / 100)))); });
    let tmo; sl.oninput = () => { $("#feVolL").textContent = p2(+sl.value / 100); clearTimeout(tmo); tmo = setTimeout(() => show(atVol(+sl.value / 100)), 120); };
    window.__feAtVol = tv => show(atVol(tv));
    show(selP);
  };
  const fi1El = () => document.getElementById(fi1);
  window.__drawFE = null; window.__feBK = null; window.__feRun = drawFE;
  const feFromPf = () => { const w = window.__pfW || getW(), L = Object.keys(w).filter(id => w[id] > 0); if (L.length < 2) return false;
    document.querySelectorAll(".fek").forEach(x => x.checked = L.includes(x.value)); const tot = L.reduce((q, id) => q + w[id], 0), eS = L.reduce((q, id) => q + (CLS[id] !== "bd" ? w[id] : 0), 0) / tot;
    const m = [["0.4", .4], ["0.5", .5], ["0.6", .6]].find(([, x]) => Math.abs(eS - x) < 0.005); window.__feC = m ? m[0] : "free"; document.querySelectorAll("[data-fec]").forEach(x => x.classList.toggle("on", x.dataset.fec === window.__feC));
    L.forEach(id => { window.__feB[id] = [0, 100]; }); window.__feBK = null; window.__feSelV = null; return true; };
  if (!window.__feInit) { window.__feInit = 1; window.__pfW = window.__pfW || getW(); feFromPf(); }
  $("#feAdv").addEventListener("toggle", () => { window.__feAdvOpen = $("#feAdv").open; }); $("#feStk").addEventListener("toggle", () => { if ($("#feStk").open) window.dispatchEvent(new Event("resize")); });
  $("#feFromPf").onclick = () => { window.__pfW = getW(); if (feFromPf()) drawFE(); };
  ["#pfGo"].forEach(s => $(s).addEventListener("click", () => setTimeout(() => { window.__feSelV = null; drawFE(); }, 50))); $("#pfPreset").addEventListener("change", () => setTimeout(() => { window.__feSelV = null; drawFE(); }, 50));
  document.querySelectorAll(".fek").forEach(x => x.onchange = () => { window.__feSelV = null; drawFE(); }); ["#feY0", "#feY1", "#feAlt"].forEach(s => $(s).onchange = drawFE);
  document.querySelectorAll("[data-fec]").forEach(b => b.onclick = () => { window.__feC = b.dataset.fec; document.querySelectorAll("[data-fec]").forEach(x => x.classList.toggle("on", x === b)); drawFE(); });
  drawFE();
}
const _st3 = showTab; showTab = id => { _st3(id); if (id === "multi") renderMulti(); };
const _rf3 = refresh; refresh = function () { _rf3(); if (document.querySelector(".tab.on").id === "multi") renderMulti(); };
