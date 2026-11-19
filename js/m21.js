"use strict";
/* ===== v5: «E se vendo ai massimi e ricompro dopo un calo?» – seconda parte della sezione «Investo subito o aspetto un calo?» ===== */
const ATH_X = [5, 10, 15, 20, 25];
window.__athX = window.__athX || 10;
function athSim(d, c, X, cashR, i0, i1, cap) {
  // parte investito; vende a ogni nuovo massimo storico (chiusura sopra tutti i precedenti); ricompra quando l'indice è X% sotto il massimo
  let inv = true, sh = cap / c[i0], cash = 0, mx = c[i0], outDays = 0, trades = 0, sellP = 0, sellI = 0; const eq = [], eps = [];
  for (let i = i0; i <= i1; i++) {
    if (!inv && i > i0) cash *= 1 + (cashR.get(d[i].slice(0, 7)) || 0) / 21;
    const p = c[i], newHigh = p > mx; if (newHigh) mx = p;
    if (inv && newHigh && i > i0) { cash = sh * p; sh = 0; inv = false; trades++; sellP = p; sellI = i; }
    else if (!inv && p <= mx * (1 - X / 100)) { sh = cash / p; cash = 0; inv = true; trades++; eps.push({ s: d[sellI], b: d[i], days: i - sellI, chg: p / sellP - 1 }); }
    if (!inv) outDays++;
    eq.push(inv ? sh * p : cash);
  }
  const open = !inv ? { s: d[sellI], chg: c[i1] / sellP - 1, days: i1 - sellI } : null;
  return { eq, outDays, trades, eps, open, out: !inv };
}
function renderAth() {
  const o = $("#athOut"); if (!o) return; if (o.dataset.ok) return runAth(); o.dataset.ok = 1;
  const [c1, i1] = div("chart");
  const yrs = Array.from({ length: 2025 - 1988 + 1 }, (_, i) => 2025 - i).map(y => `<option value="${y}" ${y === 2000 ? "selected" : ""}>${y}</option>`).join("");
  o.innerHTML = `<div class="card lump pdfbreak"><h2>E se vendo ai massimi e ricompro dopo un calo?</h2>
  <p class="lead">L'idea: «la Borsa è ai massimi, vendo tutto e ricompro quando scende». La proviamo in automatico sull'S&amp;P 500 con dividendi reinvestiti: si vende a ogni nuovo massimo storico e si ricompra quando l'indice è sceso della percentuale scelta.</p>
  <div class="form lumpform"><label>Anno di partenza <select id="athY0">${yrs}</select></label>
   <span class="lumpx">Ricompro dopo un calo del <span class="chips">${ATH_X.map(x => `<button class="chip${x === window.__athX ? " on" : ""}" data-athx="${x}">−${x}%</button>`).join("")}</span></span></div>
  <details class="more nopdf"><summary>Altre impostazioni</summary><div class="form">
   <label>Valuta <select id="athCcy"><option value="EUR">EUR (dal 1999)</option><option value="USD">USD (dal 1988)</option></select></label>
   <label>Capitale iniziale <input id="athCap" type="number" value="10000" min="1"></label>
   <label title="Mentre si è fuori dal mercato i soldi restano liquidi.">Liquidità mentre si è fuori <select id="athCash"><option value="r">rende il tasso monetario</option><option value="0">0%</option></select></label>
   <label class="chk"><input type="checkbox" id="athLog"> Scala logaritmica</label></div></details>
  <div id="athRes"></div>${c1}<div id="athNote"></div>
  <details class="more"><summary>Dettagli: tutte le soglie a confronto e come funziona</summary><div id="athTab"></div></details></div>`;
  o._ch = i1;
  ["#athCcy", "#athY0", "#athCash", "#athLog", "#athCap"].forEach(s => $(s).onchange = runAth);
  o.querySelectorAll("[data-athx]").forEach(b => b.onclick = () => { window.__athX = +b.dataset.athx; o.querySelectorAll("[data-athx]").forEach(x => x.classList.toggle("on", x === b)); runAth(); });
  runAth();
}
function runAth() {
  const ccy = $("#athCcy").value, S = idxSeries("SP", "TR", ccy); if (!S) return;
  const y0 = $("#athY0").value, cap = +$("#athCap").value || 10000, X = window.__athX;
  const i0 = lb(S.d, y0), i1 = S.d.length - 1;
  if (i1 - i0 < 250) { $("#athRes").innerHTML = `<p class="warn">Periodo troppo breve (serve almeno un anno di dati).</p>`; return; }
  const cashR = cashMonthly(ccy, $("#athCash").value), yrs = (i1 - i0) / 252, eur = v => `${num(v, 0)} ${ccy === "EUR" ? "€" : "$"}`;
  const notice = S.d[i0].slice(0, 4) > y0 ? `<p class="warn">⚠️ ${S.name} in ${ccy} parte dal ${fmtD(S.d[0])}: l'analisi parte da lì.${ccy === "EUR" ? " Per una storia più lunga scegli USD in «Altre impostazioni»." : ""}</p>` : "";
  const bh = S.c.slice(i0, i1 + 1).map(p => cap * p / S.c[i0]), fin = bh[bh.length - 1];
  const all = ATH_X.map(x => ({ x, ...athSim(S.d, S.c, x, cashR, i0, i1, cap) })), r = all.find(z => z.x === X), f = r.eq[r.eq.length - 1];
  const cagr = v => (v / cap) ** (1 / yrs) - 1, won = fin >= f, dear = r.eps.filter(e => e.chg > 0).length, outY = r.outDays / 252;
  window.__athLast = `Vendo ai massimi: ${S.name} ${ccy} dal ${fmtD(S.d[i0])}, ricompro a −${X}%`;
  const verdict = won ? `Restare investiti ha vinto: <b>${eur(fin)}</b> contro <b>${eur(f)}</b> vendendo ai massimi e ricomprando a −${X}% (${pct(1 - f / fin, 0)} in meno).`
    : `In questo periodo vendere ai massimi e ricomprare a −${X}% ha dato di più: <b>${eur(f)}</b> contro <b>${eur(fin)}</b> restando investiti (+${pct(f / fin - 1, 0)}). È un caso raro: cambia anno o soglia per vedere quanto dipende dal periodo.`;
  const beat = all.filter(z => z.eq[z.eq.length - 1] > fin).length;
  $("#athRes").innerHTML = `${notice}<div class="lumpwin ${won ? "now" : "wait"}"><div class="big">${won ? "Meglio restare investiti" : "Meglio vendere ai massimi (in questo periodo)"}</div><div class="sub">${verdict}</div></div>
   <div class="lumpkpi"><div class="kpi gold"><span>Sempre investito</span><b>${eur(fin)}</b></div><div class="kpi blue"><span>Vendo ai massimi, ricompro a −${X}%</span><b>${eur(f)}</b></div><div class="kpi"><span>Anni passati fuori dal mercato</span><b>${num(outY, 1)} su ${num(yrs, 0)}</b></div></div>
   <div class="answer">Dal ${fmtD(S.d[i0])} la strategia è rimasta fuori dal mercato ${num(outY, 1)} anni su ${num(yrs, 0)} (${pct(r.outDays / (i1 - i0 + 1), 0)} del tempo) e ha ricomprato ${r.eps.length} ${r.eps.length === 1 ? "volta" : "volte"}${r.eps.length ? `, di cui ${dear} a un prezzo più alto di quello di vendita` : ""}.${r.open ? ` Oggi è ancora fuori: ha venduto il ${fmtD(r.open.s)} e da allora l'indice ha fatto ${r.open.chg >= 0 ? "+" : ""}${pct(r.open.chg, 0)} aspettando il calo.` : ""} Su ${ATH_X.length} soglie provate, ${beat ? `${beat} ${beat === 1 ? "ha" : "hanno"} battuto` : "nessuna ha battuto"} il restare investiti in questo periodo.</div>`;
  $("#athNote").innerHTML = `<p class="note">${S.name}, giornaliero, ${ccy}, fino al ${fmtD(S.d[i1])}. Fonte: ${S.src}. Liquidità mentre si è fuori: ${$("#athCash").value === "0" ? "0%" : (ccy === "USD" ? "T-Bill USA 3 mesi" : "tasso BCE sui depositi")}. Nessun costo, imposta o ritardo di esecuzione (nella realtà renderebbe ancora meno).</p>`;
  const rows = [[`<b>Resto sempre investito</b>`, `<b>${eur(fin)}</b>`, pc(cagr(fin), 2), "0,0", "–", "–", "–"],
    ...all.map(z => { const v = z.eq[z.eq.length - 1]; return [`Ricompro a −${z.x}%${z.x === X ? " ◀" : ""}`, eur(v), pc(cagr(v), 2), num(z.outDays / 252, 1), String(z.eps.length), `${z.eps.filter(e => e.chg > 0).length} su ${z.eps.length}`, z.open ? `<span class="neg">sì, dal ${fmtD(z.open.s)} (indice ${z.open.chg >= 0 ? "+" : ""}${pct(z.open.chg, 0)})</span>` : "no"]; })];
  $("#athTab").innerHTML = `${table(["Strategia", "Capitale finale", "Rendimento annuo", "Anni fuori", "Riacquisti", "Ricomprato più caro del venduto", "Oggi ancora fuori?"], rows)}
   <ol class="steps"><li><b>Si parte investiti</b> nell'S&amp;P 500.</li><li><b>A ogni nuovo massimo storico</b> si vende tutto e si resta in liquidità.</li><li><b>Si ricompra</b> quando l'indice scende della percentuale scelta sotto il massimo. Se il mercato continua a salire, il massimo si alza e si resta fuori.</li><li>Al massimo successivo si vende di nuovo, e così via.</li></ol>
   <p class="note">«Ricomprato più caro»: il calo è arrivato, ma dopo una salita tale che il prezzo di riacquisto era comunque sopra quello di vendita.</p>`;
  plot(o_ch(), [{ x: S.d.slice(i0, i1 + 1), y: bh, name: "Sempre investito", line: { color: C.gold, width: 2.5 } }, { x: S.d.slice(i0, i1 + 1), y: r.eq, name: `Vendo ai massimi, ricompro a −${X}%`, line: { color: C.blue, width: 1.6 } }],
    { title: T(`Capitale da ${eur(cap)}`), yaxis: { type: $("#athLog").checked ? "log" : "linear", gridcolor: C.grid }, hoverlabel: { bgcolor: "#000", font: { size: 15 } } });
}
const o_ch = () => $("#athOut")._ch;
// la vecchia scheda «Vendo ai massimi» è ora dentro «Investo subito o aspetto un calo?»
{ const _s = showTab; showTab = id => _s(id === "ath" ? "timing" : id); }
