"use strict";
/* ===== v8: «Comportamento dei mercati» (Educazione) – anni positivi/negativi, serie, comprare dopo un anno negativo, correzioni ===== */
function cmSeries(id, ccy) {
  const [name, src, cur] = keyOf(id), r = rawSeries(src); if (!r) return null; let d = [], c = [];
  if (r.freq === "D" && (cur === ccy || cur === "ANY")) { r.d.forEach((x, i) => { d.push(x); c.push(r.c[i]); }); }
  else if (r.freq === "D") { r.d.forEach((x, i) => { const fx = fxOn(x); if (fx) { d.push(x); c.push(ccy === "EUR" ? r.c[i] / fx : r.c[i] * fx); } }); }
  let daily = r.freq === "D" && d.length > 0;
  if (!daily) { const L = monthlyLv(src, cur, ccy), ks = [...L.keys()].sort(); d = ks.map(k => k + "-28"); c = ks.map(k => L.get(k)); }
  return { name, d, c, daily };
}
function cmYears(S) { const ye = new Map(); S.d.forEach((x, i) => ye.set(+x.slice(0, 4), { i, v: S.c[i], d: x })); const ys = [...ye.keys()].sort((a, b) => a - b), out = [], cy = +CUR_M.slice(0, 4);
  for (let k = 1; k < ys.length; k++) { const y = ys[k], a = ye.get(ys[k - 1]), b = ye.get(y); if (ys[k - 1] !== y - 1) continue;
    let pk = a.v, md = 0; for (let i = a.i + 1; i <= b.i; i++) { pk = Math.max(pk, S.c[i]); md = Math.min(md, S.c[i] / pk - 1); }
    out.push({ y, r: b.v / a.v - 1, md, partial: y >= cy || b.d.slice(5, 7) !== "12", lv0: a.v, lv1: b.v }); }
  return out; }
