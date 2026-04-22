// src/pages/operations/Operations.tsx
import { Settings } from "lucide-react";

export default function Operations() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
        <Settings className="h-8 w-8 text-orange-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800">Operations</h1>
      <p className="text-gray-500 max-w-sm">
        Operations module is under construction. Lab tests, equipment
        management, and facility settings will appear here.
      </p>
      <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-medium">
        Coming Soon
      </span>
    </div>
  );
}