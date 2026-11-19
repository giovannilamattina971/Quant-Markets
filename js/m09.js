"use strict";
/* ===== Utilità ===== */
const $ = s => document.querySelector(s);
const DAY = 864e5, YR = 365.25 * DAY;
const C = { gold: "#A9822B", red: "#C4453B", green: "#1A8A5B", grey: "#8A97A8", blue: "#2F6FD1", text: "#13233A", grid: "#E8ECF1", teal: "#127C86" };
const pct = (x, d = 1) => (x == null || isNaN(x)) ? "–" : (x * 100).toFixed(d).replace(".", ",") + "%";
const num = (x, d = 2) => (x == null || isNaN(x)) ? "–" : x.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const cls = x => x > 0 ? "pos" : x < 0 ? "neg" : "";
const pc = (x, d) => `<span class="${cls(x)}">${pct(x, d)}</span>`;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const median = a => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const std = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const fracPos = a => a.length ? a.filter(x => x > 0).length / a.length : NaN;
const lb = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const fmtD = s => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const LAYOUT = (o = {}) => Object.assign({
  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#3D4E63", family: "Figtree, Inter, Segoe UI, sans-serif", size: 12 },
  margin: { l: 55, r: 20, t: 30, b: 45 }, xaxis: { gridcolor: C.grid, zerolinecolor: C.grid }, yaxis: { gridcolor: C.grid, zerolinecolor: "#C9D2DC" },
  legend: { orientation: "h", y: 1.12 }, hovermode: "x unified", separators: ",.",
  hoverlabel: { bgcolor: "#ffffff", bordercolor: "#127C86", font: { color: "#13233A", size: 14, family: "Inter, Segoe UI, sans-serif" }, namelength: -1 }
}, o);
const plot = (el, data, lay, cfg) => { const L = LAYOUT(lay); if (L.title && (L.title.text || typeof L.title === "string")) { const t = typeof L.title === "string" ? { text: L.title } : L.title; L.title = Object.assign({ y: 0.975, yref: "container", yanchor: "top", x: 0.01, xanchor: "left" }, t); L.margin = Object.assign({}, L.margin, { t: Math.max((L.margin || {}).t || 0, 72) }); if (L.showlegend !== false) L.legend = Object.assign({ orientation: "h", x: 0, xanchor: "left", y: 1.01, yanchor: "bottom" }, (lay || {}).legend || {}); } Object.keys(L).filter(k => /^[xy]axis\d*$/.test(k)).forEach(k => { L[k] = Object.assign({ gridcolor: C.grid, zerolinecolor: C.grid }, L[k]); }); (data || []).forEach(t => { if (t && t.type === "bar" && t.text && t.cliponaxis == null) t.cliponaxis = false; }); return Plotly.react(el, data, L, Object.assign({ displaylogo: false, responsive: true }, cfg)); };
const table = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
let chartId = 0; const div = (cls = "chart") => { const id = "c" + (++chartId); return [`<div id="${id}" class="${cls}"></div>`, id]; };

/* ===== Dati ===== */
const ORDER = ["^GSPC", "^SP500TR", "^DJI", "^IXIC", "^NDX", "^RUT", "^VIX"];
const FULL = {};
for (const k of ORDER) if (window.MKT[k]) { const r = MKT[k]; FULL[k] = { name: r.name, d: r.d, c: r.c, t: r.d.map(s => Date.parse(s)) }; }
const VIXmap = FULL["^VIX"] ? new Map(FULL["^VIX"].d.map((d, i) => [d, FULL["^VIX"].c[i]])) : new Map();

