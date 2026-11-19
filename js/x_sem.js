"use strict";
/* ===== v9: Semaforo degli eccessi + rotazione settoriale ===== */
const SEM_U = [
  ["Azioni", [["MKT:^GSPC", "S&P 500"], ["MKT:^NDX", "Nasdaq 100"], ["MKT:^RUT", "Russell 2000"], ["XTRA:RSP", "S&P 500 equal weight"], ["ASSETS:SWDA.MI", "MSCI World (EUR)"], ["ASSETS:SXRT.DE", "EURO STOXX 50"], ["XTRA:FTSEMIB.MI", "FTSE MIB"], ["XTRA:^N225", "Nikkei 225"], ["ASSETS:EEM", "Emergenti"], ["XTRA:SMH", "Semiconduttori"]]],
  ["Settori USA", [["ASSETS:XLK", "Tecnologia"], ["ASSETS:XLC", "Comunicazione"], ["ASSETS:XLY", "Beni voluttuari"], ["ASSETS:XLF", "Finanziari"], ["ASSETS:XLI", "Industriali"], ["ASSETS:XLV", "Salute"], ["ASSETS:XLP", "Beni di prima necessità"], ["ASSETS:XLE", "Energia"], ["ASSETS:XLB", "Materiali"], ["ASSETS:XLU", "Servizi pubblici"], ["ASSETS:XLRE", "Immobiliare"]]],
  ["Obbligazioni", [["ASSETS:TLT", "Treasury 20+ anni"], ["ASSETS:IEF", "Treasury 7-10 anni"], ["ASSETS:SXRQ.DE", "Gov. euro 7-10 anni"], ["XTRA:HYG", "High yield USA"], ["XTRA:LQD", "Corporate IG USA"]]],
  ["Materie prime, valute, cripto", [["ASSETS:GLD", "Oro"], ["XTRA:SI=F", "Argento"], ["XTRA:HG=F", "Rame"], ["ASSETS:BRENT", "Petrolio Brent"], ["XTRA:NG=F", "Gas naturale USA"], ["XTRA:DX-Y.NYB", "Dollaro (DXY)"], ["XTRA:EURUSD=X", "EUR/USD"], ["XTRA:BTC-USD", "Bitcoin"]]]];

// indicatori di eccesso per una serie giornaliera
function semCalc(s) {
  const c = s.c, n = c.length - 1; if (n < 600) return null;
  const ma = XL.sma(c, 200), dist = c.map((x, i) => x / ma[i] - 1), rsi = XL.rsi(c, 14), r12 = XL.ret(c, 252), r1 = XL.ret(c, 21), dd = XL.dd(c), v = XL.vol(c, 21);
  const P = { dist: XL.pctl(dist, dist[n]), rsi: XL.pctl(rsi, rsi[n]), r12: XL.pctl(r12, r12[n]) };
  const comp = semComposite(s), score = comp[n];
  return { last: c[n], date: s.d[n], dist: dist[n], rsi: rsi[n], r12: r12[n], r1: r1[n], dd: dd[n], vol: v[n], volP: XL.pctl(v, v[n]), P, score, distA: dist, ma };
}
// percentili veloci: per serie lunghe calcoliamo il composito su una griglia ordinata
function semComposite(s) {
  const c = s.c, n = c.length - 1, ma = XL.sma(c, 200), dist = c.map((x, i) => x / ma[i] - 1), rsi = XL.rsi(c, 14), r12 = XL.ret(c, 252);
  const rk = a => { const idx = a.map((v, i) => [v, i]).filter(x => isFinite(x[0])).sort((x, y) => x[0] - y[0]), o = new Array(a.length).fill(NaN); idx.forEach(([, i], k) => o[i] = k / (idx.length - 1)); return o; };
  const A = rk(dist), B = rk(rsi), Cc = rk(r12);
  // il composito è a sua volta trasformato in percentile, così 90° significa davvero «più alto del 90% dei giorni»
  return rk(c.map((_, i) => (isFinite(A[i]) && isFinite(B[i]) && isFinite(Cc[i])) ? (A[i] + B[i] + Cc[i]) / 3 : NaN));
}

