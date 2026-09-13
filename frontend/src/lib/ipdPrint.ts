import { toast } from "sonner";
import { formatAdmissionNumber, formatInvoiceNumber } from "@/services/ipdService";

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
  /* Continuation piece of a chunked table (chunkTableSections, idx>0) — no
     heading, sits flush under the previous piece so the split reads as one
     continuous table rather than a new section. chunk-mid marks a piece that
     is itself followed by another piece — zero its bottom margin so the two
     <table> elements sit back to back with no gap between them. */
  .doc-section table.chunk-cont { margin-top: 0; }
  .doc-section table.chunk-mid { margin-bottom: 0; }
  /* Uniform gap between the repeating page header and the body on every printed
     page (including continuation pages). Lives on the <thead> cell so it is part
     of the header band that the print engine repeats. */
  @media print { .doc-grid > thead > tr > td { padding-bottom: 20px; } }
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

// ─── Shared repeating patient header (hospital box + doc title + patient grid) ─
// One component used by every IPD billing-family print (Billing, Discharge,
// Receipt, Investigation, Pharmacy) so the hospital identity AND the patient
// details repeat on every printed page, not just page 1. It is meant to be
// passed as `headerHtml` to wrapPrintDoc() — that puts it in the <thead>,
// which the browser natively repeats on every page (see DOC_GRID_CSS above).
// Fixed height + overflow:hidden (in the @media print block below) is required
// for Chrome to keep repeating it — an auto-height header stops repeating the
// moment any body cell overflows a page.
export interface IpdPrintPatient {
  title?: string;
  name?: string;
  admissionId: string;
  admissionDate: string | Date;
  admissionTime?: string;
  dischargeDate?: string | Date;
  dischargeTime?: string;
  ageYears?: number;
  ageMonths?: number;
  ageDays?: number;
  gender?: string;
  address?: string;
  doctors?: { doctorName: string }[];
  ipdRegistrationNo?: string;
  bedNo?: string;
  bedCategory?: string;
  patientCategory?: string;
  insuranceCo?: string;
  tpa?: string;
}

