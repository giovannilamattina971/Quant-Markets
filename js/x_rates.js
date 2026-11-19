"use strict";
/* ===== v9: Curve dei tassi, obbligazioni, spread e «quanto possono salire i tassi» ===== */
// prezzo di un titolo con cedola c (annua, decimale), scadenza n anni, rendimento y, cedole semestrali
const bondPx = (c, y, n) => { const k = Math.round(n * 2); if (k < 1) return (1 + c * n) / (1 + y * n); let p = 0; for (let i = 1; i <= k; i++) p += (c / 2) / Math.pow(1 + y / 2, i); return p + 1 / Math.pow(1 + y / 2, k); };
function bondRisk(yPct, n) { const y = yPct / 100, h = 1e-4, p0 = bondPx(y, y, n), pu = bondPx(y, y + h, n), pd = bondPx(y, y - h, n); return { D: (pd - pu) / (2 * h * p0), Cv: (pu + pd - 2 * p0) / (h * h * p0) }; }
// rendimento atteso a 12 mesi di un titolo a scadenza costante se i tassi si muovono di dy (pp) subito: cedola − duration·dy + ½·convessità·dy²
const bond12 = (yPct, n, dyPct) => { const { D, Cv } = bondRisk(yPct, n), dy = dyPct / 100; return yPct / 100 - D * dy + .5 * Cv * dy * dy; };
const lastV = o => o && o.v && o.v.length ? [o.d[o.d.length - 1], o.v[o.v.length - 1]] : [null, NaN];

