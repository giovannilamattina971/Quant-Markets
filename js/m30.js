"use strict";
/* ===== The Bull: pagine educative interattive ispirate al canale YouTube «The Bull» (Riccardo). Ogni cifra è ricalcolata sui dati della piattaforma. ===== */
const TBYT = id => `https://www.youtube.com/watch?v=${id}`;
const TBsrc = (items) => `<p class="note tbsrc">📺 Idea tratta da The Bull: ${items.map(([t, id]) => `<a href="${TBYT(id)}" target="_blank" rel="noopener">«${t}»</a>`).join(" · ")}. I numeri in questa pagina <b>non</b> sono quelli del video: sono ricalcolati qui sui dati della piattaforma.</p>`;
const tbM = k => { const [y, m] = k.split("-"); return MESI[+m - 1] + " " + y; };
const tbD = (s, daily) => (daily == null ? s.length > 7 && !s.endsWith("-28") && !s.endsWith("-15") : daily) ? fmtD(s) : tbM(s.slice(0, 7));
const tbYrs = (a, b, sel, first) => (first ? `<option value="">${first}</option>` : "") + Array.from({ length: b - a + 1 }, (_, i) => b - i).map(y => `<option ${y === sel ? "selected" : ""}>${y}</option>`).join("");
const tbQ = (a, q) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y), p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
const tbPP = x => (x >= 0 ? "+" : "") + pct(x);
const tbYTD = y => +y === +CUR_M.slice(0, 4) ? y + " YTD" : String(y);
const tbChips = (name, opts, cur) => `<span class="chips tbchips">${opts.map(([v, l]) => `<button class="chip${String(v) === String(cur) ? " on" : ""}" data-${name}="${v}">${l}</button>`).join("")}</span>`;
const tbWireChips = (root, name, fn) => root.querySelectorAll(`[data-${name}]`).forEach(b => b.onclick = () => { root.querySelectorAll(`[data-${name}]`).forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset[name]); });
const tbAvgM = F => { const m = new Map(); F.d.forEach((d, i) => { const k = d.slice(0, 7); if (k >= CUR_M) return; const a = m.get(k) || [0, 0]; a[0] += F.c[i]; a[1]++; m.set(k, a); }); return new Map([...m].map(([k, a]) => [k, a[0] / a[1]])); };
const tbEndM = F => { const m = new Map(); F.d.forEach((d, i) => { const k = d.slice(0, 7); if (k < CUR_M) m.set(k, F.c[i]); }); return m; };
// serie lunga mensile S&P 500: Shiller + estensione con Yahoo (^GSPC, ^SP500TR), multpl (P/E) e FRED (CPI)
function tbLong() {
  if (window.__tbL) return window.__tbL; const S = window.SHILLER; if (!S) return null;
  const SPLICE = "2024-08"; // settembre 2024 in Shiller è una singola chiusura (4/9): da lì si usano le medie mensili Yahoo
  const m = [], P = [], TR = [], E = [], CPI = []; let lastD = null;
  for (let i = 0; i < S.d.length && S.d[i] <= SPLICE; i++) { const k = S.d[i]; if (S.D[i] != null) lastD = S.D[i];
    m.push(k); P.push(S.P[i]); E.push(S.E[i]); CPI.push(S.CPI[i]);
    TR.push(i === 0 ? 1 : TR[TR.length - 1] * (S.P[i] + (S.D[i - 1] != null ? S.D[i - 1] : lastD) / 12) / S.P[i - 1]); }
  const gA = tbAvgM(FULL["^GSPC"]), tA = tbAvgM(FULL["^SP500TR"]), cpiF = new Map((MACRO.cpi.d || []).map((d, i) => [d.slice(0, 7), MACRO.cpi.v[i]]));
  const peM = new Map((SIGNALS.PE.d || []).map((d, i) => [d, SIGNALS.PE.v[i]])), cpiK = "2024-06", cpi0 = S.CPI[S.d.indexOf(cpiK)];
  for (let i = 0; i < m.length; i++) if (m[i] > cpiK && cpiF.has(m[i]) && cpiF.has(cpiK)) CPI[i] = cpi0 * cpiF.get(m[i]) / cpiF.get(cpiK);
  [...gA.keys()].sort().filter(k => k > SPLICE && tA.has(k)).forEach(k => { const pk = m[m.length - 1];
    m.push(k); P.push(gA.get(k)); TR.push(TR[TR.length - 1] * tA.get(k) / tA.get(pk)); E.push(null);
    CPI.push(cpiF.has(k) ? cpi0 * cpiF.get(k) / cpiF.get(cpiK) : null); });
  for (let i = 0; i < m.length; i++) if (E[i] == null && m[i] > S.lastE && peM.has(m[i])) E[i] = P[i] / peM.get(m[i]);
  const RTR = TR.map((x, i) => CPI[i] != null ? x / CPI[i] : null);
  window.__tbL = { m, P, TR, E, CPI, RTR, lastE: m.filter((k, i) => E[i] != null).pop() };
  return window.__tbL;
}
function tbSeries(key) {
  const L = tbLong();
  const sh = (real) => { const d = [], c = []; L.m.forEach((k, i) => { const v = real ? L.RTR[i] : L.TR[i]; if (v != null) { d.push(k + "-15"); c.push(v); } }); return { d, c, daily: false }; };
  return {
    spx: () => ({ d: FULL["^GSPC"].d, c: FULL["^GSPC"].c, daily: true }),
    sptr: () => ({ d: FULL["^SP500TR"].d, c: FULL["^SP500TR"].c, daily: true }),
    sptrE: () => cmSeries("US", "EUR"),
    mswE: () => cmSeries("WORLDI", "EUR"),
    shN: () => sh(false), shR: () => sh(true) }[key]();
}
const TB_SN = { spx: "S&P 500 prezzo (USD, giornaliero, dal 1928)", sptr: "S&P 500 Total Return (USD, giornaliero, dal 1988)", sptrE: "S&P 500 Total Return in EUR (giornaliero, dal 1999)", mswE: "MSCI World Net TR in EUR (mensile, dal 2001)", shN: "S&P 500 Total Return USD (Shiller, mensile, dal 1871)", shR: "S&P 500 Total Return reale USD (Shiller, mensile, dal 1871)" };
const tbSel = (id, keys, cur) => `<select id="${id}">${keys.map(k => `<option value="${k}" ${k === cur ? "selected" : ""}>${TB_SN[k]}</option>`).join("")}</select>`;
const tbCut = (S, y0, y1) => { const a = y0 ? lb(S.d, y0 + "-01-01") : 0, b = y1 ? lb(S.d, y1 + "-12-31~") : S.d.length; return { d: S.d.slice(a, b), c: S.c.slice(a, b), daily: S.daily }; };
function tbEpisodes(d, c) { const out = []; let pk = 0, tr = 0, inDD = false;
  for (let i = 1; i < c.length; i++) { if (c[i] >= c[pk]) { if (inDD) { out.push({ p: pk, t: tr, r: i }); inDD = false; } pk = i; tr = i; } else { if (!inDD) { inDD = true; tr = i; } if (c[i] < c[tr]) tr = i; } }
  if (inDD) out.push({ p: pk, t: tr, r: null });
  const dd = (a, b) => Math.round((Date.parse(d[b]) - Date.parse(d[a])) / 864e5);
  return out.map(e => ({ ...e, dd: c[e.t] / c[e.p] - 1, down: dd(e.p, e.t), up: e.r != null ? dd(e.t, e.r) : null, tot: e.r != null ? dd(e.p, e.r) : dd(e.p, d.length - 1) })); }
const tbDays = g => g == null ? "non ancora" : g >= 730 ? `${num(g / 365.25, 1)} anni` : g >= 60 ? `${num(g / 30.44, 0)} mesi` : `${g} giorni`;
const TBL = {};

