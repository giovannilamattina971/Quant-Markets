"use strict";
/* ===== v3: collegamento pagine, pulsanti PDF ===== */
const V3R = { timing: renderTiming, pac: renderPac, basi: () => { if (!$("#basiOut").dataset.ok) { $("#basiOut").dataset.ok = 1; renderBasi(); } }, soci: () => { if (!$("#sociOut").dataset.ok) { $("#sociOut").dataset.ok = 1; renderSoci(); } }, infl: renderInfl, crisi: renderCrisi, profilo: renderProfilo, obiettivi: renderObiettivi, decumulo: renderDecumulo };
{ const _s = showTab; showTab = id => { _s(id); try { if (V3R[id]) V3R[id](); if (id === "multi") multiExtras(); if (id === "pres") presPdfBtn(); if (id === "bt") btPdfBtn(); } catch (e) { console.error(e); } window.dispatchEvent(new Event("resize")); }; }
{ const _r = refresh; refresh = function () { _r(); const v = document.querySelector(".tab.on").id; try { if (v === "multi") multiExtras(); if (v === "pres") presPdfBtn(); if (v === "bt") btPdfBtn(); } catch (e) { console.error(e); } }; }
function presPdfBtn() { const tb = $("#presOut .toolbar"); if (!tb || $("#cliPdf")) return; tb.insertAdjacentHTML("afterbegin", `<button id="cliPdf" class="primary pdfbtn">📄 Scarica presentazione cliente</button>`); $("#cliPdf").onclick = e => withBusy(e.target, clientPdf); }
function btPdfBtn() { if ($("#btPdf")) return; $("#bt").insertAdjacentHTML("afterbegin", `<div class="toolbar nopdf"><button id="btPdf" class="primary pdfbtn">📄 Scarica PDF backtest</button></div>`); $("#btPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Backtest su indice", sub: st.S.name + " · " + fmtD(st.S.d[0]) + " – " + fmtD(st.S.d[st.S.n - 1]), file: pdfName("Backtest_indice"), parts: [{ tab: "bt", root: "#bt" }] })); }
// pulsante «Per chi inizia» nelle FAQ
{ const fb = $("#faq"); if (fb) fb.insertAdjacentHTML("afterbegin", `<div class="card nopdf"><b>Per chi inizia:</b> le spiegazioni semplici (azioni, obbligazioni, ETF, diversificazione, interesse composto, inflazione, timing, PAC) sono nella sezione <a href="#" data-go="basi">Educazione → Azioni, obbligazioni &amp; ETF</a>, <a href="#" data-go="timing">Restare sul mercato</a>, <a href="#" data-go="pac">Simulatore PAC</a>.</div>`); document.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); showTab(a.dataset.go); } }); }
// ricalcola i costi quando cambia il simulatore
// Info dati: verifiche v3 (indici MSCI, oro, inflazione euro, correzioni dati)
{ const _ri = renderInfo; renderInfo = function () { _ri(); const V = (window.VERIF && VERIF.assets) || {}; const o = $("#infoOut"); if (!o || $("#v3ver")) return;
  const ka = k => V[k] && V[k].known_annual ? V[k].known_annual.map(([y, p, c]) => [AS[k] ? AS[k].name : k, y, pct(p / 100), pct(c / 100), Math.abs(p - c) <= 0.15 ? '<b class="pos">OK</b>' : '<b class="neg">diff.</b>']) : [];
  const g = V.GOLDWB_vs_GLD || {}, e = V.MSCIEM_vs_EEM || {};
  o.insertAdjacentHTML("beforeend", `<div class="card" id="v3ver"><h3>Verifiche v3: indici MSCI, oro, inflazione euro</h3>
  ${table(["Indice (msci.com)", "Anno", "Rendimento pubblicato", "Calcolato dai livelli", "Esito"], [...ka("MSCIEM"), ...ka("MSCIWD"), ...ka("MSCIEMP"), ...ka("MSCIWDP")])}
  ${table(["Controllo", "Risultato"], [["Oro Banca Mondiale vs ETF GLD (mensile)", `${g.months || "–"} mesi, correlazione ${num(g.monthly_corr, 4)}, rend. annuo ${num(g.ann_ret_wb)}% vs ${num(g.ann_ret_gld)}% (differenza attesa: commissioni ETF e media mensile vs fine mese). Copertura ${g.from || ""} → ${g.to || ""}`],
    ["MSCI EM indice vs ETF EEM (mensile)", `${e.months || "–"} mesi, correlazione ${num(e.monthly_corr, 4)}, rend. annuo ${num(e.ann_ret_index)}% vs ${num(e.ann_ret_eem)}% (l'ETF sconta costi e tracking error)`],
    ["HICP area euro (FRED CP0000EZ19M086NEST)", V.CPI_EA ? `dic-2022 su dic-2021: ${num(V.CPI_EA.dec_dec_2022, 1)}% (Eurostat pubblicato 9,2%) · ${V.CPI_EA.from} → ${V.CPI_EA.to}` : "–"],
    ["CPI Italia (FRED ITACPIALLMINMEI + HICP Italia)", V.CPI_IT ? `dic-2022 su dic-2021: ${num(V.CPI_IT.dec_dec_2022, 1)}% (ISTAT NIC pubblicato 11,6%) · ${V.CPI_IT.from} → ${V.CPI_IT.to}` : "–"],
    ["ETF VWRL.AS", "Yahoo riporta un salto di livello spurio (-24,5% il 04/06/2013, non avvenuto sul mercato): la serie è usata dal 14/06/2013. Filtro automatico per spike isolati (>12% annullati il giorno dopo) su tutti gli ETF."],
    ["MSCI World: composizione", "1.249 titoli, 23 Paesi sviluppati, ~85% della capitalizzazione flottante (factsheet MSCI al 30/09/2026)."]])}
  <p class="note">MSCI: livelli ufficiali di fine mese dall'endpoint pubblico app2.msci.com (Net Total Return dal 29/12/2000, prezzo dal 31/01/1997; storie precedenti non scaricabili gratuitamente). Oro: World Bank Commodity Price Data (Pink Sheet), media mensile in $/oncia. Nessun fondo comune è usato come proxy di indici.</p></div>`); }; }
// Info dati: rendimenti per anno solare degli ETF confrontati con le fonti ufficiali (justETF / iShares) + YTD 2026
{ const _ri2 = renderInfo; renderInfo = function () { _ri2(); const o = $("#infoOut"); if (!o || $("#offver") || !window.OFFICIAL) return;
  const rows = []; let mx = 0;
  for (const [t, v] of Object.entries(OFFICIAL)) { const a = AS[t]; if (!a) continue; const ye = new Map(); a.d.forEach((d, i) => ye.set(d.slice(0, 4), a.c[i]));
    const off = Object.assign({}, v.series_annual || {}, v.ret || {});
    for (let y = 2015; y <= 2025; y++) { const k = String(y); if (!(k in off) || !ye.has(String(y - 1)) || a.d[0].slice(0, 4) >= k) continue;
      const app = (ye.get(k) / ye.get(String(y - 1)) - 1) * 100, d = app - off[k]; mx = Math.max(mx, Math.abs(d));
      rows.push([`${a.name}`, k, num(off[k]) + "%", num(app) + "%", num(d) + " pt", Math.abs(d) <= 0.1 ? '<b class="pos">OK</b>' : '<b class="neg">diff.</b>']); }
    if (v.ytd2026 && v.ytd2026.pct != null) rows.push([`${a.name}`, `YTD 2026 al ${v.ytd2026.asof}`, num(v.ytd2026.pct) + "%", "–", "–", "solo informativo (anno in corso)"]); }
  o.insertAdjacentHTML("beforeend", `<div class="card" id="offver"><h3>Verifica rendimenti annuali ETF vs fonti ufficiali (valuta dello strumento)</h3>
  ${table(["Strumento", "Anno", "Ufficiale", "App", "Differenza", "Esito"], rows)}
  <p class="note">Fonti: justETF (rendimenti per anno solare e serie con distribuzioni reinvestite, ETF UCITS in EUR) e pagine prodotto iShares USA (rendimento NAV per anno solare). Le serie giornaliere Yahoo sono calibrate anno per anno, con una deriva costante distribuita sui giorni di borsa, in modo che ogni anno solare fino al 2025 coincida con il dato ufficiale (scarto massimo ${num(mx)} pt). Il 2026 è parziale (YTD) ed è riportato con la data di riferimento. ETF obbligazionari euro (solo iShares): 1-3 anni Acc IE00B3VTMJ91; 3-5 anni IBGX IE00B1FZS681, classe a distribuzione con cedole reinvestite perché iShares non offre una classe Acc 3-5 anni; 7-10 anni Acc IE00B3VTN290.</p></div>`); };
}
// Info dati: inflazione media annua 2000-2025, serie dell'app vs dati ufficiali
{ const _ri3 = renderInfo; renderInfo = function () { _ri3(); const o = $("#infoOut"); if (!o || $("#inflver")) return;
  const NIC = [2.5, 2.8, 2.5, 2.7, 2.2, 2.0, 2.1, 1.8, 3.3, 0.8, 1.5, 2.8, 3.0, 1.2, 0.2, 0.0, -0.1, 1.2, 1.1, 0.6, -0.1, 1.9, 8.2, 5.6, 1.0, 1.5]; // ISTAT NIC, var. media annua
  const HEA = [2.1, 2.3, 2.3, 2.1, 2.1, 2.2, 2.2, 2.1, 3.3, 0.3, 1.6, 2.7, 2.5, 1.4, 0.4, 0.2, 0.2, 1.5, 1.8, 1.2, 0.3, 2.6, 8.4, 5.4, 2.4, 2.1]; // Eurostat prc_hicp_aind EA
  const avg = (S, y) => { const v = S.d.map((d, i) => [d, S.c[i]]).filter(([d]) => d.startsWith(String(y))).map(x => x[1]); return v.length === 12 ? v.reduce((a, b) => a + b, 0) / 12 : NaN; };
  const ar = (S, y) => (avg(S, y) / avg(S, y - 1) - 1) * 100; const rows = [];
  for (let y = 2000; y <= 2025; y++) { const a = AS.CPI_IT ? ar(AS.CPI_IT, y) : NaN, b = AS.CPI_EA ? ar(AS.CPI_EA, y) : NaN, i = y - 2000;
    rows.push([y, num(NIC[i], 1) + "%", num(a, 1) + "%", num(a - NIC[i], 1), num(HEA[i], 1) + "%", num(b, 1) + "%", num(b - HEA[i], 1)]); }
  o.insertAdjacentHTML("beforeend", `<div class="card" id="inflver"><h3>Inflazione media annua 2000-2025: serie usate dall'app vs dati ufficiali</h3>
  ${table(["Anno", "Italia NIC (ISTAT)", "App (CPI Italia)", "Diff.", "Area euro HICP (Eurostat)", "App (HICP EA)", "Diff."], rows)}
  <p class="note">Ufficiali: ISTAT, indice NIC, variazione media annua (comunicato «Prezzi al consumo – dicembre 2025» e serie storica); Eurostat prc_hicp_aind, HICP area euro, variazione media annua. App: media dei 12 indici mensili su media dell'anno precedente, dalle serie FRED ITACPIALLMINMEI (Italia, da aprile 2025 concatenata con l'IPCA Italia) e CP0000EZ19M086NEST (area euro). Il benchmark «Contante sotto il materasso» usa a scelta l'una o l'altra (default: Italia).</p></div>`); };
}
