"use strict";
/* ===== v9: inserimento rapido del portafoglio (cerca, incolla da Excel, normalizza) ===== */
const QB_SYN = { // nomi e ticker che i clienti/consulenti scrivono davvero → strumento della piattaforma
  "swda": "SWDA", "iwda": "SWDA", "xdwd": "SWDA", "eunl": "SWDA", "msci world": "WORLDI", "world": "SWDA", "mondo": "VWRL", "globale": "VWRL",
  "vwce": "VWRL", "vwrl": "VWRL", "vwra": "VWRL", "acwi": "VWRL", "ftse all world": "VWRL", "all world": "VWRL",
  "sp500": "VUSA", "s&p500": "VUSA", "s&p 500": "VUSA", "cspx": "VUSA", "sxr8": "VUSA", "vusa": "VUSA", "vuaa": "VUSA", "usa": "US", "america": "US",
  "eurostoxx": "SX5E", "euro stoxx": "SX5E", "stoxx 50": "SX5E", "europa": "SX5E", "sxrt": "SX5E", "meud": "SX5E",
  "emergenti": "EM", "eimi": "EM", "iema": "EM", "em": "EM", "paesi emergenti": "EM",
  "oro": "IGLN", "gold": "IGLN", "sgld": "IGLN", "igln": "IGLN", "4gld": "XGLD", "argento": "PHAG", "silver": "PHAG",
  "petrolio": "CRUD", "oil": "CRUD", "wti": "CRUD", "brent": "BRNT", "commodity": "CMOD", "materie prime": "CMOD",
  "btp": "BTP10Y", "btp 10": "BTP10Y", "btp 5": "BTP5", "btp 3": "BTP3", "btp 2": "BTP2", "bot": "BTP1", "btp breve": "BTP13Y",
  "liquidita": "XEON", "liquidità": "XEON", "conto deposito": "XEON", "monetario": "XEON", "xeon": "XEON", "cash": "XEON", "estr": "XEON",
  "governativi euro": "IBGM", "gov euro": "IBGM", "bund": "IBGM", "obbligazioni euro breve": "IBGS", "gov 1-3": "IBGS", "gov 3-5": "IBGX", "gov 7-10": "IBGM",
  "aggregate": "AGGH", "obbligazioni globali": "AGGH", "aggh": "AGGI", "vagf": "AGGH", "global aggregate": "AGGH",
  "corporate": "CORP15", "ie15": "CORP15", "obbligazioni emergenti": "EMBE", "embe": "EMBE", "treasury": "UST", "tlt": "UST",
  "tecnologia": "XLK", "tech": "XLK", "finanziari": "XLF", "banche": "XLF", "salute": "XLV", "healthcare": "XLV", "energia": "XLE",
  "value": "FVAL", "momentum": "FMOM", "quality": "FSNQ", "qualità": "FSNQ", "min vol": "FMINV", "minima volatilità": "FMINV", "small cap": "FSMALL",
  "equal weight": "FSPEWU", "dividendi": "FHDY", "high dividend": "FHDY", "aristocrats": "FSDYU",
  "ie00b4l5y983": "SWDA", "ie00b3rbwm25": "VWRL", "ie00bk5bqt80": "VWRL", "ie00b5bmr087": "VUSA", "ie00b3xxrp09": "VUSA", "ie00bfmxxd54": "VUSA", "ie00bkm4gz66": "EM", "ie00b4l5yc18": "EM",
  "lu0290358497": "XEON", "ie00bg47kh54": "AGGH", "ie00bdbrdm35": "AGGI", "ie00b4nd3602": "IGLN", "de000a0s9gb0": "XGLD", "je00b1vs3333": "PHAG", "gb00b15kxv33": "CRUD", "je00b78cgv99": "BRNT",
  "ie00b53l3w79": "SX5E", "ie00b4l60045": "CORP15", "ie00b9m6rs56": "EMBE", "ie00bd6ftq80": "CMOD", "ie00blnmyc90": "FSPEWU", "ie00b6yx5d40": "FSDYU", "ie00b3vtmj91": "IBGS", "ie00b3vtn290": "IBGM",
  "cina": "MCN", "india": "MIN", "corea": "MKR", "taiwan": "MTW", "brasile": "MBR", "messico": "MMX" };
