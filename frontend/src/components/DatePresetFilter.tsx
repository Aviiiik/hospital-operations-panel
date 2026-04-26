import { Button } from "@/components/ui/button";

export type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month";

export function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();

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
  }
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Today",      value: "today"      },
  { label: "Yesterday",  value: "yesterday"  },
  { label: "This Week",  value: "this_week"  },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
];

interface Props {
  value: DatePreset | null;
  onChange: (preset: DatePreset) => void;
}

export default function DatePresetFilter({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESETS.map(p => (
        <Button
          key={p.value}
          type="button"
          size="sm"
          variant={value === p.value ? "default" : "outline"}
          className={`h-7 text-xs px-3 ${value === p.value ? "bg-red-600 hover:bg-red-700 border-red-600 text-white" : ""}`}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
