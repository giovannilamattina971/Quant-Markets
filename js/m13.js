"use strict";
/* ===== Tassi & Macro: Fed e BCE ===== */
const RT = (window.YIELDS && YIELDS._rates) || {};
function stepAt(ser, dstr) { const i = lb(ser.d, dstr + "~") - 1; return i >= 0 ? ser.v[i] : NaN; }
function rateEvents(changes) { // changes: [[data, livello, delta>0 rialzo / <0 taglio]]
  const ev = { firstCut: [], firstHike: [], pause: [] }; let lastCut = null, lastHike = null;
  changes.forEach((c, k) => { const t = Date.parse(c[0]);
    if (c[2] < 0) { if (lastCut == null || t - lastCut > 365 * DAY) ev.firstCut.push(c); lastCut = t; }
    if (c[2] > 0) { if (lastHike == null || t - lastHike > 365 * DAY) ev.firstHike.push(c); lastHike = t;
      const nx = changes.slice(k + 1).find(z => z[2] > 0); const nxt = changes[k + 1];
      if ((!nx || Date.parse(nx[0]) - t > 365 * DAY) && Date.now() - t > 180 * DAY) ev.pause.push([c[0], c[1], c[2], nxt && Date.parse(nxt[0]) - t < 365 * DAY && nxt[2] < 0 ? "seguita da taglio entro 1 anno" : ""]); } });
  return ev;
}
function ecbChanges() { const s = RT.ECBDFR; if (!s) return []; return s.d.slice(1).map((d, i) => [d, s.v[i + 1], +(s.v[i + 1] - s.v[i]).toFixed(3)]).filter(x => x[2] !== 0); }
function fedChanges() { const c = (MACRO.fedcuts || []).map(x => [x[0], x[1], -x[2]]), h = (MACRO.fedhikes || []).map(x => [x[0], x[1], x[2]]); return [...c, ...h].sort((a, b) => a[0] < b[0] ? -1 : 1); }
function renderMacro() {
  const S = st.S; if (S.key.startsWith("^VIX")) { $("#macroOut").innerHTML = `<div class="card"><p class="warn">Selezionare un indice azionario (il VIX non è un investimento).</p></div>`; return; }
  const [r1, ri1] = div("chart tall"), [e1, ei1] = div(), [g1, gi1] = div();
  const H = extraH([[63, "3 mesi"], [126, "6 mesi"], [252, "1 anno"], [504, "2 anni"]]);
  const evTab = (name, list) => { const rows = list.map(c => { const i = lb(S.d, c[0]); if (i <= 0 || i >= S.n) return null; return { c, i, f: H.map(([h]) => fwdD(S, i, h)) }; }).filter(Boolean); return { name, rows }; };
  const F = rateEvents(fedChanges()), E = rateEvents(ecbChanges());
  const groups = [evTab("Fed – primo taglio del ciclo", F.firstCut), evTab("Fed – primo rialzo del ciclo", F.firstHike), evTab("Fed – inizio pausa (ultimo rialzo del ciclo)", F.pause), evTab("BCE – primo taglio del ciclo", E.firstCut), evTab("BCE – primo rialzo del ciclo", E.firstHike), evTab("BCE – inizio pausa (ultimo rialzo)", E.pause)];
  const base = []; for (let i = 0; i + 252 < S.n; i++) if (!S.mask || S.mask[i]) base.push(S.c[i + 252] / S.c[i] - 1);
  // regimi di tasso mensili (variazione a 6 mesi)
  const reg = (ser, name) => { if (!ser) return null; const mm = monthly(S); const out = { up: [], down: [], flat: [] }, nx = { up: [], down: [], flat: [] };
    mm.forEach((m, k) => { const d = `${m.y}-${String(m.m).padStart(2, "0")}-28`, d6 = new Date(Date.parse(d) - 182 * DAY).toISOString().slice(0, 10); const a = stepAt(ser, d), b = stepAt(ser, d6); if (isNaN(a) || isNaN(b) || d6 < ser.d[0]) return;
      const g = a - b > 0.25 ? "up" : a - b < -0.25 ? "down" : "flat"; out[g].push(m.r); if (k + 12 < mm.length) nx[g].push(mm.slice(k + 1, k + 13).reduce((p, z) => p * (1 + z.r), 1) - 1); });
    return { name, out, nx }; };
  const RG = [reg(RT.FEDFUNDS && { d: RT.FEDFUNDS.d, v: RT.FEDFUNDS.v }, "Fed Funds (FEDFUNDS, dal 1954)"), reg(RT.ECBDFR, "BCE tasso sui depositi (ECBDFR, dal 1999)")].filter(Boolean);
  const NM = { up: "Tassi in salita (+0,25 pp in 6 mesi)", down: "Tassi in discesa (-0,25 pp)", flat: "Tassi stabili" };
  $("#macroOut").innerHTML = `${TB("macroOut", "tassi_macro")}
  <div class="card"><h3>Tassi delle banche centrali</h3>${r1}<p class="note">Fonti FRED: DFF (Fed Funds effettivo giornaliero, dal 1954), ECBDFR (BCE depositi) ed ECBMRRFR (BCE rifinanziamento principale), dal 1999. Le date degli eventi Fed usano l'obiettivo ufficiale (DFEDTAR/DFEDTARU, dal 1982).</p></div>
  <div class="card"><h3>Rendimento di ${S.name} dopo gli eventi di politica monetaria</h3>
   <div class="answer">Base: un giorno qualsiasi del periodo ha reso a 1 anno ${pc(STAT(base))} (${statLabel().toLowerCase()}). ${groups.map(g => { const a = g.rows.map(r => r.f[2]).filter(x => !isNaN(x)); return `<b>${g.name}</b>: ${a.length ? pc(STAT(a)) + ` a 1 anno, ${a.filter(x => x > 0).length}/${a.length} positivi` : "nessun caso"}${warnN(g.rows.length)}`; }).join(" · ")}. Campioni piccolissimi: ogni ciclo ha avuto cause diverse (inflazione, recessione, crisi finanziaria). Usare come contesto storico, non come regola.</div>
   ${e1}
   ${groups.map(g => `<h3>${g.name} (${g.rows.length})</h3>${g.rows.length ? table(["Data", "Tasso dopo", "Variazione", ...H.map(h => "Rend. " + h[1])], g.rows.map(r => [fmtD(r.c[0]), num(r.c[1], 2) + "%", (r.c[2] > 0 ? "+" : "") + num(r.c[2], 2), ...r.f.map(x => pc(x))])) : '<p class="muted">Nessun evento nel periodo selezionato.</p>'}`).join("")}
   <p class="note">Primo taglio/rialzo = primo movimento dopo oltre 12 mesi senza movimenti nella stessa direzione. Inizio pausa = ultimo rialzo non seguito da altri rialzi per 12 mesi.</p></div>
  <div class="card"><h3>Rendimenti per regime dei tassi</h3>${g1}
   ${RG.map(r => `<h3>${r.name}</h3>${table(["Regime", "Mesi", "Rend. medio mensile", "Annualizzato", "% mesi positivi", statLabel() + " 12 mesi successivi"], Object.keys(NM).map(k => [NM[k], r.out[k].length + warnN(r.out[k].length), pc(mean(r.out[k]), 2), pc((1 + mean(r.out[k])) ** 12 - 1), pct(fracPos(r.out[k]), 0), pc(STAT(r.nx[k]))]))}`).join("")}
   <p class="note">Regime definito dalla variazione del tasso negli ultimi 6 mesi (soglia ±0,25 punti). Rendimenti mensili dell'indice selezionato nel periodo selezionato.</p></div>`;
  const ln = (s, n, c, shape) => s && { x: s.d, y: s.v, name: n, type: "scatter", line: { color: c, width: 1.4, shape: shape || "hv" } };
  plot(ri1, [ln(RT.DFF, "Fed Funds effettivo", C.gold), ln(RT.ECBDFR, "BCE depositi", C.red), ln(RT.ECBMRRFR, "BCE rifinanziamento", C.blue)].filter(Boolean), { yaxis: { ticksuffix: "%", gridcolor: C.grid }, title: T("Tassi ufficiali (%)") });
  plot(ei1, groups.map((g, k) => ({ x: H.map(h => h[1]), y: H.map((_, j) => STAT(g.rows.map(r => r.f[j]).filter(x => !isNaN(x))) * 100), type: "bar", name: g.name, marker: { color: [C.green, C.red, C.gold, "#5fbf8f", "#e06070", "#e0c070"][k] } })), { title: T(`${statLabel()} del rendimento dopo gli eventi`), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest", legend: { orientation: "h", y: -0.2 }, margin: { l: 55, r: 20, t: 30, b: 110 } });
  plot(gi1, RG.map((r, k) => ({ x: Object.values(NM), y: Object.keys(NM).map(z => ((1 + mean(r.out[z])) ** 12 - 1) * 100), type: "bar", name: r.name, marker: { color: [C.gold, C.red][k] } })), { title: T("Rendimento annualizzato durante il regime"), barmode: "group", yaxis: { ticksuffix: "%", gridcolor: C.grid }, hovermode: "closest" });
}
/* ===== Volumi ===== */
FAQ.push(["volume", "Picchi di volume: cosa succede dopo giornate con volumi oltre 2× la media?"]);
ANS.volume = S => {
  const raw = MKT[(FULL[S.key] || {}).base || S.key.split("|")[0]];
  const vm = raw && raw.v ? new Map(raw.d.map((d, i) => [d, raw.v[i]])) : null;
  if (!vm) throw new Error("volumi non disponibili per questa serie (es. Total Return e VIX non hanno volumi)");
  const v = S.d.map(d => vm.get(d) || 0), avg = new Array(S.n).fill(NaN); let s = 0, cnt = 0;
  for (let i = 0; i < S.n; i++) { s += v[i]; cnt += v[i] > 0; if (i >= 50) { s -= v[i - 50]; cnt -= v[i - 50] > 0; } if (i >= 50 && cnt === 50) avg[i] = s / 50; }
  const ok = i => !isNaN(avg[i - 1]) && v[i] > 0, H = [[5, "1 sett."], [21, "1 mese"], [63, "3 mesi"], [252, "1 anno"]];
  const R = condStats(S, [["Base (giorni con volume)", i => ok(i), 1], ["Volume > 2× media 50g", i => ok(i) && v[i] > 2 * avg[i - 1], 10], ["Volume > 2× media e giornata in calo", i => ok(i) && v[i] > 2 * avg[i - 1] && S.r[i] < 0, 10], ["Volume > 2× media e giornata in rialzo", i => ok(i) && v[i] > 2 * avg[i - 1] && S.r[i] > 0, 10], ["Volume > 3× media 50g", i => ok(i) && v[i] > 3 * avg[i - 1], 10]], H);
  if (R[0].ev.length < 100) throw new Error("troppi pochi giorni con volume nel periodo");
  const [d1, i1] = div("chart tall"), first = S.d[v.findIndex(x => x > 0)];
  return {
    html: `<div class="answer">Volumi disponibili dal ${fmtD(first)} per questo indice. Dopo giornate con volume oltre il doppio della media a 50 giorni (${R[1].ev.length} casi distanziati ≥10 sedute) il rendimento a 1 anno è stato ${pc(R[1].st[3].m)} (${statLabel().toLowerCase()}), positivo nel ${pct(R[1].st[3].p, 0)}, contro ${pc(R[0].st[3].m)} di un giorno qualsiasi. I picchi di volume in calo spesso coincidono con fasi di capitolazione.</div>${d1}${condTable(R, H)}
    <p class="note">Avvertenze sui volumi: per gli indici Yahoo riporta il volume aggregato delle borse (per ^GSPC dal 1950; il dato è cresciuto strutturalmente nel tempo e ha discontinuità metodologiche, es. inclusione di più mercati dopo il 2000s). Per questo si confronta il volume con la sua media mobile recente, non in valore assoluto.</p>`,
    draw() { plot(i1, [{ x: S.d, y: S.c, type: "scatter", line: { color: C.gold, width: 1 }, name: S.name, yaxis: "y" }, { x: S.d, y: v, type: "bar", marker: { color: "#555" }, name: "Volume", yaxis: "y2" }, { x: R[1].ev.map(i => S.d[i]), y: R[1].ev.map(i => S.c[i]), mode: "markers", type: "scatter", marker: { color: C.red, size: 6 }, name: "Volume > 2× media" }], { yaxis: { type: "log", domain: [0.3, 1], gridcolor: C.grid }, yaxis2: { domain: [0, 0.25], gridcolor: C.grid }, title: T("Prezzo, picchi di volume e volume giornaliero"), hovermode: "closest" }); }
  };
};
KW.unshift(["volume", ["volume", "volumi", "scambi"]], ["__macro", ["bce", "ecb", "tassi ufficiali", "rialzo dei tassi", "politica monetaria"]]);
const _st4 = showTab; showTab = id => { _st4(id); if (id === "macro") renderMacro(); };
const _rf4 = refresh; refresh = function () { _rf4(); if (document.querySelector(".tab.on").id === "macro") renderMacro(); };
$("#faqBtns").innerHTML = FAQ.map(([k, t], i) => `<button data-k="${k}"><i>${i + 1}</i>${t}</button>`).join("");
/* default significativi all'apertura delle pagine */
const _st5 = showTab; showTab = id => { _st5(id); if (id === "bt" && !$("#pacOut").innerHTML) { runPac(); runStrat(); } if (id === "ask" && !$("#cbOut").innerHTML) { $("#cbCond").value = "ddLe"; $("#cbVal").value = 20; renderCustom(); } };
/* Info dati: asset class, tassi, volumi */
const _ri5 = renderInfo;
renderInfo = function () {
  _ri5(); const V = window.VERIF || {}, a = V.assets || {}; if (!a.IEF) return;
  const etf = Object.keys(AS).filter(k => AS[k].freq === "D").map(k => [AS[k].name, k, fmtD(AS[k].d[0]), fmtD(AS[k].d[AS[k].d.length - 1]), AS[k].cur, a[k] ? `${a[k].dup} dup., ${a[k].nonpos} prezzi ≤0, max var. giorn. ${num(a[k].max_abs_daily_pct, 1)}%` : ""]);
  const calc = Object.keys(AS).filter(k => AS[k].freq === "M").map(k => [AS[k].name, k, AS[k].d[0].slice(0, 7), AS[k].d[AS[k].d.length - 1].slice(0, 7), AS[k].cur, "mensile"]);
  const v = (o, ...k) => o ? k.map(x => num(o[x], x.includes("corr") ? 3 : 2)).join(" / ") : "–";
  $("#infoOut").insertAdjacentHTML("beforeend", `<div class="card"><h3>Altre asset class</h3>
   ${table(["Serie", "Codice", "Dal", "Al", "Valuta", "Controlli"], [...etf, ...calc])}
   <h3>Verifiche</h3>${table(["Controllo", "Risultato (correlazione mensile / rend. annuo A / rend. annuo B)", "Commento"], [
    ["Treasury 10 anni calcolato vs ETF IEF", v(a.UST10C_vs_IEF, "monthly_corr", "ann_ret_calc", "ann_ret_ief"), "Andamento quasi identico; il calcolato rende ~0,6%/anno meno di IEF (IEF beneficia del «roll-down» sulla curva; il metodo non lo include): stima prudente."],
    ["Treasury 2 anni calcolato vs ETF SHY", v(a.UST2C_vs_SHY, "monthly_corr", "ann_ret_calc", "ann_ret_shy"), "Scarto ~0,1%/anno."],
    ["Oro GLD vs future GC=F", v(a["GLD_vs_GC=F"], "monthly_corr", "ann_ret_gld", "ann_ret_gcf"), "Differenza ≈ commissioni dell'ETF (0,40%)."],
    ["MSCI World SWDA (convertito in USD) vs URTH", v(a.SWDA_usd_vs_URTH, "monthly_corr", "ann_ret_swda_usd", "ann_ret_urth"), "Due ETF diversi sullo stesso indice: coerenti."]])}
   ${a.XEON_vs_ECBDFR ? `<h3>XEON (liquidità EUR) vs tasso BCE sui depositi</h3>${table(["Anno", "Rendimento XEON", "Media ECBDFR"], a.XEON_vs_ECBDFR.map(r => [r[0], num(r[1], 2) + "%", num(r[2], 2) + "%"]))}<p class="muted">Il rendimento di XEON segue il tasso €STR (≈ depositi BCE − 0,085 pp) meno le commissioni: coerente.</p>` : ""}
   <p class="muted"><b>Metodo obbligazioni calcolate</b>: ogni mese si acquista un titolo a par con cedola pari al rendimento di fine mese precedente e lo si rivaluta al rendimento corrente (scadenza residua ridotta di 1 mese, cedole semestrali). È una ricostruzione accademica standard, non un indice ufficiale; il BTP usa il rendimento medio mensile OCSE (non di fine mese) ed è in EUR. MSCI EM / MSCI World come indici ufficiali non sono scaricabili gratuitamente: si usano ETF (storie più brevi). L'oro LBMA non è più disponibile su FRED: si usa l'ETF GLD verificato col future.</p></div>
   <div class="card"><h3>Tassi delle banche centrali e volumi</h3>
   ${table(["Serie FRED", "Dal", "Al"], ["DFF", "FEDFUNDS", "ECBDFR", "ECBMRRFR"].filter(k => a[k]).map(k => [k, fmtD(a[k].from), fmtD(a[k].to)]))}
   ${table(["Indice", "Volumi disponibili dal", "Giorni senza volume"], Object.entries(V.volume || {}).map(([k, o]) => [k, o.from ? fmtD(o.from) : "non disponibili", o.zero_days]))}
   <p class="muted">Volumi degli indici: dato aggregato fornito da Yahoo, con discontinuità metodologiche nel tempo; usarli in termini relativi (rispetto alla media recente).</p></div>`);
};