/* ---------- 1. Drawdown ---------- */
TBL.dd = function () {
  const o = $("#tbDDOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [u1h, u1] = div("chart"), [j1h, j1] = div("chart tall");
    o.innerHTML = `<div class="card"><h2>Drawdown: il «biglietto» da pagare per il rendimento delle azioni</h2>
    <p class="lead">Il drawdown è quanto sei sotto il massimo precedente. Le discese sono rapide, le risalite lente, ma finora gli indici azionari ampi hanno sempre recuperato. Anche negli anni chiusi in positivo un calo del 10% durante l'anno è normale.</p>
    <div class="form"><label>Serie ${tbSel("tbDDs", ["spx", "sptr", "sptrE", "mswE", "shR"], "spx")}</label><label>Dall'anno <select id="tbDDy0">${tbYrs(1871, 2025, 1980, "Primo disponibile")}</select></label><label>All'anno <select id="tbDDy1">${tbYrs(1872, +CUR_M.slice(0, 4), null, "Oggi")}</select></label>
     <label>Soglia di «correzione» <input id="tbDDth" type="range" min="5" max="30" step="1" value="10"> <b id="tbDDthL">10%</b></label></div>
    <div id="tbDDtxt"></div>${u1h}<div id="tbDDtab"></div>${j1h}<div id="tbDDy"></div>
    <p class="note">Grafico «sott'acqua»: distanza percentuale dal massimo precedente. Calo intra-anno = peggior distanza dal massimo dell'anno (partendo dalla chiusura dell'anno precedente), come nel grafico <i>JP Morgan Guide to the Markets</i>; le serie mensili (MSCI World, Shiller) usano dati di fine mese o medie mensili e quindi sottostimano i minimi. ${tbYTD(CUR_M.slice(0, 4))} = anno in corso fino all'ultimo dato. Fonti: Yahoo Finance (^GSPC, ^SP500TR), MSCI (msci.com), FRED per il cambio EUR/USD, R. Shiller (Yale).</p>
    ${TBsrc([["Come perdi soldi con gli ETF", "B6xXYjwxKrk"], ["Perché (forse) ci sarà un crollo nel 2026?", "dYC1OjlugIU"]])}</div>`;
    o._u = u1; o._j = j1; ["#tbDDs", "#tbDDy0", "#tbDDy1"].forEach(s => $(s).onchange = TBL.dd); $("#tbDDth").oninput = () => { $("#tbDDthL").textContent = $("#tbDDth").value + "%"; clearTimeout(o._t); o._t = setTimeout(TBL.dd, 120); }; }
  const key = $("#tbDDs").value, th = +$("#tbDDth").value / 100, S0 = tbSeries(key), S = tbCut(S0, $("#tbDDy0").value, $("#tbDDy1").value);
  if (S.d.length < 30) { $("#tbDDtxt").innerHTML = `<p class="warn">Dati insufficienti nel periodo scelto (la serie parte da ${tbD(S0.d[0], S.daily)}).</p>`; return; }
  let pk = 0; const uw = S.c.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; });
  const E = tbEpisodes(S.d, S.c), big = E.filter(e => e.dd <= -th).sort((a, b) => a.dd - b.dd);
  plot(o._u, [{ x: S.d, y: uw, type: "scatter", fill: "tozeroy", line: { color: C.red, width: 1 }, fillcolor: "rgba(192,40,63,.35)", name: "Drawdown", hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" }],
    { title: T("Sott'acqua: distanza dal massimo precedente"), yaxis: { ticksuffix: "%" }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: -th * 100, y1: -th * 100, line: { color: C.gold, dash: "dot", width: 1 } }], showlegend: false });
  $("#tbDDtab").innerHTML = `<h3>I cali più profondi del periodo</h3>` + table(["Massimo", "Minimo", "Calo", "Durata discesa", "Durata risalita", "Totale sott'acqua"], big.slice(0, 10).map(e => [tbD(S.d[e.p], S.daily), tbD(S.d[e.t], S.daily), pc(e.dd), tbDays(e.down), e.up == null ? "<b>in corso</b>" : tbDays(e.up), tbDays(e.tot) + (e.r == null ? " (in corso)" : "")])).replace("<table", '<table class="full"');
  const Y = cmYears(S), cy = CUR_M.slice(0, 4);
  plot(o._j, [{ x: Y.map(y => tbYTD(y.y)), y: Y.map(y => y.r * 100), type: "bar", name: "Rendimento dell'anno", marker: { color: Y.map(y => y.r >= 0 ? "rgba(91,139,217,.85)" : "rgba(142,142,153,.85)") }, hovertemplate: "%{y:.1f}%" },
    { x: Y.map(y => tbYTD(y.y)), y: Y.map(y => y.md * 100), type: "scatter", mode: "markers", name: "Calo massimo durante l'anno", marker: { color: C.red, size: 7 }, hovertemplate: "%{y:.1f}%" }],
    { title: T("Ogni anno: rendimento di fine anno (barre) e calo massimo durante l'anno (punti rossi)"), yaxis: { ticksuffix: "%" }, xaxis: { type: "category", tickangle: -60, nticks: 30 }, hovermode: "x unified" });
  const F = Y.filter(y => String(y.y) !== cy), pos = F.filter(y => y.r > 0), posC = pos.filter(y => y.md <= -th), allC = F.filter(y => y.md <= -th);
  const done = E.filter(e => e.r != null && e.dd <= -th), avgU = mean(done.map(e => e.up)), avgD = mean(done.map(e => e.down)), cur = uw[uw.length - 1], w = big[0];
  $("#tbDDtxt").innerHTML = `<div class="answer">Su <b>${F.length}</b> anni solari completi (${F.length ? F[0].y + "–" + F[F.length - 1].y : ""}), ${TB_SN[key].split(" (")[0]}: in <b>${allC.length}</b> anni (${pct(allC.length / F.length, 0)}) c'è stato un calo di almeno il ${num(th * 100, 0)}% durante l'anno. Dei <b>${pos.length}</b> anni chiusi in positivo, <b>${posC.length}</b> (${pct(posC.length / Math.max(1, pos.length), 0)}) hanno comunque avuto un calo intra-anno di almeno il ${num(th * 100, 0)}%. Calo intra-anno mediano: <b>${pct(median(F.map(y => y.md)))}</b>; rendimento annuo mediano <b>${pct(median(F.map(y => y.r)))}</b>.<br>
    Cali oltre il ${num(th * 100, 0)}% nel periodo: <b>${big.length}</b>. In media la discesa è durata ${tbDays(Math.round(avgD))} e la risalita ${tbDays(Math.round(avgU))}: si scende in fretta, si risale piano. Il peggiore: <b>${pct(w ? w.dd : NaN)}</b> (${w ? tbD(S.d[w.p], S.daily) + " → " + tbD(S.d[w.t], S.daily) : ""}), ${w && w.r != null ? "tornato al massimo dopo " + tbDays(w.tot) : "non ancora recuperato"}. Ultimo dato (${tbD(S.d[S.d.length - 1], S.daily)}): <b>${pct(cur / 100)}</b> dal massimo.</div>`;
  $("#tbDDy").innerHTML = `<p class="note">L'anno «medio» è raro: anni tra 0% e +20% = ${F.filter(y => y.r >= 0 && y.r < 0.2).length} su ${F.length}; anni sopra +20% = ${F.filter(y => y.r >= 0.2).length}; anni negativi = ${F.filter(y => y.r < 0).length} (${pct(F.filter(y => y.r < 0).length / F.length, 0)}).</p>`;
};

