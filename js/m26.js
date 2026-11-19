"use strict";
/* ===== v7: Backtest a segnali (filtri combinabili) vs buy & hold – sostituisce «Strategie vs Buy & Hold» ===== */
const SG = window.SIGNALS || {};
const sgMap = s => s ? new Map(s.d.map((d, i) => [d.slice(0, 7), s.v[i]])) : new Map();
const SGDEF = [
  { k: "ma", n: "Trend: prezzo sopra la media mobile", on: true, op: ">", th: 0, unit: "%", txt: "distanza del prezzo dalla media mobile",
    help: "Se il prezzo è sopra la sua media degli ultimi mesi il trend è positivo; sotto, il mercato è in fase debole.", opt: `<select data-sgp="ma"><option value="200">media 200 giorni</option><option value="10">media 10 mesi</option></select>` },
  { k: "vix", n: "Paura: indice VIX", on: false, op: "<", th: 30, unit: "", txt: "VIX", help: "Il VIX misura la paura degli investitori. Sopra 30 c'è molta paura (crisi); sotto 20 il mercato è tranquillo. Dati dal 1990." },
  { k: "rsi", n: "RSI 14: ipercomprato / ipervenduto", on: false, op: "<", th: 70, unit: "", txt: "RSI", help: "L'RSI va da 0 a 100: sopra 70 il mercato è salito molto e in fretta («ipercomprato»), sotto 30 è sceso molto («ipervenduto»).", opt: `<select data-sgp="rsi"><option value="M">mensile</option><option value="D">giornaliero</option></select>` },
  { k: "val", n: "Valutazione: P/E o CAPE rispetto alla media storica", on: false, op: "<", th: 20, unit: "%", txt: "scostamento dalla media storica",
    help: "Il P/E dice quanti anni di utili si pagano per comprare l'indice; il CAPE (Shiller) usa la media degli utili degli ultimi 10 anni, corretti per l'inflazione. Valori sopra la media = mercato caro.",
    opt: `<select data-sgp="val"><option value="CAPE">CAPE (Shiller)</option><option value="PE">P/E (utili 12 mesi)</option></select><select data-sgp="valm"><option value="rel">rispetto alla media (in %)</option><option value="abs">valore assoluto</option></select>` },
  { k: "yc", n: "Curva dei tassi USA (10 anni − 2 anni)", on: false, op: ">", th: 0, unit: " p.p.", txt: "differenza 10a − 2a", help: "Normalmente i tassi a 10 anni sono più alti di quelli a 2 anni. Quando la curva si «inverte» (sotto zero) spesso è arrivata una recessione, ma con ritardi molto variabili. Dati dal 1976." },
  { k: "cr", n: "Rischio di credito: spread delle obbligazioni aziendali", on: false, op: "<", th: 3, unit: " p.p.", txt: "spread Baa − Treasury 10a",
    help: "Quanto rendono in più le obbligazioni delle aziende rispetto ai titoli di Stato. Quando sale molto, il mercato teme fallimenti. Storia: Moody's Baa (dal 1986); lo spread high yield ICE è disponibile gratis solo per gli ultimi 3 anni." }];
window.__sg = window.__sg || { on: Object.fromEntries(SGDEF.map(s => [s.k, s.on])), op: Object.fromEntries(SGDEF.map(s => [s.k, s.op])), th: Object.fromEntries(SGDEF.map(s => [s.k, s.th])), p: { ma: "200", rsi: "M", val: "CAPE", valm: "rel" } };
const LAG_VAL = 3; // mesi di ritardo per P/E e CAPE (pubblicazione utili)
function sgRSI(c, n = 14) { const out = new Array(c.length).fill(null); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
  if (i <= n) { g += up / n; l += dn / n; if (i === n) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } } return out; }
