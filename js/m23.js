"use strict";
/* ===== v5: Tilt fattoriali – core + satelliti fattoriali ===== */
const TF_LIST = [...FW, ...FS];
const TF_COL = ["#4e8fd9", "#e07b39", "#5fb37a", "#b08bd9", "#d9534f", "#5fb3b3", "#c9b458", "#d4a5a5", "#8fbf6f", "#c08bc0", "#7a9cc6", "#e0a060", "#999"];
const TF_INFO = {
  FVAL: ["Value (titoli «a sconto»)", "Società con prezzo basso rispetto a utili, patrimonio e dividendi.", "Si compra a sconto: chi è sottovalutato ha spesso margini di recupero; in più si viene pagati per sopportare aziende poco di moda.", "Soffre quando il mercato premia la crescita futura (es. tecnologia 2017–2020) e quando i tassi scendono a lungo.", "Banche, energia, industria tradizionale più presenti; meno big tech."],
  FMOM: ["Momentum (chi sale continua a salire)", "Azioni salite di più negli ultimi 6–12 mesi.", "Gli investitori reagiscono lentamente alle notizie: i trend tendono a continuare per qualche mese.", "Soffre nelle inversioni brusche di mercato (es. rimbalzo del 2009, 2022): ha comprato i vincitori di ieri.", "Nel 2023–2024 pesava molto sui titoli dell'intelligenza artificiale."],
  FQUAL: ["Quality (aziende solide)", "Alta redditività (ROE), poco debito, utili stabili.", "Aziende solide tendono a deludere meno e a reggere meglio le crisi.", "Può restare indietro nei rally guidati da titoli ciclici o speculativi e quando è già cara.", "Molti titoli tecnologici e sanitari di grandi dimensioni."],
  FSNQ: ["Quality neutrale per settore (ETF IWQU)", "Come Quality, ma scegliendo i migliori dentro ogni settore: i pesi settoriali restano simili all'MSCI World.", "Stessa idea di Quality, con meno scommesse sui settori.", "Come Quality, in modo più attenuato.", "È l'indice replicato dall'ETF iShares IWQU."],
  FMINV: ["Minima volatilità (azioni più tranquille)", "Portafoglio costruito per avere la minore oscillazione possibile.", "Le azioni meno rischiose, storicamente, non hanno reso molto meno delle altre («anomalia della bassa volatilità»): cali più contenuti.", "Resta indietro nei mercati in forte rialzo; soffre se i tassi salgono rapidamente (tanti titoli «tipo obbligazione»).", "Utility, beni di consumo, sanità più presenti."],
  FSMALL: ["Small cap (piccole società)", "Società piccole dei paesi sviluppati.", "Più rischiose e meno seguite dagli analisti: storicamente premiate con un rendimento extra, ma non costante.", "Soffrono nelle recessioni e quando il credito si stringe; dal 2010 hanno spesso reso meno delle grandi.", "Migliaia di aziende, più legate all'economia domestica."],
  FEQW: ["Equal weight (stesso peso a tutti)", "Ogni società pesa uguale, invece che per capitalizzazione.", "Riduce la concentrazione nei giganti e dà più peso alle società medie.", "Resta indietro quando pochi giganti trascinano il mercato (2020–2024).", "Le prime 10 società pesano circa l'1% a testa invece di oltre il 20% complessivo."],
  FHDY: ["Alto dividendo", "Società con dividendi elevati e sostenibili.", "Flusso di cassa regolare, spesso aziende mature e meno care.", "Soffre quando i tassi salgono (concorrenza delle obbligazioni) e quando corre la crescita.", "Più finanziari, energia, beni di consumo."],
  FSPV: ["S&P 500 Value", "La metà «value» dell'S&P 500.", "Come Value, ma solo USA.", "Come Value: periodi lunghi di ritardo quando la crescita domina.", "ETF iShares IVE (USA)."],
  FSPG: ["S&P 500 Growth (per confronto)", "La metà «growth» dell'S&P 500.", "Opposto del Value: utile per vedere i cicli value/growth.", "Soffre quando salgono i tassi e quando le valutazioni scendono (2022).", "ETF iShares IVW (USA)."],
  FSPEW: ["S&P 500 Equal Weight", "Le 500 società dell'S&P 500 con peso uguale.", "Meno concentrazione nei giganti tecnologici.", "Resta indietro quando i «Magnifici 7» guidano il mercato.", "ETF Invesco RSP (USA); in Europa esiste la versione UCITS (Xtrackers XDEW)."],
  FSDY: ["Dividend Aristocrats USA", "Società che aumentano il dividendo da almeno 20 anni.", "Disciplina finanziaria e stabilità.", "Soffre nei rally della crescita e con tassi in rialzo.", "ETF SPDR SDY (USA); in Europa SPDR USDV (UCITS)."],
  FSPEWU: ["S&P 500 Equal Weight UCITS (XDEW)", "Versione europea ad accumulazione dell'Equal Weight.", "Come RSP, acquistabile in Italia.", "Come RSP; dati solo dal 2014.", "Xtrackers IE00BLNMYC90, prezzi justETF in EUR."],
  FSDYU: ["Dividend Aristocrats UCITS (USDV)", "Versione europea dell'SDY (distribuzione, dividendi reinvestiti nel calcolo).", "Come SDY, acquistabile in Italia.", "Come SDY; la ritenuta USA sui dividendi costa circa 0,5% l'anno rispetto all'SDY.", "SPDR IE00B6YX5D40, prezzi justETF in EUR, dal 2011."],
  FSPHD: ["S&P 500 High Dividend", "Le 80 società S&P 500 con dividendo più alto.", "Alto rendimento da dividendi.", "Molto concentrata su finanza, immobiliare, utility: soffre con tassi in rialzo.", "ETF SPDR SPYD (USA), dal 2015."] };
