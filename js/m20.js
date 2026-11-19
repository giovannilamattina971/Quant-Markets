"use strict";
/* ===== v4: Analisi Asset (ipercomprato/ipervenduto, stagionalità, drawdown, regimi, forza relativa, momentum, backtest segnali) ===== */
const GUIDE = {
  rsi: ["RSI – Relative Strength Index (14 periodi)", "Confronta l'ampiezza dei rialzi con quella dei ribassi recenti e la riassume in un numero da 0 a 100.", "Sotto 30 = ipervenduto (cali forti e ravvicinati); sopra 70 = ipercomprato. Tra 30 e 70 = zona neutra.", "In una tendenza forte può restare a lungo sopra 70 o sotto 30: da solo non indica un'inversione. Sulle serie mensili le soglie si toccano di rado."],
  ma: ["Distanza dalla media mobile a 200 giorni (in deviazioni standard)", "Quanto il prezzo è sopra o sotto la sua media degli ultimi 200 giorni di borsa (10 mesi sulle serie mensili), espresso in deviazioni standard del prezzo nello stesso periodo.", "Oltre +2 = molto «tirato» verso l'alto; sotto −2 = molto depresso; tra −1 e +1 = normale. Sopra la media = tendenza di fondo positiva.", "La deviazione standard cresce nelle fasi agitate: in una crisi −2 si può superare più volte. La media è in ritardo rispetto ai prezzi."],
  boll: ["Bande di Bollinger (20 periodi, ±2 deviazioni standard)", "Una media mobile a 20 periodi con una banda superiore e una inferiore a 2 deviazioni standard.", "Chiusura sotto la banda inferiore = eccesso al ribasso; sopra la superiore = eccesso al rialzo. Bande strette = volatilità bassa, spesso prima di un movimento ampio.", "In tendenza il prezzo può «camminare» lungo una banda per settimane. Non dice in che direzione avverrà il movimento."],
  z: ["Z-score del rendimento a 1 mese", "Quanto è insolito il rendimento dell'ultimo mese (21 giorni di borsa o 1 mese) rispetto a tutta la storia: (rendimento − media storica) / deviazione standard storica.", "Sotto −2 = mese eccezionalmente negativo; sopra +2 = eccezionalmente positivo. Circa il 95% dei mesi sta tra −2 e +2.", "Media e deviazione sono calcolate su tutto il periodo (anche il futuro rispetto al segnale). I mercati hanno code più «grasse» della curva normale: valori oltre ±3 capitano più spesso del previsto."],
  fwd: ["Rendimenti successivi al segnale", "Per ogni volta che il segnale scatta (primo giorno, con almeno un mese tra un segnale e l'altro) si misura il rendimento nei 1/3/6/12 mesi seguenti.", "Media, % di casi positivi, caso peggiore e numero di casi (N). Confrontare sempre con la riga «Tutti i giorni»: conta la differenza, non il numero assoluto.", "Con pochi casi (N < 20) le statistiche sono fragili. I periodi a 12 mesi si sovrappongono: i casi non sono indipendenti."],
  seas: ["Stagionalità", "Rendimento medio per mese dell'anno, per giorno della settimana e per anno del ciclo elettorale USA (anno delle elezioni presidenziali, post-elettorale, di metà mandato, pre-elettorale).", "Guardare insieme media, % di anni positivi e N. Differenze di pochi decimi su poche decine di anni sono quasi sempre rumore.", "La stagionalità può sparire una volta nota; gli effetti sono piccoli rispetto alla volatilità. Il ciclo elettorale riguarda la politica USA."],
  dd: ["Drawdown (cali dai massimi)", "Calo percentuale dal massimo precedente. Un episodio inizia quando si supera la soglia (−10/−20/−30%) e finisce quando si torna sul massimo.", "Profondità, giorni fino al minimo, giorni per recuperare e rendimenti per chi ha comprato quando il calo ha superato la soglia.", "Comprare al superamento della soglia non significa comprare sul minimo: il calo può continuare. Su serie senza dividendi i recuperi risultano più lunghi."],
  reg: ["Regimi di mercato", "Si divide la storia in fasi: prezzo sopra/sotto la media a 200 giorni; VIX alto (>25) o basso (<15); tassi a 10 anni in salita o in discesa negli ultimi 6 mesi. Per ogni fase si misurano i rendimenti successivi.", "Se un regime ha rendimenti medi molto diversi dalla media di tutti i giorni, è un'informazione utile sul contesto, non una previsione.", "Si usano tutti i giorni del regime: i periodi si sovrappongono e N esagera l'affidabilità. VIX disponibile dal 1990; i tassi sono mensili."],
  rs: ["Forza relativa (rapporto A/B)", "Il rapporto tra due asset (es. Emergenti / Mondo): se sale, A fa meglio di B. Lo z-score misura quanto il rapporto è lontano dalla sua media degli ultimi 5 anni.", "Z-score sotto −2 = A molto debole rispetto a B (possibile «ritorno alla media»); sopra +2 = A molto forte. Si mostra cosa è successo dopo questi estremi.", "Le sottoperformance possono durare molti anni (es. Emergenti vs USA dopo il 2010). Non considera le differenze di rischio."],
  mom: ["Momentum a 12 mesi (regola di tendenza)", "Ogni fine mese: se il rendimento degli ultimi 12 mesi è positivo si resta investiti il mese successivo, altrimenti si passa in liquidità.", "Confronto con il «compra e tieni»: rendimento annuo, volatilità, calo massimo e quota di tempo investito.", "Di solito riduce i cali profondi ma perde nei rimbalzi rapidi (es. 2020) e nei mercati senza tendenza. Nessun costo di transazione o imposta."],
  bt: ["Backtest dei segnali (long e short)", "Si «compra» (long) o si «vende allo scoperto» (short) a ogni segnale e si chiude dopo il periodo scelto, senza operazioni sovrapposte.", "Win rate = % di operazioni in guadagno. Rendimento medio per operazione. t-stat = media / (deviazione / √N): sopra 2 (in valore assoluto) il risultato è difficilmente frutto del caso; sotto 2 è statisticamente debole. Drawdown = peggior calo della curva dei risultati.", "Nessun costo, spread, imposta o costo del prestito titoli per lo short. Risultati passati su un solo asset: rischio di «adattare» le regole ai dati (overfitting)."],
};
const infoBox = k => `<details class="info"><summary>ℹ️ ${GUIDE[k][0]}: cos'è e come si legge</summary><p><b>Cos'è.</b> ${GUIDE[k][1]}</p><p><b>Come si legge.</b> ${GUIDE[k][2]}</p><p><b>Limiti.</b> ${GUIDE[k][3]}</p></details>`;

const aaIds = () => [...Object.keys(UNI), ...Object.keys(EXTRA)];
const aaGroups = () => { const seen = new Set(), G = []; GROUPS.forEach(([g, SUB]) => SUB.forEach(([sg, L]) => { const l = L.filter(id => UNI[id]); l.forEach(x => seen.add(x)); G.push([g.split(" ")[0] + " · " + sg, l]); })); const rest = aaIds().filter(x => !seen.has(x)); if (rest.length) G.push(["Altri (ETF e indici di prezzo)", rest]); return G; };
const aaOpt = (sel, skip = []) => aaGroups().map(([g, L]) => { const l = L.filter(id => !skip.includes(id)); return l.length ? `<optgroup label="${g}">${l.map(id => { const y = startY(id); return `<option value="${id}" ${id === sel ? "selected" : ""}>${keyOf(id)[0]}${y ? " · dal " + y : ""}</option>`; }).join("")}</optgroup>` : ""; }).join("");
function aaSeries(id, ccy) {
  const [name, src, cur] = keyOf(id); const r = rawSeries(src); if (!r) return null; const d = [], c = [];
  if (r.freq === "D") r.d.forEach((x, i) => { if (ccy === "ORIG" || cur === ccy) { d.push(x); c.push(r.c[i]); } else { const fx = fxOn(x); if (fx) { d.push(x); c.push(ccy === "EUR" ? r.c[i] / fx : r.c[i] * fx); } } });
  else { const L = monthlyLv(src, cur, ccy === "ORIG" ? cur : ccy); [...L.keys()].sort().forEach(k => { d.push(k + "-28"); c.push(L.get(k)); }); }
  return { id, name, src, cur: ccy === "ORIG" ? cur : ccy, d, c, D: r.freq === "D" };
}
const aaP = S => S.D ? { H: [21, 63, 126, 252], ma: 200, bb: 20, rsi: 14, zh: 21, gap: 21, per: "giorni" } : { H: [1, 3, 6, 12], ma: 10, bb: 20, rsi: 14, zh: 1, gap: 1, per: "mesi" };
const HL = ["1 mese", "3 mesi", "6 mesi", "12 mesi"];
function rsiArr(c, n) { const o = Array(c.length).fill(NaN); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0); if (i <= n) { g += up / n; l += dn / n; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; } if (i >= n) o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } return o; }
function rollMS(c, n) { const m = Array(c.length).fill(NaN), s = Array(c.length).fill(NaN); for (let i = n - 1; i < c.length; i++) { let a = 0; for (let j = i - n + 1; j <= i; j++) a += c[j]; const mu = a / n; let b = 0; for (let j = i - n + 1; j <= i; j++) b += (c[j] - mu) ** 2; m[i] = mu; s[i] = Math.sqrt(b / (n - 1)); } return [m, s]; }
function stat(r) { const n = r.length; if (!n) return { n: 0 }; const m = r.reduce((a, b) => a + b, 0) / n; const sd = n > 1 ? Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : NaN; const so = r.slice().sort((a, b) => a - b);
  return { n, m, sd, med: so[Math.floor((n - 1) / 2)], pos: r.filter(x => x > 0).length / n, worst: so[0], best: so[n - 1], t: sd > 0 ? m / (sd / Math.sqrt(n)) : NaN }; }