/* ---------- 2. Prezzi giù, rendimenti attesi su ---------- */
TBL.fwd = function () {
  const o = $("#tbFwdOut"), L = tbLong(); if (!o.dataset.ok) { o.dataset.ok = 1; const [b1h, b1] = div("chart tall"), [s1h, s1] = div("chart tall");
    let pk = 0; o._dd = L.P.map(v => { pk = Math.max(pk, v); return v / pk - 1; });
    const G = FULL["^GSPC"], gdd = G.c[G.c.length - 1] / Math.max(...G.c) - 1; o._g = { dd: gdd, d: G.d[G.d.length - 1] };
    const cape = SIGNALS.CAPE, cl = cape.v[cape.v.length - 1]; o._cape = { v: cl, d: cape.d[cape.d.length - 1] };
    o.innerHTML = `<div class="card"><h2>Quando i prezzi scendono, il rendimento atteso sale</h2>
    <p class="lead">Se i prezzi scendono ma utili e dividendi futuri restano simili, compri la stessa «fetta di economia» spendendo meno. Qui vedi cosa è successo dopo, nella storia dell'S&P 500 dal 1871, partendo da ogni livello di calo dai massimi o di valutazione.</p>
    <div class="form"><label>Calo dai massimi da cui parti <input id="tbFdd" type="range" min="0" max="60" step="1" value="${Math.round(-gdd * 100)}" style="width:240px"> <b id="tbFddL"></b></label>
     <label>Orizzonte ${tbChips("tbfh", [[1, "1 anno"], [3, "3 anni"], [5, "5 anni"], [10, "10 anni"]], 5)}</label>
     <label>Misura <select id="tbFm"><option value="r">Reale (al netto dell'inflazione USA)</option><option value="n">Nominale USD</option></select></label>
     <label>Dall'anno <select id="tbFy0">${tbYrs(1871, 2010, 1871)}</select></label></div>
    <p class="note">Oggi (${fmtD(o._g.d)}) l'S&P 500 è a <b>${pct(gdd)}</b> dal massimo storico di chiusura: il cursore parte da qui. Muovilo per vedere altri scenari (es. 20% = bear market).</p>
    <div id="tbFtxt"></div>${b1h}<div id="tbFtab"></div>
    <h3>Valutazione: CAPE (P/E a 10 anni di Shiller) e rendimento dei 10 anni successivi</h3>
    <div class="form"><label>CAPE di partenza <input id="tbFc" type="range" min="5" max="45" step="0.5" value="${Math.round(cl * 2) / 2}" style="width:240px"> <b id="tbFcL"></b></label></div>
    <div id="tbFctxt"></div>${s1h}
    <p class="note">Rendimenti annualizzati del total return S&P 500 (dividendi reinvestiti) dalla serie mensile di R. Shiller (prezzi medi mensili, ie_data.xls) fino ad agosto 2024, estesa con le medie mensili Yahoo di ^GSPC e ^SP500TR; inflazione CPI USA (Shiller, poi FRED). Calo dai massimi calcolato sul prezzo medio mensile (i minimi giornalieri sono più profondi). Finestre sovrapposte: mesi vicini non sono osservazioni indipendenti, quindi il campione è meno ricco di quanto sembri. CAPE: Shiller fino a ${tbM(SIGNALS.meta.cape_shiller_last)}, poi multpl.com (ultimo ${tbM(o._cape.d)}: ${num(cl, 1)}). Non è una previsione.</p>
    ${TBsrc([["Quanto renderanno i tuoi investimenti nei prossimi 10 anni?", "PQpzYZPa0Qk"], ["Do you have savings to invest? Don't wait for prices to drop.", "frLVB_LdOJY"]])}</div>`;
    o._b = b1; o._s = s1; o._h = 5; tbWireChips(o, "tbfh", h => { o._h = +h; TBL.fwd(); });
    ["#tbFm", "#tbFy0"].forEach(s => $(s).onchange = TBL.fwd); ["#tbFdd", "#tbFc"].forEach(s => $(s).oninput = () => { clearTimeout(o._t); o._t = setTimeout(TBL.fwd, 80); }); }
  const real = $("#tbFm").value === "r", X = real ? L.RTR : L.TR, h = o._h, H = 12 * h, y0 = $("#tbFy0").value, i0 = Math.max(0, L.m.findIndex(k => k >= y0 + "-01")), dd = o._dd;
  const fw = (i, HH) => (X[i] != null && X[i + HH] != null) ? (X[i + HH] / X[i]) ** (12 / HH) - 1 : null;
  const BK = [[0, 0.02, "Ai massimi (< 2%)"], [0.02, 0.1, "2-10%"], [0.1, 0.2, "10-20%"], [0.2, 0.3, "20-30%"], [0.3, 0.4, "30-40%"], [0.4, 1.01, "oltre 40%"]];
  const bOf = x => BK.findIndex(([a, b]) => -x >= a && -x < b), want = +$("#tbFdd").value / 100, wb = BK.findIndex(([a, b]) => want >= a && want < b);
  $("#tbFddL").textContent = "-" + num(want * 100, 0) + "%";
  const G = {}; [1, 3, 5, 10].forEach(hh => { G[hh] = BK.map(() => []); for (let i = i0; i < L.m.length - 12 * hh; i++) { const r = fw(i, 12 * hh); if (r != null) G[hh][bOf(dd[i])].push(r); } });
  const all = G[h].flat(), sel = G[h][wb], near = [];
  for (let i = i0; i < L.m.length - H; i++) if (Math.abs(-dd[i] - want) <= 0.03) { const r = fw(i, H); if (r != null) near.push(r); }
  plot(o._b, BK.map(([, , l], j) => ({ y: G[h][j].map(x => x * 100), type: "box", name: l, boxpoints: false, marker: { color: j === wb ? C.gold : "#6b6b78" }, line: { width: j === wb ? 2.5 : 1 }, hoverinfo: "y" })),
    { title: T(`Rendimento ${real ? "reale" : "nominale"} annuo nei ${h === 1 ? "12 mesi" : h + " anni"} successivi, per calo dai massimi alla partenza`), yaxis: { ticksuffix: "%", zeroline: true, zerolinecolor: "#888" }, xaxis: { title: { text: "Calo dai massimi nel mese di partenza" } }, showlegend: false, hovermode: "closest",
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: median(all) * 100, y1: median(all) * 100, line: { color: C.blue, dash: "dot" } }], annotations: [{ xref: "paper", x: 1, y: median(all) * 100, text: "mediana di tutti i mesi", showarrow: false, xanchor: "right", yanchor: "bottom", font: { color: C.blue, size: 11 } }] });
  const cell = a => a.length ? `${tbPP(median(a))} <span class="muted">· ${pct(fracPos(a), 0)} pos. · n=${a.length}</span>` : "–";
  $("#tbFtab").innerHTML = table(["Calo dai massimi alla partenza", "1 anno", "3 anni (annuo)", "5 anni (annuo)", "10 anni (annuo)"], BK.map(([, , l], j) => [j === wb ? `<b>▶ ${l}</b>` : l, ...[1, 3, 5, 10].map(hh => cell(G[hh][j]))]).concat([["<i>Tutti i mesi</i>", ...[1, 3, 5, 10].map(hh => cell(G[hh].flat()))]])).replace("<table", '<table class="full"') + `<p class="note">Mediana del rendimento annualizzato · quota di periodi positivi · n = numero di mesi di partenza (${real ? "reale" : "nominale"}, dal ${L.m[i0].slice(0, 4)}).</p>`;
  const dlt = median(sel) - median(all);
  $("#tbFtxt").innerHTML = `<div class="answer">Partendo con l'indice a circa <b>-${num(want * 100, 0)}%</b> dai massimi (fascia ${BK[wb][2]}), nei ${h === 1 ? "12 mesi" : h + " anni"} successivi il rendimento ${real ? "reale" : "nominale"} è stato in mediana <b>${tbPP(median(sel))}</b> l'anno (il 10% dei casi peggiori sotto ${tbPP(tbQ(sel, .1))}, il 10% migliore sopra ${tbPP(tbQ(sel, .9))}), positivo nel <b>${pct(fracPos(sel), 0)}</b> dei casi. Partendo da un mese qualsiasi: mediana ${tbPP(median(all))}, positivo nel ${pct(fracPos(all), 0)}. ${sel.length < 40 ? "⚠ Pochi casi in questa fascia: leggere con cautela. " : ""}${dlt > 0.005 ? `Comprare dopo un calo ha reso in mediana <b>${num(dlt * 100, 1)} punti l'anno in più</b>.` : dlt < -0.005 ? "In questa fascia e con questo orizzonte il vantaggio non c'è stato: i cali profondi possono continuare (1929-32)." : "La differenza rispetto a un mese qualsiasi è minima."} Con un margine di ±3 punti attorno a -${num(want * 100, 0)}%: mediana ${near.length ? tbPP(median(near)) : "–"} (n=${near.length}). «Più alto in media» non vuol dire «subito»: il calo può proseguire.</div>`;
  const cm = new Map(SIGNALS.CAPE.d.map((d, i) => [d, SIGNALS.CAPE.v[i]])), cw = +$("#tbFc").value, pts = [];
  $("#tbFcL").textContent = num(cw, 1);
  for (let i = i0; i < L.m.length - 120; i++) { const c = cm.get(L.m[i]), r = (L.RTR[i] != null && L.RTR[i + 120] != null) ? (L.RTR[i + 120] / L.RTR[i]) ** 0.1 - 1 : null; if (c && r != null) pts.push([c, r, L.m[i]]); }
  const nb = pts.filter(p => Math.abs(p[0] - cw) <= 2).map(p => p[1]);
  plot(o._s, [{ x: pts.map(p => p[0]), y: pts.map(p => p[1] * 100), text: pts.map(p => tbM(p[2])), mode: "markers", type: "scatter", marker: { size: 4, color: pts.map(p => +p[2].slice(0, 4)), colorscale: [[0, "#3a3a46"], [1, C.gold]], colorbar: { title: { text: "Anno" }, len: .6 } }, hovertemplate: "%{text}<br>CAPE %{x:.1f} → %{y:.1f}% l'anno<extra></extra>", name: "Mesi" }],
    { title: T("CAPE alla partenza e rendimento reale annuo dei 10 anni successivi"), xaxis: { title: { text: "CAPE (P/E medio a 10 anni, reale)" } }, yaxis: { ticksuffix: "%", zerolinecolor: "#888" }, hovermode: "closest", showlegend: false,
      shapes: [{ type: "rect", x0: cw - 2, x1: cw + 2, yref: "paper", y0: 0, y1: 1, fillcolor: "rgba(201,165,76,.15)", line: { width: 0 } }, { type: "line", x0: o._cape.v, x1: o._cape.v, yref: "paper", y0: 0, y1: 1, line: { color: C.red, dash: "dot" } }],
      annotations: [{ x: o._cape.v, yref: "paper", y: 1, text: `oggi ${num(o._cape.v, 1)}`, showarrow: false, font: { color: C.red }, yanchor: "bottom" }] });
  const lo = pts.filter(p => p[0] < 15).map(p => p[1]), hi = pts.filter(p => p[0] > 25).map(p => p[1]);
  $("#tbFctxt").innerHTML = `<div class="answer">Con un CAPE di partenza tra ${num(cw - 2, 1)} e ${num(cw + 2, 1)} (${nb.length} mesi dal ${L.m[i0].slice(0, 4)}), il rendimento <b>reale</b> dei 10 anni successivi è stato in mediana <b>${nb.length ? tbPP(median(nb)) : "–"}</b> l'anno (10°–90° percentile: ${nb.length ? tbPP(tbQ(nb, .1)) + " / " + tbPP(tbQ(nb, .9)) : "–"}). In generale: CAPE sotto 15 → mediana ${tbPP(median(lo))}; CAPE sopra 25 → mediana ${tbPP(median(hi))}. Oggi il CAPE è ${num(o._cape.v, 1)} (${tbM(o._cape.d)}), ${o._cape.v > 30 ? "storicamente molto alto: rendimenti a 10 anni più bassi della media sono stati la norma, con grande dispersione e senza indicazioni sul «quando»" : "nella norma storica"}. ${!nb.length ? "⚠ Nessun caso storico con questo CAPE." : nb.length < 60 ? "⚠ Pochi casi storici con questo CAPE." : ""}</div>`;
};