const qbNorm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9&%.,\- ]/g, " ").replace(/\s+/g, " ").trim();
function qbIndex() { return Object.keys(UNI).map(id => ({ id, n: UNI[id].n, cur: UNI[id].cur, txt: qbNorm(id + " " + UNI[id].n + " " + UNI[id].src) })); }
function qbSearch(q, k = 12) {
  const qq = qbNorm(q); if (!qq) return [];
  const I = qbIndex(), sc = new Map();
  Object.entries(QB_SYN).forEach(([s, id]) => { const ns = qbNorm(s); if (!UNI[id]) return; if (ns === qq) sc.set(id, (sc.get(id) || 0) + 100); else if (ns.startsWith(qq) || qq.startsWith(ns + " ") || qq.includes(" " + ns)) sc.set(id, (sc.get(id) || 0) + 30); });
  const toks = qq.split(" ").filter(t => t.length > 1 || /\d/.test(t));
  I.forEach(x => { let s = 0, all = true; toks.forEach(t => { if (x.txt.includes(t)) s += 10 + (x.id.toLowerCase() === t ? 40 : 0); else all = false; }); if (all && toks.length) s += 15; if (s) sc.set(x.id, (sc.get(x.id) || 0) + s); });
  return [...sc.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, s]) => ({ id, s, n: UNI[id].n, cur: UNI[id].cur }));
}
// pesi interi che sommano esattamente a 100 (metodo dei resti maggiori)
function qbTo100(w) {
  const ids = Object.keys(w).filter(k => w[k] > 0), tot = ids.reduce((s, k) => s + w[k], 0); if (!tot) return {};
  const raw = ids.map(k => [k, w[k] / tot * 100]), fl = raw.map(([k, v]) => [k, Math.floor(v), v - Math.floor(v)]);
  let rest = 100 - fl.reduce((s, x) => s + x[1], 0); fl.sort((a, b) => b[2] - a[2]).forEach(x => { if (rest > 0) { x[1]++; rest--; } });
  return Object.fromEntries(fl.map(x => [x[0], x[1]]));
}
function qbParse(text) {
  const lines = String(text).split(/\n|;/).map(l => l.trim()).filter(Boolean), rows = [];
  for (const l of lines) {
    const m = l.match(/(-?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)\s*(%|€|eur|euro)?\s*$/i);
    if (!m) { rows.push({ l, err: "manca il peso o l'importo" }); continue; }
    let v = m[1].replace(/\s/g, ""); v = /,\d+$/.test(v) ? v.replace(/\./g, "").replace(",", ".") : (/\.\d{3}($|\.)/.test(v) ? v.replace(/\./g, "") : v);
    const label = l.slice(0, m.index).replace(/[\t:=|]+/g, " ").trim(), hit = qbSearch(label, 1)[0];
    rows.push(hit ? { l, label, v: +v, id: hit.id } : { l, label, v: +v, err: "strumento non riconosciuto" });
  }
  return rows;
}

