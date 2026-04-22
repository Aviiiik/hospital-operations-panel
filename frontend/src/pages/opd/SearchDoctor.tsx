import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { OPD_DOCTORS, DEPARTMENTS, DESIGNATIONS } from "@/services/opdService";

export default function SearchDoctor() {
  const [nameFilter,   setNameFilter]   = useState("");
  const [deptFilter,   setDeptFilter]   = useState("ALL");
  const [desigFilter,  setDesigFilter]  = useState("ALL");

  const filtered = useMemo(() => {
    return OPD_DOCTORS.filter(d => {
      const matchName  = !nameFilter || d.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchDept  = deptFilter  === "ALL" || d.department === deptFilter;
      const matchDesig = desigFilter === "ALL" || d.designation === desigFilter;
      return matchName && matchDept && matchDesig;
    });
  }, [nameFilter, deptFilter, desigFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search Doctor</h1>
        <p className="text-gray-500 text-sm">Find doctors by name, department or designation</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Doctor Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={nameFilter}
                  onChange={e => setNameFilter(e.target.value)}
                  placeholder="Search by name..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">-- All Departments --</SelectItem>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Designation</Label>
              <Select value={desigFilter} onValueChange={setDesigFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">-- All Designations --</SelectItem>
                  {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">
            {filtered.length} doctor{filtered.length !== 1 ? "s" : ""} found
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white text-xs">
                  <th className="text-left px-4 py-3">SL</th>
                  <th className="text-left px-4 py-3">DOCTOR NAME</th>
                  <th className="text-left px-4 py-3">DEPARTMENT</th>
                  <th className="text-left px-4 py-3">DESIGNATION</th>
                  <th className="text-right px-4 py-3">CONSULT FEES</th>
                  <th className="text-left px-4 py-3">SCHEDULE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">No doctors found</td>
                  </tr>
                ) : (
                  filtered.map((doc, i) => (
                    <tr key={doc.name} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{doc.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{doc.department}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{doc.designation}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{doc.fees}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">EVERYDAY · MORNING</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