/* ---------- 3. Prezzi e utili ---------- */
const TB_CR = [["1929-32 Grande Depressione", "1929-01", "1932-12"], ["1937-38", "1937-01", "1938-06"], ["1973-74 shock petrolifero", "1972-10", "1974-12"], ["1987 Black Monday", "1987-06", "1987-12"], ["2000-03 bolla dot-com", "2000-01", "2003-03"], ["2007-09 crisi finanziaria", "2007-06", "2009-06"], ["2020 Covid", "2020-01", "2020-06"], ["2022 inflazione e tassi", "2021-12", "2022-12"]];
TBL.eps = function () {
  const o = $("#tbEpsOut"), L = tbLong(), lastY = +L.lastE.slice(0, 4); if (!o.dataset.ok) { o.dataset.ok = 1; const [p1h, p1] = div("chart tall"), [q1h, q1] = div("chart"), [d1h, d1] = div("chart"), [k1h, k1] = div("chart");
    o.innerHTML = `<div class="card"><h2>Prezzi e utili: nel lungo periodo contano gli utili</h2>
    <p class="lead">Il prezzo è utili × multiplo (P/E). Nel breve domina il multiplo, cioè l'umore del mercato; nel lungo il prezzo segue gli utili. Qui scomponi il rendimento in crescita degli utili, variazione del multiplo e dividendi, e vedi quanto di ogni crollo è dipeso dagli utili e quanto dal multiplo.</p>
    <div class="form"><label>Dall'anno <select id="tbEy0">${tbYrs(1871, lastY - 1, 1950)}</select></label><label>All'anno <select id="tbEy1">${tbYrs(1872, lastY, lastY)}</select></label>
     ${tbChips("tbep", [["1871", "Dal 1871"], ["1950", "Dal 1950"], ["1980", "Dal 1980"], ["2000", "Dal 2000"], ["2010", "Dal 2010"]], "1950")}</div>
    <div id="tbEtxt"></div>${d1h}${p1h}${q1h}
    <h3>Nei crolli: quanto è colpa degli utili e quanto del multiplo?</h3><div id="tbEcr"></div>${k1h}<div id="tbEcrt"></div>
    <p class="note">Dati: S&P Composite di R. Shiller (ie_data.xls): prezzo medio mensile, utili per azione (EPS «as reported», 12 mesi) e dividendi fino a giugno 2024; poi prezzo medio mensile Yahoo ^GSPC ed EPS ricavato come prezzo / P/E trailing di multpl.com (fino a ${tbM(L.lastE)}). Scomposizione moltiplicativa: (1 + rendimento del prezzo) = (1 + crescita utili) × (1 + variazione P/E); dividendi = total return − rendimento del prezzo. Nei crolli: massimo e minimo sul prezzo medio mensile; quota del multiplo = log(P/E finale / iniziale) / log(prezzo finale / iniziale). Gli utili a 12 mesi reagiscono in ritardo: per questo mostriamo anche il loro minimo nei 24 mesi successivi.</p>
    ${TBsrc([["4 Years of Gains: What to Do Now?", "cqOHDNfxwDM"], ["Quanto renderanno i tuoi investimenti nei prossimi 10 anni?", "PQpzYZPa0Qk"]])}</div>`;
    o._p = p1; o._q = q1; o._d = d1; o._k = k1; ["#tbEy0", "#tbEy1"].forEach(s => $(s).onchange = TBL.eps); tbWireChips(o, "tbep", y => { $("#tbEy0").value = y; $("#tbEy1").value = lastY; TBL.eps(); }); }
  const y0 = $("#tbEy0").value, y1 = $("#tbEy1").value;
  if (+y1 <= +y0) { $("#tbEtxt").innerHTML = `<p class="warn">L'anno finale deve essere successivo a quello iniziale.</p>`; return; }
  const ia = L.m.indexOf(y0 + "-01"); let ib = ia; L.m.forEach((k, i) => { if (k <= y1 + "-12" && L.E[i] != null) ib = i; });
  const xs = [], P = [], E = [], PE = []; for (let i = ia; i <= ib; i++) if (L.E[i] != null) { xs.push(L.m[i]); P.push(L.P[i]); E.push(L.E[i]); PE.push(L.P[i] / L.E[i]); }
  plot(o._p, [{ x: xs, y: P, name: "Prezzo S&P 500 (media mensile)", type: "scatter", line: { color: C.gold, width: 1.6 } }, { x: xs, y: E, name: "Utili per azione (12 mesi, $)", yaxis: "y2", type: "scatter", line: { color: C.blue, width: 1.6 } }],
    { title: T("Prezzo e utili per azione, scala logaritmica (assi separati)"), yaxis: { type: "log", title: { text: "Prezzo" } }, yaxis2: { type: "log", overlaying: "y", side: "right", showgrid: false, title: { text: "Utili per azione $" } } });
  const mPE = median(PE.filter(x => x > 0 && x < 200));
  plot(o._q, [{ x: xs, y: PE.map(x => x > 0 && x < 130 ? x : null), name: "P/E", type: "scatter", line: { color: C.text, width: 1.2 }, hovertemplate: "%{x}: %{y:.1f}<extra></extra>" }], { title: T("Il multiplo: P/E sugli utili degli ultimi 12 mesi (asse limitato a 60)"), yaxis: { range: [0, 60] }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: mPE, y1: mPE, line: { color: C.gold, dash: "dot" } }], annotations: [{ xref: "paper", x: 0, y: mPE, text: `mediana del periodo ${num(mPE, 1)}`, showarrow: false, xanchor: "left", yanchor: "bottom", font: { color: C.gold } }], showlegend: false });
  const n = (ib - ia) / 12, g = (a, b) => (b / a) ** (1 / n) - 1;
  const gP = g(L.P[ia], L.P[ib]), gE = g(L.E[ia], L.E[ib]), gPE = g(L.P[ia] / L.E[ia], L.P[ib] / L.E[ib]), gTR = g(L.TR[ia], L.TR[ib]), dv = gTR - gP;
  const rr = L.RTR[ia] != null && L.RTR[ib] != null ? g(L.RTR[ia], L.RTR[ib]) : null, inf = L.CPI[ia] && L.CPI[ib] ? g(L.CPI[ia], L.CPI[ib]) : null;
  plot(o._d, [{ x: ["Crescita degli utili", "Variazione del multiplo (P/E)", "Dividendi reinvestiti", "Rendimento totale"], y: [gE, gPE, dv, gTR].map(x => x * 100), type: "bar", marker: { color: [C.blue, "#b08bd9", C.green, C.gold] }, text: [gE, gPE, dv, gTR].map(x => tbPP(x)), textposition: "outside", hovertemplate: "%{x}: %{y:.2f}% l'anno<extra></extra>" }],
    { title: T(`Da dove è venuto il rendimento annuo, ${tbM(L.m[ia])} → ${tbM(L.m[ib])}`), yaxis: { ticksuffix: "%" }, showlegend: false });
  const share = Math.log(1 + gE) / Math.log(1 + gP);
  $("#tbEtxt").innerHTML = `<div class="answer">Da ${tbM(L.m[ia])} a ${tbM(L.m[ib])} (${num(n, 1)} anni) l'S&P 500 ha reso <b>${tbPP(gTR)}</b> l'anno con i dividendi${rr != null ? ` (${tbPP(rr)} reale; inflazione USA ${pct(inf)} l'anno)` : ""}. Il prezzo è salito del ${tbPP(gP)} l'anno: <b>${tbPP(gE)}</b> dalla crescita degli utili e <b>${tbPP(gPE)}</b> dal cambiamento del multiplo (P/E da ${num(L.P[ia] / L.E[ia], 1)} a ${num(L.P[ib] / L.E[ib], 1)}); i dividendi hanno aggiunto circa <b>${tbPP(dv)}</b>. ${gP > 0 && share > 0.6 ? `Circa il <b>${pct(Math.min(1, share), 0)}</b> della crescita del prezzo è spiegato dagli utili: nel lungo periodo il prezzo segue gli utili.` : gP > 0 ? `In questo periodo una parte importante del rialzo (${pct(1 - share, 0)}) è venuta dal multiplo: i rialzi «di multiplo» non possono durare per sempre.` : "Il prezzo è sceso: guarda quanto hanno pesato il multiplo e gli utili."}</div>`;
  const rows = [], bars = []; const shs = [];
  TB_CR.forEach(([nm, a, b]) => { const A = L.m.indexOf(a), B = L.m.indexOf(b); if (A < 0 || B < 0) return; let t = A; for (let i = A; i <= B; i++) if (L.P[i] < L.P[t]) t = i; let p = A; for (let i = A; i <= t; i++) if (L.P[i] > L.P[p]) p = i;
    if (L.E[p] == null || L.E[t] == null) return; const dP = L.P[t] / L.P[p] - 1, dE = L.E[t] / L.E[p] - 1, pe0 = L.P[p] / L.E[p], pe1 = L.P[t] / L.E[t];
    let eMin = L.E[t]; for (let i = t; i <= Math.min(L.m.length - 1, t + 24); i++) if (L.E[i] != null) eMin = Math.min(eMin, L.E[i]);
    const lp = Math.log(1 + dP), lm = Math.log(pe1 / pe0), le = Math.log(1 + dE), sh = Math.max(0, Math.min(1.5, lm / lp)); if (lp < 0) shs.push(Math.min(1, sh));
    rows.push([nm, `${tbM(L.m[p])} → ${tbM(L.m[t])}`, pc(dP), pc(dE), `${num(pe0, 1)} → ${num(pe1, 1)}`, lp < 0 ? `<b>${pct(sh, 0)}</b>` : "–", pc(eMin / L.E[p] - 1)]); bars.push([nm, le * 100, lm * 100]); });
  $("#tbEcr").innerHTML = `<p class="note">* oltre 100% = durante il calo gli utili sono addirittura cresciuti; 0% = il calo è tutto negli utili (il P/E è salito perché gli utili sono crollati più del prezzo, come nel 2008-09).</p>` + table(["Crisi", "Massimo → minimo (prezzo medio mensile)", "Prezzo", "Utili 12m (stesse date)", "P/E", "Quota del calo dovuta al multiplo*", "Utili: minimo nei 24 mesi dopo"], rows).replace("<table", '<table class="full"');
  plot(o._k, [{ x: bars.map(b => b[0]), y: bars.map(b => b[1]), name: "Utili", type: "bar", marker: { color: C.blue } }, { x: bars.map(b => b[0]), y: bars.map(b => b[2]), name: "Multiplo (P/E)", type: "bar", marker: { color: "#b08bd9" } }],
    { title: T("Scomposizione del calo dal massimo al minimo (punti logaritmici ×100: la somma è il calo del prezzo)"), barmode: "relative", hovermode: "x unified" });
  $("#tbEcrt").innerHTML = `<div class="answer">Negli ${shs.length} crolli in tabella, in mediana il <b>${pct(median(shs), 0)}</b> della discesa dal massimo al minimo è venuto dal <b>multiplo</b> (paura, tassi, aspettative), non dagli utili già pubblicati. Gli utili spesso calano <i>dopo</i> (vedi ultima colonna, es. 2008-09): il mercato anticipa.</div>`;
};

/* ---------- 4. Gap comportamentale ---------- */
const tbIRR = fl => { const npv = r => fl.reduce((s, [t, v]) => s + v / (1 + r) ** t, 0); let lo = -0.05, hi = 0.05; if (npv(lo) * npv(hi) > 0) return NaN; for (let k = 0; k < 120; k++) { const m = (lo + hi) / 2; npv(m) > 0 ? lo = m : hi = m; } return (1 + (lo + hi) / 2) ** 12 - 1; };
TBL.gap = function () {
  const o = $("#tbGapOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [g1h, g1] = div("chart tall");
    o.innerHTML = `<div class="card"><h2>Il gap comportamentale: PAC disciplinato contro investitore emotivo</h2>
    <p class="lead">Lo strumento guadagna, ma chi ci investe spesso guadagna meno: compra dopo i rialzi e vende dopo i ribassi. Qui due investitori fanno lo stesso PAC sullo stesso indice; uno lo lascia correre, l'altro vende nel panico e rientra solo quando «si sente tranquillo».</p>
    <div class="form"><label>Indice ${tbSel("tbGs", ["mswE", "sptrE", "shN"], "mswE")}</label><label>Rata mensile <input id="tbGr" type="number" value="300" min="10" step="10"></label>
     <label>Dall'anno <select id="tbGy0">${tbYrs(1871, 2023, 2001)}</select></label><label>All'anno <select id="tbGy1">${tbYrs(1874, +CUR_M.slice(0, 4), +CUR_M.slice(0, 4))}</select></label></div>
    <div class="form"><label>L'emotivo vende tutto dopo un calo di <input id="tbGx" type="range" min="10" max="40" step="1" value="20"> <b id="tbGxL">20%</b></label>
     <label>e rientra <select id="tbGre"><option value="ath">quando l'indice torna ai massimi</option><option value="sell">quando torna al prezzo a cui ha venduto</option><option value="12">dopo 12 mesi</option></select></label>
     <label><input type="checkbox" id="tbGch" checked> dopo 12 mesi sopra +20% raddoppia la rata (insegue i rialzi)</label></div>
    <div id="tbGtxt"></div>${g1h}
    <h3>Quanto costa un gap di rendimento in un PAC lungo</h3>
    <div class="form"><label>Rata iniziale (€/mese) <input id="tbGa" type="number" value="250"></label><label>Aumento annuo della rata (%) <input id="tbGg" type="number" value="3" step="0.5"></label><label>Anni <input id="tbGn" type="number" value="30"></label>
     <label>Rendimento dello strumento (%) <input id="tbGr1" type="number" value="6" step="0.1"></label><label>Rendimento dell'investitore (%) <input id="tbGr2" type="number" value="4.8" step="0.1"></label></div><div id="tbGcalc"></div>
    <p class="note">Simulazione mensile su livelli di fine mese (serie Shiller: medie mensili), senza costi né tasse; il contante dell'investitore emotivo resta a 0%. Rendimento effettivo = tasso interno di rendimento (money-weighted) dei versamenti: è quello che ottiene davvero l'investitore; il rendimento dell'indice è time-weighted. Le regole dell'investitore emotivo sono uno scenario illustrativo, non un dato. Lo studio citato nel video è Morningstar <i>Mind the Gap</i>: le sue cifre (es. gap medio di circa 1,6 punti sugli ETF secondo il video) non sono ricalcolate qui. L'esempio 250 €/mese +3% l'anno per 30 anni al 6% contro 4,8% è del video ed è ricalcolato qui sopra con capitalizzazione mensile.</p>
    ${TBsrc([["I tre errori che ti costano metà di quanto investi", "HN3sr9mGCkE"], ["Come perdi soldi con gli ETF", "B6xXYjwxKrk"]])}</div>`;
    o._g = g1; ["#tbGs", "#tbGr", "#tbGy0", "#tbGy1", "#tbGre", "#tbGch"].forEach(s => $(s).onchange = TBL.gap); $("#tbGx").oninput = () => { $("#tbGxL").textContent = $("#tbGx").value + "%"; clearTimeout(o._t); o._t = setTimeout(TBL.gap, 100); };
    ["#tbGa", "#tbGg", "#tbGn", "#tbGr1", "#tbGr2"].forEach(s => $(s).oninput = TBL.gapCalc); }
  TBL.gapCalc();
  const key = $("#tbGs").value, CU = key === "shN" ? "$" : "€", S0 = tbSeries(key), me = new Map(); S0.d.forEach((d, i) => { if (d.slice(0, 7) < CUR_M) me.set(d.slice(0, 7), S0.c[i]); });
  const ks = [...me.keys()].sort().filter(k => k >= $("#tbGy0").value + "-01" && k <= $("#tbGy1").value + "-12"), px = ks.map(k => me.get(k));
  if (ks.length < 36) { $("#tbGtxt").innerHTML = `<p class="warn">Servono almeno 3 anni di dati nel periodo (la serie parte da ${tbM([...me.keys()].sort()[0])}).</p>`; Plotly.purge(o._g); return; }
  const pac = Math.max(1, +$("#tbGr").value || 300), X = +$("#tbGx").value / 100, re = $("#tbGre").value, chase = $("#tbGch").checked;
  let u1 = 0, u2 = 0, cash = 0, inM = true, sellP = 0, sellI = 0, pk = px[0], c1 = 0, c2 = 0, sells = 0; const v1 = [], v2 = [], cv = [], f1 = [], f2 = [], mk = [];
  for (let i = 0; i < ks.length; i++) { const p = px[i]; pk = Math.max(pk, p);
    u1 += pac / p; c1 += pac; f1.push([i, -pac]);
    const amt = pac + (chase && inM && i >= 12 && p / px[i - 12] - 1 > 0.2 ? pac : 0); c2 += amt; f2.push([i, -amt]);
    if (inM) { u2 += amt / p; if (p / pk - 1 <= -X) { cash = u2 * p; u2 = 0; inM = false; sellP = p; sellI = i; sells++; mk.push([ks[i], cash, "vende"]); } }
    else { cash += amt; const back = re === "ath" ? p >= pk : re === "sell" ? p >= sellP : i - sellI >= 12; if (back) { u2 = cash / p; cash = 0; inM = true; mk.push([ks[i], u2 * p, "rientra"]); } }
    v1.push(u1 * p); v2.push(u2 * p + cash); cv.push(c1); }
  const N = ks.length - 1; f1.push([N, v1[N]]); f2.push([N, v2[N]]);
  const irr1 = tbIRR(f1), irr2 = tbIRR(f2), twr = (px[N] / px[0]) ** (12 / N) - 1;
  plot(o._g, [{ x: ks, y: v1, name: "PAC disciplinato", type: "scatter", line: { color: C.gold, width: 2 } }, { x: ks, y: v2, name: "Investitore emotivo", type: "scatter", line: { color: C.red, width: 2 } }, { x: ks, y: cv, name: "Versato dal disciplinato", type: "scatter", line: { color: C.grey, dash: "dot", width: 1 } },
    { x: mk.map(m => m[0]), y: mk.map(m => m[1]), text: mk.map(m => m[2]), mode: "markers", type: "scatter", name: "Vendite ▼ / rientri ▲", marker: { symbol: mk.map(m => m[2] === "vende" ? "triangle-down" : "triangle-up"), color: mk.map(m => m[2] === "vende" ? C.red : C.green), size: 11 }, hovertemplate: "%{text}<extra></extra>" }],
    { title: T(`Valore del portafoglio dei due investitori (${CU})`), yaxis: { tickformat: ",.0f" } });
  const gap = irr1 - irr2;
  $("#tbGtxt").innerHTML = `<div class="answer">${tbM(ks[0])} → ${tbM(ks[N])}, ${TB_SN[key].split(" (")[0]}: l'indice ha reso <b>${tbPP(twr)}</b> l'anno. Il <b>PAC disciplinato</b> ha versato ${num(c1, 0)} ${CU} e vale <b>${num(v1[N], 0)} ${CU}</b> (rendimento effettivo ${tbPP(irr1)} l'anno). L'<b>investitore emotivo</b> ha venduto ${sells} ${sells === 1 ? "volta" : "volte"}, ha versato ${num(c2, 0)} ${CU} e vale <b>${num(v2[N], 0)} ${CU}</b> (${tbPP(irr2)} l'anno)${!inM ? ", ed è ancora fuori dal mercato" : ""}. ${isFinite(gap) ? (gap > 0.0005 ? `Gap comportamentale: <b>${num(gap * 100, 2)} punti l'anno</b>, con lo stesso indice.` : gap < -0.0005 ? `In questo periodo l'emotivo ha fatto meglio di ${num(-gap * 100, 2)} punti l'anno: può capitare, ma non è ripetibile con regole fisse (prova altri periodi o soglie).` : "In questo periodo i due risultati sono quasi uguali.") : ""}</div>`;
};
TBL.gapCalc = function () {
  const a = +$("#tbGa").value || 0, g = (+$("#tbGg").value || 0) / 100, n = Math.max(1, Math.min(60, +$("#tbGn").value || 30)), r1 = (+$("#tbGr1").value || 0) / 100, r2 = (+$("#tbGr2").value || 0) / 100;
  const fv = r => { const m = (1 + r) ** (1 / 12) - 1; let v = 0, c = 0; for (let y = 0; y < n; y++) for (let k = 0; k < 12; k++) { const x = a * (1 + g) ** y; v = (v + x) * (1 + m); c += x; } return [v, c]; };
  const [A, cA] = fv(r1), [B] = fv(r2);
  $("#tbGcalc").innerHTML = `<div class="answer">Versi in tutto <b>${num(cA, 0)} €</b>. Al ${num(r1 * 100, 1)}% arrivi a <b>${num(A, 0)} €</b>, al ${num(r2 * 100, 1)}% a <b>${num(B, 0)} €</b>: una differenza di <b>${num(A - B, 0)} €</b>, pari al ${pct((A - B) / cA, 0)} di quanto hai versato. ${num(Math.abs(r1 - r2) * 100, 1)} punti l'anno sembrano pochi, ma in ${n} anni pesano molto.</div>`;
};

/* ---------- 5. Nuovi massimi ed età del rialzo ---------- */
TBL.ath = function () {
  const o = $("#tbAthOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [a1h, a1] = div("chart"), [h1h, h1] = div("chart"), [b1h, b1] = div("chart");
    o.innerHTML = `<div class="card"><h2>I massimi storici sono frequenti e i rialzi non muoiono di vecchiaia</h2>
    <p class="lead">Un nuovo massimo sembra una vetta da cui si può solo scendere. Ma gli indici azionari fanno nuovi massimi spesso, e storicamente comprare in un giorno di massimo non è andato peggio che comprare in un giorno qualsiasi. Anche l'«età» di un rialzo non dice quando finirà.</p>
    <div class="form"><label>Serie ${tbSel("tbAs", ["spx", "sptr", "sptrE"], "spx")}</label><label>Dall'anno <select id="tbAy0">${tbYrs(1928, 2020, 1950)}</select></label>
     <label>Soglia bear market <select id="tbAth"><option value="0.2" selected>-20%</option><option value="0.15">-15%</option><option value="0.25">-25%</option></select></label></div>
    <div id="tbAtxt"></div>${a1h}<div id="tbAtab"></div>
    <h3>Età del rialzo</h3><div id="tbAbtxt"></div>${h1h}${b1h}<div id="tbAbull"></div>
    <p class="note">Massimo storico = chiusura sopra tutte le chiusure precedenti dall'inizio della serie. Rendimenti successivi su giorni di borsa (252 = 1 anno); ^GSPC è solo prezzo, senza dividendi. Rialzo (bull market): dal minimo di un calo almeno pari alla soglia fino al massimo prima del calo successivo almeno pari alla soglia; un nuovo rialzo è confermato quando l'indice sale della stessa percentuale dal minimo. Fonte: Yahoo Finance.</p>
    ${TBsrc([["Do you have savings to invest? Don't wait for prices to drop.", "frLVB_LdOJY"], ["4 Years of Gains: What to Do Now?", "cqOHDNfxwDM"]])}</div>`;
    o._a = a1; o._h = h1; o._b = b1; ["#tbAs", "#tbAy0", "#tbAth"].forEach(s => $(s).onchange = TBL.ath); }
  const key = $("#tbAs").value, S = tbSeries(key), d = S.d, c = S.c, i0 = lb(d, $("#tbAy0").value + "-01-01"), cy = CUR_M.slice(0, 4);
  let mx = -Infinity; const ath = c.map(v => { const h = v > mx; if (h) mx = v; return h; });
  const cnt = {}; for (let i = Math.max(1, i0); i < d.length; i++) { const y = d[i].slice(0, 4); cnt[y] = cnt[y] || 0; if (ath[i]) cnt[y]++; }
  const ys = Object.keys(cnt).sort();
  plot(o._a, [{ x: ys.map(tbYTD), y: ys.map(y => cnt[y]), type: "bar", marker: { color: C.gold }, hovertemplate: "%{x}: %{y} nuovi massimi<extra></extra>" }], { title: T("Nuovi massimi storici di chiusura per anno"), xaxis: { type: "category", tickangle: -60, nticks: 40 }, showlegend: false });
  const H = [252, 756, 1260], fr = (i, h) => (c[i + h] / c[i]) ** (252 / h) - 1;
  const grp = f => H.map(h => { const a = []; for (let i = Math.max(1, i0); i < c.length - h; i++) if (f(i)) a.push(fr(i, h)); return a; });
  const A = grp(i => ath[i]), Z = grp(() => true), cellA = a => a.length ? `${tbPP(median(a))} <span class="muted">· ${pct(fracPos(a), 0)} pos.</span>` : "–";
  $("#tbAtab").innerHTML = table(["Giorno di acquisto", "Casi (1 anno)", "1 anno dopo", "3 anni dopo (annuo)", "5 anni dopo (annuo)"], [["<b>In un giorno di massimo storico</b>", A[0].length, ...A.map(cellA)], ["In un giorno qualsiasi", Z[0].length, ...Z.map(cellA)]]).replace("<table", '<table class="full"') + `<p class="note">Mediana del rendimento · quota di casi positivi.</p>`;
  const tot = ys.reduce((q, y) => q + cnt[y], 0), nd = d.length - i0, k1 = (a, b) => ys.filter(y => y >= a && y <= b).reduce((q, y) => q + cnt[y], 0);
  $("#tbAtxt").innerHTML = `<div class="answer">Dal ${d[i0].slice(0, 4)} ${TB_SN[key].split(" (")[0]} ha chiuso <b>${tot}</b> volte su un nuovo massimo storico (${pct(tot / nd, 1)} dei giorni di borsa). Un anno dopo un massimo era più in alto nel <b>${pct(fracPos(A[0]), 0)}</b> dei casi (mediana ${tbPP(median(A[0]))}), contro il ${pct(fracPos(Z[0]), 0)} (mediana ${tbPP(median(Z[0]))}) partendo da un giorno qualsiasi. I massimi arrivano a grappoli, negli anni di rialzo: di per sé non sono stati un segnale di pericolo.${key === "spx" ? ` <span class="muted">Verifica delle cifre citate nel video: massimi 2013–2022 = ${k1("2013", "2022")}; 2024–2025 = ${k1("2024", "2025")}; ${tbYTD(cy)} = ${cnt[cy] || 0}.</span>` : ""}</div>`;
  const th = +$("#tbAth").value; let st = "bull", ext = 0, lastT = 0; const bulls = [];
  for (let i = 1; i < c.length; i++) { if (st === "bull") { if (c[i] > c[ext]) ext = i; else if (c[i] <= c[ext] * (1 - th)) { bulls.push({ s: lastT, e: ext }); st = "bear"; ext = i; } }
    else { if (c[i] < c[ext]) ext = i; else if (c[i] >= c[ext] * (1 + th)) { lastT = ext; st = "bull"; ext = i; } } }
  if (st === "bull") bulls.push({ s: lastT, e: c.length - 1, open: true });
  const B = bulls.filter(b => b.s > 0 && b.s >= i0).map(b => ({ ...b, yrs: (Date.parse(d[b.e]) - Date.parse(d[b.s])) / YR, ret: c[b.e] / c[b.s] - 1 }));
  if (!B.length) { $("#tbAbtxt").innerHTML = `<p class="warn">Nessun rialzo completo nel periodo.</p>`; return; }
  const maxA = Math.floor(Math.max(...B.map(b => b.yrs))), hz = [], yr = [];
  for (let a = 0; a <= Math.min(12, maxA); a++) { const reach = B.filter(b => b.yrs >= a), ended = reach.filter(b => !b.open && b.yrs < a + 1), surv = reach.filter(b => b.yrs >= a + 1); const n = ended.length + surv.length; if (n >= 3) hz.push([a, ended.length / n, n]);
    const rs = B.filter(b => b.yrs >= a + 1).map(b => { const t0 = Date.parse(d[b.s]), j0 = lb(d, new Date(t0 + a * YR).toISOString().slice(0, 10)), j1 = lb(d, new Date(t0 + (a + 1) * YR).toISOString().slice(0, 10)); return c[Math.min(j1, c.length - 1)] / c[j0] - 1; }); if (rs.length >= 3) yr.push([a + 1, median(rs), rs.length]); }
  plot(o._h, [{ x: hz.map(h => `${h[0]}→${h[0] + 1} anni`), y: hz.map(h => h[1] * 100), text: hz.map(h => `n=${h[2]}`), textposition: "outside", type: "bar", marker: { color: C.red }, hovertemplate: "%{x}: %{y:.0f}% dei rialzi finiti (%{text})<extra></extra>" }],
    { title: T("Quota di rialzi finiti entro l'anno successivo, in base alla loro età"), yaxis: { ticksuffix: "%", range: [0, 105] }, showlegend: false });
  plot(o._b, [{ x: yr.map(y => `anno ${y[0]}`), y: yr.map(y => y[1] * 100), text: yr.map(y => `n=${y[2]}`), textposition: "outside", type: "bar", marker: { color: C.blue }, hovertemplate: "%{x}: mediana %{y:.1f}% (%{text})<extra></extra>" }],
    { title: T("Rendimento mediano di ciascun anno di vita del rialzo (rialzi arrivati a quell'età)"), yaxis: { ticksuffix: "%" }, showlegend: false });
  const done = B.filter(b => !b.open), cur = B.find(b => b.open);
  $("#tbAbtxt").innerHTML = `<div class="answer">Dal ${d[i0].slice(0, 4)}: <b>${B.length}</b> rialzi con soglia ${num(th * 100, 0)}%. Durata mediana dei rialzi conclusi ${num(median(done.map(b => b.yrs)), 1)} anni, rendimento mediano ${tbPP(median(done.map(b => b.ret)))}. La probabilità di finire entro un anno <b>non cresce in modo regolare con l'età</b> (grafico rosso): i rialzi finiscono per recessioni, shock o eccessi, non perché «sono vecchi». ${cur ? `Il rialzo attuale è iniziato il ${fmtD(d[cur.s])} e ha ${num(cur.yrs, 1)} anni (${tbPP(cur.ret)} finora).` : ""} ⚠ I casi sono pochi (vedi n; mostrate solo le età con almeno 3 rialzi): sono indicazioni, non leggi.</div>`;
  $("#tbAbull").innerHTML = `<details class="more"><summary>Elenco dei rialzi</summary>${table(["Inizio (minimo)", "Fine (massimo)", "Durata", "Rendimento"], B.slice().reverse().map(b => [fmtD(d[b.s]), b.open ? "in corso" : fmtD(d[b.e]), num(b.yrs, 1) + " anni", pc(b.ret)]))}</details>`;
};

/* ---------- 6. Rischio, diversificazione, ribilanciamento ---------- */
function tbChain(a, b) { const ka = [...a.keys()].sort(), last = ka[ka.length - 1], o = new Map(a); if (!b.has(last)) return o; const sc = a.get(last) / b.get(last); [...b.keys()].filter(k => k > last).forEach(k => o.set(k, b.get(k) * sc)); return o; }
function tbUniverse(u) {
  if (u === "usd") { const L = tbLong(), sh = new Map(); L.m.forEach((k, i) => { if (k <= "1988-01") sh.set(k, L.TR[i]); });
    return { names: ["Azioni USA (S&P 500 TR)", "Treasury USA 10 anni", "Oro"], ccy: "USD", L: [tbChain(sh, tbEndM(FULL["^SP500TR"])), monthlyLv("UST10C", "USD", "USD"), tbChain(monthlyLv("GOLDWB", "USD", "USD"), monthlyLv("GLD", "USD", "USD"))],
      note: "S&P 500: Shiller (medie mensili, dividendi reinvestiti) fino a gennaio 1988, poi ^SP500TR di fine mese; Treasury 10 anni: total return calcolato dai rendimenti FRED DGS10; oro: Banca Mondiale (media mensile) fino a dicembre 2025, poi ETF GLD. USD, nessuna conversione." }; }
  return { names: ["Azioni MSCI World (EUR)", "Governativi euro 3-5 anni", "Oro (in EUR)"], ccy: "EUR", L: [monthlyLv("MSCIWD", "USD", "EUR"), monthlyLv("IBGX.AS", "EUR", "EUR"), monthlyLv("GLD", "USD", "EUR")],
    note: "MSCI World Net TR in EUR (msci.com); iShares € Govt Bond 3-5yr (IBGX, cedole reinvestite, dal 2006); oro: ETF GLD convertito in EUR senza copertura del cambio (FRED)." };
}
const TB_PF = [["100/0", [1, 0, 0]], ["80/20", [0.8, 0.2, 0]], ["60/40", [0.6, 0.4, 0]], ["60/40 con oro (50/40/10)", [0.5, 0.4, 0.1]]];
function tbSim(R, w, reb, ks) { let h = w.slice(), n = 0; const ret = [], we = [];
  for (let t = 0; t < R[0].length; t++) { const b = h.reduce((a, x) => a + x, 0); h = h.map((x, j) => x * (1 + R[j][t])); const a = h.reduce((q, x) => q + x, 0); ret.push(a / b - 1);
    const cw = h.map(x => x / a); we.push(cw[0]); const doIt = reb === "annual" ? ks[t + 1].endsWith("-12") : reb === "none" ? false : cw.some((x, j) => Math.abs(x - w[j]) > +reb);
    if (doIt && w.filter(x => x > 0).length > 1) { h = w.map(x => x * a); n++; } }
  return { ret, we, n }; }
TBL.risk = function () {
  const o = $("#tbRiskOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [g1h, g1] = div("chart tall"), [w1h, w1] = div("chart"), [r1h, r1] = div("chart");
    o.innerHTML = `<div class="card"><h2>Rischio, diversificazione e ribilanciamento</h2>
    <p class="lead">L'obiettivo non è il rendimento massimo ma il miglior rendimento per unità di rischio. Mescolare azioni, obbligazioni e oro riduce le oscillazioni; ribilanciare serve a tenere il rischio che hai scelto, non a «guadagnare gratis».</p>
    <div class="form"><label>Universo <select id="tbRu"><option value="usd">USA lungo periodo (USD, dal 1962)</option><option value="eur">Euro (EUR, dal 2007)</option></select></label>
     <label>Dall'anno <select id="tbRy0">${tbYrs(1962, 2020, 1973)}</select></label><label>All'anno <select id="tbRy1">${tbYrs(1965, +CUR_M.slice(0, 4), +CUR_M.slice(0, 4))}</select></label>
     <label>Ribilanciamento <select id="tbRr"><option value="none">Mai (lascio correre)</option><option value="annual" selected>Annuale (dicembre)</option><option value="0.05">A soglia ±5 punti</option><option value="0.10">A soglia ±10 punti</option></select></label></div>
    <div id="tbRtxt"></div><div id="tbRtab"></div>${g1h}${w1h}
    <h3>Le correlazioni cambiano nel tempo</h3><div class="form"><label>Finestra <select id="tbRw"><option>12</option><option selected>36</option><option>60</option></select> mesi</label></div>${r1h}<div id="tbRctxt"></div>
    <p class="note" id="tbRnote"></p>
    ${TBsrc([["Episode 3: Risk: The Key Concept for Every Investor", "Hu0Jo67UzfY"], ["Why Investing in Stocks Alone Is NOT Enough", "3P3BPUKFANU"], ["The rule that saves your portfolio when everything goes up or crashes", "p6jAmx37scw"], ["Ep.8 Asset allocation: la regola di The Bull", "Xef8Q1qtLUo"]])}</div>`;
    o._g = g1; o._w = w1; o._r = r1; ["#tbRu", "#tbRy0", "#tbRy1", "#tbRr", "#tbRw"].forEach(s => $(s).onchange = TBL.risk); }
  const U = tbUniverse($("#tbRu").value), y0 = $("#tbRy0").value, y1 = $("#tbRy1").value, reb = $("#tbRr").value;
  const common = [...U.L[0].keys()].filter(k => U.L.every(m => m.has(k))).sort(), ks = common.filter(k => k >= (+y0 - 1) + "-12" && k <= y1 + "-12");
  if (ks.length < 37) { $("#tbRtxt").innerHTML = `<p class="warn">Servono almeno 3 anni di dati comuni nel periodo (universo ${U.ccy}: dati comuni da ${tbM(common[0])}).</p>`; return; }
  const R = U.L.map(m => ks.slice(1).map((k, i) => m.get(k) / m.get(ks[i]) - 1)), zero = R[0].map(() => 0);
  const res = TB_PF.map(([n, w]) => { const s = tbSim(R, w, reb, ks), s0 = tbSim(R, w, "none", ks), S = pstats(s.ret, zero), S0 = pstats(s0.ret, zero); const r12 = []; for (let i = 12; i < S.eq.length; i++) r12.push(S.eq[i] / S.eq[i - 12] - 1); return { n, w, s, s0, S, S0, worst12: Math.min(...r12) }; });
  $("#tbRtab").innerHTML = table(["Portafoglio", "Rend. annuo composto", "Volatilità", "Rendimento / volatilità", "Calo massimo", "Mesi sott'acqua (max)", "Peggiori 12 mesi", "Ribilanciamenti"], res.map(r => [`<b>${r.n}</b>`, pc(r.S.cagr), pct(r.S.vol), num(r.S.cagr / r.S.vol), pc(r.S.md), r.S.rec, pc(r.worst12), reb === "none" ? "–" : r.s.n])).replace("<table", '<table class="full"');
  plot(o._g, res.map((r, k) => ({ x: ks, y: r.S.eq.map(v => v * 100), name: r.n, type: "scatter", line: { color: [C.red, C.gold, C.blue, C.green][k], width: 1.6 } })), { title: T(`Crescita di 100 ${U.ccy} (scala log) · ribilanciamento: ${$("#tbRr").selectedOptions[0].text.toLowerCase()}`), yaxis: { type: "log" } });
  const r6 = res[2];
  plot(o._w, [{ x: ks.slice(1), y: r6.s0.we.map(x => x * 100), name: "60/40 mai ribilanciato", type: "scatter", line: { color: C.red } }, ...(reb !== "none" ? [{ x: ks.slice(1), y: r6.s.we.map(x => x * 100), name: "60/40 con la regola scelta", type: "scatter", line: { color: C.gold } }] : [])],
    { title: T("Quota azionaria effettiva del 60/40"), yaxis: { ticksuffix: "%" }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 60, y1: 60, line: { color: "#888", dash: "dot" } }] });
  const a = res[0], b = res[2], g = res[3], drift = r6.s0.we[r6.s0.we.length - 1];
  $("#tbRtxt").innerHTML = `<div class="answer">${tbM(ks[1])} → ${tbM(ks[ks.length - 1])} (${U.ccy}). Il 100% azionario ha reso ${pct(a.S.cagr)} l'anno con un calo massimo di ${pct(a.S.md)}; il <b>60/40</b> ${pct(b.S.cagr)} con un calo massimo di <b>${pct(b.S.md)}</b> e volatilità ${pct(b.S.vol)} invece di ${pct(a.S.vol)}. Rendimento per unità di rischio: ${num(a.S.cagr / a.S.vol)} (100/0), ${num(b.S.cagr / b.S.vol)} (60/40), ${num(g.S.cagr / g.S.vol)} con il 10% di oro. Senza ribilanciare, il 60/40 di partenza finisce con il <b>${pct(drift, 0)} di azioni</b>: un portafoglio che nessuno ha scelto. ${reb === "none" ? "" : `Con la regola scelta servono ${b.s.n} interventi sul 60/40; calo massimo ${pct(b.S.md)} contro ${pct(b.S0.md)} senza ribilanciare, volatilità ${pct(b.S.vol)} contro ${pct(b.S0.vol)}.`}</div>`;
  const w = +$("#tbRw").value, corr = (x, y) => { const mx = mean(x), my = mean(y); let n = 0, p = 0, q = 0; for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); p += (x[i] - mx) ** 2; q += (y[i] - my) ** 2; } return n / Math.sqrt(p * q); };
  const cx = [], c1 = [], c2 = []; for (let i = w; i <= R[0].length; i++) { cx.push(ks[i]); c1.push(corr(R[0].slice(i - w, i), R[1].slice(i - w, i))); c2.push(corr(R[0].slice(i - w, i), R[2].slice(i - w, i))); }
  plot(o._r, [{ x: cx, y: c1, name: "Azioni – obbligazioni", type: "scatter", line: { color: C.blue } }, { x: cx, y: c2, name: "Azioni – oro", type: "scatter", line: { color: C.gold } }], { title: T(`Correlazione mobile a ${w} mesi`), yaxis: { range: [-1, 1], zerolinecolor: "#888" } });
  const at = k => { const i = cx.indexOf(k); return i >= 0 ? num(c1[i]) : "–"; };
  $("#tbRctxt").innerHTML = `<p class="note">Correlazione azioni-obbligazioni sull'intero periodo ${num(corr(R[0], R[1]))}, ultima finestra ${num(c1[c1.length - 1])}; a dicembre 2008 ${at("2008-12")}, a dicembre 2022 ${at("2022-12")}. Quando la correlazione è positiva (come nel 2022) azioni e obbligazioni scendono insieme: la diversificazione aiuta, ma non è garantita in ogni crisi.</p>`;
  $("#tbRnote").innerHTML = `Dati mensili. ${U.note} Rendimento/volatilità senza tasso privo di rischio. Ribilanciamento annuale a fine dicembre; a soglia = controllo mensile, si ribilancia se un peso si allontana dal target oltre la soglia. Nessun costo né tassa: in Italia ribilanciare vendendo fa pagare imposte sulle plusvalenze, mentre farlo con i nuovi versamenti non costa nulla.`;
};

