import {
  PRINT_BASE_CSS, wrapPrintDoc, chunkTableSections, amountInWordsHtml, printViaHiddenIframe,
} from "@/lib/ipdPrint";
import type { DiagnosticPatient } from "@/services/diagnosticsService";

// Diagnostics bill print — built on the shared IPD print pipeline (repeating
// header via wrapPrintDoc's <thead>, chunked item table, hidden-iframe
// printing) so it paginates the same way and never uses window.open.
//
// The repeating header block below is styled like IPD's patientHeaderHtml() in
// ipdPrint.ts (same .php-title/.php-grid classes from PATIENT_HEADER_CSS, part
// of PRINT_BASE_CSS) — underlined doc title, then a two-column patient-details
// grid — with diagnostics fields (Bill No in place of Admission/Invoice No, no
// admission/bed/doctor rows). Unlike IPD it has no hospital identity box: it
// prints on pre-printed letterhead (see DX_LETTERHEAD_CSS).

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const money = (n: number) => Number(n || 0).toFixed(2);

const dateIST = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// Pre-printed letterhead clearance, measured off the hospital's diagnostic
// stationery: the printed header (logo/name/unit line + red rule) ends ~36mm
// from the top edge and the old bill's patient details start ~40mm down; the
// printed address strip (red rule + address/phone) occupies the bottom ~22mm.
// The header rides in wrapPrintDoc's repeating <thead>, so its top padding
// clears the letterhead on every page; the <tfoot> spacer clears the footer.
const DX_LETTERHEAD_CSS = `
  @media print {
    .print-patient-header.dx-letterhead { height: auto; overflow: visible; padding: 37mm 0 0; }
    .dx-letterhead .php-title { margin-top: 0; }
    .doc-grid .foot-space { height: 30mm; }
  }
`;

function billHeaderHtml(patient: DiagnosticPatient): string {
  const age = [
    patient.ageYears  ? `${patient.ageYears}Y`  : "",
    patient.ageMonths ? `${patient.ageMonths}M` : "",
    patient.ageDays   ? `${patient.ageDays}D`   : "",
  ].filter(Boolean).join(" ") || "—";

  const row = (k: string, v: string, wide = false) =>
    `<div class="row${wide ? " wide" : ""}"><span class="k">${k}</span><span class="v${wide ? " wrap" : ""}">${v}</span></div>`;

  // No hospital identity box — the diagnostics bill is printed on pre-printed
  // letterhead (logo + name + "A unit of…" + rule across the top, address strip
  // across the bottom). DX_LETTERHEAD_CSS reserves that space instead.
  return `
<div class="print-patient-header dx-letterhead">
  <div class="php-title">Money Receipt / Bill</div>
  <div class="php-grid">
    <div>
      ${row("Bill No", `<b>${esc(patient.billNo)}</b>`)}
      ${row("Bill Date", dateIST(patient.billDate))}
      ${row("Patient Name", esc(`${patient.title || ""} ${patient.name}`.trim()))}
      ${row("Sex / Age", `${esc(patient.gender)} / ${age}`)}
    </div>
    <div>
      ${row("Phone", esc(patient.phone))}
      ${row("Referred By", esc(patient.referredBy) || "—")}
      ${row("Payment Mode", esc(patient.paymentMode))}
      ${row("Registration Dt", dateIST(patient.registrationDate))}
    </div>
    ${patient.address ? row("Address", esc(patient.address), true) : ""}
  </div>
</div>`;
}

export function printDiagnosticBill(patient: DiagnosticPatient) {
  const rows = (patient.tests || []).map((t, i) =>
    `<tr><td>${i + 1}</td><td>${esc(t.testName)}</td><td>${esc(t.department) || "—"}</td><td class="right">${money(t.charge)}</td></tr>`);
  const testSections = chunkTableSections(
    "Tests",
    `<colgroup><col style="width:40px"/><col/><col style="width:120px"/><col style="width:110px"/></colgroup>`,
    `<tr><th>SL</th><th>Test Description</th><th>Department</th><th class="right">Rate (₹)</th></tr>`,
    rows,
    `<tr class="total-row"><td></td><td>Total</td><td></td><td class="right">${money(patient.totalAmount)}</td></tr>`,
  );

  const totals = `
<div class="totals-box"><div class="totals-inner">
  <div class="totals-row"><span>Total Amount</span><span>₹${money(patient.totalAmount)}</span></div>
  ${patient.discountAmount > 0
    ? `<div class="totals-row"><span>(-) Discount (${patient.discount}%)</span><span>₹${money(patient.discountAmount)}</span></div>`
    : ""}
  <div class="totals-grand"><span>Net Bill Amount</span><span>₹${money(patient.billAmount)}</span></div>
</div></div>
${amountInWordsHtml(patient.billAmount, "Net Bill Amount")}
${patient.billRemarks ? `<p style="margin-top:8px;font-size:11px"><b>Remarks:</b> ${esc(patient.billRemarks)}</p>` : ""}
<div class="signatures"><div></div><div class="sig-line">Authorised Signatory</div></div>`;

  // No footer text — it would print over the letterhead's pre-printed address strip.
  const body = wrapPrintDoc(billHeaderHtml(patient), [...testSections, totals], "");
  printViaHiddenIframe(`Diagnostics Bill ${patient.billNo}`, PRINT_BASE_CSS + DX_LETTERHEAD_CSS, body);
}
