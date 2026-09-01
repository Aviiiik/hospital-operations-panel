import { toast } from "sonner";

// ─── Repeating header/footer mechanism for multi-page IPD prints ─────────────
// Every wrapped print doc is a <table class="doc-grid">:
//  - <thead> holds the page header — the browser natively repeats it at the top
//    of every printed page and keeps body content clear of it (no position:fixed
//    on the header, so no Chrome "fixed = relative to content area" overlap);
//  - each section is its own <tbody> row, so no single cell is ever taller than
//    a page — Chrome stops repeating <thead> the moment a cell overflows a page;
//  - <tfoot> reserves a blank strip at the bottom of every page that the
//    position:fixed .print-footer is painted into, so the footer sits at the
//    page bottom on every page (incl. a short last page) without colliding;
//  - long itemised tables are split with chunkTableSections() so their own
//    column <thead> repeats on each chunk too.
// Bespoke pages (IpdDischarge / IpdReceipt) prepend DOC_GRID_CSS to their own
// stylesheet and use wrapPrintDoc() with their own header/footer markup.
export const DOC_GRID_CSS = `
  .doc-grid { width: 100%; border-collapse: collapse; }
  .doc-grid > thead { display: table-header-group; }
  .doc-grid > tfoot { display: table-footer-group; }
  .doc-grid > thead > tr > td,
  .doc-grid > tbody > tr > td,
  .doc-grid > tfoot > tr > td { padding: 0; border: 0; vertical-align: top; }
  .doc-grid .foot-space { height: 46px; }
  .doc-section > h2:first-child, .doc-section > p:first-child { margin-top: 4px; }
  .doc-section table.chunk { table-layout: fixed; }
  .doc-section table.chunk th, .doc-section table.chunk td { overflow-wrap: anywhere; }
  /* Uniform gap between the repeating page header and the body on every printed
     page (including continuation pages). Lives on the <thead> cell so it is part
     of the header band that the print engine repeats. */
  @media print { .doc-grid > thead > tr > td { padding-bottom: 30px; } }
`;

// Bordered hospital-identity box used as the repeating <thead> header on the
// pharmacy / investigation / receipt prints (billing has its own taller variant).
// Short + fixed-height + flex-only so Chrome resolves its size and repeats it on
// every printed page. `.doc-title` is the per-document caption that goes in the
// first body section (page 1 only).
export const HOSPITAL_HEADER_CSS = `
  .hosp-header { display: block; }
  .hosp-box { display: flex; align-items: stretch; border: 1.5px solid #111; }
  .hosp-box-logo { display: flex; align-items: center; justify-content: center;
    padding: 8px 16px; border-right: 1.5px solid #111; }
  .hosp-box-logo img { width: 92px; height: 92px; object-fit: contain; }
  .hosp-box-info { flex: 1; text-align: center; padding: 8px 12px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .hb-name { font-size: 15px; font-weight: bold; letter-spacing: .02em; color: #111; }
  .hb-line { font-size: 9px; color: #333; margin-top: 1px; }
  .hb-reg  { font-size: 9px; font-weight: bold; margin-top: 2px; color: #111; }
  .doc-title { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: .08em;
    text-transform: uppercase; text-decoration: underline; margin: 4px 0 12px; color: #111; }
  @media print  { .hosp-header { height: 120px; overflow: hidden; margin: 0 0 4px; } }
  @media screen { .hosp-header { margin-bottom: 14px; } }
`;

export function hospitalHeaderHtml(logo: string) {
  return `
<div class="hosp-header">
  <div class="hosp-box">
    <div class="hosp-box-logo"><img src="${logo}" alt="Logo"/></div>
    <div class="hosp-box-info">
      <div class="hb-name">AROGYA MATERNITY &amp; NURSING HOME</div>
      <div class="hb-line">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
      <div class="hb-line">(Licence Under W.B. Clinical Establishment Act)</div>
      <div class="hb-reg">Regd. No: 34257492</div>
      <div class="hb-line">71, Tollygunge Circular Road, Kolkata-700053 (New Alipore, Sital Sadan Compound)</div>
      <div class="hb-line">Phone: (033) 2400-0681 / 0684 &nbsp;|&nbsp; Fax: (033) 2400-1180</div>
    </div>
  </div>
</div>`;
}