/* ---------- 7. PAC: quanto e quando ---------- */
TBL.pac = function () {
  const o = $("#tbPacOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [l1h, l1] = div("chart tall"), [h1h, h1] = div("chart tall");
    const L = tbLong(); let i1 = L.m.length - 1; while (L.RTR[i1] == null) i1--; const i0 = L.m.indexOf("1900-01"), rr = (L.RTR[i1] / L.RTR[i0]) ** (12 / (i1 - i0)) - 1;
    o.innerHTML = `<div class="card"><h2>PAC: contano di più quanto versi e quando inizi</h2>
    <p class="lead">Si passa tanto tempo a limare lo 0,1% di rendimento, ma per chi accumula pesano di più l'importo della rata e gli anni di interesse composto. Muovi i cursori e guarda tre scenari di rendimento futuro: 4%, 6% e 8% l'anno.</p>
    <div class="form"><label>Rata mensile <input id="tbPr" type="range" min="50" max="2000" step="50" value="300"> <b id="tbPrL"></b></label><label>Anni fino all'obiettivo <input id="tbPn" type="range" min="5" max="45" step="1" value="30"> <b id="tbPnL"></b></label>
     <label>Anni di ritardo nell'iniziare <input id="tbPd" type="range" min="0" max="15" step="1" value="5"> <b id="tbPdL"></b></label></div>
    <div id="tbPtxt"></div>${l1h}${h1h}
    <p class="note">Scenari ipotetici a rendimento costante (capitalizzazione mensile), non previsioni: i mercati veri alternano anni molto diversi. Se leggi i rendimenti come <b>reali</b> (al netto dell'inflazione), i capitali sono in euro di oggi. Riferimento storico: S&P 500 total return reale in USD da gennaio 1900 a ${tbM(L.m[i1])} = ${pct(rr)} l'anno (Shiller + Yahoo), prima di costi, tasse e cambio. Ritardo: chi inizia dopo versa la stessa rata per meno anni, con la stessa data di arrivo.</p>
    ${TBsrc([["Perché non diventi ricco: 5 errori", "BwtQVMeYhaE"], ["Ep.2 L'equazione fondamentale della ricchezza", "IuU0SLfsgn0"], ["How to Overcome Your 4 Investing Fears", "FAK2c2NbZfQ"]])}</div>`;
    o._l = l1; o._h = h1; ["#tbPr", "#tbPn", "#tbPd"].forEach(s => $(s).oninput = () => { clearTimeout(o._t); o._t = setTimeout(TBL.pac, 60); }); }
  const r = +$("#tbPr").value, n = +$("#tbPn").value, dl = Math.min(+$("#tbPd").value, n - 1); $("#tbPrL").textContent = num(r, 0) + " €"; $("#tbPnL").textContent = n; $("#tbPdL").textContent = dl;
  const path = (rt, a, yrs, start) => { const m = (1 + rt) ** (1 / 12) - 1, out = [0]; let v = 0; for (let k = 1; k <= yrs * 12; k++) { if (k > start * 12) v = (v + a) * (1 + m); out.push(v); } return out; };
  const SC = [[0.04, C.blue], [0.06, C.gold], [0.08, C.green]], x = Array.from({ length: n * 12 + 1 }, (_, k) => k / 12);
  const tr = []; SC.forEach(([rt, col]) => { tr.push({ x, y: path(rt, r, n, 0), name: `${num(rt * 100, 0)}% subito`, type: "scatter", line: { color: col, width: 2 }, hovertemplate: "%{y:,.0f} €" }); if (dl) tr.push({ x, y: path(rt, r, n, dl), name: `${num(rt * 100, 0)}% con ${dl} anni di ritardo`, type: "scatter", line: { color: col, width: 1.3, dash: "dash" }, hovertemplate: "%{y:,.0f} €" }); });
  tr.push({ x, y: x.map(t => r * 12 * t), name: "Versato (subito)", type: "scatter", line: { color: C.grey, dash: "dot", width: 1 }, hovertemplate: "%{y:,.0f} €" });
  plot(o._l, tr, { title: T("Capitale accumulato nei tre scenari (€)"), xaxis: { title: { text: "Anni" } }, yaxis: { tickformat: ",.0f" } });
  const fv = (rt, a, yrs) => path(rt, a, yrs, 0).pop(), F6 = fv(0.06, r, n), F6d = fv(0.06, r, n - dl), F6p = fv(0.06, r + 100, n), F65 = fv(0.065, r, n);
  const amts = [100, 200, 300, 500, 700, 1000, 1500], rts = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
  plot(o._h, [{ z: amts.map(a => rts.map(rt => fv(rt, a, n))), x: rts.map(t => num(t * 100, 0) + "%"), y: amts.map(a => a + " €"), type: "heatmap", colorscale: [[0, "#1b1b22"], [1, C.gold]], text: amts.map(a => rts.map(rt => num(fv(rt, a, n) / 1000, 0) + "k")), texttemplate: "%{text}", hovertemplate: "Rata %{y}, rendimento %{x}: %{z:,.0f} €<extra></extra>", showscale: false }],
    { title: T(`Capitale finale dopo ${n} anni: rata mensile (righe) × rendimento annuo (colonne)`), xaxis: { title: { text: "Rendimento annuo" } }, yaxis: { title: { text: "Rata" } }, hovermode: "closest" });
  $("#tbPtxt").innerHTML = `<div class="answer">Con ${num(r, 0)} € al mese per ${n} anni versi ${num(r * 12 * n, 0)} €: al 4% arrivi a <b>${num(fv(0.04, r, n), 0)} €</b>, al 6% a <b>${num(F6, 0)} €</b>, all'8% a <b>${num(fv(0.08, r, n), 0)} €</b>. ${dl ? `Iniziare <b>${dl} anni dopo</b> (al 6%) ti lascia con ${num(F6d, 0)} €: costa <b>${num(F6 - F6d, 0)} €</b>, il ${pct(1 - F6d / F6, 0)} del capitale finale, pur avendo versato solo ${num(r * 12 * dl, 0)} € in meno. ` : ""}Aumentare la rata di 100 € vale +${num(F6p - F6, 0)} €; mezzo punto di rendimento in più (6,5%) vale +${num(F65 - F6, 0)} €.</div>`;
};

