import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportExcelButtonProps {
  data: Record<string, string | number>[];
  filename: string;
  label?: string;
  disabled?: boolean;
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exports rows as a CSV file, which opens directly in Excel as a spreadsheet —
// avoids pulling in a third-party xlsx library for what's otherwise a simple export.
export default function ExportExcelButton({ data, filename, label = "Export to Excel", disabled }: ExportExcelButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const lines = [
      headers.join(","),
      ...data.map(row => headers.map(h => csvEscape(row[h])).join(",")),
    ];
    const csvContent = "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8 correctly
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
      onClick={handleExport}
      disabled={disabled || data.length === 0}
    >
      <FileSpreadsheet className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
