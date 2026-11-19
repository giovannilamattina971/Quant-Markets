"use strict";
/* ===== v9: navigazione in 3 aree + Home con i dati di ieri + caricamento dati su richiesta ===== */

// --- caricamento pigro dei dataset pesanti usati solo dal Cruscotto
const LAZY = {};
function needData(names) {
  return Promise.all(names.map(n => {
    if (window[n]) return Promise.resolve();
    if (!LAZY[n]) LAZY[n] = new Promise(res => { const s = document.createElement("script"); s.src = `data/${n}.js?v=${(window.DATA_META && DATA_META.updated) || ""}`; s.onload = res; s.onerror = () => { window[n] = window[n] || {}; res(); }; document.head.appendChild(s); });
    return LAZY[n];
  }));
}
const loadingHtml = t => `<div class="card"><p class="muted">⏳ Carico i dati ${t || ""}…</p></div>`;

// --- aree e pagine
const AREAS = [
  { id: "pf", t: "Portafogli & clienti", s: "Costruisci, confronta, presenta", groups: [
    ["Costruzione", [["multi", "Laboratorio portafogli"], ["bt", "Backtest indice"], ["tilt", "Tilt fattoriali (core + satellite)"]]],
    ["Per il cliente", [["pres", "Presentazione cliente (PDF)"], ["profilo", "Profilo di rischio"], ["obiettivi", "Obiettivi di vita"], ["pac", "Simulatore PAC"], ["decumulo", "Decumulo"]]]] },
  { id: "mk", t: "Analisi mercati", s: "Eccessi, drawdown, tassi, materie prime", groups: [
    ["Cruscotto", [["cx_sem", "Semaforo degli eccessi", 1], ["cx_rot", "Rotazione settori USA", 1], ["cx_val", "Valutazioni, P/E e premio al rischio", 1]]],
    ["Tassi e materie prime", [["cx_rates", "Curve dei tassi e obbligazioni", 1], ["cx_cmd", "Oro, petrolio, dollaro", 1], ["bond", "Titoli di Stato europei e BTP"], ["macro", "Banche centrali"]]],
    ["Rischio", [["cx_dd", "Comprare nei drawdown", 1], ["cx_vol", "Volatilità e stress", 1], ["cx_ergo", "Ergodicità e rischio di rovina", 1], ["tb_dd", "Drawdown e correzioni"], ["tb_crisi", "Anatomia delle crisi"], ["tb_risk", "Rischio e ribilanciamento"]]],
    ["Indici e segnali", [["aa", "Analisi asset (ipercomprato, regimi, momentum)"], ["overview", "Panoramica indice"], ["adv", "Analisi avanzate"], ["signals", "Segnali attuali"], ["tb_fwd", "Prezzi giù, rendimenti attesi su"], ["tb_eps", "Prezzi e utili"], ["tb_ath", "Massimi storici ed età del rialzo"], ["ask", "Fai una domanda ai dati"], ["faq", "Domande frequenti"], ["aaguide", "Guida agli indicatori"]]]] },
  { id: "ed", t: "Educazione", s: "Per chi inizia", groups: [
    ["Le basi", [["basi", "Azioni, obbligazioni & ETF"], ["ed_world", "Perché un indice mondiale", 1], ["soci", "Soci dell'economia reale"], ["infl", "Inflazione e contante"]]],
    ["Tempo e disciplina", [["tb_pac", "Il PAC nel tempo"], ["timing", "Investo subito o aspetto un calo?"], ["cm", "Comportamento dei mercati"], ["tb_gap", "Gap comportamentale"], ["crisi", "Crisi storiche"]]]] },
];
const PAGE_AREA = {}; AREAS.forEach(a => a.groups.forEach(([, L]) => L.forEach(([id]) => PAGE_AREA[id] = a.id))); PAGE_AREA.home = "home"; PAGE_AREA.info = "home";
const NEW_TABS = ["home", "cx_sem", "cx_rot", "cx_val", "cx_rates", "cx_cmd", "cx_dd", "cx_vol", "cx_ergo", "ed_world"];
// pagine che usano i filtri globali dell'intestazione (indice, periodo, regime…)
const USES_HEADER = new Set(["overview", "adv", "signals", "faq", "ask", "bt", "tb_dd", "tb_fwd", "tb_eps", "tb_ath", "cm", "timing"]);