/* ---------- 8. Anatomia delle crisi ---------- */
const TB_AC = [["1973-74 shock petrolifero", "1972-12", "1974-12"], ["2000-03 bolla dot-com", "2000-01", "2003-03"], ["2007-09 crisi finanziaria", "2007-06", "2009-06"], ["2020 Covid", "2019-12", "2020-06"], ["2022 inflazione e tassi", "2021-12", "2022-12"]];
TBL.crisi = function () {
  const o = $("#tbCrOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const [c1h, c1] = div("chart tall");
    o.innerHTML = `<div class="card"><h2>Anatomia delle crisi: azioni, obbligazioni, oro e 60/40</h2>
    <p class="lead">Ogni crisi è diversa: in alcune i titoli di Stato hanno protetto, in altre sono scesi insieme alle azioni; a volte l'oro è volato. Capire che tipo di shock è aiuta a non reagire di pancia e ad agire secondo regole decise prima.</p>
    <div class="form"><label>Crisi ${tbChips("tbcr", TB_AC.map((c, i) => [i, c[0]]), 2)}</label><label>Misura <select id="tbCm"><option value="n">Nominale USD</option><option value="r">Reale (al netto inflazione USA)</option></select></label></div>
    <div id="tbCtxt"></div>${c1h}<h3>Tutte le crisi a confronto (dal massimo al minimo delle azioni)</h3><div id="tbCall"></div>
    <p class="note">Dati mensili in USD. Azioni: S&P 500 total return (Shiller, medie mensili, fino a gennaio 1988; poi ^SP500TR di fine mese); obbligazioni: Treasury USA 10 anni (total return calcolato da FRED DGS10); oro: Banca Mondiale (media mensile), poi GLD; 60/40 = 60% azioni e 40% Treasury, ribilanciato ogni mese. Con dati mensili i minimi intramensili (es. 23 marzo 2020) non si vedono. Recupero = mesi dal massimo azionario finché l'asset torna sopra il livello di quel momento. Per le crisi viste solo dall'indice azionario vedi anche <a href="#" data-go="crisi">Educazione → Crisi storiche</a>.</p>
    ${TBsrc([["How to Invest During a Crisis", "-orfTViBygg"], ["I tre errori che ti costano metà di quanto investi", "HN3sr9mGCkE"]])}</div>`;
    o._c = c1; o._k = 2; tbWireChips(o, "tbcr", k => { o._k = +k; TBL.crisi(); }); $("#tbCm").onchange = TBL.crisi;
    o.querySelectorAll("[data-go]").forEach(a => a.onclick = e => { e.preventDefault(); showTab(a.dataset.go); }); }
  const U = tbUniverse("usd"), real = $("#tbCm").value === "r", cpi = cpiMap("USD");
  const ks = [...U.L[0].keys()].filter(k => U.L.every(m => m.has(k)) && (!real || cpi.has(k))).sort();
  const lv = U.L.map(m => ks.map(k => m.get(k) / (real ? cpi.get(k) : 1)));
  const sf = [100]; for (let i = 1; i < ks.length; i++) sf.push(sf[i - 1] * (1 + 0.6 * (lv[0][i] / lv[0][i - 1] - 1) + 0.4 * (lv[1][i] / lv[1][i - 1] - 1) - (real ? 0 : 0))); lv.push(sf);
  const NM = [...U.names, "60/40"], COL = [C.red, C.blue, C.gold, C.green];
  const q2 = m => m == null ? "non ancora" : m === 0 ? "nessun calo" : m >= 24 ? `${num(m / 12, 1)} anni` : `${m} mesi`;
  const an = ([nm, a, b]) => { const A = ks.indexOf(a), B = ks.indexOf(b); if (A < 0 || B < 0) return null; let t = A; for (let i = A; i <= B; i++) if (lv[0][i] < lv[0][t]) t = i; let p = A; for (let i = A; i <= t; i++) if (lv[0][i] > lv[0][p]) p = i;
    const per = lv.map(L => { const ch = L[t] / L[p] - 1; let rec = null; for (let i = t; i < ks.length; i++) if (L[i] >= L[p]) { rec = i - p; break; } let mn = 0; for (let i = p; i <= t; i++) mn = Math.min(mn, L[i] / L[p] - 1); if (mn >= 0) rec = 0; return { ch, rec }; });
    return { nm, p, t, per }; };
  const all = TB_AC.map(an).filter(Boolean), cur = an(TB_AC[o._k]);
  $("#tbCall").innerHTML = table(["Crisi", "Massimo → minimo azioni", ...NM.map(n => n.split(" (")[0]), "Recupero azioni", "Recupero 60/40"], all.map(x => [x.nm, `${tbM(ks[x.p])} → ${tbM(ks[x.t])}`, ...x.per.map(q => pc(q.ch)), q2(x.per[0].rec), q2(x.per[3].rec)])).replace("<table", '<table class="full"');
  if (!cur) return;
  const a0 = Math.max(0, cur.p - 6), a1 = Math.min(ks.length - 1, cur.t + 48);
  plot(o._c, lv.map((L, j) => ({ x: ks.slice(a0, a1 + 1), y: L.slice(a0, a1 + 1).map(v => v / L[cur.p] * 100), name: NM[j], type: "scatter", line: { color: COL[j], width: j === 3 ? 2.6 : 1.6 }, hovertemplate: "%{y:.1f}" })),
    { title: T(`${cur.nm}: valore con il massimo azionario = 100${real ? " (reale)" : ""}`), shapes: [{ type: "rect", x0: ks[cur.p], x1: ks[cur.t], yref: "paper", y0: 0, y1: 1, fillcolor: "rgba(192,40,63,.12)", line: { width: 0 } }] });
  const P = cur.per, best = [1, 2].reduce((q, j) => P[j].ch > q[0] ? [P[j].ch, j] : q, [-9, 0]);
  $("#tbCtxt").innerHTML = `<div class="answer"><b>${cur.nm}</b>, dal massimo delle azioni (${tbM(ks[cur.p])}) al minimo (${tbM(ks[cur.t])}), ${cur.t - cur.p} mesi${real ? ", in termini reali" : ""}: azioni <b>${pct(P[0].ch)}</b>, Treasury ${tbPP(P[1].ch)}, oro ${tbPP(P[2].ch)}, 60/40 <b>${pct(P[3].ch)}</b>. ${best[0] > 0 ? `Ha protetto soprattutto ${best[1] === 1 ? "il Treasury" : "l'oro"}.` : "In questa crisi né obbligazioni né oro hanno compensato: è sceso quasi tutto."} Le azioni sono tornate al massimo dopo ${q2(P[0].rec)}, il 60/40 dopo ${q2(P[3].rec)}.</div>`;
};

/* ---------- collegamento al menu ---------- */
const TB_TABS = { tb_dd: TBL.dd, tb_fwd: TBL.fwd, tb_eps: TBL.eps, tb_gap: TBL.gap, tb_ath: TBL.ath, tb_risk: TBL.risk, tb_pac: TBL.pac, tb_crisi: TBL.crisi };
{ const _s = showTab; showTab = id => { _s(id); if (TB_TABS[id]) { try { TB_TABS[id](); } catch (e) { console.error(e); } window.dispatchEvent(new Event("resize")); } }; }