export const PRINT_BASE_CSS = `
  ${DOC_GRID_CSS}
  ${HOSPITAL_HEADER_CSS}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
  h1  { font-size: 22px; font-weight: bold; color: #b91c1c; letter-spacing: 0.03em; }
  h2  { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em;
        color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
  th  { background: #f3f4f6; padding: 5px 8px; text-align: left; border: 1px solid #d1d5db; font-size: 10px; text-transform: uppercase; }
  td  { padding: 4px 8px; border: 1px solid #e5e7eb; }
  .right  { text-align: right; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .sub    { color: #6b7280; }
  .total-row { background: #f9fafb; font-weight: bold; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px;
               border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
  .info-label { font-size: 10px; color: #6b7280; }
  .info-val   { font-weight: 600; font-size: 12px; }
  .totals-box { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals-inner { min-width: 260px; }
  .totals-row   { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .totals-sep   { border-top: 1px solid #d1d5db; margin: 4px 0; }
  .totals-grand { display: flex; justify-content: space-between; padding: 6px 0 0;
                  border-top: 2px solid #111; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .signatures   { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-line     { border-top: 1px solid #9ca3af; padding-top: 4px; width: 150px; text-align: center; font-size: 11px; color: #4b5563; }

  /* Doctor / consultation services — its own itemised table, kept visually separate from the main services table */
  .doctor-table            { table-layout: fixed; }
  .doctor-table td         { vertical-align: top; }
  .doctor-table .sub       { margin-top: 2px; }

  .print-header { display: flex; justify-content: space-between; align-items: center;
                  border-bottom: 2px solid #374151; padding-bottom: 10px; }
  .print-header-right { text-align: right; }
  .print-header-right .bill-type { font-size: 20px; font-weight: bold; color: #b91c1c; }
  .print-header-right .bill-sub  { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .print-footer { font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 4px; }

  body { padding: 24px; }
  @media print {
    body { padding: 0; }
    /* .print-header rides in <thead> (repeats natively, keeps content clear).
       .print-footer is fixed to the paper bottom and painted into the strip the
       <tfoot> spacer reserves, so it repeats on every page with no overlap.
       The header→body gap is the <thead> cell's padding-bottom (DOC_GRID_CSS). */
    .print-header { margin: 0 0 8px; }
    .print-footer { position: fixed; left: 24px; right: 24px; bottom: 0; height: 34px;
      margin: 0; padding: 0 0 8px; background: #fff;
      display: flex; align-items: flex-end; justify-content: center; }
    @page { margin: 28px 24px; }
  }
  @media screen {
    .print-header { margin-bottom: 16px; }
    .doc-grid > tfoot { display: none; }
    .print-footer { position: static; margin-top: 24px; }
  }
`;

export function printHeaderHtml(logo: string, billType: string, subtitle = "Arogya Maternity & Nursing Home") {
  return `
<div class="print-header">
  <img src="${logo}" alt="Logo" style="height:56px;object-fit:contain"/>
  <div class="print-header-right">
    <div class="bill-type">${billType}</div>
    <div class="bill-sub">${subtitle}</div>
  </div>
</div>`;
}

export function printFooterHtml(text = "Arogya Maternity & Nursing Home — Computer generated document") {
  return `<div class="print-footer">${text}</div>`;
}

/**
 * Wrap a print doc so `headerHtml` repeats at the top of every printed page and
 * `footerHtml` stays pinned to the bottom of every page (see DOC_GRID_CSS).
 * `sections` is an array of top-level blocks — each becomes its own <tbody> row
 * so page breaks fall between sections and no cell overflows a page (which would
 * stop <thead> repeating). Empty/blank sections are dropped.
 */
export function wrapPrintDoc(headerHtml: string, sections: string[], footerHtml = printFooterHtml()) {
  const rows = sections
    .filter(s => s && s.trim())
    .map(s => `<tbody><tr><td class="doc-section">${s}</td></tr></tbody>`)
    .join("\n");
  return `
<table class="doc-grid">
  <thead><tr><td>${headerHtml}</td></tr></thead>
  <tfoot><tr><td class="foot-space"></td></tr></tfoot>
  ${rows}
</table>
${footerHtml}`;
}

/**
 * Split one itemised section into as many <table class="chunk"> pieces as needed
 * so no piece is taller than a page — otherwise Chrome stops repeating the outer
 * page <thead>. `colgroup` (fixed column widths) and `headRow` (the column
 * header <tr>) repeat on every piece; the heading gets " (cont.)" after the
 * first; `footRows` (subtotal / total rows) land on the last piece only. Each
 * returned string is a standalone section for wrapPrintDoc().
 */