function printHeaderDate(d: string | Date | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export const PATIENT_HEADER_CSS = `
  .print-patient-header { display: block; }
  .php-hosp { display: flex; align-items: stretch; border: 1.5px solid #111; }
  .php-hosp .logo-cell { display: flex; align-items: center; justify-content: center;
    padding: 3px 10px; border-right: 1.5px solid #111; }
  .php-hosp .logo-cell img { width: 56px; height: 56px; object-fit: contain; }
  .php-hosp .hosp-cell { flex: 1; text-align: center; padding: 3px 10px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .php-hosp .h-name { font-size: 12.5px; font-weight: bold; letter-spacing: .02em; color: #111; }
  .php-hosp .h-line { font-size: 8px; color: #333; margin-top: .5px; line-height: 1.15; }
  .php-hosp .h-reg  { font-size: 8px; font-weight: bold; margin-top: .5px; color: #111; }
  .php-title { text-align: center; font-size: 10px; font-weight: bold; letter-spacing: .08em;
    text-transform: uppercase; text-decoration: underline; margin: 8px 0 7px; color: #111; }
  .php-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px;
    border: 1px solid #cbd1d8; padding: 5px 10px; }
  .php-grid .row { display: flex; font-size: 9px; padding: .5px 0; line-height: 1.1; }
  .php-grid .row.wide { grid-column: 1 / -1; }
  .php-grid .k { width: 86px; flex-shrink: 0; color: #555; }
  .php-grid .k::after { content: ":"; float: right; padding-right: 6px; }
  .php-grid .v { font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .php-grid .v.wrap { white-space: normal; }
  @media print {
    .print-patient-header { height: 180px; overflow: hidden; padding: 0; margin: 0; }
  }
  @media screen {
    .print-patient-header { margin-bottom: 14px; }
  }
`;

// Renders the hospital identity box + document title + a two-column patient
// details grid as ONE block, meant to sit entirely inside wrapPrintDoc()'s
// repeating <thead> — so it (and not just the hospital box) repeats on every
// printed page. `docTitle` is the per-document caption (e.g. "Final Bill
// Details", "Discharge Certificate", "Money Receipt").
export function patientHeaderHtml(logo: string, docTitle: string, patient: IpdPrintPatient): string {
  const doctors = patient.doctors?.length
    ? patient.doctors.map(d => d.doctorName).join(", ")
    : "—";
  const ageStr = [
    patient.ageYears  ? patient.ageYears  + "Y" : "",
    patient.ageMonths ? patient.ageMonths + "M" : "",
    patient.ageDays   ? patient.ageDays   + "D" : "",
  ].filter(Boolean).join(" ") || "—";
  const corporate = patient.tpa || patient.insuranceCo || patient.patientCategory || "—";
  // Corporate row label follows the admission's chosen Patient Category —
  // TPA -> "TPA (Insurance)", Insurance -> "Insurance", Mediclaim -> "Corporate"
  // (same as the default label for every other category).
  const category = (patient.patientCategory || "").trim().toUpperCase();
  const corporateLabel = category === "TPA" ? "TPA (Insurance)"
    : category === "INSURANCE" ? "Insurance"
    : "Corporate";
  const bedInfo = patient.bedNo
    ? `${patient.bedNo}${patient.bedCategory ? ` (${patient.bedCategory})` : ""}`
    : "—";
  const admissionNo = formatAdmissionNumber(patient.admissionDate, patient.admissionId);
  const invoiceNo   = formatInvoiceNumber(patient.admissionDate, patient.admissionId);
  const row = (k: string, v: string, wrap = false) =>
    `<div class="row"><span class="k">${k}</span><span class="v${wrap ? " wrap" : ""}">${v}</span></div>`;

  return `
<div class="print-patient-header">
  <div class="php-hosp">
    <div class="logo-cell"><img src="${logo}" alt="Logo"/></div>
    <div class="hosp-cell">
      <div class="h-name">AROGYA MATERNITY &amp; NURSING HOME</div>
      <div class="h-line">(A Unit of R.P. Medical Foundation Pvt. Ltd.)</div>
      <div class="h-line">(Licence Under W.B. Clinical Establishment Act)</div>
      <div class="h-reg">Regd. No: 34257492</div>
      <div class="h-line">71, Tollygunge Circular Road, Kolkata-700053 (New Alipore, Sital Sadan Compound)</div>
      <div class="h-line">Phone: (033) 2400-0681 / 0684 &nbsp;|&nbsp; Fax: (033) 2400-1180</div>
    </div>
  </div>
  <div class="php-title">${docTitle}</div>
  <div class="php-grid">
    <div>
      ${row("Patient Id", patient.ipdRegistrationNo || patient.admissionId || "—")}
      ${row("Admission No", admissionNo)}
      ${row("Invoice No", invoiceNo)}
      ${row("Patient Name", `${patient.title || ""} ${patient.name || ""}`.trim() || "—")}
      ${row("Sex / Age", `${patient.gender || "—"} / ${ageStr}`)}
    </div>
    <div>
      ${row("Under Doctor", doctors)}
      ${row("Admission Dt", `${printHeaderDate(patient.admissionDate)} ${patient.admissionTime || ""}`.trim())}
      ${row("Discharge Dt", patient.dischargeDate
        ? `${printHeaderDate(patient.dischargeDate)} ${patient.dischargeTime || ""}`.trim()
        : "—")}
      ${row("Bed No", bedInfo)}
      ${row(corporateLabel, corporate)}
    </div>
    ${patient.address ? `<div class="row wide"><span class="k">Address</span><span class="v wrap">${patient.address}</span></div>` : ""}
  </div>
</div>`;
}

// ─── Amount in words ────────────────────────────────────────────────────────
// Shared by every IPD print that shows a payable/received amount (Billing,
// Receipt, Investigation, Pharmacy) so the number-to-words logic lives in one
// place instead of being re-implemented per page.
export function toWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function below100(x: number) { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : ""); }
  function below1000(x: number) { return x<100 ? below100(x) : ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+below100(x%100):""); }
  if (!n || n <= 0) return "Zero";
  const whole = Math.round(n);
  let r = "", rem = whole;
  const cr = Math.floor(rem/10000000); rem %= 10000000;
  const lk = Math.floor(rem/100000);  rem %= 100000;
  const th = Math.floor(rem/1000);    rem %= 1000;
  if (cr) r += below1000(cr)+" Crore ";
  if (lk) r += below100(lk)+" Lakh ";
  if (th) r += below1000(th)+" Thousand ";
  if (rem) r += below1000(rem);
  return r.trim();
}

export const WORDS_BOX_CSS = `
  .words-box { border: 1px solid #9ca3af; border-radius: 3px; padding: 6px 10px;
    font-size: 10px; font-style: italic; color: #333; margin-top: 8px; }
`;

export function amountInWordsHtml(amount: number, label = "Amount"): string {
  return `<div class="words-box">(${label} : Rupees ${toWords(amount)} Only)</div>`;
}

export const PRINT_BASE_CSS = `
  ${DOC_GRID_CSS}
  ${HOSPITAL_HEADER_CSS}
  ${PATIENT_HEADER_CSS}
  ${WORDS_BOX_CSS}
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
 * page <thead>. That splitting is purely so the OUTER page header keeps
 * repeating (no single <tbody> cell of the outer doc-grid table is ever taller
 * than a page); it is not meant to repeat this table's own column-header row.
 * So only the FIRST piece gets `heading` + the column `<thead>` — every later
 * piece is a plain continuation `<tbody>`-only table with no heading and no
 * repeated header row, so the whole thing reads as one seamless table even
 * though it is technically several `<table>` elements under the hood. Each
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
  return groups.map((g, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === groups.length - 1;
    const cls = ["chunk", !isFirst && "chunk-cont", !isLast && "chunk-mid"].filter(Boolean).join(" ");
    return `
${isFirst ? `<h2>${heading}</h2>` : ""}
<table class="${cls}">
  ${colgroup}
  ${isFirst ? `<thead>${headRow}</thead>` : ""}
  <tbody>
    ${g.join("")}
    ${idx === groups.length - 1 ? footRows : ""}
  </tbody>
</table>`;
  });
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