const sgMonths = (d, c) => { const m = [], px = [], di = []; d.forEach((x, i) => { const k = x.slice(0, 7); if (m.length && m[m.length - 1] === k) { px[px.length - 1] = c[i]; di[di.length - 1] = i; } else { m.push(k); px.push(c[i]); di.push(i); } }); return { m, px, di }; };
function sgBuild(id, ccy) {
  const S = idxSeries(id, IDX[id].TR ? "TR" : "P", ccy); if (!S) return null;
  const B = sgMonths(S.d, S.c), daily = S.freq !== "M"; // B.m include il mese in corso (ultimo, parziale)
  // serie di segnale sul prezzo nella valuta dell'indice USD (per non mescolare l'effetto cambio nei segnali di trend)
  const U = idxSeries(id, IDX[id].TR ? "TR" : "P", "USD") || S, UB = sgMonths(U.d, U.c), uIdx = new Map(UB.m.map((k, i) => [k, i]));
  const ma200 = []; if (U.freq !== "M") { let s = 0; U.c.forEach((v, i) => { s += v; if (i >= 200) s -= U.c[i - 200]; ma200.push(i >= 199 ? s / 200 : null); }); }
  const rsiD = U.freq !== "M" ? sgRSI(U.c) : null, rsiM = sgRSI(UB.px);
  const VX = FULL["^VIX"] ? sgMonths(FULL["^VIX"].d, FULL["^VIX"].c) : { m: [], px: [] }, vix = new Map(VX.m.map((k, i) => [k, VX.px[i]]));
  const CAPE = sgMap(SG.CAPE), PE = sgMap(SG.PE), YC = sgMap(SG.T10Y2Y), CR = sgMap(SG.BAA10Y);
  // medie storiche «espandenti» (solo dati disponibili fino a quel mese: nessun look-ahead)
  const expAvg = M => { const ks = [...M.keys()].sort(), o = new Map(); let s = 0; ks.forEach((k, i) => { s += M.get(k); o.set(k, s / (i + 1)); }); return o; };
  const avgC = expAvg(CAPE), avgP = expAvg(PE);
  const shift = (k, n) => { let [y, m] = k.split("-").map(Number); m -= n; while (m <= 0) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
  const P = window.__sg.p, V = {};
  V.ma = B.m.map(k => { const j = uIdx.get(k); if (j == null) return null; if (P.ma === "200") { const i = UB.di[j]; return ma200[i] ? (U.c[i] / ma200[i] - 1) * 100 : null; } if (j < 9) return null; const a = UB.px.slice(j - 9, j + 1).reduce((x, y) => x + y, 0) / 10; return (UB.px[j] / a - 1) * 100; });
  V.vix = B.m.map(k => vix.has(k) ? vix.get(k) : null);
  V.rsi = B.m.map(k => { const j = uIdx.get(k); if (j == null) return null; return P.rsi === "D" ? (rsiD ? rsiD[UB.di[j]] : null) : rsiM[j]; });
  const VM = P.val === "CAPE" ? CAPE : PE, VA = P.val === "CAPE" ? avgC : avgP;
  V.val = B.m.map(k => { const kk = shift(k, LAG_VAL); if (!VM.has(kk)) return null; return P.valm === "rel" ? (VM.get(kk) / VA.get(kk) - 1) * 100 : VM.get(kk); });
  V.yc = B.m.map(k => YC.has(k) ? YC.get(k) : null); V.cr = B.m.map(k => CR.has(k) ? CR.get(k) : null);
  return { S, B, V, daily, cur: B.m[B.m.length - 1] >= CUR_M };
}
const sgCond = (k, v) => v == null ? null : (window.__sg.op[k] === ">" ? v > window.__sg.th[k] : v < window.__sg.th[k]);
const sgStats = (r, n12) => { const eq = [1]; r.forEach(x => eq.push(eq[eq.length - 1] * (1 + x))); let pk = 1, md = 0; eq.forEach(v => { pk = Math.max(pk, v); md = Math.min(md, v / pk - 1); }); return { eq, cagr: eq[eq.length - 1] ** (12 / r.length) - 1, vol: std(r) * Math.sqrt(12), md, dd: eq.map((v, i) => { const p = Math.max(...eq.slice(0, i + 1)); return v / p - 1; }) }; };
function sgFwd(px, idxs, h) { const r = idxs.filter(i => i + h < px.length).map(i => h >= 60 ? (px[i + h] / px[i]) ** (12 / h) - 1 : px[i + h] / px[i] - 1); if (!r.length) return null; const s = r.slice().sort((a, b) => a - b); return { n: r.length, avg: mean(r), med: s[Math.floor(s.length / 2)], pos: r.filter(x => x > 0).length / r.length, worst: s[0] }; }
function renderSig() {
  const o = $("#sgOut"); if (!o) return; if (o.dataset.ok) return runSig(); o.dataset.ok = 1;
  const [e1, ei] = div("chart tall"), [d1, di] = div("chart"), [t1, ti] = div("chart"), [p1, pi] = div("chart tall"), [v1, vi] = div("chart tall");
  const yrs = l => `<option value="">${l}</option>` + Array.from({ length: 2026 - 1928 + 1 }, (_, i) => 2026 - i).map(y => `<option>${y}</option>`).join("");
  const G = window.__sg;
  o.innerHTML = `<div class="card sgcard"><h2>Backtest a segnali: una regola semplice batte il «compra e tieni»?</h2>
   <p class="lead">Scegli uno o più segnali (anche tutti insieme). Ogni fine mese la regola guarda i segnali: se dicono «investito» si resta sull'indice il mese successivo, altrimenti si passa in liquidità. Il confronto è con il <b>buy &amp; hold</b>: comprare e tenere sempre.</p>
   <div class="form"><label>Indice <select id="sgIdx">${idxOpts("SP")}</select></label><label>Valuta <select id="sgCcy"><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
    <label>Dall'anno <select id="sgY0">${yrs("Primo disponibile")}</select></label><label>All'anno <select id="sgY1">${yrs("Ultimo disponibile")}</select></label>
    <label>Capitale <input id="sgCap" type="number" value="10000" min="1"></label><label title="Costo applicato a ogni entrata o uscita (commissioni + spread).">Costo per operazione (%) <input id="sgCost" type="number" value="0.1" step="0.05" min="0"></label>
    <label title="Tutti: si investe solo se tutti i segnali attivi dicono sì. Maggioranza: basta più della metà.">Regola <select id="sgComb"><option value="all">tutti i segnali d'accordo</option><option value="maj">maggioranza dei segnali</option></select></label></div>
   <div class="sglist">${SGDEF.map(s => `<div class="sgrow${G.on[s.k] ? " on" : ""}" data-sgrow="${s.k}"><label class="sgchk"><input type="checkbox" data-sgon="${s.k}" ${G.on[s.k] ? "checked" : ""}> <b>${s.n}</b></label>
     <div class="sgctl">${s.opt || ""} Investito quando ${s.txt} è <select data-sgop="${s.k}"><option value="<" ${G.op[s.k] === "<" ? "selected" : ""}>sotto</option><option value=">" ${G.op[s.k] === ">" ? "selected" : ""}>sopra</option></select> <input type="number" step="any" data-sgth="${s.k}" value="${G.th[s.k]}" style="width:80px">${s.unit}</div>
     <div class="muted sghelp">${s.help}</div><div class="sgtoday" id="sgT_${s.k}"></div></div>`).join("")}</div>
   <p class="note">Regole anti «senno di poi»: i segnali si leggono all'ultima chiusura del mese e l'operazione avviene sul mese successivo. P/E e CAPE con ${LAG_VAL} mesi di ritardo (tempo di pubblicazione degli utili) e media storica calcolata solo con i dati disponibili fino a quel momento. In liquidità si incassa il tasso monetario (T-Bill USA 3 mesi in USD; tasso BCE sui depositi in EUR). Segnali di trend/RSI calcolati sull'indice in dollari. Nessuna tassa. Revisioni degli utili: nessuna fonte gratuita e affidabile con storia lunga, quindi non incluse.</p></div>
  <div id="sgHead"></div><div class="card">${e1}${d1}</div>
  <div class="card"><h3>Quando i segnali hanno detto «investito» o «fuori»</h3>${t1}</div>
  <div class="card"><h3>Quando i segnali coincidono</h3><p class="muted">Tutti i mesi in cui <b>tutte</b> le condizioni attive erano vere insieme, e cosa ha fatto l'indice dopo.</p><div id="sgCo"></div>${p1}</div>
  <div class="card"><h3>Ogni segnale da solo: cosa è successo dopo</h3><div id="sgEach"></div></div>
  <div class="card"><h3>P/E e CAPE rispetto alla media storica</h3><div class="form"><label>Misura <select id="sgVm"><option value="PE">P/E (utili 12 mesi)</option><option value="CAPE">CAPE (Shiller)</option></select></label><label>Media dal <select id="sgVf"><option value="1990" selected>1990 (mercato moderno)</option><option value="2000">2000</option><option value="1950">1950</option><option value="1871">tutta la storia (1871)</option></select></label><label>Media mobile di confronto <select id="sgVr"><option value="20">20 anni</option><option value="30">30 anni</option><option value="0">nessuna</option></select></label></div><div id="sgFwd"></div><div id="sgValT"></div>${v1}<div id="sgValQ"></div></div>`;
  o._ch = { ei, di, ti, pi, vi };
  const set = () => { document.querySelectorAll("[data-sgon]").forEach(x => { G.on[x.dataset.sgon] = x.checked; x.closest(".sgrow").classList.toggle("on", x.checked); }); document.querySelectorAll("[data-sgop]").forEach(x => G.op[x.dataset.sgop] = x.value); document.querySelectorAll("[data-sgth]").forEach(x => G.th[x.dataset.sgth] = +x.value); document.querySelectorAll("[data-sgp]").forEach(x => G.p[x.dataset.sgp] = x.value); runSig(); };
  document.querySelectorAll("[data-sgp]").forEach(x => x.value = G.p[x.dataset.sgp]);
  document.querySelectorAll("[data-sgon],[data-sgop],[data-sgth],[data-sgp]").forEach(x => x.onchange = set);
  // con «valore assoluto» propone soglie sensate
  o.querySelector('[data-sgp="valm"]').addEventListener("change", e => { const th = o.querySelector('[data-sgth="val"]'); th.value = e.target.value === "abs" ? (G.p.val === "CAPE" ? 25 : 20) : 20; G.th.val = +th.value; });
  ["#sgIdx", "#sgCcy", "#sgY0", "#sgY1", "#sgCap", "#sgCost", "#sgComb"].forEach(s => $(s).onchange = runSig); ["#sgVm", "#sgVr", "#sgVf"].forEach(s => $(s).onchange = runVal);
  runSig();
}
function runSig() {
  const o = $("#sgOut"), CH = o._ch, G = window.__sg, id = $("#sgIdx").value, ccy = $("#sgCcy").value;
  const D = sgBuild(id, ccy); if (!D) { $("#sgHead").innerHTML = `<p class="warn">Dati non disponibili.</p>`; return; }
  const { B, V, S } = D, cur = ccy === "EUR" ? "€" : "$", money = v => `${num(v, 0)} ${cur}`, en = SGDEF.filter(s => G.on[s.k]);
  // Oggi (ultimo valore disponibile) per ogni segnale
  SGDEF.forEach(s => { const a = V[s.k]; let j = a.length - 1; while (j >= 0 && a[j] == null) j--; const el = $("#sgT_" + s.k); if (!el) return;
    if (j < 0) { el.innerHTML = `<span class="muted">Nessun dato per questo indice.</span>`; return; } const c = sgCond(s.k, a[j]);
    el.innerHTML = `Oggi (${B.m[j]}${j === B.m.length - 1 && D.cur ? ", mese in corso" : ""}): <b>${num(a[j], s.k === "vix" || s.k === "rsi" ? 1 : 2)}${s.unit}</b> → <span class="${c ? "pos" : "neg"}"><b>${c ? "investito" : "fuori"}</b></span>${s.k === "cr" && SG.HY ? ` · spread high yield ICE: ${num(SG.HY.v[SG.HY.v.length - 1])} p.p.` : ""}`; });
  const full = B.m.length - (D.cur ? 1 : 0); // mesi completi
  const y0 = $("#sgY0").value, y1 = $("#sgY1").value;
  const avail = t => en.every(s => V[s.k][t] != null);
  let t0 = 0; while (t0 < full && !avail(t0)) t0++;
  const want0 = y0 ? lb(B.m, `${+y0 - 1}-12`) : 0; const s0 = Math.max(t0, want0), want1 = y1 ? lb(B.m, `${y1}-12~`) - 1 : full - 1, s1 = Math.min(full - 1, want1);
  if (!en.length) { $("#sgHead").innerHTML = `<div class="card"><p class="warn">Attiva almeno un segnale.</p></div>`; return; }
  if (s1 - s0 < 24) { $("#sgHead").innerHTML = `<div class="card"><p class="warn">Periodo troppo breve con i segnali scelti (servono almeno 24 mesi). Alcuni dati partono tardi: VIX dal 1990, curva dal 1976, spread dal 1986.</p></div>`; return; }
  const lim = en.map(s => { let j = 0; while (j < B.m.length && V[s.k][j] == null) j++; return [s, B.m[j]]; }).filter(([, m]) => m > B.m[want0]);
  const note = y0 && s0 > want0 ? `<p class="warn">⚠️ Hai chiesto dal ${y0}, ma il test parte da ${B.m[s0]}: ${lim.map(([s, m]) => `«${s.n}» ha dati dal ${m}`).join("; ") || `l'indice in ${ccy} parte da ${B.m[0]}`}.</p>` : `<p class="note">Periodo: ${B.m[s0]} → ${B.m[s1]} (${s1 - s0} mesi)${lim.length && !y0 ? `; limitato da ${lim.map(([s, m]) => `${s.n} (dal ${m})`).join(", ")}` : ""}.</p>`;
  const comb = t => { const c = en.map(s => sgCond(s.k, V[s.k][t])).filter(x => x != null); if (!c.length) return null; return $("#sgComb").value === "all" ? c.every(Boolean) : c.filter(Boolean).length > c.length / 2; };
  const cashR = cashMonthly(ccy, "r"), cost = (+$("#sgCost").value || 0) / 100, cap = +$("#sgCap").value || 10000;
  const rS = [], rB = [], pos = [], xs = [B.m[s0]]; let prev = null, trades = 0;
  for (let t = s0; t < s1; t++) { const p = comb(t), mret = B.px[t + 1] / B.px[t] - 1, cr = cashR.get(B.m[t + 1]) || 0; let r = p ? mret : cr; if (prev !== null && p !== prev) { r -= cost; trades++; } else if (prev === null && p) { r -= cost; trades++; } prev = p; pos.push(p ? 1 : 0); rS.push(r); rB.push(mret); xs.push(B.m[t + 1]); }
  const A = sgStats(rS), Bh = sgStats(rB), fS = cap * A.eq[A.eq.length - 1], fB = cap * Bh.eq[Bh.eq.length - 1], win = fS > fB, inT = mean(pos);
  const ddBetter = A.md > Bh.md + 0.02, comm = win ? (ddBetter ? "ha reso di più <b>e</b> con cali meno profondi: in questo periodo la regola ha funzionato. Verifica su altri periodi prima di fidarti." : "ha reso di più del buy &amp; hold, ma non ha ridotto il calo massimo.")
    : (ddBetter ? `ha <b>ridotto il calo massimo</b> (${pct(A.md, 0)} contro ${pct(Bh.md, 0)}) ma ha reso meno del buy &amp; hold: il prezzo della protezione è stato ${money(fB - fS)} in meno.` : "ha reso meno <b>e</b> non ha protetto dai cali: in questo periodo restare sempre investiti è stato meglio.");
  $("#sgHead").innerHTML = `<div class="card">${note}<div class="lumpwin ${win ? "wait" : "now"}"><div class="big">La strategia ${win ? "HA battuto" : "NON ha battuto"} il buy &amp; hold</div><div class="sub">${win ? "+" : "−"}${money(Math.abs(fS - fB))} (${money(fS)} contro ${money(fB)} partendo da ${money(cap)})</div></div>
   <div class="answer">Con ${en.length === 1 ? "il segnale scelto" : `${en.length} segnali (regola: ${$("#sgComb").value === "all" ? "tutti d'accordo" : "maggioranza"})`} la strategia ${comm} È stata investita il ${pct(inT, 0)} del tempo, con ${trades} operazioni.${trades > (s1 - s0) / 6 ? " Molte operazioni: nella realtà costi e tasse peserebbero di più." : ""}${s1 - s0 < 120 ? " Attenzione: meno di 10 anni di dati, risultato poco affidabile." : ""}</div>
   ${table(["", "Capitale finale", "Rend. annuo (CAGR)", "Volatilità", "Calo massimo", "Tempo investito", "Operazioni"], [["<b>Strategia</b>", money(fS), pc(A.cagr, 2), pct(A.vol), pc(A.md), pct(inT, 0), trades], ["Buy &amp; hold", money(fB), pc(Bh.cagr, 2), pct(Bh.vol), pc(Bh.md), "100%", 1]]).replace("<table", '<table class="full"')}
   <p class="note">${S.name}, ${ccy}. Fonte indice: ${S.src}. Costo ${pct(cost, 2)} a operazione.</p></div>`;
  window.__sgLast = { A, Bh, fS, fB, inT, trades, from: B.m[s0], to: B.m[s1], en: en.map(s => s.k) };
  const HL = { bgcolor: "#000", font: { size: 15 } };
  plot(CH.ei, [{ x: xs, y: Bh.eq.map(v => v * cap), name: "Buy & hold", type: "scatter", line: { color: "#aaa", width: 1.6 } }, { x: xs, y: A.eq.map(v => v * cap), name: "Strategia a segnali", type: "scatter", line: { color: C.gold, width: 2.4 } }], { title: T(`Valore di ${money(cap)} nel tempo`), yaxis: { type: "log", ticksuffix: " " + cur }, hoverlabel: HL });
  plot(CH.di, [{ x: xs, y: Bh.dd.map(v => v * 100), name: "Buy & hold", type: "scatter", line: { color: "#aaa", width: 1 }, fill: "tozeroy", fillcolor: "rgba(170,170,170,.12)" }, { x: xs, y: A.dd.map(v => v * 100), name: "Strategia", type: "scatter", line: { color: C.gold, width: 1.4 } }], { title: T("Cali dai massimi"), yaxis: { ticksuffix: "%" }, hoverlabel: HL });
  const rows = [...en.map(s => ({ n: s.n.split(":")[0], z: B.m.slice(s0, s1).map((_, i) => { const c = sgCond(s.k, V[s.k][s0 + i]); return c == null ? null : +c; }) })), { n: "<b>Strategia</b>", z: pos }];
  plot(CH.ti, [{ type: "heatmap", x: B.m.slice(s0 + 1, s1 + 1), y: rows.map(r => r.n), z: rows.map(r => r.z), zmin: 0, zmax: 1, colorscale: [[0, "#5a1f2a"], [1, "#c9a54c"]], showscale: false, hovertemplate: "%{y} %{x}: %{z}<extra>1 = investito</extra>" }], { margin: { l: 150, t: 20, b: 40 }, height: 80 + rows.length * 34, hoverlabel: HL });
  // coincidenze (tutte le condizioni attive vere)
  const coI = []; for (let t = t0; t < full; t++) if (en.every(s => sgCond(s.k, V[s.k][t]) === true)) coI.push(t);
  const allI = []; for (let t = t0; t < full; t++) allI.push(t);
  const H = [[1, "1 mese"], [3, "3 mesi"], [12, "12 mesi"], [60, "5 anni (annuo)"]];
  const F = H.map(([h]) => [sgFwd(B.px, coI, h), sgFwd(B.px, allI, h)]);
  const f12 = F[2], d12 = f12[0] && f12[1] ? f12[0].avg - f12[1].avg : null;
  $("#sgCo").innerHTML = `<div class="answer">${coI.length ? `Le condizioni attive sono state vere insieme in <b>${coI.length} mesi su ${allI.length}</b> (${pct(coI.length / allI.length, 0)}, dal ${B.m[t0]}). ${d12 == null ? "" : `Nei 12 mesi successivi l'indice ha reso in media ${pc(f12[0].avg)} contro ${pc(f12[1].avg)} di un mese qualsiasi: ${Math.abs(d12) < 0.01 ? "praticamente nessuna differenza." : d12 > 0 ? "<b>meglio della media</b>." : "<b>peggio della media</b>."}`}${coI.length < 30 ? " ⚠️ Pochi casi: il risultato può essere frutto del caso." : ""}` : "Le condizioni attive non sono mai state vere tutte insieme."}</div>
   ${coI.length ? table(["Dopo", "Rend. medio", "Mediana", "% positivi", "Peggiore", "Casi", "Tutti i mesi: media", "Tutti i mesi: % positivi"], H.map(([, n], i) => { const [a, b] = F[i]; return a ? [n, pc(a.avg), pc(a.med), pct(a.pos, 0), pc(a.worst), a.n, b ? pc(b.avg) : "–", b ? pct(b.pos, 0) : "–"] : [n, "–", "–", "–", "–", 0, b ? pc(b.avg) : "–", b ? pct(b.pos, 0) : "–"]; })).replace("<table", '<table class="full"') : ""}`;
  plot(CH.pi, [{ x: B.m.slice(t0, full), y: B.px.slice(t0, full), name: S.name.replace(/ \(.*\)/, ""), type: "scatter", line: { color: "#aaa", width: 1.2 } }, { x: coI.map(t => B.m[t]), y: coI.map(t => B.px[t]), name: "Condizioni tutte vere", mode: "markers", type: "scatter", marker: { color: C.gold, size: 7 } }], { title: T("Prezzo dell'indice e mesi in cui tutte le condizioni erano vere"), yaxis: { type: "log" }, hoverlabel: HL });
  // ogni segnale da solo
  $("#sgEach").innerHTML = en.map(s => { const tr = [], fa = []; for (let t = 0; t < full; t++) { const c = sgCond(s.k, V[s.k][t]); if (c === true) tr.push(t); else if (c === false) fa.push(t); }
    const a12 = sgFwd(B.px, tr, 12), b12 = sgFwd(B.px, fa, 12), a60 = sgFwd(B.px, tr, 60), b60 = sgFwd(B.px, fa, 60);
    const say = a60 && b60 ? `Quando il segnale diceva «investito», nei 5 anni successivi l'indice ha reso in media ${pc(a60.avg)} l'anno contro ${pc(b60.avg)} quando diceva «fuori»: ${a60.avg - b60.avg > 0.01 ? "il segnale è stato <b>utile</b> nel lungo periodo" : a60.avg - b60.avg < -0.01 ? "il segnale ha <b>sbagliato</b> nel lungo periodo" : "differenza <b>trascurabile</b> nel lungo periodo"}.` : a12 && b12 ? `A 12 mesi: ${pc(a12.avg)} con «investito» contro ${pc(b12.avg)} con «fuori».` : "Dati insufficienti.";
    const few = Math.min(tr.length, fa.length) < 36 ? " ⚠️ Uno dei due gruppi ha pochi mesi: prudenza." : "";
    return `<h4>${s.n}</h4><div class="answer">${say}${few}</div>${table(["Segnale", "Mesi", "12 mesi dopo: media", "12 mesi: % positivi", "5 anni dopo: media annua", "5 anni: peggiore"], [["«investito»", tr.length, a12 ? pc(a12.avg) : "–", a12 ? pct(a12.pos, 0) : "–", a60 ? pc(a60.avg) : "–", a60 ? pc(a60.worst) : "–"], ["«fuori»", fa.length, b12 ? pc(b12.avg) : "–", b12 ? pct(b12.pos, 0) : "–", b60 ? pc(b60.avg) : "–", b60 ? pc(b60.worst) : "–"]])}`; }).join("") || `<p class="muted">Attiva almeno un segnale.</p>`;
  runVal(D);
}
function runVal(D0) {
  const o = $("#sgOut"); if (!o || !o._ch) return; const D = D0 && D0.B ? D0 : sgBuild($("#sgIdx").value, $("#sgCcy").value); if (!D) return;
  const mk = $("#sgVm").value, RW = +$("#sgVr").value * 12, M = sgMap(mk === "CAPE" ? SG.CAPE : SG.PE), ks = [...M.keys()].filter(k => k < CUR_M || mk === "CAPE").sort(), v = ks.map(k => M.get(k)); const F0 = $("#sgVf") ? $("#sgVf").value : "1871", ksAll = ks.slice(), vAll = v.slice(); { const j0 = ks.findIndex(k => k >= F0); ks.splice(0, j0); v.splice(0, j0); }
  const lt = mean(v), exp = []; let s = 0; v.forEach((x, i) => { s += x; exp.push(s / (i + 1)); });
  const roll = RW ? v.map((_, i) => i >= RW - 1 ? mean(v.slice(i - RW + 1, i + 1)) : null) : null, nm = mk === "CAPE" ? "CAPE" : "P/E", last = v[v.length - 1];
  const F = window.FWDPE, win = n => { const k0 = (+ks[ks.length - 1].slice(0, 4) - n) + ks[ks.length - 1].slice(4); const x = ks.map((k, i) => k > k0 ? v[i] : null).filter(z => z != null); return x.length ? mean(x) : null; }, a90 = mean(vAll.filter((_, i) => ksAll[i] >= "1990")), a00 = mean(vAll.filter((_, i) => ksAll[i] >= "2000")), aFull = mean(vAll); window.__peLast = { mk, last, F0, lt: null };
  if (F && F.factset) { const f = F.factset, j = F.jpm, d = x => `${x > 0 ? "+" : ""}${pct(x, 0)}`;
    $("#sgFwd").innerHTML = `<h4>P/E forward 12 mesi (quello usato da FactSet e J.P. Morgan)</h4>
     <div class="lumpkpi"><div class="kpi gold"><span>P/E forward oggi (${fmtD(f.date)})</span><b>${num(f.fwd, 1)}</b></div><div class="kpi"><span>Media 10 anni · media 5 anni</span><b>${num(f.avg10, 1)} · ${num(f.avg5, 1)}</b></div></div>
     <div class="answer">P/E forward oggi <b>${num(f.fwd, 1)}</b> contro una media a 10 anni di <b>${num(f.avg10, 1)}</b> (${d(f.fwd / f.avg10 - 1)}) e a 5 anni di ${num(f.avg5, 1)} (${d(f.fwd / f.avg5 - 1)}): secondo gli utili <i>attesi</i> dagli analisti ${Math.abs(f.fwd / f.avg10 - 1) < 0.05 ? "il mercato è in linea con la media degli ultimi 10 anni" : f.fwd > f.avg10 ? "il mercato è più caro della media degli ultimi 10 anni" : "il mercato è meno caro della media degli ultimi 10 anni"}.${j ? ` J.P. Morgan (al ${fmtD(j.date)}): ${num(j.fwd, 1)} contro una media a 30 anni di ${num(j.avg30, 1)} (${d(j.fwd / j.avg30 - 1)}; fascia normale ±1 deviazione standard ${num(j.sdLo, 1)}–${num(j.sdHi, 1)}).` : ""} Il P/E sugli utili degli ultimi 12 mesi (FactSet) è più alto: ${num(f.ttm, 1)} contro ${num(f.ttm10, 1)} a 10 anni, perché gli analisti si aspettano una forte crescita degli utili.</div>
     <p class="note">Fonti: <a href="${f.url}" target="_blank" rel="noopener">${f.src}</a>${j ? `; <a href="${j.url}" target="_blank" rel="noopener">${j.src}</a>` : ""}. Il P/E forward usa stime degli analisti (che spesso si rivelano ottimiste). Non esiste una serie storica mensile gratuita: per questo i backtest qui sotto usano il P/E sugli utili effettivi (trailing) e il CAPE.</p>`; }
  $("#sgValT").innerHTML = `<h4>P/E e CAPE su utili effettivi (trailing): serie storica usata nei backtest</h4><div class="lumpkpi"><div class="kpi gold"><span>Oggi (${ks[ks.length - 1]})</span><b>${nm} ${num(last, 1)}</b></div><div class="kpi"><span>Media dal ${ks[0].slice(0, 4)}</span><b>${num(lt, 1)}</b></div></div>
   <div class="answer">Oggi il ${nm} è <b>${num(last, 1)}</b>, la media dal ${ks[0].slice(0, 4)} è ${num(lt, 1)}: <b>${last > lt ? "+" : ""}${pct(last / lt - 1, 0)}</b> ${last > lt ? "sopra" : "sotto"} la media${roll ? ` (media degli ultimi ${RW / 12} anni: ${num(roll[roll.length - 1], 1)})` : ""}.</div>
   ${table(["Media del " + nm, "Ultimi 10 anni", "Ultimi 20 anni", "Dal 1990", "Dal 2000", `Tutta la storia (dal ${ksAll[0].slice(0, 4)})`], [["Valore", ...[win(10), win(20), a90, a00, aFull].map(x => num(x, 1))], ["Oggi rispetto alla media", ...[win(10), win(20), a90, a00, aFull].map(x => `${last > x ? "+" : ""}${pct(last / x - 1, 0)}`)]])}`;
  const tr = [{ x: ks, y: v, name: nm, type: "scatter", line: { color: C.gold, width: 1.4 } }, { x: [ks[0], ks[ks.length - 1]], y: [lt, lt], name: `Media dal ${ks[0].slice(0, 4)}`, type: "scatter", line: { color: "#fff", dash: "dash", width: 1.4 } }];
  if (roll) tr.push({ x: ks, y: roll, name: `Media mobile ${RW / 12} anni`, type: "scatter", line: { color: C.blue, width: 1.2 } });
  plot(o._ch.vi, tr, { title: T(`S&P 500: ${nm} e la sua media`), hoverlabel: { bgcolor: "#000", font: { size: 15 } } });
  // quintili del rapporto con la media espandente (senza look-ahead) e rendimenti futuri dell'S&P 500
  const SP = idxSeries("SP", "P", "USD"), PB = sgMonths(SP.d, SP.c), pIdx = new Map(PB.m.map((k, i) => [k, i]));
  const rel = ks.map((k, i) => ({ k, r: v[i] / exp[i] - 1, i: pIdx.get(k) })).filter(x => x.i != null && x.k >= String(Math.max(1937, +F0 + 5)));
  const srt = rel.map(x => x.r).sort((a, b) => a - b), q = p => srt[Math.floor(p * (srt.length - 1))], cut = [q(.2), q(.4), q(.6), q(.8)];
  const fw0 = (g, h) => { const r = sgFwd(PB.px, g.map(x => x.i), h); return r ? r.avg : null; };
  const grp = [0, 1, 2, 3, 4].map(g => rel.filter(x => (g === 0 || x.r > cut[g - 1]) && (g === 4 || x.r <= cut[g])));
  window.__peLast = { mk, F0, last, lt, w10: win(10), w20: win(20), a90, a00, aFull, cut, n: grp.map(g => g.length), r5: grp.map(g => fw0(g, 60)), r10: grp.map(g => fw0(g, 120)) };
  const fw = (g, h) => sgFwd(PB.px, g.map(x => x.i), h);
  const R5 = grp.map(g => fw(g, 60)), R10 = grp.map(g => fw(g, 120));
  $("#sgValQ").innerHTML = `<div class="answer">${R5[0] && R5[4] ? `Comprare quando il ${nm} era nel 20% più basso rispetto alla media è stato ${R5[0].avg > R5[4].avg ? "<b>più favorevole</b>" : "<b>non più favorevole</b>"}: nei 5 anni successivi l'S&amp;P 500 ha reso in media <b>${pc(R5[0].avg)}</b> l'anno, contro <b>${pc(R5[4].avg)}</b> quando era nel 20% più caro${R10[0] && R10[4] ? ` (a 10 anni: ${pc(R10[0].avg)} contro ${pc(R10[4].avg)})` : ""}. È una tendenza di lungo periodo, non un segnale preciso: il mercato può restare caro per anni.` : ""}</div>
   ${table(["Gruppo (rispetto alla media storica a quella data)", "Mesi", "5 anni dopo: media annua", "5 anni: peggiore", "10 anni dopo: media annua", "10 anni: peggiore"], grp.map((g, i) => [["1 · il più economico", "2", "3", "4", "5 · il più caro"][i] + ` (${i === 0 ? "fino a " + pct(cut[0], 0) : i === 4 ? "oltre " + pct(cut[3], 0) : pct(cut[i - 1], 0) + " – " + pct(cut[i], 0)})`, g.length, R5[i] ? pc(R5[i].avg) : "–", R5[i] ? pc(R5[i].worst) : "–", R10[i] ? pc(R10[i].avg) : "–", R10[i] ? pc(R10[i].worst) : "–"]))}
   <p class="note">${nm}: Shiller (Yale) fino al ${mk === "CAPE" ? SG.meta.cape_shiller_last : SG.meta.pe_shiller_last}, poi multpl.com. Scostamento misurato rispetto alla media calcolata solo con i dati disponibili a quella data; mesi dal ${Math.max(1937, +F0 + 5)} (la media parte dal ${F0} e si allunga mese per mese)${+F0 >= 1990 ? "; con la media dal " + F0 + " i casi sono pochi e molto sovrapposti: prudenza" : ""}. Rendimenti futuri: S&amp;P 500 solo prezzo, USD (dividendi esclusi, circa +2–4% l'anno in più nella realtà).</p>`;
}
runStrat = function () { showTab("bt"); runSig(); };
{ const _s = showTab; showTab = id => { _s(id); if (id === "bt") try { renderSig(); } catch (e) { console.error(e); } }; }