XL.page("cx_rates", ["CURVE", "EUCURVE"], o => {
  const Cv = window.CURVE || {}, E = window.EUCURVE || {};
  const US = [["DGS3MO", .25, "3 mesi"], ["DGS6MO", .5, "6 mesi"], ["DGS1", 1, "1 anno"], ["DGS2", 2, "2 anni"], ["DGS3", 3, "3 anni"], ["DGS5", 5, "5 anni"], ["DGS7", 7, "7 anni"], ["DGS10", 10, "10 anni"], ["DGS20", 20, "20 anni"], ["DGS30", 30, "30 anni"]].filter(x => Cv[x[0]]);
  const EU = [["3M", .25], ["1Y", 1], ["2Y", 2], ["3Y", 3], ["5Y", 5], ["7Y", 7], ["10Y", 10], ["15Y", 15], ["20Y", 20], ["30Y", 30]];
  const curveAt = (keys, get, date) => keys.map(k => XL.at(get(k), date));
  const usLast = US.length ? Cv.DGS10.d[Cv.DGS10.d.length - 1] : null;
  const ago = (d, days) => new Date(Date.parse(d) - days * DAY).toISOString().slice(0, 10);
  const sv = k => ({ d: Cv[k].d, c: Cv[k].v });
  const ev = k => E[k] ? { d: E[k].d, c: E[k].v } : null;
  const euLast = E.AAA_10Y ? E.AAA_10Y.d[E.AAA_10Y.d.length - 1] : null;
  // tabella «quanto possono salire i tassi»
  const rows = [];
  [["USA", "DGS2", 2], ["USA", "DGS5", 5], ["USA", "DGS10", 10], ["USA", "DGS30", 30]].forEach(([g, k, n]) => { if (Cv[k]) rows.push([`Treasury ${n} anni`, lastV(Cv[k])[1], n, "USD"]); });
  [["AAA_2Y", 2], ["AAA_5Y", 5], ["AAA_10Y", 10], ["AAA_30Y", 30]].forEach(([k, n]) => { if (E[k]) rows.push([`Governativi euro AAA ${n} anni`, lastV(E[k])[1], n, "EUR"]); });
  [["ALL_2Y", 2], ["ALL_10Y", 10]].forEach(([k, n]) => { if (E[k]) rows.push([`Governativi area euro (tutti) ${n} anni`, lastV(E[k])[1], n, "EUR"]); });
  if (E.GOV10_IT) rows.push(["BTP 10 anni (media mese)", lastV(E.GOV10_IT)[1], 10, "EUR"]); else if (YIELDS.IRLTLT01ITM156N) rows.push(["BTP 10 anni (media mese)", lastV(YIELDS.IRLTLT01ITM156N)[1], 10, "EUR"]);
  const SC = [-1.5, -1, -.5, 0, .5, 1, 1.5];
  const brTab = table(["Titolo", "Rendimento", "Duration", "Rialzo tassi che azzera il rendimento in 12 mesi", ...SC.map(s => (s > 0 ? "+" : "") + num(s, 1).replace(",0", "") + " pp")], rows.map(([n, y, m]) => { const { D } = bondRisk(y, m); return [n, num(y) + "%", num(D, 1), `<b>+${num(y / D, 2)} pp</b>`, ...SC.map(s => pc(bond12(y, m, s)))]; }));
  // spread sovrani
  const gov = ["IT", "FR", "ES"].filter(c => E["GOV10_" + c] && E.GOV10_DE);
  const s10 = Cv.T10Y2Y ? lastV(Cv.T10Y2Y)[1] : NaN, s3m = Cv.T10Y3M ? lastV(Cv.T10Y3M)[1] : NaN;
  const ry = Cv.DFII10 ? lastV(Cv.DFII10)[1] : NaN, be = Cv.T10YIE ? lastV(Cv.T10YIE)[1] : NaN;
  const [g1, i1] = div("chart tall"), [g2, i2] = div(), [g3, i3] = div(), [g4, i4] = div(), [g5, i5] = div(), [g6, i6] = div(), [g7, i7] = div();
  o.innerHTML = XL.pdfBtn("cx_rates", "Curve dei tassi e obbligazioni", "Treasury, governativi euro, BTP, tassi reali, spread di credito, scenari sui rendimenti") + `
  <div class="card"><h3>Tassi oggi</h3><div class="kpis">
   <div class="kpi"><span>Treasury 10 anni</span><b>${num(lastV(Cv.DGS10)[1])}%</b><small class="muted">${usLast ? fmtD(usLast) : ""} · ${XL.pp(XL.pctl(Cv.DGS10.v, lastV(Cv.DGS10)[1]))} percentile dal 1990</small></div>
   <div class="kpi"><span>Pendenza 10a − 2a</span><b>${num(s10)} pp</b><small class="muted">10a − 3 mesi: ${isFinite(s3m) ? num(s3m) + " pp" : "–"}</small></div>
   <div class="kpi"><span>Tasso reale 10a (TIPS)</span><b>${isFinite(ry) ? num(ry) + "%" : "–"}</b><small class="muted">inflazione attesa 10a: ${isFinite(be) ? num(be) + "%" : "–"}</small></div>
   <div class="kpi"><span>Euro AAA 10 anni</span><b>${E.AAA_10Y ? num(lastV(E.AAA_10Y)[1]) + "%" : "–"}</b><small class="muted">${euLast ? fmtD(euLast) : ""}</small></div></div></div>
  <div class="card"><h3>Quanto possono salire i tassi prima di perdere? Rendimento a 12 mesi per scenario</h3>${brTab}
   <p class="answer">La colonna in grassetto è il «cuscinetto»: di quanto devono salire i rendimenti entro un anno perché la cedola sia annullata dalla perdita di prezzo. I titoli brevi hanno cuscinetti ampi e poca sensibilità; i lunghi guadagnano molto se i tassi scendono ma soffrono se salgono. Utile per decidere la duration del portafoglio obbligazionario in base allo scenario che si ritiene più probabile.</p>
   <p class="note">Calcolo per un titolo a cedola pari al rendimento attuale, scadenza costante, movimento dei tassi immediato e parallelo; include duration e convessità, esclude il «rolldown» lungo la curva, costi e tasse (per i titoli di Stato italiani 12,5%).</p></div>
  <div class="card"><h3>Curva dei Treasury USA</h3>${g1}</div>
  <div class="card"><h3>Curva dei titoli di Stato dell'area euro (BCE)</h3>${g2}<p class="note">Curve stimate dalla BCE (Svensson): «AAA» = solo emittenti con rating AAA (es. Germania, Paesi Bassi); «tutti» = tutti i governativi dell'area euro, Italia inclusa.</p></div>
  <div class="card"><h3>Pendenza della curva USA e recessioni</h3>${g3}<p class="note">Curva invertita (sotto zero) = tassi brevi più alti dei lunghi. Ha preceduto tutte le recessioni USA dal 1970 (aree grigie), con anticipi molto variabili (6–24 mesi) e almeno un falso allarme. La recessione arriva spesso dopo che la curva è tornata positiva.</p></div>
  <div class="grid2"><div class="card"><h3>Tasso nominale = reale + inflazione attesa</h3>${g4}</div><div class="card"><h3>Spread dei governativi europei sul Bund</h3>${g5}</div></div>
  <div class="card"><h3>Spread di credito: quanto vengono pagati i rischi di insolvenza</h3><div class="grid2"><div>${g6}</div><div>${g7}</div></div>
   <p class="note">Spread = rendimento extra delle obbligazioni societarie rispetto ai titoli di Stato. Spread molto bassi = il mercato è tranquillo e il rischio è pagato poco; si allargano bruscamente nelle crisi. FRED pubblica gli spread ICE BofA solo per gli ultimi 3 anni: per il lungo periodo si usa lo spread Baa di Moody's (dal 1986).</p></div>`;
  if (US.length) { const lab = US.map(x => x[2]); const T = [[usLast, "Oggi", C.gold, 3], [ago(usLast, 30), "1 mese fa", C.grey, 1.5], [ago(usLast, 365), "1 anno fa", C.blue, 1.5], [ago(usLast, 365 * 3), "3 anni fa", C.green, 1.5]];
    plot(i1, T.map(([d, n, col, w]) => ({ x: lab, y: curveAt(US.map(x => x[0]), sv, d), name: `${n} (${fmtD(d)})`, mode: "lines+markers", line: { color: col, width: w } })), { title: "Rendimenti dei Treasury per scadenza", yaxis: { ticksuffix: "%" }, hovermode: "x unified" }); }
  if (euLast) { const lab = EU.map(x => x[0].replace("Y", " anni").replace("3M", "3 mesi")), ky = t => EU.map(x => t + "_" + x[0]);
    plot(i2, [["AAA", euLast, "AAA oggi", C.gold, "solid"], ["AAA", ago(euLast, 365), "AAA 1 anno fa", C.gold, "dot"], ["ALL", euLast, "Tutti oggi", C.blue, "solid"], ["ALL", ago(euLast, 365), "Tutti 1 anno fa", C.blue, "dot"]].map(([t, d, n, col, dash]) => ({ x: lab, y: curveAt(ky(t), ev, d).map(v => v), name: n, mode: "lines+markers", line: { color: col, dash } })), { title: "Curva dei governativi euro", yaxis: { ticksuffix: "%" } }); }
  if (Cv.T10Y2Y) plot(i3, [{ x: Cv.T10Y2Y.d, y: Cv.T10Y2Y.v, name: "10 anni − 2 anni", line: { color: C.gold, width: 1 } }, Cv.T10Y3M ? { x: Cv.T10Y3M.d, y: Cv.T10Y3M.v, name: "10 anni − 3 mesi", line: { color: C.blue, width: 1 } } : null].filter(Boolean), { title: "Pendenza della curva USA (punti percentuali)", shapes: [...XL.recShapes("1990-01"), { type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: C.red } }] });
  if (Cv.DFII10) plot(i4, [{ x: Cv.DGS10.d.filter(d => d >= "2003"), y: Cv.DGS10.v.filter((_, i) => Cv.DGS10.d[i] >= "2003"), name: "Nominale 10a", line: { color: C.gold } }, { x: Cv.DFII10.d, y: Cv.DFII10.v, name: "Reale 10a (TIPS)", line: { color: C.blue } }, Cv.T10YIE ? { x: Cv.T10YIE.d, y: Cv.T10YIE.v, name: "Inflazione attesa 10a", line: { color: C.green } } : null].filter(Boolean), { title: "Treasury 10 anni: componenti", yaxis: { ticksuffix: "%" } });
  if (gov.length) { const de = new Map(E.GOV10_DE.d.map((d, i) => [d, E.GOV10_DE.v[i]])); plot(i5, gov.map((c, j) => ({ x: E["GOV10_" + c].d, y: E["GOV10_" + c].v.map((v, i) => de.has(E["GOV10_" + c].d[i]) ? (v - de.get(E["GOV10_" + c].d[i])) * 100 : null), name: { IT: "Italia", FR: "Francia", ES: "Spagna" }[c], line: { color: [C.green, C.blue, C.red][j] } })), { title: "Spread 10 anni sul Bund (punti base)" }); }
  const crd = [["BAMLH0A0HYM2", "High yield USA", C.red], ["BAMLC0A0CM", "Investment grade USA", C.blue], ["BAMLHE00EHYIOAS", "High yield euro", C.gold]].filter(x => Cv[x[0]]);
  plot(i6, crd.map(([k, n, col]) => ({ x: Cv[k].d, y: Cv[k].v, name: n, line: { color: col } })), { title: "Spread di credito (ultimi 3 anni)", yaxis: { ticksuffix: "%" } });
  if (Cv.BAA10Y) { const cur = lastV(Cv.BAA10Y)[1]; plot(i7, [{ x: Cv.BAA10Y.d, y: Cv.BAA10Y.v, name: "Baa − Treasury 10a", line: { color: C.gold, width: 1 } }], { title: `Spread Baa dal 1986: oggi ${num(cur)} pp (${XL.pp(XL.pctl(Cv.BAA10Y.v, cur))} percentile)`, shapes: XL.recShapes("1986-01") }); }
});
