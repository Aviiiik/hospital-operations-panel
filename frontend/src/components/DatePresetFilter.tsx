import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DatePreset =
  | "today" | "yesterday" | "this_week" | "this_month"
  | "last_month" | "last_3_months" | "last_6_months" | "custom";

export interface CustomRange { from: string; to: string; } // yyyy-mm-dd

// All bounds are built as explicit IST (+05:30) instants, not the browser's
// local timezone — so "Today"/"Custom Range"/etc. mean the IST calendar day
// regardless of what timezone the machine running the browser is set to.
const IST_OFFSET = "+05:30";

// Today's date as YYYY-MM-DD in IST, independent of the browser's local timezone.
function todayISTStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Shifts an IST YYYY-MM-DD date string by `days` (may be negative), returning
// another YYYY-MM-DD string, all reckoned in IST.
function shiftISTDateStr(dateStr: string, days: number): string {
  // Anchor at IST noon so a +/- day shift never crosses into the previous/next
  // UTC calendar day and throws off the IST-day math.
  const d = new Date(`${dateStr}T12:00:00${IST_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Shifts an IST YYYY-MM-DD date string back by `months` calendar months,
// clamping the day-of-month into the target month (JS Date's native rollover
// behavior, e.g. Mar 31 - 1 month -> Mar 3, matches what setMonth did before).
function shiftISTMonthsStr(dateStr: string, months: number): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(`${dateStr}T12:00:00${IST_OFFSET}`);
  d.setUTCFullYear(y, m - 1 - months, day);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function istDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000${IST_OFFSET}`);
}
function istDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${IST_OFFSET}`);
}

export function getDateRange(preset: DatePreset, custom?: CustomRange): { from: Date; to: Date } {
  const todayStr = todayISTStr();

  if (preset === "custom") {
    const from = custom?.from ? istDayStart(custom.from) : istDayStart(todayStr);
    const to   = custom?.to   ? istDayEnd(custom.to)     : istDayEnd(todayStr);
    return { from, to };
  }

  switch (preset) {
    case "today": {
      return { from: istDayStart(todayStr), to: istDayEnd(todayStr) };
    }
    case "yesterday": {
      const yStr = shiftISTDateStr(todayStr, -1);
      return { from: istDayStart(yStr), to: istDayEnd(yStr) };
    }
    case "this_week": {
      const day = istDayStart(todayStr).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
      const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
      const back = dayIdx === 0 ? 6 : dayIdx - 1; // days since Monday
      const fromStr = shiftISTDateStr(todayStr, -back);
      return { from: istDayStart(fromStr), to: istDayEnd(todayStr) };
    }
    case "this_month": {
      const [y, m] = todayStr.split("-");
      const fromStr = `${y}-${m}-01`;
      return { from: istDayStart(fromStr), to: istDayEnd(todayStr) };
    }
    case "last_month": {
      const [y, m] = todayStr.split("-").map(Number);
      // First of this month, shifted back one day, lands in last month.
      const lastDayOfPrevMonth = shiftISTDateStr(`${y}-${String(m).padStart(2, "0")}-01`, -1);
      const [py, pm] = lastDayOfPrevMonth.split("-");
      const fromStr = `${py}-${pm}-01`;
      return { from: istDayStart(fromStr), to: istDayEnd(lastDayOfPrevMonth) };
    }
    case "last_3_months": {
      const fromStr = shiftISTMonthsStr(todayStr, 3);
      return { from: istDayStart(fromStr), to: istDayEnd(todayStr) };
    }
    case "last_6_months": {
      const fromStr = shiftISTMonthsStr(todayStr, 6);
      return { from: istDayStart(fromStr), to: istDayEnd(todayStr) };
    }
  }
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Today",        value: "today"        },
  { label: "Yesterday",    value: "yesterday"    },
  { label: "This Week",    value: "this_week"    },
  { label: "This Month",   value: "this_month"   },
  { label: "Last Month",   value: "last_month"   },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "Last 6 Months", value: "last_6_months" },
];

interface Props {
  value: DatePreset | null;
  onChange: (preset: DatePreset, range: { from: Date; to: Date }) => void;
}

export default function DatePresetFilter({ value, onChange }: Props) {
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  // Tracks whether the custom-range panel is open — independent of `value`,
  // since selecting "Custom Range" shouldn't fire onChange until Apply is
  // clicked (there's no date range to report yet).
  const [customOpen, setCustomOpen] = useState(value === "custom");

  const selectPreset = (p: DatePreset) => {
    if (p === "custom") { setCustomOpen(true); return; } // wait for both dates + Apply
    setCustomOpen(false);
    onChange(p, getDateRange(p));
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    onChange("custom", getDateRange("custom", { from: customFrom, to: customTo }));
  };

  const showCustomPanel = value === "custom" || customOpen;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map(p => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={value === p.value ? "default" : "outline"}
            className={`h-7 text-xs px-3 ${value === p.value ? "bg-red-600 hover:bg-red-700 border-red-600 text-white" : ""}`}
            onClick={() => selectPreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={showCustomPanel ? "default" : "outline"}
          className={`h-7 text-xs px-3 ${showCustomPanel ? "bg-red-600 hover:bg-red-700 border-red-600 text-white" : ""}`}
          onClick={() => selectPreset("custom")}
        >
          Custom Range
        </Button>
      </div>

      {showCustomPanel && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">From</label>
            <Input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">To</label>
            <Input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => setCustomTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            disabled={!customFrom || !customTo}
            onClick={applyCustom}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
