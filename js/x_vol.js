"use strict";
/* ===== v9: Volatilità e stress + gestione del rischio a volatilità obiettivo ===== */
function tbillDaily(dates) { const T = YIELDS.TB3MS, m = new Map(T.d.map((d, i) => [d.slice(0, 7), T.v[i]])); let last = 0; return dates.map(d => { const v = m.get(d.slice(0, 7)); if (v != null) last = v; return last / 100 / 252; }); }
function perfStats(d, c) { const r = c.map((x, i) => i ? x / c[i - 1] - 1 : 0).slice(1), y = XL.yrs(d[0], d[d.length - 1]), cagr = XL.cagr(c, y), vol = std(r) * Math.sqrt(252), dd = Math.min(...XL.dd(c));
  const yrs = {}; d.forEach((x, i) => { yrs[x.slice(0, 4)] = i; }); const ks = Object.keys(yrs); let worst = Infinity; ks.forEach((k, j) => { if (j) { const v = c[yrs[k]] / c[yrs[ks[j - 1]]] - 1; if (v < worst) worst = v; } }); return { cagr, vol, dd, worst, sh: cagr / vol }; }

XL.page("cx_vol", ["XTRA", "CURVE"], o => {
  const sp = XL.get("MKT:^SP500TR"), vix = XL.get("MKT:^VIX"), v3 = XL.get("XTRA:^VIX3M"), move = XL.get("XTRA:^MOVE"), Cv = window.CURVE || {};
  const a = XL.align([sp, vix]), c = a.cs[0], vx = a.cs[1], n = c.length - 1;
  const rv = XL.vol(c, 21), H = [21, 63, 252], F = H.map(h => XL.fwd(c, h));
  const ratio = v3 ? (() => { const m = new Map(v3.d.map((d, i) => [d, v3.c[i]])); return a.d.map((d, i) => m.has(d) ? vx[i] / m.get(d) : NaN); })() : a.d.map(() => NaN);
  const conds = [["Tutti i giorni", () => true], ["VIX sotto 13 (calma piatta)", i => vx[i] < 13], ["VIX tra 20 e 30", i => vx[i] >= 20 && vx[i] < 30], ["VIX sopra 30", i => vx[i] >= 30], ["VIX sopra 40", i => vx[i] >= 40], ["Curva del VIX invertita (VIX > VIX 3 mesi)", i => ratio[i] > 1], ["Volatilità realizzata 1m sopra 30%", i => rv[i] > .3]];
  const ctab = table(["Condizione", "Giorni", "1 mese: media", "% positivi", "3 mesi: media", "% positivi", "12 mesi: media", "Mediana", "% positivi", "Peggiore 10%"], conds.map(([t, f]) => { const idx = c.map((_, i) => i).filter(i => f(i)); const st = F.map(fw => XL.statsRow(idx.map(i => fw[i]))); return [t, idx.length, pc(st[0].mean), pct(st[0].pos, 0), pc(st[1].mean), pct(st[1].pos, 0), pc(st[2].mean), pc(st[2].med), pct(st[2].pos, 0), pc(st[2].p10)]; }));
  const vrp = vx.map((v, i) => i + 21 < n ? v / 100 - XL.vol(c.slice(i, i + 22), 21)[21] : NaN);
  const vrpM = mean(vrp.filter(isFinite)), vrpPos = fracPos(vrp.filter(isFinite));
  const [g1, i1] = div("chart tall"), [g2, i2] = div(), [g3, i3] = div(), [g4, i4] = div(), [g5, i5] = div("chart tall"), [g6, i6] = div();
  o.innerHTML = XL.pdfBtn("cx_vol", "Volatilità e stress", "VIX, struttura a termine, stress finanziario e gestione a volatilità obiettivo") + `
  <div class="card"><h3>Volatilità oggi</h3><div class="kpis">
   <div class="kpi"><span>VIX</span><b>${num(vx[n], 1)}</b><small class="muted">${XL.pp(XL.pctl(vx, vx[n]))} percentile dal 1990 · ${fmtD(a.d[n])}</small></div>
   <div class="kpi"><span>VIX ÷ VIX 3 mesi</span><b>${isFinite(ratio[n]) ? num(ratio[n], 2) : "–"}</b><small class="muted">${ratio[n] > 1 ? "invertita: stress in corso" : "normale (sotto 1)"}</small></div>
   <div class="kpi"><span>Volatilità realizzata S&amp;P 1 mese</span><b>${pct(rv[n])}</b><small class="muted">${XL.pp(XL.pctl(rv, rv[n]))} percentile</small></div>
   <div class="kpi"><span>MOVE (volatilità Treasury)</span><b>${move ? num(move.c[move.c.length - 1], 0) : "–"}</b><small class="muted">${move ? XL.pp(XL.pctl(move.c, move.c[move.c.length - 1])) + " percentile" : ""}</small></div></div></div>
  <div class="card"><h3>Cosa è successo all'S&amp;P 500 dopo la paura</h3>${ctab}
   <p class="answer">I rendimenti successivi ai picchi di volatilità sono stati in media <b>più alti</b> di quelli di un giorno qualsiasi, ma con oscillazioni molto più ampie: la paura è il prezzo del premio. Investire quando il VIX è sopra 30 ha funzionato bene a 12 mesi nella maggior parte dei casi, però il «peggiore 10%» ricorda che si può scendere ancora parecchio prima del recupero.</p>
   <p class="note">S&amp;P 500 total return dal 1990. Giorni consecutivi nella stessa condizione non sono episodi indipendenti.</p></div>
  <div class="card"><h3>VIX e struttura a termine</h3>${g1}${g2}<p class="note">Normalmente il VIX a 3 mesi è più alto del VIX a 30 giorni (curva in salita). Quando il rapporto supera 1 il mercato paga di più la protezione immediata: succede nelle fasi acute di vendita e spesso vicino ai minimi.</p></div>
  <div class="card"><h3>Premio per il rischio di volatilità</h3>${g3}<p class="note">VIX meno volatilità effettivamente realizzata nel mese successivo: in media ${pct(vrpM)} e positivo nel ${pct(vrpPos, 0)} dei giorni. Le opzioni di protezione costano quasi sempre più del rischio che coprono: assicurare un portafoglio in modo continuativo ha un costo alto; diversificazione e liquidità sono protezioni più economiche.</p></div>
  <div class="grid2"><div class="card"><h3>Indici di stress finanziario</h3>${g4}<p class="note">Chicago Fed (NFCI) e St. Louis Fed: sopra zero = condizioni finanziarie più tese della media.</p></div><div class="card"><h3>MOVE: la «paura» sui Treasury</h3>${g6}</div></div>
  <div class="card"><h3>Gestire il rischio: esposizione a volatilità obiettivo</h3>
   <div class="form"><label>Volatilità obiettivo ${XL.sel("vtT", [["0.08", "8%"], ["0.10", "10%"], ["0.12", "12%"], ["0.15", "15%"]], "0.12")}</label><label>Finestra di stima ${XL.sel("vtW", [["21", "1 mese"], ["63", "3 mesi"]], "21")}</label><label>Esposizione massima ${XL.sel("vtM", [["1", "100% (no leva)"], ["1.5", "150%"]], "1")}</label></div>
   <div id="vtOut"></div>${g5}<p class="note">Ogni giorno l'esposizione all'S&amp;P 500 è fissata a obiettivo ÷ volatilità degli ultimi giorni (calcolata con i dati fino al giorno prima); il resto in T-Bill. Tecnica usata da fondi «risk parity» e «managed volatility». Nessun costo di negoziazione né tassa: nella realtà gli aggiustamenti frequenti costano.</p></div>`;
  const i0 = lb(a.d, "1990-01-01");
  plot(i1, [{ x: a.d, y: vx, name: "VIX", line: { color: C.gold, width: 1 } }, { x: a.d, y: rv.map(v => v * 100), name: "Volatilità realizzata 1 mese", line: { color: C.blue, width: 1 } }], { title: "VIX e volatilità realizzata dell'S&P 500", shapes: XL.recShapes("1990-01") });
  if (v3) { const j = a.d.findIndex((_, i) => isFinite(ratio[i])); plot(i2, [{ x: a.d.slice(j), y: ratio.slice(j), name: "VIX ÷ VIX 3 mesi", line: { color: C.gold, width: 1 } }], { title: "Struttura a termine del VIX", shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 1, y1: 1, line: { color: C.red, dash: "dot" } }] }); }
  plot(i3, [{ x: a.d.slice(i0), y: vrp.slice(i0).map(v => v * 100), name: "VIX − volatilità realizzata successiva", line: { color: C.gold, width: 1 } }], { title: "Premio di volatilità (punti %)", shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "#555" } }] });
  { const tr4 = [["NFCI", "Chicago Fed NFCI", C.gold], ["STLFSI4", "St. Louis Fed", C.blue]].filter(x => Cv[x[0]]).map(([k, t, col]) => ({ x: Cv[k].d, y: Cv[k].v, name: t, line: { color: col, width: 1 } })); if (tr4.length) plot(i4, tr4, { title: "Stress finanziario", shapes: XL.recShapes("1971-01") }); }
  if (move) plot(i6, [{ x: move.d, y: move.c, name: "MOVE", line: { color: C.blue, width: 1 } }], { title: "Indice MOVE (volatilità implicita dei Treasury)" });
  const vt = () => { const T = +$("#vtT").value, W = +$("#vtW").value, M = +$("#vtM").value, d = a.d.slice(i0), px = c.slice(i0), rf = tbillDaily(d), vol = XL.vol(px, W);
    const nav = [1], bh = [1], ex = [NaN]; for (let i = 1; i < px.length; i++) { const e = isFinite(vol[i - 1]) && vol[i - 1] > 0 ? Math.min(M, T / vol[i - 1]) : 1; ex.push(e); const r = px[i] / px[i - 1] - 1; nav.push(nav[i - 1] * (1 + e * r + (1 - e) * rf[i] - (e > 1 ? (e - 1) * .005 / 252 : 0))); bh.push(px[i] / px[0]); }
    // con leva la parte oltre il 100% è finanziata al T-Bill + 0,5% annuo
    const nv = nav.map((v, i) => v), A = perfStats(d, bh), B = perfStats(d, nv);
    $("#vtOut").innerHTML = table(["", "Rendimento annuo", "Volatilità", "Sharpe (rf=0)", "Massimo calo", "Anno peggiore", "Esposizione media"], [["S&P 500 compra e tieni", pc(A.cagr), pct(A.vol), num(A.sh), pc(A.dd), pc(A.worst), "100%"], [`Volatilità obiettivo ${pct(T, 0)}`, pc(B.cagr), pct(B.vol), num(B.sh), pc(B.dd), pc(B.worst), pct(mean(ex.filter(isFinite)), 0)]]);
    plot(i5, [{ x: d, y: bh.map(v => v * 100), name: "Compra e tieni", line: { color: C.grey } }, { x: d, y: nv.map(v => v * 100), name: "Volatilità obiettivo", line: { color: C.gold } }, { x: d, y: ex.map(v => v * 100), name: "Esposizione azionaria", yaxis: "y2", line: { color: C.blue, width: .8 }, opacity: .6 }],
      { title: "Crescita di 100 (scala logaritmica) ed esposizione", yaxis: { type: "log" }, yaxis2: { overlaying: "y", side: "right", range: [0, 400], ticksuffix: "%", showgrid: false } }); };
  ["vtT", "vtW", "vtM"].forEach(k => $("#" + k).onchange = vt); vt();
});