function qbRender() {
  const host = $("#pfW"); if (!host || $("#qb")) return;
  // l'elenco completo resta disponibile, ma chiuso
  host.insertAdjacentHTML("beforebegin", `<div id="qb" class="qb nopdf"><h4>Inserimento rapido</h4>
   <div class="qbrow"><div class="qbsearch"><input id="qbQ" placeholder="Cerca e aggiungi: es. «SWDA», «oro», «BTP 5», «emergenti», ISIN IE00B4L5Y983…" autocomplete="off"><div id="qbRes" class="qbres" hidden></div></div>
    <button id="qbNorm" title="Riporta i pesi al 100% mantenendo le proporzioni">Normalizza a 100%</button><button id="qbZero">Azzera</button><button id="qbPasteT">📋 Incolla da Excel</button></div>
   <div id="qbPaste" hidden><p class="note">Una riga per strumento: nome o ticker o ISIN, poi il <b>peso %</b> oppure l'<b>importo in euro</b> (lo converto in percentuale). Va bene anche copiare due colonne da Excel.<br>Esempio:<br><code>SWDA 60<br>BTP 5 anni 25<br>Oro 5<br>XEON 10</code></p>
    <textarea id="qbTxt" class="qbpaste" placeholder="SWDA	45000&#10;VAGF	30000&#10;IGLN	5000"></textarea><div class="form"><button id="qbApply" class="primary">Applica</button><span id="qbMsg" class="muted"></span></div></div>
   <div class="qbgrid"><div id="qbSel" class="qbsel"></div><div id="qbDonut" class="qbdonut"></div></div></div>`);
  const det = document.createElement("details"); det.className = "more sub"; det.innerHTML = `<summary class="pickhead">Elenco completo degli strumenti per categoria (cursori)</summary>`;
  host.parentNode.insertBefore(det, host); det.appendChild(host);
  const W = () => Object.fromEntries([...document.querySelectorAll("[data-wn]")].map(i => [i.dataset.wn, +i.value || 0]));
  const setOne = (id, v) => { const i = document.querySelector(`[data-wn="${id}"]`); if (!i) return; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); };
  const setAll = w => { document.querySelectorAll("[data-wn]").forEach(i => { const v = w[i.dataset.wn] || 0; if (+i.value !== v) { i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); } }); qbList(); };
  const qbList = () => { const w = W(), ids = Object.keys(w).filter(k => w[k] > 0), tot = ids.reduce((s, k) => s + w[k], 0);
    $("#qbSel").innerHTML = ids.length ? ids.map(id => `<div class="it"><span>${UNI[id].n} <small class="muted">· ${UNI[id].cur}</small></span><input type="number" min="0" max="100" step="1" value="${w[id]}" data-qbw="${id}"><button data-qbx="${id}" title="Togli">✕</button></div>`).join("") + `<div class="muted">Totale: <b class="${tot === 100 ? "pos" : "neg"}">${tot}%</b>${tot !== 100 ? " — premi «Normalizza a 100%»" : ""}</div>` : `<p class="muted">Nessuno strumento: cercane uno qui sopra o scegli un modello.</p>`;
    $("#qbSel").querySelectorAll("[data-qbw]").forEach(i => i.oninput = () => { setOne(i.dataset.qbw, Math.max(0, Math.min(100, Math.round(+i.value || 0)))); const t = Object.values(W()).reduce((a, b) => a + b, 0); i.closest(".qbsel").lastElementChild.innerHTML = `Totale: <b class="${t === 100 ? "pos" : "neg"}">${t}%</b>`; donut(); });
    $("#qbSel").querySelectorAll("[data-qbx]").forEach(b => b.onclick = () => { setOne(b.dataset.qbx, 0); window.__qbList(); }); donut(); };
  const QCOL = { AZ: "#127C86", OB: "#13233A", AL: "#A9822B" };
  const kind = id => GROUPS.findIndex(([, SUB]) => SUB.some(([, L]) => L.includes(id)));
  const donut = () => { const w = W(), ids = Object.keys(w).filter(k => w[k] > 0).sort((a, b) => kind(a) - kind(b) || w[b] - w[a]); const el = $("#qbDonut"); if (!el) return; if (!ids.length) { el.innerHTML = ""; return; }
    const shades = { 0: ["#127C86", "#3C9AA2", "#6BB5BB", "#9CCFD3", "#0B5C63"], 1: ["#13233A", "#3D4E63", "#6C7B8F", "#9BA7B6", "#24476F"], 2: ["#A9822B", "#C49E4A", "#D9BC7A", "#8C6A1E", "#E6D2A6"] }, cnt = { 0: 0, 1: 0, 2: 0 };
    const cols = ids.map(id => { const k = Math.max(0, kind(id)); return shades[k][cnt[k]++ % 5]; });
    const az = ids.filter(id => kind(id) === 0).reduce((a, k) => a + w[k], 0), ob = ids.filter(id => kind(id) === 1).reduce((a, k) => a + w[k], 0);
    Plotly.react(el, [{ type: "pie", hole: .62, values: ids.map(k => w[k]), labels: ids.map(k => UNI[k].n.replace(/ \(.*$/, "")), marker: { colors: cols, line: { color: "#fff", width: 2 } }, textinfo: "none", sort: false, hovertemplate: "%{label}: %{value}%<extra></extra>" }],
      { margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, paper_bgcolor: "rgba(0,0,0,0)", annotations: [{ text: `<b>${az}%</b> azioni<br>${ob}% obbligazioni<br>${100 - az - ob > 0 ? (100 - az - ob) + "% alternativi" : ""}`, showarrow: false, font: { size: 13, color: "#13233A", family: "Figtree, sans-serif" } }] }, { displayModeBar: false, responsive: true }); };
  { const _l = qbList; window.__qbList = () => { _l(); donut(); }; }
  let hits = [], sel = 0;
  const showRes = () => { const r = $("#qbRes"); if (!hits.length) { r.hidden = true; return; } r.hidden = false; r.innerHTML = hits.map((h, i) => `<div data-i="${i}" class="${i === sel ? "sel" : ""}">${h.n} <small class="muted">· ${h.cur}</small></div>`).join(""); };
  const add = h => { const w = W(); if (!(w[h.id] > 0)) { const tot = Object.values(w).reduce((a, b) => a + b, 0); setOne(h.id, Math.max(1, Math.min(100, 100 - tot)) || 10); } $("#qbQ").value = ""; hits = []; showRes(); window.__qbList(); };
  $("#qbQ").oninput = e => { hits = qbSearch(e.target.value); sel = 0; showRes(); };
  $("#qbQ").onkeydown = e => { if (e.key === "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); showRes(); e.preventDefault(); } else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); showRes(); e.preventDefault(); } else if (e.key === "Enter" && hits[sel]) { add(hits[sel]); e.preventDefault(); } else if (e.key === "Escape") { hits = []; showRes(); } };
  $("#qbRes").onmousedown = e => { const d = e.target.closest("[data-i]"); if (d) { e.preventDefault(); add(hits[+d.dataset.i]); } };
  $("#qbQ").onblur = () => setTimeout(() => { hits = []; showRes(); }, 150);
  $("#qbNorm").onclick = () => setAll(qbTo100(W()));
  $("#qbZero").onclick = () => setAll({});
  $("#qbPasteT").onclick = () => { $("#qbPaste").hidden = !$("#qbPaste").hidden; if (!$("#qbPaste").hidden) $("#qbTxt").focus(); };
  $("#qbApply").onclick = () => { const rows = qbParse($("#qbTxt").value), ok = rows.filter(r => r.id && r.v > 0);
    if (!ok.length) { $("#qbMsg").innerHTML = `<span class="neg">Nessuna riga riconosciuta.</span>`; return; }
    const w = {}; ok.forEach(r => w[r.id] = (w[r.id] || 0) + r.v); setAll(qbTo100(w));
    const bad = rows.filter(r => r.err); const tot = ok.reduce((s, r) => s + r.v, 0);
    $("#qbMsg").innerHTML = `Riconosciute ${ok.length} righe${Math.abs(tot - 100) > 0.5 ? ` (totale ${num(tot, 0)} → convertito in %)` : ""}: ${ok.map(r => `«${r.label}» → ${UNI[r.id].n.replace(/ \(.*/, "")}`).join("; ")}.` + (bad.length ? ` <span class="neg">Non riconosciute: ${bad.map(r => "«" + r.l + "»").join(", ")}</span>` : "") + ` <b>Premi «Simula».</b>`; };
  document.querySelectorAll("[data-w],[data-wn]").forEach(i => i.addEventListener("input", () => { if (document.activeElement && document.activeElement.dataset && !document.activeElement.dataset.qbw) window.__qbList(); }));
  $("#pfPreset").addEventListener("change", () => setTimeout(window.__qbList, 0));
  window.__qbList();
}
{ const _rm = renderMulti; renderMulti = function () { _rm.apply(this, arguments); try { qbRender(); } catch (e) { console.error(e); } }; }
