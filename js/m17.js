"use strict";
/* ===== v3: Pianificazione finanziaria (profilo di rischio, obiettivi, decumulo) ===== */
const EQ = { WORLDI: "Azioni globali – MSCI World Net TR (dal 2001)", US: "Azioni USA – S&P 500 Total Return (dal 1988)", SPP: "Azioni USA – S&P 500 solo prezzo (dal 1928, prudenziale: senza dividendi)" };
const BD = { BTP: "BTP 10 anni (ricostruito, EUR, dal 1991)", IBGX: "Governativi euro 3-5 anni (iShares IBGX, cedole reinvestite, dal 2008)", UST: "Treasury USA 10 anni (ricostruito, dal 1962)", XEON: "Liquidità EUR (XEON, dal 2008)", CASH: "T-Bill USA 3 mesi (dal 1934)" };
const optsOf = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
function modelForm(p, eq = "WORLDI", bd = "BTP", w = 60, ccy = "EUR") { return `<label>Azioni <select id="${p}Eq">${optsOf(EQ, eq)}</select></label><label>Obbligazioni <select id="${p}Bd">${optsOf(BD, bd)}</select></label><label>% azioni <input id="${p}W" type="number" min="0" max="100" step="5" value="${w}" style="width:70px"></label><label>Valuta <select id="${p}Ccy"><option value="EUR" ${ccy === "EUR" ? "selected" : ""}>EUR</option><option value="USD" ${ccy === "USD" ? "selected" : ""}>USD</option></select></label>`; }
function modelRets(p, real, wOver) {
  const eq = $("#" + p + "Eq").value, bd = $("#" + p + "Bd").value, w = wOver != null ? wOver : Math.max(0, Math.min(100, +$("#" + p + "W").value || 0)) / 100, ccy = $("#" + p + "Ccy").value;
  const ids = w === 1 ? [eq] : w === 0 ? [bd] : [eq, bd]; const M = monthlyRets(ids, ccy, "1900-01-01", "2999-12-31");
  let r = M.months.map((_, t) => ids.length === 1 ? M.R[0][t] : w * M.R[0][t] + (1 - w) * M.R[1][t]); let months = M.months, start = M.start;
  if (real) { const CP = cpiMap(ccy), r2 = [], m2 = []; let prev = start; months.forEach((m, t) => { if (CP.has(m) && CP.has(prev)) { r2.push((1 + r[t]) / (CP.get(m) / CP.get(prev)) - 1); if (!m2.length) start = prev; m2.push(m); } prev = m; }); r = r2; months = m2; }
  return { r, months, start, ccy, w, label: `${Math.round(w * 100)}% ${EQ[eq].split(" (")[0]} / ${Math.round(100 - w * 100)}% ${BD[bd].split(" (")[0]} (${ccy}${real ? ", reale" : ""})` };
}
function histStats(r, months) { const P = pstats(r, []); let w12 = Infinity, w12k = ""; for (let i = 12; i <= r.length; i++) { let g = 1; for (let k = i - 12; k < i; k++) g *= 1 + r[k]; if (g - 1 < w12) { w12 = g - 1; w12k = months[i - 1]; } } return Object.assign(P, { w12, w12k }); }
const ddPct = eq => { let p = 0; return eq.map(v => { p = Math.max(p, v); return (v / p - 1) * 100; }); };

/* ---------- Profilo di rischio ---------- */
const QUEST = [["Orizzonte temporale dell'investimento", ["Meno di 3 anni", "3–5 anni", "5–10 anni", "Oltre 10 anni"]],
  ["Se il portafoglio perdesse il 20% in pochi mesi, cosa faresti?", ["Venderei tutto", "Venderei una parte", "Non farei nulla", "Investirei di più"]],
  ["Esperienza con investimenti azionari", ["Nessuna", "Limitata (conti deposito, obbligazioni)", "Buona (fondi, ETF)", "Ampia (azioni, più cicli di mercato)"]],
  ["Obiettivo principale", ["Preservare il capitale", "Reddito stabile", "Crescita moderata", "Massima crescita nel lungo periodo"]],
  ["Quota del patrimonio liquido investita qui", ["Oltre il 75%", "50–75%", "25–50%", "Meno del 25%"]],
  ["Stabilità del reddito e fondo di emergenza", ["Reddito incerto, nessuna riserva", "Reddito stabile, riserva minima", "Reddito stabile, riserva di 6 mesi", "Reddito molto stabile, ampia riserva"]]];
