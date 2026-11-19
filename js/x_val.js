"use strict";
/* ===== v9: Valutazioni, rendimento implicito dal CAPE, premio al rischio azionario ===== */
XL.page("cx_val", ["CURVE", "PESNAP"], o => {
  const S = window.SHILLER, CA = SIGNALS.CAPE, PE = SIGNALS.PE;
  // indice reale total return (Shiller) mensile
  const tr = [1]; for (let i = 1; i < S.d.length; i++) tr.push(tr[i - 1] * (S.P[i] + S.D[i - 1] / 12) / S.P[i - 1]);
  const real = tr.map((x, i) => x / S.CPI[i]); const idx = new Map(S.d.map((d, i) => [d, i]));
  const capeM = new Map(CA.d.map((d, i) => [d, CA.v[i]]));
  const pts = []; S.d.forEach((d, i) => { const j = i + 120; if (j < S.d.length && capeM.has(d)) pts.push({ d, cape: capeM.get(d), f: Math.pow(real[j] / real[i], 1 / 10) - 1 }); });
  // regressione f = a + b ln(CAPE)
  const X = pts.map(p => Math.log(p.cape)), Y = pts.map(p => p.f), mx = mean(X), my = mean(Y);
  const b = X.reduce((s, x, i) => s + (x - mx) * (Y[i] - my), 0) / X.reduce((s, x) => s + (x - mx) ** 2, 0), a = my - b * mx;
  const res = Y.map((y, i) => y - (a + b * X[i])), se = std(res), r2 = 1 - res.reduce((s, x) => s + x * x, 0) / Y.reduce((s, y) => s + (y - my) ** 2, 0);
  const capeNow = CA.v[CA.v.length - 1], capeD = CA.d[CA.d.length - 1], impl = a + b * Math.log(capeNow), capeP = XL.pctl(CA.v, capeNow);
  const sim = pts.filter(p => p.cape >= capeNow * .85 && p.cape <= capeNow * 1.15);
  const est = (window.DATA_META && DATA_META.series && DATA_META.series["SIGNALS.CAPE"] && DATA_META.series["SIGNALS.CAPE"].status === "stima");
  // premio al rischio: rendimento degli utili (1/PE) meno tassi a 10 anni
  const peM = new Map(PE.d.map((d, i) => [d, PE.v[i]])), y10 = new Map(YIELDS.DGS10.d.map((d, i) => [d.slice(0, 7), YIELDS.DGS10.v[i]]));
  const tips = window.CURVE && CURVE.DFII10 ? XL.monthly({ d: CURVE.DFII10.d, c: CURVE.DFII10.v }) : null, tipsM = tips ? new Map(tips.d.map((d, i) => [d, tips.c[i]])) : new Map();
  const md = PE.d.filter(d => d >= "1962-01" && y10.has(d)), ey = md.map(d => 100 / peM.get(d)), erpN = md.map((d, i) => ey[i] - y10.get(d)), erpR = md.map((d, i) => tipsM.has(d) ? ey[i] - tipsM.get(d) : null);
  const lastN = erpN[erpN.length - 1], lastR = erpR.filter(x => x != null).slice(-1)[0], pN = XL.pctl(erpN, lastN), pR = XL.pctl(erpR.filter(x => x != null), lastR);
  const [g1, i1] = div("chart tall"), [g2, i2] = div(), [g3, i3] = div("chart tall"), [g4, i4] = div();
  const P = window.PESNAP || {}, peRows = Object.keys(P).filter(k => P[k] && P[k].d).map(k => { const x = P[k], n = x.d.length - 1; return [k, x.name, x.pe[n], x.pb[n], x.dy[n], x.d[n], x.pe.filter(Boolean)]; });
  const spy = peRows.find(r => r[0] === "SPY");
  o.innerHTML = XL.pdfBtn("cx_val", "Valutazioni e premio al rischio", "CAPE, rendimento implicito a 10 anni, premio al rischio azionario, P/E di indici e settori") + `
  <div class="card"><h3>Quanto costa la borsa USA oggi</h3>
   <div class="kpis"><div class="kpi"><span>CAPE (Shiller) ${est ? "stimato" : ""}</span><b>${num(capeNow, 1)}</b><small class="muted">${capeD} · ${XL.pp(capeP)} percentile dal 1881</small></div>
    <div class="kpi"><span>Rendimento reale implicito a 10 anni</span><b>${pct(impl)}</b><small class="muted">intervallo tipico ${pct(impl - se)} / ${pct(impl + se)}</small></div>
    <div class="kpi"><span>Premio al rischio (utili − Treasury 10a)</span><b>${num(lastN)} pp</b><small class="muted">${XL.pp(pN)} percentile dal 1962</small></div>
    <div class="kpi"><span>Premio sui tassi reali (TIPS)</span><b>${lastR != null ? num(lastR) + " pp" : "–"}</b><small class="muted">${isFinite(pR) ? XL.pp(pR) + " percentile dal 2003" : ""}</small></div></div>
   <p class="answer">Con un CAPE di ${num(capeNow, 1)} la storia suggerisce per l'S&amp;P 500 un rendimento <b>reale</b> (sopra l'inflazione, dividendi inclusi) intorno al <b>${pct(impl)} l'anno nei prossimi 10 anni</b>, con un intervallo tipico tra ${pct(impl - se)} e ${pct(impl + se)}. Nei ${sim.length} mesi del passato con CAPE simile (±15%) il rendimento reale a 10 anni è andato da ${pct(Math.min(...sim.map(p => p.f)))} a ${pct(Math.max(...sim.map(p => p.f)))}. Il CAPE dice poco sul prossimo anno ma molto sui prossimi dieci: è un indicatore di aspettative, non di timing.</p>
   ${g1}<p class="note">Ogni punto è un mese dal 1881 al ${pts[pts.length - 1].d}: CAPE di quel mese e rendimento reale annuo dei 10 anni successivi (dati Robert Shiller). Linea = regressione sul logaritmo del CAPE (R² ${num(r2, 2)}, errore tipico ±${pct(se)}). ${est ? "Il CAPE degli ultimi mesi è stimato tenendo fermi gli utili all'ultimo dato pubblicato e aggiornando il prezzo." : ""}</p></div>
  <div class="card"><h3>CAPE nel tempo</h3>${g2}</div>
  <div class="card"><h3>Premio al rischio azionario: conviene più la borsa o il Treasury?</h3>${g3}
   <p class="note">Rendimento degli utili = 1 / (P/E a 12 mesi) dell'S&amp;P 500. Premio nominale = rendimento degli utili meno Treasury 10 anni (il «Fed model»); premio reale = meno il rendimento dei TIPS a 10 anni, più corretto perché gli utili crescono con l'inflazione. Premio basso = le azioni offrono poco più delle obbligazioni: storicamente è un momento per non esagerare con il peso azionario, non per uscire.</p></div>
  <div class="card"><h3>P/E di indici, paesi e settori (ETF)</h3>${g4}
   ${table(["ETF", "P/E", "vs S&P 500", "P/B", "Dividendo", "Dati al", "Giorni di storico"], peRows.sort((x, y) => (y[2] || 0) - (x[2] || 0)).map(r => [`<b>${r[0]}</b> <small class="muted">${r[1]}</small>`, r[2] ? num(r[2], 1) : "–", r[2] && spy && spy[2] ? pc(r[2] / spy[2] - 1, 0) : "–", r[3] ? num(r[3], 1) : "–", r[4] ? pct(r[4] > 1 ? r[4] / 100 : r[4]) : "–", fmtD(r[5]), r[6].length]))}
   <p class="note">P/E trailing degli ETF (fonte Yahoo, aggiornato ogni notte). Gli storici dei P/E di settore non sono disponibili gratuitamente: la piattaforma li accumula da sola un giorno alla volta, quindi il grafico si allunga col passare dei mesi.</p></div>`;
  plot(i1, [{ x: pts.map(p => p.cape), y: pts.map(p => p.f * 100), mode: "markers", name: "Mesi storici", marker: { size: 4, color: pts.map(p => +p.d.slice(0, 4)), colorscale: "Viridis", showscale: false }, text: pts.map(p => p.d), hovertemplate: "%{text}: CAPE %{x:.1f} → %{y:.1f}% l'anno<extra></extra>" },
    { x: [5, 45], y: [5, 45].map(c => (a + b * Math.log(c)) * 100), mode: "lines", name: "Relazione storica", line: { color: C.gold } },
    { x: [capeNow, capeNow], y: [(impl - se) * 100, (impl + se) * 100], mode: "lines", name: "Oggi (intervallo)", line: { color: C.red, width: 6 } }, { x: [capeNow], y: [impl * 100], mode: "markers", name: "Oggi", marker: { color: C.red, size: 13, symbol: "diamond" } }],
    { title: "CAPE di partenza e rendimento reale dei 10 anni successivi", hovermode: "closest", xaxis: { title: { text: "CAPE" }, type: "log", tickvals: [5, 7, 10, 15, 20, 25, 30, 40], ticktext: ["5", "7", "10", "15", "20", "25", "30", "40"] }, yaxis: { title: { text: "Rendimento reale annuo 10 anni" }, ticksuffix: "%" } });
  const avg = mean(CA.v);
  plot(i2, [{ x: CA.d, y: CA.v, name: "CAPE", line: { color: C.gold, width: 1.3 } }, { x: [CA.d[0], CA.d[CA.d.length - 1]], y: [avg, avg], name: "Media storica " + num(avg, 1), line: { color: C.grey, dash: "dot" } }, { x: [CA.d[0], CA.d[CA.d.length - 1]], y: [XL.q(CA.v, .9), XL.q(CA.v, .9)], name: "90° percentile", line: { color: C.red, dash: "dot", width: 1 } }], { title: "CAPE S&P 500 dal 1881", shapes: XL.recShapes("1881-01") });
  plot(i3, [{ x: md, y: ey, name: "Rendimento degli utili", line: { color: C.gold } }, { x: md, y: md.map(d => y10.get(d)), name: "Treasury 10 anni", line: { color: C.blue } }, { x: md, y: erpN, name: "Premio nominale", line: { color: C.green, width: 2 } }, { x: md, y: erpR, name: "Premio reale (vs TIPS)", line: { color: C.red, width: 2 }, connectgaps: false }],
    { title: "Rendimento degli utili S&P 500, tassi e premio al rischio", yaxis: { ticksuffix: "%" }, shapes: XL.recShapes("1962-01") });
  const hist = ["SPY", "QQQ", "URTH", "EZU", "EEM", "XLK", "XLE", "XLF"].filter(k => P[k] && P[k].d.length >= 5);
  if (!hist.length) document.getElementById(i4).outerHTML = `<p class="note">Il grafico dello storico dei P/E comparirà dopo qualche giorno di aggiornamenti: oggi c'è una sola osservazione.</p>`; else plot(i4, hist.map(k => ({ x: P[k].d, y: P[k].pe, name: k, mode: P[k].d.length < 3 ? "markers+lines" : "lines" })), { title: "P/E degli ETF: storico accumulato" });
});