(function buildNav() {
  const main = document.querySelector("main") || document.querySelector(".tab").parentElement;
  NEW_TABS.forEach(id => { if (!document.getElementById(id)) main.insertAdjacentHTML("beforeend", `<section id="${id}" class="tab"><div id="${id}Out"></div></section>`); });
  const nav = $("#tabs");
  const titles = {}; nav.querySelectorAll("button[data-tab]").forEach(b => titles[b.dataset.tab] = b.title);
  const btn = (id, t, isNew) => `<button data-tab="${id}" title="${(titles[id] || t).replace(/"/g, "&quot;")}">${t}${isNew ? ' <span class="newdot">nuovo</span>' : ""}</button>`;
  nav.innerHTML = `<button data-tab="home" class="homebtn">⌂ Home · mercati di ieri</button>
   <div class="areasw">${AREAS.map(a => `<button data-area="${a.id}">${a.t}</button>`).join("")}</div>
   ${AREAS.map(a => `<div class="areablk" data-areablk="${a.id}">${a.groups.map(([g, L]) => `<div class="grp">${g}</div>${L.map(([id, t, n]) => btn(id, t, n)).join("")}`).join("")}</div>`).join("")}
   <div class="grp">Dati</div>${btn("info", "Info dati e aggiornamenti")}`;
  nav.onclick = e => { const a = e.target.closest("[data-area]"); if (a) { setArea(a.dataset.area, true); return; } const b = e.target.closest("button[data-tab]"); if (b) { showTab(b.dataset.tab); nav.classList.remove("open"); } };
  // intestazione: titolo generico e filtri richiudibili
  const sm = document.querySelector(".brand small"); if (sm) sm.textContent = "Portafogli · Analisi mercati · Educazione";
  const ctr = document.querySelector("header .controls");
  if (ctr) { ctr.insertAdjacentHTML("beforebegin", `<div class="hdrtools"><label class="cli">Cliente <input id="cliName" placeholder="Nome del cliente (per i PDF)"></label><button id="ctrTog" class="chip" title="Indice, periodo, regime, valuta: usati dalle pagine di analisi degli indici">⚙ Filtri indice e periodo</button><span id="freshBadge" class="fresh"></span></div>`);
    $("#ctrTog").onclick = () => document.body.classList.toggle("showctr"); }
  try { $("#cliName").value = localStorage.getItem("qm_cli") || ""; } catch (e) { /* storage non disponibile */ }
  $("#cliName").oninput = e => { try { localStorage.setItem("qm_cli", e.target.value); } catch (er) { /* */ } };
})();

function setArea(a, openFirst) {
  document.querySelectorAll("#tabs [data-area]").forEach(b => b.classList.toggle("on", b.dataset.area === a));
  document.querySelectorAll("#tabs [data-areablk]").forEach(b => b.style.display = b.dataset.areablk === a || a === "home" ? "" : "none");
  if (a === "home") document.querySelectorAll("#tabs [data-areablk]").forEach(b => b.style.display = "none");
  if (openFirst) { const ar = AREAS.find(x => x.id === a); if (ar) showTab(ar.groups[0][1][0][0]); }
}

// --- rendering delle pagine nuove (registrate dai moduli x_*.js)
window.XR = window.XR || {};
{ const _s = showTab; showTab = id => { _s(id); const ar = PAGE_AREA[id]; if (ar) setArea(ar); document.body.classList.toggle("hdrpage", USES_HEADER.has(id));
    if (XR[id]) { try { XR[id](); } catch (e) { console.error(e); const o = document.getElementById(id + "Out"); if (o) o.innerHTML = `<div class="card warn">Errore nel calcolo di questa pagina: ${e.message}</div>`; } }
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* */ } window.scrollTo(0, 0); }; }

// --- PDF: nome del cliente in copertina
{ const _c = pdfCover; pdfCover = function (doc, title, sub) { const cli = (($("#cliName") || {}).value || "").trim(); _c(doc, title, (cli ? "Preparato per: " + cli + "\n" : "") + (sub || "")); }; }

