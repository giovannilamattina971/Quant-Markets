"use strict";
/* ===== Titoli di Stato europei & BTP (sezione dedicata; i rendimenti FRED erano nel Laboratorio) ===== */
const BOND_IDS = ["IBGS", "IBGX", "IBGM", "BTP1", "BTP2", "BTP3", "BTP5", "BTP10Y", "BTP13Y", "BTP", "AGGH", "XEON"];
const BOND_DEF = ["IBGS", "IBGM", "BTP13Y", "BTP10Y"];
function renderBond() {
  const Yd = window.YIELDS || {}, R = Yd._rates || {}, [y1, yi1] = div("chart tall"), [s1, si1] = div(), [g1, gi1] = div("chart tall"), [sb1, sbi1] = div("chart tall"), [cv1, cvi1] = div();
  const YO = l => `<option value="">${l}</option>` + Array.from({ length: 2026 - 1971 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}">${y}</option>`).join("");
  $("#bondOut").innerHTML = `<div class="card"><h3>Titoli di Stato europei e BTP: quanto rendono e come si sono comportati</h3>
   <p class="muted">Il rendimento di un titolo di Stato (BTP italiano, Bund tedesco) è l'interesse annuo che si incassa comprandolo oggi e tenendolo fino a scadenza. Quando i rendimenti salgono, i prezzi dei titoli già in circolazione scendono (e viceversa): più lunga è la scadenza, più forte è l'effetto.</p></div>
  <div class="card"><h3>Rendimenti dei titoli di Stato (FRED)</h3>${y1}<p class="note">BTP: rendimento a lungo termine Italia (OCSE, media mensile, FRED IRLTLT01ITM156N). DGS10/DGS2: Treasury USA a scadenza costante (fine mese). TB3MS: T-Bill 3 mesi. Tasso BCE sui depositi: FRED ECBDFR.</p>
</div>
  <div class="card"><h3>Spread BTP – Bund 10 anni</h3><p class="muted">Lo spread è quanto rende in più un BTP rispetto al titolo tedesco di pari durata: misura quanto il mercato considera più rischioso prestare all'Italia che alla Germania. 1 punto = 100 punti base.</p><div id="spTxt"></div>${sb1}
   <p class="note">BTP e Bund 10 anni: rendimenti a lungo termine OCSE, media mensile (FRED IRLTLT01ITM156N e IRLTLT01DEM156N; coincidono con le serie BCE «convergence» in media entro 0,005 punti). Linea sottile: spread BTP – Treasury USA 10 anni (FRED DGS10, fine mese).</p></div>
  <div class="card"><h3>Bund: curva 2 – 5 – 10 anni (Bundesbank)</h3>${cv1}<p class="note">Bundesbank, struttura a termine dei titoli federali quotati (metodo Svensson), dati mensili, serie BBSIS …R02XX/R05XX/R10XX. È una stima della curva a fine mese: differisce dalla media mensile OCSE in media di 0,18 punti (audit in audit_bund.csv).</p></div>
  <div class="card"><h3>Governativi euro e BTP a confronto (rendimento totale in EUR)</h3>
   <div class="form"><label>Dall'anno <select id="bdY0">${YO("Primo disponibile")}</select></label><label>All'anno <select id="bdY1">${YO("Ultimo disponibile")}</select></label></div>
   ${btpCtl()}
   <div class="checks">${BOND_IDS.filter(id => UNI[id]).map(id => `<label><input type="checkbox" class="bdk" value="${id}" ${BOND_DEF.includes(id) ? "checked" : ""}> ${UNI[id].n} <small class="muted">· dal ${startY(id) || "–"}</small></label>`).join("")}</div>
   <div id="bdTxt"></div>${g1}<div id="bdTab"></div>
   <p class="note">Crescita di 100 con cedole reinvestite (BTP calcolati dai rendimenti: vedi «Metodo», «Cedole», «Tasse»). Periodo comune agli strumenti selezionati. Nessun costo.</p></div>`;
  const lab = { IRLTLT01ITM156N: ["BTP 10 anni (Italia)", C.gold, 2.2], DGS10: ["Treasury USA 10 anni", C.blue, 1.2], DGS2: ["Treasury USA 2 anni", "#7a9cc6", 1], TB3MS: ["T-Bill 3 mesi", "#888", 1] };
  const tr = Object.keys(lab).filter(k => Yd[k]).map(k => ({ x: Yd[k].d, y: Yd[k].v, name: lab[k][0], type: "scatter", line: { width: lab[k][2], color: lab[k][1] }, hovertemplate: "%{y:.2f}%" }));
  const BU = window.BUND || {};
  if (BU.DE10_OECD) tr.splice(1, 0, { x: BU.DE10_OECD.d, y: BU.DE10_OECD.v, name: "Bund 10 anni (Germania)", type: "scatter", line: { width: 2, color: "#e07b39" }, hovertemplate: "%{y:.2f}%" });
  if (R.ECBDFR) tr.push({ x: R.ECBDFR.d, y: R.ECBDFR.v, name: "Tasso BCE sui depositi", type: "scatter", line: { width: 1.2, color: C.green, shape: "hv" }, hovertemplate: "%{y:.2f}%" });
  plot(yi1, tr, { yaxis: { ticksuffix: "%" }, title: T("Rendimenti a fine mese") });
  const mk = S => new Map(S.d.map((d, i) => [d.slice(0, 7), S.v[i]])), IT = Yd.IRLTLT01ITM156N;
  if (IT && BU.DE10_OECD) { const de = mk(BU.DE10_OECD), us = Yd.DGS10 ? mk(Yd.DGS10) : new Map(), x = [], y = [], y2 = [];
    IT.d.forEach((d, i) => { const k = d.slice(0, 7), v = de.get(k); if (v != null) { x.push(d); y.push(IT.v[i] - v); y2.push(us.has(k) ? IT.v[i] - us.get(k) : null); } });
    const last = y.length - 1, mx = y.indexOf(Math.max(...y)), bp = v => Math.round(v * 100) + " punti base";
    $("#spTxt").innerHTML = `<div class="answer">Ultimo dato (${fmtD(x[last])}): <b>${bp(y[last])}</b> (BTP ${num(IT.v[IT.d.indexOf(x[last])])}% – Bund ${num(de.get(x[last].slice(0, 7)))}%). Massimo dal 1999: ${bp(Math.max(...y.filter((_, i) => x[i] >= "1999")))} (${fmtD(x[y.indexOf(Math.max(...y.filter((_, i) => x[i] >= "1999")))])}, crisi dei debiti sovrani). Prima dell'euro lo spread rifletteva anche il rischio di cambio lira/marco.</div>`;
    plot(sbi1, [{ x, y, name: "Spread BTP – Bund 10a", type: "scatter", fill: "tozeroy", line: { color: C.gold, width: 1.8 }, fillcolor: "rgba(201,165,76,.15)", hovertemplate: "%{x|%b %Y}: %{y:.2f} p.p.<extra></extra>" },
      { x, y: y2, name: "Spread BTP – Treasury USA 10a", type: "scatter", line: { color: C.blue, width: 1, dash: "dot" }, hovertemplate: "%{y:.2f} p.p.<extra></extra>" }], { title: T("Spread BTP – Bund 10 anni (punti percentuali)"), yaxis: { ticksuffix: " p.p." }, hoverlabel: { bgcolor: "#000", font: { size: 15 } } }); }
  if (BU.DE10_BBK) plot(cvi1, [["DE2_BBK", "Bund 2 anni", C.blue], ["DE5_BBK", "Bund 5 anni", C.green], ["DE10_BBK", "Bund 10 anni", "#e07b39"]].filter(([k]) => BU[k]).map(([k, n, c]) => ({ x: BU[k].d, y: BU[k].v, name: n, type: "scatter", line: { color: c, width: 1.4 }, hovertemplate: "%{y:.2f}%" })), { title: T("Rendimenti Bund per scadenza (Bundesbank)"), yaxis: { ticksuffix: "%" } });
  const fmtM = k => { const [a, b] = k.split("-").map(Number); return new Date(Date.UTC(a, b - 1, 1)).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }); };
  const run = () => {
    const sel = [...document.querySelectorAll(".bdk:checked")].map(x => x.value); if (!sel.length) { $("#bdTxt").innerHTML = `<p class="warn">Seleziona almeno uno strumento.</p>`; Plotly.purge(gi1); $("#bdTab").innerHTML = ""; return; }
    const a = $("#bdY0").value, b = $("#bdY1").value; if (a && b && +b < +a) { $("#bdTxt").innerHTML = `<p class="warn">L'anno finale è precedente a quello iniziale.</p>`; return; }
    const M = monthlyRets(sel, "EUR", a ? `${+a - 1}-12-01` : "1900-01-01", b ? `${b}-12-31` : "2999-12-31");
    if (M.months.length < 12) { $("#bdTxt").innerHTML = `<p class="warn">Storia comune insufficiente nel periodo scelto (${M.months.length} mesi). ${sel.map(id => `${UNI[id].n.replace(/ \(.*\)/, "")} dal ${startY(id) || "–"}`).join(", ")}.</p>`; Plotly.purge(gi1); $("#bdTab").innerHTML = ""; return; }
    const f = M.months[0], l = M.months[M.months.length - 1];
    $("#bdTxt").innerHTML = a && f > `${a}-01` ? `<p class="warn">⚠️ Hai chiesto dal ${a}, ma i dati comuni partono da <b>${fmtM(f)}</b> (${sel.map(id => `${UNI[id].n.replace(/ \(.*\)/, "")} dal ${startY(id) || "–"}`).join(", ")}).</p>` : `<p class="note">Periodo analizzato: <b>${fmtM(f)} → ${fmtM(l)}</b> (${M.months.length} mesi).</p>`;
    const rf = cashRets(M.months, "EUR"), xs = [M.start, ...M.months], S = M.R.map(r => pstats(r, rf)), PAL = [C.gold, C.blue, C.green, C.red, "#b08bd9", "#e07b39", "#5fb3b3", "#d4a5a5", "#8fbf6f", "#7a9cc6", "#bbb", "#c08bc0"];
    plot(gi1, sel.map((id, i) => ({ x: xs, y: S[i].eq.map(v => v * 100), name: UNI[id].n.replace(/ \(.*\)/, ""), type: "scatter", line: { color: PAL[i % PAL.length], width: 1.6 } })), { title: T("Crescita di 100 (rendimento totale, EUR)"), yaxis: { type: "log" } });
    $("#bdTab").innerHTML = table(["Strumento", "Rend. annuo (CAGR)", "Volatilità", "Calo massimo", "Peggior anno solare", "Recupero più lungo (mesi)"], sel.map((id, i) => { const A = {}; M.R[i].forEach((r, t) => { const y = M.months[t].slice(0, 4); A[y] = (A[y] || 1) * (1 + r); }); const full = Object.keys(A).filter(y => M.months.filter(m => m.startsWith(y)).length === 12);
      return [UNI[id].n, pc(S[i].cagr, 2), pct(S[i].vol), pc(S[i].md), full.length ? pc(Math.min(...full.map(y => A[y] - 1))) : "–", num(S[i].rec, 0)]; }));
  };
  document.querySelectorAll(".bdk").forEach(x => x.onchange = run); ["#bdY0", "#bdY1"].forEach(s => $(s).onchange = run);
  $("#bondOut").addEventListener("change", e => { if (e.target.dataset && e.target.dataset.btp) run(); });
  run();
}
{ const _sb = showTab; showTab = id => { _sb(id); if (id === "bond") renderBond(); }; }