export function chunkTableSections(
  heading: string,
  colgroup: string,
  headRow: string,
  rows: string[],
  footRows: string,
  chunkSize = 16,
): string[] {
  if (!rows.length && !footRows.trim()) return [];
  const groups: string[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) groups.push(rows.slice(i, i + chunkSize));
  if (!groups.length) groups.push([]);
  return groups.map((g, idx) => `
<h2>${heading}${idx === 0 ? "" : " (cont.)"}</h2>
<table class="chunk">
  ${colgroup}
  <thead>${headRow}</thead>
  <tbody>
    ${g.join("")}
    ${idx === groups.length - 1 ? footRows : ""}
  </tbody>
</table>`);
}

const PRINT_FRAME_ID = "__ipd_print_frame__";

/**
 * Render `bodyHtml` into a throwaway hidden <iframe> and drive the browser
 * print dialog from it, then tear the frame down again.
 *
 * Why an iframe and not `window.open` + popup:
 *  - a script-opened popup shares the opener's renderer process, so the popup's
 *    blocking `window.print()` and its `window.close()` could wedge Chrome's
 *    print backend and leave the *whole app* frozen after a single print;
 *  - popups also trip pop-up blockers and leave orphan windows when close()
 *    silently no-ops.
 * The one rule that keeps the iframe approach stable: never remove the frame
 * synchronously from inside `onafterprint` / while `print()` is unwinding —
 * always defer with a macrotask (`setTimeout(..., 0)`), or Chrome wedges the
 * same way. Cleanup runs on `onafterprint`; a 60s timer is only a last-resort
 * fallback for engines that skip `onafterprint` on "Cancel".
 */
/**
 * Core printer: render a full print document into a throwaway hidden <iframe>
 * and drive the print dialog from it, then remove the frame. `styleCss` is
 * injected verbatim into a single <style> in <head>; `bodyHtml` is the <body>
 * inner HTML (no <script> needed — printing is driven from here).
 */
export function printViaHiddenIframe(title: string, styleCss: string, bodyHtml: string) {
  // Drop any frame left over from a previous (completed) print.
  document.getElementById(PRINT_FRAME_ID)?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = PRINT_FRAME_ID;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const frameWin = iframe.contentWindow;
  const frameDoc = frameWin?.document;
  if (!frameWin || !frameDoc) {
    iframe.remove();
    toast.error("Unable to open the print view");
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => iframe.remove(), 0); // defer past onafterprint / print() unwind
  };

  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${styleCss}</style>
</head><body>${bodyHtml}</body></html>`);
  frameDoc.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frameWin.focus();
      frameWin.onafterprint = cleanup;
      frameWin.print();
    } catch {
      cleanup();
      return;
    }
    setTimeout(cleanup, 60000);
  };

  // Wait for images (the logo) to load so they appear in the printout, with a
  // hard cap so a stuck request can never block printing.
  const imgs = Array.from(frameDoc.images);
  if (!imgs.length) {
    setTimeout(triggerPrint, 50);
  } else {
    let pending = imgs.length;
    const oneReady = () => { if (--pending <= 0) triggerPrint(); };
    imgs.forEach((img) => {
      if (img.complete) oneReady();
      else { img.onload = oneReady; img.onerror = oneReady; }
    });
    setTimeout(triggerPrint, 3000);
  }
}

export function openIpdPrintWindow(title: string, bodyHtml: string, extraCss = "") {
  printViaHiddenIframe(title, `${PRINT_BASE_CSS}${extraCss}`, bodyHtml);
}

export function doctorServiceBoxHtml(
  entries: Array<{ serviceName: string; date: string; doctorName?: string; totalCharge: number }>,
  referredBy: string | undefined,
  fmt: (n: number) => string,
  fmtDate: (d: string | undefined) => string,
) {
  if (!entries.length) return "";
  const total = entries.reduce((s, e) => s + (Number(e.totalCharge) || 0), 0);
  const rows = entries.map(e => `
    <tr>
      <td>${e.serviceName}</td>
      <td>${e.doctorName || "—"}${referredBy ? `<div class="sub" style="font-size:10px">Ref: ${referredBy}</div>` : ""}</td>
      <td>${fmtDate(e.date)}</td>
      <td class="right bold">${fmt(e.totalCharge)}</td>
    </tr>`).join("");
  return `
<h2>Doctor / Consultation Services</h2>
<table class="doctor-table">
  <colgroup><col style="width:40%"><col style="width:30%"><col style="width:15%"><col style="width:15%"></colgroup>
  <thead>
    <tr><th>Service</th><th>Doctor</th><th>Date</th><th class="right">Amount</th></tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="total-row"><td colspan="3">Total Consultation Charge</td><td class="right bold">${fmt(total)}</td></tr>
  </tfoot>
</table>`;
}