function renderCM() {
  const o = $("#cmOut"); if (o.dataset.ok) return runCM(); o.dataset.ok = 1;
  const ids = [...Object.keys(UNI), ...Object.keys(EXTRA)], [a1, ai] = div("chart tall"), [s1, si] = div("chart"), [b1, bi] = div("chart"), [k1, ki] = div("chart tall");
  const yrs = l => `<option value="">${l}</option>` + Array.from({ length: new Date().getFullYear() - 1871 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => `<option>${y}</option>`).join("");
  o.innerHTML = `${pdfBtn("cmPdf", "Scarica PDF")}<div class="card"><h2>Comportamento dei mercati</h2><p class="lead">Quanti anni sono positivi, quanto durano le serie di anni buoni, cosa succede dopo un anno negativo e quanto spesso arrivano le correzioni. Tutto calcolato sui dati veri dell'asset che scegli.</p>
   <div class="form"><label>Asset <select id="cmId">${ids.map(id => `<option value="${id}" ${id === "SPP" ? "selected" : ""}>${keyOf(id)[0]}</option>`).join("")}</select></label><label>Valuta <select id="cmCcy"><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
    <label>Dall'anno <select id="cmY0">${yrs("Primo disponibile")}</select></label><label>All'anno <select id="cmY1">${yrs("Ultimo disponibile")}</select></label></div><div id="cmNote"></div></div>
  <div class="card"><h3>1 · Anni positivi e negativi</h3><div id="cmA"></div>${a1}</div>
  <div class="card"><h3>2 · Serie di anni positivi</h3><div id="cmS"></div>${s1}</div>
  <div class="card"><h3>3 · Comprare dopo un anno negativo</h3><div id="cmB"></div>${b1}</div>
  <div class="card"><h3>4 · Quanto spesso arrivano le correzioni</h3><div id="cmK"></div>${k1}</div>`;
  o._ch = { ai, si, bi, ki };
  ["#cmId", "#cmCcy", "#cmY0", "#cmY1"].forEach(s => $(s).onchange = runCM);
  $("#cmPdf").onclick = e => withBusy(e.target, () => makePdf({ title: "Comportamento dei mercati", sub: window.__cmLast || "", file: pdfName("Comportamento_dei_mercati"), parts: [{ tab: "cm", root: "#cmOut" }] }));
  runCM();
}
function runCM() {
  const o = $("#cmOut"), CH = o._ch, id = $("#cmId").value, ccy = $("#cmCcy").value, S = cmSeries(id, ccy), HL = { bgcolor: "#000", font: { size: 15 } };
  if (!S || S.d.length < 30) { $("#cmNote").innerHTML = `<p class="warn">Dati non disponibili per questo asset in ${ccy}.</p>`; return; }
  const y0 = +$("#cmY0").value || 0, y1 = +$("#cmY1").value || 9999, all = cmYears(S), Y = all.filter(x => x.y >= y0 && x.y <= y1), C0 = Y.filter(x => !x.partial), nm = S.name.replace(/ \(.*\)/, "");
  const first = all.length ? all[0].y : null;
  $("#cmNote").innerHTML = (y0 && first && y0 < first ? `<p class="warn">⚠️ Hai chiesto dal ${y0}, ma ${nm} in ${ccy} ha anni completi solo dal ${first}: si parte da lì.</p>` : "") + (C0.length ? `<p class="note">Anni solari completi analizzati: <b>${C0[0].y} → ${C0[C0.length - 1].y}</b> (${C0.length} anni)${Y.some(x => x.partial) ? `; ${Y.filter(x => x.partial).map(x => x.y).join(", ")}* in corso: mostrato nel grafico ma escluso dalle statistiche` : ""}. ${S.daily ? "Dati giornalieri" : "Dati di fine mese"}, ${ccy}.</p>` : "");
  if (C0.length < 8) { $("#cmA").innerHTML = `<p class="warn">Servono almeno 8 anni completi (trovati ${C0.length}).</p>`; ["#cmS", "#cmB", "#cmK"].forEach(s => $(s).innerHTML = ""); return; }
  window.__cmLast = `${nm}, ${ccy}, ${C0[0].y}–${C0[C0.length - 1].y}`;
  const P = C0.filter(x => x.r > 0), N = C0.filter(x => x.r <= 0), avg = a => a.length ? mean(a) : null, med = a => { if (!a.length) return null; const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const worst = C0.reduce((a, b) => b.r < a.r ? b : a);
  $("#cmA").innerHTML = `<div class="lumpwin now small"><div class="big">${P.length} anni positivi su ${C0.length} (${pct(P.length / C0.length, 0)})</div><div class="sub">In media un anno positivo ha reso ${pc(avg(P.map(x => x.r)), 1)}, uno negativo ${N.length ? pc(avg(N.map(x => x.r)), 1) : "–"}.</div></div>
   <div class="answer">${nm} è salito in circa ${Math.round(P.length / C0.length * 10)} anni su 10. ${N.length ? `Gli anni negativi ci sono sempre stati (il peggiore: ${worst.y}, ${pc(worst.r, 0)}), ma ${N.length < P.length ? "sono stati meno frequenti" : "sono stati frequenti"} e in media ${Math.abs(avg(N.map(x => x.r))) < avg(P.map(x => x.r)) ? "meno ampi" : "più ampi"} dei guadagni degli anni positivi.` : "Nel periodo non ci sono anni negativi."}</div>`;
  plot(CH.ai, [{ x: Y.map(x => x.y + (x.partial ? "*" : "")), y: Y.map(x => x.r * 100), type: "bar", name: "Rendimento dell'anno", marker: { color: Y.map(x => x.partial ? "#666" : x.r > 0 ? C.gold : C.red) }, hovertemplate: "%{x}: %{y:.1f}%<extra></extra>" },
    { x: Y.map(x => x.y + (x.partial ? "*" : "")), y: Y.map(x => x.md * 100), type: "scatter", mode: "markers", name: "Calo massimo durante l'anno", marker: { color: "#fff", size: 5, symbol: "diamond" }, hovertemplate: "calo massimo nell'anno: %{y:.1f}%<extra></extra>" }],
    { title: T("Rendimento di ogni anno (oro = positivo, rosso = negativo) e calo massimo durante l'anno (◆)"), xaxis: { type: "category", tickangle: -60 }, yaxis: { ticksuffix: "%" }, hoverlabel: HL, legend: { orientation: "h", y: -0.25 } });
  const streaks = []; let run = 0; C0.forEach((x, i) => { if (x.r > 0) run++; if (x.r <= 0 || i === C0.length - 1) { if (run) streaks.push({ n: run, end: x.r <= 0 ? C0[i - 1].y : x.y, open: x.r > 0 }); run = 0; } });
  const closed = streaks.filter(s => !s.open), longest = streaks.reduce((a, b) => b.n > a.n ? b : a, { n: 0 }), cur = streaks.length && streaks[streaks.length - 1].open ? streaks[streaks.length - 1].n : 0;
  const dist = {}; streaks.forEach(s => dist[s.n] = (dist[s.n] || 0) + 1);
  $("#cmS").innerHTML = `<div class="answer">${closed.length ? `Prima di un anno negativo sono arrivati in media <b>${num(avg(closed.map(s => s.n)), 1)} anni positivi di fila</b> (mediana ${med(closed.map(s => s.n))}). ` : ""}La serie più lunga: <b>${longest.n} anni</b> (fino al ${longest.end}). ${cur ? `La serie attuale è di ${cur} anni positivi: le serie passate mostrano che non esiste una durata «massima» prevedibile.` : "L'ultimo anno completo è stato negativo."}</div>`;
  plot(CH.si, [{ x: Object.keys(dist).map(k => k + (k === "1" ? " anno" : " anni")), y: Object.values(dist), type: "bar", marker: { color: C.gold }, text: Object.values(dist), textposition: "outside", hovertemplate: "%{x} di fila: %{y} volte<extra></extra>" }], { title: T("Quante volte una serie di anni positivi è durata…"), xaxis: { type: "category" }, yaxis: { title: { text: "volte" } }, hoverlabel: HL });
  const lv = new Map(all.map(x => [x.y, x])), fwd = (y, h) => { const e = lv.get(y + h), s = lv.get(y + 1); if (!e || e.partial || !s) return null; return (e.lv1 / s.lv0) ** (1 / h) - 1; };
  const grp = sel => [1, 3, 5].map(h => { const r = sel.map(x => fwd(x.y, h)).filter(v => v != null); return r.length ? { n: r.length, avg: mean(r), med: med(r), pos: r.filter(v => v > 0).length / r.length } : null; });
  const afterN = C0.filter(x => x.r <= 0), after2 = C0.filter((x, i) => x.r <= 0 && i > 0 && C0[i - 1].r <= 0 && C0[i - 1].y === x.y - 1);
  const G = [["Dopo un anno negativo", grp(afterN)], ["Dopo 2 anni negativi di fila", grp(after2)], ["Un anno qualsiasi", grp(C0)]];
  const nn = afterN.filter(x => lv.get(x.y + 1) && !lv.get(x.y + 1).partial), nnN = nn.filter(x => lv.get(x.y + 1).r <= 0).length;
  const g1 = G[0][1][0], gB = G[2][1][0], g5 = G[0][1][2], gB5 = G[2][1][2];
  $("#cmB").innerHTML = `<div class="answer">${nn.length ? `Dopo un anno negativo, l'anno seguente è stato ancora negativo ${nnN} ${nnN === 1 ? "volta" : "volte"} su ${nn.length} (<b>${pct(nnN / nn.length, 0)}</b>), contro il ${pct(N.length / C0.length, 0)} di un anno qualsiasi. ` : ""}${g1 && gB ? `Chi ha comprato all'inizio dell'anno dopo un anno negativo ha guadagnato in media <b>${pc(g1.avg)}</b> nei 12 mesi successivi, contro ${pc(gB.avg)} di un anno qualsiasi${g5 && gB5 ? `; su 5 anni ${pc(g5.avg)} l'anno contro ${pc(gB5.avg)}` : ""}. ${g1.avg > gB.avg + 0.02 ? "Storicamente gli anni negativi sono stati <b>buone occasioni</b> per entrare, non motivi per scappare." : g1.avg < gB.avg - 0.02 ? "In questo caso dopo un anno negativo è andata peggio della media: a volte i cali durano più di un anno." : "Il risultato è stato simile a un anno qualsiasi: un anno negativo non ha reso il successivo né migliore né peggiore."}` : ""}${afterN.length < 10 ? " ⚠️ Pochi anni negativi nel campione: prudenza." : ""}</div>
   ${table(["Quando compro", "Casi", "1 anno dopo: media", "mediana", "% positivi", "3 anni (annuo): media", "% positivi", "5 anni (annuo): media", "% positivi"], G.map(([n, g]) => [n, g[0] ? g[0].n : 0, ...[0, 1, 2].flatMap(j => g[j] ? (j === 0 ? [pc(g[j].avg), pc(g[j].med), pct(g[j].pos, 0)] : [pc(g[j].avg), pct(g[j].pos, 0)]) : (j === 0 ? ["–", "–", "–"] : ["–", "–"]))])).replace("<table", '<table class="full"')}`;
  plot(CH.bi, [1, 3, 5].map((h, j) => ({ x: G.map(g => g[0]), y: G.map(g => g[1][j] ? g[1][j].avg * 100 : null), name: h === 1 ? "1 anno" : `${h} anni (annuo)`, type: "bar", marker: { color: [C.gold, "#a08033", "#6b5622"][j] }, hovertemplate: "%{y:.1f}%<extra></extra>" })), { title: T("Rendimento medio dopo l'acquisto"), barmode: "group", xaxis: { type: "category" }, yaxis: { ticksuffix: "%" }, hoverlabel: HL });
  const a = lb(S.d, (C0[0].y - 1) + "-12-01"), lastY = Math.min(y1, +CUR_M.slice(0, 4)), b = lb(S.d, (y1 < 9999 ? y1 + "-12-31" : "9999") + "~") - 1, TH = [5, 10, 15, 20, 30, 40], yrsN = (new Date(S.d[b]) - new Date(S.d[a])) / 3.156e10;
  const ep = TH.map(X => { const out = []; let pk = S.c[a], pkI = a, inE = null; for (let i = a + 1; i <= b; i++) { const v = S.c[i]; if (v >= pk) { if (inE) { inE.rec = S.d[i]; out.push(inE); inE = null; } pk = v; pkI = i; continue; }
      const dd = v / pk - 1; if (!inE && dd <= -X / 100) inE = { pk: S.d[pkI], tr: S.d[i], depth: dd }; if (inE && dd < inE.depth) { inE.depth = dd; inE.tr = S.d[i]; } } if (inE) out.push(inE); return { X, out }; });
  const mo = (p, q) => (new Date(q) - new Date(p)) / 2.63e9, e10 = ep[1].out, rec10 = e10.filter(e => e.rec);
  $("#cmK").innerHTML = `<div class="answer">Durante l'anno il calo massimo tipico (mediana) è stato <b>${pct(-med(C0.map(x => x.md)), 0)}</b>: anche negli anni chiusi in positivo, scendere a un certo punto è normale (un calo di almeno il 10% è successo nel ${pct(C0.filter(x => x.md <= -0.1).length / C0.length, 0)} degli anni). Una correzione di almeno il 10% dal massimo è arrivata in media <b>una volta ogni ${num(yrsN / Math.max(1, e10.length), 1)} anni</b>${rec10.length ? `, e per tornare ai massimi sono serviti in media ${num(mean(rec10.map(e => mo(e.pk, e.rec))), 0)} mesi dal picco precedente` : ""}.</div>
   ${table(["Calo dal massimo", "Quante volte", "Ogni quanti anni", "Calo medio in quei casi", "Mesi dal picco al minimo (media)", "Mesi per tornare ai massimi (media)", "Anni con almeno questo calo durante l'anno"], ep.map(E => { const r = E.out.filter(e => e.rec); return [`almeno −${E.X}%`, E.out.length, E.out.length ? num(yrsN / E.out.length, 1) : "–", E.out.length ? pc(mean(E.out.map(e => e.depth))) : "–", E.out.length ? num(mean(E.out.map(e => mo(e.pk, e.tr))), 0) : "–", r.length ? num(mean(r.map(e => mo(e.pk, e.rec))), 0) + (r.length < E.out.length ? " (1 in corso)" : "") : "–", pct(C0.filter(x => x.md <= -E.X / 100).length / C0.length, 0)]; })).replace("<table", '<table class="full"')}
   <p class="note">Correzione = calo di almeno X% dall'ultimo massimo, conclusa quando si torna sopra quel massimo. ${S.daily ? "Dati giornalieri (chiusure)." : "Dati di fine mese: i cali dentro il mese non si vedono, quindi le correzioni piccole sono sottostimate."} Indici di solo prezzo: senza dividendi.</p>`;
  plot(CH.ki, [{ x: TH.map(x => `−${x}%`), y: ep.map(E => E.out.length ? yrsN / E.out.length : null), type: "bar", marker: { color: C.gold }, text: ep.map(E => E.out.length ? `ogni ${num(yrsN / E.out.length, 1)} anni` : "mai"), textposition: "outside", hovertemplate: "%{x}: in media ogni %{y:.1f} anni<extra></extra>" }], { title: T("In media ogni quanti anni arriva un calo di almeno…"), xaxis: { type: "category" }, yaxis: { title: { text: "anni" } }, hoverlabel: HL });
}
{ const _s = showTab; showTab = id => { _s(id); if (id === "cm") try { renderCM(); } catch (e) { console.error(e); } }; }
