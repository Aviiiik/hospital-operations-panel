// src/pages/pharmacy/Pharmacy.tsx
import { Pill } from "lucide-react";

export default function Pharmacy() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
        <Pill className="h-8 w-8 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-800">Pharmacy</h1>
      <p className="text-gray-500 max-w-sm">
        Pharmacy module is under construction. Drug inventory, prescriptions,
        and dispensing records will appear here.
      </p>
      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
        Coming Soon
      </span>
    </div>
  );
}