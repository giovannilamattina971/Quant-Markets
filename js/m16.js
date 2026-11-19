"use strict";
/* ===== v6: «Investo subito o aspetto un calo?» – versamento unico, spiegato per chi inizia ===== */
// Regola: aspetto che l'indice scenda di X% sotto il livello del giorno del versamento (opzione: sotto il massimo storico)
function lumpSim(S, i0, i1, amt, X, rule, cashR) {
  let ath = 0; for (let i = 0; i <= i0; i++) ath = Math.max(ath, S.c[i]);
  const ref = rule === "ath" ? ath : S.c[i0], target = ref * (1 - X);
  const now = [], wait = []; let cash = amt, sh = 0, iBuy = -1;
  for (let i = i0; i <= i1; i++) {
    if (i > i0 && iBuy < 0 && S.d[i].slice(0, 7) !== S.d[i - 1].slice(0, 7)) cash *= 1 + (cashR.get(S.d[i - 1].slice(0, 7)) || 0);
    if (iBuy < 0 && S.c[i] <= target) { sh = cash / S.c[i]; cash = 0; iBuy = i; }
    now.push(amt * S.c[i] / S.c[i0]); wait.push(iBuy >= 0 ? sh * S.c[i] : cash);
  }
  const mBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  return { now, wait, fNow: now[now.length - 1], fWait: wait[wait.length - 1], came: iBuy >= 0, dBuy: iBuy >= 0 ? S.d[iBuy] : null, months: mBetween(S.d[i0], iBuy >= 0 ? S.d[iBuy] : S.d[i1]), pBuyVsStart: iBuy >= 0 ? S.c[iBuy] / S.c[i0] - 1 : null, ref, target, d: S.d.slice(i0, i1 + 1) };
}
function lumpHtml() {
  const [c1, i1] = div("chart"), [c2, i2] = div("chart");
  const yrs = Array.from({ length: 2026 - 1928 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === 2000 ? "selected" : ""}>${y}</option>`).join("");
  return [`<div class="card lump"><h2>Ho dei soldi da investire: entro subito o aspetto un calo?</h2>
   <p class="lead">Molti pensano: «la Borsa è alta, aspetto che scenda un po' e poi compro». Qui lo verifichi sui dati veri: scegli quando avresti avuto i soldi e quanto calo avresti aspettato.</p>
   <div class="form lumpform"><label>Anno del versamento <select id="lpY">${yrs}</select></label>
    <label>Importo (€) <input id="lpAmt" type="number" min="100" step="1000" value="10000"></label>
    <span class="lumpx">Aspetto un calo del <span class="chips">${[5, 10, 15, 20, 25].map(x => `<button class="chip${x === 10 ? " on" : ""}" data-lpx="${x}">−${x}%</button>`).join("")}</span></span></div>
   <details class="more nopdf"><summary>Altre impostazioni</summary><div class="form">
    <label>Indice <select id="lpIdx">${idxOpts("SP")}</select></label><label>Valuta <select id="lpCcy"><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
    <label title="Massimo storico: una «correzione del 10%» è un calo del 10% dal record dell'indice, come la intendono giornali e operatori. Prezzo del versamento: si aspetta che scenda del 10% rispetto al giorno in cui si hanno i soldi; in quel caso, se il calo arriva si compra sempre a sconto, ma spesso non arriva mai.">Calo misurato da <select id="lpRule"><option value="ath">massimo storico (definizione classica di «correzione»)</option><option value="dep">prezzo del giorno del versamento</option></select></label>
    <label>Soldi in attesa <select id="lpCash"><option value="r">rendono il tasso monetario (BCE / T-Bill)</option><option value="0">fermi sul conto (0%)</option></select></label></div></details>
   <div id="lpHead"></div>${c1}<div id="lpFacts"></div></div>
  <div class="card"><h3>E se avessi iniziato in un altro anno?</h3><div id="lpAll"></div>${c2}<p class="note">Per ogni anno: versamento il primo giorno di Borsa dell'anno, risultato misurato all'ultimo dato disponibile. Barre oro = investire subito ha dato di più; barre blu = aspettare ha dato di più.</p></div>`, i1, i2];
}
function runLump() {
  const o = $("#timOut"); if (!o || !o._lp) return; const [i1, i2] = o._lp;
  const id = $("#lpIdx").value, ccy = $("#lpCcy").value, S = idxSeries(id, IDX[id].TR ? "TR" : "P", ccy); if (!S) return;
  const amt = Math.max(1, +$("#lpAmt").value || 10000), X = +(document.querySelector("[data-lpx].on") || { dataset: { lpx: 10 } }).dataset.lpx / 100, rule = $("#lpRule").value, cashR = cashMonthly(ccy, $("#lpCash").value);
  const cur = ccy === "EUR" ? "€" : "$", eur = v => `${num(v, 0)} ${cur}`, i1x = S.d.length - 1, y0r = +$("#lpY").value;
  let i0 = lb(S.d, `${y0r}-01-01`); const first = +S.d[0].slice(0, 4);
  const clampNote = i0 === 0 && y0r < first ? `<p class="warn">⚠️ Hai scelto il ${y0r}, ma ${S.name} in ${ccy} è disponibile dal ${fmtD(S.d[0])}: il calcolo parte da lì.</p>` : "";
  if (i0 >= i1x - 20) { $("#lpHead").innerHTML = `<p class="warn">Anno troppo recente: servono almeno alcune settimane di dati.</p>`; return; }
  const R = lumpSim(S, i0, i1x, amt, X, rule, cashR), diff = R.fNow - R.fWait, win = diff >= 0, yrs = R.months / 12, tie = R.came && R.dBuy === S.d[i0];
  const waitTxt = !R.came ? `Il calo del ${pct(X, 0)} <b>non è mai arrivato</b>: i soldi sono rimasti fuori dal mercato per tutti i ${num((i1x - i0) / (S.freq === "M" ? 12 : 252), 0)} anni.`
    : `Il calo del ${pct(X, 0)} è arrivato a <b>${fmtD(R.dBuy)}</b>, dopo <b>${R.months} mesi</b> di attesa${R.months >= 24 ? ` (circa ${num(yrs, 1)} anni)` : ""}.`;
  $("#lpHead").innerHTML = clampNote + `<div class="lumpwin ${win ? "now" : "wait"}"><div class="big">${tie ? "Pari: il calo c'era già" : win ? "Investire subito ha vinto" : "Questa volta aspettare ha vinto"}</div>
    <div class="sub">${tie ? `Il giorno del versamento l'indice era già almeno ${pct(X, 0)} sotto il massimo: chi aspettava ha comprato subito anche lui.` : win ? `+${eur(diff)} in più (${pct(R.fNow / R.fWait - 1, 0)} in più) rispetto ad aspettare il calo` : `+${eur(-diff)} in più (${pct(R.fWait / R.fNow - 1, 0)}) rispetto a investire subito`}</div></div>
   <div class="lumpkpi"><div class="kpi gold"><span>Investo subito</span><b>${eur(R.fNow)}</b></div><div class="kpi blue"><span>Aspetto un calo del ${pct(X, 0)}</span><b>${eur(R.fWait)}</b></div></div>
   <div class="answer">${amt === 10000 ? "10.000" : num(amt, 0)} ${cur} versati a ${fmtD(S.d[i0])}. ${waitTxt} ${R.came ? (R.pBuyVsStart > -X + 0.0001 ? "" : "") : ""}${win ? (R.came ? `Mentre si aspettava, il mercato è salito: il tempo passato fuori è costato più dello sconto ottenuto.` : `Chi ha aspettato ha visto il mercato salire senza parteciparvi.`) : `In questo caso il calo è arrivato presto ed è stato profondo, quindi comprare dopo ha pagato. Succede, ma guarda sotto quanto spesso.`}</div>`;
  $("#lpFacts").innerHTML = `<p class="note">${S.name}, ${ccy}, fino al ${fmtD(S.d[i1x])}. Regola: si compra il primo giorno in cui l'indice chiude almeno ${pct(X, 0)} sotto ${rule === "ath" ? "il suo massimo storico raggiunto fino al giorno del versamento" : "il livello del giorno del versamento"} (${num(R.ref, 0)} → soglia ${num(R.target, 0)}). Mentre aspettano, i soldi ${$("#lpCash").value === "0" ? "restano fermi a 0%" : `rendono il tasso monetario (${ccy === "EUR" ? "BCE depositi, dal 1999" : "T-Bill 3 mesi"})`}. Nessun costo o tassa. Fonte: ${S.src}.</p>`;
  plot(i1, [{ x: R.d, y: R.now, name: "Investo subito", type: "scatter", line: { color: C.gold, width: 2.6 }, hovertemplate: "%{y:,.0f} " + cur },
    { x: R.d, y: R.wait, name: `Aspetto un calo del ${pct(X, 0)}`, type: "scatter", line: { color: C.blue, width: 2 }, hovertemplate: "%{y:,.0f} " + cur }],
    { title: T(`Quanto valgono i tuoi ${num(amt, 0)} ${cur} nel tempo`), yaxis: { ticksuffix: " " + cur }, shapes: R.came ? [{ type: "line", x0: R.dBuy, x1: R.dBuy, yref: "paper", y0: 0, y1: 1, line: { color: "#888", dash: "dot" } }] : [],
      annotations: R.came ? [{ x: R.dBuy, yref: "paper", y: 1, text: "qui arriva il calo e si compra", showarrow: false, font: { color: "#bbb", size: 12 }, xanchor: "left" }] : [], hoverlabel: { bgcolor: "#000", font: { size: 15 } } });
  // tutti gli anni di partenza
  const rows = []; for (let y = first + (S.d[0].slice(5, 7) === "01" ? 0 : 1); y <= +S.d[i1x].slice(0, 4) - 1; y++) { const a = lb(S.d, `${y}-01-01`); const r = lumpSim(S, a, i1x, amt, X, rule, cashR); rows.push({ y, ...r }); }
  const nW = rows.filter(r => r.fNow > r.fWait + 0.5).length, nT = rows.filter(r => Math.abs(r.fNow - r.fWait) <= 0.5).length, never = rows.filter(r => !r.came).length, med = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  window.__lpRows = rows.map(r => ({ y: r.y, now: r.fNow, wait: r.fWait, came: r.came, months: r.months, dBuy: r.dBuy }));
  window.__timLast = `${S.name}, ${ccy}, versamento ${fmtD(S.d[i0])}, calo atteso ${pct(X, 0)}`;
  const L = rows.filter(r => r.fNow > r.fWait), Wn = rows.filter(r => r.fWait > r.fNow), avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const avgNow = avg(rows.map(r => r.fNow)), avgWait = avg(rows.map(r => r.fWait));
  $("#lpAll").innerHTML = rows.length ? `<div class="lumpwin now small"><div class="big">${rows.length - nW - nT <= nW ? `Aspettare un calo del ${pct(X, 0)} ha battuto investire subito solo in ${rows.length - nW - nT} anni su ${rows.length}` : `Aspettare ha vinto in ${rows.length - nW - nT} anni su ${rows.length}, ma in media investire subito ha dato ${pct(avgNow / avgWait - 1, 0)} in più`}</div>
    <div class="big2">Investire subito ha vinto in ${nW} anni${nT ? `, in ${nT} è finita pari (il calo c'era già il giorno del versamento)` : ""}.</div>
    <div class="sub">Attesa tipica prima del calo (mediana, quando è arrivato): ${med(rows.filter(r => r.came && r.months > 0).map(r => r.months)) ?? "–"} mesi${never ? ` · in ${never} anni il calo non è mai arrivato` : ""}.</div></div>
    <div class="lumpkpi"><div class="kpi gold"><span>In media, investendo subito</span><b>${eur(avgNow)}</b></div><div class="kpi blue"><span>In media, aspettando il calo</span><b>${eur(avgWait)}</b></div></div>
    <div class="answer">Quando aspettare è andato male, si è perso in media <b>${L.length ? pct(avg(L.map(r => 1 - r.fWait / r.fNow)), 0) : "–"}</b> del risultato; quando è andato bene, si è guadagnato in media ${Wn.length ? pct(avg(Wn.map(r => r.fWait / r.fNow - 1)), 0) : "–"} in più. ${rule === "dep" ? "Con questa regola, se il calo arriva si compra sempre a sconto: il vero rischio è che non arrivi mai e i soldi restino fuori mentre il mercato sale." : "Spesso il calo arriva quando il mercato è già salito oltre il prezzo del giorno del versamento: si compra «in sconto» rispetto al massimo, ma più caro di quanto si sarebbe pagato subito."}</div>` : "";
  plot(i2, [{ x: rows.map(r => String(r.y)), y: rows.map(r => (1 - r.fWait / r.fNow) * 100), type: "bar", marker: { color: rows.map(r => r.fNow >= r.fWait ? C.gold : C.blue) },
    customdata: rows.map(r => [eur(r.fNow), eur(r.fWait), r.came ? `calo arrivato dopo ${r.months} mesi` : "calo mai arrivato"]), hovertemplate: "<b>%{x}</b><br>Subito: %{customdata[0]}<br>Aspettando: %{customdata[1]}<br>%{customdata[2]}<extra></extra>" }],
    { title: T("Quanto si perdeva aspettando il calo (in % del risultato di chi ha investito subito)"), xaxis: { type: "category", tickangle: -60 }, yaxis: { ticksuffix: "%", title: { text: "sopra 0 = meglio subito" } }, showlegend: false, hovermode: "closest", hoverlabel: { bgcolor: "#000", font: { size: 15 } } });
}