const onsets = (cond, gap) => { const o = []; let last = -1e9; for (let i = 1; i < cond.length; i++) if (cond[i] && !cond[i - 1] && i - last >= gap) { o.push(i); last = i; } return o; };
const fwd = (c, idx, h) => idx.filter(i => i + h < c.length).map(i => c[i + h] / c[i] - 1);
const cellS = s => !s || !s.n ? "–" : `${pc(s.m)}<br><small class="muted">${pct(s.pos, 0)} positivi · peggiore ${pct(s.worst)} · N ${s.n}${s.n < 20 ? ' <span class="warn">⚠</span>' : ""}</small>`;
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

function aaCompute(S) {
  const P = aaP(S), c = S.c, n = c.length; const [ma, msd] = rollMS(c, P.ma), [bm, bsd] = rollMS(c, P.bb), rsi = rsiArr(c, P.rsi);
  const dist = c.map((v, i) => msd[i] > 0 ? (v - ma[i]) / msd[i] : NaN);
  const r1 = c.map((v, i) => i >= P.zh ? v / c[i - P.zh] - 1 : NaN), rv = r1.filter(x => !isNaN(x)), rs = stat(rv); const z = r1.map(x => isNaN(x) ? NaN : (x - rs.m) / rs.sd);
  return { P, ma, msd, bm, bsd, rsi, dist, z, up: bm.map((m, i) => m + 2 * bsd[i]), lo: bm.map((m, i) => m - 2 * bsd[i]) };
}
function aaSignals(S, X) {
  const c = S.c; return {
    rsi30: ["RSI sotto 30 (ipervenduto)", X.rsi.map(v => v < 30), 1], rsi70: ["RSI sopra 70 (ipercomprato)", X.rsi.map(v => v > 70), -1],
    dm2: ["Prezzo sotto media 200 di oltre 2σ", X.dist.map(v => v < -2), 1], dp2: ["Prezzo sopra media 200 di oltre 2σ", X.dist.map(v => v > 2), -1],
    blo: ["Chiusura sotto la banda di Bollinger inferiore", c.map((v, i) => v < X.lo[i]), 1], bup: ["Chiusura sopra la banda di Bollinger superiore", c.map((v, i) => v > X.up[i]), -1],
    zm2: ["Z-score rendimento 1 mese < −2", X.z.map(v => v < -2), 1], zp2: ["Z-score rendimento 1 mese > +2", X.z.map(v => v > 2), -1],
    maup: ["Prezzo torna sopra la media 200", c.map((v, i) => v > X.ma[i]), 1], madn: ["Prezzo scende sotto la media 200", c.map((v, i) => v < X.ma[i]), -1] };
}

