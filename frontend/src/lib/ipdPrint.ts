import { toast } from "sonner";

// ─── Shared print styling + repeating header/footer for all IPD print pages ──
// Fixed-position header/footer + matching @page margins is the standard trick
// that makes a header/footer repeat on every page when a multi-page document
// is sent to the browser's print engine (Chrome/Edge, which window.print() uses).
export const PRINT_BASE_CSS = `
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

  /* Doctor / consultation services box — kept visually separate from the itemised services table */
  .doctor-box        { border: 1px solid #d1d5db; border-radius: 6px; padding: 2px 12px; margin-bottom: 10px; }
  .doctor-item       { padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
  .doctor-item:last-child { border-bottom: none; }
  .doctor-item-main  { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
  .doctor-item-meta  { font-size: 10px; color: #6b7280; margin-top: 2px; }

  .print-header { display: flex; justify-content: space-between; align-items: flex-start;
                  border-bottom: 2px solid #374151; padding-bottom: 10px; }
  .print-header-right { text-align: right; }
  .print-header-right .bill-type { font-size: 20px; font-weight: bold; color: #b91c1c; }
  .print-header-right .bill-sub  { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .print-footer { font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 4px; }

  body { padding: 24px; }
  @media print {
    body { padding: 0; }
    .print-header, .print-footer { position: fixed; left: 24px; right: 24px; background: #fff; }
    .print-header { top: 0; padding-top: 16px; }
    .print-footer { bottom: 0; padding-bottom: 10px; }
    .print-body { padding: 118px 24px 46px; }
    @page { margin: 112px 24px 44px; }
  }
  @media screen {
    .print-body { padding: 16px 0 0; }
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

export function openIpdPrintWindow(title: string, bodyHtml: string, extraCss = "") {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }
  w.document.write(`<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${PRINT_BASE_CSS}${extraCss}</style>
</head><body>${bodyHtml}
<script>
  window.onload=function(){window.focus();window.print();};
  window.onafterprint=function(){window.close();};
  setTimeout(function(){window.close();},60000);
<\/script>
</body></html>`);
  w.document.close();
}

export function doctorServiceBoxHtml(
  entries: Array<{ serviceName: string; date: string; doctorName?: string; totalCharge: number }>,
  referredBy: string | undefined,
  fmt: (n: number) => string,
  fmtDate: (d: string | undefined) => string,
) {
  if (!entries.length) return "";
  const rows = entries.map(e => `
    <div class="doctor-item">
      <div class="doctor-item-main"><span>${e.serviceName}</span><span>${fmt(e.totalCharge)}</span></div>
      <div class="doctor-item-meta">Doctor: ${e.doctorName || "—"} &nbsp;|&nbsp; Date: ${fmtDate(e.date)}${referredBy ? ` &nbsp;|&nbsp; Referred Doctor: ${referredBy}` : ""}</div>
    </div>`).join("");
  return `
<h2>Doctor / Consultation Services</h2>
<div class="doctor-box">${rows}</div>`;
}