XL.page("cx_sem", ["XTRA"], o => {
  const rows = [];
  SEM_U.forEach(([g, L]) => L.forEach(([ref, name]) => { const s = XL.get(ref); if (!s || s.d.length < 600) return; const k = semCalc(s); if (k) rows.push({ g, ref, name, ...k }); }));
  const hot = rows.filter(r => r.score >= .85).sort((a, b) => b.score - a.score), cold = rows.filter(r => r.score <= .2).sort((a, b) => a.score - b.score);
  const tr = r => { const [v, cl] = XL.verdict(r.score); return `<tr data-ref="${r.ref}" class="clk"><td>${r.name}</td><td>${pc(r.r1)}</td><td>${pc(r.r12)}</td><td class="${XL.heat(r.P.r12)}">${XL.pp(r.P.r12)}</td><td>${pc(r.dist)}</td><td class="${XL.heat(r.P.dist)}">${XL.pp(r.P.dist)}</td><td class="${XL.heat(r.P.rsi)}">${num(r.rsi, 0)}</td><td>${pc(r.dd)}</td><td class="${r.volP > .85 ? "h-2" : r.volP < .15 ? "h1" : ""}">${pct(r.vol, 0)} <small class="muted">(${XL.pp(r.volP)})</small></td><td><span class="pill ${cl}">${v}</span></td><td class="muted">${fmtD(r.date)}</td></tr>`; };
  o.innerHTML = XL.pdfBtn("cx_sem", "Semaforo degli eccessi", "Dove i mercati sono tirati e dove sono depressi rispetto alla propria storia") + `
  <div class="card"><h3>Semaforo degli eccessi</h3>
   <p class="answer">${hot.length ? `<b>Più tirati rispetto alla loro storia:</b> ${hot.slice(0, 5).map(r => `${r.name} (${XL.pp(r.score)} percentile)`).join(", ")}. ` : "Nessun mercato in zona di euforia. "}${cold.length ? `<b>Più depressi:</b> ${cold.slice(0, 5).map(r => `${r.name} (${XL.pp(r.score)})`).join(", ")}.` : "Nessun mercato in zona di panico."}</p>
   <div class="tblwrap"><table class="heat"><tr><th>Mercato</th><th>1 mese</th><th>12 mesi</th><th>Percentile 12m</th><th>Distanza da MA200</th><th>Percentile distanza</th><th>RSI 14</th><th>Dal massimo</th><th>Volatilità 1m (percentile)</th><th>Stato</th><th>Dati al</th></tr>
   ${SEM_U.map(([g]) => `<tr class="grprow"><td colspan="11">${g}</td></tr>` + rows.filter(r => r.g === g).map(tr).join("")).join("")}</table></div>
   <p class="note">Ogni indicatore è confrontato con <b>tutta la storia dello stesso mercato</b>: il percentile dice in quale posizione è il valore di oggi (95° = più alto del 95% dei giorni passati). Stato = percentile storico della media dei tre percentili (distanza dalla media a 200 giorni, RSI a 14 giorni, rendimento a 12 mesi): oltre il 90° «Euforia», 70°–90° «Caldo», 10°–30° «Freddo», sotto il 10° «Panico». Clicca una riga per il dettaglio. Un mercato «caldo» può restarlo a lungo: è una misura di quanto è tirato, non un segnale di vendita.</p></div>
  <div class="card" id="semDet"></div>`;
  const det = ref => {
    const s = XL.get(ref), name = rows.find(r => r.ref === ref).name, k = rows.find(r => r.ref === ref), comp = semComposite(s), n = s.c.length - 1, cur = comp[n];
    const lo = Math.max(0, cur - .1), hi = Math.min(1, cur + .1);
    const sel = [3, 12].map(m => { const h = Math.round(m * 21); const f = XL.fwd(s.c, h); const all = f.filter(isFinite), cond = f.filter((x, i) => isFinite(x) && comp[i] >= lo && comp[i] <= hi); return { m, all, cond }; });
    const [g1, i1] = div("chart tall"), [g2, i2] = div(), [g3, i3] = div();
    const p10 = XL.q(k.distA, .05), p90 = XL.q(k.distA, .95);
    $("#semDet").innerHTML = `<h3>${name}: quanto è tirato e cosa è successo dopo in passato</h3>${g1}
     <p class="answer">Oggi lo stato composito è al <b>${XL.pp(cur)} percentile</b>. Nei giorni del passato con uno stato simile (${XL.pp(lo)}–${XL.pp(hi)}), il rendimento a 12 mesi è stato in media ${pct(mean(sel[1].cond))} (mediana ${pct(median(sel[1].cond))}, positivo nel ${pct(fracPos(sel[1].cond), 0)} dei casi), contro ${pct(mean(sel[1].all))} di un giorno qualsiasi.</p>
     <div class="grid2"><div>${g2}</div><div>${g3}</div></div>
     ${table(["Orizzonte", "Casi simili a oggi", "Media", "Mediana", "% positivi", "Peggiore 10%", "Migliore 10%", "Tutti i giorni: media", "% positivi"], sel.map(x => { const a = XL.statsRow(x.cond), b = XL.statsRow(x.all); return [x.m + " mesi", a.n, pc(a.mean), pc(a.med), pct(a.pos, 0), pc(a.p10), pc(a.p90), pc(b.mean), pct(b.pos, 0)]; }))}
     <p class="note">Le bande tratteggiate sono la media a 200 giorni ±(5° e 95° percentile della distanza storica): quando il prezzo le tocca è in territorio raro. I casi «simili» si sovrappongono nel tempo (giorni consecutivi), quindi il numero di episodi indipendenti è molto minore del numero di giorni.</p>`;
    const i0 = Math.max(0, n - 252 * 5);
    plot(i1, [{ x: s.d.slice(i0), y: s.c.slice(i0), name, line: { color: C.gold } }, { x: s.d.slice(i0), y: k.ma.slice(i0), name: "Media 200 gg", line: { color: C.grey } },
      { x: s.d.slice(i0), y: k.ma.slice(i0).map(v => v * (1 + p90)), name: "Banda alta (95°)", line: { color: C.red, dash: "dot", width: 1 } }, { x: s.d.slice(i0), y: k.ma.slice(i0).map(v => v * (1 + p10)), name: "Banda bassa (5°)", line: { color: C.green, dash: "dot", width: 1 } }], { title: name + " – ultimi 5 anni", yaxis: { type: "log" } });
    const j0 = Math.max(260, n - 2520), cs = XL.sma(comp.map(v => isFinite(v) ? v : .5), 10); plot(i2, [{ x: s.d.slice(j0), y: cs.slice(j0).map(v => v * 100), name: "Stato composito (media 10 gg)", line: { color: C.gold, width: 1.2 } }], { title: "Stato composito negli ultimi 10 anni", yaxis: { range: [0, 100], ticksuffix: "°" }, shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 90, y1: 90, line: { color: C.red, dash: "dot" } }, { type: "line", xref: "paper", x0: 0, x1: 1, y0: 10, y1: 10, line: { color: C.green, dash: "dot" } }] });
    XL.histo(i3, [["Tutti i giorni", sel[1].all, C.grey], ["Giorni simili a oggi", sel[1].cond, C.gold]], "Rendimento a 12 mesi: distribuzione");
    $("#semDet").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  o.querySelectorAll("tr.clk").forEach(t => t.onclick = () => det(t.dataset.ref));
  const first = rows.find(r => r.ref === "MKT:^GSPC") || rows[0]; if (first) { det(first.ref); window.scrollTo(0, 0); }
});

