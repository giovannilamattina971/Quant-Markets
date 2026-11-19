"use strict";
/* ===== v8b: «Comportamento dei mercati» – schemi storici (S&P 500 dal 1928 e asset scelto) ===== */
const PARTY8 = (() => { const o = {}; [[1929, 1932, "R"], [1933, 1952, "D"], [1953, 1960, "R"], [1961, 1968, "D"], [1969, 1976, "R"], [1977, 1980, "D"], [1981, 1992, "R"], [1993, 2000, "D"], [2001, 2008, "R"], [2009, 2016, "D"], [2017, 2020, "R"], [2021, 2024, "D"], [2025, 2028, "R"]].forEach(([a, b, p]) => { for (let y = a; y <= b; y++) o[y] = p; }); return o; })();
const pStat = a => { a = a.filter(x => x != null && isFinite(x)); if (!a.length) return null; const s = a.slice().sort((p, q) => p - q); return { n: a.length, avg: mean(a), med: s[Math.floor(s.length / 2)], pos: a.filter(x => x > 0).length / a.length, worst: s[0], best: s[s.length - 1] }; };
const few = n => n < 15 ? ` <span class="warn">⚠️ solo ${n} casi: prudenza.</span>` : "";
const pRow = (n, s) => s ? [n, s.n, pc(s.avg), pc(s.med), pct(s.pos, 0), pc(s.worst)] : [n, 0, "–", "–", "–", "–"];
const pHead = ["", "Casi", "Media", "Mediana", "% positivi", "Peggiore"];
function patSP() { // S&P 500 solo prezzo giornaliero dal 1928 (Yahoo ^GSPC)
  const F = FULL["^GSPC"]; const d = [], c = []; F.d.forEach((x, i) => { if (x.slice(0, 7) < CUR_M || true) { d.push(x); c.push(F.c[i]); } });
  const M = sgMonths(d, c), cy = +CUR_M.slice(0, 4), full = M.m.length - (M.m[M.m.length - 1] >= CUR_M ? 1 : 0);
  const Y = cmYears({ d, c, daily: true }).filter(x => !x.partial), Ym = new Map(Y.map(x => [x.y, x]));
  return { d, c, M, full, Y, Ym, cy };
}
function renderPatterns() {
  const box = $("#cmPat"); if (!box) return; const P = patSP(), id = $("#cmId").value, ccy = $("#cmCcy").value, SA = cmSeries(id, ccy), HL = { bgcolor: "#000", font: { size: 15 } };
  const { d, c, M, full, Y, Ym } = P, mi = new Map(M.m.map((k, i) => [k, i])), fwdM = (i, h) => i + h < full ? (h >= 60 ? (M.px[i + h] / M.px[i]) ** (12 / h) - 1 : M.px[i + h] / M.px[i] - 1) : null;
  const fwdD = (i, n) => i + n < d.length ? c[i + n] / c[i] - 1 : null, cases = [];
  const add = (grp, q, verdict, body, chart) => cases.push({ grp, q, verdict, body, chart });
  // 1. ciclo presidenziale
  { const L = ["Post-elettorale", "Midterm (metà mandato)", "Pre-elettorale", "Elettorale"], g = [1, 2, 3, 0].map(k => Y.filter(x => x.y % 4 === k));
    const S = g.map(a => pStat(a.map(x => x.r))), DD = g.map(a => pStat(a.map(x => x.md)));
    const mid = Y.filter(x => x.y % 4 === 2).map(x => { const a = lb(d, x.y + "-01-01"), b = lb(d, (x.y + 1) + "-01-01") - 1; let j = a; for (let i = a; i <= b; i++) if (c[i] < c[j]) j = i; return fwdD(j, 252); }), ms = pStat(mid);
    const best = S.reduce((a, b, i) => b.avg > S[a].avg ? i : a, 0), worst = S.reduce((a, b, i) => b.avg < S[a].avg ? i : a, 0);
    add("Politica e cicli", "Il ciclo presidenziale USA conta?", `Anno migliore: ${L[best].toLowerCase()} (${pc(S[best].avg)} medio), più debole: ${L[worst].toLowerCase()} (${pc(S[worst].avg)}). Dal minimo dell'anno di midterm, +${pct(ms.avg, 0)} medio nei 12 mesi dopo.`,
      table(["Anno del ciclo", "Anni", "Rend. medio", "% positivi", "Calo max nell'anno (mediana)"], L.map((n, i) => [n, S[i].n, pc(S[i].avg), pct(S[i].pos, 0), pc(DD[i].med)])) + `<p class="note">Dal minimo dell'anno di midterm ai 12 mesi successivi: media ${pc(ms.avg)}, % positivi ${pct(ms.pos, 0)}, ${ms.n} casi. Ogni cella ha solo ~24 anni: la differenza tra anni del ciclo è statisticamente debole.</p>`,
      el => plot(el, [{ x: L, y: S.map(s => s.avg * 100), type: "bar", marker: { color: S.map((_, i) => i === best ? C.gold : "#a08033") }, text: S.map(s => pct(s.avg, 1)), textposition: "outside" }], { title: T("Rendimento medio S&P 500 per anno del ciclo"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%" }, hoverlabel: HL })); }
  // 2. partito
  { const D = pStat(Y.filter(x => PARTY8[x.y] === "D").map(x => x.r)), R = pStat(Y.filter(x => PARTY8[x.y] === "R").map(x => x.r));
    add("Politica e cicli", "Conta il partito alla Casa Bianca?", `Democratici ${pc(D.avg)} medio (${D.n} anni), Repubblicani ${pc(R.avg)} (${R.n} anni). La differenza dipende da pochi anni estremi (1931, 2008…) e da chi ereditava una crisi: non è un criterio d'investimento.`,
      table(pHead, [pRow("Presidente democratico", D), pRow("Presidente repubblicano", R)]) + `<p class="note">Anno attribuito al presidente in carica per la maggior parte dell'anno. Congresso, Fed e ciclo economico contano molto di più.</p>`); }
  // 3. stagionalità mensile
  const mr = []; for (let i = 1; i < full; i++) mr.push({ m: +M.m[i].slice(5, 7), y: +M.m[i].slice(0, 4), r: M.px[i] / M.px[i - 1] - 1 });
  { const MN = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"], S = MN.map((_, k) => pStat(mr.filter(x => x.m === k + 1).map(x => x.r)));
    const o = S.map((s, i) => [s.avg, i]).sort((a, b) => b[0] - a[0]);
    add("Calendario", "Ci sono mesi migliori di altri?", `Migliori in media: ${MN[o[0][1]]} (${pc(o[0][0])}) e ${MN[o[1][1]]}; peggiore: ${MN[o[11][1]]} (${pc(o[11][0])}). Differenze piccole rispetto alla variabilità di ogni singolo mese.`,
      table(["Mese", "Anni", "Media", "% positivi", "Peggiore"], MN.map((n, i) => [n, S[i].n, pc(S[i].avg), pct(S[i].pos, 0), pc(S[i].worst)])),
      el => plot(el, [{ x: MN, y: S.map(s => s.avg * 100), type: "bar", marker: { color: S.map(s => s.avg > 0 ? C.gold : C.red) }, customdata: S.map(s => pct(s.pos, 0)), hovertemplate: "%{x}: media %{y:.2f}% · positivo nel %{customdata}<extra></extra>" }], { title: T("Rendimento medio per mese (S&P 500)"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%" }, hoverlabel: HL })); }
  // 4. Sell in May
  { const W = [], Su = []; for (let y = 1929; y < P.cy; y++) { const a = mi.get(`${y - 1}-10`), b = mi.get(`${y}-04`), e = mi.get(`${y}-10`); if (a != null && b != null) W.push({ y, r: M.px[b] / M.px[a] - 1 }); if (b != null && e != null && e < full) Su.push({ y, r: M.px[e] / M.px[b] - 1 }); }
    const sw = pStat(W.map(x => x.r)), ss = pStat(Su.map(x => x.r)), beat = W.filter(w => { const s = Su.find(z => z.y === w.y); return s && w.r > s.r; }).length / W.length;
    add("Calendario", "«Sell in May and go away» funziona?", `Novembre–aprile ${pc(sw.avg)} medio contro ${pc(ss.avg)} di maggio–ottobre; l'inverno ha battuto l'estate nel ${pct(beat, 0)} degli anni. Ma anche l'estate è stata positiva nel ${pct(ss.pos, 0)} dei casi: uscire significava rinunciare a quei guadagni.`,
      table(pHead, [pRow("Novembre → aprile", sw), pRow("Maggio → ottobre", ss)])); }
  // 5. barometro di gennaio e primi 5 giorni
  { const rows = []; Y.forEach(x => { const a = lb(d, x.y + "-01-01") - 1, j = lb(d, x.y + "-02-01") - 1, e = lb(d, (x.y + 1) + "-01-01") - 1; if (a < 0) return; rows.push({ y: x.y, jan: c[j] / c[a] - 1, f5: c[a + 5] / c[a] - 1, rest: c[e] / c[j] - 1, rest5: c[e] / c[a + 5] - 1 }); });
    const jp = pStat(rows.filter(r => r.jan > 0).map(r => r.rest)), jn = pStat(rows.filter(r => r.jan <= 0).map(r => r.rest)), fp = pStat(rows.filter(r => r.f5 > 0).map(r => r.rest5)), fn = pStat(rows.filter(r => r.f5 <= 0).map(r => r.rest5));
    add("Calendario", "Gennaio (e i primi 5 giorni) predicono l'anno?", `Dopo un gennaio positivo il resto dell'anno ha reso ${pc(jp.avg)} (positivo nel ${pct(jp.pos, 0)}), dopo un gennaio negativo ${pc(jn.avg)} (positivo nel ${pct(jn.pos, 0)}): un indizio, non una regola — anche dopo gennaio negativo il resto dell'anno è stato spesso positivo.`,
      table(["Febbraio–dicembre dopo…", "Casi", "Media", "Mediana", "% positivi", "Peggiore"], [pRow("gennaio positivo", jp), pRow("gennaio negativo", jn)]) + table(["Resto dell'anno dopo…", "Casi", "Media", "Mediana", "% positivi", "Peggiore"], [pRow("primi 5 giorni positivi", fp), pRow("primi 5 giorni negativi", fn)])); }
  // 6. Babbo Natale
  { const sr = [], dec = []; Y.forEach(x => { const e = lb(d, (x.y + 1) + "-01-01") - 1; if (e + 2 >= d.length || e < 5) return; sr.push(c[e + 2] / c[e - 5] - 1); const a = lb(d, x.y + "-12-01") - 1; dec.push(c[e] / c[a] - 1); });
    const s = pStat(sr), all7 = []; for (let i = 0; i + 7 < d.length; i += 7) all7.push(c[i + 7] / c[i] - 1); const b = pStat(all7), dc = pStat(dec);
    add("Calendario", "Esiste il «rally di Babbo Natale»?", `Ultimi 5 giorni di dicembre + primi 2 di gennaio: ${pc(s.avg)} medio, positivo nel ${pct(s.pos, 0)} dei casi, contro ${pc(b.avg)} e ${pct(b.pos, 0)} di 7 giorni qualsiasi. Dicembre intero: ${pc(dc.avg)} medio, positivo nel ${pct(dc.pos, 0)}.`,
      table(pHead, [pRow("Rally di Natale (7 giorni)", s), pRow("7 giorni qualsiasi", b), pRow("Dicembre", dc)])); }
  // 7. dopo anni estremi
  { const nx = f => pStat(Y.filter(f).map(x => Ym.get(x.y + 1) ? Ym.get(x.y + 1).r : null)), all = pStat(Y.map(x => x.r));
    const up = nx(x => x.r >= 0.2), dn = nx(x => x.r <= -0.2), two = nx(x => x.r <= 0 && Ym.get(x.y - 1) && Ym.get(x.y - 1).r <= 0);
    add("Dopo eventi estremi", "Cosa succede dopo un anno molto buono o molto cattivo?", `Dopo un anno sopra +20%: ${pc(up.avg)} medio l'anno dopo (positivo nel ${pct(up.pos, 0)}). Dopo un anno sotto −20%: ${pc(dn.avg)} (${dn.n} casi). Un grande anno non «esaurisce» il mercato.`,
      table(["L'anno successivo a…", "Casi", "Media", "Mediana", "% positivi", "Peggiore"], [pRow("un anno ≥ +20%", up), pRow("un anno ≤ −20%", dn), pRow("2 anni negativi di fila", two), pRow("un anno qualsiasi", all)]) + `<p class="note">${few(Math.min(dn.n, two.n))}</p>`); }
  // 8. dopo un massimo storico
  { const ath = []; let pk = 0, lastM = ""; for (let i = 0; i < full; i++) { if (M.px[i] > pk) { pk = M.px[i]; if (i > 12) ath.push(i); } }
    const H = [[1, "1 mese"], [3, "3 mesi"], [12, "12 mesi"], [60, "5 anni (annuo)"]], allI = Array.from({ length: full - 13 }, (_, i) => i + 13);
    const A = H.map(([h]) => pStat(ath.map(i => fwdM(i, h)))), B = H.map(([h]) => pStat(allI.map(i => fwdM(i, h))));
    add("Dopo eventi estremi", "Conviene comprare quando il mercato è ai massimi storici?", `Dopo una chiusura mensile su un nuovo massimo, nei 12 mesi successivi: ${pc(A[2].avg)} medio, positivo nel ${pct(A[2].pos, 0)}, contro ${pc(B[2].avg)} e ${pct(B[2].pos, 0)} di un mese qualsiasi. I massimi non sono stati un segnale di pericolo.`,
      table(["Dopo", "Massimi: media", "Massimi: % positivi", "Qualsiasi mese: media", "Qualsiasi: % positivi"], H.map(([, n], j) => [n, pc(A[j].avg), pct(A[j].pos, 0), pc(B[j].avg), pct(B[j].pos, 0)])) + `<p class="note">${ath.length} mesi chiusi su un massimo storico (dati di fine mese).</p>`); }
  // 9. mercato orso
  { const ent = [], bot = []; let pk = c[0], inB = false, tI = 0; for (let i = 1; i < d.length; i++) { if (c[i] >= pk) { if (inB) bot.push(tI); inB = false; pk = c[i]; continue; } if (!inB && c[i] / pk - 1 <= -0.2) { inB = true; ent.push(i); tI = i; } if (inB && c[i] < c[tI]) tI = i; }
    const f = (L, n) => pStat(L.map(i => { const r = fwdD(i, n); return r == null ? null : n > 252 ? (1 + r) ** (252 / n) - 1 : r; })), E = [252, 756, 1260].map(n => f(ent, n)), Bt = [252, 756, 1260].map(n => f(bot, n));
    add("Dopo eventi estremi", "Cosa succede dopo un mercato «orso» (−20%)?", `Comprando il giorno in cui il calo dal massimo tocca −20%: ${pc(E[0].avg)} medio a 1 anno (positivo nel ${pct(E[0].pos, 0)}), ${pc(E[2].avg)} l'anno a 5 anni. Dal minimo esatto (impossibile da individuare in tempo): ${pc(Bt[0].avg)} a 1 anno.${few(ent.length)}`,
      table(["Acquisto", "Casi", "1 anno: media", "% positivi", "3 anni (annuo)", "5 anni (annuo)", "5 anni: peggiore"], [["quando il calo tocca −20%", ent.length, pc(E[0].avg), pct(E[0].pos, 0), pc(E[1].avg), pc(E[2].avg), pc(E[2].worst)], ["al minimo del mercato orso", bot.length, pc(Bt[0].avg), pct(Bt[0].pos, 0), Bt[1] ? pc(Bt[1].avg) : "–", Bt[2] ? pc(Bt[2].avg) : "–", Bt[2] ? pc(Bt[2].worst) : "–"]]) + `<p class="note">Date di ingresso: ${ent.map(i => d[i].slice(0, 7)).join(", ")}.</p>`); }
  // 10. Fed: primo taglio e primo rialzo
  const REC = SG.USREC ? new Map(SG.USREC.d.map((k, i) => [k, SG.USREC.v[i]])) : new Map(), recWithin = (k, n) => { const i = mi.get(k); for (let j = 0; j <= n; j++) if (i != null && M.m[i + j] && REC.get(M.m[i + j]) === 1) return true; return false; };
  if (window.MACRO && MACRO.fedcuts) { const ev = [...MACRO.fedcuts.map(x => ({ d: x[0], t: "c" })), ...MACRO.fedhikes.map(x => ({ d: x[0], t: "h" }))].sort((a, b) => a.d < b.d ? -1 : 1);
    const first = t => ev.filter((e, i) => e.t === t && (i === 0 || ev[i - 1].t !== t) && (i === 0 || (new Date(e.d) - new Date(ev[i - 1].d)) > 1.5e10 || ev[i - 1].t !== t)).filter((e, i, a) => i === 0 || (new Date(e.d) - new Date(a[i - 1].d)) > 1.5e10);
    const fc = first("c"), fh = first("h"), r12 = e => fwdD(lb(d, e.d), 252);
    const cR = pStat(fc.filter(e => recWithin(e.d.slice(0, 7), 12)).map(r12)), cN = pStat(fc.filter(e => !recWithin(e.d.slice(0, 7), 12)).map(r12)), hA = pStat(fh.map(r12));
    add("Economia e Fed", "Cosa fa la Borsa dopo il primo taglio (o rialzo) dei tassi Fed?", `Primo taglio senza recessione nei 12 mesi dopo: ${cN ? pc(cN.avg) : "–"} medio; con recessione: ${cR ? pc(cR.avg) : "–"}. Conta il motivo del taglio, non il taglio in sé. Dopo il primo rialzo: ${pc(hA.avg)} medio.${few(fc.length)}`,
      table(["S&P 500 12 mesi dopo…", "Casi", "Media", "Mediana", "% positivi", "Peggiore"], [pRow("primo taglio, nessuna recessione entro 12 mesi", cN), pRow("primo taglio, recessione entro 12 mesi", cR), pRow("primo rialzo", hA)]) + `<p class="note">Primo movimento dopo almeno 6 mesi senza movimenti nella stessa direzione (target Fed dal 1982, dati piattaforma). Primi tagli: ${fc.map(e => e.d.slice(0, 7)).join(", ")}. Recessioni: NBER (FRED USREC).</p>`); }
  // 11. recessioni
  { const R = []; let st = null; (SG.USREC ? SG.USREC.d : []).forEach((k, i) => { const v = SG.USREC.v[i]; if (v === 1 && st == null) st = k; if (v === 0 && st != null) { R.push([st, SG.USREC.d[i - 1]]); st = null; } });
    const RR = R.filter(([a]) => a >= "1929-01").map(([a, b]) => { const i = mi.get(a), j = mi.get(b); if (i == null || j == null) return null; let pkI = i - 12 < 0 ? 0 : i - 12; for (let k = Math.max(0, i - 12); k <= j; k++) if (M.px[k] > M.px[pkI]) pkI = k; let lo = i; for (let k = i; k <= Math.min(full - 1, j + 12); k++) if (M.px[k] < M.px[lo]) lo = k;
      return { a, b, pre: M.px[i] / M.px[Math.max(0, i - 6)] - 1, dur: M.px[j] / M.px[i] - 1, post: j + 12 < full ? M.px[j + 12] / M.px[j] - 1 : null, lead: i - pkI, lowVsEnd: lo - j }; }).filter(Boolean);
    const lowB = RR.filter(r => r.lowVsEnd < 0).length;
    add("Economia e Fed", "Come si comporta la Borsa nelle recessioni?", `Durante le recessioni ufficiali l'S&P 500 ha fatto in media ${pc(mean(RR.map(r => r.dur)))}, ma nei 12 mesi dopo la fine ${pc(mean(RR.filter(r => r.post != null).map(r => r.post)))}. Il minimo della Borsa è arrivato prima della fine della recessione in ${lowB} casi su ${RR.length}: aspettare la «fine ufficiale» significa rientrare tardi.`,
      table(["Recessione", "6 mesi prima", "Durante", "12 mesi dopo la fine", "Mesi tra picco Borsa e inizio", "Minimo Borsa vs fine recessione"], RR.map(r => [`${r.a} → ${r.b}`, pc(r.pre), pc(r.dur), r.post != null ? pc(r.post) : "–", r.lead, r.lowVsEnd < 0 ? `${-r.lowVsEnd} mesi prima` : r.lowVsEnd === 0 ? "stesso mese" : `${r.lowVsEnd} mesi dopo`])) + `<p class="note">Date NBER (FRED USREC), annunciate ufficialmente molti mesi dopo. Prezzi di fine mese.</p>`); }
  // 12. curva invertita
  if (SG.T10Y2Y) { const yc = SG.T10Y2Y, inv = []; let run = 0; yc.d.forEach((k, i) => { if (yc.v[i] < 0) { if (run >= 12) inv.push(k); run = 0; } else run++; });
    const rk = SG.USREC.d, rv = SG.USREC.v, nextRec = k => { for (let i = 0; i < rk.length; i++) if (rk[i] > k && rv[i] === 1 && (i === 0 || rv[i - 1] === 0)) return rk[i]; return null; };
    const rows = inv.filter(k => k < CUR_M).map(k => { const r = nextRec(k), mo = r ? (+r.slice(0, 4) - +k.slice(0, 4)) * 12 + (+r.slice(5) - +k.slice(5)) : null, i = mi.get(k), j = r ? mi.get(r) : null; return { k, r, mo: mo != null && mo <= 36 ? mo : null, sp: i != null && j != null && mo <= 36 ? M.px[j] / M.px[i] - 1 : null }; });
    const hit = rows.filter(r => r.mo != null);
    add("Economia e Fed", "Dopo l'inversione della curva dei tassi, quando arriva la recessione?", `${hit.length} inversioni su ${rows.length} sono state seguite da una recessione entro 3 anni, dopo in media ${num(mean(hit.map(r => r.mo)), 0)} mesi ${hit.length ? `(da ${Math.min(...hit.map(r => r.mo))} a ${Math.max(...hit.map(r => r.mo))})` : ""}. Nel frattempo la Borsa ha fatto in media ${pc(mean(hit.filter(r => r.sp != null).map(r => r.sp)))}: vendere subito all'inversione è stato spesso prematuro.${few(rows.length)}`,
      table(["Prima inversione (10a − 2a)", "Recessione entro 3 anni", "Mesi di ritardo", "S&P 500 nel frattempo"], rows.map(r => [r.k, r.mo != null ? r.r : "no", r.mo != null ? r.mo : "–", r.sp != null ? pc(r.sp) : "–"])) + `<p class="note">Curva FRED T10Y2Y (dal 1976), fine mese. Inversione = primo mese sotto zero dopo almeno 12 mesi positivi.</p>`); }
  // 13. inflazione
  if (window.MACRO && MACRO.cpi) { const cp = new Map(MACRO.cpi.d.map((k, i) => [k.slice(0, 7), MACRO.cpi.v[i]])), yoy = k => { const [y, m] = k.split("-"); const p = cp.get(`${+y - 1}-${m}`); return p && cp.has(k) ? cp.get(k) / p - 1 : null; };
    const g = [[x => x < 0.02, "sotto 2%"], [x => x >= 0.02 && x < 0.04, "2–4%"], [x => x >= 0.04 && x < 0.06, "4–6%"], [x => x >= 0.06, "sopra 6%"]];
    const S = g.map(([f]) => { const r = [], rr = []; for (let i = 0; i < full - 12; i++) { const k = M.m[i], v = yoy(k); if (v == null || !f(v)) continue; const fr = fwdM(i, 12), k2 = M.m[i + 12], ci = cp.get(k2) && cp.get(k) ? cp.get(k2) / cp.get(k) : null; r.push(fr); if (ci) rr.push((1 + fr) / ci - 1); } return [pStat(r), pStat(rr)]; });
    add("Economia e Fed", "Con inflazione alta la Borsa rende meno?", `Con inflazione USA sopra il 6% l'S&P 500 ha reso in media ${pc(S[3][0].avg)} nei 12 mesi dopo (in termini reali ${pc(S[3][1].avg)}), contro ${pc(S[1][0].avg)} (${pc(S[1][1].avg)} reale) con inflazione 2–4%. L'inflazione alta ha pesato soprattutto sui rendimenti reali.`,
      table(["Inflazione USA (annua) a inizio periodo", "Mesi", "S&P 12 mesi dopo: media", "% positivi", "Reale (al netto inflazione): media"], g.map(([, n], i) => [n, S[i][0] ? S[i][0].n : 0, S[i][0] ? pc(S[i][0].avg) : "–", S[i][0] ? pct(S[i][0].pos, 0) : "–", S[i][1] ? pc(S[i][1].avg) : "–"])) + `<p class="note">CPI USA (FRED CPIAUCSL / BLS, dal 1913). Mesi sovrapposti: i casi non sono indipendenti.</p>`); }
  // 14. dollaro per investitore europeo
  if (window.MACRO && MACRO.eur) { const fx = sgMonths(MACRO.eur.d, MACRO.eur.v), fm = new Map(fx.m.map((k, i) => [k, fx.px[i]])), rows = [];
    Y.filter(x => x.y >= 2000).forEach(x => { const a = fm.get(`${x.y - 1}-12`), b = fm.get(`${x.y}-12`); if (a && b) { const usd = x.r, dollar = a / b - 1; rows.push({ y: x.y, usd, eur: (1 + usd) * (1 + dollar) - 1, dollar }); } });
    const up = pStat(rows.filter(r => r.dollar > 0).map(r => r.eur - r.usd)), dn = pStat(rows.filter(r => r.dollar <= 0).map(r => r.eur - r.usd));
    add("Valute", "Il dollaro forte o debole cambia il risultato per un investitore in euro?", `Negli anni di dollaro in rialzo l'S&P 500 in euro ha reso in media ${num(Math.abs(up.avg) * 100, 1)}% ${up.avg >= 0 ? "in più" : "in meno"} che in dollari (${up.n} anni); negli anni di dollaro in calo ${num(Math.abs(dn.avg) * 100, 1)}% ${dn.avg >= 0 ? "in più" : "in meno"} (${dn.n} anni). Il dollaro forte aiuta chi investe in euro, quello debole pesa. Il cambio aggiunge oscillazioni di ±10% in un anno, ma nel lungo periodo tende a compensarsi.`,
      table(["Anno", "S&P 500 in USD", "Dollaro vs euro (+ = dollaro più forte)", "S&P 500 in EUR"], rows.map(r => [r.y, pc(r.usd), pc(r.dollar), pc(r.eur)])) + `<p class="note">Cambio BCE di fine anno (FRED DEXUSEU). S&P 500 solo prezzo.</p>`); }
  // 15. migliori giorni (asset scelto se giornaliero)
  { const S = SA && SA.daily ? SA : { name: "S&P 500 (solo prezzo)", d, c }, y0 = +$("#cmY0").value || 0, y1 = +$("#cmY1").value || 9999, a = Math.max(1, lb(S.d, y0 ? y0 + "-01-01" : "0")), b = lb(S.d, (y1 < 9999 ? y1 + "-12-31" : "9999") + "~") - 1;
    const r = []; for (let i = a; i <= b; i++) r.push({ i, r: S.c[i] / S.c[i - 1] - 1 }); const srt = r.slice().sort((p, q) => q.r - p.r), tot = r.reduce((v, x) => v * (1 + x.r), 1);
    const miss = n => { const sk = new Set(srt.slice(0, n).map(x => x.i)); return r.reduce((v, x) => sk.has(x.i) ? v : v * (1 + x.r), 1); }, worst = new Set(srt.slice(-20).map(x => x.i)), best10 = srt.slice(0, 10);
    const near = best10.filter(x => [...worst].some(w => Math.abs(w - x.i) <= 10)).length, yrs = (b - a) / 252, cg = v => v ** (1 / yrs) - 1;
    add("Restare investiti", "Quanto costa perdere i giorni migliori?", `Su ${num(yrs, 0)} anni (${S.name.replace(/ \(.*\)/, "")}), 10.000 sempre investiti diventano ${num(1e4 * tot, 0)}; perdendo solo i 10 giorni migliori ${num(1e4 * miss(10), 0)}. ${near} dei 10 giorni migliori sono arrivati entro 2 settimane da uno dei 20 giorni peggiori: chi esce nel panico spesso perde il rimbalzo.`,
      table(["Strategia", "10.000 diventano", "Rend. annuo"], [["Sempre investito", num(1e4 * tot, 0), pc(cg(tot), 2)], ...[10, 20, 30, 50].map(n => [`Senza i ${n} giorni migliori`, num(1e4 * miss(n), 0), pc(cg(miss(n)), 2)])]) + `<p class="note">Periodo ${S.d[a]} → ${S.d[b]}. Indici di prezzo senza dividendi. Usa l'asset scelto in alto se ha dati giornalieri, altrimenti l'S&P 500.</p>`); }
  // 16. decenni (asset scelto)
  { const Ya = cmYears(SA || { d, c, daily: true }).filter(x => !x.partial), dec = {}; Ya.forEach(x => { const k = Math.floor(x.y / 10) * 10; (dec[k] = dec[k] || []).push(x); });
    const rows = Object.keys(dec).map(k => { const a = dec[k], g = a.reduce((v, x) => v * (1 + x.r), 1); return [`${k}–${+k + 9}${a.length < 10 ? " (parziale)" : ""}`, a.length, pc(g ** (1 / a.length) - 1, 1), pc(g - 1, 0), `${a.filter(x => x.r > 0).length} su ${a.length}`]; });
    const neg = rows.filter(r => r[3].includes("−") || r[3].includes("-")).length;
    add("Lungo periodo", "Come sono andati i diversi decenni?", `${(SA ? SA.name : "S&P 500").replace(/ \(.*\)/, "")}: ${neg ? `${neg} decenni su ${rows.length} chiusi in perdita` : "nessun decennio chiuso in perdita"}. Anche i decenni buoni contengono anni pessimi.`, table(["Decennio", "Anni", "Rend. annuo", "Totale", "Anni positivi"], rows)); }
  // 17. probabilità di guadagno per durata (asset scelto)
  { const S = SA || { d, c }, MM = sgMonths(S.d, S.c), n = MM.m.length - (MM.m[MM.m.length - 1] >= CUR_M ? 1 : 0), H = [1, 5, 10, 20], res = H.map(h => { const r = []; for (let i = 0; i + h * 12 < n; i++) r.push((MM.px[i + h * 12] / MM.px[i]) ** (1 / h) - 1); return pStat(r); });
    add("Lungo periodo", "Più a lungo resto investito, più spesso guadagno?", `${(S.name || "S&P 500").replace(/ \(.*\)/, "")}: positivo nel ${pct(res[0].pos, 0)} dei periodi di 1 anno, ${res[1] ? pct(res[1].pos, 0) : "–"} a 5 anni, ${res[2] ? pct(res[2].pos, 0) : "–"} a 10, ${res[3] ? pct(res[3].pos, 0) : "–"} a 20 anni. Il tempo riduce il rischio di chiudere in perdita.`,
      table(["Durata", "Periodi", "% positivi", "Rend. annuo medio", "Peggiore (annuo)", "Migliore (annuo)"], H.map((h, i) => res[i] ? [`${h} ${h === 1 ? "anno" : "anni"}`, res[i].n, pct(res[i].pos, 0), pc(res[i].avg), pc(res[i].worst), pc(res[i].best)] : [`${h} anni`, 0, "–", "–", "–", "–"])) + `<p class="note">Partenze ogni fine mese (periodi sovrapposti).</p>`,
      el => plot(el, [{ x: H.map(h => h + (h === 1 ? " anno" : " anni")), y: res.map(s => s ? s.pos * 100 : null), type: "bar", marker: { color: C.gold }, text: res.map(s => s ? pct(s.pos, 0) : ""), textposition: "outside" }], { title: T("% di periodi chiusi in guadagno"), xaxis: { type: "category" }, yaxis: { ticksuffix: "%", range: [0, 110] }, hoverlabel: HL })); }
  // render
  const groups = [...new Set(cases.map(x => x.grp))];
  window.__patLast = cases.map(x => ({ q: x.q, v: x.verdict.replace(/<[^>]+>/g, "") }));
  box.innerHTML = `<div class="card"><h3>Schemi storici: le domande più frequenti, in breve</h3><p class="muted">Dove non indicato, S&amp;P 500 solo prezzo in dollari dal 1928 (Yahoo Finance ^GSPC, dati giornalieri): dividendi esclusi. Le ultime tre schede usano l'asset scelto in alto. Clicca una domanda per i dettagli.</p>
   <div class="patgrid nopdf">${cases.map((x, i) => `<a href="#pat${i}" class="patcell" data-pat="${i}"><b>${x.q}</b><span>${x.verdict.replace(/<span class="warn">.*?<\/span>/g, "")}</span></a>`).join("")}</div></div>
   ${groups.map(g => `<details class="more patgrp" open><summary class="pickhead">${g}</summary>${cases.map((x, i) => x.grp !== g ? "" : `<details class="card patcard" id="pat${i}"><summary><h3 class="patq">${x.q}</h3></summary><div class="answer">${x.verdict}</div>${x.chart ? `<div id="patc${i}" class="chart"></div>` : ""}<div class="scrollx">${x.body}</div></details>`).join("")}</details>`).join("")}`;
  cases.forEach((x, i) => { if (!x.chart) return; const card = $("#pat" + i); const draw = () => { if (card.open && !card.dataset.drawn) { card.dataset.drawn = 1; x.chart("patc" + i); } }; card.addEventListener("toggle", draw); draw(); });
  box.querySelectorAll("[data-pat]").forEach(a => a.onclick = e => { e.preventDefault(); const cd = $("#pat" + a.dataset.pat); cd.open = true; cd.dispatchEvent(new Event("toggle")); cd.scrollIntoView({ behavior: "smooth" }); });
}
{ const _r = runCM; runCM = function () { _r(); try { if (!$("#cmPat")) $("#cmOut").insertAdjacentHTML("beforeend", `<div id="cmPat"></div>`); renderPatterns();
    const bt = $("#cmPdf"); if (bt) bt.onclick = e => withBusy(e.target, () => makePdf({ title: "Comportamento dei mercati", sub: window.__cmLast || "", file: pdfName("Comportamento_dei_mercati"), parts: [{ tab: "cm", root: "#cmOut", before: async () => { document.querySelectorAll("#cmPat details").forEach(d => { d.open = true; d.dispatchEvent(new Event("toggle")); }); await new Promise(r => setTimeout(r, 1200)); } }] }));
  } catch (e) { console.error(e); } }; }
