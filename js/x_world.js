"use strict";
/* ===== v9: Educazione – perché un indice mondiale come investimento principale ===== */
const WQ = [["MW", "MSCI World", "MSCIWD", "USD", "#c9a54c"], ["US", "S&P 500 (USA)", "^SP500TR", "USD", "#5b8bd9"], ["EXUS", "Europa, Giappone e altri sviluppati", "EFA", "USD", "#7fc8c8"], ["EM", "Paesi emergenti", "MSCIEM", "USD", "#e0794a"],
  ["CN", "Cina", "MSCI_CN", "USD", "#e5566b"], ["IN", "India", "MSCI_IN", "USD", "#d77fb0"], ["BR", "Brasile", "MSCI_BR", "USD", "#6fbf4a"], ["KR", "Corea del Sud", "MSCI_KR", "USD", "#b07cd8"], ["TW", "Taiwan", "MSCI_TW", "USD", "#d8c25c"], ["MX", "Messico", "MSCI_MX", "USD", "#8e8e99"],
  ["GOLD", "Oro", "GLD", "USD", "#f0d070"], ["BTP", "BTP 10 anni", "BTP10C", "EUR", "#3fae7a"]];
XR.ed_world = function () {
  const o = $("#ed_worldOut"); if (o.dataset.ok) return; o.dataset.ok = 1;
  const SHORT = { MW: "Mondo", US: "USA", EXUS: "Svil. ex-USA", EM: "Emergenti", CN: "Cina", IN: "India", BR: "Brasile", KR: "Corea", TW: "Taiwan", MX: "Messico", GOLD: "Oro", BTP: "BTP" };
  const L = WQ.map(([k, n, src, cur, col]) => ({ k, n, sn: SHORT[k], col, m: monthlyLv(src, cur, "EUR") }));
  const yEnd = +[...L[0].m.keys()].sort().pop().slice(0, 4) - ([...L[0].m.keys()].sort().pop().slice(5, 7) === "12" ? 0 : 1);
  const years = []; for (let y = 2002; y <= yEnd; y++) years.push(y);
  const yr = (m, y) => { const a = m.get((y - 1) + "-12"), b = m.get(y + "-12"); return a && b ? b / a - 1 : NaN; };
  const Y = L.map(x => years.map(y => yr(x.m, y)));
  // classifica per anno
  const rank = years.map((y, j) => L.map((x, i) => [i, Y[i][j]]).filter(v => isFinite(v[1])).sort((a, b) => b[1] - a[1]));
  const quilt = `<div class="tblwrap"><table class="quilt"><tr><th></th>${years.map(y => `<th>${y}</th>`).join("")}</tr>${L.map((_, r) => `<tr><td class="muted">${r + 1}°</td>${rank.map(rk => { const e = rk[r]; if (!e) return "<td></td>"; const x = L[e[0]]; return `<td style="background:${x.col}33;border-left:3px solid ${x.col}" title="${x.n}"><b>${x.sn}</b><br>${pct(e[1], 0)}</td>`; }).join("")}</tr>`).join("")}</table></div>`;
  // il vincitore dell'anno prima, l'anno dopo
  const nxt = []; rank.forEach((rk, j) => { if (j + 1 < rank.length && rk.length) { const w = rk[0][0], pos = rank[j + 1].findIndex(e => e[0] === w); if (pos >= 0) nxt.push(pos + 1); } });
  const iMW = 0, nAssets = L.length;
  // MSCI World contro i singoli paesi azionari: 10 anni mobili
  const eqIdx = [1, 2, 3, 4, 5, 6, 7, 8, 9]; const months = [...L[0].m.keys()].sort();
  const roll = (m, k0, k1) => m.has(k0) && m.has(k1) ? Math.pow(m.get(k1) / m.get(k0), 1 / 10) - 1 : NaN;
  const beat = eqIdx.map(i => { let w = 0, t = 0; months.forEach((k, j) => { if (j + 120 < months.length) { const a = roll(L[i].m, k, months[j + 120]), b = roll(L[0].m, k, months[j + 120]); if (isFinite(a) && isFinite(b)) { t++; if (a > b) w++; } } }); return t ? w / t : NaN; });
  const stat = i => { const ks = months.filter(k => L[i].m.has(k)); const c = ks.map(k => L[i].m.get(k)); const r = c.map((x, j) => j ? x / c[j - 1] - 1 : NaN).slice(1); const yrs = ks.length / 12; return { from: ks[0], cagr: Math.pow(c[c.length - 1] / c[0], 1 / yrs) - 1, vol: std(r) * Math.sqrt(12), dd: Math.min(...XL.dd(c)), worst: Math.min(...Y[i].filter(isFinite)), best: Math.max(...Y[i].filter(isFinite)) }; };
  const ST = L.map((_, i) => stat(i));
  const [g1, i1] = div("chart tall"), [g2, i2] = div();
  o.innerHTML = XL.pdfBtn("ed_world", "Perché un indice mondiale", "Diversificare invece di indovinare il futuro") + `
  <div class="card"><h3>Perché un indice mondiale come base del portafoglio</h3>
   <p class="answer">Ogni anno c'è un mercato che va meglio di tutti, ma <b>quasi mai è lo stesso</b>. Un indice mondiale come l'MSCI World contiene circa 1.400 grandi aziende di 23 paesi sviluppati: non serve indovinare quale paese o settore vincerà, perché li possiede tutti in proporzione al loro peso. Non sarà mai il primo della classifica, ma nemmeno l'ultimo, e il suo risultato nel tempo è quello dell'economia mondiale.</p></div>
  <div class="card"><h3>La classifica di ogni anno (rendimenti in euro)</h3>${quilt}
   <p class="note">Rendimenti annuali in euro, dividendi reinvestiti (indici MSCI Net Total Return, S&amp;P 500 total return, ETF EFA e GLD; BTP ricostruito dal rendimento a 10 anni). Ogni colore è un mercato: segui un colore e vedrai che salta continuamente tra le prime e le ultime posizioni.</p>
   <p class="answer">Il mercato migliore di un anno, l'anno successivo si è piazzato in media al <b>${num(mean(nxt), 1)}° posto su ${nAssets}</b> (mediana ${median(nxt)}°). Chi insegue il vincitore dell'anno prima compra spesso tardi e caro.</p></div>
  <div class="card"><h3>Mondo contro singoli paesi: rischio e risultato</h3>
   ${table(["Mercato", "Dal", "Rendimento annuo (EUR)", "Volatilità", "Peggior anno", "Miglior anno", "Calo massimo", "Ha battuto il Mondo su 10 anni"], L.map((x, i) => [i === 0 ? `<b>${x.n}</b>` : x.n, ST[i].from.slice(0, 4), pc(ST[i].cagr), pct(ST[i].vol), pc(ST[i].worst), pc(ST[i].best), pc(ST[i].dd), eqIdx.includes(i) && isFinite(beat[eqIdx.indexOf(i)]) ? pct(beat[eqIdx.indexOf(i)], 0) + " dei periodi" : "–"]))}
   ${g1}<p class="note">«Ha battuto il Mondo su 10 anni» = quota di tutti i periodi di 10 anni (mensili, sovrapposti) in cui quel mercato ha reso più dell'MSCI World. A posteriori qualcuno vince sempre: il problema è saperlo prima. Singoli paesi emergenti hanno avuto cali del 60–70% e decenni piatti.</p>
   <p class="answer">${(() => { const bi = eqIdx.map((i, j) => [i, beat[j]]).filter(x => isFinite(x[1])).sort((a, b) => b[1] - a[1])[0]; return bi ? `In questo periodo il mercato che ha battuto più spesso il Mondo è stato <b>${L[bi[0]].n}</b> (${pct(bi[1], 0)} dei decenni). Ma la leadership cambia: tra il 2000 e il 2010 gli USA hanno fatto peggio di emergenti ed Europa, mentre nel decennio successivo è successo il contrario. Il Mondo contiene già il vincitore, qualunque sia, nel peso che il mercato gli assegna.` : ""; })()}</p></div>
  <div class="card"><h3>In pratica</h3><ul class="lead">
   <li><b>Il cuore</b> del portafoglio azionario può essere un ETF globale (MSCI World o FTSE All-World): massima diversificazione, costi bassissimi, nessuna previsione da fare.</li>
   <li><b>Le scommesse</b> (un paese, un settore, un tema) se ci sono restano piccole, come «satellite», e si accetta che possano andare peggio.</li>
   <li><b>Il rischio</b> si gestisce scegliendo quanta parte mettere in azioni e quanta in obbligazioni e liquidità, non cercando il mercato giusto.</li>
   <li><b>Il tempo</b> fa il resto: con un PAC e un orizzonte lungo le oscillazioni pesano molto meno (vedi <a href="#" data-go="tb_pac">Il PAC nel tempo</a>).</li></ul>${g2}</div>`;
  const base = k => { const ks = months.filter(m => L[k].m.has(m) && m >= "2001-12"); const v0 = L[k].m.get(ks[0]); return { x: ks, y: ks.map(m => L[k].m.get(m) / v0 * 100) }; };
  plot(i1, L.slice(0, 10).map((x, i) => ({ ...base(i), name: x.n, line: { color: x.col, width: i === 0 ? 4 : 1.2 } })), { title: "Crescita di 100 € dal 2001 (scala logaritmica, in euro)", yaxis: { type: "log" }, legend: { orientation: "h", y: -0.12 }, margin: { b: 90 } });
  plot(i2, [{ type: "bar", x: L.slice(0, 10).map(x => x.n), y: ST.slice(0, 10).map(s => s.dd * 100), marker: { color: L.slice(0, 10).map(x => x.col) }, name: "Calo massimo" }], { title: "Calo massimo dal 2001 (in euro): il mondo soffre meno dei singoli paesi", yaxis: { ticksuffix: "%" }, hovermode: "closest" });
};
