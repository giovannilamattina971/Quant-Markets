"use strict";
/* ===== v3: sezione Educazione (timing, PAC, basi, economia reale, inflazione) ===== */
const IDX = {
  SP: { n: "S&P 500", P: "^GSPC", TR: "^SP500TR" }, MW: { n: "MSCI World", P: "MSCIWDP", TR: "MSCIWD" }, EMI: { n: "MSCI Emerging Markets", P: "MSCIEMP", TR: "MSCIEM" },
  NDX: { n: "Nasdaq 100", P: "^NDX" }, DJI: { n: "Dow Jones Industrial", P: "^DJI" }, IXIC: { n: "Nasdaq Composite", P: "^IXIC" }, RUT: { n: "Russell 2000", P: "^RUT" },
  SWDA: { n: "ETF iShares Core MSCI World (SWDA, quotato in EUR)", TR: "SWDA.MI" } };
const FXd = (() => { const E = window.MACRO && MACRO.eur; return E ? { d: E.d, v: E.v } : null; })();
function fxOn(date) { if (!FXd) return null; const i = lb(FXd.d, date + "~") - 1; return i >= 0 ? FXd.v[i] : null; }
function idxSeries(id, kind, ccy) {
  const D = IDX[id]; let src = D[kind] || D.TR || D.P; const k2 = D[kind] ? kind : (D.TR ? "TR" : "P");
  const r = rawSeries(src); if (!r) return null; let cur = (AS[src] && AS[src].cur) || "USD";
  let d = r.d.filter(x => x.slice(0, 7) < CUR_M || r.freq === "D"), c = r.c.slice(0, d.length);
  if (ccy === "EUR" && cur !== "EUR" && r.freq === "M" && rawSeries(src + "_EUR")) { const L = monthlyLv(src, cur, "EUR"); const ks = [...L.keys()].sort(); d = ks.map(k => k + "-28"); c = ks.map(k => L.get(k)); cur = "EUR"; }
  if (ccy !== cur) { const d2 = [], c2 = []; d.forEach((x, i) => { const fx = r.freq === "M" ? FXm.get(x.slice(0, 7)) : fxOn(x); if (fx) { d2.push(x); c2.push(ccy === "EUR" ? c[i] / fx : c[i] * fx); } }); d = d2; c = c2; }
  const src2 = AS[src] ? AS[src].src : "Yahoo Finance " + src;
  return { d, c, freq: r.freq, kind: k2, name: D.n + (k2 === "TR" ? " (total return, dividendi reinvestiti)" : " (solo prezzo, senza dividendi)"), src: src2, ccy };
}
const idxOpts = sel => Object.entries(IDX).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v.n}</option>`).join("");
function coverage(id) { const D = IDX[id]; return ["P", "TR"].filter(k => D[k]).map(k => { const r = rawSeries(D[k]); return r ? `${k === "TR" ? "Total return" : "Prezzo"}: dal ${fmtD(r.d[0])} (${r.freq === "M" ? "mensile" : "giornaliero"})` : ""; }).join(" · "); }
const monthEnd = S => { const m = new Map(); S.d.forEach((x, i) => m.set(x.slice(0, 7), S.c[i])); return m; };
const kp2 = (a, b) => `<div class="kpi"><span>${a}</span><b>${b}</b></div>`;
const pdfBtn = (id, label) => `<div class="toolbar nopdf"><button id="${id}" class="primary pdfbtn">📄 ${label}</button></div>`;
function irrOf(flows) { let lo = -0.99, hi = 2; const npv = r => flows.reduce((s, [t, v]) => s + v / (1 + r) ** (t / 12), 0); if (npv(lo) * npv(hi) > 0) return NaN; for (let k = 0; k < 120; k++) { const m = (lo + hi) / 2; npv(m) > 0 ? lo = m : hi = m; } return (lo + hi) / 2; }
function rangeForm(pre, defY) { return `<label>Ultimi N anni <input id="${pre}Y" type="number" min="1" max="100" value="${defY}" style="width:70px"></label><label>oppure dal <input id="${pre}From" type="date"></label><label>al (opz.) <input id="${pre}To" type="date"></label>`; }
function rangeOf(pre, S) { const last = S.d[S.d.length - 1]; let to = $("#" + pre + "To").value || last; let from = $("#" + pre + "From").value; if (!from) { const y = +$("#" + pre + "Y").value || 0; from = y ? (+to.slice(0, 4) - y) + to.slice(4) : S.d[0]; } return [from < S.d[0] ? S.d[0] : from, to]; }

/* ---------- Simulatore PAC ---------- */
function renderPac() {
  const o = $("#psOut"); if (o.dataset.ok) return pacRun(); o.dataset.ok = 1;
  const [c1, i1] = div("chart tall"), [c2, i2] = div(), [c3, i3] = div();
  o.innerHTML = `${pdfBtn("pacPdf", "Scarica presentazione PAC")}<div class="card"><h2>Simulatore PAC – Piano di Accumulo</h2>
  <div class="form"><label>Indice <select id="pacIdx">${idxOpts("MW")}</select></label><label>Serie <select id="pacKind"><option value="TR">Total return (dividendi reinvestiti)</option><option value="P">Solo prezzo</option></select></label>
  <label>Valuta <select id="pacCcy"><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
  <label>Capitale iniziale <input id="pacInit" type="number" value="10000" min="0"></label><label>Rata <input id="pacRata" type="number" value="300" min="0"></label>
  <label>Frequenza <select id="pacFreq"><option value="1">Mensile</option><option value="3">Trimestrale</option><option value="6">Semestrale</option><option value="12">Annuale</option></select></label>
  ${rangeForm("ps", 20)}<label class="chk"><input type="checkbox" id="pacCash"> Confronta con contante (inflazione ISTAT)</label><button id="psGo" class="primary">Calcola</button></div>
  <p class="muted" id="pacCov"></p></div><div id="pacRes"></div><div class="card">${c1}</div><div class="card" id="pacTab"></div>`;
  o._ch = [i1, i2, i3];
  ["#pacIdx", "#pacKind", "#pacCcy", "#pacFreq", "#pacCash"].forEach(s => $(s).onchange = pacRun); $("#psGo").onclick = pacRun;
  $("#pacPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Il Piano di Accumulo (PAC)", sub: "Simulazione su dati storici reali: " + (window.__pacLast || {}).sub, file: pdfName("Presentazione_PAC"), parts: [{ tab: "pac", root: "#psOut" }] }));
  pacRun();
}
function pacRun() {
  const id = $("#pacIdx").value, ccy = $("#pacCcy").value; let kind = $("#pacKind").value; if (!IDX[id][kind]) kind = IDX[id].TR ? "TR" : "P";
  $("#pacCov").innerHTML = `Copertura ${IDX[id].n}: ${coverage(id)}. ${ccy === "EUR" ? "In EUR i dati partono dal 1999 (cambio BCE/FRED DEXUSEU, senza copertura valutaria)." : ""}${!IDX[id][$("#pacKind").value] ? ` <span class="warn">Serie richiesta non disponibile: uso ${kind === "TR" ? "total return" : "solo prezzo"}.</span>` : ""}`;
  const S = idxSeries(id, kind, ccy); const res = $("#pacRes");
  if (!S || S.d.length < 13) { res.innerHTML = `<div class="card"><p class="warn">Dati insufficienti.</p></div>`; return; }
  const [from, to] = rangeOf("ps", S); const L = monthEnd(S); let months = [...L.keys()].filter(k => k >= from.slice(0, 7) && k <= to.slice(0, 7)).sort();
  if (months.length < 13) { res.innerHTML = `<div class="card"><p class="warn">Periodo troppo breve (servono almeno 13 mesi).</p></div>`; return; }
  const init = +$("#pacInit").value || 0, rata = +$("#pacRata").value || 0, fq = +$("#pacFreq").value, withCash = $("#pacCash").checked;
  const CP = cpiMap(ccy);
  let units = 0, cum = 0; const flows = [], val = [], cap = [], cash = []; let cashReal = 0; const cpiEnd = CP.get(months[months.length - 1]) || [...CP.values()].pop();
  months.forEach((m, i) => { const p = L.get(m); let inv = 0; if (i === 0) inv += init; if (i > 0 && (i % fq === 0)) inv += rata; if (i === 0 && rata && !init) inv += rata;
    if (inv) { units += inv / p; cum += inv; flows.push([i, -inv]); } val.push(units * p); cap.push(cum);
    if (inv && CP.get(m)) cashReal += inv * 100 / CP.get(m); cash.push(CP.get(m) ? cashReal * CP.get(m) / 100 : NaN); });
  // contante in potere d'acquisto, espresso in moneta di ciascuna data: valore reale = versato deflazionato
  const cashPP = months.map((m, i) => { const c = cpiAt(CP, m); if (!c) return NaN; let s = 0; flows.forEach(([t, v]) => { if (t <= i) s += -v * cpiAt(CP, months[t]) / c; }); return s; });
  const last = months.length - 1, fin = val[last], irr = irrOf([...flows, [last, fin]]);
  const years = [...new Set(months.map(m => m.slice(0, 4)))]; const rows = [], yv = []; let prevV = 0, prevCum = 0, prevIdx = null;
  years.forEach(y => { const ii = months.map((m, i) => [m, i]).filter(([m]) => m.startsWith(y)).map(x => x[1]); const e = ii[ii.length - 1]; const vers = cap[e] - prevCum;
    const idxR = prevIdx != null ? L.get(months[e]) / L.get(months[prevIdx]) - 1 : L.get(months[e]) / L.get(months[ii[0]]) - 1;
    const s0 = prevIdx != null ? prevIdx : ii[0], span = Math.max(1, e - s0), wf = flows.filter(([t]) => t > (prevIdx != null ? prevIdx : -1) && t <= e).reduce((a, [t, v]) => a + (-v) * (e - t) / span, 0); const dietz = (prevV + wf) > 0 ? (val[e] - prevV - vers) / (prevV + wf) : NaN;
    const irrC = irrOf([...flows.filter(f => f[0] <= e), [e, val[e]]]);
    const cumR = cap[e] > 0 ? val[e] / cap[e] - 1 : NaN, twrC = L.get(months[e]) / L.get(months[0]) - 1;
    rows.push([y + (ii.length < 12 ? "*" : ""), num(cap[e], 0), pc(idxR), `<b>${num(val[e], 0)}</b>`, ...(withCash ? [num(cashPP[e], 0)] : [])]);
    yv.push({ y, idxR, dietz }); prevV = val[e]; prevCum = cap[e]; prevIdx = e; });
  let pk = 0, mdd = 0; months.forEach(m => { const p = L.get(m); pk = Math.max(pk, p); mdd = Math.min(mdd, p / pk - 1); });
  let worst = 0, worstI = 0; val.forEach((v, i) => { const g = v - cap[i]; if (g < worst) { worst = g; worstI = i; } });
  const twr = L.get(months[last]) / L.get(months[0]) - 1, twrCagr = (1 + twr) ** (12 / last) - 1, cumTot = fin / cap[last] - 1;
  const sub = `${S.name}, ${ccy}, ${months[0]} → ${months[last]}`;
  window.__pacLast = { sub };
  res.innerHTML = `<div class="card"><h3>Risultato: ${S.name}</h3><div class="kpis">${kp2("Totale versato", num(cap[last], 0) + " " + ccy)}${kp2("Capitale finale", num(fin, 0) + " " + ccy)}${kp2("Guadagno", `<span class="${cls(fin - cap[last])}">${num(fin - cap[last], 0)} ${ccy}</span>`)}${withCash ? kp2("Contante (inflazione)", num(cashPP[last], 0) + " " + ccy) : ""}</div>
  <div class="answer">Dal ${months[0]} al ${months[last]} (${num(months.length / 12, 0)} anni), con un capitale iniziale di ${num(init, 0)} ${ccy} e una rata ${["", "mensile", "", "trimestrale", "", "", "semestrale"][fq] || "annuale"} di ${num(rata, 0)} ${ccy}, sono stati versati <b>${num(cap[last], 0)} ${ccy}</b> e il capitale rivalutato è di <b>${num(fin, 0)} ${ccy}</b>.</div>
  <p class="note">${S.name}. Versamenti al valore di fine mese; nessun costo o imposta. Fonte: ${S.src}. Anni con * parziali. Dati storici, non previsioni.</p></div>`;
  const [i1, i2, i3] = $("#psOut")._ch;
  plot(i1, [{ x: months, y: cap, name: "Capitale versato", type: "scatter", line: { color: "#888", width: 1.5, shape: "hv" }, fill: "tozeroy", fillcolor: "rgba(140,140,140,.12)" }, { x: months, y: val, name: "Capitale rivalutato", type: "scatter", line: { color: C.gold, width: 2.2 } }, ...(withCash ? [{ x: months, y: cashPP, name: "Contante (potere d'acquisto, inflazione ISTAT)", type: "scatter", line: { color: C.red, width: 1.4, dash: "dot" } }] : [])], { title: T(`Capitale versato e capitale rivalutato (${ccy})`), yaxis: { gridcolor: C.grid } });
  const ly = months[last].slice(0, 4), lastPartial = !months[last].endsWith("-12"), lastD = (() => { const [yy, mm] = months[last].split("-").map(Number); const dd = new Date(Date.UTC(yy, mm, 0)); return months[last] + "-" + String(dd.getUTCDate()).padStart(2, "0"); })();
  const fmtD = x => x.split("-").reverse().join("/"), nR = flows.length - 1 - (init ? 0 : 0), nRate = flows.filter(f => f[0] > 0).length, totRate = nRate * rata;
  const freqN = { 1: "mensile", 3: "trimestrale", 6: "semestrale", 12: "annuale" }[fq];
  rows.push([`<b>Totale</b>`, `<b>${num(cap[last], 0)}</b>`, `<b>${pc(cumTot)}</b> <small class="muted">sul versato</small>`, `<b>${num(fin, 0)}</b>`, ...(withCash ? [`<b>${num(cashPP[last], 0)}</b>`] : [])]);
  const dd = (() => { let pk = 0, b = { d: 0 }; months.forEach((m, i) => { const p = L.get(m); if (p >= L.get(months[pk])) pk = i; const x = p / L.get(months[pk]) - 1; if (x < b.d) b = { d: x, pki: pk, tri: i }; }); if (b.d === 0) return { d: 0, pk: "–", tr: "–", mDown: 0, rec: "–", mRec: 0 }; const top = L.get(months[b.pki]); let ri = null; for (let i = b.tri; i < months.length; i++) if (L.get(months[i]) >= top) { ri = i; break; } return { d: b.d, pk: months[b.pki], tr: months[b.tri], mDown: b.tri - b.pki, rec: ri != null ? months[ri] : null, mRec: ri != null ? ri - b.tri : null }; })();
  const hk = [...L.keys()].sort(), hp = [5, 10, 15].map(y => { const r = []; for (let i = 0; i + 12 * y < hk.length; i++) r.push((L.get(hk[i + 12 * y]) / L.get(hk[i])) ** (1 / y) - 1); return { y, n: r.length, loss: r.filter(x => x < 0).length, min: Math.min(...r), max: Math.max(...r), avg: r.reduce((a, b) => a + b, 0) / (r.length || 1) }; });
  $("#pacTab").innerHTML = `<h3>Tabella anno per anno</h3>${table(["Anno", "Versato (cumulato)", "Rendimento dell'anno", "Capitale rivalutato", ...(withCash ? ["Contante, potere d'acquisto"] : [])], rows).replace("<table", '<table class="full"')}<p class="note">Rendimento dell'anno = variazione dell'indice nell'anno solare (nel primo anno dal primo versamento).${lastPartial ? ` * ${ly} da inizio anno, dati al ${fmtD(lastD)}.` : ""} Totale: rendimento complessivo = capitale rivalutato / totale versato − 1.${withCash ? ` Contante: versamenti tenuti a 0% e deflazionati con ${ccy === "EUR" ? "CPI Italia (ISTAT)" : "CPI USA"}.` : ""}</p>
  <h3 class="pdfbreak">Riepilogo del piano</h3>${table(["Voce", "Importo"], [["Versamento iniziale", `${num(init, 0)} ${ccy}`], ["Rate successive", `${num(rata, 0)} ${ccy} ${{ mensile: "al mese", trimestrale: "a trimestre", semestrale: "a semestre", annuale: "all'anno" }[freqN]} × ${nRate} rate = ${num(totRate, 0)} ${ccy}`], ["Totale versato", `${num(cap[last], 0)} ${ccy}`], ["Capitale rivalutato", `<b>${num(fin, 0)} ${ccy}</b>`], ["Guadagno", `${num(fin - cap[last], 0)} ${ccy}`], ["Rendimento medio annuo", `<b>${pct(irr, 2)}</b>`], ...(withCash ? [["Stessi versamenti tenuti in contante (potere d'acquisto di oggi)", `${num(cashPP[last], 0)} ${ccy}`], ["Perdita di potere d'acquisto del contante", `<span class="neg">${num(cashPP[last] - cap[last], 0)} ${ccy} (${pct(cashPP[last] / cap[last] - 1)})</span>`], ["Differenza PAC rispetto al contante", `<b>${num(fin - cashPP[last], 0)} ${ccy}</b>`]] : []), ["Periodo", `${months[0]} → ${months[last]}${lastPartial ? " (ultimo dato " + fmtD(lastD) + ")" : ""}`]])}<p class="note">Rendimento medio annuo: tasso annuo che tiene conto di quando e quanto è stato versato (metodo money-weighted). ${withCash ? ` Contante: i soldi lasciati fermi mantengono il valore nominale ma perdono potere d'acquisto con l'inflazione (${ccy === "EUR" ? "indice ISTAT NIC, Italia" : "CPI USA"}); il valore è espresso in euro di oggi.` : ""} Dati storici, non previsioni; nessun costo o imposta.</p>
  <h3>Il calo massimo nel periodo</h3>${table(["Voce", "Valore"], [["Calo massimo dell'indice", `<b>${pc(dd.d)}</b>`], ["Dal massimo del", dd.pk], ["Al minimo del", dd.tr], ["Durata della discesa", `${dd.mDown} mesi`], ["Ritorno al massimo precedente", dd.rec ? `${dd.rec} (dopo ${dd.mRec} mesi dal minimo)` : "non ancora recuperato"], ["Momento peggiore del PAC rispetto al versato", worst < 0 ? `${num(worst, 0)} ${ccy} (${pct(worst / cap[worstI])}) a ${months[worstI]}` : "mai sotto il versato"]])}<p class="note">È la discesa più ampia da un massimo al minimo successivo (dati di fine mese). Anche i mercati migliori attraversano cali profondi: chi ha continuato i versamenti ha poi recuperato.</p>
  <h3>Quanto conta il tempo</h3>${table(["Investimento tenuto per", "Periodi analizzati", "Finiti in perdita", "Rendimento annuo peggiore", "Rendimento annuo medio", "Rendimento annuo migliore"], hp.map(h => [`${h.y} anni`, h.n, h.n ? `${h.loss} (${pct(h.loss / h.n, 0)})` : "–", h.n ? pc(h.min) : "–", h.n ? pc(h.avg) : "–", h.n ? pc(h.max) : "–"]))}<p class="note">Investimento unico, partendo da ogni mese della storia disponibile di ${S.name} (${ccy}, ${hk[0]} → ${hk[hk.length - 1]}): più a lungo si resta investiti, meno spesso si chiude in perdita. I periodi si sovrappongono.</p>`;
}

/* ---------- Restare sul mercato vs timing ---------- */
function cashMonthly(ccy, mode) { // Map YYYY-MM -> rendimento mensile della liquidità
  const m = new Map(); if (mode === "0") return m;
  if (ccy === "USD") { const L = monthlyLv("CASH", "USD", "USD"), k = [...L.keys()].sort(); k.forEach((x, i) => { if (i) m.set(x, L.get(x) / L.get(k[i - 1]) - 1); }); }
  else { const R = (window.YIELDS && YIELDS._rates && YIELDS._rates.ECBDFR) || null; if (R) { for (let y = 1999; y <= 2030; y++) for (let mo = 1; mo <= 12; mo++) { const key = `${y}-${String(mo).padStart(2, "0")}`; const i = lb(R.d, key + "-31") - 1; if (i >= 0) m.set(key, R.v[i] / 100 / 12); } } }
  return m;
}
function cpiAt(CP, k) { if (CP.has(k)) return CP.get(k); if (!CP._k) CP._k = [...CP.keys()].sort(); const i = lb(CP._k, k) - 1; return i >= 0 && k.slice(0, 4) - CP._k[i].slice(0, 4) < 2 ? CP.get(CP._k[i]) : undefined; }
function timingSim(S, i0, i1, amt, mode, X, cashR, CP) {
  // S: {d,c}; investimenti annuali di `amt` all'inizio di ogni anno solare (mode "y") o mensili equivalenti
  const out = { subito: 0, peggiore: 0, migliore: 0, pac: 0, attesa: 0, liquidita: 0, pp: 0, versato: 0 }; const end = S.c[i1];
  let ath = 0; for (let i = 0; i < i0; i++) ath = Math.max(ath, S.c[i]);
  const years = []; for (let i = i0; i <= i1; i++) { const y = S.d[i].slice(0, 4); if (!years.length || years[years.length - 1].y !== y) years.push({ y, idx: [] }); years[years.length - 1].idx.push(i); }
  let cash = 0, uW = 0, liq = 0; const cpiEnd = cpiAt(CP, S.d[i1].slice(0, 7));
  for (const Y of years) {
    const ix = Y.idx, cs = ix.map(i => S.c[i]); out.versato += amt; out.subito += amt * end / cs[0];
    let mx = 0, mn = 0; cs.forEach((v, k) => { if (v > cs[mx]) mx = k; if (v < cs[mn]) mn = k; }); out.peggiore += amt * end / cs[mx]; out.migliore += amt * end / cs[mn];
    const firsts = ix.filter((i, k) => k === 0 || S.d[i].slice(5, 7) !== S.d[ix[k - 1]].slice(5, 7)); firsts.forEach(i => out.pac += amt / firsts.length * end / S.c[i]);
    const c0 = cpiAt(CP, S.d[ix[0]].slice(0, 7)); out.pp += c0 && cpiEnd ? amt * c0 / cpiEnd : NaN;
    cash += amt; liq += amt;
    ix.forEach((i, k) => { if (k && S.d[i].slice(5, 7) !== S.d[ix[k - 1]].slice(5, 7)) { const r = cashR.get(S.d[ix[k - 1]].slice(0, 7)) || 0; cash *= 1 + r; liq *= 1 + r; }
      ath = Math.max(ath, S.c[i]); if (cash > 0 && S.c[i] <= ath * (1 - X)) { uW += cash / S.c[i]; cash = 0; } });
  }
  out.attesa = uW * end + cash; out.liquidita = liq; out.cashLeft = cash; return out;
}
const TSTRAT = [["subito", "Investo subito (inizio anno)", C.gold], ["pac", "Investo a rate mensili (PAC)", "#a08033"], ["peggiore", "Peggior timing (massimo dell'anno)", C.red], ["migliore", "Miglior timing (minimo dell'anno)", C.green], ["attesa", "Aspetto una correzione", C.blue], ["liquidita", "Resto in liquidità", "#777"], ["pp", "Contante: potere d'acquisto", "#b08bd9"]];
function renderTiming() {
  const o = $("#timOut"); if (o.dataset.ok) { runLump(); try { renderAth(); } catch (e) { console.error(e); } return; } o.dataset.ok = 1;
  const LP = lumpHtml(); o._lp = [LP[1], LP[2]];
  o.innerHTML = `${pdfBtn("timPdf", "Scarica PDF")}${LP[0]}<div id="athOut"></div>`;
  ["#lpY", "#lpAmt", "#lpIdx", "#lpCcy", "#lpRule", "#lpCash"].forEach(s => $(s).onchange = runLump); document.querySelectorAll("[data-lpx]").forEach(b => b.onclick = () => { document.querySelectorAll("[data-lpx]").forEach(x => x.classList.toggle("on", x === b)); runLump(); });
  runLump(); try { renderAth(); } catch (e) { console.error(e); }
  $("#timPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Investo subito o aspetto un calo?", sub: [window.__timLast, window.__athLast].filter(Boolean).join(" · "), file: pdfName("Investo_subito_o_aspetto_un_calo"), parts: [{ tab: "timing", root: "#timOut" }] }));
}
function runTiming() {
  if (!$("#timIdx")) return; // vecchio approfondimento rimosso (sezione unificata)
  const id = $("#timIdx").value, ccy = $("#timCcy").value; let kind = $("#timKind").value; if (!IDX[id][kind]) kind = IDX[id].TR ? "TR" : "P";
  const S = idxSeries(id, kind, ccy); if (!S) return; const [from, to] = rangeOf("tim", S), i0 = lb(S.d, from), i1 = lb(S.d, to + "~") - 1;
  const amt = +$("#timAmt").value || 12000, X = +$("#timX").value, cashR = cashMonthly(ccy, $("#timCash").value), CP = cpiMap(ccy);
  if (i1 - i0 < (S.freq === "M" ? 24 : 500)) { $("#timRes").innerHTML = `<div class="card"><p class="warn">Periodo troppo breve.</p></div>`; return; }
  const R = timingSim(S, i0, i1, amt, "y", X, cashR, CP); const nY = Math.round(R.versato / amt);
  const best = TSTRAT.slice(0, 6).reduce((a, b) => R[b[0]] > R[a[0]] ? b : a);

  const waitWon = R.attesa > R.peggiore;
  $("#timRes").innerHTML = `<div class="card"><h3>${S.name} · ${fmtD(S.d[i0])} – ${fmtD(S.d[i1])} · ${nY} anni × ${num(amt, 0)} ${ccy}</h3>
  ${table(["Strategia", "Valore finale", "Multiplo sul versato", "vs «Investo subito»"], TSTRAT.map(([k, n]) => [n + (k === "attesa" ? ` (${pct(X, 0)})` : ""), num(R[k], 0), num(R[k] / R.versato, 2) + "x", pc(R[k] / R.subito - 1)]))}
  <div class="answer">Versati in totale ${num(R.versato, 0)}. Anche investendo ogni anno nel <b>giorno peggiore</b> (massimo dell'anno) si arriva a ${num(R.peggiore, 0)}, contro ${num(R.liquidita, 0)} restando in liquidità. Aspettare una correzione del ${pct(X, 0)} ha portato a ${num(R.attesa, 0)}${R.cashLeft > 0 ? ` (di cui ${num(R.cashLeft, 0)} ancora in attesa di investimento)` : ""}: ${waitWon ? `<b>in questo periodo aspettare ha battuto il peggior timing</b> – succede, soprattutto quando le correzioni arrivano spesso o il periodo termina dopo un crollo.` : "<b>in questo periodo aspettare ha reso meno anche del peggior timing possibile</b>."} Il miglior timing (irrealizzabile) avrebbe dato ${num(R.migliore, 0)}, solo ${pct(R.migliore / R.subito - 1)} più di investire subito.</div></div>`;
  const [i1c, i2c] = $("#timOut")._ch;
  const SH = ["Subito", "PAC mensile", "Peggior timing", "Miglior timing", "Aspetto correzione", "Liquidità", "Contante (p. d'acquisto)"];
  plot(i1c, [{ x: SH, y: TSTRAT.map(s => R[s[0]]), type: "bar", marker: { color: TSTRAT.map(s => s[2]) }, text: TSTRAT.map(s => num(R[s[0]], 0)), textposition: "outside" }, { x: SH, y: TSTRAT.map(() => R.versato), type: "scatter", mode: "lines", name: "Versato", line: { color: "#aaa", dash: "dash" } }], { title: T("Valore finale per strategia"), xaxis: { type: "category" }, yaxis: { gridcolor: C.grid }, hovermode: "closest", showlegend: false, margin: { l: 60, r: 20, t: 30, b: 60 } });
  // partenze mobili
  const H = +$("#timH").value, y0 = +S.d[i0].slice(0, 4) + (S.d[i0].slice(5, 7) === "01" ? 0 : 1), yEnd = +S.d[i1].slice(0, 4), rolls = [];
  for (let y = y0; y + H - 1 <= yEnd; y++) { const a = lb(S.d, `${y}-01-01`), b = lb(S.d, `${y + H - 1}-12-31~`) - 1; if (b <= a || (y + H - 1 === yEnd && S.d[i1].slice(5, 7) !== "12")) continue; rolls.push({ y, ...timingSim(S, a, b, amt, "y", X, cashR, CP) }); }
  if (!rolls.length) { $("#timRoll").innerHTML = `<p class="warn">Periodo troppo breve per orizzonte di ${H} anni.</p>`; return; }
  const share = f => rolls.filter(f).length / rolls.length, wins = rolls.filter(r => r.attesa > r.peggiore);
  $("#timRoll").innerHTML = `<div class="answer">${rolls.length} periodi di ${H} anni (partenze ${rolls[0].y}–${rolls[rolls.length - 1].y}). Il <b>peggior timing ha battuto l'attesa di una correzione del ${pct(X, 0)} nel ${pct(share(r => r.peggiore > r.attesa), 0)}</b> dei periodi; investire subito ha battuto l'attesa nel ${pct(share(r => r.subito > r.attesa), 0)}; il peggior timing ha battuto la liquidità nel ${pct(share(r => r.peggiore > r.liquidita), 0)}. ${wins.length ? (wins.length / rolls.length > 0.5 ? `<b>Attenzione, risultato onesto: in questo campione aspettare una correzione del ${pct(X, 0)} ha battuto il peggior timing in ${wins.length} periodi su ${rolls.length}</b> (le correzioni del ${pct(X, 0)} sono frequenti, quindi chi aspetta spesso compra prima del massimo dell'anno). Il confronto più realistico è con «Investo subito»: lì l'attesa ha perso nel ${pct(share(r => r.subito > r.attesa), 0)} dei periodi.` : `<b>Aspettare ha vinto in ${wins.length} casi</b> (partenze: ${wins.map(r => r.y).join(", ")}), evidenziati in tabella.`) : "In nessun periodo l'attesa ha battuto il peggior timing."}</div>`;
  plot(i2c, [["peggiore", "Peggior timing"], ["attesa", `Aspetto correzione ${pct(X, 0)}`], ["subito", "Investo subito"], ["liquidita", "Liquidità"]].map(([k, n], j) => ({ x: rolls.map(r => r.y), y: rolls.map(r => r[k] / r.versato), name: n, type: "scatter", mode: "lines+markers", line: { color: [C.red, C.blue, C.gold, "#777"][j] } })), { title: T(`Multiplo sul versato dopo ${H} anni, per anno di partenza`), xaxis: { title: "Anno di partenza" }, yaxis: { gridcolor: C.grid, ticksuffix: "x" } });
  $("#timRollT").innerHTML = `<div class="scrollx">${table(["Partenza", "Subito", "Peggior timing", "Aspetto correzione", "Liquidità", "Vince"], rolls.map(r => { const w = r.attesa > r.peggiore; return [w ? `<b class="neg">${r.y} ◆</b>` : r.y, num(r.subito / r.versato, 2) + "x", num(r.peggiore / r.versato, 2) + "x", num(r.attesa / r.versato, 2) + "x", num(r.liquidita / r.versato, 2) + "x", w ? "<b>Attesa</b> > peggior timing" : "Peggior timing"]; }))}</div><p class="note">◆ = periodi in cui aspettare la correzione ha battuto anche il peggior timing.</p>`;
}

/* ---------- utilità per le pagine educative ---------- */
function growth(id, ccy, from, real, to) { // serie mensile ribasata a 100
  const [, src, cur] = keyOf(id); const L = monthlyLv(src, cur === "ANY" ? ccy : cur, ccy), CP = cpiMap(ccy);
  const ks = [...L.keys()].filter(k => k >= from && (!to || k <= to)).sort().filter(k => !real || CP.has(k)); if (ks.length < 2) return null;
  const b = L.get(ks[0]) / (real ? CP.get(ks[0]) : 1); return { x: ks, y: ks.map(k => L.get(k) / (real ? CP.get(k) : 1) / b * 100), n: keyOf(id)[0] };
}
const cagrOf = g => g ? (g.y[g.y.length - 1] / 100) ** (12 / (g.x.length - 1)) - 1 : NaN;
function pageShell(o, id, title, pdfTitle, file, inner) {
  o.innerHTML = `${pdfBtn(id + "Pdf", "Scarica PDF")}<div class="card"><h2>${title}</h2>${inner}</div>`;
  $("#" + id + "Pdf").onclick = e => withBusy(e.target, () => makePdf({ title: pdfTitle, sub: "Dati storici reali · " + new Date().toLocaleDateString("it-IT"), file: pdfName(file), parts: [{ tab: o.closest(".tab").id, root: o }] }));
}
const lines = (el, G, title, o = {}) => plot(el, G.filter(Boolean).map((g, k) => ({ x: g.x, y: g.y, name: g.n, type: "scatter", line: { width: k ? 1.4 : 2.2, color: g.c || [C.gold, C.blue, C.red, C.green, "#b08bd9", "#999", "#e07b39"][k % 7], dash: g.dash } })), Object.assign({ title: T(title), yaxis: { type: o.log ? "log" : "linear", gridcolor: C.grid } }, o.lay || {}));

/* ---------- Azioni, obbligazioni, ETF... spiegati semplice ---------- */
function renderBasi() {
  const o = $("#basiOut"); const ch = Array.from({ length: 6 }, () => div()); const ccy = "USD";
  const us = growth("US", ccy, "1988-01"), ust = growth("UST", ccy, "1988-01"), cash = growth("CASH", ccy, "1988-01");
  const yr = g => { const o2 = {}; g.x.forEach((k, i) => { if (k.endsWith("-12")) o2[k.slice(0, 4)] = g.y[i]; }); const ys = Object.keys(o2); return ys.slice(1).map((y, i) => [y, o2[y] / o2[ys[i]] - 1]); };
  const yu = yr(us), yb = yr(ust); const worstU = yu.reduce((a, b) => b[1] < a[1] ? b : a), worstB = yb.reduce((a, b) => b[1] < a[1] ? b : a);
  const sw = growth("SWDA", "EUR", "2010-01"), mwE = growth("WORLDI", "EUR", "2010-01");
  const m6040 = (() => { const M = monthlyRets(["US", "UST", "EXUS", "EM", "GOLD"], "USD", "2004-01-01", "2999-12-31"); const s1 = simulate([M.R[0]], [1], "annual", M.months), s2 = simulate(M.R, [.3, .3, .2, .1, .1], "annual", M.months); return { M, a: pstats(s1.ret, []), b: pstats(s2.ret, []) }; })();
  const r = cagrOf(us), cpiU = cpiMap("USD"); const ck = [...cpiU.keys()].sort(); const inf30 = (cpiU.get(ck[ck.length - 1]) / cpiU.get(ck[ck.length - 361])) ** (1 / 30) - 1;
  pageShell(o, "basi", "Azioni, obbligazioni ed ETF spiegati semplice", "Le basi dell'investimento", "Basi_investimento", `
  <h3>1 · Cos'è un'azione</h3><div class="answer">Un'azione è una piccola quota di proprietà di un'azienda: chi la possiede partecipa agli utili (dividendi) e alla crescita del valore dell'impresa, ma anche alle sue difficoltà. Esempio reale: l'indice S&P 500 (500 grandi aziende USA, dividendi reinvestiti) dal ${us.x[0]} è cresciuto in media del <b>${pct(r, 1)} l'anno</b>; 100 dollari sono diventati ${num(us.y[us.y.length - 1], 0)}. Prezzo da pagare: anni negativi, come il ${worstU[0]} (${pct(worstU[1])}).</div>${ch[0][0]}
  <h3>2 · Cos'è un'obbligazione</h3><div class="answer">Un'obbligazione è un prestito: si presta denaro a uno Stato o a un'azienda che paga interessi (cedole) e restituisce il capitale a scadenza. Oscilla meno delle azioni ma rende tipicamente meno: Treasury USA 10 anni ${pct(cagrOf(ust), 1)} annuo dal ${ust.x[0]}. Non è priva di rischio: quando i tassi salgono i prezzi scendono (anno peggiore ${worstB[0]}: ${pct(worstB[1])}).</div>${ch[1][0]}
  <h3>3 · Cos'è un ETF</h3><div class="answer">Un ETF è un fondo quotato in Borsa che replica un indice a costi bassi: con un solo acquisto si comprano tutte le aziende dell'indice. Esempio: l'ETF iShares Core MSCI World (SWDA, in EUR) ha seguito da vicino l'indice MSCI World (convertito in EUR): ${pct(cagrOf(sw), 2)} contro ${pct(cagrOf(mwE), 2)} annuo dal ${sw ? sw.x[0] : "–"}. La piccola differenza riflette costi e tassazione dei dividendi.</div>${ch[2][0]}
  <h3>4 · Diversificazione</h3><div class="answer">Non mettere tutte le uova nello stesso paniere: dal ${m6040.M.start} un portafoglio diversificato (30% azioni USA, 20% ex-USA, 10% emergenti, 30% Treasury, 10% oro) ha avuto volatilità ${pct(m6040.b.vol)} e massimo calo ${pct(m6040.b.md)}, contro ${pct(m6040.a.vol)} e ${pct(m6040.a.md)} del solo S&P 500, con rendimento ${pct(m6040.b.cagr, 1)} vs ${pct(m6040.a.cagr, 1)} annuo.</div>${ch[3][0]}
  <h3>5 · Interesse composto</h3><div class="answer">Gli interessi producono altri interessi. 10.000 investiti al ${pct(r, 1)} annuo (rendimento storico dell'S&P 500 qui sopra) diventano ${num(1e4 * (1 + r) ** 10, 0)} in 10 anni, ${num(1e4 * (1 + r) ** 20, 0)} in 20 e ${num(1e4 * (1 + r) ** 30, 0)} in 30; con interesse semplice sarebbero ${num(1e4 * (1 + r * 30), 0)} a 30 anni. Il tempo è il fattore più potente.</div>${ch[4][0]}
  <h3>6 · Inflazione e volatilità vs rischio</h3><div class="answer">L'inflazione USA negli ultimi 30 anni è stata in media del ${pct(inf30, 1)} annuo: il contante perde potere d'acquisto ogni anno (vedi la pagina «Inflazione e contante»). La volatilità sono le oscillazioni di breve periodo; il vero rischio per chi investe a lungo è non raggiungere i propri obiettivi o vendere nel momento sbagliato. La probabilità storica di perdita dell'S&P 500 si riduce molto allungando l'orizzonte (vedi «Presentazione cliente» e «Restare sul mercato»).</div>${ch[5][0]}
  <p class="note">Dati: S&P 500 Total Return (Yahoo ^SP500TR), Treasury 10 anni ricostruito da DGS10 (FRED), T-Bill 3 mesi (FRED TB3MS), MSCI World Net TR (msci.com), ETF SWDA (Yahoo), CPI USA (FRED). Rendimenti passati non garantiscono quelli futuri.</p>`);
  lines(ch[0][1], [{ ...us, n: "S&P 500 Total Return" }], "Crescita di 100 $ (scala log)", { log: true });
  plot(ch[1][1], [{ x: yu.map(v => v[0]), y: yu.map(v => v[1] * 100), name: "Azioni USA", type: "bar", marker: { color: C.gold } }, { x: yb.map(v => v[0]), y: yb.map(v => v[1] * 100), name: "Treasury 10 anni", type: "bar", marker: { color: C.blue } }], { title: T("Rendimenti annui: azioni vs obbligazioni"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
  lines(ch[2][1], [sw && { ...sw, n: "ETF SWDA (EUR)" }, mwE && { ...mwE, n: "Indice MSCI World Net TR (in EUR)", dash: "dot" }], "ETF vs indice replicato (100 = inizio)");
  const xs = [m6040.M.start, ...m6040.M.months]; const dd = eq => { let p = 0; return eq.map(v => { p = Math.max(p, v); return (v / p - 1) * 100; }); };
  plot(ch[3][1], [{ x: xs, y: dd(m6040.a.eq), name: "Solo S&P 500", type: "scatter", line: { color: C.red } }, { x: xs, y: dd(m6040.b.eq), name: "Portafoglio diversificato", type: "scatter", line: { color: C.gold }, fill: "tozeroy" }], { title: T("Cali dai massimi (drawdown)"), yaxis: { ticksuffix: "%", gridcolor: C.grid } });
  const yy = [...Array(31).keys()]; plot(ch[4][1], [{ x: yy, y: yy.map(t => 1e4 * (1 + r) ** t), name: `Interesse composto ${pct(r, 1)}`, type: "scatter", line: { color: C.gold, width: 2.4 } }, { x: yy, y: yy.map(t => 1e4 * (1 + r * t)), name: "Interesse semplice", type: "scatter", line: { color: "#888" } }], { title: T("10.000 nel tempo"), xaxis: { title: "Anni" }, yaxis: { gridcolor: C.grid } });
  const cpp = growth("CASHPP", "USD", "1988-01"); lines(ch[5][1], [cpp && { ...cpp, n: "100 $ in contante: potere d'acquisto", c: C.red }, cash && { ...growth("CASH", "USD", "1988-01", true), n: "T-Bill (reale)", c: "#999" }, { ...growth("US", "USD", "1988-01", true), n: "S&P 500 TR (reale)" }], "Valori in termini reali (al netto dell'inflazione USA)", { log: true });
}

/* ---------- Essere soci dell'economia reale ---------- */
function renderSoci() {
  const o = $("#sociOut"); const ch = Array.from({ length: 4 }, () => div());
  const spP = growth("SPP", "USD", "1928-01"), cpiL = (() => { const m = cpiMap("USD"); const ks = [...m.keys()].filter(k => k >= "1928-01").sort(); return { x: ks, y: ks.map(k => m.get(k) / m.get(ks[0]) * 100), n: "Prezzi al consumo USA (CPI)" }; })();
  const spTR = growth("US", "USD", "1988-01"), spPr = growth("SPP", "USD", "1988-01"), mwN = growth("WORLDI", "USD", "2001-01"), mwP = growth("MWP", "USD", "2001-01");
  const real = growth("US", "USD", "1988-01", true), bR = growth("UST", "USD", "1988-01", true), cR = growth("CASH", "USD", "1988-01", true), mwE = growth("WORLDI", "EUR", "2001-01", true), cE = growth("CASHPP", "EUR", "2001-01");
  const divShare = 1 - Math.log(spPr.y[spPr.y.length - 1] / 100) / Math.log(spTR.y[spTR.y.length - 1] / 100);
  pageShell(o, "soci", "Essere soci dell'economia reale", "Essere soci dell'economia reale", "Soci_economia_reale", `
  <div class="answer">Comprare un indice globale come l'MSCI World significa diventare <b>comproprietari di oltre mille aziende reali</b> – che producono, vendono, innovano e distribuiscono utili – in decine di Paesi e settori. Non è una scommessa su un titolo: è partecipare, in piccola parte, ai profitti e alla crescita dell'economia mondiale nel tempo, accettando che nel breve periodo il valore oscilli anche molto.</div>
  <div class="kpis">${kp2("Aziende nell'MSCI World", "1.249")}${kp2("Paesi sviluppati", "23")}${kp2("Copertura capitalizzazione", "~85%")}${kp2("Peso USA", "72,9%")}</div>
  ${table(["Settore (MSCI World)", "Peso", "Paese", "Peso"], [["Tecnologia", "31,8%", "Stati Uniti", "72,9%"], ["Finanziari", "15,7%", "Giappone", "5,9%"], ["Industriali", "10,8%", "Regno Unito", "3,4%"], ["Salute", "9,2%", "Canada", "3,3%"], ["Beni voluttuari", "8,4%", "Francia", "2,2%"], ["Comunicazioni", "8,3%", "Altri", "12,2%"]])}
  <p class="note">Fonte: MSCI World Index factsheet (MSCI Inc., dati al 30/09/2026). Composizione e pesi cambiano nel tempo; la forte concentrazione sugli USA e sulla tecnologia è un rischio da conoscere.</p>
  <h3>1 dollaro investito nel tempo</h3><div class="answer">Dal 1928 l'S&P 500 – anche senza contare i dividendi – è cresciuto di ${num(spP.y[spP.y.length - 1] / 100, 0)} volte, contro un aumento dei prezzi al consumo di ${num(cpiL.y[cpiL.y.length - 1] / 100, 1)} volte. In mezzo: la Grande Depressione, guerre, crisi petrolifere, bolle e pandemie.</div>${ch[0][0]}
  <h3>Il ruolo dei dividendi</h3><div class="answer">Gli utili distribuiti e reinvestiti contano: dal 1988 100 $ nell'S&P 500 sono diventati ${num(spTR.y[spTR.y.length - 1], 0)} con i dividendi reinvestiti contro ${num(spPr.y[spPr.y.length - 1], 0)} col solo prezzo (circa il ${pct(divShare, 0)} della crescita in scala logaritmica viene dai dividendi). MSCI World dal 2001: ${num(mwN.y[mwN.y.length - 1], 0)} (netto dividendi) vs ${num(mwP.y[mwP.y.length - 1], 0)} (prezzo).</div>${ch[1][0]}
  <h3>Azioni vs obbligazioni vs liquidità, al netto dell'inflazione</h3><div class="answer">In termini reali (potere d'acquisto) dal 1988: azioni USA ${pct(cagrOf(real), 1)} annuo, Treasury 10 anni ${pct(cagrOf(bR), 1)}, T-Bill ${pct(cagrOf(cR), 1)}. In EUR dal 2001 l'MSCI World ha reso ${pct(cagrOf(mwE), 1)} annuo reale, mentre il contante a 0% ha perso il ${pct(1 - cE.y[cE.y.length - 1] / 100, 0)} del suo potere d'acquisto. Attenzione: ci sono stati lunghi periodi (es. 2000–2012) in cui le azioni hanno reso meno delle obbligazioni o della liquidità.</div>${ch[2][0]}${ch[3][0]}
  <p class="note">Dati reali: S&P 500 prezzo dal 1928 e Total Return dal 1988 (Yahoo), MSCI World Net TR e prezzo (msci.com), CPI USA (FRED CPIAUCNS), CPI Italia (OCSE/ISTAT via FRED). Gli indici non includono costi. Il passato non garantisce il futuro.</p>`);
  lines(ch[0][1], [{ ...spP, n: "S&P 500 (solo prezzo)" }, { ...cpiL, c: C.red }], "1 $ = 100 nel 1928 (scala log)", { log: true });
  lines(ch[1][1], [{ ...spTR, n: "S&P 500 con dividendi" }, { ...spPr, n: "S&P 500 solo prezzo", c: "#999" }, { ...mwN, n: "MSCI World con dividendi (netti)", c: C.blue }, { ...mwP, n: "MSCI World solo prezzo", c: C.blue, dash: "dot" }], "Total return vs solo prezzo (scala log)", { log: true });
  lines(ch[2][1], [{ ...real, n: "Azioni USA (reale)" }, { ...bR, n: "Treasury 10a (reale)", c: C.blue }, { ...cR, n: "T-Bill (reale)", c: "#999" }], "USD, 100 = 1988, al netto dell'inflazione (scala log)", { log: true });
  lines(ch[3][1], [{ ...mwE, n: "MSCI World in EUR (reale)" }, { ...cE, n: "Contante EUR (potere d'acquisto)", c: C.red }], "EUR, 100 = 2001, al netto dell'inflazione italiana");
}

/* ---------- Inflazione e contante ---------- */
function renderInfl() {
  const o = $("#inflOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const ch = [div("chart tall"), div(), div()]; o._ch = ch.map(c => c[1]);
    pageShell(o, "infl", "Inflazione e contante: il potere d'acquisto", "Inflazione e potere d'acquisto del contante", "Inflazione_contante", `
    <div class="form"><label>Valuta <select id="inCcy"><option value="EUR">EUR (inflazione Italia)</option><option value="USD">USD (inflazione USA)</option></select></label><label>Dal anno <input id="inFrom" type="number" value="2001" min="1914" style="width:80px"></label><button id="inGo" class="primary">Aggiorna</button></div>
    <div id="inTxt"></div>${ch[0][0]}<h3>Quanti anni servono perché il contante perda il 25% / 50% del potere d'acquisto?</h3><div id="inYrs"></div>${ch[1][0]}
    <h3>Quando l'investimento ha fatto peggio del contante (in termini reali)</h3><div id="inBad"></div>${ch[2][0]}
    <p class="note">Contante = 0% nominale deflazionato con l'indice dei prezzi. EUR: CPI Italia (OCSE/ISTAT NIC via FRED ITACPIALLMINMEI, prolungato con HICP Italia); USD: CPI USA (FRED CPIAUCNS). Liquidità remunerata: XEON (€STR, dal 2008) in EUR, T-Bill 3 mesi in USD. BTP 10 anni ricostruito dai rendimenti OCSE. Verifica: CPI Italia dic-2022 +11,6% (ISTAT 11,6%).</p>`);
    ["#inCcy"].forEach(s => $(s).onchange = renderInfl); $("#inGo").onclick = renderInfl; }
  const ccy = $("#inCcy").value, f0 = (+$("#inFrom").value || 2001), from = `${f0}-01`, [i1, i2, i3] = o._ch;
  const cash = growth("CASHPP", ccy, from), eq = growth(ccy === "EUR" ? "WORLDI" : "US", ccy, from, true), eqP = !eq ? growth("SPP", ccy, from, true) : null;
  const mm = ccy === "EUR" ? [growth("XEON", "EUR", from, true), growth("BTP", "EUR", from, true)] : [growth("CASH", "USD", from, true), growth("UST", "USD", from, true)];
  const CP = cpiMap(ccy); const ks = [...CP.keys()].filter(k => k >= from).sort(); const prices = ks.length ? { x: ks, y: ks.map(k => CP.get(k) / CP.get(ks[0]) * 100), n: "Livello dei prezzi" } : null;
  const onCash = g => { if (!g || !cash || g.x[0] <= cash.x[0]) return g; const i = cash.x.indexOf(g.x[0]); if (i < 0) return g; const f = cash.y[i] / 100; return { ...g, y: g.y.map(v => v * f), n: g.n + " – parte dal valore del contante in quella data" }; };
  mm.forEach((g, k) => { mm[k] = onCash(g); });
  if (!cash) { $("#inTxt").innerHTML = `<p class="warn">Dati non disponibili dal ${f0} (${ccy}).</p>`; return; }
  const E = eq || eqP; const lastC = cash.y[cash.y.length - 1];
  $("#inTxt").innerHTML = `<div class="answer">100 ${ccy === "EUR" ? "euro" : "dollari"} tenuti in contante dal ${cash.x[0]} oggi comprano quanto <b>${num(lastC, 1)}</b> di allora: i prezzi sono saliti del ${pct(prices.y[prices.y.length - 1] / 100 - 1, 0)}. Nello stesso periodo, in termini reali: ${mm.filter(Boolean).map(g => `${g.n.split(" – ")[0]} ${pct((g.y[g.y.length - 1] / g.y[0]) ** (12 / (g.x.length - 1)) - 1, 1)} annuo${g.x[0] > cash.x[0] ? ` (dal ${g.x[0]})` : ""}`).join(", ")}${E ? `, ${E.n} ${pct(cagrOf(E), 1)} annuo` : ""}.</div>`;
  lines(i1, [{ ...cash, n: "Contante: potere d'acquisto", c: C.red }, { ...prices, c: "#999", dash: "dot" }, ...mm.filter(Boolean).map((g, k) => ({ ...g, n: g.n + " (reale)", c: [C.blue, C.green][k] })), E && { ...E, n: E.n + " (reale)", c: C.gold }], `${ccy}: 100 = ${cash.x[0]}, valori al netto dell'inflazione (scala log)`, { log: true });
  // anni per perdere il 25%/50% (tutta la storia disponibile)
  const all = [...CP.keys()].sort(), out = { 0.25: [], 0.5: [] };
  all.forEach((k, i) => { for (const L of [0.25, 0.5]) { for (let j = i + 1; j < all.length; j++) if (CP.get(k) / CP.get(all[j]) <= 1 - L) { out[L].push({ k, y: (j - i) / 12 }); break; } } });
  const k10 = all.length > 120 ? (CP.get(all[all.length - 1]) / CP.get(all[all.length - 121])) ** (1 / 10) - 1 : NaN;
  const row = L => { const a = out[L].map(x => x.y); if (!a.length) return [pct(L, 0), "–", "–", "–", "–"]; const mn = out[L].reduce((p, c) => c.y < p.y ? c : p); return [pct(L, 0), num(median(a), 1) + " anni", num(mn.y, 1) + ` anni (dal ${mn.k})`, num(Math.max(...a), 1) + " anni", num(Math.log(1 - L) / Math.log(1 / (1 + k10)), 1) + " anni"]; };
  $("#inYrs").innerHTML = table(["Perdita di potere d'acquisto", "Mediana storica", "Più veloce", "Più lento", `Al ritmo degli ultimi 10 anni (${pct(k10, 1)}/anno)`], [row(0.25), row(0.5)]) + `<p class="note">Calcolato per ogni mese di partenza dal ${all[0]} (${ccy === "EUR" ? "Italia" : "USA"}). Le partenze recenti che non hanno ancora raggiunto la soglia sono escluse.</p>`;
  plot(i2, [0.25, 0.5].map((L, k) => ({ x: out[L].map(x => x.k), y: out[L].map(x => x.y), name: `Anni per perdere il ${pct(L, 0)}`, type: "scatter", line: { color: [C.gold, C.red][k] } })), { title: T("Anni necessari per mese di partenza"), yaxis: { gridcolor: C.grid, title: "anni" } });
  // periodi in cui azioni (reali) hanno fatto peggio del contante: rendimento reale 10 anni < perdita del contante
  const EE = growth(ccy === "EUR" ? "WORLDI" : "SPP", ccy, "1900-01", true), C0 = growth("CASHPP", ccy, "1900-01");
  if (EE) { const mC = new Map(C0.x.map((k, i) => [k, C0.y[i]])), W = 120, bad = [], xs = [], ys = [], yc = [];
    for (let i = 0; i + W < EE.x.length; i++) { const k = EE.x[i], k2 = EE.x[i + W]; if (!mC.has(k) || !mC.has(k2)) continue; const re = EE.y[i + W] / EE.y[i] - 1, rc = mC.get(k2) / mC.get(k) - 1; xs.push(k); ys.push(re * 100); yc.push(rc * 100); if (re < rc) bad.push(k); }
    const grp = []; bad.forEach(k => { const g = grp[grp.length - 1]; if (g && xs.indexOf(k) - xs.indexOf(g[1]) === 1) g[1] = k; else grp.push([k, k]); });
    $("#inBad").innerHTML = `<div class="answer">Su ${xs.length} periodi di 10 anni (${EE.n}, in termini reali, ${ccy}), l'investimento ha fatto <b>peggio del contante sotto il materasso nel ${pct(bad.length / xs.length, 0)} dei casi</b>${grp.length ? ` – partenze ${grp.map(g => g[0] === g[1] ? g[0] : g[0] + "→" + g[1]).join(", ")}` : ""}. Restare in contante però ha sempre perso potere d'acquisto quando l'inflazione era positiva. Per l'EUR la storia comune parte dal 2001 (indice MSCI Net TR), quindi i periodi sono pochi.</div>`;
    plot(i3, [{ x: xs, y: ys, name: "Azioni: rendimento reale a 10 anni", type: "scatter", line: { color: C.gold } }, { x: xs, y: yc, name: "Contante: variazione reale a 10 anni", type: "scatter", line: { color: C.red } }], { title: T("Rendimento reale cumulato a 10 anni, per mese di partenza"), yaxis: { ticksuffix: "%", gridcolor: C.grid } }); }
}

/* ---------- Crisi storiche ---------- */
const CRISI = [["1929", "Crollo del 1929 e Grande Depressione", "1929-09-01", "1932-07-31", "^GSPC"], ["1973", "Shock petrolifero 1973–74", "1973-01-01", "1974-12-31", "^GSPC"], ["1987", "Lunedì nero 1987", "1987-08-01", "1987-12-31", "^GSPC"], ["2000", "Bolla dot-com 2000–2002", "2000-03-01", "2002-10-31", "^SP500TR"], ["2008", "Crisi finanziaria 2008", "2007-10-01", "2009-03-31", "^SP500TR"], ["2020", "Pandemia Covid 2020", "2020-02-01", "2020-03-31", "^SP500TR"], ["2022", "Inflazione e rialzo dei tassi 2022", "2022-01-01", "2022-10-31", "^SP500TR"]];
function renderCrisi() {
  const o = $("#crisiOut"); if (!o.dataset.ok) { o.dataset.ok = 1; const ch = [div("chart tall"), div()]; o._ch = ch.map(c => c[1]);
    pageShell(o, "crisi", "Le grandi crisi: cosa è successo a chi è rimasto investito", "Le grandi crisi di mercato", "Crisi_storiche", `<div class="form"><label>Crisi <select id="crSel">${CRISI.map(c => `<option value="${c[0]}">${c[1]}</option>`).join("")}</select></label><label>Rata PAC mensile <input id="crPac" type="number" value="500"></label></div><div id="crsTxt"></div>${ch[0][0]}${ch[1][0]}<h3>Tutte le crisi a confronto</h3><div id="crAll"></div>
    <p class="note">S&P 500 solo prezzo (Yahoo ^GSPC, giornaliero dal 1928) per le crisi prima del 1988, Total Return (^SP500TR, dividendi reinvestiti) dopo. Picco = massimo precedente al minimo nella finestra della crisi. Valori in USD nominali, senza costi né tasse.</p>`);
    $("#crSel").onchange = renderCrisi; $("#crPac").onchange = renderCrisi; }
  const info = c => { const F = FULL[c[4]]; const a = lb(F.d, c[2]), b = lb(F.d, c[3] + "~") - 1; let pk = 0; for (let i = 0; i <= b; i++) if (F.c[i] > F.c[pk]) pk = i; // massimo storico prima del minimo
    let t = a; for (let i = a; i <= b; i++) if (F.c[i] < F.c[t]) t = i; pk = 0; for (let i = 0; i <= t; i++) if (F.c[i] >= F.c[pk]) pk = i;
    let r = null; for (let i = t; i < F.d.length; i++) if (F.c[i] >= F.c[pk]) { r = i; break; }
    const yAfter = h => { const j = lb(F.d, (+F.d[pk].slice(0, 4) + h) + F.d[pk].slice(4)); return j < F.d.length ? F.c[j] / F.c[pk] - 1 : NaN; };
    return { F, pk, t, r, dd: F.c[t] / F.c[pk] - 1, y5: yAfter(5), y10: yAfter(10) }; };
  const c = CRISI.find(x => x[0] === $("#crSel").value), I = info(c), F = I.F, pac = +$("#crPac").value || 500;
  const endI = Math.min(F.d.length - 1, (I.r || I.t) + 252 * 3); let units = 0, cum = 0; const xs = [], vv = [], cc = [];
  for (let i = I.pk; i <= endI; i++) { if (i === I.pk || F.d[i].slice(5, 7) !== F.d[i - 1].slice(5, 7)) { units += pac / F.c[i]; cum += pac; } if (i % 5 === 0 || i === endI) { xs.push(F.d[i]); vv.push(units * F.c[i]); cc.push(cum); } }
  const yrs2 = (a, b) => (Date.parse(F.d[b]) - Date.parse(F.d[a])) / 3.156e10;
  let pr = null; { let u = 0, s = 0; for (let i = I.pk; i < F.d.length; i++) { if (i === I.pk || F.d[i].slice(5, 7) !== F.d[i - 1].slice(5, 7)) { u += pac / F.c[i]; s += pac; } if (i > I.t && u * F.c[i] >= s) { pr = i; break; } } }
  $("#crsTxt").innerHTML = `<div class="kpis">${kp2("Calo massimo", pct(I.dd))}${kp2("Dal picco al minimo", num(yrs2(I.pk, I.t) * 12, 0) + " mesi")}${kp2("Ritorno ai massimi", I.r ? num(yrs2(I.pk, I.r), 1) + " anni" : "non ancora")}${kp2("PAC tornato in utile", pr ? num(yrs2(I.pk, pr), 1) + " anni dopo il picco" : "–")}</div>
  <div class="answer"><b>${c[1]}</b> (${F === FULL["^GSPC"] ? "S&P 500 prezzo" : "S&P 500 Total Return"}): dal massimo del ${fmtD(F.d[I.pk])} al minimo del ${fmtD(F.d[I.t])} l'indice ha perso il ${pct(-I.dd, 1)}. ${I.r ? `Chi ha comprato proprio sul massimo ed è rimasto investito è tornato in pari il ${fmtD(F.d[I.r])}, dopo ${num(yrs2(I.pk, I.r), 1)} anni.` : "I massimi precedenti non sono ancora stati recuperati."} Chi ha continuato un PAC da ${num(pac, 0)} $/mese dal picco è tornato in utile ${pr ? `dopo ${num(yrs2(I.pk, pr), 1)} anni (${fmtD(F.d[pr])})` : "–"}, molto prima di chi aveva investito tutto sul massimo, perché ha comprato a prezzi bassi durante il crollo. A 10 anni dal picco l'indice era ${isNaN(I.y10) ? "– (non ancora 10 anni)" : pct(I.y10)}.</div>`;
  const [i1, i2] = o._ch, a0 = Math.max(0, I.pk - 60);
  plot(i1, [{ x: F.d.slice(a0, endI + 1).filter((_, i) => i % 3 === 0), y: F.c.slice(a0, endI + 1).filter((_, i) => i % 3 === 0).map(v => v / F.c[I.pk] * 100), name: "Indice (100 = picco)", type: "scatter", line: { color: C.gold } }], { title: T("Indice: 100 = massimo prima della crisi"), yaxis: { gridcolor: C.grid }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 100, y1: 100, line: { color: "#888", dash: "dot" } }] });
  plot(i2, [{ x: xs, y: cc, name: "Versato", type: "scatter", line: { color: "#888", shape: "hv" } }, { x: xs, y: vv, name: "Valore del PAC", type: "scatter", line: { color: C.green, width: 2 } }], { title: T(`PAC di ${num(pac, 0)} $/mese iniziato sul massimo`), yaxis: { gridcolor: C.grid } });
  $("#crAll").innerHTML = table(["Crisi", "Picco", "Minimo", "Calo", "Mesi di discesa", "Anni per tornare ai massimi", "Dopo 5 anni dal picco", "Dopo 10 anni dal picco"], CRISI.map(c2 => { const J = info(c2); return [c2[1], fmtD(J.F.d[J.pk]), fmtD(J.F.d[J.t]), pc(J.dd), num((Date.parse(J.F.d[J.t]) - Date.parse(J.F.d[J.pk])) / 2.63e9, 0), J.r ? num((Date.parse(J.F.d[J.r]) - Date.parse(J.F.d[J.pk])) / 3.156e10, 1) : "non ancora", pc(J.y5), pc(J.y10)]; }));
}