// --- freschezza dei dati
function lastDate(d) { return d && d.length ? d[d.length - 1] : null; }
function freshInfo() {
  const M = window.DATA_META || {}; const sp = lastDate(MKT["^GSPC"] && MKT["^GSPC"].d);
  const upd = M.updated ? new Date(M.updated) : null;
  return { sp, upd, errors: M.errors || 0 };
}
(function badge() {
  const f = freshInfo(), b = $("#freshBadge"); if (!b) return;
  const age = f.sp ? Math.round((Date.now() - Date.parse(f.sp)) / DAY) : 99;
  b.className = "fresh " + (age <= 4 ? "ok" : "old");
  b.innerHTML = `Dati al <b>${f.sp ? fmtD(f.sp) : "–"}</b>` + (f.upd ? ` · aggiornati ${f.upd.toLocaleDateString("it-IT")} ${f.upd.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : "") + (f.errors ? ` · <span title="Alcune serie non si sono aggiornate: vedi Info dati">⚠ ${f.errors} serie non aggiornate</span>` : "");
  b.onclick = () => showTab("info");
})();

// --- Home
const HOME_ROWS = [
  ["Azioni", [["MKT", "^GSPC", "S&P 500"], ["MKT", "^NDX", "Nasdaq 100"], ["MKT", "^RUT", "Russell 2000"], ["ASSETS", "SWDA.MI", "MSCI World (SWDA, EUR)"], ["ASSETS", "SXRT.DE", "EURO STOXX 50 (EUR)"], ["ASSETS", "EEM", "Emergenti (EEM)"]]],
  ["Obbligazioni", [["ASSETS", "TLT", "Treasury 20+ (TLT)"], ["ASSETS", "IEF", "Treasury 7-10 (IEF)"], ["ASSETS", "SXRQ.DE", "Gov. euro 7-10 (EUR)"], ["ASSETS", "CSBGE3.MI", "Gov. euro 1-3 (EUR)"], ["ASSETS", "VAGF.DE", "Global Agg. hedged (EUR)"]]],
  ["Materie prime e altro", [["ASSETS", "GLD", "Oro (GLD)"], ["ASSETS", "IGLN", "Oro fisico (EUR)"], ["ASSETS", "BRENT", "Petrolio Brent spot"], ["ASSETS", "XEON.DE", "Liquidità €STR (XEON)"], ["MKT", "^VIX", "VIX", 1]]]];
function serStats(o, inv) {
  const d = o.d, c = o.c, n = c.length - 1; if (n < 5) return null;
  const at = k => { const t = Date.parse(d[n]) - k * DAY; let i = lb(d, new Date(t).toISOString().slice(0, 10)); if (d[i] > new Date(t).toISOString().slice(0, 10)) i--; return Math.max(0, i); };
  const y0 = lb(d, d[n].slice(0, 4) + "-01-01") - 1;
  let mx = -Infinity; for (let i = 0; i <= n; i++) if (c[i] > mx) mx = c[i];
  const ma = c.slice(Math.max(0, n - 199), n + 1); const ma200 = mean(ma);
  return { last: c[n], date: d[n], d1: c[n] / c[n - 1] - 1, w1: c[n] / c[at(7)] - 1, m1: c[n] / c[at(30)] - 1, ytd: y0 >= 0 ? c[n] / c[y0] - 1 : NaN, y1: c[n] / c[at(365)] - 1, dd: c[n] / mx - 1, ma: c[n] / ma200 - 1 };
}
XR.home = function () {
  const out = $("#homeOut"); if (out.dataset.ok) return; out.dataset.ok = 1;
  const f = freshInfo();
  const rows = HOME_ROWS.map(([g, L]) => [`<tr class="grprow"><td colspan="9">${g}</td></tr>`].concat(L.map(([ds, k, name, isVix]) => { const o = (window[ds] || {})[k]; if (!o) return ""; const s = serStats(o); if (!s) return "";
    const p = x => isVix ? (isNaN(x) ? "–" : `<span class="${x > 0 ? "neg" : "pos"}">${pct(x)}</span>`) : pc(x);
    return `<tr><td>${name}</td><td class="r">${num(s.last, s.last > 1000 ? 0 : 2)}</td><td class="r">${p(s.d1)}</td><td class="r">${p(s.w1)}</td><td class="r">${p(s.m1)}</td><td class="r">${p(s.ytd)}</td><td class="r">${p(s.y1)}</td><td class="r">${isVix ? "–" : pc(s.dd)}</td><td class="r muted">${fmtD(s.date)}</td></tr>`; }).join("")).join("")).join("");
  const y = window.YIELDS || {}, lv = k => { const o = y[k]; return o ? [lastDate(o.d), o.v[o.v.length - 1]] : [null, null]; };
  const s10 = lv("DGS10"), s2 = lv("DGS2"), it = lv("IRLTLT01ITM156N"), de = window.BUND && BUND.DE10_OECD ? [lastDate(BUND.DE10_OECD.d), BUND.DE10_OECD.v[BUND.DE10_OECD.v.length - 1]] : [null, null];
  out.innerHTML = `<div class="hero"><h2>Buongiorno.</h2><p class="muted">Situazione dei mercati alla chiusura del <b>${f.sp ? fmtD(f.sp) : "–"}</b>. I dati si aggiornano da soli ogni notte (lun–ven).</p></div>
  <div class="areacards">${AREAS.map(a => `<button class="areacard" data-area-go="${a.id}"><b>${a.t}</b><span>${a.s}</span><small>${a.groups.map(g => g[1].length).reduce((x, y) => x + y, 0)} pagine</small></button>`).join("")}</div>
  <div class="card"><h3>Mercati: variazioni all'ultima chiusura</h3><div class="tblwrap"><table class="hometbl"><tr><th>Strumento</th><th class="r">Ultimo</th><th class="r">1 giorno</th><th class="r">1 settimana</th><th class="r">1 mese</th><th class="r">Da inizio anno</th><th class="r">12 mesi</th><th class="r">Dal massimo</th><th class="r">Data</th></tr>${rows}</table></div>
  <p class="note">Prezzi rettificati per dividendi/cedole dove disponibile; petrolio = prezzo spot. «Dal massimo» = distanza dal massimo storico della serie.</p></div>
  <div class="card"><h3>Tassi</h3><div class="kpis">
   <div class="kpi"><span>Treasury 10 anni</span><b>${num(s10[1])}%</b><small class="muted">${s10[0] ? fmtD(s10[0]) : ""}</small></div>
   <div class="kpi"><span>Treasury 2 anni</span><b>${num(s2[1])}%</b><small class="muted">10a–2a: ${num(s10[1] - s2[1])} pp</small></div>
   <div class="kpi"><span>BTP 10 anni (media mese)</span><b>${num(it[1])}%</b><small class="muted">${it[0] ? fmtD(it[0]) : ""}</small></div>
   <div class="kpi"><span>Bund 10 anni (media mese)</span><b>${num(de[1])}%</b><small class="muted">Spread BTP–Bund: ${it[1] != null && de[1] != null ? Math.round((it[1] - de[1]) * 100) : "–"} pb</small></div></div>
   <p class="note">Curve complete, tassi reali e spread giornalieri in <a href="#" data-go="cx_rates">Analisi mercati → Curve dei tassi</a>.</p></div>`;
  out.querySelectorAll("[data-area-go]").forEach(b => b.onclick = () => setArea(b.dataset.areaGo, true));
};

// avvio: pagina dall'indirizzo (#id) o Home
(function start() { const h = (location.hash || "").slice(1); const ok = h && document.getElementById(h) && h !== "home"; showTab(ok ? h : "home"); })();

// --- Info dati: esito dell'ultimo aggiornamento automatico
{ const _ri = renderInfo; renderInfo = function () { _ri(); const M = window.DATA_META || {}, host = $("#infoOut"); if (!host || !M.series) return;
  const S = Object.entries(M.series), ord = { ERRORE: 0, manuale: 1, stima: 2, ok: 3 }; S.sort((a, b) => (ord[a[1].status] ?? 9) - (ord[b[1].status] ?? 9) || a[0].localeCompare(b[0]));
  const lab = { ok: '<span class="pos">aggiornata</span>', stima: '<span class="muted">stimata</span>', manuale: '<span class="muted">manuale</span>', ERRORE: '<span class="neg">non aggiornata</span>' };
  host.insertAdjacentHTML("afterbegin", `<div class="card"><h3>Aggiornamento automatico dei dati</h3>
   <p class="answer">Ultimo aggiornamento: <b>${new Date(M.updated).toLocaleString("it-IT")}</b>. Serie aggiornate: <b>${M.ok}</b>${M.errors ? ` · <span class="neg">non aggiornate: ${M.errors}</span> (restano valide fino all'ultima data indicata)` : ""} · ad aggiornamento manuale: ${M.manual}.</p>
   <details class="more"><summary class="pickhead">Dettaglio per serie (${S.length})</summary><div class="tblwrap">${table(["Serie", "Esito", "Ultimo dato", "Fonte", "Note"], S.map(([k, v]) => [k, lab[v.status] || v.status, v.last ? (v.last.length > 7 ? fmtD(v.last) : v.last) : "–", v.src || "", `<small>${v.note || ""}</small>`]))}</div></details>
   <p class="note">Ogni notte (martedì–sabato) uno script scarica i dati del giorno precedente da Yahoo Finance, FRED, BCE, Bundesbank e MSCI, li aggancia allo storico e verifica che coincidano con i valori già presenti: se una fonte non coincide la serie non viene toccata e compare qui come «non aggiornata». Le serie BTP a scadenza costante (investing.com + Banca d'Italia) e l'oro della Banca Mondiale non hanno una fonte scaricabile automaticamente.</p></div>`); }; }
