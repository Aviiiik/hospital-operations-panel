// src/pages/ipd/IpdList.tsx
import { Bed } from "lucide-react";

export default function IpdList() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
        <Bed className="h-8 w-8 text-blue-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800">IPD Management</h1>
      <p className="text-gray-500 max-w-sm">
        In-Patient Department module is under construction. Bed allocation,
        admissions, and ward management will appear here.
      </p>
      <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
        Coming Soon
      </span>
    </div>
  );
}