"use strict";
/* ===== v3: estensioni Backtest & Portafogli (PDF presentazione cliente) ===== */
function multiExtras() { // pulsante PDF del Laboratorio (blocchi costi, attuale vs proposta e peso oro/EM rimossi)
  const host = $("#multiOut"); if (!host || $("#cliPdf2")) return;
  host.insertAdjacentHTML("afterbegin", `<div class="toolbar nopdf"><button id="cliPdf2" class="primary pdfbtn">📄 Scarica presentazione cliente (portafogli)</button></div>`);
  $("#cliPdf2").onclick = e => withBusy(e.target, clientPdf);
}
async function clientPdf() {
  return makePdf({ title: "Presentazione per il cliente", sub: "Portafoglio, confronto con i benchmark e principali evidenze storiche", file: pdfName("Presentazione_cliente"),
    parts: [{ tab: "multi", wait: 1200, root: () => $("#pfOut").closest(".card") }, { newPage: true, root: "#feCard" },
      { tab: "timing", wait: 800, newPage: true, root: "#timOut" }, { tab: "pres", wait: 1200, newPage: true, root: "#presOut" }] });
}