// ---------------- Rotazione settoriale (Relative Rotation Graph semplificato) + ampiezza + valutazioni
const SECTS = [["XLK", "Tecnologia"], ["XLC", "Comunicazione"], ["XLY", "Beni voluttuari"], ["XLF", "Finanziari"], ["XLI", "Industriali"], ["XLV", "Salute"], ["XLP", "Beni prima necessità"], ["XLE", "Energia"], ["XLB", "Materiali"], ["XLU", "Servizi pubblici"], ["XLRE", "Immobiliare"]];
const SCOL = ["#c9a54c", "#5b8bd9", "#e0794a", "#3fae7a", "#b07cd8", "#e5566b", "#7fc8c8", "#d8c25c", "#8e8e99", "#6fbf4a", "#d77fb0"];
XL.page("cx_rot", ["XTRA", "PESNAP"], o => {
  const bench = XL.get("XTRA:SPY"); if (!bench) { o.innerHTML = `<div class="card warn">Dati SPY non ancora disponibili: si scaricano al primo aggiornamento notturno.</div>`; return; }
  const W = XL.weekly(bench), tail = 10;
  const pts = SECTS.map(([k, n], j) => { const s = XL.get("ASSETS:" + k) || XL.get("XTRA:" + k); if (!s) return null; const a = XL.align([XL.weekly(s), W]); if (a.d.length < 80) return null;
    const rs = a.cs[0].map((x, i) => x / a.cs[1][i]); const base = XL.sma(rs, 26); const ratio = rs.map((x, i) => 100 * x / base[i]); const mom = ratio.map((x, i) => i >= 4 ? 100 * x / ratio[i - 4] : NaN);
    const m = ratio.length - 1; return { k, n, col: SCOL[j], d: a.d.slice(m - tail + 1), x: ratio.slice(m - tail + 1), y: mom.slice(m - tail + 1) }; }).filter(Boolean);
  const quad = p => { const x = p.x[p.x.length - 1], y = p.y[p.y.length - 1]; return x >= 100 && y >= 100 ? "Leader" : x >= 100 ? "In indebolimento" : y >= 100 ? "In miglioramento" : "Ritardatari"; };
  // performance relative
  const rel = SECTS.map(([k, n]) => { const s = XL.get("ASSETS:" + k); if (!s) return null; const a = XL.align([s, bench]); const c = a.cs[0], b = a.cs[1], m = c.length - 1; const r = h => m >= h ? (c[m] / c[m - h]) / (b[m] / b[m - h]) - 1 : NaN; const ma = XL.sma(c, 200); return { k, n, r1: r(21), r3: r(63), r6: r(126), r12: r(252), above: c[m] > ma[m], dist: c[m] / ma[m] - 1 }; }).filter(Boolean);
  // ampiezza: quota di settori sopra la propria media 200 nel tempo
  const sec = SECTS.map(([k]) => XL.get("ASSETS:" + k)).filter(Boolean);
  const bd = bench.d.filter(d => d >= "2000-01-01"), brd = (() => { const mm = sec.map(s => { const ma = XL.sma(s.c, 200); return new Map(s.d.map((d, i) => [d, isFinite(ma[i]) ? (s.c[i] > ma[i] ? 1 : 0) : null])); }); return bd.map(d => { const v = mm.map(m => m.get(d)).filter(x => x != null); return v.length >= 8 ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }); })();
  const rsp = XL.get("XTRA:RSP"), conc = rsp ? XL.align([rsp, bench]) : null;
  const P = window.PESNAP || {}, pe = t => { const x = P[t]; if (!x || !x.pe) return null; for (let i = x.pe.length - 1; i >= 0; i--) if (x.pe[i]) return { v: x.pe[i], d: x.d[i], pb: x.pb[i], dy: x.dy[i] }; return null; };
  const spPE = pe("SPY");
  const [g1, i1] = div("chart tall"), [g2, i2] = div(), [g3, i3] = div(), [g4, i4] = div("chart tall");
  o.innerHTML = XL.pdfBtn("cx_rot", "Rotazione settori USA", "Forza relativa, ampiezza del mercato e valutazioni dei settori") + `
  <div class="card"><h3>Grafico di rotazione dei settori (forza relativa contro S&amp;P 500)</h3>
   <p class="answer"><b>Leader</b> (forti e in accelerazione): ${pts.filter(p => quad(p) === "Leader").map(p => p.n).join(", ") || "nessuno"}. <b>In miglioramento</b>: ${pts.filter(p => quad(p) === "In miglioramento").map(p => p.n).join(", ") || "nessuno"}. <b>In indebolimento</b>: ${pts.filter(p => quad(p) === "In indebolimento").map(p => p.n).join(", ") || "nessuno"}. <b>Ritardatari</b>: ${pts.filter(p => quad(p) === "Ritardatari").map(p => p.n).join(", ") || "nessuno"}.</p>
   ${g1}<p class="note">Asse orizzontale: forza relativa del settore rispetto all'S&amp;P 500, normalizzata sulla sua media di 26 settimane (sopra 100 = sta battendo l'indice). Asse verticale: velocità di quella forza nelle ultime 4 settimane (sopra 100 = sta accelerando). La coda mostra le ultime ${tail} settimane. I settori tendono a ruotare in senso orario: miglioramento → leader → indebolimento → ritardatari. Strumento ispirato ai Relative Rotation Graphs usati dai gestori; versione semplificata.</p></div>
  <div class="card"><h3>Performance relativa e valutazioni dei settori</h3>
   ${table(["Settore", "vs S&P 1 mese", "3 mesi", "6 mesi", "12 mesi", "Sopra MA200", "Distanza MA200", "P/E", "P/E vs S&P 500", "Rend. dividendo"], rel.map(r => { const p = pe(r.k); return [r.n, pc(r.r1), pc(r.r3), pc(r.r6), pc(r.r12), r.above ? "sì" : `<span class="neg">no</span>`, pc(r.dist), p ? num(p.v, 1) : "–", p && spPE ? pc(p.v / spPE.v - 1, 0) : "–", p && p.dy ? pct(p.dy > 1 ? p.dy / 100 : p.dy) : "–"]; }))}
   <p class="note">P/E = prezzo/utili degli ultimi 12 mesi dell'ETF settoriale (fonte Yahoo, fotografia giornaliera${spPE ? `; S&amp;P 500 (SPY) = ${num(spPE.v, 1)} al ${fmtD(spPE.d)}` : ""}). Lo storico dei P/E settoriali si accumula giorno per giorno da quando la piattaforma è online; per il lungo periodo dell'indice usa <a href="#" data-go="cx_val">Valutazioni e premio al rischio</a>.</p></div>
  <div class="card"><h3>Ampiezza e concentrazione del mercato</h3><div class="grid2"><div>${g2}</div><div>${g3}</div></div>
   <p class="note">A sinistra: quota degli 11 settori sopra la propria media a 200 giorni. Rialzi con pochi settori sopra la media sono «stretti» e più fragili; valori sotto il 20% si sono visti vicino ai minimi dei mercati ribassisti. A destra: S&amp;P 500 equal weight (ogni azienda pesa uguale) diviso S&amp;P 500 classico. Se scende, l'indice è trainato da poche grandi aziende: concentrazione alta = rischio specifico più alto anche in un indice «diversificato».</p></div>
  <div class="card"><h3>Settore leader di ogni anno</h3>${g4}<p class="note">Rendimento annuale (dividendi inclusi) di ciascun settore; l'anno in corso è da inizio anno. Il vincitore cambia spesso: inseguire il settore migliore dell'anno precedente raramente ripaga.</p></div>`;
  plot(i1, pts.flatMap(p => [{ x: p.x, y: p.y, mode: "lines+markers", name: p.n, line: { color: p.col, width: 1.5 }, marker: { size: p.x.map((_, i) => i === p.x.length - 1 ? 11 : 4), color: p.col }, text: p.d.map(d => p.n + " " + fmtD(d)), hovertemplate: "%{text}<br>Forza %{x:.1f} · Velocità %{y:.1f}<extra></extra>" }]),
    { title: "Rotazione settoriale (ultime 10 settimane)", hovermode: "closest", legend: { orientation: "h", y: -0.22 }, margin: { b: 120 }, xaxis: { title: { text: "Forza relativa (100 = in linea con l'indice)" } }, yaxis: { title: { text: "Velocità della forza relativa" } },
      shapes: [{ type: "line", x0: 100, x1: 100, yref: "paper", y0: 0, y1: 1, line: { color: "#555" } }, { type: "line", y0: 100, y1: 100, xref: "paper", x0: 0, x1: 1, line: { color: "#555" } }],
      annotations: [["Leader", 1, 1], ["In indebolimento", 1, 0], ["Ritardatari", 0, 0], ["In miglioramento", 0, 1]].map(([t, x, y]) => ({ text: t, xref: "paper", yref: "paper", x: x ? .98 : .02, y: y ? .98 : .02, xanchor: x ? "right" : "left", yanchor: y ? "top" : "bottom", showarrow: false, font: { color: "#777", size: 13 } })) });
  { const sm = XL.sma(brd.map(v => isFinite(v) ? v : .5), 10); plot(i2, [{ x: bd, y: sm.map(v => v * 100), name: "% settori sopra MA200 (media 10 gg)", line: { color: C.gold, width: 1.2 } }], { title: "Ampiezza: % settori sopra la media 200 gg", yaxis: { range: [0, 100], ticksuffix: "%" }, shapes: XL.recShapes("2000-01") }); }
  if (conc) plot(i3, [{ x: conc.d, y: conc.cs[0].map((x, i) => x / conc.cs[1][i] / (conc.cs[0][0] / conc.cs[1][0]) * 100), name: "Equal weight / cap weight", line: { color: C.blue } }], { title: "Concentrazione: equal weight ÷ S&P 500 (base 100)" });
  // tabella annuale settori come heatmap
  const yrs = [...new Set(bench.d.map(d => d.slice(0, 4)))].filter(y => y >= "1999");
  const z = [], txt = [];
  SECTS.forEach(([k]) => { const s = XL.get("ASSETS:" + k); const row = [], tr = []; yrs.forEach(y => { const a = XL.at(s, (+y - 1) + "-12-31"), b = XL.at(s, y + "-12-31"); const v = s && s.d[0] <= (+y - 1) + "-12-31" ? b / a - 1 : NaN; row.push(isFinite(v) ? v * 100 : null); tr.push(isFinite(v) ? (v * 100).toFixed(0) + "%" : ""); }); z.push(row); txt.push(tr); });
  plot(i4, [{ type: "heatmap", z, x: yrs, y: SECTS.map(s => s[1]), text: txt, textfont: { size: 10 }, texttemplate: "%{text}", colorscale: [[0, "#C4453B"], [.5, "#F4F6F9"], [1, "#1A8A5B"]], zmid: 0, zmin: -40, zmax: 40, showscale: false, hovertemplate: "%{y} %{x}: %{text}<extra></extra>" }], { title: "Rendimento annuale per settore", hovermode: "closest", margin: { l: 150, t: 50 }, yaxis: { autorange: "reversed" }, xaxis: { dtick: 1, tickangle: -45 } });
});
