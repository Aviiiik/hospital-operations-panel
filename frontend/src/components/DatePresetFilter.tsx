import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DatePreset =
  | "today" | "yesterday" | "this_week" | "this_month"
  | "last_month" | "last_3_months" | "last_6_months" | "custom";

export interface CustomRange { from: string; to: string; } // yyyy-mm-dd

export function getDateRange(preset: DatePreset, custom?: CustomRange): { from: Date; to: Date } {
  const now = new Date();

  if (preset === "custom") {
    const from = custom?.from ? new Date(`${custom.from}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
    const to   = custom?.to   ? new Date(`${custom.to}T23:59:59.999`) : new Date(new Date().setHours(23, 59, 59, 999));
    return { from, to };
  }

  switch (preset) {
    case "today": {
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      const to   = new Date(now); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case "yesterday": {
      const from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
      const to   = new Date(now); to.setDate(to.getDate() - 1);     to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case "this_week": {
      const from = new Date(now);
      const day = from.getDay();
      from.setDate(from.getDate() - (day === 0 ? 6 : day - 1));
      from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to   = new Date(now); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "last_3_months": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    case "last_6_months": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 6);
      from.setHours(0, 0, 0, 0);
      const to = new Date(now); to.setHours(23, 59, 59, 999);
      return { from, to };
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