const MODELS = [["Prudente", 20], ["Moderato", 40], ["Bilanciato", 60], ["Dinamico", 80], ["Aggressivo", 100]];
function renderProfilo() {
  const o = $("#profOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const ch = [div("chart tall"), div()]; o._ch = ch.map(c => c[1]);
    pageShell(o, "prof", "Profilo di rischio e portafoglio modello", "Profilo di rischio e portafoglio modello", "Profilo_di_rischio", `
    <p class="lead muted">Questionario indicativo (non sostituisce la profilatura MiFID ufficiale). Il punteggio suggerisce un portafoglio modello e mostra cosa è successo storicamente nei momenti peggiori.</p>
    <div class="quest nopdf">${QUEST.map(([q, a], i) => `<div class="q"><b>${i + 1}. ${q}</b><div>${a.map((x, j) => `<label><input type="radio" name="q${i}" value="${j}" ${j === 2 ? "checked" : ""}> ${x}</label>`).join("")}</div></div>`).join("")}</div>
    <div class="form nopdf">${modelForm("pr")}<button id="prGo" class="primary">Calcola</button></div>
    <div id="prOut"></div>${ch[0][0]}${ch[1][0]}<div id="prTab"></div>`);
    $("#prGo").onclick = renderProfilo; o.querySelectorAll("input[type=radio]").forEach(x => x.onchange = () => { o._auto = 1; renderProfilo(); }); ["#prEq", "#prBd", "#prCcy"].forEach(s => $(s).onchange = renderProfilo); o._auto = 1; }
  const ans = QUEST.map((_, i) => +(document.querySelector(`input[name=q${i}]:checked`) || { value: 2 }).value), score = ans.reduce((a, b) => a + b, 0);
  let mi = score <= 4 ? 0 : score <= 8 ? 1 : score <= 12 ? 2 : score <= 15 ? 3 : 4; if (ans[0] === 0) mi = 0; else if (ans[0] === 1) mi = Math.min(mi, 1); if (ans[1] === 0) mi = Math.min(mi, 1);
  if (o._auto) { $("#prW").value = MODELS[mi][1]; o._auto = 0; }
  const rows = MODELS.map(([n, w]) => { const R = modelRets("pr", false, w / 100); return { n, w, R, H: histStats(R.r, R.months) }; });
  const R = modelRets("pr"), H = histStats(R.r, R.months), xs = [R.start, ...R.months];
  $("#prOut").innerHTML = `<div class="kpis">${kp2("Punteggio", score + " / 18")}${kp2("Profilo suggerito", MODELS[mi][0])}${kp2("Azioni nel modello", MODELS[mi][1] + "%")}${kp2("Peggior calo storico", pct(H.md))}</div>
  <div class="answer">Profilo <b>${MODELS[mi][0]}</b>: portafoglio modello indicativo ${MODELS[mi][1]}% azioni / ${100 - MODELS[mi][1]}% obbligazioni. Portafoglio analizzato: <b>${R.label}</b>, ${R.start} → ${R.months[R.months.length - 1]}. Rendimento annuo ${pct(H.cagr, 1)}, volatilità ${pct(H.vol, 1)}. <b>Momento peggiore</b>: calo massimo del ${pct(-H.md, 1)}; peggiori 12 mesi ${pct(H.w12)} (fino a ${H.w12k}); recupero più lungo ${H.rec} mesi. Domanda chiave: sarei rimasto investito vedendo questo calo?${(ans[0] <= 1 && +$("#prW").value > 40) ? " <span class='warn'>Orizzonte breve: considerare un profilo più prudente.</span>" : ""}</div>`;
  plot(o._ch[0], [{ x: xs, y: H.eq.map(v => v * 100), name: "Crescita di 100", type: "scatter", line: { color: C.gold, width: 2 } }, { x: xs, y: ddPct(H.eq), name: "Calo dai massimi (%)", yaxis: "y2", type: "scatter", fill: "tozeroy", line: { color: C.red, width: 1 } }], { title: T(R.label), yaxis: { domain: [.38, 1], type: "log", gridcolor: C.grid }, yaxis2: { domain: [0, .3], ticksuffix: "%", gridcolor: C.grid } });
  const xl = rows.map(r => `${r.n} (${r.w}%)`);
  plot(o._ch[1], [{ x: xl, y: rows.map(r => r.H.md * 100), name: "Peggior calo", type: "bar", marker: { color: rows.map((r, i) => i === mi ? C.gold : C.red) }, text: rows.map(r => pct(r.H.md, 0)), textposition: "outside" }, { x: xl, y: rows.map(r => r.H.cagr * 100), name: "Rendimento annuo", type: "bar", marker: { color: C.blue }, text: rows.map(r => pct(r.H.cagr, 1)), textposition: "outside" }], { title: T("Portafogli modello: rendimento annuo vs peggior calo"), barmode: "group", xaxis: { type: "category" }, yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
  $("#prTab").innerHTML = table(["Modello", "% azioni", "Rend. annuo", "Volatilità", "Peggior calo", "Peggiori 12 mesi", "Recupero più lungo"], rows.map((r, i) => [i === mi ? `<b>${r.n} ◀</b>` : r.n, r.w + "%", pc(r.H.cagr, 1), pct(r.H.vol, 1), pc(r.H.md), pc(r.H.w12), r.H.rec + " mesi"])) + `<p class="note">Storia comune degli asset scelti (${R.start} → ${R.months[R.months.length - 1]}), ribilanciamento mensile, senza costi. Le obbligazioni a lunga scadenza (es. BTP 10 anni) hanno avuto cali rilevanti nel 2011–2012 e nel 2022: per questo un profilo con più obbligazioni non ha sempre avuto un calo minore. Il punteggio è una guida educativa: la scelta finale richiede la valutazione di adeguatezza.</p>`;
}

/* ---------- Obiettivi di vita ---------- */
function renderObiettivi() {
  const o = $("#objOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const ch = [div(), div()]; o._ch = ch.map(c => c[1]);
    pageShell(o, "obj", "Obiettivi di vita: quanto investire al mese", "Obiettivo di investimento", "Obiettivo_PAC", `
    <div class="form"><label>Obiettivo (importo) <input id="obT" type="number" value="100000"></label><label>Anni <input id="obY" type="number" value="15" min="1" max="40" style="width:70px"></label><label>Capitale iniziale <input id="obI" type="number" value="10000"></label><label>La tua rata mensile <input id="obR" type="number" value="300"></label>
    ${modelForm("ob", "US", "UST", 60, "USD")}<label class="chk"><input type="checkbox" id="obReal" checked> Obiettivo in potere d'acquisto di oggi</label><button id="obGo" class="primary">Calcola</button></div>
    <div id="obOut"></div>${ch[0][0]}${ch[1][0]}<p class="note">Per ogni mese di partenza storico si simula un PAC di N anni sul portafoglio scelto (versamento a inizio mese, ribilanciamento mensile, senza costi né tasse) e si calcola la rata che avrebbe raggiunto esattamente l'obiettivo. La «probabilità di successo» è la quota di periodi storici in cui la rata sarebbe bastata: una frequenza storica, non una garanzia. I periodi si sovrappongono.</p>`);
    $("#obGo").onclick = renderObiettivi; ["#obEq", "#obBd", "#obCcy", "#obReal"].forEach(s => $(s).onchange = renderObiettivi); }
  const T0 = +$("#obT").value, N = Math.round(+$("#obY").value * 12), I0 = +$("#obI").value || 0, rata = +$("#obR").value || 0, R = modelRets("ob", $("#obReal").checked);
  if (R.r.length < N + 12) { $("#obOut").innerHTML = `<p class="warn">Storia insufficiente per ${N / 12} anni con questi asset (disponibili ${num(R.r.length / 12, 1)} anni). Scegli asset con storia più lunga (S&P 500, Treasury) o un orizzonte più breve.</p>`; return; }
  const req = [], st0 = [];
  for (let s = 0; s + N <= R.r.length; s++) { let gI = 1, gA = 0; for (let k = s; k < s + N; k++) { gA = (gA + 1) * (1 + R.r[k]); gI *= 1 + R.r[k]; } req.push(Math.max(0, (T0 - I0 * gI) / gA)); st0.push(R.months[s]); }
  const srt = [...req].sort((a, b) => a - b), q = p => srt[Math.min(srt.length - 1, Math.max(0, Math.ceil(p * srt.length) - 1))], succ = req.filter(x => x <= rata).length / req.length, simple = Math.max(0, (T0 - I0) / N);
  $("#obOut").innerHTML = `<div class="kpis">${kp2("Rata: 50% dei casi", num(q(.5), 0))}${kp2("Rata: 90% dei casi", num(q(.9), 0))}${kp2("Rata: tutti i casi storici", num(q(1), 0))}${kp2(`Successo con ${num(rata, 0)}/mese`, pct(succ, 0))}</div>
  <div class="answer">Per raggiungere <b>${num(T0, 0)} ${R.ccy}</b>${$("#obReal").checked ? " (in potere d'acquisto di oggi)" : ""} in ${N / 12} anni partendo da ${num(I0, 0)}, con ${R.label}: nella metà dei ${req.length} periodi storici sarebbe bastata una rata di <b>${num(q(.5), 0)}</b>/mese; per riuscirci nel 90% dei casi <b>${num(q(.9), 0)}</b>; nel caso peggiore (partenza ${st0[req.indexOf(srt[srt.length - 1])]}) ${num(q(1), 0)}. Senza rendimento servirebbero ${num(simple, 0)}/mese. Con la tua rata di ${num(rata, 0)} l'obiettivo sarebbe stato raggiunto nel <b>${pct(succ, 0)}</b> dei periodi.</div>`;
  plot(o._ch[0], [{ x: st0, y: req, type: "scatter", name: "Rata necessaria", line: { color: C.gold } }, { x: [st0[0], st0[st0.length - 1]], y: [rata, rata], type: "scatter", name: "La tua rata", line: { color: C.red, dash: "dash" } }, { x: [st0[0], st0[st0.length - 1]], y: [simple, simple], type: "scatter", name: "Rata senza rendimento", line: { color: "#888", dash: "dot" } }], { title: T("Rata mensile necessaria per mese di partenza"), yaxis: { gridcolor: C.grid } });
  const rs = [.5, .6, .7, .8, .9, .95, 1]; plot(o._ch[1], [{ x: rs.map(p => pct(p, 0)), y: rs.map(q), type: "bar", marker: { color: C.gold }, text: rs.map(p => num(q(p), 0)), textposition: "outside" }], { title: T("Rata mensile per probabilità storica di successo"), xaxis: { type: "category", title: "Probabilità di successo" }, yaxis: { gridcolor: C.grid }, hovermode: "closest" });
}

/* ---------- Decumulo ---------- */
function renderDecumulo() {
  const o = $("#decOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const ch = [div(), div()]; o._ch = ch.map(c => c[1]);
    pageShell(o, "dec", "Decumulo: quanto posso prelevare ogni anno?", "Decumulo e prelievo sostenibile", "Decumulo", `
    <div class="form"><label>Capitale <input id="dcK" type="number" value="500000"></label><label>Prelievo annuo (reale) <input id="dcWd" type="number" value="20000"></label><label>Anni <input id="dcY" type="number" value="20" min="5" max="40" style="width:70px"></label>
    ${modelForm("dc", "WORLDI", "BTP", 50, "EUR")}<button id="dcGo" class="primary">Calcola</button></div>
    <div id="dcOut"></div>${ch[0][0]}${ch[1][0]}<div id="dcTab"></div>
    <p class="note">Prelievo mensile costante in termini reali (adeguato all'inflazione: CPI Italia in EUR, CPI USA in USD), rendimenti reali mensili, ribilanciamento mensile, senza costi né tasse. Successo = capitale mai esaurito entro l'orizzonte, per ogni mese di partenza storico. In EUR la storia comune parte dal 2001 (MSCI World): per orizzonti lunghi usare USD con S&P 500 dal 1928 (solo prezzo = stima prudenziale, esclude i dividendi) e Treasury dal 1962. La «regola del 4%» nasce da studi su dati USA (Bengen, 1994).</p>`);
    $("#dcGo").onclick = renderDecumulo; ["#dcEq", "#dcBd", "#dcCcy"].forEach(s => $(s).onchange = renderDecumulo); }
  const K = +$("#dcK").value, Wd = +$("#dcWd").value, N = Math.round(+$("#dcY").value * 12), R = modelRets("dc", true);
  if (R.r.length < N + 12) { $("#dcOut").innerHTML = `<p class="warn">Storia insufficiente per ${N / 12} anni (disponibili ${num(R.r.length / 12, 1)} anni di dati reali con questi asset/valuta). Riduci l'orizzonte o scegli USD con S&P 500 dal 1928 e Treasury.</p>`; $("#dcTab").innerHTML = ""; [0, 1].forEach(i => Plotly.purge(o._ch[i])); return; }
  const run = (rate, keep) => { let ok = 0, n = 0; const ends = [], paths = []; for (let s = 0; s + N <= R.r.length; s++) { let v = 1, dead = false; const p = keep ? [1] : null; for (let k = s; k < s + N; k++) { v = (v - rate / 12) * (1 + R.r[k]); if (v <= 0) { v = 0; dead = true; } if (p) p.push(v); } n++; if (!dead) ok++; ends.push(v); if (p) paths.push({ s: R.months[s], p }); } return { p: ok / n, n, ends, paths }; };
  const bis = target => { let lo = 0, hi = .2; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; run(m).p >= target ? lo = m : hi = m; } return lo; };
  const wr = Wd / K, me = run(wr, true), rates = [0.03, 0.035, 0.04, 0.045, 0.05, 0.06], safe100 = bis(1), safe90 = bis(.9), r4 = run(0.04);
  $("#dcOut").innerHTML = `<div class="kpis">${kp2("Tasso di prelievo", pct(wr, 2))}${kp2("Successo storico", pct(me.p, 0))}${kp2("Prelievo sostenibile (100% casi)", pct(safe100, 2) + " · " + num(safe100 * K, 0))}${kp2("Prelievo al 90% dei casi", pct(safe90, 2))}</div>
  <div class="answer">Prelevando <b>${num(Wd, 0)} l'anno</b> in potere d'acquisto costante da ${num(K, 0)} (${pct(wr, 2)}), con ${R.label} per ${N / 12} anni, il capitale sarebbe durato nel <b>${pct(me.p, 0)}</b> dei ${me.n} periodi storici (${R.start} → ${R.months[R.months.length - 1]}). Il prelievo massimo che avrebbe resistito in tutti i periodi è stato ${pct(safe100, 2)} (${num(safe100 * K, 0)} l'anno). <b>Verifica regola del 4%</b>: successo nel ${pct(r4.p, 0)} dei casi con questo portafoglio e orizzonte. Capitale reale residuo mediano: ${num(median(me.ends) * K, 0)}.${me.n < 120 ? ` <span class="warn">Attenzione: solo ${me.n} partenze mensili, molto sovrapposte (circa ${num(me.n / 12 + N / 12, 0)} anni di storia): risultato poco robusto.</span>` : ""}</div>`;
  const pick = me.paths.filter((_, i) => i % Math.max(1, Math.floor(me.paths.length / 40)) === 0);
  plot(o._ch[0], pick.map(pp => ({ x: pp.p.map((_, i) => i / 12), y: pp.p.map(v => v * K), type: "scatter", mode: "lines", name: pp.s, line: { width: 1, color: pp.p[pp.p.length - 1] <= 0 ? C.red : "rgba(201,165,76,.6)" }, showlegend: false })), { title: T("Capitale reale residuo per data di partenza (rosso = esaurito)"), xaxis: { title: "Anni dall'inizio" }, yaxis: { gridcolor: C.grid }, hovermode: "closest" });
  const rr = rates.map(r => run(r));
  plot(o._ch[1], [{ x: rates.map(r => pct(r, 1)), y: rr.map(x => x.p * 100), type: "bar", marker: { color: rates.map(r => r === 0.04 ? C.gold : C.blue) }, text: rr.map(x => pct(x.p, 0)), textposition: "outside" }], { title: T(`Successo storico per tasso di prelievo (${N / 12} anni)`), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", range: [0, 115], gridcolor: C.grid }, hovermode: "closest" });
  $("#dcTab").innerHTML = table(["Tasso di prelievo", "Prelievo annuo", "Successo storico", "Capitale residuo mediano (reale)"], rates.map((r, i) => [pct(r, 1), num(r * K, 0), pct(rr[i].p, 0), num(median(rr[i].ends) * K, 0)]));
}