window.__tf = window.__tf || { sel: new Set(["FVAL", "FMOM", "FSNQ", "FMINV", "FSMALL"]), w: {} };
const tfName = id => (TF_INFO[id] || [UNI[id].n])[0];
function renderTilt() {
  const o = $("#tiltOut"); if (o.dataset.ok) return runTilt(); o.dataset.ok = 1;
  const yrs = Array.from({ length: 2026 - 1993 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}">${y}</option>`).join("");
  const D = {}; ["cum", "rs", "roll", "corr", "eq", "fe", "hm"].forEach(k => { const [h, id] = div(k === "cum" || k === "fe" || k === "hm" ? "chart tall" : "chart"); D[k] = [h, id]; });
  o._D = Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v[1]]));
  o.innerHTML = `${pdfBtn("tiltPdf", "Scarica PDF")}<div class="card"><h2>Tilt fattoriali: conviene aggiungere satelliti al portafoglio?</h2>
  <p class="lead">Un «fattore» è una caratteristica comune a un gruppo di azioni (prezzo basso, trend positivo, solidità, bassa volatilità, piccole dimensioni) che nel lungo periodo ha dato rendimenti diversi dal mercato. Qui confrontiamo i fattori con il portafoglio «core» (MSCI World o S&amp;P 500) per capire se aggiungerne un po' migliora davvero il rapporto rendimento/rischio, e in che percentuale.</p>
  <div class="form"><label>Core <select id="tfCore"><option value="WORLDI">MSCI World (indice Net TR)</option><option value="US">S&amp;P 500 (Total Return)</option></select></label>
   <label>Valuta <select id="tfCcy"><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
</div>
  <div class="periodbar"><b>📅 Periodo di analisi</b><label>Anno di partenza <select id="tfY0"><option value="">Massimo disponibile</option>${yrs}</select></label><label>Anno di fine <select id="tfY1"><option value="">Ultimo disponibile</option>${yrs}</select></label><span class="chips">${[["", "", "Tutto"], ["2001", "", "Dal 2001"], ["2010", "", "Dal 2010"], ["2016", "", "Ultimi 10 anni"], ["2007", "2012", "Crisi 2007–2012"], ["2020", "", "Dal 2020"]].map(([a, b, t]) => `<span class="chip" data-tfp="${a}|${b}">${t}</span>`).join("")}</span><span class="muted">Vale per tutte le sezioni della pagina.</span></div>
  <div class="form"><span class="muted">Fattori da analizzare:</span><span class="chips" id="tfChips">${TF_LIST.map(id => `<span class="chip ${window.__tf.sel.has(id) ? "on" : ""}" data-tf="${id}" title="${UNI[id].n}">${tfName(id).split(" (")[0]} · dal ${startY(id) || "–"}</span>`).join("")}</span></div>
  <div id="tfNote"></div></div>
  <div class="card"><h3>1 · Che cosa sono i fattori</h3><div id="tfCards" class="tfcards"></div></div>
  <div class="card"><h3>2 · Fattori contro il core</h3><div id="tfSum"></div>${D.cum[0]}${D.rs[0]}
   <div class="form"><label>Finestra mobile <select id="tfRoll"><option value="36">3 anni</option><option value="60" selected>5 anni</option></select></label></div>${D.roll[0]}<div id="tfYear"></div>${D.corr[0]}</div>
  <div class="card"><h3>3 · Quando funziona e quando no</h3><p class="lead">Rendimento in più (o in meno) di ogni fattore rispetto al core, secondo la situazione di mercato e macroeconomica <b>del mese precedente</b> (quella che si poteva osservare).</p>
   <div class="form"><label>Mostra <select id="tfHmM"><option value="ex">Extra-rendimento annualizzato</option><option value="hit">% mesi in cui batte il core</option></select></label></div>${D.hm[0]}<div id="tfHmT"></div><div id="tfSugg"></div></div>
  <div class="card"><h3>4 · Costruisci il tuo core-satellite</h3><p class="lead">Sposta i cursori: ogni punto dato ai satelliti viene tolto al core. Ribilanciamento annuale.</p><div id="tfBld"></div><div id="tfBldR"></div>${D.eq[0]}</div>
  <div class="card"><h3>5 · Frontiera efficiente</h3><div class="form"><label>Peso massimo per satellite <select id="tfCap"><option value="0.1">10%</option><option value="0.2">20%</option><option value="0.3" selected>30%</option><option value="0.5">50%</option><option value="1">nessun limite</option></select></label><label>Peso minimo del core <select id="tfCoreMin"><option value="0">0%</option><option value="0.4">40%</option><option value="0.5" selected>50%</option><option value="0.7">70%</option></select></label></div>${D.fe[0]}<div id="tfFeT"></div>
   <p class="warn">La frontiera usa il passato: i pesi «ottimali» cambiano molto da un periodo all'altro. Va letta come indicazione di quanto la diversificazione ha aiutato, non come ricetta.</p></div>
  <div class="card"><h3>6 · Conclusioni dai dati</h3><div id="tfConc"></div></div>`;
  ["#tfCore", "#tfCcy", "#tfY0", "#tfY1", "#tfRoll", "#tfCap", "#tfCoreMin", "#tfHmM"].forEach(s => $(s).onchange = runTilt);
  document.querySelectorAll("[data-tfp]").forEach(c => c.onclick = () => { const [a, b] = c.dataset.tfp.split("|"); $("#tfY0").value = a; $("#tfY1").value = b; runTilt(); });
  $("#tfChips").onclick = e => { const c = e.target.closest("[data-tf]"); if (!c) return; const id = c.dataset.tf, S = window.__tf.sel; S.has(id) ? S.delete(id) : S.add(id); if (!S.size) S.add(id); c.classList.toggle("on", S.has(id)); runTilt(); };
  $("#tiltPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Tilt fattoriali", sub: window.__tfLast || "", file: pdfName("Tilt_fattoriali"), parts: [{ tab: "tilt", root: "#tiltOut" }] }));
  runTilt();
}
function tfMacro() { // Map YYYY-MM -> valore
  const M = window.MACROF || {}, g = k => new Map((M[k] ? M[k].d : []).map((d, i) => [d, M[k].v[i]])); return { gs10: g("GS10"), gs2: g("GS2"), cpi: g("CPIAUCSL"), rec: g("USREC"), bund: g("IRLTLT01DEM156N"), fx: g("EXUSEU"), hicp: g("CP0000EZ19M086NEST") };
}
const tfPrev = (k, n) => { let [y, m] = k.split("-").map(Number); m -= n; while (m <= 0) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
function runTilt() {
  const o = $("#tiltOut"), D = o._D, core = $("#tfCore").value, ccy = $("#tfCcy").value, y0 = $("#tfY0").value, y1 = $("#tfY1").value;
  const sel = TF_LIST.filter(id => window.__tf.sel.has(id)), ids = [core, ...sel];
  if (y0 && y1 && +y1 < +y0) { $("#tfNote").innerHTML = `<p class="warn">L'anno di fine è precedente all'anno di partenza.</p>`; return; }
  const from = y0 ? `${+y0 - 1}-12-01` : "1900-01-01", to = y1 ? `${y1}-12-31` : "2100-12-31";
  const M = monthlyRets(ids, ccy, from, to), T = M.months.length;
  const fmtM = k => { const [a, b] = k.split("-").map(Number); return new Date(Date.UTC(a, b - 1, 1)).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }); };
  const first = id => { const [, src, cur] = keyOf(id); return [...monthlyLv(src, cur, ccy).keys()].sort()[0]; };
  const lim = ids.filter(id => first(id) === M.start).map(id => `<b>${tfName(id) === UNI[id]?.n ? UNI[id].n : (TF_INFO[id] ? tfName(id) : UNI[id].n)}</b> (dati da ${fmtM(first(id))})`);
  if (T < 36) { $("#tfNote").innerHTML = `<p class="warn">Servono almeno 36 mesi comuni (trovati ${T}). Limitano: ${lim.join(", ")}.</p>`; return; }
  $("#tfNote").innerHTML = (y0 && M.months[0] > `${y0}-01` ? `<p class="warn">⚠️ Hai chiesto dal ${y0}, ma l'analisi parte da ${fmtM(M.months[0])}: ${lim.join(", ")}. Togli questi strumenti per partire prima.</p>` : "") +
    `<p class="note">Periodo analizzato: <b>${fmtM(M.months[0])} → ${fmtM(M.months[T - 1])}</b> (${T} mesi, ${ccy})${!y0 && lim.length ? "; il primo mese comune è fissato da " + lim.join(", ") : ""}. Tutti gli strumenti sullo stesso periodo. Indici MSCI: livelli ufficiali Net TR (app2.msci.com); fattori S&amp;P 500: ETF USA con dividendi reinvestiti (Yahoo)${ccy === "EUR" ? ", convertiti in EUR senza copertura" : ""}.</p>`;
  window.__tfLast = `Core ${UNI[core].n} · ${ccy} · ${M.months[0]} → ${M.months[T - 1]}`;
  const R = Object.fromEntries(ids.map((id, j) => [id, M.R[j]])), rc = R[core], rf = cashRets(M.months, ccy);
  const st = id => pstats(R[id], rf), S0 = st(core);
  // --- 1. schede
  $("#tfCards").innerHTML = sel.map(id => { const I = TF_INFO[id]; return `<div class="tfcard"><h4>${I[0]}</h4><p><b>Cos'è.</b> ${I[1]}</p><p><b>Perché dovrebbe funzionare.</b> ${I[2]}</p><p><b>Quando soffre.</b> ${I[3]}</p><p class="muted"><b>Esempio.</b> ${I[4]} Strumento: ${UNI[id].n}, dal ${startY(id)}.</p></div>`; }).join("");
  // --- 2. confronto
  const roll = (a, b, n) => { const out = []; for (let t = n; t <= T; t++) { let pa = 1, pb = 1; for (let i = t - n; i < t; i++) { pa *= 1 + a[i]; pb *= 1 + b[i]; } out.push((pa / pb) ** (12 / n) - 1); } return out; };
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0, sa = 0, sb = 0; a.forEach((x, i) => { s += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return s / Math.sqrt(sa * sb); };
  const rows = [[`<b>Core: ${UNI[core].n}</b>`, pc(S0.cagr, 2), "–", pct(S0.vol), pc(S0.md), num(S0.sharpe), "1,00", "–", "–"]];
  const SS = {}; sel.forEach(id => { const S = st(id), r3 = roll(R[id], rc, 36), r5 = roll(R[id], rc, 60); SS[id] = { S, r3, r5 };
    rows.push([tfName(id), pc(S.cagr, 2), pc(S.cagr - S0.cagr, 2), pct(S.vol), pc(S.md), num(S.sharpe), num(corr(R[id], rc)), r3.length ? pct(r3.filter(x => x > 0).length / r3.length, 0) : "–", r5.length ? pct(r5.filter(x => x > 0).length / r5.length, 0) : "–"]); });
  $("#tfSum").innerHTML = table(["Strumento", "Rend. annuo (CAGR)", "Differenza vs core", "Volatilità", "Calo massimo", "Sharpe", "Correlazione col core", "% periodi 3 anni sopra il core", "% periodi 5 anni sopra il core"], rows).replace("<table", '<table class="full"') +
    `<p class="note">Sharpe = (rendimento − liquidità ${ccy === "EUR" ? "T-Bill USA usato come proxy" : "T-Bill USA"}) / volatilità. «% periodi sopra il core»: quota delle finestre mobili di 3 o 5 anni in cui il fattore ha reso più del core.</p>`;
  const xs = [M.start, ...M.months], cum = r => { const e = [100]; r.forEach(x => e.push(e[e.length - 1] * (1 + x))); return e; };
  plot(D.cum, [{ x: xs, y: cum(rc), name: "Core", line: { color: C.gold, width: 3 } }, ...sel.map((id, i) => ({ x: xs, y: cum(R[id]), name: tfName(id).split(" (")[0], line: { color: TF_COL[TF_LIST.indexOf(id)], width: 1.4 } }))], { title: "Crescita di 100 (scala log)", yaxis: { type: "log", gridcolor: C.grid } });
  plot(D.rs, sel.map(id => { const a = cum(R[id]), b = cum(rc); return { x: xs, y: a.map((v, i) => 100 * v / b[i]), name: tfName(id).split(" (")[0], line: { color: TF_COL[TF_LIST.indexOf(id)] } }; }), { title: "Forza relativa vs core (100 = pari; sale = il fattore fa meglio)", shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100, line: { color: "#666", dash: "dot" } }] });
  const n = +$("#tfRoll").value;
  plot(D.roll, sel.map(id => ({ x: M.months.slice(n - 1), y: roll(R[id], rc, n), name: tfName(id).split(" (")[0], line: { color: TF_COL[TF_LIST.indexOf(id)] } })), { title: `Extra-rendimento annuo su finestre mobili di ${n / 12} anni`, yaxis: { tickformat: ".0%", gridcolor: C.grid }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "#666" } }] });
  const Y = [...new Set(M.months.map(m => m.slice(0, 4)))], yr = (r, y) => M.months.reduce((p, m, i) => m.startsWith(y) ? p * (1 + r[i]) : p, 1) - 1;
  $("#tfYear").innerHTML = `<h4>Extra-rendimento per anno solare (fattore − core)</h4><div class="scrollx"><table class="heat full"><tr><th>Anno</th><th>Core</th>${sel.map(id => `<th>${tfName(id).split(" (")[0]}</th>`).join("")}</tr>${Y.slice().reverse().map(y => { const c = yr(rc, y); return `<tr><td>${y}${M.months.filter(m => m.startsWith(y)).length < 12 ? "*" : ""}</td><td>${pc(c)}</td>${sel.map(id => { const x = yr(R[id], y) - c; return `<td style="background:${x > 0 ? `rgba(95,179,122,${Math.min(.6, Math.abs(x) * 4)})` : `rgba(217,83,79,${Math.min(.6, Math.abs(x) * 4)})`}">${pct(x)}</td>`; }).join("")}</tr>`; }).join("")}</table></div><p class="note">* anno parziale.</p>`;
  const CM = [core, ...sel].map(a => [core, ...sel].map(b => corr(R[a], R[b]))), lab = ["Core", ...sel.map(id => tfName(id).split(" (")[0])];
  plot(D.corr, [{ type: "heatmap", z: CM, x: lab, y: lab, zmin: 0.5, zmax: 1, colorscale: [[0, "#1f3b5a"], [1, "#c9a54c"]], text: CM.map(r => r.map(v => v.toFixed(2))), texttemplate: "%{text}", hoverinfo: "skip" }], { title: "Correlazione dei rendimenti mensili", margin: { l: 120, b: 90, t: 40 } });
  // --- 3. regimi
  const mc = tfMacro(), lv = cum(rc), K = xs; const reg = [];
  const at = (m, k) => m.get(k), yoy = (m, k) => { const a = m.get(k), b = m.get(tfPrev(k, 12)); return a && b ? a / b - 1 : null; }, ch12 = (m, k) => { const a = m.get(k), b = m.get(tfPrev(k, 12)); return a != null && b != null ? a - b : null; };
  const vol6 = i => i >= 6 ? std(rc.slice(i - 6, i)) * Math.sqrt(12) : null, vols = rc.map((_, i) => vol6(i)).filter(v => v != null).sort((a, b) => a - b), vmed = vols[Math.floor(vols.length / 2)];
  let pk = lv[0]; const ddAt = lv.map(v => { pk = Math.max(pk, v); return v / pk - 1; });
  const recov = new Array(T).fill(false); { let i = 0; while (i < lv.length) { if (ddAt[i] <= -0.2) { let j = i; while (j < lv.length && ddAt[j] < 0) j++; let tr = i; for (let k = i; k < j; k++) if (lv[k] < lv[tr]) tr = k; for (let k = tr; k < Math.min(tr + 12, T); k++) recov[k] = true; i = j; } else i++; } }
  const DEF = [["Mercato toro (core sopra media 10 mesi)", "Mercato orso (core sotto media 10 mesi)", i => { if (i < 10) return null; const ma = mean(lv.slice(i - 9, i + 1)); return lv[i] >= ma; }],
    ["Core in calo oltre −20%", null, i => ddAt[i] <= -0.2 ? true : null],
    ["Primi 12 mesi di ripresa (dopo un calo > 20%)", null, i => recov[i] ? true : null],
    ["Volatilità alta (6 mesi, sopra mediana)", "Volatilità bassa", i => { const v = vol6(i + 1); return v == null ? null : v >= vmed; }],
    ["Tassi USA 10a in salita (12 mesi)", "Tassi USA 10a in discesa", i => { const c = ch12(mc.gs10, K[i]); return c == null ? null : c > 0; }],
    ["Bund 10a in salita (12 mesi)", "Bund 10a in discesa", i => { const c = ch12(mc.bund, K[i]); return c == null ? null : c > 0; }],
    ["Inflazione USA alta (> 3%)", "Inflazione USA bassa (≤ 3%)", i => { const v = yoy(mc.cpi, K[i]); return v == null ? null : v > 0.03; }],
    ["Inflazione euro in salita (12 mesi)", "Inflazione euro in discesa", i => { const a = yoy(mc.hicp, K[i]), b = yoy(mc.hicp, tfPrev(K[i], 12)); return a == null || b == null ? null : a > b; }],
    ["Recessione USA (NBER)", "Espansione USA", i => { const v = at(mc.rec, K[i]); return v == null ? null : v === 1; }],
    ["Curva USA invertita (10a < 2a)", "Curva USA positiva", i => { const a = at(mc.gs10, K[i]), b = at(mc.gs2, K[i]); return a == null || b == null ? null : a < b; }],
    ["Dollaro in rafforzamento (12 mesi)", "Dollaro in indebolimento", i => { const c = ch12(mc.fx, K[i]); return c == null ? null : c < 0; }]];
  const cols = []; DEF.forEach(([a, b, f]) => { cols.push([a, i => f(i) === true]); if (b) cols.push([b, i => f(i) === false]); });
  const HM = sel.map(id => cols.map(([, f]) => { const ex = []; for (let t = 0; t < T; t++) { if (f(t)) ex.push(R[id][t] - rc[t]); } return { n: ex.length, ex: ex.length ? mean(ex) * 12 : null, hit: ex.length ? ex.filter(x => x > 0).length / ex.length : null }; }));
  const mode = $("#tfHmM").value, Z = HM.map(r => r.map(c => c.n >= 12 ? (mode === "ex" ? c.ex : c.hit - 0.5) : null));
  plot(D.hm, [{ type: "heatmap", z: Z, x: cols.map(c => c[0].replace(/ \(/, "<br>(")), y: sel.map(id => tfName(id).split(" (")[0]), zmid: 0, colorscale: [[0, "#b03a36"], [0.5, "#222"], [1, "#3f9a5f"]], zmin: mode === "ex" ? -0.12 : -0.3, zmax: mode === "ex" ? 0.12 : 0.3,
    text: HM.map(r => r.map(c => c.n < 12 ? `n=${c.n}` : (mode === "ex" ? pct(c.ex, 1) : pct(c.hit, 0)) + `<br>n=${c.n}`)), texttemplate: "%{text}", hoverinfo: "skip", showscale: false }], { title: mode === "ex" ? "Extra-rendimento annualizzato vs core, per situazione (n = mesi)" : "% mesi in cui il fattore batte il core (n = mesi)", margin: { l: 190, b: 150, t: 40 }, xaxis: { tickangle: -40, tickfont: { size: 10 } }, height: 260 + 34 * sel.length });
  $("#tfHmT").innerHTML = `<p class="note">Ogni mese è classificato con dati noti alla fine del mese precedente (eccetto recessione NBER e «primi 12 mesi di ripresa», noti solo a posteriori). Celle con meno di 12 mesi non colorate. Fonti macro: FRED (Treasury GS10/GS2, CPI USA, recessioni NBER USREC, Bund OCSE, cambio EUR/USD, HICP Eurostat).</p>`;
  $("#tfSugg").innerHTML = `<h4>In pratica: cosa dicono i dati per ogni fattore</h4>` + table(["Fattore", "Ha aiutato di più quando…", "Ha sofferto di più quando…", "Nel complesso"], sel.map((id, k) => {
    const L = cols.map((c, j) => ({ c: c[0], ...HM[k][j] })).filter(x => x.n >= 24).sort((a, b) => b.ex - a.ex), S = SS[id].S, good = L.slice(0, 2).filter(x => x.ex > 0.005), bad = L.slice(-2).reverse().filter(x => x.ex < -0.005);
    return [tfName(id), good.map(x => `${x.c.toLowerCase()}: ${pc(x.ex, 1)}/anno (${x.n} mesi)`).join("<br>") || "–", bad.map(x => `${x.c.toLowerCase()}: ${pc(x.ex, 1)}/anno (${x.n} mesi)`).join("<br>") || "–",
      `${S.cagr > S0.cagr ? "rendimento superiore" : "rendimento inferiore"} al core (${pc(S.cagr - S0.cagr, 2)}/anno), ${S.vol < S0.vol ? "meno" : "più"} volatile, Sharpe ${num(S.sharpe)} vs ${num(S0.sharpe)}`]; })) +
    `<p class="warn">Attenzione: campioni piccoli (alcune situazioni durano pochi mesi o anni), dati del passato e regimi riconosciuti spesso solo dopo. Non sono segnali per entrare e uscire: servono a capire <b>che cosa aspettarsi</b> da un satellite e a scegliere quelli che si completano a vicenda.</p>`;
  // --- 4. builder
  const W = window.__tf.w; sel.forEach(id => { if (W[id] == null) W[id] = 0; });
  $("#tfBld").innerHTML = `<div class="tfbld">${sel.map(id => `<label>${tfName(id).split(" (")[0]} <input type="range" min="0" max="50" step="5" data-tfw="${id}" value="${W[id]}"> <b id="tfwv_${id}">${W[id]}%</b></label>`).join("")}</div><p id="tfCoreW" class="note"></p><button id="tfRes" class="nopdf">Azzera satelliti</button>`;
  const bld = () => {
    let s = sel.reduce((a, id) => a + W[id], 0); if (s > 100) { $("#tfCoreW").innerHTML = `<span class="warn">I satelliti superano il 100%.</span>`; return; }
    $("#tfCoreW").innerHTML = `Core (${UNI[core].n}): <b>${100 - s}%</b> · satelliti: <b>${s}%</b>`;
    const w = [1 - s / 100, ...sel.map(id => W[id] / 100)], sim = simulate([rc, ...sel.map(id => R[id])], w, "annual", M.months), P = pstats(sim.ret, rf);
    $("#tfBldR").innerHTML = table(["", "Rend. annuo (CAGR)", "Volatilità", "Sharpe", "Calo massimo", "10.000 diventano"], [[`<b>Il tuo mix</b>`, pc(P.cagr, 2), pct(P.vol), num(P.sharpe), pc(P.md), num(10000 * (1 + P.tot), 0)], ["Solo core", pc(S0.cagr, 2), pct(S0.vol), num(S0.sharpe), pc(S0.md), num(10000 * (1 + S0.tot), 0)],
      ["Differenza", pc(P.cagr - S0.cagr, 2), pc(P.vol - S0.vol, 1), num(P.sharpe - S0.sharpe), pc(P.md - S0.md), num(10000 * (P.tot - S0.tot), 0)]]);
    plot(D.eq, [{ x: xs, y: cum(rc).map(v => v * 100), name: "Solo core", line: { color: "#888" } }, { x: xs, y: P.eq.map(v => v * 10000), name: "Il tuo mix", line: { color: C.gold, width: 2.5 } }], { title: "10.000 investiti (scala log)", yaxis: { type: "log", gridcolor: C.grid } });
    window.__tf.cur = w; fe();
  };
  document.querySelectorAll("[data-tfw]").forEach(r => r.oninput = () => { W[r.dataset.tfw] = +r.value; $("#tfwv_" + r.dataset.tfw).textContent = r.value + "%"; bld(); });
  $("#tfRes").onclick = () => { sel.forEach(id => W[id] = 0); runTilt(); };
  // --- 5. frontiera
  const RR = [rc, ...sel.map(id => R[id])], mu = RR.map(r => mean(r) * 12), rfa = mean(rf) * 12, cov = RR.map(a => RR.map(b => { const ma = mean(a), mb = mean(b); return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (T - 1) * 12; }));
  const ev = w => { const m = w.reduce((s, x, i) => s + x * mu[i], 0); let v = 0; w.forEach((a, i) => w.forEach((b, j) => v += a * b * cov[i][j])); const sd = Math.sqrt(v); return { w, m, sd, sh: (m - rfa) / sd }; };
  let FE = null;
  const fe = () => {
    const cap = +$("#tfCap").value, cmin = +$("#tfCoreMin").value, k = RR.length; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (!FE || FE.key !== [cap, cmin, k, T, core, ccy, sel.join()].join()) {
      const P = []; for (let it = 0; it < 6000; it++) { let w = RR.map(() => -Math.log(rnd())); const s = w.reduce((a, b) => a + b, 0); w = w.map(x => x / s); for (let r = 0; r < 20; r++) { w = w.map((x, i) => i ? Math.min(x, cap) : Math.max(x, cmin)); const t = w.reduce((a, b) => a + b, 0); w = w.map(x => x / t); } if (w[0] >= cmin - 1e-6 && w.slice(1).every(x => x <= cap + 1e-6)) P.push(ev(w)); }
      const ok = w => w[0] >= cmin - 1e-9 && w.slice(1).every(x => x <= cap + 1e-9) && w.every(x => x >= -1e-12);
      const refine = (p, f) => { let b = p; for (let it = 0; it < 4000; it++) { const w = b.w.map(x => Math.max(0, x + (rnd() - .5) * 0.03)); const s = w.reduce((a, c) => a + c, 0); const w2 = w.map(x => x / s); if (!ok(w2)) continue; const c = ev(w2); if (f(c) > f(b)) b = c; } return b; };
      const ms = refine(P.reduce((a, b) => a.sh > b.sh ? a : b), p => p.sh), mv = refine(P.reduce((a, b) => a.sd < b.sd ? a : b), p => -p.sd);
      FE = { key: [cap, cmin, k, T, core, ccy, sel.join()].join(), P, ms, mv };
    }
    const cur = ev(window.__tf.cur || [1, ...sel.map(() => 0)]), c0 = ev([1, ...sel.map(() => 0)]), lab = ["Core", ...sel.map(id => tfName(id).split(" (")[0])];
    plot(D.fe, [{ x: FE.P.map(p => p.sd), y: FE.P.map(p => p.m), mode: "markers", type: "scattergl", name: "Portafogli possibili", marker: { size: 3, color: FE.P.map(p => p.sh), colorscale: [[0, "#333"], [1, "#c9a54c"]], opacity: .6 }, hoverinfo: "skip" },
      { x: [c0.sd], y: [c0.m], mode: "markers+text", text: ["Solo core"], textposition: "bottom right", marker: { size: 12, color: "#ccc" }, name: "Solo core" },
      { x: [cur.sd], y: [cur.m], mode: "markers+text", text: ["Il tuo mix"], textposition: "top left", marker: { size: 14, color: C.gold, symbol: "star" }, name: "Il tuo mix" },
      { x: [FE.ms.sd], y: [FE.ms.m], mode: "markers+text", text: ["Max Sharpe"], textposition: "top right", marker: { size: 12, color: C.green, symbol: "diamond" }, name: "Max Sharpe" },
      { x: [FE.mv.sd], y: [FE.mv.m], mode: "markers+text", text: ["Min varianza"], textposition: "bottom left", marker: { size: 12, color: C.blue, symbol: "diamond" }, name: "Min varianza" }],
      { title: "Rendimento medio annuo vs volatilità", xaxis: { title: "Volatilità annua", tickformat: ".0%", gridcolor: C.grid }, yaxis: { title: "Rendimento medio annuo", tickformat: ".1%", gridcolor: C.grid }, hovermode: "closest" });
    const wr = p => p.w.map(x => x > 0.005 ? pct(x, 0) : "–");
    $("#tfFeT").innerHTML = table(["Portafoglio", ...lab, "Rend. medio", "Volatilità", "Sharpe"], [["Solo core", ...wr(c0), pct(c0.m), pct(c0.sd), num(c0.sh)], ["<b>Il tuo mix</b>", ...wr(cur), pct(cur.m), pct(cur.sd), num(cur.sh)], ["Max Sharpe", ...wr(FE.ms), pct(FE.ms.m), pct(FE.ms.sd), num(FE.ms.sh)], ["Min varianza", ...wr(FE.mv), pct(FE.mv.m), pct(FE.mv.sd), num(FE.mv.sh)]]).replace("<table", '<table class="full"') + `<p class="note">Solo posizioni lunghe; vincoli: core ≥ ${pct(cmin, 0)}, ogni satellite ≤ ${pct(cap, 0)}. ${FE.P.length} portafogli casuali + affinamento locale. Rendimento medio aritmetico annualizzato.</p>`;
    // --- 6. conclusioni
    const single = sel.map(id => { const sim = simulate([rc, R[id]], [0.8, 0.2], "annual", M.months), P = pstats(sim.ret, rf); return { id, P }; }).sort((a, b) => b.P.sharpe - a.P.sharpe), b1 = single[0], wMS = FE.ms.w.map((x, i) => [lab[i], x]).filter(x => x[1] > 0.02 && x[0] !== "Core");
    const simMS = pstats(simulate(RR, FE.ms.w, "annual", M.months).ret, rf), simMV = pstats(simulate(RR, FE.mv.w, "annual", M.months).ret, rf);
    $("#tfConc").innerHTML = `<div class="answer">Dal ${fmtM(M.months[0])} al ${fmtM(M.months[T - 1])}, il miglior mix con questi vincoli (${wMS.map(x => `${x[0]} ${pct(x[1], 0)}`).join(", ") || "solo core"}, core ${pct(FE.ms.w[0], 0)}) avrebbe reso ${pc(simMS.cagr, 2)} l'anno con volatilità ${pct(simMS.vol)} e Sharpe ${num(simMS.sharpe)}, contro ${pc(S0.cagr, 2)}, ${pct(S0.vol)} e ${num(S0.sharpe)} del solo core: ${simMS.sharpe - S0.sharpe > 0.05 ? `un miglioramento di ${num(simMS.sharpe - S0.sharpe)} di Sharpe` : "un miglioramento minimo"}.</div>
     <ul class="lead"><li>Il satellite singolo più utile (20% al posto del core): <b>${tfName(b1.id)}</b>, Sharpe da ${num(S0.sharpe)} a ${num(b1.P.sharpe)}, rendimento ${pc(b1.P.cagr - S0.cagr, 2)}/anno, calo massimo da ${pct(S0.md)} a ${pct(b1.P.md)}.</li>
     <li>Il portafoglio a minima varianza riduce la volatilità da ${pct(S0.vol)} a ${pct(simMV.vol)} e il calo massimo da ${pct(S0.md)} a ${pct(simMV.md)}, con rendimento ${pc(simMV.cagr - S0.cagr, 2)}/anno rispetto al core.</li>
     <li>Correlazioni con il core tra ${num(Math.min(...sel.map(id => corr(R[id], rc))))} e ${num(Math.max(...sel.map(id => corr(R[id], rc))))}: i fattori sono comunque azioni, la diversificazione è parziale.</li>
     <li>Nessun fattore batte sempre il core: nelle finestre di 5 anni, la quota di periodi vincenti va da ${pct(Math.min(...sel.map(id => SS[id].r5.filter(x => x > 0).length / (SS[id].r5.length || 1))), 0)} a ${pct(Math.max(...sel.map(id => SS[id].r5.filter(x => x > 0).length / (SS[id].r5.length || 1))), 0)}. Servono pazienza e pesi moderati (tipicamente 10–30% del comparto azionario).</li></ul>
     <p class="note">Dati storici, nessun costo: gli ETF fattoriali costano di solito 0,20–0,30% l'anno in più di un ETF MSCI World. Risultati diversi cambiando periodo: provate più anni di partenza.</p>`;
    window.__tfConc = { ms: FE.ms, simMS, S0, b1: [b1.id, b1.P.sharpe, b1.P.cagr], simMV };
  };
  bld();
}
{ const _s = showTab; showTab = id => { _s(id); if (id === "tilt") try { renderTilt(); } catch (e) { console.error(e); } }; }