function renderAA() {
  const o = $("#aaOut"); if (o.dataset.ok) return aaRun(); o.dataset.ok = 1;
  const opts = sel => aaOpt(sel);
  const C1 = [["cmp", "Confronto tra asset"], ["ob", "Ipercomprato / ipervenduto"], ["seas", "Stagionalità"], ["dd", "Drawdown"], ["corr", "Le correzioni sono normali"], ["reg", "Regimi"], ["rs", "Forza relativa"], ["mom", "Momentum 12 mesi"], ["bt", "Backtest segnali"]];
  o.innerHTML = `${pdfBtn("aaPdf", "Scarica PDF Analisi Asset")}<div class="card"><h2>Analisi Asset</h2>
  <div class="form"><label>Asset <select id="aaA">${opts("WORLDI")}</select></label><label>Valuta <select id="aaCcy"><option value="EUR">EUR (base)</option><option value="ORIG">Valuta originale (storia più lunga)</option></select></label>${rangeForm("aa", "")}<span id="aaBtp" title="Opzioni per i BTP Banca d'Italia">${btpCtl().replace('class="form btpctl"', 'class="btpctl inline"')}</span><button id="aaGo" class="primary">Analizza</button></div>
  <p class="muted" id="aaCov"></p><div class="chips nopdf" id="aaNav">${C1.map(([k, t]) => `<button class="chip" data-go="aa_${k}">${t}</button>`).join("")}<button class="chip" data-tab-go="aaguide">📘 Guida agli indicatori</button></div>${TB("aaOut", "analisi_asset")}</div>
  <div id="aaBody"></div>`;
  $("#aaGo").onclick = aaRun; ["#aaA", "#aaCcy"].forEach(s => $(s).onchange = aaRun);
  $("#aaNav").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.tabGo) return showTab(b.dataset.tabGo); const t = document.getElementById(b.dataset.go === "aa_cmp" ? "aaCmp" : b.dataset.go); if (t) t.scrollIntoView({ behavior: "smooth" }); };
  $("#aaPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Analisi Asset", sub: (window.__aaLast || ""), file: pdfName("Analisi_Asset"), parts: [{ tab: "aa", root: "#aaOut" }, { tab: "aaguide", root: "#guideOut" }] }));
  aaRun();
}
function aaRun() {
  const id = $("#aaA").value, ccy = $("#aaCcy").value, S0 = aaSeries(id, ccy), body = $("#aaBody");
  if (!S0 || S0.d.length < 30) { body.innerHTML = `<div class="card"><p class="warn">Dati insufficienti per ${keyOf(id)[0]} in questa valuta. Prova «Valuta originale».</p></div>`; return; }
  const [from, to] = rangeOf("aa", S0); const ii = S0.d.map((d, i) => i).filter(i => S0.d[i] >= from && S0.d[i] <= to);
  const S = { ...S0, d: ii.map(i => S0.d[i]), c: ii.map(i => S0.c[i]) };
  if (S.d.length < (S.D ? 300 : 30)) { body.innerHTML = `<div class="card"><p class="warn">Periodo troppo breve.</p></div>`; return; }
  const X = aaCompute(S), P = X.P; window.__aaLast = `${S.name}, ${S.cur}, ${S.d[0]} → ${S.d[S.d.length - 1]}`;
  $("#aaCov").innerHTML = `Serie: <b>${S.name}</b> · ${S.D ? "giornaliera" : "mensile (indicatori su base mensile: media 10 mesi, RSI 14 mesi)"} · ${S.cur} · ${S.d[0]} → ${S.d[S.d.length - 1]} (${S.d.length} osservazioni). Fonte: ${(AS[S.src] && AS[S.src].src) || (FULL[S.src] ? FULL[S.src].name + " (Yahoo Finance)" : S.src)}.${ccy === "EUR" && keyOf(id)[2] !== "EUR" && !rawSeries(S.src + "_EUR") ? " Convertita in EUR al cambio BCE/FRED (senza copertura)." : ""}`;
  const ch = []; const mk = (cl) => { const [h, i] = div(cl); ch.push(i); return h; };
  const g = [mk("chart tall"), mk(), mk(), mk(), mk(), mk(), mk(), mk(), mk(), mk("chart tall")];
  body.innerHTML = `<div class="card" id="aa_ob"><h3>1 · Ipercomprato / ipervenduto</h3>${infoBox("rsi")}${infoBox("ma")}${infoBox("boll")}${infoBox("z")}<div id="aaNow"></div>${g[0]}${g[1]}<div id="aaObT"></div>${infoBox("fwd")}</div>
  <div class="card" id="aa_seas"><h3>2 · Stagionalità</h3>${infoBox("seas")}<div class="grid2"><div>${g[2]}</div><div>${g[3]}</div></div><div id="aaSeasT"></div></div>
  <div class="card" id="aa_dd"><h3>3 · Drawdown (cali dai massimi)</h3>${infoBox("dd")}<div class="form"><label>Soglia elenco <select id="aaDdT">${DDTH.map(t => `<option value="${t / 100}" ${t === 20 ? "selected" : ""}>${t}%</option>`).join("")}</select></label></div>${g[4]}<div id="aaDdT2"></div><div id="aaDdCondBox"><h3>Cosa succede dopo la soglia</h3><div class="form"><label>Soglia superata <select id="aaDdC">${DDTH.map(t=>`<option value="${t}" ${t===10?"selected":""}>−${t}%</option>`).join("")}</select></label></div><div id="aaDdCond"></div></div></div>
  <div class="card" id="aa_corr"><h3>3b · Le correzioni sono normali</h3><p class="note nopdf">Per ogni anno: il calo massimo vissuto durante l'anno e come l'anno si è chiuso.</p>${g[9]}<div id="aaCorrT"></div></div>
  <div class="card" id="aa_reg"><h3>4 · Regimi di mercato</h3>${infoBox("reg")}<div class="form"><label>Tassi <select id="aaRate"><option value="DGS10">Treasury USA 10 anni (FRED DGS10)</option><option value="IRLTLT01ITM156N">BTP 10 anni (FRED/OCSE)</option></select></label></div><div id="aaRegT"></div></div>
  <div class="card" id="aa_rs"><h3>5 · Forza relativa</h3>${infoBox("rs")}<div class="form"><label>Confronta con <select id="aaB">${aaOpt(id === "WORLDI" ? "US" : "WORLDI")}</select></label><span class="chips"><button class="chip" data-rs="EM,WORLDI">Emergenti vs Mondo</button><button class="chip" data-rs="EXUS,US">Sviluppati ex-USA vs USA</button><button class="chip" data-rs="GOLD,WORLDI">Oro vs Azioni mondo</button><button class="chip" data-rs="SWDA,US">MSCI World EUR vs S&P 500</button></span></div>${g[5]}${g[6]}<div id="aaRsT"></div></div>
  <div class="card" id="aa_mom"><h3>6 · Momentum 12 mesi vs compra e tieni</h3>${infoBox("mom")}${g[7]}<div id="aaMomT"></div></div>
  <div class="card" id="aa_bt"><h3>7 · Backtest dei segnali (long e short)</h3>${infoBox("bt")}<div class="form"><label>Segnale <select id="aaSig">${Object.entries(aaSignals(S, X)).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></label><label>Direzione <select id="aaDir"><option value="auto">Automatica (long su ipervenduto, short su ipercomprato)</option><option value="1">Long</option><option value="-1">Short</option></select></label><label>Durata operazione <select id="aaH">${HL.map((h, i) => `<option value="${i}" ${i === 2 ? "selected" : ""}>${h}</option>`).join("")}</select></label></div><div id="aaBtT"></div>${g[8]}</div>`;
  aaOB(S, X, ch); aaSeas(S, ch); aaDD(S, ch); aaCorr(S, ch); aaReg(S, X); aaRS(S, ch); aaMom(S, ch); aaBT(S, X, ch);
  $("#aaDdT").onchange = () => aaDD(S, ch); $("#aaDdC").onchange = () => aaDDCond(S); $("#aaRate").onchange = () => aaReg(S, X); $("#aaB").onchange = () => aaRS(S, ch);
  document.querySelectorAll("[data-rs]").forEach(b => b.onclick = () => { const [a, bb] = b.dataset.rs.split(","); $("#aaA").value = a; $("#aaB").value = bb; const keep = bb; aaRun(); $("#aaB").value = keep; aaRS(window.__aaS, window.__aaCh); });
  ["#aaSig", "#aaDir", "#aaH"].forEach(s => $(s).onchange = () => aaBT(S, X, ch)); window.__aaS = S; window.__aaCh = ch;
}
function aaOB(S, X, ch) {
  const c = S.c, n = c.length, P = X.P, k0 = Math.max(0, n - (S.D ? 756 : 60)), xs = S.d.slice(k0), sl = a => a.slice(k0);
  const L = n - 1; $("#aaNow").innerHTML = `<div class="kpis">${kp2("RSI 14", num(X.rsi[L], 1))}${kp2(`Distanza da media ${P.ma} ${S.D ? "giorni" : "mesi"}`, num(X.dist[L], 2) + " σ")}${kp2("Posizione nelle bande di Bollinger", c[L] > X.up[L] ? "sopra la banda superiore" : c[L] < X.lo[L] ? "sotto la banda inferiore" : "dentro le bande")}${kp2("Z-score rendimento 1 mese", num(X.z[L], 2))}</div><p class="note">Valori all'ultima data disponibile (${S.d[L]}). Grafici: ultimi ${S.D ? "3 anni" : "5 anni"}.</p>`;
  plot(ch[0], [{ x: xs, y: sl(X.up), name: "Banda superiore", line: { color: "#555", width: 1 } }, { x: xs, y: sl(X.lo), name: "Banda inferiore", line: { color: "#555", width: 1 }, fill: "tonexty", fillcolor: "rgba(120,120,120,.08)" }, { x: xs, y: sl(c), name: S.name, line: { color: C.gold, width: 1.8 } }, { x: xs, y: sl(X.ma), name: `Media ${P.ma}`, line: { color: C.blue, width: 1.4, dash: "dot" } }], { title: T("Prezzo, media mobile e bande di Bollinger"), yaxis: { gridcolor: C.grid }, hovermode: "x unified" });
  plot(ch[1], [{ x: xs, y: sl(X.rsi), name: "RSI 14", line: { color: C.gold, width: 1.4 } }, { x: xs, y: sl(X.dist).map(v => v * 10 + 50), name: "Distanza dalla media (σ×10+50)", line: { color: C.blue, width: 1.1 } }], { title: T("RSI (soglie 30/70) e distanza dalla media"), yaxis: { range: [0, 100], gridcolor: C.grid }, shapes: [30, 70].map(y => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.red, dash: "dash", width: 1 } })), hovermode: "x unified" });
  const sig = aaSignals(S, X), base = P.H.map(h => stat(c.map((v, i) => i + h < n ? c[i + h] / v - 1 : null).filter(x => x != null)));
  const rows = [["<b>Tutti i giorni (riferimento)</b>", ...base.map(cellS)]];
  ["rsi30", "rsi70", "dm2", "dp2", "blo", "bup", "zm2", "zp2"].forEach(k => { const idx = onsets(sig[k][1], P.gap); rows.push([sig[k][0], ...P.H.map(h => cellS(stat(fwd(c, idx, h))))]); });
  $("#aaObT").innerHTML = `<h4>Rendimenti dopo i segnali (primo giorno del segnale, almeno 1 mese tra due segnali)</h4>${table(["Segnale", ...HL], rows)}<p class="note">⚠ = meno di 20 casi: statistica fragile. Rendimento del solo prezzo/total return secondo la serie scelta, in ${S.cur}.</p>`;
}
function aaSeas(S, ch) {
  const Lm = new Map(); S.d.forEach((d, i) => Lm.set(d.slice(0, 7), S.c[i])); const ks = [...Lm.keys()].sort();
  const mr = Array.from({ length: 12 }, () => []); ks.slice(1).forEach((k, i) => mr[+k.slice(5, 7) - 1].push(Lm.get(k) / Lm.get(ks[i]) - 1));
  const MN = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"], ms = mr.map(stat);
  const Ly = new Map(); S.d.forEach((d, i) => Ly.set(d.slice(0, 4), S.c[i])); const ys = [...Ly.keys()].sort(); const lastFull = S.d[S.d.length - 1].slice(5, 7) === "12" ? ys.length : ys.length - 1;
  const cy = [[], [], [], []]; ys.slice(1, lastFull).forEach((y, i) => cy[+y % 4].push(Ly.get(y) / Ly.get(ys[i]) - 1)); const CYN = ["Anno elezioni presidenziali", "Post-elettorale", "Metà mandato (midterm)", "Pre-elettorale"], cs = cy.map(stat);
  plot(ch[2], [{ x: MN, y: ms.map(s => s.m * 100), type: "bar", marker: { color: ms.map(s => s.m >= 0 ? C.gold : C.red) }, name: "Media mensile" }], { title: T("Rendimento medio per mese"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
  plot(ch[3], [{ x: CYN, y: cs.map(s => s.m * 100), type: "bar", marker: { color: cs.map(s => s.m >= 0 ? C.gold : C.red) }, name: "Media annua" }], { title: T("Ciclo elettorale USA: rendimento medio annuo"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
  let wd = ""; if (S.D) { const W = Array.from({ length: 5 }, () => []); S.c.forEach((v, i) => { if (!i) return; const g = new Date(S.d[i] + "T12:00:00Z").getUTCDay(); if (g >= 1 && g <= 5) W[g - 1].push(v / S.c[i - 1] - 1); });
    wd = `<h4>Per giorno della settimana</h4>${table(["Giorno", "Media", "% positivi", "N"], ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"].map((n, i) => { const s = stat(W[i]); return [n, pc(s.m, 3), pct(s.pos, 0), s.n]; }))}`; }
  $("#aaSeasT").innerHTML = `<div class="grid2"><div><h4>Per mese</h4>${table(["Mese", "Media", "Mediana", "% positivi", "N anni"], MN.map((m, i) => [m, pc(ms[i].m), pc(ms[i].med), pct(ms[i].pos, 0), ms[i].n]))}</div><div><h4>Ciclo elettorale USA (anni solari completi)</h4>${table(["Anno del ciclo", "Media", "% positivi", "Peggiore", "N"], CYN.map((n, i) => [n, pc(cs[i].m), pct(cs[i].pos, 0), pct(cs[i].worst), cs[i].n]))}${wd}</div></div>`;
}
function ddEpisodes(c, thr) { const eps = []; let pk = 0, cur = null; for (let i = 1; i < c.length; i++) { if (c[i] >= c[pk]) { if (cur) { cur.rec = i; eps.push(cur); cur = null; } pk = i; continue; } const dd = c[i] / c[pk] - 1; if (!cur && dd <= -thr) cur = { pk, cross: i, tr: i, depth: dd }; if (cur && dd < cur.depth) { cur.depth = dd; cur.tr = i; } } if (cur) { cur.rec = null; eps.push(cur); } return eps; }
function aaDD(S, ch) { if ($("#aaDdC")) aaDDCond(S);
  const c = S.c, d = S.d, P = aaP(S), med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
  const sum = DDTH.map(x => x / 100).map(t => { const E = ddEpisodes(c, t), rc = E.filter(e => e.rec != null); return [`Oltre −${Math.round(t * 100)}%`, E.length, pct(E.length ? E.reduce((a, e) => a + e.depth, 0) / E.length : NaN), num(med(E.map(e => dayDiff(d[e.pk], d[e.tr]))), 0), num(med(rc.map(e => dayDiff(d[e.tr], d[e.rec]))), 0), ...P.H.map(h => cellS(stat(fwd(c, E.map(e => e.cross), h))))]; });
  const thr = +$("#aaDdT").value, E = ddEpisodes(c, thr).reverse();
  let pk = c[0]; const ddc = c.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; });
  plot(ch[4], [{ x: d, y: ddc, type: "scatter", fill: "tozeroy", line: { color: C.red, width: 1 }, fillcolor: "rgba(192,40,63,.25)", name: "Drawdown" }], { title: T("Calo dai massimi nel tempo"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
  $("#aaDdT2").innerHTML = `<h4>Sintesi per soglia (rendimenti per chi compra quando il calo supera la soglia)</h4>${table(["Soglia", "Episodi", "Calo medio", "Giorni al minimo (mediana)", "Giorni di recupero (mediana)", ...HL], sum)}
  <h4>Elenco episodi oltre −${Math.round(thr * 100)}% (più recenti prima)</h4>${table(["Massimo", "Superamento soglia", "Minimo", "Calo", "Giorni al minimo", "Recupero", "Giorni di recupero", "Rend. 12 mesi dal superamento"], E.slice(0, 40).map(e => [d[e.pk], d[e.cross], d[e.tr], pc(e.depth), num(dayDiff(d[e.pk], d[e.tr]), 0), e.rec != null ? d[e.rec] : "<i>non ancora</i>", e.rec != null ? num(dayDiff(d[e.tr], d[e.rec]), 0) : "–", e.cross + P.H[3] < c.length ? pc(c[e.cross + P.H[3]] / c[e.cross] - 1) : "–"]))}<p class="note">Giorni di calendario. Su serie di solo prezzo i recuperi sono più lenti che con i dividendi reinvestiti.</p>`;
}
const DDTH = [5, 10, 15, 20, 25, 30, 35, 40];
const tip = (t, txt) => `<span class="tip" title="${txt.replace(/"/g, "&quot;")}">${t} ⓘ</span>`;
function ddCondData(S, t) {
  const c = S.c, d = S.d, E = ddEpisodes(c, t / 100), n = E.length, H = S.D ? [21, 63, 126, 252, 504] : [1, 3, 6, 12, 24];
  const so = a => a.slice().sort((x, y) => x - y), md = a => a.length ? so(a)[Math.floor((a.length - 1) / 2)] : NaN, mn = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const last = d[d.length - 1], add = E.map(e => c[e.tr] / c[e.cross] - 1);
  const deep = DDTH.filter(x => x > t).map(x => ({ x, k: E.filter(e => e.depth <= -x / 100).length }));
  const fw = H.map(h => ({ r: fwd(c, E.map(e => e.cross), h), s: stat(fwd(c, E.map(e => e.cross), h)) }));
  const rc = E.filter(e => e.rec != null);
  const within = m => { const el = E.filter(e => dayDiff(d[e.cross], last) >= m * 30.44); const k = el.filter(e => e.rec != null && dayDiff(d[e.cross], d[e.rec]) <= m * 30.44).length; return { m, k, n: el.length }; };
  return { E, n, H, md, mn, so, add, deep, fw, rc, last, ong: n - rc.length, db: E.map(e => dayDiff(d[e.cross], d[e.tr])), dr: rc.map(e => dayDiff(d[e.cross], d[e.rec])), dtr: rc.map(e => dayDiff(d[e.tr], d[e.rec])), rec: [6, 12, 24].map(within) };
}
function aaDDCond(S) {
  const d = S.d, t = +$("#aaDdC").value, R = ddCondData(S, t), { n, md, mn, add } = R, HN = ["1 mese", "3 mesi", "6 mesi", "12 mesi", "24 mesi"];
  if (!n) { $("#aaDdCond").innerHTML = `<p class="warn">Nessun episodio oltre −${t}% nel periodo selezionato (${d[0]} → ${R.last}).</p>`; return; }
  const W = n < 10 ? `<p class="warn">⚠ Solo ${n} episodi oltre −${t}%: statistiche molto fragili, da leggere come esempi storici e non come probabilità.</p>` : n < 20 ? `<p class="warn">⚠ ${n} episodi (meno di 20): percentuali indicative, un episodio in più o in meno le sposta molto.</p>` : "";
  const as = R.so(add), f12 = R.fw[3].s, f24 = R.fw[4].s, nx = R.deep[0], r12 = R.rec[1], y0 = d[0].split("-").reverse().join("/"), nel = v => (/^(8|11(?!\d))/.test(pct(v, 0)) ? "Nell'" : "Nel ") + "<b>" + pct(v, 0) + "</b>", wk = s => s.n < 20 ? ' <span class="warn">⚠</span>' : "";
  const [h1, i1] = div("chart"), [h2, i2] = div("chart");
  const S1 = [`Dal ${y0} ${S.name} ha superato un calo del <b>${t}%</b> dal massimo <b>${n} volte</b>${R.ong ? ` (l'ultimo episodio non è ancora recuperato)` : ""}.`,
    nx ? `${nel(nx.k / n)} dei casi (${nx.k} su ${n}) il calo è poi arrivato almeno a −${nx.x}%; in mediana il prezzo è sceso di un ulteriore <b>${pct(-md(add))}</b> dopo la soglia (caso peggiore ${pct(-as[0])}).` : `In mediana il prezzo è sceso di un ulteriore <b>${pct(-md(add))}</b> dopo la soglia (caso peggiore ${pct(-as[0])}).`,
    f12.n ? `Chi ha investito il giorno della soglia era in guadagno dopo 12 mesi ${nel(f12.pos).replace("N", "n")} dei casi (rendimento medio ${pct(f12.m)}, peggiore ${pct(f12.worst)}, N ${f12.n})${f24.n ? `; dopo 24 mesi ${nel(f24.pos).replace("N", "n")}` : ""}.` : "Non c'è ancora abbastanza storia dopo la soglia per misurare i rendimenti a 12 mesi.",
    r12.n ? `Il massimo precedente è stato recuperato entro 12 mesi dalla soglia ${nel(r12.k / r12.n).replace("N", "n")} dei casi; il tempo mediano dalla soglia al recupero è di <b>${num(md(R.dr), 0)} giorni</b>.` : ""];
  $("#aaDdCond").innerHTML = `${W}<div class="headline">${S1.filter(Boolean).map(x => `<p class="lead">${x}</p>`).join("")}</div>
  <div class="kpis"><div class="kpi"><b>${n}</b><span>${tip("episodi oltre −" + t + "%", "Numero di volte in cui il calo dal massimo precedente ha superato la soglia. Un nuovo episodio parte solo dopo il ritorno sul massimo.")}</span></div><div class="kpi"><b>${pct(md(add))}</b><span>${tip("ulteriore calo mediano", "Dal giorno in cui si supera la soglia al minimo dell'episodio. Mediana = caso tipico.")}</span></div><div class="kpi"><b>${f12.n ? pct(f12.pos, 0) : "–"}</b><span>${tip("positivi a 12 mesi", "Quota di episodi in cui, comprando il giorno della soglia, dopo 12 mesi si era in guadagno.")}</span></div><div class="kpi"><b>${num(md(R.dr), 0)}</b><span>${tip("giorni mediani al recupero", "Giorni di calendario dal superamento della soglia al ritorno sul massimo precedente (solo episodi recuperati).")}</span></div></div>
  <div class="grid2"><div>${h1}</div><div>${h2}</div></div>
  <h4>${tip("Rendimenti dal giorno del superamento della soglia", "Rendimento ottenuto comprando il primo giorno in cui il calo supera la soglia e tenendo per l'orizzonte indicato.")}</h4>${table(["Orizzonte", "Media", "Mediana", "% positivi", "Peggiore", "Migliore", "N"], R.fw.map((f, i) => { const s = f.s; return [HN[i], s.n ? pc(s.m) : "–", s.n ? pc(s.med) : "–", s.n ? pct(s.pos, 0) : "–", s.n ? pc(s.worst) : "–", s.n ? pc(s.best) : "–", s.n + (s.n ? wk(s) : "")]; }))}
  <div class="grid2"><div><h4>${tip("Quanto spesso il calo si è approfondito", "Quota degli episodi oltre la soglia scelta che sono poi arrivati a livelli più profondi.")}</h4>${table(["Livello successivo", "Casi", "%"], R.deep.map(x => [`Arriva a −${x.x}%`, `${x.k} su ${n}`, pct(x.k / n, 0)]))}
  <h4>${tip("Ulteriore calo dopo la soglia", "Dal prezzo del giorno della soglia al minimo dell'episodio.")}</h4>${table(["Mediana", "Media", "Peggiore", "N"], [[pc(md(add)), pc(mn(add)), pc(as[0]), n]])}</div>
  <div><h4>Tempi (giorni di calendario)</h4>${table(["Misura", "Mediana", "Media", "N"], [["Dalla soglia al minimo", num(md(R.db), 0), num(mn(R.db), 0), n], ["Dal minimo al recupero del massimo", num(md(R.dtr), 0), num(mn(R.dtr), 0), R.rc.length], ["Dalla soglia al recupero del massimo", num(md(R.dr), 0), num(mn(R.dr), 0), R.rc.length]])}
  <h4>${tip("Recupero del massimo precedente", "Quota di episodi tornati sul massimo entro l'orizzonte, contando solo gli episodi con abbastanza storia dopo la soglia.")}</h4>${table(["Orizzonte dalla soglia", "Casi", "%"], R.rec.map(r => [`Entro ${r.m} mesi`, `${r.k} su ${r.n}`, pct(r.n ? r.k / r.n : NaN, 0)]))}</div></div>
  <details class="more nopdf"><summary>Elenco episodi oltre −${t}%</summary>${table(["Massimo", "Soglia superata", "Minimo", "Calo massimo", "Ulteriore calo", "Recupero", "Rend. 12 mesi"], R.E.slice().reverse().map((e, j, A) => { const k = R.E.length - 1 - j, f = R.fw[3].r; return [d[e.pk], d[e.cross], d[e.tr], pc(e.depth), pc(add[k]), e.rec != null ? d[e.rec] : "<i>non ancora</i>", e.cross + R.H[3] < S.c.length ? pc(S.c[e.cross + R.H[3]] / S.c[e.cross] - 1) : "–"]; }))}</details>
  <p class="note">Episodio = dal massimo precedente al ritorno su quel massimo; si conta il primo giorno in cui il calo supera −${t}%. Serie: ${S.name} (${S.cur}), ${d[0]} → ${R.last}${S.D ? "" : ". Serie mensile (fine mese): soglie e minimi sono rilevati solo a fine mese, quindi l'ulteriore calo è sottostimato (spesso 0% se il minimo cade nel mese della soglia). Per i dettagli giornalieri usa un ETF quotato (es. URTH, SWDA)"}.</p>
  <h3>Come leggere questa pagina</h3>
  <p class="lead"><b>1. Scegli la soglia</b> che corrisponde al calo attuale o temuto («il mercato è giù del ${t}%»). Tutte le statistiche partono dal primo giorno in cui il calo l'ha superata.</p>
  <p class="lead"><b>2. Controlla N.</b> Qui ci sono ${n} episodi. Con meno di 20 casi (⚠) le percentuali sono fragili: un episodio cambia molto il risultato.</p>
  <p class="lead"><b>3. Leggi le frasi in alto:</b> riassumono il caso tipico (mediana) e quello peggiore.</p>
  <p class="lead"><b>4. Grafico «quanto spesso si è approfondito»:</b> la soglia non è il minimo. Serve a preparare il cliente a cali ulteriori.</p>
  <p class="lead"><b>5. Grafico e tabella dei rendimenti:</b> cosa ha ottenuto chi ha comprato o tenuto il giorno della soglia. Guarda insieme % positivi e caso peggiore.</p>
  <p class="lead"><b>6. Tempi e recupero:</b> quanto è servito per toccare il minimo e tornare sul massimo. Aiuta a fissare l'orizzonte di pazienza necessario.</p>
  <p class="lead"><b>Esempio pratico per un cliente (dati reali di questa pagina).</b> «${S1.filter(Boolean).map(x => x.replace(/<[^>]+>/g, "")).join(" ")}» Sono fatti storici, non previsioni: aiutano a fissare aspettative realistiche e a evitare vendite di panico.</p>
  <p class="warn">Limiti: pochi episodi, contesti diversi (inflazione, tassi, valute); su serie di solo prezzo i recuperi risultano più lenti che con i dividendi. I rendimenti passati non sono indicativi di quelli futuri.</p>`;
  plot(i1, [{ x: R.deep.map(x => `−${x.x}%`), y: R.deep.map(x => x.k / n * 100), type: "bar", marker: { color: C.red }, text: R.deep.map(x => `${Math.round(x.k / n * 100)}% (${x.k}/${n})`), textposition: "outside", hovertemplate: "Arrivati a %{x}: %{text}<extra></extra>" }], { title: T(`Dopo −${t}%: quanto spesso il calo è arrivato a…`), yaxis: { ticksuffix: "%", range: [0, 115], gridcolor: C.grid }, showlegend: false });
  plot(i2, R.fw.map((f, i) => ({ y: f.r.map(v => v * 100), type: "box", name: HN[i], boxpoints: "all", jitter: .4, pointpos: 0, marker: { color: C.gold, size: 4 }, line: { color: C.gold }, fillcolor: "rgba(212,175,55,.15)", hovertemplate: "%{y:.1f}%<extra>" + HN[i] + "</extra>" })), { title: T("Distribuzione dei rendimenti dalla soglia (ogni punto = un episodio)"), yaxis: { ticksuffix: "%", gridcolor: C.grid, zeroline: true, zerolinecolor: "#888" }, showlegend: false });
}
function corrData(S) {
  const Y = new Map(); S.d.forEach((x, i) => { const y = x.slice(0, 4); if (!Y.has(y)) Y.set(y, []); Y.get(y).push(i); });
  const ys = [...Y.keys()].sort(), out = [];
  ys.forEach((y, k) => { if (!k) return; const I = Y.get(y), p0 = S.c[Y.get(ys[k - 1]).slice(-1)[0]]; let pk = p0, mdd = 0; I.forEach(i => { pk = Math.max(pk, S.c[i]); mdd = Math.min(mdd, S.c[i] / pk - 1); }); out.push({ y, mdd, ret: S.c[I[I.length - 1]] / p0 - 1, full: k < ys.length - 1 || S.d[S.d.length - 1].slice(5) >= "12-28" }); });
  return out;
}
function aaCorr(S, ch) {
  const A = corrData(S), F = A.filter(a => a.full), n = F.length, el = $("#aaCorrT");
  if (n < 3) { el.innerHTML = `<p class="warn">Servono almeno 3 anni solari completi.</p>`; return; }
  const st = DDTH.map(t => { const Y = F.filter(a => a.mdd <= -t / 100), p = Y.filter(a => a.ret > 0).length; return { t, k: Y.length, p }; });
  const mm = F.map(a => a.mdd).sort((x, y) => x - y)[Math.floor((n - 1) / 2)], pos = F.filter(a => a.ret > 0).length, s10 = st[1], s5 = st[0], s20 = st[3];
  const L = [`In <b>${n}</b> anni solari completi (${F[0].y}–${F[n - 1].y}) il calo massimo <i>durante</i> l'anno è stato in mediana del <b>${pct(-mm)}</b>, eppure <b>${pos}</b> anni su ${n} (${pct(pos / n, 0)}) si sono chiusi in positivo.`,
    `Un calo di almeno il 10% durante l'anno è capitato in <b>${s10.k}</b> anni su ${n} (${pct(s10.k / n, 0)})${s10.k ? `; in <b>${s10.p}</b> di questi (${pct(s10.p / s10.k, 0)}) l'anno si è comunque chiuso in positivo` : ""}.`,
    `Un calo di almeno il 5%: ${s5.k} anni su ${n} (${pct(s5.k / n, 0)})${s5.k ? `, chiusi in positivo ${s5.p} (${pct(s5.p / s5.k, 0)})` : ""}. Almeno il 20%: ${s20.k} anni su ${n} (${pct(s20.k / n, 0)})${s20.k ? `, chiusi in positivo ${s20.p} (${pct(s20.p / s20.k, 0)})` : ""}.`];
  el.innerHTML = `${n < 20 ? `<p class="warn">⚠ Solo ${n} anni completi: percentuali indicative.</p>` : ""}<div class="headline">${L.map(x => `<p class="lead">${x}</p>`).join("")}</div>
  ${table(["Calo durante l'anno almeno", "Anni", "% degli anni", "Di cui chiusi in positivo", "% chiusi in positivo"], st.map(s => [`−${s.t}%`, `${s.k} su ${n}`, pct(s.k / n, 0), s.p, s.k ? pct(s.p / s.k, 0) : "–"]))}
  <details class="more nopdf"><summary>Dati anno per anno</summary>${table(["Anno", "Calo massimo nell'anno", "Rendimento dell'anno"], A.slice().reverse().map(a => [a.y + (a.full ? "" : " (in corso)"), pc(a.mdd), pc(a.ret)]))}</details>
  <p class="note">Calo massimo nell'anno = maggior discesa da un massimo a un minimo successivo all'interno dell'anno solare, partendo dalla chiusura dell'anno precedente${S.D ? " (prezzi di chiusura giornalieri)" : " (dati di fine mese: i cali intra-mese non si vedono, quindi i valori sono sottostimati)"}. Rendimento = variazione tra fine anno precedente e fine anno. ${S.name} (${S.cur}). L'anno in corso è nel grafico ma escluso dalle statistiche.</p>
  <p class="lead"><b>Come usarlo con il cliente:</b> le barre rosse mostrano che quasi ogni anno ha una correzione; i punti dorati mostrano che spesso l'anno finisce comunque bene. Vendere durante il calo avrebbe trasformato una perdita temporanea in definitiva.</p>`;
  plot(ch[9], [{ x: A.map(a => a.y), y: A.map(a => a.mdd * 100), type: "bar", name: "Calo massimo durante l'anno", marker: { color: A.map(a => a.full ? C.red : "#7a3b47") }, hovertemplate: "%{x}: calo massimo %{y:.1f}%<extra></extra>" }, { x: A.map(a => a.y), y: A.map(a => a.ret * 100), mode: "markers", name: "Rendimento dell'anno", marker: { color: C.gold, size: 7, line: { color: "#ffffff", width: 1.5 } }, hovertemplate: "%{x}: rendimento %{y:.1f}%<extra></extra>" }], { title: T("Calo massimo durante l'anno (barre) e rendimento dell'anno (punti)"), yaxis: { ticksuffix: "%", gridcolor: C.grid, zerolinecolor: "#888" }, legend: { orientation: "h", y: -0.15 } });
}
function aaReg(S, X) {
  const c = S.c, d = S.d, n = c.length, P = X.P; const vix = new Map(); if (FULL["^VIX"]) FULL["^VIX"].d.forEach((x, i) => vix.set(S.D ? x : x.slice(0, 7), FULL["^VIX"].c[i]));
  const ys = window.YIELDS && YIELDS[$("#aaRate").value]; const rm = new Map(); if (ys) ys.d.forEach((x, i) => rm.set(x.slice(0, 7), ys.v[i])); const rk = [...rm.keys()].sort();
  const rateCh = k => { const i = rk.indexOf(k); return i >= 6 ? rm.get(k) - rm.get(rk[i - 6]) : null; };
  const prevM = k => { const [y, m] = k.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
  const V = i => vix.get(S.D ? d[i] : d[i].slice(0, 7)), R = i => rateCh(prevM(d[i].slice(0, 7)));
  const regs = [["Prezzo sopra la media " + P.ma, i => c[i] > X.ma[i]], ["Prezzo sotto la media " + P.ma, i => c[i] < X.ma[i]], ["VIX alto (> 25)", i => V(i) > 25], ["VIX basso (< 15)", i => V(i) != null && V(i) < 15], ["Tassi 10 anni in salita (6 mesi)", i => R(i) > 0], ["Tassi 10 anni in discesa (6 mesi)", i => R(i) != null && R(i) < 0]];
  const base = P.H.map(h => stat(c.map((v, i) => i + h < n ? c[i + h] / v - 1 : null).filter(x => x != null)));
  const rows = [["<b>Tutti i giorni</b>", "100%", ...base.map(cellS)], ...regs.map(([nm, f]) => { const idx = []; for (let i = 0; i < n; i++) if (f(i)) idx.push(i); return [nm, pct(idx.length / n, 0), ...P.H.map(h => cellS(stat(fwd(c, idx, h))))]; })];
  $("#aaRegT").innerHTML = `${table(["Regime", "Quota del tempo", ...HL], rows)}<p class="note">VIX (Yahoo ^VIX) dal 1990; tassi mensili, variazione degli ultimi 6 mesi nota a fine mese precedente. N = giorni (o mesi) nel regime: periodi sovrapposti, non casi indipendenti.</p>`;
}
function aaRS(S, ch) {
  const ccy = S.cur === "EUR" || $("#aaCcy").value === "EUR" ? "EUR" : "USD", a = S.id, b = $("#aaB").value;
  const la = monthlyLv(keyOf(a)[1], keyOf(a)[2], ccy), lb = monthlyLv(keyOf(b)[1], keyOf(b)[2], ccy); const ks = [...la.keys()].filter(k => lb.has(k)).sort();
  if (ks.length < 72) { $("#aaRsT").innerHTML = `<p class="warn">Storia comune insufficiente (servono almeno 6 anni; trovati ${ks.length} mesi).</p>`; return; }
  const ra = ks.map(k => la.get(k) / lb.get(k)), lr = ra.map(Math.log), W = 60; const z = lr.map((v, i) => { if (i < W) return NaN; const w = lr.slice(i - W, i), m = w.reduce((x, y) => x + y, 0) / W, s = Math.sqrt(w.reduce((x, y) => x + (y - m) ** 2, 0) / (W - 1)); return s > 0 ? (v - m) / s : NaN; });
  const xs = ks.map(k => k + "-28"), nm = [keyOf(a)[0], keyOf(b)[0]];
  plot(ch[5], [{ x: xs, y: ra.map(v => v / ra[0] * 100), name: `${nm[0]} / ${nm[1]}`, line: { color: C.gold, width: 1.6 } }], { title: T(`Rapporto ${nm[0]} / ${nm[1]} (base 100, ${ccy})`), yaxis: { type: "log", gridcolor: C.grid } });
  plot(ch[6], [{ x: xs, y: z, name: "Z-score (5 anni)", line: { color: C.blue, width: 1.3 } }], { title: T("Z-score del rapporto rispetto agli ultimi 5 anni"), yaxis: { gridcolor: C.grid }, shapes: [-2, 2].map(y => ({ type: "line", xref: "paper", x0: 0, x1: 1, y0: y, y1: y, line: { color: C.red, dash: "dash", width: 1 } })) });
  const H = [3, 6, 12], rows = [["z < −2 (A molto debole)", z.map(v => v < -2)], ["z > +2 (A molto forte)", z.map(v => v > 2)]].map(([t, cond]) => { const idx = onsets(cond, 3); return [t, ...H.map(h => cellS(stat(fwd(ra, idx, h))))]; });
  const ex = ra.map((v, i) => [i, v]); const mx = ex.reduce((p, q) => q[1] > p[1] ? q : p), mn = ex.reduce((p, q) => q[1] < p[1] ? q : p);
  $("#aaRsT").innerHTML = `<div class="kpis">${kp2("Z-score attuale", num(z[z.length - 1], 2))}${kp2("Variazione del rapporto, 12 mesi", pc(ra[ra.length - 1] / ra[ra.length - 13] - 1))}${kp2("Massimo storico del rapporto", ks[mx[0]])}${kp2("Minimo storico del rapporto", ks[mn[0]])}</div>
  <h4>Rendimento relativo di A su B dopo gli estremi</h4>${table(["Estremo", "3 mesi", "6 mesi", "12 mesi"], rows)}<p class="note">Rendimento relativo = variazione del rapporto A/B (positivo = A batte B). Mensile, ${ccy}, ${ks[0]} → ${ks[ks.length - 1]}. Euro Stoxx 50 e settori USA non ancora disponibili (download in sospeso).</p>`;
}
function aaMom(S, ch) {
  const Lm = new Map(); S.d.forEach((d, i) => Lm.set(d.slice(0, 7), S.c[i])); const ks = [...Lm.keys()].sort(); if (ks.length < 37) { $("#aaMomT").innerHTML = `<p class="warn">Storia insufficiente.</p>`; return; }
  const ccy = S.cur, xe = ccy === "EUR" ? monthlyLv("XEON.DE", "EUR", "EUR") : null, us = monthlyLv("CASH", "USD", "USD");
  const cashR = (k, kp) => (xe && xe.has(k) && xe.has(kp)) ? xe.get(k) / xe.get(kp) - 1 : (us.has(k) && us.has(kp) ? us.get(k) / us.get(kp) - 1 : 0);
  const months = [], rb = [], rm = [], inv = []; for (let i = 13; i < ks.length; i++) { const r = Lm.get(ks[i]) / Lm.get(ks[i - 1]) - 1, on = Lm.get(ks[i - 1]) / Lm.get(ks[i - 13]) - 1 > 0; months.push(ks[i]); rb.push(r); rm.push(on ? r : cashR(ks[i], ks[i - 1])); inv.push(on); }
  const st2 = R => { const eq = [1]; R.forEach(r => eq.push(eq[eq.length - 1] * (1 + r))); let pk = 1, md = 0; eq.forEach(v => { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); }); const m = R.reduce((a, b) => a + b, 0) / R.length, sd = Math.sqrt(R.reduce((a, b) => a + (b - m) ** 2, 0) / (R.length - 1)); return { eq, cagr: eq[eq.length - 1] ** (12 / R.length) - 1, vol: sd * Math.sqrt(12), md }; };
  const A = st2(rb), B = st2(rm), sw = inv.filter((v, i) => i && v !== inv[i - 1]).length; const xs = [ks[12], ...months].map(k => k + "-28");
  plot(ch[7], [{ x: xs, y: A.eq.map(v => v * 100), name: "Compra e tieni", line: { color: C.grey, width: 1.4 } }, { x: xs, y: B.eq.map(v => v * 100), name: "Momentum 12 mesi (altrimenti liquidità)", line: { color: C.gold, width: 1.8 } }], { title: T("Crescita di 100 (scala logaritmica)"), yaxis: { type: "log", gridcolor: C.grid }, hovermode: "x unified" });
  $("#aaMomT").innerHTML = `${table(["Strategia", "Rendimento annuo (CAGR)", "Volatilità annua", "Calo massimo", "Tempo investito", "Cambi di posizione"], [["Compra e tieni", pc(A.cagr, 2), pct(A.vol), pc(A.md), "100%", "–"], ["Momentum 12 mesi", pc(B.cagr, 2), pct(B.vol), pc(B.md), pct(inv.filter(x => x).length / inv.length, 0), sw]])}<p class="note">Mensile, ${ccy}, ${months[0]} → ${months[months.length - 1]}. Liquidità: ${ccy === "EUR" ? "XEON (€STR) dal 2008, prima T-Bill USA a 3 mesi in valuta locale" : "T-Bill USA a 3 mesi"}. Nessun costo o imposta; segnale noto a fine mese, operazione il mese dopo.</p>`;
}
function aaBT(S, X, ch) {
  const c = S.c, d = S.d, n = c.length, P = X.P, sig = aaSignals(S, X), k = $("#aaSig").value, hI = +$("#aaH").value, h = P.H[hI];
  const dir = $("#aaDir").value === "auto" ? sig[k][2] : +$("#aaDir").value; const on = onsets(sig[k][1], 1); const tr = []; let free = 0;
  on.forEach(i => { if (i >= free && i + h < n) { tr.push({ i, j: i + h, r: dir * (c[i + h] / c[i] - 1) }); free = i + h; } });
  const s = stat(tr.map(t => t.r)); const eq = [1]; tr.forEach(t => eq.push(eq[eq.length - 1] * (1 + t.r))); let pk = 1, md = 0; eq.forEach(v => { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); });
  const base = stat(c.map((v, i) => i + h < n ? dir * (c[i + h] / v - 1) : null).filter(x => x != null)); const yrs = dayDiff(d[0], d[n - 1]) / 365.25, expo = tr.length * h / n;
  const warn = !s.n ? '<p class="warn">Nessuna operazione nel periodo.</p>' : [s.n < 30 ? `<p class="warn">⚠ Solo ${s.n} operazioni: campione piccolo, risultati poco affidabili.</p>` : "", Math.abs(s.t) < 2 ? `<p class="warn">⚠ t-stat ${num(s.t, 2)}: risultato statisticamente debole (|t| < 2), compatibile con il caso.</p>` : `<p class="pos">t-stat ${num(s.t, 2)}: |t| ≥ 2, differenza da zero difficilmente casuale (ma vale solo per questo asset e periodo).</p>`].join("");
  $("#aaBtT").innerHTML = `${warn}<div class="kpis">${kp2("Operazioni", s.n || 0)}${kp2("Win rate", pct(s.pos, 0))}${kp2("Rendimento medio per operazione", pc(s.m, 2))}${kp2("Mediana", pc(s.med, 2))}${kp2("Migliore / peggiore", s.n ? `${pct(s.best)} / ${pct(s.worst)}` : "–")}${kp2("t-stat", num(s.t, 2))}${kp2("Drawdown della curva", pc(md))}${kp2("Risultato composto", pc(eq[eq.length - 1] - 1))}${kp2("Tempo investito", pct(expo, 0))}</div>
  <p class="note">${dir > 0 ? "Long" : "Short"} su «${sig[k][0]}», chiusura dopo ${HL[hI]}, operazioni non sovrapposte. Riferimento: un'operazione ${dir > 0 ? "long" : "short"} di ${HL[hI]} in un giorno qualsiasi rende in media ${pct(base.m, 2)} (${pct(base.pos, 0)} positive). Periodo ${d[0]} → ${d[n - 1]} (${num(yrs, 1)} anni). Nessun costo, spread, imposta o costo dello short.</p>
  ${tr.length ? table(["#", "Entrata", "Uscita", "Rendimento"], tr.slice(-15).reverse().map((t, q) => [tr.length - q, d[t.i], d[t.j], pc(t.r)])) + '<p class="note">Ultime 15 operazioni.</p>' : ""}`;
  plot(ch[8], [{ x: [d[0], ...tr.map(t => d[t.j])], y: eq.map(v => v * 100), name: "Curva dei risultati (operazioni composte)", line: { color: C.gold, width: 1.8, shape: "hv" } }], { title: T("Curva dei risultati (base 100)"), yaxis: { gridcolor: C.grid } });
}
function renderGuide() {
  const o = $("#guideOut"); if (o.dataset.ok) return; o.dataset.ok = 1;
  o.innerHTML = `${pdfBtn("guidePdf", "Scarica PDF della guida")}<div class="card"><h2>Guida agli indicatori</h2><p class="muted">Descrizioni brevi degli strumenti della sezione Analisi Asset: cosa sono, come si leggono, quali limiti hanno.</p>
  ${Object.values(GUIDE).map(([t, a, b, c]) => `<div class="guide"><h3>${t}</h3><p class="lead"><b>Cos'è.</b> ${a}</p><p class="lead"><b>Come si legge.</b> ${b}</p><p class="lead"><b>Limiti.</b> ${c}</p></div>`).join("")}</div>`;
  $("#guidePdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Guida agli indicatori", sub: "Analisi Asset", file: pdfName("Guida_indicatori"), parts: [{ tab: "aaguide", root: "#guideOut" }] }));
}
{ const _st4 = showTab; showTab = function (id) { _st4(id); if (id === "aa") renderAA(); if (id === "aaguide") renderGuide(); }; }
/* --- Confronto tra asset --- */
window.__aaCmp = window.__aaCmp || null;
function aaCmpRender() {
  const box = $("#aaCmp"); if (!box) return; const A = $("#aaA").value; if (!window.__aaCmp) window.__aaCmp = [A, A === "US" ? "WORLDI" : "US"];
  const L = window.__aaCmp, ccy = $("#aaCcy").value === "ORIG" ? "EUR" : $("#aaCcy").value;
  const [c1, i1] = div("chart tall"), [c2, i2] = div();
  box.innerHTML = `<h3>0 · Confronto tra asset</h3><div class="form"><span class="chips" id="aaCmpL">${L.map(id => `<span class="chip on cmpchip">${keyOf(id)[0]} · dal ${startY(id) || "–"} <b data-rm="${id}" title="Rimuovi">✕</b></span>`).join("")}</span>
   <label>Aggiungi <select id="aaCmpAdd"><option value="">— scegli —</option>${aaOpt("", L)}</select></label><button id="aaBtpAll" title="Mette a confronto BTP 1, 2, 3, 5 e 10 anni con il metodo scelto (scadenza costante / tenuta a scadenza, cedole, tasse)">Tutte le scadenze BTP</button><button id="aaReset" title="Ripristina periodo, valuta e confronto">Azzera filtri</button></div>
   <p class="muted" id="aaCmpInfo"></p>${c1}${c2}<div id="aaCmpT"></div>`;
  $("#aaCmpAdd").onchange = e => { if (e.target.value) { L.push(e.target.value); aaCmpRender(); } };
  $("#aaCmpL").onclick = e => { const r = e.target.dataset.rm; if (r && L.length > 1) { window.__aaCmp = L.filter(x => x !== r); aaCmpRender(); } };
  $("#aaBtpAll").onclick = () => { window.__aaCmp = ["BTP1", "BTP2", "BTP3", "BTP5", "BTP10Y"]; aaCmpRender(); };
  $("#aaReset").onclick = () => { ["aaY", "aaFrom", "aaTo"].forEach(i => $("#" + i).value = ""); $("#aaCcy").value = "EUR"; window.__aaCmp = null; aaRun(); };
  if (L.length < 2) { $("#aaCmpT").innerHTML = `<p class="muted">Aggiungi almeno un secondo asset.</p>`; return; }
  const lv = L.map(id => monthlyLv(keyOf(id)[1], keyOf(id)[2], ccy)); let ks = [...lv[0].keys()].filter(k => lv.every(m => m.has(k))).sort();
  const S0 = { d: ks.map(k => k + "-28") }; if (ks.length) { const [f, t] = rangeOf("aa", { d: S0.d.length ? S0.d : ["1900-01-01"] }); ks = ks.filter(k => k >= f.slice(0, 7) && k <= t.slice(0, 7)); }
  if (ks.length < 24) { $("#aaCmpT").innerHTML = `<p class="warn">Storia comune insufficiente (${ks.length} mesi). Rimuovi l'asset con la storia più breve o allarga il periodo.</p>`; return; }
  $("#aaCmpInfo").innerHTML = `Periodo comune: <b>${ks[0]} → ${ks[ks.length - 1]}</b> (${ks.length} mesi), ${ccy}, livelli di fine mese.`;
  const xs = ks.map(k => k + "-28"), pal = [C.gold, C.blue, C.green, C.red, "#b48ade", "#e0a060", "#9aa", "#d4d"];
  plot(i1, L.map((id, j) => ({ x: xs, y: ks.map(k => lv[j].get(k) / lv[j].get(ks[0]) * 100), name: keyOf(id)[0], line: { color: pal[j % 8], width: 1.6 } })), { title: T(`Performance normalizzata (base 100, ${ccy}, scala log)`), yaxis: { type: "log", gridcolor: C.grid }, hovermode: "x unified" });
  plot(i2, L.slice(1).map((id, j) => ({ x: xs, y: ks.map(k => (lv[j + 1].get(k) / lv[0].get(k)) / (lv[j + 1].get(ks[0]) / lv[0].get(ks[0])) * 100), name: `${keyOf(id)[0]} / ${keyOf(L[0])[0]}`, line: { color: pal[(j + 1) % 8], width: 1.4 } })), { title: T(`Forza relativa rispetto a ${keyOf(L[0])[0]} (base 100; sale = fa meglio)`), yaxis: { type: "log", gridcolor: C.grid }, hovermode: "x unified" });
  const R = lv.map(m => ks.slice(1).map((k, i) => m.get(k) / m.get(ks[i]) - 1));
  const st3 = r => { const eq = [1]; r.forEach(x => eq.push(eq[eq.length - 1] * (1 + x))); let pk = 1, md = 0; eq.forEach(v => { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); }); const s = stat(r); return { cagr: eq[eq.length - 1] ** (12 / r.length) - 1, vol: s.sd * Math.sqrt(12), md, pos: s.pos, worst: s.worst, best: s.best }; };
  const ys = [...new Set(ks.map(k => k.slice(0, 4)))]; const yr = j => ys.map(y => { const kk = ks.filter(k => k.startsWith(y)); const p = ks.indexOf(kk[0]) - 1; return p >= 0 && kk.length === 12 ? lv[j].get(kk[11]) / lv[j].get(ks[p]) - 1 : null; }).filter(x => x != null);
  const SS = L.map((id, j) => ({ ...st3(R[j]), yr: stat(yr(j)) }));
  const corr = (a, b) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let s = 0, sa = 0, sb = 0; a.forEach((x, i) => { s += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return s / Math.sqrt(sa * sb); };
  const sigRow = id => { const S = aaSeries(id, $("#aaCcy").value); if (!S || S.c.length < 60) return null; const X = aaCompute(S), Lx = S.c.length - 1, P = X.P, sg = aaSignals(S, X), f = k => stat(fwd(S.c, onsets(sg[k][1], P.gap), P.H[3])); return [keyOf(id)[0], num(X.rsi[Lx], 1), num(X.dist[Lx], 2) + " σ", num(X.z[Lx], 2), cellS(f("rsi30")), cellS(f("dm2")), cellS(f("rsi70"))]; };
  $("#aaCmpT").innerHTML = `<h4>Statistiche a confronto (periodo comune)</h4>${table(["Asset", "Rend. annuo (CAGR)", "Volatilità annua", "Calo massimo", "Mesi positivi", "Miglior / peggior mese", "Anni solari: media · peggiore (N)"], L.map((id, j) => [keyOf(id)[0], pc(SS[j].cagr, 2), pct(SS[j].vol), pc(SS[j].md), pct(SS[j].pos, 0), `${pct(SS[j].best)} / ${pct(SS[j].worst)}`, SS[j].yr.n ? `${pct(SS[j].yr.m)} · ${pct(SS[j].yr.worst)} (${SS[j].yr.n})` : "–"]))}
   <h4>Correlazione dei rendimenti mensili</h4>${table(["", ...L.map(id => keyOf(id)[0])], L.map((a, i) => [keyOf(a)[0], ...L.map((b, j) => { const v = corr(R[i], R[j]); return `<span style="color:${v > .7 ? C.red : v < .3 ? C.green : C.text}">${num(v, 2)}</span>`; })]))}
   <h4>Segnali a confronto (valori attuali e rendimento a 12 mesi dopo il segnale, storia intera di ciascun asset)</h4>${table(["Asset", "RSI", "Distanza media 200", "Z-score 1 mese", "Dopo RSI < 30", "Dopo −2σ dalla media", "Dopo RSI > 70"], L.map(sigRow).filter(Boolean))}
   <p class="note">Correlazione: rosso > 0,7 (si muovono insieme), verde < 0,3 (buona diversificazione). I segnali usano la serie giornaliera dove disponibile, altrimenti mensile.</p>`;
}
{ const _run = aaRun; aaRun = function () { _run(); const b = $("#aaBody"); if (b && !$("#aaCmp")) b.insertAdjacentHTML("afterbegin", `<div class="card" id="aaCmp"></div>`); aaCmpRender(); }; }