function build(key, from, to) {
  const F = FULL[key]; const i0 = lb(F.d, from), i1 = lb(F.d, to + "~");
  const d = F.d.slice(i0, i1), c = F.c.slice(i0, i1), t = F.t.slice(i0, i1), n = c.length;
  const S = { key, name: F.name, d, c, t, n, y: d.map(s => +s.slice(0, 4)), m: d.map(s => +s.slice(5, 7)) };
  S.r = c.map((v, i) => i ? v / c[i - 1] - 1 : NaN);
  const fi = indicators(F); // indicatori su tutta la storia, poi tagliati
  for (const k of ["rsi", "ma200", "dist", "dd", "ath", "down"]) S[k] = fi[k].slice(i0, i1);
  S.vix = d.map(x => VIXmap.get(x) ?? NaN);
  const rg = ($("#regime") || {}).value || "all", f = REG[rg](S); S.regime = rg; S.mask = d.map((_, i) => !!f(i));
  return S;
}
const indCache = {};
function indicators(F) {
  if (indCache[F.name]) return indCache[F.name];
  const c = F.c, n = c.length, rsi = new Array(n).fill(NaN), ma = new Array(n).fill(NaN), dist = new Array(n).fill(NaN), dd = [], ath = [], down = [];
  let g = 0, l = 0; // RSI di Wilder 14
  for (let i = 1; i < n; i++) {
    const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
    if (i <= 14) { g += up / 14; l += dn / 14; if (i === 14) rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    else { g = (g * 13 + up) / 14; l = (l * 13 + dn) / 14; rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  }
  let s = 0; for (let i = 0; i < n; i++) { s += c[i]; if (i >= 200) s -= c[i - 200]; if (i >= 199) { ma[i] = s / 200; dist[i] = c[i] / ma[i] - 1; } }
  let pk = -Infinity, cnt = 0;
  for (let i = 0; i < n; i++) { const isAth = c[i] > pk; if (isAth) pk = c[i]; ath.push(isAth && i > 0); dd.push(c[i] / pk - 1); cnt = i && c[i] < c[i - 1] ? cnt + 1 : 0; down.push(cnt); }
  return indCache[F.name] = { rsi, ma200: ma, dist, dd, ath, down };
}
const fwdY = (S, i, h) => { const j = lb(S.t, S.t[i] + h * YR); return j < S.n ? S.c[j] / S.c[i] - 1 : NaN; };
const fwdD = (S, i, h) => i + h < S.n ? S.c[i + h] / S.c[i] - 1 : NaN;
function yearly(S) {
  const out = []; let lastPrev = null;
  for (let i = 0; i < S.n; i++) {
    const end = i === S.n - 1 || S.y[i + 1] !== S.y[i];
    if (end) { if (lastPrev != null) out.push({ y: S.y[i], r: S.c[i] / lastPrev - 1, partial: i === S.n - 1 && (S.m[i] < 12 || +S.d[i].slice(8) < 24) }); lastPrev = S.c[i]; }
  }
  return out;
}
function monthly(S) { const out = []; let prev = null; for (let i = 0; i < S.n; i++) { if (i === S.n - 1 || S.m[i + 1] !== S.m[i]) { if (prev != null && i < S.n - 1) out.push({ y: S.y[i], m: S.m[i], r: S.c[i] / prev - 1 }); prev = S.c[i]; } } return out; }
function episodes(S, thr = -0.1) {
  const E = []; let pk = 0, tr = 0, inE = false;
  for (let i = 1; i < S.n; i++) {
    if (S.c[i] >= S.c[pk]) { if (inE) { E.push({ p: pk, t: tr, r: i, depth: S.c[tr] / S.c[pk] - 1 }); inE = false; } pk = i; tr = i; continue; }
    if (S.c[i] < S.c[tr]) tr = i;
    if (S.c[tr] / S.c[pk] - 1 <= thr) inE = true;
  }
  if (inE) E.push({ p: pk, t: tr, r: null, depth: S.c[tr] / S.c[pk] - 1 });
  return E.sort((a, b) => a.depth - b.depth);
}
function events(S, cond, gap) { const out = []; let last = -1e9; for (let i = 0; i < S.n; i++) if ((!S.mask || S.mask[i]) && cond(i) && i - last >= gap) { out.push(i); last = i; } return out; }
const yrs = (a, b) => (b - a) / YR;

/* Partito del presidente in carica (fatto storico; anno assegnato a chi governa dopo l'insediamento del 20 gennaio) */
const PARTY = y => y <= 1932 ? "R" : y <= 1952 ? "D" : y <= 1960 ? "R" : y <= 1968 ? "D" : y <= 1976 ? "R" : y <= 1980 ? "D" : y <= 1992 ? "R" : y <= 2000 ? "D" : y <= 2008 ? "R" : y <= 2016 ? "D" : y <= 2020 ? "R" : y <= 2024 ? "D" : y <= 2028 ? "R" : null;
const PRES = [[1928,"Coolidge","R"],[1929,"Hoover","R"],[1933,"F.D. Roosevelt","D"],[1945,"Truman","D"],[1953,"Eisenhower","R"],[1961,"Kennedy/Johnson","D"],[1969,"Nixon/Ford","R"],[1977,"Carter","D"],[1981,"Reagan","R"],[1989,"G.H.W. Bush","R"],[1993,"Clinton","D"],[2001,"G.W. Bush","R"],[2009,"Obama","D"],[2017,"Trump (1°)","R"],[2021,"Biden","D"],[2025,"Trump (2°)","R"]];
const REG = {
  all: S => i => true, aboveMA: S => i => S.dist[i] > 0, belowMA: S => i => S.dist[i] < 0, bull: S => i => S.dd[i] > -0.2, bear: S => i => S.dd[i] <= -0.2,
  corr: S => i => S.dd[i] <= -0.1 && S.dd[i] > -0.2, vixHi: S => i => S.vix[i] > 25, vixLo: S => i => S.vix[i] < 15,
  dem: S => i => PARTY(S.y[i]) === "D", rep: S => i => PARTY(S.y[i]) === "R" };
const MINN = 30, warnN = n => n < MINN ? ` <span class="warn" title="Campione inferiore a ${MINN} casi: statistica poco affidabile">⚠ n=${n}</span>` : "";
/* ===== Stato ===== */
const st = { key: "^GSPC", from: null, to: null, S: null };
function refresh() {
  st.key = $("#idx").value; st.from = $("#from").value; st.to = $("#to").value;
  st.ek = deriveKey(st.key); st.S = build(st.ek, st.from, st.to);
  const visible = document.querySelector(".tab.on").id;
  renderOverview(); if (visible === "signals") renderSignals();
  if (curFaq) runFaq(curFaq);
}
function setRange(y) {
  const F = FULL[$("#idx").value]; const last = F.d[F.d.length - 1];
  $("#to").value = last;
  if (!y) $("#from").value = F.d[0]; else { const f = new Date(Date.parse(last) - y * YR).toISOString().slice(0, 10); $("#from").value = f < F.d[0] ? F.d[0] : f; }
  $("#pacFrom").value = y === 0 && F.d[0] < "2000-01-01" ? "2000-01-01" : $("#from").value; $("#pacTo").value = last;
  refresh();
}

/* ===== Panoramica ===== */
function renderOverview() {
  const S = st.S; if (S.n < 2) return;
  const Y = yrs(S.t[0], S.t[S.n - 1]), cagr = (S.c[S.n - 1] / S.c[0]) ** (1 / Y) - 1;
  const vol = std(S.r.slice(1)) * Math.sqrt(252), ann = yearly(S).filter(x => !x.partial);
  let pk = -Infinity, md = 0; for (const v of S.c) { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); }
  $("#kpis").innerHTML = [
    ["Ultima chiusura", num(S.c[S.n - 1]) + `<div class="muted">${fmtD(S.d[S.n - 1])}</div>`],
    [($("#serie") && $("#serie").value === "tr") ? "Rendimento cumulato (dividendi reinvestiti)" : "Variazione cumulata indice (solo prezzo, senza dividendi)", pc(S.c[S.n - 1] / S.c[0] - 1, 0)], [($("#serie") && $("#serie").value === "tr") ? "CAGR (total return)" : "CAGR (solo prezzo)", pc(cagr, 2)], ["Volatilità annua", pct(vol)],
    ["Max drawdown", pc(md)], ["Anni positivi", pct(fracPos(ann.map(x => x.r)), 0) + `<div class="muted">${ann.filter(x => x.r > 0).length} su ${ann.length}</div>`],
    ["Giorni di borsa", S.n.toLocaleString("it-IT")]].map(([a, b]) => `<div class="kpi"><span>${a}</span><b>${b}</b></div>`).join("");
  $("#ovTitle").textContent = `${S.name} · ${fmtD(S.d[0])} – ${fmtD(S.d[S.n - 1])}`;
  const tr = [{ x: S.d, y: S.c, name: S.name, line: { color: C.gold, width: 1.4 }, type: "scatter" }];
  if (S.key !== "^VIX") tr.push({ x: S.d, y: S.ma200, name: "Media mobile 200g", line: { color: C.red, width: 1 }, type: "scatter" });
  const raw = MKT[(FULL[S.key] || {}).base || S.key.split("|")[0]], vm = raw && raw.v && raw.v.some(x => x > 0) ? new Map(raw.d.map((d, i) => [d, raw.v[i]])) : null;
  const lay = { yaxis: { type: $("#logScale").checked ? "log" : "linear", gridcolor: C.grid } };
  if (vm) { tr.push({ x: S.d, y: S.d.map(d => vm.get(d) || null), type: "bar", name: "Volume", marker: { color: "#4a4a52" }, yaxis: "y2", hovertemplate: "%{y:.3s}<extra>Volume</extra>" }); lay.yaxis.domain = [0.24, 1]; lay.yaxis2 = { domain: [0, 0.18], gridcolor: C.grid, title: { text: "Volume", font: { size: 10 } } }; }
  plot("ovChart", tr, lay);
  const yy = yearly(S);
  plot("ovYears", [{ x: yy.map(a => a.y), y: yy.map(a => a.r * 100), type: "bar", marker: { color: yy.map(a => a.r >= 0 ? C.green : C.red) }, hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" }], { yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
  const ddR = []; pk = -Infinity; for (const v of S.c) { pk = Math.max(pk, v); ddR.push((v / pk - 1) * 100); }
  plot("ovDD", [{ x: S.d, y: ddR, fill: "tozeroy", line: { color: C.red, width: 1 }, fillcolor: "rgba(192,40,63,.25)", type: "scatter", hovertemplate: "%{y:.1f}%<extra></extra>" }], { yaxis: { ticksuffix: "%", gridcolor: C.grid } });
}

/* ===== Domande frequenti ===== */
const FAQ = [
  ["ath", "Conviene entrare sui massimi storici o aspettare una correzione del 5/10/15/20%?"],
  ["midterm", "Anni di elezioni midterm e ciclo presidenziale: quanti positivi e negativi?"],
  ["season", "Stagionalità: rendimenti medi per mese e «Sell in May»"],
  ["annual", "Distribuzione dei rendimenti annuali e % di anni positivi"],
  ["dd", "Drawdown storici: profondità, durata e tempi di recupero"],
  ["drops", "Cosa succede dopo forti cali giornalieri (-3%, -5%) o più giorni di ribasso?"],
  ["vix", "Rendimenti dopo VIX sopra 30 e sopra 40"],
  ["hold", "Probabilità di guadagno per orizzonte di detenzione (1, 5, 10, 20 anni)"],
  ["osc", "Ipercomprato / ipervenduto: RSI(14) e distanza dalla media mobile a 200 giorni"],
  ["jan", "Gennaio e primo trimestre come barometro dell'anno"],
  ["regime", "Regimi di mercato: rendimenti futuri sopra/sotto MA200, in bear market, con VIX alto/basso"],
  ["decade", "Rendimenti per decennio"],
  ["party", "Presidente democratico o repubblicano: come è andata la borsa?"],
  ["weekday", "Giorno della settimana e giorno del mese (effetto fine/inizio mese)"],
];
let curFaq = null;
function runFaq(k) {
  curFaq = k; document.querySelectorAll(".faqbtns button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  const S = st.S, out = $("#faqOut");
  const rn = $("#regNote"); if (rn) rn.innerHTML = S.regime === "all" ? "" : `<span class="warn">Filtro regime attivo: «${REGN()}».</span> Si applica alle analisi basate su eventi/giorni (domande 1, 6–9, regimi, giorno della settimana, costruttore di query); le statistiche per anno solare (2–5, 10, decenni) usano tutti gli anni.`;
  try { const r = ANS[k](S); out.innerHTML = `${TB("faqOut", k)}<div class="card"><h3>${FAQ.find(f => f[0] === k)[1]}</h3>${r.html}<p class="note">Periodo analizzato: ${S.name}, ${fmtD(S.d[0])} – ${fmtD(S.d[S.n - 1])}. ${seriesLabel(S)} Statistiche storiche, non previsioni.</p></div>`; r.draw && r.draw(); }
  catch (e) { console.warn(e); out.innerHTML = `<div class="card"><p class="warn">Analisi non disponibile per l'indice/periodo selezionato: ${e.message}.</p></div>`; }
}
const REGN = () => $("#regime").selectedOptions[0].text;
const T = s => ({ text: s, font: { size: 13 } });
const condTable = (R, H) => (H = R.H || H, table(["Condizione", "N. eventi", ...H.map(h => statLabel() + " " + h[1]), ...H.map(h => "% pos. " + h[1])], R.map(r => [r.n, r.ev.length + warnN(r.ev.length), ...r.st.map(s => pc(s.m)), ...r.st.map(s => pct(s.p, 0))])));
const condStats = (S, conds, H) => { const H2 = extraH(H); const R = conds.map(([n, f, g]) => { const ev = events(S, i => i > 0 && f(i), g); return { n, ev, st: H2.map(([h]) => { const a = ev.map(i => fwdD(S, i, h)).filter(x => !isNaN(x)); return { m: STAT(a), md: median(a), p: fracPos(a), a }; }) }; }); R.H = H2; return R; };
const ANS = {};
ANS.ath = S => {
  const athIdx = []; for (let i = 0; i < S.n; i++) if (S.ath[i] && S.mask[i]) athIdx.push(i);
  if (athIdx.length < 5) throw new Error("troppo pochi massimi storici nel periodo/regime selezionato (es. in bear market o sotto la MA200 un nuovo massimo è impossibile per definizione)");
  const allIdx = [...Array(S.n).keys()].filter(i => S.mask[i]);
  const fr = (ids, h) => ids.map(i => fwdY(S, i, h)).filter(x => !isNaN(x));
  const rowsA = [1, 3, 5, 10].map(h => { const a = fr(athIdx, h), b = fr(allIdx, h); return [`${h} ann${h > 1 ? "i" : "o"}`, pc(median(a)), pct(fracPos(a), 0), pc(median(b)), pct(fracPos(b), 0), a.length]; });
  const res = [], never = {};
  for (const X of [0.05, 0.1, 0.15, 0.2]) {
    let nv = 0; const waitDays = [];
    const nextHit = athIdx.map(i => { const lvl = S.c[i] * (1 - X); for (let j = i + 1; j < S.n; j++) if (S.c[j] <= lvl) { waitDays.push(j - i); return j; } nv++; return null; });
    never[X] = { n: nv, tot: athIdx.length, wait: median(waitDays) };
    for (const h of [1, 3, 5, 10]) {
      let beat = 0, cnt = 0, came = 0; const sB = [], sW = [];
      athIdx.forEach((i, k) => {
        const jE = lb(S.t, S.t[i] + h * YR); if (jE >= S.n) return;
        const buy = S.c[jE] / S.c[i] - 1, j = nextHit[k], hit = j != null && j <= jE;
        const wait = hit ? S.c[jE] / S.c[j] - 1 : 0; if (hit) came++;
        cnt++; sB.push(buy); sW.push(wait); if (wait > buy) beat++;
      });
      res.push({ X, h, cnt, beat: beat / cnt, mB: mean(sB), mW: mean(sW), came: came / cnt });
    }
  }
  const r5 = res.filter(r => r.h === 5), best = r5.map(r => `aspettando -${r.X * 100}% ${pc(r.mW)}`).join(", ");
  const a1 = fr(athIdx, 1), b1 = fr(allIdx, 1), [d1, i1] = div(), [d2, i2] = div();
  return {
    html: `<div class="answer">Sul ${S.name} si contano <b>${athIdx.length}</b> chiusure su nuovi massimi storici nel periodo. Il rendimento mediano a 1 anno comprando su un massimo è stato ${pc(median(a1))} (positivo nel ${pct(fracPos(a1), 0)} dei casi) contro ${pc(median(b1))} comprando in un giorno qualsiasi (${pct(fracPos(b1), 0)}). Su un orizzonte di 5 anni, il rendimento medio comprando subito sul massimo è stato ${pc(r5[0].mB)}, contro: ${best}. <b>In media aspettare la correzione ha reso meno</b>: quando la correzione arriva si compra più in basso (e si vince per costruzione), ma spesso non arriva entro l'orizzonte o non arriva affatto (il prezzo non è mai più tornato sotto il -10% di quel massimo nel ${pct(never[0.1].n / never[0.1].tot, 0)} dei casi), e il costo-opportunità prevale.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    <h3>Rendimenti futuri: acquisto su massimo storico vs giorno qualsiasi</h3>
    ${table(["Orizzonte", "Mediana (dai massimi)", "% positivi (dai massimi)", "Mediana (tutti i giorni)", "% positivi (tutti)", "N. casi (massimi)"], rowsA)}
    <h3>Strategia «aspetto la correzione»: da ogni massimo resto liquido finché il prezzo non scende X% sotto quel livello</h3>
    ${table(["Correzione attesa", "Orizzonte", "Rend. medio comprando subito", "Rend. medio aspettando", "% casi con correzione arrivata entro l'orizzonte", "% casi in cui aspettare è stato meglio", "N"], res.map(r => [`-${r.X * 100}%`, `${r.h} anni`, pc(r.mB), pc(r.mW), pct(r.came, 0), `<b>${pct(r.beat, 0)}</b>`, r.cnt]))}
    ${table(["Correzione attesa", "Massimi da cui il prezzo NON è mai più sceso di X% (fino a oggi)", "Attesa mediana quando è arrivata (giorni di borsa)"], [0.05, 0.1, 0.15, 0.2].map(X => [`-${X * 100}%`, `${never[X].n} su ${never[X].tot} (${pct(never[X].n / never[X].tot, 0)})`, never[X].wait]))}
    <p class="note">Liquidità in attesa remunerata 0%. Se la correzione non arriva entro l'orizzonte, chi aspetta ottiene 0%. I massimi ravvicinati generano campioni sovrapposti, non indipendenti.</p>`,
    draw() {
      plot(i1, [{ x: a1.map(x => x * 100), type: "histogram", name: "Da massimo storico", opacity: .7, marker: { color: C.gold }, histnorm: "percent", xbins: { size: 2.5 } }, { x: b1.map(x => x * 100), type: "histogram", name: "Giorno qualsiasi", opacity: .5, marker: { color: C.grey }, histnorm: "percent", xbins: { size: 2.5 } }], { barmode: "overlay", title: T("Distribuzione rendimento a 1 anno"), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "% casi", gridcolor: C.grid }, hovermode: "closest" });
      const xs = ["Compra subito", "Aspetta -5%", "Aspetta -10%", "Aspetta -15%", "Aspetta -20%"];
      plot(i2, [1, 3, 5, 10].map((h, k) => { const rr = res.filter(r => r.h === h); return { x: xs, y: [rr[0].mB, ...rr.map(r => r.mW)].map(v => v * 100), type: "bar", name: h + " anni", marker: { color: [C.gold, "#a08033", C.red, "#7a1a2a"][k] } }; }), { title: T("Rendimento medio dal massimo: comprare subito vs aspettare la correzione"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
ANS.midterm = S => {
  const Y = yearly(S).filter(x => !x.partial); if (Y.length < 8) throw new Error("servono almeno 8 anni");
  const cyc = y => ((y - 1) % 4 + 4) % 4 + 1;
  const NM = { 1: "1° anno (post-elezioni)", 2: "2° anno (midterm)", 3: "3° anno (pre-elettorale)", 4: "4° anno (presidenziali)" };
  const g = [1, 2, 3, 4].map(k => { const a = Y.filter(x => cyc(x.y) === k).map(x => x.r); return { k, a, m: mean(a), md: median(a), p: a.filter(x => x > 0).length, n: a.length }; });
  const mt = Y.filter(x => cyc(x.y) === 2);
  const lowFwd = mt.map(x => { let lo = -1; for (let i = 0; i < S.n; i++) if (S.y[i] === x.y && (lo < 0 || S.c[i] < S.c[lo])) lo = i; return { y: x.y, r: lo >= 0 ? fwdY(S, lo, 1) : NaN }; });
  const lf = lowFwd.map(x => x.r).filter(x => !isNaN(x)), [d1, i1] = div(), [d2, i2] = div(), m = g[1];
  const bestK = [...g].sort((a, b) => b.m - a.m)[0];
  return {
    html: `<div class="answer">Anni di midterm analizzati: <b>${m.n}</b>. Positivi: <b>${m.p}</b>, negativi: <b>${m.n - m.p}</b> (${pct(m.p / m.n, 0)} positivi). Rendimento medio ${pc(m.m)}, mediano ${pc(m.md)}. Nel ciclo presidenziale l'anno migliore in media è il ${NM[bestK.k]} (${pc(bestK.m)}). Dal minimo dell'anno di midterm, il rendimento a 12 mesi è stato in media ${pc(mean(lf))} e positivo nel ${pct(fracPos(lf), 0)} dei casi.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Anno del ciclo", "N", "Positivi", "Negativi", "% positivi", "Media", "Mediana"], g.map(x => [NM[x.k], x.n, x.p, x.n - x.p, pct(x.p / x.n, 0), pc(x.m), pc(x.md)]))}
    <h3>Dettaglio anni di midterm</h3>${table(["Anno", "Rendimento anno", "Rend. 12 mesi dal minimo dell'anno"], mt.map((x, k) => [x.y, pc(x.r), pc(lowFwd[k].r)]))}`,
    draw() {
      plot(i1, [{ x: g.map(x => NM[x.k]), y: g.map(x => x.m * 100), type: "bar", name: "Rend. medio", marker: { color: [C.grey, C.red, C.gold, C.blue] } }, { x: g.map(x => NM[x.k]), y: g.map(x => x.p / x.n * 100), type: "scatter", mode: "markers+text", text: g.map(x => pct(x.p / x.n, 0)), textposition: "top center", yaxis: "y2", name: "% anni positivi", marker: { color: C.text, size: 9 } }], { title: T("Ciclo presidenziale: rendimento medio e % anni positivi"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis2: { overlaying: "y", side: "right", range: [0, 115], ticksuffix: "%", showgrid: false }, hovermode: "closest" });
      plot(i2, [{ x: mt.map(x => String(x.y)), y: mt.map(x => x.r * 100), type: "bar", marker: { color: mt.map(x => x.r >= 0 ? C.green : C.red) }, hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" }], { title: T("Rendimento negli anni di midterm"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
const closeAtF = S => (y, m) => { const i = lb(S.d, `${y}-${String(m).padStart(2, "0")}-32`) - 1; return i >= 0 && S.y[i] === y && S.m[i] === m ? S.c[i] : null; };
ANS.season = S => {
  const M = monthly(S); if (M.length < 24) throw new Error("servono almeno 2 anni");
  const g = MESI.map((n, k) => { const a = M.filter(x => x.m === k + 1).map(x => x.r); return { n, a, m: mean(a), md: median(a), p: fracPos(a) }; });
  const closeAt = closeAtF(S), sem = [];
  for (const y of new Set(S.y)) { const a = closeAt(y - 1, 10), b = closeAt(y, 4), c = closeAt(y, 10); if (a && b && c && S.d[S.n - 1] >= `${y}-10-28`) sem.push({ y, w: b / a - 1, s: c / b - 1 }); }
  const best = [...g].sort((a, b) => b.m - a.m), [d1, i1] = div(), [d2, i2] = div(), wW = sem.filter(x => x.w > x.s).length;
  return {
    html: `<div class="answer">Mese mediamente migliore: <b>${best[0].n}</b> (${pc(best[0].m, 2)}, positivo nel ${pct(best[0].p, 0)} dei casi); peggiore: <b>${best[11].n}</b> (${pc(best[11].m, 2)}, positivo nel ${pct(best[11].p, 0)}). «Sell in May»: il semestre novembre-aprile ha reso in media ${pc(mean(sem.map(x => x.w)))} contro ${pc(mean(sem.map(x => x.s)))} di maggio-ottobre, ed è stato migliore in ${wW} anni su ${sem.length}. Però maggio-ottobre è stato comunque positivo nel ${pct(fracPos(sem.map(x => x.s)), 0)} dei casi: uscire dal mercato ha spesso significato rinunciare a guadagni.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Mese", "N", "Media", "Mediana", "% positivi", "Migliore", "Peggiore"], g.map(x => [x.n, x.a.length, pc(x.m, 2), pc(x.md, 2), pct(x.p, 0), pc(Math.max(...x.a)), pc(Math.min(...x.a))]))}`,
    draw() {
      plot(i1, [{ x: MESI, y: g.map(x => x.m * 100), type: "bar", name: "Rend. medio", marker: { color: g.map(x => x.m >= 0 ? C.gold : C.red) } }, { x: MESI, y: g.map(x => x.p * 100), yaxis: "y2", mode: "lines+markers", name: "% mesi positivi", line: { color: C.text, width: 1 } }], { title: T("Rendimento medio mensile e % mesi positivi"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis2: { overlaying: "y", side: "right", ticksuffix: "%", range: [0, 100], showgrid: false }, hovermode: "closest" });
      plot(i2, [{ x: sem.map(x => x.y), y: sem.map(x => x.w * 100), type: "bar", name: "Nov–Apr", marker: { color: C.gold } }, { x: sem.map(x => x.y), y: sem.map(x => x.s * 100), type: "bar", name: "Mag–Ott", marker: { color: C.red } }], { title: T("Sell in May: semestri a confronto"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid } });
    }
  };
};
ANS.annual = S => {
  const Y = yearly(S).filter(x => !x.partial); if (Y.length < 3) throw new Error("servono almeno 3 anni");
  const a = Y.map(x => x.r), s = [...Y].sort((x, y) => x.r - y.r), [d1, i1] = div(), [d2, i2] = div();
  const bk = [[-9, -.3], [-.3, -.2], [-.2, -.1], [-.1, 0], [0, .1], [.1, .2], [.2, .3], [.3, 9]];
  return {
    html: `<div class="answer">Su <b>${Y.length}</b> anni solari completi (${Y[0].y}–${Y[Y.length - 1].y}) il ${S.name} ha chiuso in positivo <b>${a.filter(x => x > 0).length}</b> volte (${pct(fracPos(a), 1)}) e in negativo ${a.filter(x => x <= 0).length}. Rendimento medio ${pc(mean(a))}, mediano ${pc(median(a))}, deviazione standard ${pct(std(a))}. Anno migliore ${s[s.length - 1].y} (${pc(s[s.length - 1].r)}), peggiore ${s[0].y} (${pc(s[0].r)}).</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Fascia di rendimento", "N. anni", "%", "Anni"], bk.map(([lo, hi]) => { const z = Y.filter(x => x.r >= lo && x.r < hi); return [lo < -1 ? "< " + pct(hi, 0) : hi > 1 ? "> " + pct(lo, 0) : pct(lo, 0) + " / " + pct(hi, 0), z.length, pct(z.length / Y.length, 0), `<span class="muted">${z.map(x => x.y).join(", ")}</span>`]; }))}`,
    draw() {
      plot(i1, [{ x: a.map(x => x * 100), type: "histogram", xbins: { start: -50, end: 60, size: 5 }, marker: { color: C.gold, line: { color: "#ffffff", width: 1.5 } }, hovertemplate: "%{x}%: %{y} anni<extra></extra>" }], { title: T("Istogramma dei rendimenti annuali (classi del 5%)"), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "N. anni", gridcolor: C.grid }, hovermode: "closest" });
      plot(i2, [{ x: Y.map(x => x.y), y: a.map(x => x * 100), type: "bar", marker: { color: a.map(x => x >= 0 ? C.green : C.red) }, hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" }], { title: T("Rendimento per anno"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
ANS.dd = S => {
  const E = episodes(S, -0.1); if (!E.length) throw new Error("nessun drawdown superiore al 10%");
  const top = E.slice(0, 15), [d1, i1] = div(), [d2, i2] = div();
  const td = (a, b) => b == null ? "in corso" : (yrs(S.t[a], S.t[b]) * 12).toFixed(0) + " mesi";
  const cnt = [10, 20, 30, 40, 50].map(x => [`Calo ≥ ${x}%`, E.filter(e => e.depth <= -x / 100).length]);
  const rec = E.filter(e => e.r != null);
  return {
    html: `<div class="answer">Nel periodo si contano <b>${E.length}</b> ribassi di almeno il 10% dal massimo (${E.filter(e => e.depth <= -.2).length} oltre il 20%, cioè «bear market»). Il più profondo: ${pc(top[0].depth)} dal ${fmtD(S.d[top[0].p])} al ${fmtD(S.d[top[0].t])}${top[0].r != null ? `, massimi recuperati il ${fmtD(S.d[top[0].r])}` : ", non ancora recuperato"}. Durata mediana dal picco al recupero dei massimi: ${(median(rec.map(e => yrs(S.t[e.p], S.t[e.r]))) * 12).toFixed(0)} mesi.</div>
    <div>${d1}</div><div class="grid2"><div>${d2}</div><div>${table(["Profondità", "N. episodi"], cnt)}</div></div>
    <h3>I ${top.length} drawdown più profondi</h3>
    ${table(["Picco", "Minimo", "Recupero massimi", "Profondità", "Discesa", "Risalita (min→max)", "Totale sott'acqua"], top.map(e => [fmtD(S.d[e.p]), fmtD(S.d[e.t]), e.r != null ? fmtD(S.d[e.r]) : "–", pc(e.depth), td(e.p, e.t), td(e.t, e.r), td(e.p, e.r)]))}
    <p class="note">Calcolato sulle chiusure giornaliere nel periodo selezionato (il primo giorno del periodo è il primo «massimo»).</p>`,
    draw() {
      let pk = -Infinity; const dd = S.c.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; });
      plot(i1, [{ x: S.d, y: dd, fill: "tozeroy", type: "scatter", line: { color: C.red, width: 1 }, fillcolor: "rgba(192,40,63,.3)", hovertemplate: "%{y:.1f}%<extra></extra>" }], { title: T("Grafico «underwater»: distanza dal massimo storico"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
      plot(i2, [{ x: top.map(e => e.depth * 100), y: top.map(e => yrs(S.t[e.p], S.t[e.r ?? S.n - 1]) * 12), text: top.map(e => S.d[e.p].slice(0, 4)), mode: "markers+text", textposition: "top center", marker: { color: C.gold, size: 10 }, type: "scatter", hovertemplate: "%{text}: %{x:.1f}%, %{y:.0f} mesi<extra></extra>" }], { title: T("Profondità vs mesi sott'acqua"), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "Mesi", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
ANS.drops = S => {
  const H = [[5, "1 sett."], [21, "1 mese"], [63, "3 mesi"], [126, "6 mesi"], [252, "1 anno"]];
  const R = condStats(S, [["Tutti i giorni (base)", i => true, 1], ["Calo giornaliero ≤ -3%", i => S.r[i] <= -.03, 5], ["Calo giornaliero ≤ -5%", i => S.r[i] <= -.05, 5], ["Calo giornaliero ≤ -7%", i => S.r[i] <= -.07, 5],
    ["3 giorni consecutivi di ribasso", i => S.down[i] === 3, 1], ["5 giorni consecutivi di ribasso", i => S.down[i] === 5, 1], ["7 giorni consecutivi di ribasso", i => S.down[i] === 7, 1]], H);
  const [d1, i1] = div(), [d2, i2] = div();
  return {
    html: `<div class="answer">Dopo un calo giornaliero di almeno il 3% (${R[1].ev.length} episodi, distanti ≥5 giorni) il rendimento medio a 1 anno è stato ${pc(R[1].st[4].m)} (positivo nel ${pct(R[1].st[4].p, 0)} dei casi) contro ${pc(R[0].st[4].m)} di un giorno qualsiasi. Dopo cali ≤ -5% (${R[2].ev.length} episodi): ${pc(R[2].st[4].m)} a 1 anno, positivo nel ${pct(R[2].st[4].p, 0)}. Dopo 5 sedute consecutive in ribasso (${R[5].ev.length} casi): ${pc(R[5].st[1].m)} a 1 mese. I cali forti si concentrano nelle crisi (1929-32, 1987, 2008, 2020): nel breve la volatilità resta alta.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>${condTable(R, H)}
    <p class="note">Orizzonti in giorni di borsa (21 ≈ 1 mese, 252 ≈ 1 anno).</p>`,
    draw() {
      plot(i1, R.map((r, k) => ({ x: H.map(h => h[1]), y: r.st.map(s => s.m * 100), type: "bar", name: r.n, marker: { color: ["#555", C.gold, C.red, "#7a1a2a", "#7d9bd1", C.blue, "#2f4d85"][k] } })), { title: T("Rendimento medio successivo"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest", legend: { orientation: "h", y: -0.18 }, margin: { l: 55, r: 20, t: 30, b: 100 } });
      plot(i2, [{ x: R[1].st[4].a.map(x => x * 100), type: "histogram", name: "Dopo calo ≤ -3%", histnorm: "percent", marker: { color: C.gold }, opacity: .75, xbins: { size: 5 } }, { x: R[0].st[4].a.map(x => x * 100), type: "histogram", name: "Base", histnorm: "percent", marker: { color: C.grey }, opacity: .45, xbins: { size: 5 } }], { barmode: "overlay", title: T("Distribuzione rendimento a 1 anno dopo un calo ≤ -3%"), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "% casi", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
ANS.vix = S => {
  if (S.key === "^VIX") throw new Error("selezionare un indice azionario, non il VIX stesso");
  if (S.vix.filter(x => !isNaN(x)).length < 300) throw new Error("il VIX è disponibile solo dal 1990: allargare il periodo");
  const H = [[21, "1 mese"], [63, "3 mesi"], [126, "6 mesi"], [252, "1 anno"]];
  const R = condStats(S, [["Giorni con VIX (base)", i => !isNaN(S.vix[i]), 1], ["VIX < 15", i => S.vix[i] < 15, 21], ["VIX supera 30", i => S.vix[i] > 30 && !(S.vix[i - 1] > 30), 21], ["VIX supera 40", i => S.vix[i] > 40 && !(S.vix[i - 1] > 40), 21], ["VIX supera 50", i => S.vix[i] > 50 && !(S.vix[i - 1] > 50), 21]], H);
  const [d1, i1] = div(), [d2, i2] = div(), v30 = R[2], v40 = R[3];
  return {
    html: `<div class="answer">Quando il VIX ha superato 30 (${v30.ev.length} episodi, distanti ≥21 giorni), il ${S.name} ha reso in media ${pc(v30.st[3].m)} nei 12 mesi successivi (positivo nel ${pct(v30.st[3].p, 0)} dei casi). Sopra 40 (${v40.ev.length} episodi): ${pc(v40.st[3].m)} a 12 mesi, positivo nel ${pct(v40.st[3].p, 0)}. Base (giorno qualsiasi dal 1990): ${pc(R[0].st[3].m)}. La paura estrema è stata spesso un'opportunità di medio periodo, ma con forte dispersione (es. settembre-ottobre 2008, seguiti da ulteriori cali).</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>${condTable(R, H)}
    <h3>Episodi VIX &gt; 40</h3>${table(["Data", "VIX", "Rend. 3 mesi", "Rend. 1 anno"], v40.ev.map(i => [fmtD(S.d[i]), num(S.vix[i], 1), pc(fwdD(S, i, 63)), pc(fwdD(S, i, 252))]))}`,
    draw() {
      plot(i1, [{ x: S.d, y: S.vix, type: "scatter", line: { color: C.red, width: 1 }, name: "VIX" }], { title: T("VIX (soglie 30 e 40)"), shapes: [30, 40].map(y => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.gold, dash: "dot", width: 1 } })), yaxis: { gridcolor: C.grid } });
      plot(i2, R.map((r, k) => ({ x: H.map(h => h[1]), y: r.st.map(s => s.m * 100), type: "bar", name: r.n, marker: { color: ["#555", C.blue, C.gold, C.red, "#7a1a2a"][k] } })), { title: T("Rendimento medio successivo dell'indice"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
ANS.hold = S => {
  const R = [1, 3, 5, 10, 15, 20].map(h => { const a = []; for (let i = 0; i < S.n; i++) { const x = fwdY(S, i, h); if (isNaN(x)) break; if (S.mask[i]) a.push((1 + x) ** (1 / h) - 1); } return { h, a, p: fracPos(a), m: median(a), mn: Math.min(...a), mx: Math.max(...a) }; }).filter(r => r.a.length > 20);
  if (!R.length) throw new Error("periodo troppo breve");
  const [d1, i1] = div(), [d2, i2] = div();
  return {
    html: `<div class="answer">Investendo in un giorno qualsiasi del periodo e mantenendo l'investimento, la probabilità storica di trovarsi in guadagno è stata: ${R.map(r => `<b>${r.h} ann${r.h > 1 ? "i" : "o"}: ${pct(r.p, 0)}</b>`).join(" · ")}. Più lungo l'orizzonte, più stretta la forbice tra caso peggiore e migliore.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Orizzonte", "N. finestre giornaliere", "% in guadagno", "Rend. annuo mediano", "Peggiore (annuo)", "Migliore (annuo)"], R.map(r => [r.h + " anni", r.a.length.toLocaleString("it-IT"), `<b>${pct(r.p, 1)}</b>`, pc(r.m), pc(r.mn), pc(r.mx)]))}
    <p class="note">Finestre mobili con partenza in ogni giorno di borsa (fortemente sovrapposte). Indici di prezzo: con i dividendi le percentuali sarebbero più alte.</p>`,
    draw() {
      plot(i1, [{ x: R.map(r => r.h + " anni"), y: R.map(r => r.p * 100), type: "bar", marker: { color: C.gold }, text: R.map(r => pct(r.p, 0)), textposition: "outside" }], { title: T("Probabilità di guadagno per orizzonte"), yaxis: { ticksuffix: "%", range: [0, 110], gridcolor: C.grid }, hovermode: "closest" });
      plot(i2, R.map((r, k) => ({ y: r.a.map(x => x * 100), type: "box", name: r.h + " anni", marker: { color: [C.red, "#d0603a", C.gold, "#a0b050", C.green, C.blue][k] }, boxpoints: false })), { title: T("Dispersione del rendimento annuo composto"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, showlegend: false, hovermode: "closest" });
    }
  };
};
ANS.osc = S => {
  if (S.key === "^VIX") throw new Error("selezionare un indice azionario");
  const H = [[21, "1 mese"], [63, "3 mesi"], [252, "1 anno"]];
  const valid = [...Array(S.n).keys()].filter(i => !isNaN(S.dist[i]) && S.mask[i]);
  if (valid.length < 300) throw new Error("dati insufficienti");
  const sd = valid.map(i => S.dist[i]).sort((a, b) => a - b), q = p => sd[Math.floor(p * (sd.length - 1))];
  const R = condStats(S, [["Base (tutti i giorni)", i => true, 1], ["RSI(14) < 30 (ipervenduto)", i => S.rsi[i] < 30, 10], ["RSI(14) < 20", i => S.rsi[i] < 20, 10], ["RSI(14) > 70 (ipercomprato)", i => S.rsi[i] > 70, 10], ["RSI(14) > 80", i => S.rsi[i] > 80, 10],
    [`Distanza MA200 ≤ 5° percentile (≤ ${pct(q(.05))})`, i => S.dist[i] <= q(.05), 10], [`Distanza MA200 ≥ 95° percentile (≥ ${pct(q(.95))})`, i => S.dist[i] >= q(.95), 10]], H);
  const dec = []; for (let k = 0; k < 10; k++) { const lo = q(k / 10), hi = k === 9 ? Infinity : q((k + 1) / 10); const a = valid.filter(i => S.dist[i] >= lo && S.dist[i] < hi).map(i => fwdD(S, i, 252)).filter(x => !isNaN(x)); dec.push({ k, lo, hi, m: mean(a), p: fracPos(a) }); }
  const [d1, i1] = div(), [d2, i2] = div();
  return {
    html: `<div class="answer">RSI(14) sotto 30 (${R[1].ev.length} segnali distanziati ≥10 giorni): rendimento medio a 3 mesi ${pc(R[1].st[1].m)}, a 1 anno ${pc(R[1].st[2].m)} (positivo nel ${pct(R[1].st[2].p, 0)}). RSI sopra 70: a 1 anno ${pc(R[3].st[2].m)} (positivo nel ${pct(R[3].st[2].p, 0)}): sugli indici l'ipercomprato è spesso un segno di forza (momentum), non necessariamente di inversione. Distanza dalla media a 200 giorni all'ultimo giorno del periodo: ${pct(S.dist[S.n - 1])}; nei casi estremi negativi (≤ ${pct(q(.05))}, 5° percentile) il rendimento medio a 1 anno è stato ${pc(R[5].st[2].m)}.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>${condTable(R, H)}
    ${table(["Decile distanza da MA200", "Intervallo", "Rend. medio 1 anno", "% positivi 1 anno"], dec.map(d => [`${d.k + 1}°`, `${pct(d.lo)} / ${d.hi === Infinity ? "max" : pct(d.hi)}`, pc(d.m), pct(d.p, 0)]))}`,
    draw() {
      plot(i1, [{ x: dec.map(d => `D${d.k + 1}`), y: dec.map(d => d.m * 100), type: "bar", marker: { color: dec.map(d => d.k < 2 ? C.green : d.k > 7 ? C.red : C.gold) } }], { title: T("Rend. medio a 1 anno per decile di distanza dalla MA200"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, xaxis: { title: "D1 = molto sotto la media · D10 = molto sopra" }, hovermode: "closest" });
      const i0 = Math.max(0, S.n - 756);
      plot(i2, [{ x: S.d.slice(i0), y: S.rsi.slice(i0), type: "scatter", line: { color: C.gold, width: 1 }, name: "RSI(14)" }], { title: T("RSI(14) ultimi 3 anni del periodo"), yaxis: { range: [0, 100], gridcolor: C.grid }, shapes: [30, 70].map(y => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.red, dash: "dot" } })) });
    }
  };
};
ANS.jan = S => {
  const closeAt = closeAtF(S), R = [];
  for (const y of new Set(S.y)) { const p = closeAt(y - 1, 12), j = closeAt(y, 1), q = closeAt(y, 3), d = closeAt(y, 12); if (p && j && q && d && S.d[S.n - 1] >= `${y}-12-24`) R.push({ y, jan: j / p - 1, q1: q / p - 1, restJ: d / j - 1, restQ: d / q - 1, yr: d / p - 1 }); }
  if (R.length < 8) throw new Error("servono almeno 8 anni");
  const g = (f, k) => { const a = R.filter(f).map(x => x[k]); return { n: a.length, m: mean(a), p: fracPos(a) }; };
  const jp = g(x => x.jan > 0, "restJ"), jn = g(x => x.jan <= 0, "restJ"), qp = g(x => x.q1 > 0, "restQ"), qn = g(x => x.q1 <= 0, "restQ");
  const hit = R.filter(x => (x.jan > 0) === (x.yr > 0)).length, [d1, i1] = div();
  return {
    html: `<div class="answer">Con gennaio positivo (${jp.n} anni) il resto dell'anno (feb-dic) ha reso in media ${pc(jp.m)} ed è stato positivo nel ${pct(jp.p, 0)} dei casi; con gennaio negativo (${jn.n} anni): ${pc(jn.m)}, positivo nel ${pct(jn.p, 0)}. Il segno di gennaio ha coinciso con quello dell'intero anno in ${hit} anni su ${R.length} (${pct(hit / R.length, 0)}; nota: gennaio fa parte dell'anno, il che gonfia la coincidenza). Primo trimestre positivo → resto dell'anno ${pc(qp.m)} (positivo ${pct(qp.p, 0)}); negativo → ${pc(qn.m)} (positivo ${pct(qn.p, 0)}).</div>
    ${d1}
    ${table(["Condizione", "N. anni", "Rend. medio resto dell'anno", "% resto anno positivo"], [["Gennaio positivo", jp.n, pc(jp.m), pct(jp.p, 0)], ["Gennaio negativo", jn.n, pc(jn.m), pct(jn.p, 0)], ["1° trimestre positivo", qp.n, pc(qp.m), pct(qp.p, 0)], ["1° trimestre negativo", qn.n, pc(qn.m), pct(qn.p, 0)]])}`,
    draw() {
      plot(i1, [{ x: R.map(x => x.jan * 100), y: R.map(x => x.restJ * 100), text: R.map(x => x.y), mode: "markers", type: "scatter", marker: { color: R.map(x => x.restJ > 0 ? C.green : C.red), size: 8 }, hovertemplate: "%{text}: gen %{x:.1f}%, feb-dic %{y:.1f}%<extra></extra>" }], { title: T("Rendimento di gennaio vs resto dell'anno"), xaxis: { title: "Gennaio", ticksuffix: "%", gridcolor: C.grid, zerolinecolor: "#666" }, yaxis: { title: "Febbraio–Dicembre", ticksuffix: "%", gridcolor: C.grid, zerolinecolor: "#666" }, hovermode: "closest" });
    }
  };
};

/* ===== Costruttore di query ===== */
function customQuery(S, cond, v, h, gap) {
  const F = { all: i => true, rsiLt: i => S.rsi[i] < v, rsiGt: i => S.rsi[i] > v, maLt: i => S.dist[i] * 100 < v, maGt: i => S.dist[i] * 100 > v, ddLe: i => S.dd[i] * 100 <= -Math.abs(v), retLe: i => S.r[i] * 100 <= -Math.abs(v), retGe: i => S.r[i] * 100 >= v, downN: i => S.down[i] === v, vixGt: i => S.vix[i] > v, vixLt: i => S.vix[i] < v, ath: i => S.ath[i], month: i => S.m[i] === v && S.m[i - 1] !== v, wd: i => new Date(S.t[i]).getUTCDay() === v };
  const ev = events(S, i => i > 0 && F[cond](i), gap), a = ev.map(i => fwdD(S, i, h)).filter(x => !isNaN(x));
  const base = []; for (let i = 0; i + h < S.n; i++) if (!S.mask || S.mask[i]) base.push(S.c[i + h] / S.c[i] - 1);
  return { ev, a, base };
}
function renderCustom() {
  const S = st.S, cond = $("#cbCond").value, v = +$("#cbVal").value, h = +$("#cbH").value, gap = Math.max(1, +$("#cbGap").value);
  const { ev, a, base } = customQuery(S, cond, v, h, gap), hl = $("#cbH").selectedOptions[0].text, cl = $("#cbCond").selectedOptions[0].text + (["all", "ath"].includes(cond) ? "" : " " + v);
  if (!a.length) { $("#cbOut").innerHTML = `<p class="warn">Nessun evento utilizzabile con questa condizione nel periodo (eventi trovati: ${ev.length}; l'orizzonte può superare la fine dei dati).</p>`; return; }
  const [d1, i1] = div(), [d2, i2] = div();
  $("#cbOut").innerHTML = `<div class="answer">«${cl}» si è verificato <b>${ev.length}</b> volte${warnN(ev.length)} (eventi distanti almeno ${gap} giorni di borsa). Rendimento a ${hl}: medio ${pc(mean(a))}, mediano ${pc(median(a))}, positivo nel <b>${pct(fracPos(a), 0)}</b> dei casi, contro ${pc(mean(base))} / ${pct(fracPos(base), 0)} di un giorno qualsiasi.</div>
   ${table(["", "N", "Media", "Mediana", "% positivi", "Peggiore", "Migliore", "Dev. std"], [["Condizione", a.length, pc(mean(a)), pc(median(a)), pct(fracPos(a), 0), pc(Math.min(...a)), pc(Math.max(...a)), pct(std(a))], ["Base (tutti i giorni)", base.length, pc(mean(base)), pc(median(base)), pct(fracPos(base), 0), pc(Math.min(...base)), pc(Math.max(...base)), pct(std(base))]])}
   <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
   <details><summary class="muted">Elenco eventi (ultimi 50)</summary>${table(["Data", "Chiusura", "Rend. " + hl], ev.slice(-50).reverse().map(i => [fmtD(S.d[i]), num(S.c[i]), pc(fwdD(S, i, h))]))}</details>`;
  plot(i1, [{ x: a.map(x => x * 100), type: "histogram", histnorm: "percent", name: "Condizione", marker: { color: C.gold }, opacity: .75 }, { x: base.map(x => x * 100), type: "histogram", histnorm: "percent", name: "Base", marker: { color: C.grey }, opacity: .4 }], { barmode: "overlay", title: T(`Distribuzione rendimento a ${hl}`), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "% casi", gridcolor: C.grid }, hovermode: "closest" });
  plot(i2, [{ x: S.d, y: S.c, type: "scatter", line: { color: "#777", width: 1 }, name: S.name }, { x: ev.map(i => S.d[i]), y: ev.map(i => S.c[i]), mode: "markers", type: "scatter", marker: { color: C.red, size: 6 }, name: "Eventi" }], { title: T("Dove si sono verificati gli eventi"), yaxis: { type: "log", gridcolor: C.grid } });
}

/* ===== Fai una domanda (parole chiave) ===== */
const KW = [
  ["ath", ["massim", "ath", "record", "correzion", "aspettar", "entrare", "comprare ora", "top"]],
  ["midterm", ["midterm", "mid term", "elezion", "presidenz", "ciclo"]],
  ["season", ["mese", "mesi", "stagional", "sell in may", "maggio", "settembre", "dicembre", "ottobre", "novembre", "agosto", "estate", "natale", "aprile"]],
  ["annual", ["anni positiv", "annual", "anno positiv", "distribuz", "istogramma", "quanti anni", "anni negativ"]],
  ["dd", ["drawdown", "crollo", "crolli", "crisi", "recuper", "bear", "orso", "perdita massima", "2008", "1929"]],
  ["drops", ["calo", "cali", "scende", "ribass", "consecutiv", "caduta", "giornata negativa"]],
  ["vix", ["vix", "volatilit", "paura", "panico"]],
  ["hold", ["probabilit", "orizzonte", "detenzion", "lungo periodo", "lungo termine", "20 anni", "10 anni", "tenere", "perdere soldi"]],
  ["osc", ["rsi", "ipercomprat", "ipervendut", "media mobile", "mm200", "eccess", "sovracomprat", "oversold", "overbought"]],
  ["jan", ["gennaio", "barometr", "trimestre", "inizio anno"]],
  ["__pac", ["pac", "piano di accumulo", "lump", "unica soluzione", "versament", "rata"]],
  ["__bt", ["backtest", "strategi", "incrocio", "golden cross", "trading"]],
  ["__sig", ["oggi", "adesso", "attual", "segnal", "situazione", "ora il mercato"]],
];
function ask() {
  const q = " " + $("#q").value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
  if (!q.trim()) return;
  let m;
  if ((m = q.match(/vix\s*(sopra|oltre|>|maggiore di|supera)\s*(\d+)/))) return setQuery("vixGt", +m[2]);
  if ((m = q.match(/vix\s*(sotto|<|minore di)\s*(\d+)/))) return setQuery("vixLt", +m[2]);
  if ((m = q.match(/rsi\s*(sotto|<|minore di)\s*(\d+)/))) return setQuery("rsiLt", +m[2]);
  if ((m = q.match(/rsi\s*(sopra|>|oltre|maggiore di)\s*(\d+)/))) return setQuery("rsiGt", +m[2]);
  if ((m = q.match(/(\d+)\s*(sedute|giorni)\s*(consecutiv\w*\s*)?(di\s*)?(ribasso|calo|negativ)/))) return setQuery("downN", +m[1]);
  if (!q.includes("massim") && !q.includes("correzion") && (m = q.match(/(calo|cala|perde|scende|ribasso|crollo)[^\d]{0,25}(\d+(?:[.,]\d+)?)\s*%/))) return setQuery("retLe", +m[2].replace(",", "."));
  if ((m = q.match(/(sotto|lontano|distanza)[^\d]{0,30}(\d+)\s*%[^\d]{0,20}(media|mm|200)/))) return setQuery("maLt", -m[2]);
  const sc = KW.map(([k, w]) => [k, w.filter(x => q.includes(x)).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if (!sc.length) { $("#qMsg").innerHTML = `<span class="warn">Non ho riconosciuto la domanda.</span> Posso rispondere su: massimi storici e correzioni, midterm e ciclo presidenziale, stagionalità e mesi, anni positivi, drawdown e crisi, cali forti e giorni consecutivi di ribasso, VIX, probabilità per orizzonte, RSI e media a 200 giorni, gennaio/primo trimestre, PAC e backtest, segnali attuali. Per condizioni personalizzate usa il costruttore qui sotto.`; return; }
  const k = sc[0][0];
  if (k === "__pac" || k === "__bt") { $("#qMsg").innerHTML = `Ho aperto la sezione <b>Backtest</b>.`; showTab("bt"); k === "__pac" ? runPac() : runStrat(); return; }
  if (k.startsWith("__")) { const tab = { __sig: "signals", __macro: "macro" }[k] || "faq"; $("#qMsg").innerHTML = `Ho aperto la sezione corrispondente.`; showTab(tab); return; }
  $("#qMsg").innerHTML = `Ho interpretato la domanda come: <b>${FAQ.find(f => f[0] === k)[1]}</b> (risposta nella scheda Domande frequenti).`;
  showTab("faq"); runFaq(k);
}
function setQuery(cond, v) { $("#cbCond").value = cond; $("#cbVal").value = v; $("#cbH").value = "252"; $("#qMsg").innerHTML = `Ho impostato il costruttore di query: <b>${$("#cbCond").selectedOptions[0].text} ${v}</b>, orizzonte 1 anno. Puoi cambiare orizzonte e ricalcolare.`; renderCustom(); }

/* ===== Backtest ===== */
function metrics(d, eq, inv) {
  const n = eq.length, Y = yrs(Date.parse(d[0]), Date.parse(d[n - 1])), dr = []; for (let i = 1; i < n; i++) dr.push(eq[i] / eq[i - 1] - 1);
  let pk = -Infinity, md = 0; for (const v of eq) { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); }
  const vol = std(dr) * Math.sqrt(252);
  return { cagr: (eq[n - 1] / eq[0]) ** (1 / Y) - 1, vol, sharpe: mean(dr) * 252 / vol, md, tot: eq[n - 1] / eq[0] - 1, inv: inv ? mean(inv) : 1 };
}
const maxDD = a => { let pk = -Infinity, md = 0; for (const v of a) { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); } return md; };
function runPac() {
  const F = FULL[st.ek], amt = +$("#pacAmt").value, i0 = lb(F.d, $("#pacFrom").value), i1 = lb(F.d, $("#pacTo").value + "~") - 1;
  if (i1 - i0 < 40 || amt <= 0) { $("#pacOut").innerHTML = `<p class="warn">Periodo troppo breve o importo non valido (indice disponibile dal ${fmtD(F.d[0])}).</p>`; return; }
  const newM = i => i === i0 || F.d[i].slice(5, 7) !== F.d[i - 1].slice(5, 7);
  let months = 0; for (let i = i0; i <= i1; i++) if (newM(i)) months++;
  const total = months * amt, lumpSh = total / F.c[i0], d = [], pac = [], lump = [], capP = [], flows = []; let sh = 0, cap = 0;
  for (let i = i0; i <= i1; i++) {
    if (newM(i)) { sh += amt / F.c[i]; cap += amt; flows.push([F.t[i], -amt]); }
    d.push(F.d[i]); pac.push(sh * F.c[i]); lump.push(lumpSh * F.c[i]); capP.push(cap);
  }
  const pf = pac[pac.length - 1], lf = lump[lump.length - 1]; flows.push([F.t[i1], pf]);
  const npv = r => flows.reduce((s, [t, v]) => s + v / (1 + r) ** ((t - flows[0][0]) / YR), 0);
  let lo = -0.99, hi = 2; for (let it = 0; it < 200; it++) { const mm = (lo + hi) / 2; if (npv(mm) > 0) lo = mm; else hi = mm; }
  const irr = (lo + hi) / 2, lm = metrics(d, lump), pacPL = pac.map((v, i) => v / capP[i] - 1);
  const [d1, i1d] = div("chart tall"), [d2, i2d] = div();
  $("#pacOut").innerHTML = `<div class="answer">${F.name}, ${fmtD(d[0])} – ${fmtD(d[d.length - 1])} (${months} rate mensili). Capitale complessivo ${num(total, 0)}. <b>Lump sum</b>: valore finale ${num(lf, 0)} (CAGR ${pc(lm.cagr, 2)}). <b>PAC</b> da ${num(amt, 0)}/mese: valore finale ${num(pf, 0)} (rendimento annuo money-weighted/IRR ${pc(irr, 2)}). ${lf > pf ? "In questo periodo la lump sum ha battuto il PAC" : "In questo periodo il PAC ha battuto la lump sum"} di ${num(Math.abs(lf - pf), 0)}. In mercati crescenti la lump sum tende a vincere (capitale investito più a lungo); il PAC riduce il rischio di entrare nel momento sbagliato.</div>
  ${table(["", "Capitale investito", "Valore finale", "Guadagno %", "Rend. annuo", "Max drawdown del valore", "Peggior perdita sul versato"], [["Lump sum", num(total, 0), num(lf, 0), pc(lf / total - 1), pc(lm.cagr, 2) + " (CAGR)", pc(lm.md), pc(Math.min(0, ...lump.map(v => v / total - 1)))], ["PAC", num(total, 0), num(pf, 0), pc(pf / total - 1), pc(irr, 2) + " (IRR)", pc(maxDD(pac)), pc(Math.min(0, ...pacPL))]])}
  ${d1}${d2}`;
  plot(i1d, [{ x: d, y: lump, name: "Lump sum", line: { color: C.gold, width: 1.5 }, type: "scatter" }, { x: d, y: pac, name: "PAC", line: { color: C.red, width: 1.5 }, type: "scatter" }, { x: d, y: capP, name: "Capitale versato (PAC)", line: { color: "#888", dash: "dot", width: 1 }, type: "scatter" }], { title: T("Valore del portafoglio"), yaxis: { gridcolor: C.grid } });
  plot(i2d, [{ x: d, y: pacPL.map(x => x * 100), fill: "tozeroy", fillcolor: "rgba(192,40,63,.2)", line: { color: C.red, width: 1 }, name: "PAC: % sul versato", type: "scatter" }, { x: d, y: lump.map(v => (v / total - 1) * 100), line: { color: C.gold, width: 1 }, name: "Lump sum: % sul capitale", type: "scatter" }], { title: T("Guadagno/perdita % sul capitale versato"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
}
function stratLabels() {
  const t = $("#stType").value, L = { ma: ["Giorni media mobile", ""], cross: ["MA veloce (giorni)", "MA lenta (giorni)"], dd: ["Calo dai massimi (%)", ""], rsi: ["RSI soglia bassa (compra)", "RSI soglia alta (vendi)"] }[t];
  const D = { ma: [200, ""], cross: [50, 200], dd: [10, ""], rsi: [30, 70] }[t];
  $("#lP1").firstChild.textContent = L[0] + " "; $("#stP1").value = D[0];
  $("#lP2").style.display = L[1] ? "" : "none"; $("#lP2").firstChild.textContent = L[1] + " "; $("#stP2").value = D[1];
}
function sma(c, n) { const o = new Array(c.length).fill(NaN); let s = 0; for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function runStrat() {
  const F = FULL[st.ek], I = indicators(F), t = $("#stType").value, p1 = +$("#stP1").value, p2 = +$("#stP2").value, cost = +$("#stCost").value / 100;
  const i0 = lb(F.d, st.from), i1 = lb(F.d, st.to + "~") - 1; if (i1 - i0 < 260) { $("#stOut").innerHTML = `<p class="warn">Periodo troppo breve (serve almeno 1 anno).</p>`; return; }
  const c = F.c; let sig;
  if (t === "ma") { const m = sma(c, p1); sig = c.map((v, i) => isNaN(m[i]) ? null : v > m[i]); }
  else if (t === "cross") { const a = sma(c, p1), b = sma(c, p2); sig = c.map((v, i) => isNaN(a[i]) || isNaN(b[i]) ? null : a[i] > b[i]); }
  else if (t === "dd") { let inP = false; sig = c.map((v, i) => { if (!inP && I.dd[i] <= -p1 / 100) inP = true; else if (inP && I.dd[i] >= 0) inP = false; return inP; }); }
  else { let inP = false; sig = c.map((v, i) => { if (isNaN(I.rsi[i])) return null; if (!inP && I.rsi[i] < p1) inP = true; else if (inP && I.rsi[i] > p2) inP = false; return inP; }); }
  // posizione nel giorno i = segnale alla chiusura di i-1 (eseguito a quella chiusura → nessun look-ahead sul rendimento di i)
  const d = [], eq = [], bh = [], inv = []; let e = 1, trades = 0, pos = !!(i0 > 0 && sig[i0 - 1]);
  for (let i = i0; i <= i1; i++) {
    if (i > i0 && pos) e *= c[i] / c[i - 1];
    const want = sig[i] == null ? pos : sig[i];
    if (want !== pos) { e *= 1 - cost; trades++; pos = want; }
    d.push(F.d[i]); eq.push(e); bh.push(c[i] / c[i0]); inv.push(pos ? 1 : 0);
  }
  const ms = metrics(d, eq, inv), mb = metrics(d, bh), [d1, i1d] = div("chart tall"), [d2, i2d] = div();
  const name = { ma: `Prezzo sopra MA${p1}`, cross: `MA${p1} sopra MA${p2}`, dd: `Entra a -${p1}% dai massimi, esci ai nuovi massimi`, rsi: `RSI < ${p1} compra / > ${p2} vendi` }[t];
  $("#stOut").innerHTML = `<div class="answer">Strategia <b>${name}</b> su ${F.name}, ${fmtD(d[0])} – ${fmtD(d[d.length - 1])}: CAGR ${pc(ms.cagr, 2)} contro ${pc(mb.cagr, 2)} del buy &amp; hold; max drawdown ${pc(ms.md)} contro ${pc(mb.md)}; investita il ${pct(ms.inv, 0)} del tempo con ${trades} cambi di posizione. ${ms.cagr > mb.cagr ? "In questo periodo la strategia ha battuto il buy &amp; hold." : "Il buy &amp; hold ha reso di più; valutare se la riduzione di rischio (drawdown/volatilità) compensa."}</div>
  ${table(["", "Rend. totale", "CAGR", "Volatilità", "Sharpe (rf=0)", "Max drawdown", "% tempo investito", "Operazioni"], [[name, pc(ms.tot, 0), pc(ms.cagr, 2), pct(ms.vol), num(ms.sharpe), pc(ms.md), pct(ms.inv, 0), trades], ["Buy &amp; Hold", pc(mb.tot, 0), pc(mb.cagr, 2), pct(mb.vol), num(mb.sharpe), pc(mb.md), "100%", 0]])}
  ${d1}${d2}<p class="note">Periodo = selettore date in alto. Su indici di prezzo il buy &amp; hold reale avrebbe incassato anche i dividendi e la liquidità avrebbe reso il tasso monetario: entrambi gli effetti sono esclusi.</p>`;
  plot(i1d, [{ x: d, y: eq, name, line: { color: C.gold, width: 1.5 }, type: "scatter" }, { x: d, y: bh, name: "Buy & Hold", line: { color: "#999", width: 1.2 }, type: "scatter" }], { title: T("Equity curve (1 = capitale iniziale, scala log)"), yaxis: { type: "log", gridcolor: C.grid } });
  const ddS = a => { let pk = -Infinity; return a.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; }); };
  plot(i2d, [{ x: d, y: ddS(eq), name, line: { color: C.gold, width: 1 }, type: "scatter" }, { x: d, y: ddS(bh), name: "Buy & Hold", line: { color: C.red, width: 1 }, type: "scatter" }], { title: T("Drawdown"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
}

/* ===== Segnali attuali ===== */
function renderSignals() {
  const key = st.key === "^VIX" ? "^GSPC" : st.key, F = FULL[key], I = indicators(F), n = F.c.length - 1;
  const pr = (arr, v) => { const a = arr.filter(x => !isNaN(x)); return a.filter(x => x <= v).length / a.length; };
  const V = FULL["^VIX"], vl = V ? V.c[V.c.length - 1] : NaN, rsi = I.rsi[n], dist = I.dist[n], dd = I.dd[n];
  const lab = rsi < 30 ? "ipervenduto" : rsi > 70 ? "ipercomprato" : "zona neutrale";
  let pkI = 0; for (let i = 0; i <= n; i++) if (F.c[i] >= F.c[pkI]) pkI = i;
  const S = build(key, F.d[0], F.d[n]); S.mask = null; const base = customQuery(S, "all", 0, 252, 1).a;
  const lo = dist - 0.02, hi = dist + 0.02, ev = events(S, i => S.dist[i] >= lo && S.dist[i] <= hi, 10).map(i => fwdD(S, i, 252)).filter(x => !isNaN(x));
  const rl = rsi - 5, rh = rsi + 5, evR = events(S, i => S.rsi[i] >= rl && S.rsi[i] <= rh, 10).map(i => fwdD(S, i, 63)).filter(x => !isNaN(x));
  const [d1, i1] = div("chart tall"), [g1, gi1] = div(), [g2, gi2] = div();
  $("#sigOut").innerHTML = `<div class="card"><h3>Segnali attuali · ${F.name} · chiusura del ${fmtD(F.d[n])}</h3>
  <div class="kpis">
   <div class="kpi"><span>Ultima chiusura</span><b>${num(F.c[n])}</b></div>
   <div class="kpi"><span>RSI(14)</span><b>${num(rsi, 1)}</b><div class="muted">${lab} · percentile storico ${pct(pr(I.rsi, rsi), 0)}</div></div>
   <div class="kpi"><span>Distanza da MA200</span><b>${pc(dist)}</b><div class="muted">MA200 = ${num(I.ma200[n])} · percentile storico ${pct(pr(I.dist, dist), 0)}</div></div>
   <div class="kpi"><span>Drawdown dal massimo</span><b>${pc(dd)}</b><div class="muted">massimo ${num(F.c[pkI])} del ${fmtD(F.d[pkI])}</div></div>
   <div class="kpi"><span>VIX</span><b>${num(vl, 2)}</b><div class="muted">${V ? "percentile dal 1990: " + pct(pr(V.c, vl), 0) + " · " + fmtD(V.d[V.d.length - 1]) : ""}</div></div>
  </div>
  <div class="answer">Nei giorni storici con distanza dalla MA200 simile a oggi (tra ${pct(lo)} e ${pct(hi)}, ${ev.length} casi distanziati ≥10 giorni), il ${F.name} ha reso nei 12 mesi successivi in media ${pc(mean(ev))}, positivo nel ${pct(fracPos(ev), 0)} dei casi (giorno qualsiasi: ${pc(mean(base))}, ${pct(fracPos(base), 0)}). Con RSI(14) tra ${num(rl, 0)} e ${num(rh, 0)} (${evR.length} casi) il rendimento medio a 3 mesi è stato ${pc(mean(evR))}, positivo nel ${pct(fracPos(evR), 0)}.<br><b>Queste sono statistiche descrittive del passato, non previsioni né consigli di investimento.</b></div>
  ${d1}<div class="grid2"><div>${g1}</div><div>${g2}</div></div></div>`;
  const i0 = Math.max(0, n - 504);
  plot(i1, [{ x: F.d.slice(i0), y: F.c.slice(i0), name: F.name, line: { color: C.gold, width: 1.5 }, type: "scatter" }, { x: F.d.slice(i0), y: I.ma200.slice(i0), name: "Media mobile 200g", line: { color: C.red, width: 1 }, type: "scatter" }], { title: T("Ultimi 2 anni con media mobile a 200 giorni"), yaxis: { gridcolor: C.grid } });
  plot(gi1, [{ x: I.dist.filter(x => !isNaN(x)).map(x => x * 100), type: "histogram", marker: { color: "#555" }, xbins: { size: 1 }, histnorm: "percent" }], { title: T("Distanza storica da MA200 (linea rossa = oggi)"), shapes: [{ type: "line", x0: dist * 100, x1: dist * 100, yref: "paper", y0: 0, y1: 1, line: { color: C.red, width: 2 } }], xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "% giorni", gridcolor: C.grid }, hovermode: "closest", showlegend: false });
  plot(gi2, [{ x: I.rsi.filter(x => !isNaN(x)), type: "histogram", marker: { color: "#555" }, xbins: { size: 2 }, histnorm: "percent" }], { title: T("RSI(14) storico (linea rossa = oggi)"), shapes: [{ type: "line", x0: rsi, x1: rsi, yref: "paper", y0: 0, y1: 1, line: { color: C.red, width: 2 } }], xaxis: { gridcolor: C.grid }, yaxis: { title: "% giorni", gridcolor: C.grid }, hovermode: "closest", showlegend: false });
}

/* ===== Info dati ===== */
const SRC = {
  "^GSPC": "Yahoo Finance (^GSPC). Prima del 4/3/1957 la serie è l'indice S&P «90» (predecessore, 90 titoli) ricostruito da S&P; dal 1957 S&P 500. Prima del 1962 Yahoo fornisce solo la chiusura (apertura/massimo/minimo coincidono): l'app usa solo le chiusure.",
  "^SP500TR": "Yahoo Finance (^SP500TR): S&P 500 Total Return, dividendi reinvestiti, dal 1988. È l'unica serie total return gratuita affidabile disponibile.",
  "^DJI": "Yahoo Finance (^DJI): il download gratuito giornaliero parte solo dal 1992 (la storia dal 1896 esiste ma non è scaricabile gratuitamente e in modo verificabile).",
  "^IXIC": "Yahoo Finance (^IXIC): Nasdaq Composite dal 5/2/1971 (base 100).",
  "^NDX": "Yahoo Finance (^NDX): Nasdaq 100 dal 1/10/1985.",
  "^RUT": "Yahoo Finance (^RUT): Russell 2000 dal 10/9/1987.",
  "^VIX": "Yahoo Finance (^VIX): CBOE Volatility Index dal 1990 (metodologia attuale, retro-calcolata da CBOE)."
};
function renderInfo() {
  const V = window.VERIF;
  const rows = Object.entries(V.series).map(([k, s]) => [`<b>${s.name}</b> (${k})`, fmtD(s.start), fmtD(s.end), s.rows.toLocaleString("it-IT"), s.duplicates, s.nonpositive, s.gaps_gt_6_days.map(g => `${fmtD(g[0])} → ${fmtD(g[1])}`).join("<br>") || "–", (s["abs_moves_over_15%"] || s["abs_moves_over_50%"] || []).map(g => `${fmtD(g[0])}: ${num(g[1], 1)}%`).join("<br>") || "–"]);
  const cc = V.crosscheck.map(c => [c.ticker, c.source, c.overlap ? `${fmtD(c.from)} – ${fmtD(c.to)}` : "–", (c.overlap || 0).toLocaleString("it-IT"), c.overlap ? num(c.mean_abs_diff_pct, 4) + "%" : "–", c.overlap ? num(c.max_abs_diff_pct, 3) + "%" : "–", c.overlap ? c["days_diff_over_0.1pct"] : "–", c.note || (c.worst || []).slice(0, 3).map(w => `${fmtD(w[0])} (${num(w[1], 2)}%)`).join(", ")]);
  const kn = (V.known || []).map(k => [k[0], fmtD(k[1]), num(k[2]), num(k[3]), num(k[4], 3) + "%"]);
  $("#infoOut").innerHTML = `<div class="card"><h3>Fonti e copertura</h3>
   ${table(["Serie", "Dal", "Al", "Giorni", "Duplicati", "Prezzi ≤ 0", "Buchi > 6 giorni", "Movimenti anomali (>15%; VIX >50%)"], rows)}
   <ul class="muted">${Object.entries(SRC).map(([k, v]) => `<li><b>${k}</b>: ${v}</li>`).join("")}</ul>
   <p class="muted">Buchi spiegati da chiusure reali dei mercati: 4–14/3/1933 (chiusura bancaria di Roosevelt) e 11–14/9/2001 (attentati dell'11 settembre). Movimenti anomali verificati come storicamente reali: +16,6% del 15/3/1933, -20,5% del 19/10/1987 (Black Monday), +18,8% del Nasdaq 100 il 3/1/2001 (taglio dei tassi a sorpresa della Fed); i balzi del VIX oltre il 50% sono tipici dell'indice (es. +115% il 5/2/2018). <b>Gli indici di prezzo escludono i dividendi</b>: per l'S&amp;P 500 usare «S&amp;P 500 Total Return» (dal 1988) per valutazioni complete.</p></div>
   <div class="card"><h3>Verifica incrociata con fonte indipendente (FRED – Federal Reserve Bank of St. Louis)</h3>
   ${table(["Indice", "Fonte di confronto", "Periodo comune", "Giorni confrontati", "Diff. media assoluta", "Diff. massima", "Giorni con diff. > 0,1%", "Casi peggiori"], cc)}
   <p class="muted">FRED pubblica S&amp;P 500 e Dow Jones solo per gli ultimi 10 anni (vincoli di licenza), Nasdaq Composite, Nasdaq 100 e VIX per tutta la storia. Le differenze residue (pochi giorni, soprattutto Nasdaq anni '80 e Nasdaq 100 1997-2003) sono revisioni/arrotondamenti tra fornitori; la differenza media è inferiore a 0,03%, irrilevante per le statistiche. Stooq (seconda fonte prevista) blocca i download automatici.</p></div>
   <div class="card"><h3>Controllo su chiusure storiche pubblicate (S&amp;P 500)</h3>${table(["Indice", "Data", "Valore pubblicato", "Valore nel dataset", "Differenza"], kn)}
   <p class="muted">Dati aggiornati il ${V.generated.replace("T", " ")} (ora di Roma). Per aggiornare: <code>python3 update_data.py</code>, poi ricaricare la pagina. Nessun dato è stato inventato, interpolato o sintetizzato; la barra del giorno corrente viene esclusa finché la sessione USA non è chiusa.</p></div>`;
}

/* ===== Init ===== */
function showTab(id) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === id));
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
  if (id === "signals") renderSignals(); if (id === "info") renderInfo();
  window.dispatchEvent(new Event("resize"));
}
function init() {
  $("#idx").innerHTML = ORDER.filter(k => FULL[k]).map(k => `<option value="${k}">${FULL[k].name} (dal ${FULL[k].d[0].slice(0, 4)})</option>`).join("");
  $("#faqBtns").innerHTML = FAQ.map(([k, t], i) => `<button data-k="${k}"><i>${i + 1}</i>${t}</button>`).join("");
  $("#faqBtns").onclick = e => { const b = e.target.closest("button"); if (b) runFaq(b.dataset.k); };
  $("#tabs").onclick = e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); };
  document.querySelectorAll(".presets button").forEach(b => b.onclick = () => { $("#nYears").value = ""; setRange(+b.dataset.y); });
  $("#idx").onchange = () => setRange(0); $("#from").onchange = refresh; $("#to").onchange = refresh; $("#logScale").onchange = renderOverview;
  $("#qGo").onclick = ask; $("#q").onkeydown = e => { if (e.key === "Enter") ask(); };
  $("#cbGo").onclick = renderCustom; $("#pacGo").onclick = runPac; $("#stGo").onclick = runStrat; $("#stType").onchange = stratLabels;
  stratLabels(); wireV15(); initV2(); setRange(0);
}

/* ===== Analisi aggiuntive ===== */
ANS.regime = S => {
  if (S.key === "^VIX") throw new Error("selezionare un indice azionario");
  const H = [[21, "1 mese"], [63, "3 mesi"], [252, "1 anno"], [756, "3 anni"]];
  const keys = ["all", "aboveMA", "belowMA", "bull", "corr", "bear", "vixLo", "vixHi"], NM = { all: "Tutti i giorni", aboveMA: "Sopra MA200", belowMA: "Sotto MA200", bull: "Fuori da bear market", corr: "In correzione (-10/-20%)", bear: "In bear market (≤ -20%)", vixLo: "VIX < 15", vixHi: "VIX > 25" };
  const R = keys.map(k => { const f = REG[k](S); const idx = []; for (let i = 0; i < S.n; i++) if (f(i) && !isNaN(S.dist[i])) idx.push(i);
    return { k, n: NM[k], days: idx.length, share: idx.length / S.n, st: H.map(([h]) => { const a = idx.map(i => fwdD(S, i, h)).filter(x => !isNaN(x)); return { m: STAT(a), p: fracPos(a), sd: a.length > 2 ? std(a) : NaN, n: a.length }; }) }; }).filter(r => r.days > 0);
  // volatilità realizzata nei 21 giorni successivi
  const vol = keys.map(k => { const f = REG[k](S), a = []; for (let i = 0; i + 21 < S.n; i++) if (f(i) && !isNaN(S.dist[i])) a.push(std(S.r.slice(i + 1, i + 22)) * Math.sqrt(252)); return { k, v: median(a) }; });
  const [d1, i1] = div(), [d2, i2] = div(), g = k => R.find(r => r.k === k) || { st: [{}, {}, {}, {}] };
  return {
    html: `<div class="answer">Il «regime» descrive lo stato del mercato in un dato giorno. Sopra la media a 200 giorni il ${S.name} ha poi reso in media ${pc(g("aboveMA").st[2].m)} a 1 anno con volatilità successiva mediana ${pct(vol[1].v)}; sotto la media ${pc(g("belowMA").st[2].m)} ma con volatilità ${pct(vol[2].v)}. In bear market (giorni con drawdown ≤ -20%) il rendimento medio a 1 anno è stato ${pc(g("bear").st[2].m)}, positivo nel ${pct(g("bear").st[2].p, 0)} dei casi. Messaggio per il cliente: i regimi negativi hanno storicamente offerto rendimenti futuri medi non peggiori, ma con oscillazioni molto più ampie.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Regime", "Giorni", "% del tempo", ...H.map(h => statLabel() + " " + h[1]), ...H.map(h => "% pos. " + h[1]), "Dev. std 1 anno", "Vol. annua succ. (21g)"], R.map(r => [r.n, r.days.toLocaleString("it-IT") + warnN(r.days), pct(r.share, 0), ...r.st.map(s => pc(s.m)), ...r.st.map(s => pct(s.p, 0)), pct(r.st[2].sd), pct((vol.find(v => v.k === r.k) || {}).v)]))}
    <p class="note">Tutti i giorni del regime (campioni sovrapposti). VIX disponibile dal 1990. Nessun filtro regime globale applicato in questa tabella.</p>`,
    draw() {
      plot(i1, H.map((h, k) => ({ x: R.map(r => r.n), y: R.map(r => r.st[k].m * 100), type: "bar", name: h[1], marker: { color: ["#7d9bd1", C.gold, C.red, "#7a1a2a"][k] } })), { title: T("Rendimento medio successivo per regime"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest", margin: { l: 55, r: 20, t: 30, b: 90 } });
      const z = REG.belowMA(S), bear = REG.bear(S);
      plot(i2, [{ x: S.d, y: S.c, type: "scatter", line: { color: "#777", width: 1 }, name: S.name }, { x: S.d, y: S.c.map((v, i) => bear(i) ? v : null), type: "scatter", line: { color: C.red, width: 1.5 }, name: "Bear market", connectgaps: false }, { x: S.d, y: S.c.map((v, i) => z(i) && !bear(i) ? v : null), type: "scatter", line: { color: C.gold, width: 1 }, name: "Sotto MA200", connectgaps: false }], { title: T("Regimi nel tempo"), yaxis: { type: "log", gridcolor: C.grid } });
    }
  };
};
ANS.decade = S => {
  const Y = yearly(S); const D = {};
  for (const x of Y) { const k = Math.floor(x.y / 10) * 10; (D[k] = D[k] || []).push(x); }
  const R = Object.entries(D).map(([k, a]) => { const g = a.reduce((p, x) => p * (1 + x.r), 1); return { k: +k, n: a.length, cagr: g ** (1 / a.length) - 1, tot: g - 1, pos: a.filter(x => x.r > 0).length, partial: a.length < 10 || a.some(x => x.partial) }; });
  if (R.length < 2) throw new Error("servono almeno due decenni");
  const [d1, i1] = div(), b = [...R].sort((a, c) => c.cagr - a.cagr);
  return {
    html: `<div class="answer">Decennio migliore: <b>anni ${String(b[0].k).slice(2)}</b> (${pc(b[0].cagr)} annuo); peggiore: <b>anni ${String(b[b.length - 1].k).slice(2)}</b> (${pc(b[b.length - 1].cagr)} annuo). Anche nel lungo periodo i rendimenti dipendono molto dal punto di partenza: per questo diversificazione temporale (PAC) e orizzonte lungo contano.</div>${d1}
    ${table(["Decennio", "Anni nel campione", "Rend. annuo composto", "Rend. totale", "Anni positivi"], R.map(r => [`${r.k}–${r.k + 9}${r.partial ? " <span class='muted'>(parziale)</span>" : ""}`, r.n, pc(r.cagr, 2), pc(r.tot, 0), `${r.pos} su ${r.n}`]))}`,
    draw() { plot(i1, [{ x: R.map(r => `${r.k}s`), y: R.map(r => r.cagr * 100), type: "bar", marker: { color: R.map(r => r.cagr >= 0 ? (r.partial ? "#8a7440" : C.gold) : C.red) }, text: R.map(r => pct(r.cagr)), textposition: "outside" }], { title: T("Rendimento annuo composto per decennio (colore scuro = decennio parziale)"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" }); }
  };
};
ANS.party = S => {
  const Y = yearly(S).filter(x => !x.partial && PARTY(x.y)); if (Y.length < 8) throw new Error("servono almeno 8 anni");
  const g = p => { const a = Y.filter(x => PARTY(x.y) === p).map(x => x.r); return { n: a.length, m: mean(a), md: median(a), p: fracPos(a), cagr: a.reduce((q, x) => q * (1 + x), 1) ** (1 / a.length) - 1 }; };
  const D = g("D"), Rr = g("R");
  const P = PRES.map(([y0, n, p], k) => { const y1 = (PRES[k + 1] || [9999])[0] - 1; const a = Y.filter(x => x.y >= y0 && x.y <= y1); if (!a.length) return null; const gr = a.reduce((q, x) => q * (1 + x.r), 1); return { n, p, y0: a[0].y, y1: a[a.length - 1].y, cagr: gr ** (1 / a.length) - 1, tot: gr - 1, yrs: a.length }; }).filter(Boolean);
  const [d1, i1] = div();
  return {
    html: `<div class="answer">Con presidente <b>democratico</b> (${D.n} anni) il ${S.name} ha reso in media ${pc(D.m)} l'anno (composto ${pc(D.cagr)}), positivo nel ${pct(D.p, 0)} degli anni; con presidente <b>repubblicano</b> (${Rr.n} anni) ${pc(Rr.m)} (composto ${pc(Rr.cagr)}), positivo nel ${pct(Rr.p, 0)}. Attenzione: pochi mandati, risultati dominati da eventi specifici (1929-32, 2008) e da Congresso, Fed e ciclo economico. <b>Non è una relazione causale</b>.</div>${d1}
    ${table(["Partito", "Anni", "Media annua", "Mediana", "Composto annuo", "% anni positivi"], [["Democratico", D.n + warnN(D.n), pc(D.m), pc(D.md), pc(D.cagr), pct(D.p, 0)], ["Repubblicano", Rr.n + warnN(Rr.n), pc(Rr.m), pc(Rr.md), pc(Rr.cagr), pct(Rr.p, 0)]])}
    ${table(["Presidenza", "Partito", "Anni", "Rend. annuo composto", "Rend. totale"], P.map(x => [x.n, x.p === "D" ? "Dem." : "Rep.", `${x.y0}–${x.y1}`, pc(x.cagr), pc(x.tot, 0)]))}
    <p class="note">Ogni anno solare è attribuito al presidente insediato il 20 gennaio di quell'anno (o in carica). Kennedy/Johnson e Nixon/Ford raggruppati per mandato.</p>`,
    draw() { plot(i1, [{ x: P.map(x => `${x.n} ${x.y0}`), y: P.map(x => x.cagr * 100), type: "bar", marker: { color: P.map(x => x.p === "D" ? C.blue : C.red) }, hovertemplate: "%{x}: %{y:.1f}% annuo<extra></extra>" }], { title: T("Rendimento annuo composto per presidenza (blu = Dem., rosso = Rep.)"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest", margin: { l: 55, r: 20, t: 30, b: 110 } }); }
  };
};
ANS.weekday = S => {
  const GG = ["Lun", "Mar", "Mer", "Gio", "Ven"], W = GG.map(() => []), TD = {};
  for (let i = 1; i < S.n; i++) { if (!S.mask[i]) continue; const wd = new Date(S.t[i]).getUTCDay(); if (wd >= 1 && wd <= 5) W[wd - 1].push(S.r[i]); }
  // giorno di borsa del mese: primi 3 e ultimi 3
  for (let i = 1; i < S.n; i++) { if (!S.mask[i]) continue; let k = 1; while (i - k >= 0 && S.m[i - k] === S.m[i]) k++; let e = 1; while (i + e < S.n && S.m[i + e] === S.m[i]) e++; const lab = k <= 3 ? `+${k}` : e <= 3 ? `-${e}` : "centro"; (TD[lab] = TD[lab] || []).push(S.r[i]); }
  const ord = ["-3", "-2", "-1", "+1", "+2", "+3", "centro"].filter(x => TD[x]), [d1, i1] = div(), [d2, i2] = div();
  const best = GG.map((g, k) => [g, mean(W[k])]).sort((a, b) => b[1] - a[1]);
  const tom = ["-1", "+1", "+2", "+3"].flatMap(x => TD[x] || []), mid = TD.centro || [];
  return {
    html: `<div class="answer">Giorno mediamente migliore: <b>${best[0][0]}</b> (${pc(best[0][1], 3)}), peggiore: <b>${best[4][0]}</b> (${pc(best[4][1], 3)}). Effetto «turn of the month»: l'ultimo giorno e i primi 3 giorni di borsa del mese hanno reso in media ${pc(mean(tom), 3)} al giorno contro ${pc(mean(mid), 3)} nei giorni centrali. Differenze piccole rispetto alla volatilità giornaliera: utili come curiosità statistica, difficili da sfruttare dopo i costi.</div>
    <div class="grid2"><div>${d1}</div><div>${d2}</div></div>
    ${table(["Giorno", "N", "Media", "% positivi", "Dev. std"], GG.map((g, k) => [g, W[k].length, pc(mean(W[k]), 3), pct(fracPos(W[k]), 1), pct(std(W[k]), 2)]))}`,
    draw() {
      plot(i1, [{ x: GG, y: W.map(a => mean(a) * 100), type: "bar", marker: { color: W.map(a => mean(a) >= 0 ? C.gold : C.red) } }], { title: T("Rendimento medio giornaliero per giorno della settimana"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
      plot(i2, [{ x: ord.map(x => x === "centro" ? "Centro mese" : (x[0] === "-" ? `${x.slice(1)}° ultimo` : `${x.slice(1)}° giorno`)), y: ord.map(x => mean(TD[x]) * 100), type: "bar", marker: { color: C.gold } }], { title: T("Rendimento medio per posizione nel mese"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
    }
  };
};
KW.unshift(["regime", ["regime", "bear market", "sotto la media", "sopra la media", "mercato toro", "bull"]], ["decade", ["decenni", "decennio", "anni 70", "anni 80", "anni 90"]], ["party", ["democrat", "repubblican", "partito", "trump", "biden", "obama"]], ["weekday", ["lunedi", "venerdi", "settimana", "fine mese", "inizio mese"]]);
/* lookback libero e regime */
function wireV15() {
  $("#nYears").onchange = () => { const v = +$("#nYears").value; if (v > 0) setRange(v); };
  $("#regime").onchange = refresh;
}

/* ===================== V2 ===================== */
/* --- Statistica scelta e orizzonte extra --- */
const quant = (a, q) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y), p = (b.length - 1) * q, lo = Math.floor(p); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (p - lo); };
function STAT(a) { const v = ($("#stat") || {}).value || "mean"; return v === "mean" ? mean(a) : v === "median" ? median(a) : quant(a, { p10: .1, p25: .25, p75: .75, p90: .9 }[v]); }
const statLabel = () => ({ mean: "Media", median: "Mediana", p10: "P10", p25: "P25", p75: "P75", p90: "P90" })[($("#stat") || {}).value || "mean"];
const HN = { 10: "2 sett.", 504: "2 anni", 756: "3 anni", 1260: "5 anni", 2520: "10 anni" };
function extraH(H) { const x = +(($("#hExtra") || {}).value || 0); return x && !H.some(h => h[0] === x) ? [...H, [x, HN[x]]] : H; }

/* --- Serie derivate: total return, reale (CPI), EUR --- */
const CPI = (window.MACRO && MACRO.cpi) ? new Map(MACRO.cpi.d.map((d, i) => [d, MACRO.cpi.v[i]])) : null;
const CPI_LAST = CPI ? MACRO.cpi.d[MACRO.cpi.d.length - 1] : null;
const FX = window.MACRO && MACRO.eur ? MACRO.eur : null;
function deriveKey(key) {
  const tr = $("#serie").value === "tr", ms = $("#misura").value, real = ms === "real" || ms === "realeur", eur = ms === "eur" || ms === "realeur";
  let base = key; if (tr && key === "^GSPC" && FULL["^SP500TR"]) base = "^SP500TR";
  if (key === "^VIX" || (!real && !eur)) return base;
  const ek = base + (real ? "|real" : "") + (eur ? "|eur" : ""); if (FULL[ek]) return ek;
  const F = FULL[base], d = [], c = []; let fi = 0, lastFx = null;
  const cpiNow = CPI && CPI.get(CPI_LAST);
  for (let i = 0; i < F.d.length; i++) {
    let v = F.c[i];
    if (real) { const m = F.d[i].slice(0, 7), cv = CPI.get(m <= CPI_LAST ? m : CPI_LAST); if (!cv) continue; v = v * cpiNow / cv; }
    if (eur) { while (fi < FX.d.length && FX.d[fi] <= F.d[i]) { if (FX.v[fi]) lastFx = FX.v[fi]; fi++; } if (!lastFx) continue; v = v / lastFx; }
    d.push(F.d[i]); c.push(v);
  }
  FULL[ek] = { name: F.name + (real ? " (reale, $ di " + CPI_LAST + ")" : "") + (eur ? " in EUR" : ""), d, c, t: d.map(x => Date.parse(x)), real, eur, base };
  return ek;
}
function seriesLabel(S) {
  const F = FULL[S.key] || {}, base = F.base || S.key, p = [];
  p.push(base === "^SP500TR" ? "Total return (dividendi reinvestiti)" : base === "^VIX" ? "Livello VIX" : "Indice di prezzo, dividendi esclusi");
  if (F.real) p.push(`valori reali deflazionati con CPI USA (FRED CPIAUCNS), espressi in dollari di ${CPI_LAST}; ultimi mesi senza CPI pubblicato: usato l'ultimo dato disponibile`);
  if (F.eur) p.push("convertito in euro con il cambio FRED DEXUSEU (dal 04/01/1999): include l'effetto valuta per un investitore europeo non coperto");
  return p.join(" · ") + ".";
}
function updateBadge() {
  const b = $("#seriesBadge"); if (!b || !st.S) return;
  const warn = $("#serie").value === "tr" && st.key !== "^GSPC" ? " · ⚠ Total return disponibile solo per l'S&P 500: per questo indice si usa il prezzo" : "";
  b.innerHTML = `Serie in uso: <b>${st.S.name}</b> — ${seriesLabel(st.S)}${warn}${st.S.regime && st.S.regime !== "all" ? " · Filtro regime: " + REGN() : ""}`;
}

/* --- Esportazione CSV / PNG --- */
const TB = (id, name) => `<div class="toolbar"><button data-csv="${id}" data-name="${name || id}">⬇ CSV tabelle</button><button data-png="${id}" data-name="${name || id}">⬇ PNG grafici</button></div>`;
function exportCSV(id, name) {
  const root = document.getElementById(id); if (!root) return;
  const out = [`# ${st.S.name} ${st.S.d[0]} - ${st.S.d[st.S.n - 1]} | ${seriesLabel(st.S)}`];
  root.querySelectorAll("table").forEach(t => { t.querySelectorAll("tr").forEach(r => out.push([...r.children].map(c => '"' + c.innerText.replace(/"/g, '""').replace(/\s+/g, " ").trim() + '"').join(";"))); out.push(""); });
  const blob = new Blob(["\ufeff" + out.join("\n")], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${name}_${st.S.d[st.S.n - 1]}.csv`; document.body.appendChild(a); a.click(); a.remove();
  window.__lastExport = out.length;
}
function exportPNG(id, name) {
  const root = document.getElementById(id); if (!root) return; let k = 0;
  root.querySelectorAll(".js-plotly-plot").forEach(el => Plotly.downloadImage(el, { format: "png", width: 1400, height: 650, scale: 1, filename: `${name}_grafico${++k}` }));
  window.__lastPng = k;
}
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-csv],button[data-png]"); if (!b) return;
  b.dataset.csv ? exportCSV(b.dataset.csv, b.dataset.name) : exportPNG(b.dataset.png, b.dataset.name);
});

/* --- Stampa: grafici leggibili su carta --- */
let printFix = [];
window.addEventListener("beforeprint", () => { printFix = [...document.querySelectorAll("#pres .js-plotly-plot")]; printFix.forEach(el => Plotly.relayout(el, { "font.color": "#111", "xaxis.gridcolor": "#ddd", "yaxis.gridcolor": "#ddd" })); });
window.addEventListener("afterprint", () => { printFix.forEach(el => Plotly.relayout(el, { "font.color": C.text, "xaxis.gridcolor": C.grid, "yaxis.gridcolor": C.grid })); });

/* --- Analisi avanzate --- */
function renderAdv() {
  const S = st.S; if (S.n < 300) { $("#advOut").innerHTML = `<div class="card"><p class="warn">Periodo troppo breve per le analisi avanzate (serve almeno ~1 anno).</p></div>`; return; }
  const [r1, ri1] = div("chart tall"), [h1, hi1] = div("heat"), [c1, ci1] = div("chart tall"), [m1, mi1] = div(), [v1, vi1] = div(), [s1, si1] = div();
  const others = ORDER.filter(k => k !== "^VIX" && FULL[k]);
  $("#advOut").innerHTML = `${TB("advOut", "analisi_avanzate")}
  <div class="card"><h3>Rendimenti mobili (rolling) annualizzati</h3>
   <div class="form"><label>Finestra in evidenza <select id="rollW"><option>1</option><option>3</option><option selected>5</option><option>10</option><option>20</option></select></label></div>
   <div id="rollTxt"></div>${r1}<div id="rollTab"></div></div>
  <div class="card"><h3>Mappa di calore: rendimento per anno e mese</h3>${h1}<p class="note">Rendimento del mese (chiusura fine mese su chiusura fine mese precedente). Colonna «Anno» = rendimento dell'anno solare.</p></div>
  <div class="card"><h3>Confronto tra indici (base 100) e correlazioni</h3>
   <div class="checks">${others.map(k => `<label><input type="checkbox" class="cmpk" value="${k}" ${["^GSPC", "^IXIC", "^RUT"].includes(k) ? "checked" : ""}> ${FULL[k].name}</label>`).join("")}</div>
   <div class="muted" id="cmpTxt"></div>${c1}<div class="grid2"><div>${m1}</div><div id="cmpTab"></div></div>
   <p class="note">Confronto sul periodo comune a tutti gli indici selezionati nell'intervallo di date scelto, nella misura selezionata (nominale/reale/EUR). Correlazione dei rendimenti giornalieri sulle date comuni.</p></div>
  <div class="grid2"><div class="card"><h3>Volatilità mobile (252 giorni, annualizzata)</h3>${v1}</div><div class="card"><h3>Sharpe mobile (252 giorni, rf = 0)</h3>${s1}</div></div>`;
  // rolling
  const drawRoll = () => {
    const W = [1, 3, 5, 10, 20], tab = [], wSel = +$("#rollW").value; let ser = null;
    for (const w of W) { const x = [], y = []; for (let i = 0; i < S.n; i++) { const j = lb(S.t, S.t[i] + w * YR); if (j >= S.n) break; x.push(S.d[j]); y.push((S.c[j] / S.c[i]) ** (1 / w) - 1); }
      if (y.length < 20) continue; const mi = y.indexOf(Math.min(...y)), ma = y.indexOf(Math.max(...y));
      tab.push([w + (w > 1 ? " anni" : " anno"), y.length.toLocaleString("it-IT"), pc(y[mi]) + ` <span class="muted">(fine ${fmtD(x[mi])})</span>`, pc(quant(y, .25)), pc(median(y)), pc(quant(y, .75)), pc(y[ma]) + ` <span class="muted">(fine ${fmtD(x[ma])})</span>`, pct(fracPos(y), 0)]);
      if (w === wSel) ser = { x, y }; }
    $("#rollTab").innerHTML = table(["Finestra", "N", "Minimo", "P25", "Mediana", "P75", "Massimo", "% positivi"], tab);
    if (!ser) { $("#rollTxt").innerHTML = `<p class="warn">Periodo troppo breve per la finestra di ${wSel} anni.</p>`; Plotly.purge(ri1); return; }
    $("#rollTxt").innerHTML = `<div class="answer">Su finestre di ${wSel} anni il rendimento annualizzato è andato da ${pc(Math.min(...ser.y))} a ${pc(Math.max(...ser.y))}, con mediana ${pc(median(ser.y))}. Il grafico mostra il rendimento annuo dei ${wSel} anni terminati in ogni data.</div>`;
    plot(ri1, [{ x: ser.x, y: ser.y.map(v => v * 100), type: "scatter", line: { color: C.gold, width: 1.2 }, fill: "tozeroy", fillcolor: "rgba(201,165,76,.12)", name: `Rolling ${wSel}A` }], { title: T(`Rendimento annualizzato su ${wSel} anni (data di fine finestra)`), yaxis: { ticksuffix: "%", gridcolor: C.grid }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: median(ser.y) * 100, y1: median(ser.y) * 100, line: { color: C.red, dash: "dot" } }] });
  };
  $("#rollW").onchange = drawRoll; drawRoll();
  // heatmap
  const M = monthly(S), Yr = yearly(S), yrsL = [...new Set(M.map(x => x.y))];
  const z = yrsL.map(y => [...MESI.map((_, k) => { const r = M.find(x => x.y === y && x.m === k + 1); return r ? +(r.r * 100).toFixed(2) : null; }), (() => { const r = Yr.find(x => x.y === y); return r ? +(r.r * 100).toFixed(2) : null; })()]);
  plot(hi1, [{ z, x: [...MESI, "Anno"], y: yrsL.map(String), type: "heatmap", colorscale: [[0, "#C4453B"], [0.5, "#F4F6F9"], [1, "#1A8A5B"]], zmid: 0, zmin: -15, zmax: 15, text: z.map(r => r.map(v => v == null ? "" : v.toFixed(1))), texttemplate: yrsL.length <= 40 ? "%{text}" : "", hovertemplate: "%{y} %{x}: %{z:.2f}%<extra></extra>", colorbar: { ticksuffix: "%" } }], { yaxis: { autorange: "reversed", type: "category", gridcolor: C.grid }, hovermode: "closest", margin: { l: 50, r: 20, t: 20, b: 30 } });
  // confronto
  const drawCmp = () => {
    const ks = [...document.querySelectorAll(".cmpk:checked")].map(x => x.value); if (!ks.length) return;
    const SS = ks.map(k => build(deriveKey(k), st.from, st.to)); const start = SS.reduce((m, s) => s.d[0] > m ? s.d[0] : m, "0");
    const maps = SS.map(s => new Map(s.d.map((d, i) => [d, s.c[i]]))); const common = SS[0].d.filter(d => d >= start && maps.every(m => m.has(d)));
    if (common.length < 30) { $("#cmpTxt").textContent = "Periodo comune insufficiente."; return; }
    $("#cmpTxt").textContent = `Periodo comune: ${fmtD(common[0])} – ${fmtD(common[common.length - 1])} (${common.length.toLocaleString("it-IT")} giorni).`;
    const cols = [C.gold, C.red, C.blue, C.green, "#b08bd9", "#d0603a"];
    plot(ci1, SS.map((s, k) => { const b = maps[k].get(common[0]); return { x: common, y: common.map(d => maps[k].get(d) / b * 100), name: s.name, type: "scatter", line: { width: 1.3, color: cols[k % 6] } }; }), { title: T("Base 100 all'inizio del periodo comune (scala log)"), yaxis: { type: "log", gridcolor: C.grid } });
    const R = maps.map(m => common.slice(1).map((d, i) => m.get(d) / m.get(common[i]) - 1));
    const corr = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return n / Math.sqrt(x * y); };
    const Cm = R.map(a => R.map(b => +corr(a, b).toFixed(2))), names = SS.map(s => s.name.replace(" in EUR", "").replace(/ \(reale.*\)/, ""));
    plot(mi1, [{ z: Cm, x: names, y: names, type: "heatmap", colorscale: [[0, "#F4F6F9"], [1, C.gold]], zmin: 0, zmax: 1, text: Cm.map(r => r.map(v => v.toFixed(2))), texttemplate: "%{text}", hovertemplate: "%{x} / %{y}: %{z}<extra></extra>" }], { title: T("Correlazione rendimenti giornalieri"), hovermode: "closest", margin: { l: 120, r: 20, t: 30, b: 80 } });
    const Y = (common.length - 1) / 252;
    $("#cmpTab").innerHTML = table(["Indice", "Rend. totale", "CAGR", "Volatilità", "Sharpe (rf=0)", "Max DD"], SS.map((s, k) => { const eq = common.map(d => maps[k].get(d)), m = metrics(common, eq); return [s.name, pc(m.tot, 0), pc(m.cagr, 2), pct(m.vol), num(m.sharpe), pc(m.md)]; }));
  };
  document.querySelectorAll(".cmpk").forEach(x => x.onchange = drawCmp); drawCmp();
  // rolling vol / sharpe
  const x = [], vv = [], sh = [];
  for (let i = 252; i < S.n; i++) { const a = S.r.slice(i - 251, i + 1), sd = std(a) * Math.sqrt(252); x.push(S.d[i]); vv.push(sd * 100); sh.push(mean(a) * 252 / sd); }
  plot(vi1, [{ x, y: vv, type: "scatter", line: { color: C.red, width: 1 }, name: "Volatilità" }], { yaxis: { ticksuffix: "%", gridcolor: C.grid }, title: T(`Mediana storica: ${num(median(vv), 1)}% · attuale: ${num(vv[vv.length - 1], 1)}%`) });
  plot(si1, [{ x, y: sh, type: "scatter", line: { color: C.gold, width: 1 }, name: "Sharpe" }], { yaxis: { gridcolor: C.grid, zerolinecolor: "#666" }, title: T(`Mediana storica: ${num(median(sh))} · attuale: ${num(sh[sh.length - 1])}`) });
}

/* --- Presentazione cliente --- */
function irrMonthly(amts, final) { // amts: versamenti mensili uguali; IRR annuo
  const n = amts; let lo = -0.99, hi = 1.5;
  const f = r => { const m = (1 + r) ** (1 / 12); let s = 0; for (let k = 0; k < n; k++) s += m ** (n - k); return s; };
  for (let it = 0; it < 60; it++) { const mm = (lo + hi) / 2; if (f(mm) < final) lo = mm; else hi = mm; } return (lo + hi) / 2;
}
function renderPres() {
  const S = st.S; if (S.n < 252 * 5) { $("#presOut").innerHTML = `<div class="card"><p class="warn">Per la presentazione serve un periodo di almeno 5 anni.</p></div>`; return; }
  const Y = yrs(S.t[0], S.t[S.n - 1]), r = S.r.slice(1), ch = [];
  const C2 = () => { const x = div(); ch.push(x[1]); return x[0]; };
  // A. migliori giorni mancati
  const srt = r.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), NN = [0, 5, 10, 20, 30, 50];
  const miss = NN.map(N => { const ex = new Set(srt.slice(0, N).map(x => x[1])); let v = 10000; r.forEach((x, i) => { if (!ex.has(i)) v *= 1 + x; }); return { N, v, cagr: (v / 10000) ** (1 / Y) - 1 }; });
  // B. tempo nel mercato vs timing (10.000 l'anno)
  const years = [...new Set(S.y)].filter(y => S.y.filter(z => z === y).length > 200);
  const last = S.c[S.n - 1]; const strat = { "Timing perfetto (minimo dell'anno)": 0, "Subito (primo giorno dell'anno)": 0, "PAC mensile": 0, "Timing pessimo (massimo dell'anno)": 0, "Liquidità (0%)": 0 };
  for (const y of years) { const idx = []; for (let i = 0; i < S.n; i++) if (S.y[i] === y) idx.push(i); const cs = idx.map(i => S.c[i]);
    strat["Timing perfetto (minimo dell'anno)"] += 10000 * last / Math.min(...cs); strat["Timing pessimo (massimo dell'anno)"] += 10000 * last / Math.max(...cs);
    strat["Subito (primo giorno dell'anno)"] += 10000 * last / cs[0]; strat["Liquidità (0%)"] += 10000;
    const firsts = idx.filter((i, k) => k === 0 || S.m[i] !== S.m[idx[k - 1]]); firsts.forEach(i => strat["PAC mensile"] += 10000 / firsts.length * last / S.c[i]); }
  // C. probabilità di perdita
  const HP = [1, 2, 3, 5, 10, 15, 20].map(h => { let n = 0, neg = 0; for (let i = 0; i < S.n; i++) { const x = fwdY(S, i, h); if (isNaN(x)) break; n++; if (x < 0) neg++; } return { h, n, p: n ? neg / n : NaN }; }).filter(x => x.n > 100);
  // D. PAC su date di partenza mobili
  const firstIdx = []; for (let i = 0; i < S.n; i++) if (i === 0 || S.m[i] !== S.m[i - 1]) firstIdx.push(i);
  const pacDist = L => { const out = []; for (let s = 0; s + L * 12 < firstIdx.length; s++) { let sh = 0; for (let k = 0; k < L * 12; k++) sh += 100 / S.c[firstIdx[s + k]]; const end = firstIdx[s + L * 12], fin = sh * S.c[end]; out.push({ d: S.d[firstIdx[s]], mult: fin / (L * 1200), irr: irrMonthly(L * 12, fin / 100) }); } return out; };
  const P10 = pacDist(10), P20 = pacDist(20);
  // E. recupero dopo i crolli
  const E = episodes(S, -0.2).sort((a, b) => a.p - b.p);
  const mo = (a, b) => b == null ? null : yrs(S.t[a], S.t[b]) * 12;
  const kp = (a, b) => `<div class="kpi"><span>${a}</span><b>${b}</b></div>`, sumS = (k) => Object.entries(strat);
  const best = miss[0], m10 = miss[2];
  $("#presOut").innerHTML = `<div class="toolbar"><button id="printBtn" class="primary">🖨 Stampa / Salva PDF</button><button data-csv="presOut" data-name="presentazione">⬇ CSV tabelle</button><button data-png="presOut" data-name="presentazione">⬇ PNG grafici</button></div>
  <div class="pres">
  <div class="card sec"><h2>Investire nei mercati azionari USA: cosa insegna la storia</h2>
   <p class="muted">${S.name} · ${fmtD(S.d[0])} – ${fmtD(S.d[S.n - 1])} (${num(Y, 1)} anni) · ${seriesLabel(S)}</p>
   <div class="kpis">${kp("Rendimento annuo composto", pc(best.cagr, 2))}${kp("10.000 diventano", num(best.v, 0))}${kp("Anni positivi", pct(fracPos(yearly(S).filter(x => !x.partial).map(x => x.r)), 0))}${kp("Prob. perdita a 10 anni", pct((HP.find(x => x.h === 10) || {}).p, 0))}</div></div>
  <div class="card sec"><h3>1 · Il costo di perdere i giorni migliori</h3>
   <div class="answer">Restando sempre investiti 10.000 sono diventati <b>${num(best.v, 0)}</b> (${pc(best.cagr, 2)} annuo). Perdendo solo i 10 giorni migliori su ${r.length.toLocaleString("it-IT")}: <b>${num(m10.v, 0)}</b> (${pc(m10.cagr, 2)} annuo). I giorni migliori arrivano spesso a ridosso dei peggiori, quando la tentazione di uscire è massima.</div>
   ${C2()}${table(["Scenario", "Valore finale di 10.000", "Rend. annuo"], miss.map(m => [m.N ? `Persi i ${m.N} giorni migliori` : "Sempre investito", num(m.v, 0), pc(m.cagr, 2)]))}</div>
  <div class="card sec"><h3>2 · Tempo nel mercato vs market timing</h3>
   <div class="answer">10.000 investiti ogni anno (${years.length} anni). Anche chi ha comprato ogni anno <b>nel giorno peggiore</b> (il massimo dell'anno) ha ottenuto ${num(strat["Timing pessimo (massimo dell'anno)"], 0)}, contro ${num(strat["Liquidità (0%)"], 0)} versati e mai investiti. Il timing perfetto, impossibile nella realtà, ha aggiunto relativamente poco rispetto a investire subito.</div>
   ${C2()}${table(["Strategia", "Valore finale"], sumS().map(([k, v]) => [k, num(v, 0)]))}</div>
  <div class="card sec"><h3>3 · Probabilità di perdita per periodo di detenzione</h3>
   <div class="answer">Più lungo l'orizzonte, minore la probabilità storica di chiudere in perdita: ${HP.map(x => `${x.h} ann${x.h > 1 ? "i" : "o"} ${pct(x.p, 0)}`).join(" · ")}.</div>${C2()}</div>
  <div class="card sec"><h3>4 · PAC da 100 al mese: tutti i possibili inizi</h3>
   <div class="answer">${P10.length ? `PAC di 10 anni iniziati in ${P10.length} mesi diversi: rendimento annuo (IRR) mediano ${pc(median(P10.map(x => x.irr)))}, peggiore ${pc(Math.min(...P10.map(x => x.irr)))}, migliore ${pc(Math.max(...P10.map(x => x.irr)))}; in perdita alla fine nel ${pct(P10.filter(x => x.mult < 1).length / P10.length, 0)} dei casi.` : "Periodo troppo breve per PAC di 10 anni."} ${P20.length ? `Su 20 anni (${P20.length} partenze) in perdita nel ${pct(P20.filter(x => x.mult < 1).length / P20.length, 0)} dei casi, IRR mediano ${pc(median(P20.map(x => x.irr)))}.` : ""}</div>${C2()}</div>
  <div class="card sec"><h3>5 · Crolli ≥ 20% e tempi di recupero</h3>
   <div class="answer">${E.length} bear market nel periodo. Mesi mediani per toccare il minimo: ${num(median(E.map(e => mo(e.p, e.t))), 0)}; mesi mediani dal picco al ritorno sui massimi: ${num(median(E.filter(e => e.r != null).map(e => mo(e.p, e.r))), 0)}. Ogni crollo del periodo, tranne eventualmente quello in corso, è stato recuperato.</div>
   ${table(["Picco", "Minimo", "Calo", "Mesi di discesa", "Recupero massimi", "Mesi totali"], E.map(e => [fmtD(S.d[e.p]), fmtD(S.d[e.t]), pc(e.depth), num(mo(e.p, e.t), 0), e.r != null ? fmtD(S.d[e.r]) : "in corso", e.r != null ? num(mo(e.p, e.r), 0) : "–"]))}</div>
  <div class="card sec"><p class="note"><b>Avvertenza.</b> Documento a scopo esclusivamente informativo ed educativo, basato su dati storici (Yahoo Finance, FRED). Non costituisce consulenza finanziaria, raccomandazione o sollecitazione all'investimento. I rendimenti passati non sono indicativi né garanzia di quelli futuri. Simulazioni senza costi, tasse e, per gli indici di prezzo, senza dividendi. Elaborazione: Giovanni La Mattina.</p></div></div>`;
  plot(ch[0], [{ x: miss.map(m => m.N ? `-${m.N} giorni migliori` : "Sempre investito"), y: miss.map(m => m.v), type: "bar", marker: { color: miss.map((m, k) => k ? C.red : C.gold) }, text: miss.map(m => num(m.v, 0)), textposition: "outside" }], { title: T("Valore finale di 10.000"), xaxis: { type: "category" }, yaxis: { gridcolor: C.grid }, hovermode: "closest" });
  plot(ch[1], [{ x: Object.keys(strat), y: Object.values(strat), type: "bar", marker: { color: [C.green, C.gold, "#a08033", C.red, "#555"] }, text: Object.values(strat).map(v => num(v, 0)), textposition: "outside" }], { title: T("Valore finale con 10.000 l'anno"), xaxis: { type: "category" }, yaxis: { gridcolor: C.grid }, hovermode: "closest", margin: { l: 60, r: 20, t: 30, b: 90 } });
  plot(ch[2], [{ x: HP.map(x => x.h + " anni"), y: HP.map(x => x.p * 100), type: "bar", marker: { color: C.red }, text: HP.map(x => pct(x.p, 0)), textposition: "outside" }], { title: T("% di periodi chiusi in perdita"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
  plot(ch[3], [P10.length && { x: P10.map(x => x.irr * 100), type: "histogram", name: "PAC 10 anni", marker: { color: C.gold }, opacity: .75, xbins: { size: 1 } }, P20.length && { x: P20.map(x => x.irr * 100), type: "histogram", name: "PAC 20 anni", marker: { color: C.red }, opacity: .6, xbins: { size: 1 } }].filter(Boolean), { barmode: "overlay", title: T("Distribuzione del rendimento annuo (IRR) del PAC per data di inizio"), xaxis: { ticksuffix: "%", gridcolor: C.grid }, yaxis: { title: "N. partenze", gridcolor: C.grid }, hovermode: "closest" });
  $("#printBtn").onclick = () => window.print();
}

/* --- Nuove domande --- */
FAQ.push(["bestworst", "Migliori e peggiori giorni della storia: quando sono capitati?"], ["afterneg", "Cosa succede dopo un anno negativo?"], ["santa", "Santa Claus rally e mese di dicembre"], ["high52", "Rendimenti dopo nuovi massimi a 52 settimane"], ["fed", "Rendimenti dopo il primo taglio dei tassi della Fed (dal 1982)"]);
ANS.bestworst = S => {
  const idx = []; for (let i = 1; i < S.n; i++) if (S.mask[i]) idx.push(i);
  const sb = [...idx].sort((a, b) => S.r[b] - S.r[a]), B = sb.slice(0, 20), W = sb.slice(-20).reverse();
  const near = (i, set) => set.some(j => Math.abs(j - i) <= 10);
  const W50 = sb.slice(-50), B50 = sb.slice(0, 50), nb = B50.filter(i => near(i, W50)).length, bear = B50.filter(i => S.dd[i] <= -0.2).length;
  const [d1, i1] = div();
  const row = i => [fmtD(S.d[i]), pc(S.r[i], 2), pc(S.dd[i]), pc(fwdD(S, i, 252))];
  return {
    html: `<div class="answer">Dei 50 giorni migliori del periodo, <b>${nb}</b> sono caduti entro 10 sedute da uno dei 50 peggiori e <b>${bear}</b> durante un bear market (indice oltre -20% dai massimi). I rialzi più forti avvengono nelle fasi di panico: chi esce dopo un crollo rischia di perdere proprio la ripresa.</div>${d1}
    <div class="grid2"><div><h3>20 giorni migliori</h3>${table(["Data", "Rendimento", "Drawdown quel giorno", "Rend. 1 anno dopo"], B.map(row))}</div><div><h3>20 giorni peggiori</h3>${table(["Data", "Rendimento", "Drawdown quel giorno", "Rend. 1 anno dopo"], W.map(row))}</div></div>`,
    draw() { plot(i1, [{ x: idx.map(i => S.d[i]), y: idx.map(i => S.r[i] * 100), type: "scatter", mode: "markers", marker: { size: 3, color: "#555" }, name: "Giorni" }, { x: B50.map(i => S.d[i]), y: B50.map(i => S.r[i] * 100), mode: "markers", type: "scatter", marker: { color: C.green, size: 7 }, name: "50 migliori" }, { x: W50.map(i => S.d[i]), y: W50.map(i => S.r[i] * 100), mode: "markers", type: "scatter", marker: { color: C.red, size: 7 }, name: "50 peggiori" }], { title: T("Rendimenti giornalieri: i migliori e i peggiori si concentrano negli stessi periodi"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" }); }
  };
};
ANS.afterneg = S => {
  const Y = yearly(S).filter(x => !x.partial); if (Y.length < 10) throw new Error("servono almeno 10 anni");
  const nxt = Y.slice(0, -1).map((x, k) => ({ y: x.y, r: x.r, n: Y[k + 1].r, n2: k + 2 < Y.length ? (1 + Y[k + 1].r) * (1 + Y[k + 2].r) - 1 : NaN }));
  const g = f => { const a = nxt.filter(f); return { n: a.length, m: STAT(a.map(x => x.n)), p: fracPos(a.map(x => x.n)), m2: STAT(a.map(x => x.n2).filter(x => !isNaN(x))), list: a }; };
  const all = g(x => true), neg = g(x => x.r < 0), neg10 = g(x => x.r <= -0.1), neg20 = g(x => x.r <= -0.2), pos20 = g(x => x.r >= 0.2);
  const two = nxt.filter((x, k) => k > 0 && x.r < 0 && nxt[k - 1].r < 0);
  const [d1, i1] = div();
  return {
    html: `<div class="answer">Dopo un anno negativo (${neg.n} casi) l'anno successivo ha reso (${statLabel().toLowerCase()}) ${pc(neg.m)} ed è stato positivo nel ${pct(neg.p, 0)} dei casi, contro ${pc(all.m)} / ${pct(all.p, 0)} di un anno qualsiasi. Dopo cali di almeno il 20% (${neg20.n} casi): ${pc(neg20.m)}${warnN(neg20.n)}. Due anni negativi consecutivi si sono verificati ${two.length} volte (${two.map(x => x.y).join(", ") || "mai"}).</div>${d1}
    ${table(["Anno precedente", "N", statLabel() + " anno dopo", "% positivi anno dopo", statLabel() + " 2 anni dopo (cumulato)"], [["Qualsiasi", all, 0], ["Negativo", neg], ["≤ -10%", neg10], ["≤ -20%", neg20], ["≥ +20%", pos20]].map(([n, o]) => [n, o.n + warnN(o.n), pc(o.m), pct(o.p, 0), pc(o.m2)]))}
    <h3>Dettaglio anni negativi</h3>${table(["Anno", "Rendimento", "Anno successivo"], neg.list.map(x => [x.y, pc(x.r), pc(x.n)]))}`,
    draw() { plot(i1, [{ x: nxt.map(x => x.r * 100), y: nxt.map(x => x.n * 100), text: nxt.map(x => x.y), mode: "markers", type: "scatter", marker: { color: nxt.map(x => x.r < 0 ? C.red : C.gold), size: 8 }, hovertemplate: "%{text}: %{x:.1f}% → %{y:.1f}%<extra></extra>" }], { title: T("Rendimento di un anno vs anno successivo"), xaxis: { title: "Anno", ticksuffix: "%", gridcolor: C.grid, zerolinecolor: "#666" }, yaxis: { title: "Anno successivo", ticksuffix: "%", gridcolor: C.grid, zerolinecolor: "#666" }, hovermode: "closest" }); }
  };
};
ANS.santa = S => {
  const R = [];
  for (const y of new Set(S.y)) { const dec = [], jan = []; for (let i = 0; i < S.n; i++) { if (S.y[i] === y && S.m[i] === 12) dec.push(i); if (S.y[i] === y + 1 && S.m[i] === 1) jan.push(i); }
    if (dec.length < 10 || jan.length < 5) continue; const s0 = dec[dec.length - 6], s1 = jan[1], decStart = dec[0] - 1;
    if (s0 < 1 || decStart < 0) continue; const nextJanEnd = jan[jan.length - 1], yEnd = (() => { let k = -1; for (let i = 0; i < S.n; i++) if (S.y[i] === y + 1) k = i; return S.m[k] === 12 ? k : -1; })();
    R.push({ y, santa: S.c[s1] / S.c[s0] - 1, dec: S.c[dec[dec.length - 1]] / S.c[decStart] - 1, jan: S.c[nextJanEnd] / S.c[dec[dec.length - 1]] - 1, next: yEnd > 0 ? S.c[yEnd] / S.c[dec[dec.length - 1]] - 1 : NaN }); }
  if (R.length < 8) throw new Error("servono almeno 8 anni");
  const base7 = []; for (let i = 0; i + 7 < S.n; i++) base7.push(S.c[i + 7] / S.c[i] - 1);
  const fail = R.filter(x => x.santa <= 0), ok = R.filter(x => x.santa > 0), nn = a => a.map(x => x.next).filter(x => !isNaN(x));
  const [d1, i1] = div();
  return {
    html: `<div class="answer">Il «Santa Claus rally» (ultime 5 sedute di dicembre + prime 2 di gennaio) è stato positivo in <b>${ok.length} anni su ${R.length}</b> (${pct(ok.length / R.length, 0)}), con rendimento ${statLabel().toLowerCase()} ${pc(STAT(R.map(x => x.santa)), 2)} contro ${pc(STAT(base7), 2)} di 7 sedute qualsiasi (positive nel ${pct(fracPos(base7), 0)}). Dicembre è stato positivo nel ${pct(fracPos(R.map(x => x.dec)), 0)} degli anni. Quando il rally «non è arrivato» (${fail.length} casi) l'anno successivo ha reso ${pc(STAT(nn(fail)))} (positivo ${pct(fracPos(nn(fail)), 0)})${warnN(fail.length)}, contro ${pc(STAT(nn(ok)))} negli altri casi.</div>${d1}
    ${table(["Anno", "Santa Claus rally", "Dicembre", "Gennaio successivo", "Anno successivo"], R.slice(-30).reverse().map(x => [x.y, pc(x.santa, 2), pc(x.dec), pc(x.jan), pc(x.next)]))}<p class="note">Tabella: ultimi 30 anni. Le statistiche usano tutto il periodo.</p>`,
    draw() { plot(i1, [{ x: R.map(x => x.y), y: R.map(x => x.santa * 100), type: "bar", marker: { color: R.map(x => x.santa > 0 ? C.green : C.red) }, hovertemplate: "%{x}: %{y:.2f}%<extra></extra>" }], { title: T("Rendimento del Santa Claus rally per anno"), yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" }); }
  };
};
ANS.high52 = S => {
  const mx = new Array(S.n).fill(NaN); // massimo dei 252 giorni precedenti
  const dq = []; for (let i = 0; i < S.n; i++) { while (dq.length && dq[0] < i - 252) dq.shift(); if (i >= 252) mx[i] = S.c[dq[0]]; while (dq.length && S.c[dq[dq.length - 1]] <= S.c[i]) dq.pop(); dq.push(i); }
  const is52 = i => !isNaN(mx[i]) && S.c[i] > mx[i];
  const first = i => { if (!is52(i)) return false; for (let k = 1; k <= 63; k++) if (i - k >= 0 && is52(i - k)) return false; return true; };
  const H = [[21, "1 mese"], [63, "3 mesi"], [126, "6 mesi"], [252, "1 anno"]];
  const R = condStats(S, [["Tutti i giorni (base)", i => true, 1], ["Nuovo massimo a 52 settimane (tutti)", is52, 5], ["Primo massimo a 52 sett. dopo ≥3 mesi senza", first, 1], ["Nuovo massimo storico", i => S.ath[i], 5]], H);
  if (R[1].ev.length < 5) throw new Error("periodo troppo breve (servono più di 1 anno di dati)");
  const [d1, i1] = div();
  return {
    html: `<div class="answer">Dopo un nuovo massimo a 52 settimane (${R[1].ev.length} segnali distanziati ≥5 sedute) il rendimento a 1 anno è stato (${statLabel().toLowerCase()}) ${pc(R[1].st[3].m)}, positivo nel ${pct(R[1].st[3].p, 0)} dei casi, contro ${pc(R[0].st[3].m)} di un giorno qualsiasi. Il primo massimo dopo almeno 3 mesi senza massimi (${R[2].ev.length} casi), tipico segnale di ripartenza, ha preceduto ${pc(R[2].st[3].m)} a 1 anno. La forza tende a persistere (momentum).</div>${d1}${condTable(R, H)}`,
    draw() { plot(i1, R.map((r, k) => ({ x: R.H.map(h => h[1]), y: r.st.map(s => s.m * 100), type: "bar", name: r.n, marker: { color: ["#555", C.gold, C.green, C.red][k] } })), { title: T(`${statLabel()} del rendimento successivo`), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" }); }
  };
};
ANS.fed = S => {
  if (!window.MACRO || !MACRO.fedcuts) throw new Error("dati Fed non disponibili");
  if (S.key.startsWith("^VIX")) throw new Error("selezionare un indice azionario");
  const cuts = MACRO.fedcuts; const firsts = cuts.filter((c, k) => k === 0 ? false : (Date.parse(c[0]) - Date.parse(cuts[k - 1][0])) > 365 * DAY);
  const H = [[63, "3 mesi"], [126, "6 mesi"], [252, "1 anno"], [504, "2 anni"]];
  const rows = firsts.map(c => { const i = lb(S.d, c[0]); if (i >= S.n || i === 0) return null; return { d: c[0], lvl: c[1], i, f: H.map(([h]) => fwdD(S, i, h)), mdd: (() => { let m = 0; for (let j = i; j < Math.min(S.n, i + 252); j++) m = Math.min(m, S.c[j] / S.c[i] - 1); return m; })() }; }).filter(Boolean);
  if (!rows.length) throw new Error("nessun primo taglio nel periodo selezionato (dati Fed dal 1982)");
  const allC = cuts.map(c => lb(S.d, c[0])).filter(i => i > 0 && i < S.n);
  const [d1, i1] = div();
  return {
    html: `<div class="answer">Primi tagli di un ciclo (dopo oltre 12 mesi senza tagli) dal 1982 nel periodo: <b>${rows.length}</b>${warnN(rows.length)}. Rendimento a 1 anno (${statLabel().toLowerCase()}): ${pc(STAT(rows.map(r => r.f[2]).filter(x => !isNaN(x))))}, positivo in ${rows.filter(r => r.f[2] > 0).length} casi su ${rows.filter(r => !isNaN(r.f[2])).length}. L'esito dipende soprattutto dal motivo del taglio: tagli «assicurativi» con economia in crescita (1995, 1998, 2019, 2024) contro tagli in recessione (2001, 2007), seguiti da forti ribassi. Campione molto piccolo: nessuna regola generale.</div>${d1}
    ${table(["Data primo taglio", "Tasso obiettivo dopo il taglio", ...H.map(h => "Rend. " + h[1]), "Max calo nei 12 mesi"], rows.map(r => [fmtD(r.d), num(r.lvl, 2) + "%", ...r.f.map(x => pc(x)), pc(r.mdd)]))}
    <p class="note">Fonte: FRED DFEDTAR (obiettivo Fed Funds 1982–2008) e DFEDTARU (limite superiore dal 16/12/2008); la data è quella di entrata in vigore riportata da FRED (a volte il giorno dopo la riunione). In totale ${cuts.length} tagli nella serie, ${allC.length} nel periodo selezionato. Prima del 1982 FRED non pubblica una serie giornaliera dell'obiettivo: non inclusa.</p>`,
    draw() { plot(i1, [{ x: S.d, y: S.c, type: "scatter", line: { color: "#777", width: 1 }, name: S.name }, { x: allC.map(i => S.d[i]), y: allC.map(i => S.c[i]), mode: "markers", type: "scatter", marker: { color: C.gold, size: 5 }, name: "Tagli Fed" }, { x: rows.map(r => S.d[r.i]), y: rows.map(r => S.c[r.i]), mode: "markers", type: "scatter", marker: { color: C.red, size: 11, symbol: "diamond" }, name: "Primo taglio del ciclo" }], { title: T("Tagli dei tassi Fed sul grafico dell'indice"), yaxis: { type: "log", gridcolor: C.grid } }); }
  };
};
KW.unshift(["bestworst", ["giorni migliori", "giorni peggiori", "migliori giorni", "peggiori giorni"]], ["afterneg", ["anno negativo", "anni negativi", "dopo un anno", "anno dopo"]], ["santa", ["santa", "babbo natale", "dicembre", "natale"]], ["high52", ["52 settimane", "massimi annuali", "massimo a 52"]], ["fed", ["fed", "tassi", "taglio", "tagli", "banca centrale"]]);

/* --- Info dati: macro --- */
const _renderInfo = renderInfo;
renderInfo = function () {
  _renderInfo(); const m = (window.VERIF || {}).macro; if (!m) return;
  $("#infoOut").insertAdjacentHTML("beforeend", `<div class="card"><h3>Dati macro (FRED) e verifiche</h3>
  ${table(["Serie", "Uso nell'app", "Copertura"], [["CPIAUCNS – CPI-U USA, non destagionalizzato (BLS via FRED)", "Rendimenti reali (al netto dell'inflazione)", (m.cpi_range || []).join(" → ")], ["DEXUSEU – cambio USD per 1 EUR (Federal Reserve H.10 via FRED)", "Vista in euro", (m.eur_range || []).map(fmtD).join(" → ")], ["DFEDTAR + DFEDTARU – obiettivo Fed Funds", "Domanda sui tagli dei tassi", (m.fed_range || []).map(fmtD).join(" → ") + ` (${m.fed_cuts} tagli)`]])}
  <h3>Inflazione dicembre su dicembre: dato BLS pubblicato vs calcolato</h3>${table(["Anno", "BLS pubblicato", "Calcolato da CPIAUCNS"], (m.cpi_dec_dec || []).map(r => [r[0], num(r[1], 1) + "%", num(r[2], 2) + "%"]))}
  <p class="muted">Confronto con la serie destagionalizzata CPIAUCSL (dal 1947): differenza media dell'inflazione a 12 mesi ${num(m.cpi_nsa_vs_sa_12m_meandiff_pp, 3)} punti, massima ${num(m.cpi_nsa_vs_sa_12m_maxdiff_pp, 3)} punti (effetto stagionale atteso). Si usa CPIAUCNS perché copre dal 1913 (CPIAUCSL solo dal 1947) e coincide con i dati di inflazione ufficiali. Cambio EUR/USD: controllo di plausibilità su valori noti (primo giorno dell'euro 04/01/1999 = 1,1812; massimo storico luglio 2008 ≈ 1,59–1,60; minimo settembre 2022 < 0,97). Prima del 1999 l'euro non esisteva: la vista in EUR parte dal 04/01/1999 (nessuna ricostruzione con valute precedenti).</p></div>`);
};
/* --- Init V2 --- */
function initV2() {
  $("#faqBtns").innerHTML = FAQ.map(([k, t], i) => `<button data-k="${k}"><i>${i + 1}</i>${t}</button>`).join("");
  document.querySelectorAll(".exp").forEach(e => e.innerHTML = TB(e.dataset.t, e.dataset.t));
  ["#serie", "#misura"].forEach(s => $(s).onchange = refresh);
  ["#stat", "#hExtra"].forEach(s => $(s).onchange = () => { if (curFaq) runFaq(curFaq); if ($("#cbOut").innerHTML) renderCustom(); });
  const oldShow = showTab;
  showTab = id => { oldShow(id); if (id === "adv") renderAdv(); if (id === "pres") renderPres(); };
  $("#tabs").onclick = e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); };
}
const _refresh = refresh;
refresh = function () { _refresh(); updateBadge(); const v = document.querySelector(".tab.on").id; if (v === "adv") renderAdv(); if (v === "pres") renderPres(); };
init();
