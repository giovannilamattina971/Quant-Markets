"use strict";
/* ===== v3: generatore PDF brandizzato (jsPDF + Plotly.toImage), funziona offline anche da file:// ===== */
const BRAND = "Giovanni La Mattina – Consulente Finanziario";
const pdfTxt = s => String(s == null ? "" : s).replace(/[→⟶]/g, "->").replace(/≈/g, "~").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[⚠★✓✔➕⬇🖨📄]/gu, "").replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/−/g, "-").replace(/×/g, "x").replace(/\u00a0|\u202f/g, " ").replace(/[^\x00-\xff€–—•…]/g, "").replace(/[ \t]+/g, " ").trim();
const SOURCES_TXT = "Fonti dati: Yahoo Finance (indici S&P 500, Dow Jones, Nasdaq, Russell, VIX, S&P 500 Total Return; ETF iShares/Vanguard/Amundi/Xtrackers, prezzi rettificati per distribuzioni); MSCI Inc. (indici MSCI World ed Emerging Markets, livelli ufficiali di fine mese da msci.com, Net Total Return dal 2001, prezzo dal 1997); FRED – Federal Reserve Bank of St. Louis (CPI USA CPIAUCNS, cambio EUR/USD DEXUSEU, tassi Fed, T-Bill, rendimenti Treasury, BTP OCSE, HICP area euro e CPI Italia); Banca Mondiale (prezzo oro, Pink Sheet). Obbligazioni Treasury/BTP a scadenza costante ricostruite dai rendimenti (metodologia in 'Info dati').";
const DISCL_TXT = "Avvertenza. Documento a scopo esclusivamente informativo ed educativo, basato su dati storici. Non costituisce consulenza finanziaria personalizzata, raccomandazione o sollecitazione all'investimento. I rendimenti passati non sono indicativi né garanzia di quelli futuri. Le simulazioni non includono costi, commissioni, imposte e, per gli indici di prezzo, i dividendi; gli indici non sono direttamente investibili. Il valore degli investimenti può diminuire e si può perdere parte del capitale.";
function lightFig(gd) {
  const fig = JSON.parse(JSON.stringify({ data: gd.data, layout: gd.layout }));
  let s = JSON.stringify(fig);
  [C.text, "#fff", "#ffffff", "#e8e8e8", "#eee", "#ddd"].forEach(c => { s = s.split(`"${c}"`).join('"#1d1d22"'); });
  s = s.split(`"${C.grid}"`).join('"#dddddd"'); s = s.split('"#1b1b21"').join('"#f3f3f3"'); s = s.split('"#2a2a32"').join('"#e6e0cc"');
  const f = JSON.parse(s); Object.keys(f.layout).filter(k => /^[xy]axis/.test(k)).forEach(k => { if (f.layout[k] && f.layout[k].type === "log") { f.layout[k].dtick = 0.30103; f.layout[k].tickformat = ",.0f"; } }); if (f.layout.showlegend !== false) { f.layout.legend = Object.assign({}, f.layout.legend, { orientation: "h", x: 0, xanchor: "left", y: -0.12, yanchor: "top" }); f.layout.margin = Object.assign({}, f.layout.margin, { b: 110, t: 50 }); }
  Object.assign(f.layout, { paper_bgcolor: "#ffffff", plot_bgcolor: "#ffffff", font: Object.assign({}, f.layout.font, { color: "#1d1d22", size: 13 }), width: 1100, height: 520 });
  return f;
}
async function chartPng(gd) { const f = lightFig(gd); return Plotly.toImage({ data: f.data, layout: f.layout }, { format: "png", width: 1100, height: 520 }); }
function newDoc() { const { jsPDF } = window.jspdf; return new jsPDF({ unit: "mm", format: "a4", compress: true }); }
function pdfCover(doc, title, sub) {
  const INK = [19, 35, 58], LAG = [18, 124, 134], SL = [94, 110, 130];
  if (window.__pdfCoverImg) doc.addImage(window.__pdfCoverImg, "JPEG", 0, 0, 210, 297);
  else { doc.setFillColor(244, 246, 249); doc.rect(0, 0, 210, 297, "F"); doc.setFillColor(...INK); doc.roundedRect(20, 24, 14, 14, 3, 3, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("GLM", 27, 32.4, { align: "center" }); doc.setTextColor(...INK); doc.setFontSize(11); doc.text("Quant Markets", 38, 32.6); }
  // area testo nella metà inferiore
  doc.setFillColor(255, 255, 255); doc.roundedRect(16, 168, 178, 96, 4, 4, "F");
  doc.setFillColor(...LAG); doc.rect(24, 178, 24, 1.2, "F");
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(24); const T = doc.splitTextToSize(pdfTxt(title), 160); doc.text(T, 24, 192);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11.5); doc.setTextColor(...SL); doc.text(doc.splitTextToSize(pdfTxt(sub || ""), 160), 24, 194 + T.length * 9);
  doc.setFontSize(9.5); doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.text(pdfTxt(BRAND), 24, 250);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...SL); doc.text("Data: " + new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) + "   ·   Documento informativo, non costituisce consulenza personalizzata", 24, 256);
}
// copertina disegnata in Canva (assets/pdf_cover.jpg): caricata una volta come immagine
(function loadCover() { try { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); window.__pdfCoverImg = c.toDataURL("image/jpeg", .9); }; im.src = "assets/pdf_cover.jpg"; } catch (e) { /* si usa la copertina disegnata dal programma */ } })();
function pdfWriter(doc, title) {
  const W = 210, M = 15, TOP = 22, BOT = 282; let y = TOP, page = 1;
  const header = () => { doc.setFillColor(19, 35, 58); doc.roundedRect(M, 5.2, 6, 6, 1.2, 1.2, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(4.2); doc.setTextColor(255, 255, 255); doc.text("GLM", M + 3, 8.9, { align: "center" }); doc.setFillColor(18, 124, 134); doc.rect(M, 14, W - 2 * M, .35, "F");
    doc.setFontSize(8); doc.setTextColor(19, 35, 58); doc.text(pdfTxt(BRAND), M + 8, 9.3); doc.setTextColor(94, 110, 130); doc.setFont("helvetica", "normal"); doc.text(pdfTxt(title), W - M, 9.3, { align: "right" });
    doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.text("Pag. " + (++page), W - M, 290, { align: "right" }); doc.text("Dati storici, non previsioni. Vedi avvertenze finali.", M, 290); };
  const add = () => { doc.addPage(); header(); y = TOP; };
  const need = h => { if (y + h > BOT) add(); };
  add();
  const w = {
    h(t, lvl = 2) { need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(lvl === 2 ? 15 : 12); doc.setTextColor(19, 35, 58); const L = doc.splitTextToSize(pdfTxt(t), W - 2 * M); doc.text(L, M, y + 5); y += L.length * (lvl === 2 ? 6.5 : 5.2) + 2; doc.setFillColor(18, 124, 134); doc.rect(M, y - 1, lvl === 2 ? 22 : 10, .6, "F"); y += 3; },
    p(t, o = {}) { t = pdfTxt(t); if (!t) return; doc.setFont("helvetica", o.bold ? "bold" : "normal"); doc.setFontSize(o.size || 9.5); doc.setTextColor(...(o.color || [40, 40, 45])); const L = doc.splitTextToSize(t, W - 2 * M - (o.box ? 6 : 0)); const h = L.length * (o.size || 9.5) * .42 + 2;
      if (o.box) { need(h + 4); doc.setFillColor(242, 248, 248); doc.roundedRect(M, y - 1, W - 2 * M, h + 3, 1.5, 1.5, "F"); doc.setFillColor(18, 124, 134); doc.rect(M, y - 1, 1, h + 3, "F"); doc.text(L, M + 4, y + 3.2); y += h + 5; }
      else { for (const line of L) { need(5); doc.text(line, M, y + 3.2); y += (o.size || 9.5) * .42; } y += 2.5; } },
    kpis(items) { if (!items.length) return; const n = Math.min(4, items.length), cw = (W - 2 * M - (n - 1) * 3) / n; for (let i = 0; i < items.length; i += n) { need(19); items.slice(i, i + n).forEach(([a, b], k) => { const x = M + k * (cw + 3); doc.setFillColor(244, 246, 249); doc.roundedRect(x, y, cw, 16, 1.5, 1.5, "F"); doc.setFontSize(7); doc.setTextColor(110, 110, 115); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(pdfTxt(a), cw - 4)[0], x + 3, y + 5); doc.setFontSize(12.5); doc.setFont("helvetica", "bold"); doc.setTextColor(19, 35, 58); doc.text(pdfTxt(b), x + 3, y + 12.5); }); y += 19; } },
    table(rows, o = {}) { if (!rows.length) return; const nc = Math.max(...rows.map(r => r.length)); const fs = nc > 10 ? 5.8 : nc > 7 ? 6.8 : 7.8; const avail = W - 2 * M; const first = nc > 7 ? 38 : nc > 3 ? Math.min(52, avail * 0.3) : avail / nc; const cw = nc > 1 ? (avail - first) / (nc - 1) : avail;
      const draw = (r, hdr, ri) => { doc.setFontSize(hdr ? fs - 0.6 : fs); doc.setFont("helvetica", hdr ? "bold" : "normal"); const cells = r.map((c, j) => doc.splitTextToSize(pdfTxt(c.t), (j ? cw : first) - 2)); const h = Math.max(...cells.map(c => c.length)) * fs * .4 + 2.4; need(h);
        if (hdr) { doc.setFillColor(19, 35, 58); doc.rect(M, y, avail, h, "F"); } else if (ri % 2) { doc.setFillColor(246, 248, 250); doc.rect(M, y, avail, h, "F"); }
        r.forEach((c, j) => { const x = M + (j ? first + (j - 1) * cw : 0); if (c.bg && !hdr) { doc.setFillColor(...c.bg); doc.rect(x, y, j ? cw : first, h, "F"); } doc.setTextColor(...(hdr ? [255, 255, 255] : c.col || [19, 35, 58])); doc.text(cells[j], x + 1, y + fs * .4 + .6); });
        y += h; return h; };
      draw(rows[0], true, 0); rows.slice(1).forEach((r, i) => { if (y + 6 > BOT) { add(); draw(rows[0], true, 0); } draw(r, false, i); }); y += 4; },
    async chart(gd, cap) { const img = await chartPng(gd); const h = (W - 2 * M) * 520 / 1100; need(h + 4); doc.addImage(img, "PNG", M, y, W - 2 * M, h); y += h + 2; if (cap) w.p(cap, { size: 7.5, color: [110, 110, 110] }); },
    gap(h = 4) { y += h; }, add, get y() { return y; }
  };
  return w;
}
const rgbaFill = st => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(st || ""); if (!m) return null; const a = m[4] == null ? 1 : +m[4]; return [0, 1, 2].map(i => Math.round(255 - (255 - +m[i + 1]) * a * .8)); };
function tableRows(tb) { return [...tb.querySelectorAll("tr")].map(tr => [...tr.children].map(td => { const cl = td.querySelector(".pos") ? [20, 120, 60] : td.querySelector(".neg") ? [180, 40, 40] : null; return { t: td.innerText, bg: rgbaFill(td.style.background || td.style.backgroundColor), col: cl }; })); }
// percorre una sezione del DOM e la riporta nel PDF nell'ordine
async function pdfSection(w, root) {
  if (!root) return;
  const sel = "h2,h3,.answer,p.note,p.warn,p.lead,table,.js-plotly-plot,.kpis,.cards";
  const els = [...root.querySelectorAll(sel)].filter(el => { let p = el.parentElement; while (p && p !== root) { if (p.matches && p.matches(sel)) return false; p = p.parentElement; } return el.offsetParent !== null || el.closest(".tab"); });
  for (const el of els) {
    if (el.closest(".nopdf")) continue;
    if (el.matches(".pdfbreak")) w.add();
    if (el.matches("h2")) w.h(el.innerText, 2); else if (el.matches("h3")) w.h(el.innerText, 3);
    else if (el.matches(".answer")) w.p(el.innerText, { box: true });
    else if (el.matches("p")) w.p(el.innerText, { size: 7.8, color: el.matches(".warn") ? [170, 90, 0] : [100, 100, 105] });
    else if (el.matches("table")) { const rows = tableRows(el), cap = el.matches(".full") ? 80 : 26; if (rows.length > cap + 1) { w.table(rows.slice(0, cap + 1)); w.p(`Tabella abbreviata alle prime ${cap} righe su ${rows.length - 1}: versione completa nella piattaforma.`, { size: 7, color: [120, 120, 120] }); } else w.table(rows); }
    else if (el.matches(".kpis,.cards")) w.kpis([...el.querySelectorAll(".kpi")].map(k => [k.querySelector("span") ? k.querySelector("span").innerText : "", k.querySelector("b") ? k.querySelector("b").innerText : ""]));
    else if (el.matches(".js-plotly-plot") && el.data && el.data.length) await w.chart(el);
  }
}
function pdfEnd(w) { w.add(); w.h("Avvertenze e fonti dei dati", 2); w.p(DISCL_TXT, { box: true }); w.p(SOURCES_TXT, { size: 8.5 }); w.p("Verifiche: livelli MSCI confrontati con i rendimenti annuali pubblicati (es. MSCI EM 2008 -53,3%, 2017 +37,3% Net USD; MSCI World 2008 -40,7%); inflazione confrontata con i dati ufficiali (HICP area euro dic-2022 +9,2%, CPI Italia dic-2022 +11,6%). Dettagli nella sezione 'Info dati' della piattaforma.", { size: 8.5 }); w.p(BRAND, { bold: true, size: 10, color: [19, 35, 58] }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function makePdf({ title, sub, file, parts }) {
  const back = document.querySelector(".tab.on").id; const doc = newDoc(); pdfCover(doc, title, sub); const w = pdfWriter(doc, title);
  for (const pt of parts) { if (window.__pdfDbg) console.error("part", pt.tab || "", String(pt.root).slice(0, 60)); if (pt.tab && document.querySelector(".tab.on").id !== pt.tab) { showTab(pt.tab); await sleep(pt.wait || 400); } if (pt.before) await pt.before(); if (pt.newPage) w.add(); if (pt.title) w.h(pt.title, 2); if (pt.text) w.p(pt.text, { box: true }); const rt = typeof pt.root === "function" ? pt.root() : typeof pt.root === "string" ? document.querySelector(pt.root) : pt.root; await pdfSection(w, rt); }
  pdfEnd(w); doc.save(file); if (back && back !== document.querySelector(".tab.on").id) showTab(back); return file;
}
async function withBusy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = "Generazione PDF in corso…"; try { await fn(); } catch (e) { console.error(e); alert("Errore nella generazione del PDF: " + e.message); } finally { btn.disabled = false; btn.textContent = t; } }
const pdfName = s => s + "_" + new Date().toISOString().slice(0, 10) + ".pdf";
