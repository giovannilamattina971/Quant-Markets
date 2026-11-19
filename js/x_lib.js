"use strict";
/* ===== v9: funzioni comuni delle pagine nuove (serie, indicatori, percentili, PDF) ===== */
window.XR = window.XR || {};
const XL = {};
// serie {d,c} da qualsiasi dataset: "MKT:^GSPC", "ASSETS:GLD", "XTRA:GC=F", "CURVE:DGS10" (v), …
XL.get = ref => { const [ds, k] = ref.split(/:(.+)/); const o = (window[ds] || {})[k]; if (!o || !o.d) return null; const c = o.c || o.v; return { d: o.d, c, name: o.name || k }; };
XL.has = ref => { const s = XL.get(ref); return !!(s && s.d.length > 30); };
XL.sma = (a, n) => { const o = new Array(a.length).fill(NaN); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
XL.ema = (a, n) => { const k = 2 / (n + 1), o = []; let e = a[0]; a.forEach((x, i) => { e = i ? x * k + e * (1 - k) : x; o.push(e); }); return o; };
XL.rsi = (c, n = 14) => { const o = new Array(c.length).fill(NaN); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0); if (i <= n) { g += up / n; l += dn / n; if (i === n) o[i] = 100 - 100 / (1 + g / (l || 1e-12)); } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = 100 - 100 / (1 + g / (l || 1e-12)); } } return o; };
XL.dd = c => { let m = -Infinity; return c.map(x => { if (x > m) m = x; return x / m - 1; }); };
XL.ret = (c, n) => c.map((x, i) => i >= n ? x / c[i - n] - 1 : NaN);
XL.fwd = (c, n) => c.map((x, i) => i + n < c.length ? c[i + n] / x - 1 : NaN);
XL.vol = (c, n = 21, ann = 252) => { const r = c.map((x, i) => i ? Math.log(x / c[i - 1]) : 0), o = new Array(c.length).fill(NaN); let s = 0, s2 = 0; for (let i = 1; i < c.length; i++) { s += r[i]; s2 += r[i] * r[i]; if (i > n) { s -= r[i - n]; s2 -= r[i - n] * r[i - n]; } if (i >= n) o[i] = Math.sqrt(Math.max(0, (s2 - s * s / n) / (n - 1)) * ann); } return o; };
// percentile del valore x nella distribuzione a (0..1)
XL.pctl = (a, x) => { const b = a.filter(v => isFinite(v)); if (!b.length || !isFinite(x)) return NaN; let n = 0; for (const v of b) if (v < x) n++; return n / b.length; };
XL.q = (a, p) => { const b = a.filter(v => isFinite(v)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p, lo = Math.floor(i); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (i - lo); };
XL.z = (a, x) => { const b = a.filter(v => isFinite(v)); return (x - mean(b)) / std(b); };
// livelli di fine mese {k:"YYYY-MM", c}
XL.monthly = s => { const m = new Map(); s.d.forEach((d, i) => m.set(d.slice(0, 7), s.c[i])); const k = [...m.keys()]; return { d: k, c: k.map(x => m.get(x)) }; };
XL.weekly = s => { const d = [], c = []; for (let i = 0; i < s.d.length; i++) { const t = new Date(s.d[i] + "T12:00:00Z"), nx = s.d[i + 1] ? new Date(s.d[i + 1] + "T12:00:00Z") : null; if (!nx || nx.getUTCDay() < t.getUTCDay() || (nx - t) > 4 * DAY) { d.push(s.d[i]); c.push(s.c[i]); } } return { d, c }; };
// allinea più serie sulle date comuni
XL.align = list => { const maps = list.map(s => new Map(s.d.map((d, i) => [d, s.c[i]]))); const d = list[0].d.filter(x => maps.every(m => m.has(x))); return { d, cs: maps.map(m => d.map(x => m.get(x))) }; };
// valore di una serie a una data (ultimo disponibile prima o uguale)
XL.at = (s, date) => { const i = lb(s.d, date + "~") - 1; return i >= 0 ? s.c[i] : NaN; };
XL.cagr = (c, years) => Math.pow(c[c.length - 1] / c[0], 1 / years) - 1;
XL.yrs = (d0, d1) => (Date.parse(d1) - Date.parse(d0)) / YR;
XL.statsRow = a => { const b = a.filter(isFinite); return { n: b.length, mean: mean(b), med: median(b), pos: fracPos(b), p10: XL.q(b, .1), p90: XL.q(b, .9), min: Math.min(...b), max: Math.max(...b) }; };
// recessioni USA come rettangoli di sfondo per Plotly
XL.recShapes = (from = "1900-01") => { const R = window.SIGNALS && SIGNALS.USREC; if (!R) return []; const out = []; let st = null; R.d.forEach((d, i) => { if (R.v[i] && !st) st = d; if ((!R.v[i] || i === R.d.length - 1) && st) { if (d >= from) out.push({ type: "rect", xref: "x", yref: "paper", x0: st + "-01", x1: d + "-01", y0: 0, y1: 1, fillcolor: "rgba(140,140,153,.15)", line: { width: 0 }, layer: "below" }); st = null; } }); return out; };
// semaforo da percentile
XL.heat = p => !isFinite(p) ? "h0" : p >= .95 ? "h-3" : p >= .85 ? "h-2" : p >= .7 ? "h-1" : p <= .05 ? "h3" : p <= .15 ? "h2" : p <= .3 ? "h1" : "h0";
XL.verdict = p => !isFinite(p) ? ["–", "neu"] : p >= .9 ? ["Euforia", "hot"] : p >= .7 ? ["Caldo", "hot"] : p <= .1 ? ["Panico", "cold"] : p <= .3 ? ["Freddo", "cold"] : ["Neutro", "neu"];
XL.pp = p => isFinite(p) ? Math.round(p * 100) + "°" : "–";
// pulsante PDF per una pagina nuova
XL.pdfBtn = (id, title, sub) => `<div class="toolbar nopdf"><button class="primary pdfbtn" data-xpdf="${id}" data-t="${title.replace(/"/g, "&quot;")}" data-s="${(sub || "").replace(/"/g, "&quot;")}">📄 Scarica PDF di questa pagina</button></div>`;
document.addEventListener("click", e => { const b = e.target.closest("[data-xpdf]"); if (!b) return; const id = b.dataset.xpdf; withBusy(b, () => makePdf({ title: b.dataset.t, sub: b.dataset.s, file: pdfName(b.dataset.t.replace(/[^\w]+/g, "_")), parts: [{ tab: id, root: "#" + id }] })); });
// istogramma comparativo
XL.histo = (el, sets, title, xfmt = "%") => plot(el, sets.map(([name, a, col]) => ({ type: "histogram", name, x: a.filter(isFinite).map(v => xfmt === "%" ? v * 100 : v), histnorm: "percent", opacity: .6, marker: { color: col }, nbinsx: 40 })),
  { title, barmode: "overlay", xaxis: { title: { text: xfmt === "%" ? "Rendimento %" : "" }, ticksuffix: xfmt === "%" ? "%" : "" }, yaxis: { title: { text: "% dei casi" } }, hovermode: "closest" });
// selettore
XL.sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${v === val ? "selected" : ""}>${t}</option>`).join("")}</select>`;
XL.out = id => document.getElementById(id + "Out");
// grafici rimasti vuoti perché una fonte non è ancora disponibile: messaggio al posto dello spazio bianco
XL.empties = o => o.querySelectorAll(".chart").forEach(c => { if (!c.classList.contains("js-plotly-plot") && !c.innerHTML.trim()) { c.style.height = "auto"; c.innerHTML = `<p class="note">Grafico non disponibile: la fonte di questi dati (FRED, Federal Reserve) non ha ancora risposto all'aggiornamento automatico. Comparirà da solo al prossimo aggiornamento riuscito.</p>`; } });
// prepara una pagina: carica i dati pesanti una volta sola, poi disegna
XL.page = (id, datasets, render) => { XR[id] = () => { const o = XL.out(id); if (o.dataset.ok) { window.dispatchEvent(new Event("resize")); return; } o.innerHTML = loadingHtml(); needData(datasets).then(() => { o.dataset.ok = 1; try { render(o); XL.empties(o); } catch (e) { console.error(e); o.innerHTML = `<div class="card warn">Errore nel calcolo: ${e.message}</div>`; } }); }; };
