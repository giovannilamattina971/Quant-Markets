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
  doc.setFillColor(15, 15, 18); doc.rect(0, 0, 210, 297, "F"); doc.setFillColor(201, 165, 76); doc.rect(20, 92, 40, 1.2, "F");
  doc.setTextColor(201, 165, 76); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(pdfTxt(BRAND).toUpperCase(), 20, 80);
  doc.setTextColor(255, 255, 255); doc.setFontSize(26); doc.text(doc.splitTextToSize(pdfTxt(title), 170), 20, 110);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(200, 200, 200); doc.text(doc.splitTextToSize(pdfTxt(sub || ""), 170), 20, 135);
  doc.setFontSize(10); doc.setTextColor(150, 150, 150); doc.text("Data: " + new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }), 20, 270);
  doc.text("Documento informativo – non costituisce consulenza personalizzata", 20, 276);
}
function pdfWriter(doc, title) {
  const W = 210, M = 15, TOP = 22, BOT = 282; let y = TOP, page = 1;
  const header = () => { doc.setFillColor(15, 15, 18); doc.rect(0, 0, W, 12, "F"); doc.setFillColor(201, 165, 76); doc.rect(0, 12, W, .6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(201, 165, 76); doc.text(pdfTxt(BRAND), M, 7.8); doc.setTextColor(220, 220, 220); doc.setFont("helvetica", "normal"); doc.text(pdfTxt(title), W - M, 7.8, { align: "right" });
    doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.text("Pag. " + (++page), W - M, 290, { align: "right" }); doc.text("Dati storici, non previsioni. Vedi avvertenze finali.", M, 290); };
  const add = () => { doc.addPage(); header(); y = TOP; };
  const need = h => { if (y + h > BOT) add(); };
  add();
  const w = {
    h(t, lvl = 2) { need(14); doc.setFont("helvetica", "bold"); doc.setFontSize(lvl === 2 ? 15 : 12); doc.setTextColor(30, 30, 34); const L = doc.splitTextToSize(pdfTxt(t), W - 2 * M); doc.text(L, M, y + 5); y += L.length * (lvl === 2 ? 6.5 : 5.2) + 2; doc.setFillColor(201, 165, 76); doc.rect(M, y - 1, lvl === 2 ? 30 : 14, .5, "F"); y += 3; },
    p(t, o = {}) { t = pdfTxt(t); if (!t) return; doc.setFont("helvetica", o.bold ? "bold" : "normal"); doc.setFontSize(o.size || 9.5); doc.setTextColor(...(o.color || [40, 40, 45])); const L = doc.splitTextToSize(t, W - 2 * M - (o.box ? 6 : 0)); const h = L.length * (o.size || 9.5) * .42 + 2;
      if (o.box) { need(h + 4); doc.setFillColor(248, 245, 236); doc.rect(M, y - 1, W - 2 * M, h + 3, "F"); doc.setFillColor(201, 165, 76); doc.rect(M, y - 1, 1, h + 3, "F"); doc.text(L, M + 4, y + 3.2); y += h + 5; }
      else { for (const line of L) { need(5); doc.text(line, M, y + 3.2); y += (o.size || 9.5) * .42; } y += 2.5; } },
    kpis(items) { if (!items.length) return; const n = Math.min(4, items.length), cw = (W - 2 * M - (n - 1) * 3) / n; for (let i = 0; i < items.length; i += n) { need(19); items.slice(i, i + n).forEach(([a, b], k) => { const x = M + k * (cw + 3); doc.setFillColor(246, 246, 248); doc.rect(x, y, cw, 16, "F"); doc.setFillColor(201, 165, 76); doc.rect(x, y, .9, 16, "F"); doc.setFontSize(7); doc.setTextColor(110, 110, 115); doc.setFont("helvetica", "normal"); doc.text(doc.splitTextToSize(pdfTxt(a).toUpperCase(), cw - 4)[0], x + 3, y + 5); doc.setFontSize(12.5); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 25, 30); doc.text(pdfTxt(b), x + 3, y + 12.5); }); y += 19; } },
    table(rows, o = {}) { if (!rows.length) return; const nc = Math.max(...rows.map(r => r.length)); const fs = nc > 10 ? 5.8 : nc > 7 ? 6.8 : 7.8; const avail = W - 2 * M; const first = nc > 7 ? 38 : nc > 3 ? Math.min(52, avail * 0.3) : avail / nc; const cw = nc > 1 ? (avail - first) / (nc - 1) : avail;
      const draw = (r, hdr, ri) => { doc.setFontSize(hdr ? fs - 0.6 : fs); doc.setFont("helvetica", hdr ? "bold" : "normal"); const cells = r.map((c, j) => doc.splitTextToSize(pdfTxt(c.t), (j ? cw : first) - 2)); const h = Math.max(...cells.map(c => c.length)) * fs * .4 + 2.4; need(h);
        if (hdr) { doc.setFillColor(28, 28, 33); doc.rect(M, y, avail, h, "F"); } else if (ri % 2) { doc.setFillColor(248, 248, 250); doc.rect(M, y, avail, h, "F"); }
        r.forEach((c, j) => { const x = M + (j ? first + (j - 1) * cw : 0); if (c.bg && !hdr) { doc.setFillColor(...c.bg); doc.rect(x, y, j ? cw : first, h, "F"); } doc.setTextColor(...(hdr ? [230, 200, 120] : c.col || [35, 35, 40])); doc.text(cells[j], x + 1, y + fs * .4 + .6); });
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
function pdfEnd(w) { w.add(); w.h("Avvertenze e fonti dei dati", 2); w.p(DISCL_TXT, { box: true }); w.p(SOURCES_TXT, { size: 8.5 }); w.p("Verifiche: livelli MSCI confrontati con i rendimenti annuali pubblicati (es. MSCI EM 2008 -53,3%, 2017 +37,3% Net USD; MSCI World 2008 -40,7%); inflazione confrontata con i dati ufficiali (HICP area euro dic-2022 +9,2%, CPI Italia dic-2022 +11,6%). Dettagli nella sezione 'Info dati' della piattaforma.", { size: 8.5 }); w.p(BRAND, { bold: true, size: 10, color: [150, 120, 40] }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function makePdf({ title, sub, file, parts }) {
  const back = document.querySelector(".tab.on").id; const doc = newDoc(); pdfCover(doc, title, sub); const w = pdfWriter(doc, title);
  for (const pt of parts) { if (window.__pdfDbg) console.error("part", pt.tab || "", String(pt.root).slice(0, 60)); if (pt.tab && document.querySelector(".tab.on").id !== pt.tab) { showTab(pt.tab); await sleep(pt.wait || 400); } if (pt.before) await pt.before(); if (pt.newPage) w.add(); if (pt.title) w.h(pt.title, 2); if (pt.text) w.p(pt.text, { box: true }); const rt = typeof pt.root === "function" ? pt.root() : typeof pt.root === "string" ? document.querySelector(pt.root) : pt.root; await pdfSection(w, rt); }
  pdfEnd(w); doc.save(file); if (back && back !== document.querySelector(".tab.on").id) showTab(back); return file;
}
async function withBusy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = "Generazione PDF in corso…"; try { await fn(); } catch (e) { console.error(e); alert("Errore nella generazione del PDF: " + e.message); } finally { btn.disabled = false; btn.textContent = t; } }
const pdfName = s => s + "_" + new Date().toISOString().slice(0, 10) + ".pdf";
