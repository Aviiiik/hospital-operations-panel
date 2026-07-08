import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Pencil, RefreshCw, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import ipdService, { BED_CATEGORIES } from "@/services/ipdService";
import DatePresetFilter, { type DatePreset, getDateRange } from "@/components/DatePresetFilter";
import ExportExcelButton from "@/components/ExportExcelButton";

interface IpdPatient {
  _id: string;
  admissionId: string;
  admissionDate: string;
  title: string;
  name: string;
  gender: string;
  ageYears: number;
  phone: string;
  department?: string;
  bedCategory?: string;
  bedNo?: string;
  status: "Admitted" | "Discharged";
  dischargeDate?: string;
  doctors?: { slNo: number; doctorName: string }[];
}

interface OccupiedBed {
  _id: string;
  bedCategory: string;
  bedNo: string;
  patientName: string;
  admissionId: string;
}

export default function IpdSearchPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role.toLowerCase() === "admin";

  const [search, setSearch]             = useState({ name: "", phone: "", admissionId: "" });
  const [preset, setPreset]             = useState<DatePreset | null>("today");
  const [filterBedCategory, setFilterBedCategory] = useState("");
  const [filterBedNo, setFilterBedNo]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [patients, setPatients] = useState<IpdPatient[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const [occupiedBeds, setOccupiedBeds]   = useState<OccupiedBed[]>([]);
  const [loadingBeds, setLoadingBeds]     = useState(false);
  const [hoveredBed, setHoveredBed]       = useState<OccupiedBed | null>(null);

  const filterAvailableBeds = BED_CATEGORIES.find(c => c.category === filterBedCategory)?.beds ?? [];
  const occupiedSet = new Set(occupiedBeds.map(b => `${b.bedCategory}|${b.bedNo}`));

  useEffect(() => {
    fetchOccupiedBeds();
    const { from, to } = getDateRange("today");
    doSearch({ from: from.toISOString(), to: to.toISOString() });
  }, []);

  const fetchOccupiedBeds = async () => {
    setLoadingBeds(true);
    try {
      const res = await ipdService.getOccupiedBeds();
      setOccupiedBeds(res.data.data.beds);
    } catch { /* silent */ }
    finally { setLoadingBeds(false); }
  };

  const doSearch = async (params: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await ipdService.searchPatients(params);
      setPatients(res.data.data.patients);
      setSearched(true);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (search.name.trim())        params.name        = search.name.trim();
    if (search.phone.trim())       params.phone       = search.phone.trim();
    if (search.admissionId.trim()) params.admissionId = search.admissionId.trim();
    if (filterBedCategory)         params.bedCategory = filterBedCategory;
    if (filterBedNo)               params.bedNo       = filterBedNo;
    if (filterStatus && filterStatus !== "all") params.status = filterStatus;
    setPreset(null);
    doSearch(params);
  };

  const handlePresetChange = (p: DatePreset) => {
    setSearch({ name: "", phone: "", admissionId: "" });
    setFilterBedCategory("");
    setFilterBedNo("");
    setPreset(p);
    const { from, to } = getDateRange(p);
    const params: Record<string, string> = { from: from.toISOString(), to: to.toISOString() };
    if (filterStatus && filterStatus !== "all") params.status = filterStatus;
    doSearch(params);
  };

  const handleClear = () => {
    setSearch({ name: "", phone: "", admissionId: "" });
    setFilterBedCategory("");
    setFilterBedNo("");
    setFilterStatus("all");
    setPreset("today");
    const { from, to } = getDateRange("today");
    doSearch({ from: from.toISOString(), to: to.toISOString() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleBedClick = (cat: string, bed: string) => {
    const occ = occupiedBeds.find(b => b.bedCategory === cat && b.bedNo === bed);
    if (occ) {
      if (isAdmin) navigate(`/ipd/edit/${occ._id}`);
      return;
    }
    // Available bed — filter search results by this bed
    setSearch({ name: "", phone: "", admissionId: "" });
    setFilterBedCategory(cat);
    setFilterBedNo(bed);
    setFilterStatus("Admitted");
    setPreset(null);
    doSearch({ bedCategory: cat, bedNo: bed, status: "Admitted" });
  };

  const s = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">IPD — Search Patient</h1>
        <p className="text-gray-500 text-sm">Search admitted and discharged patients, view bed occupancy</p>
      </div>

      {/* Bed Occupancy Map */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bed Status</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Occupied{isAdmin ? " — click to open patient" : ""}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Available — click to filter</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchOccupiedBeds} disabled={loadingBeds}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingBeds ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="space-y-3">
            {BED_CATEGORIES.map(({ category, beds }) => (
              <div key={category} className="flex items-start gap-3">
                <div className="w-52 shrink-0 text-xs font-medium text-gray-600 pt-1.5 leading-tight">{category}</div>
                <div className="flex flex-wrap gap-1.5">
                  {beds.map(bed => {
                    const key = `${category}|${bed}`;
                    const occ = occupiedBeds.find(b => b.bedCategory === category && b.bedNo === bed);
                    const isOccupied = occupiedSet.has(key);
                    const isFiltered = filterBedCategory === category && filterBedNo === bed;
                    return (
                      <div key={bed} className="relative">
                        <button
                          type="button"
                          onClick={() => handleBedClick(category, bed)}
                          onMouseEnter={() => occ && setHoveredBed(occ)}
                          onMouseLeave={() => setHoveredBed(null)}
                          className={`w-12 h-9 rounded text-xs font-semibold border-2 transition-all
                            ${isFiltered
                              ? "border-blue-500 ring-2 ring-blue-300 bg-blue-50 text-blue-700 cursor-pointer"
                              : isOccupied
                                ? isAdmin
                                  ? "bg-red-500 border-red-600 text-white hover:bg-red-600 cursor-pointer"
                                  : "bg-red-500 border-red-600 text-white cursor-default"
                                : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer"
                            }`}
                        >
                          {bed}
                        </button>
                        {hoveredBed && hoveredBed.bedNo === bed && hoveredBed.bedCategory === category && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none">
                            {hoveredBed.patientName}
                            <div className="text-gray-300">{hoveredBed.admissionId}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{occupiedBeds.length}</span> occupied &nbsp;·&nbsp;
            <span className="font-medium text-gray-700">
              {BED_CATEGORIES.reduce((s, c) => s + c.beds.length, 0) - occupiedBeds.length}
            </span> available
          </div>
        </CardContent>
      </Card>

      {/* Search Filters */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Search Patient</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs mb-2 block">Date Filter</Label>
            <DatePresetFilter value={preset} onChange={handlePresetChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Patient Name</Label>
              <Input value={search.name} onChange={s("name")} onKeyDown={handleKeyDown}
                placeholder="Enter name…" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={search.phone} onChange={s("phone")} onKeyDown={handleKeyDown}
                placeholder="Mobile number" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Admission ID</Label>
              <Input value={search.admissionId} onChange={s("admissionId")} onKeyDown={handleKeyDown}
                placeholder="e.g. IPD202600001" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Admitted">Admitted</SelectItem>
                  <SelectItem value="Discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed Category</Label>
              <Select value={filterBedCategory || "all"} onValueChange={v => {
                setFilterBedCategory(v === "all" ? "" : v);
                setFilterBedNo("");
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {BED_CATEGORIES.map(c => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bed No</Label>
              <Select value={filterBedNo || "all"} onValueChange={v => setFilterBedNo(v === "all" ? "" : v)}
                disabled={!filterBedCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filterAvailableBeds.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClear}>Clear</Button>
            <Button onClick={handleSearch} className="bg-red-600 hover:bg-red-700" disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Results <span className="text-gray-400 font-normal text-sm">({patients.length})</span>
            </CardTitle>
            <ExportExcelButton
              filename="ipd-patients"
              data={patients.map(p => ({
                "Admission ID":   p.admissionId,
                "Patient Name":   `${p.title} ${p.name}`,
                "Gender":         p.gender,
                "Age (Yrs)":      p.ageYears,
                "Phone":          p.phone,
                "Department":     p.department || "",
                "Bed Category":   p.bedCategory || "",
                "Bed No":         p.bedNo || "",
                "Doctor(s)":      p.doctors?.length ? p.doctors.map(d => d.doctorName).join(", ") : "",
                "Admission Date": new Date(p.admissionDate).toLocaleDateString("en-IN"),
                "Discharge Date": p.dischargeDate ? new Date(p.dischargeDate).toLocaleDateString("en-IN") : "",
                "Status":         p.status,
              }))}
            />
          </CardHeader>
          <CardContent className="p-0">
            {patients.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No patients found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Admission ID</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Patient Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Gender / Age</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Bed</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor(s)</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Adm. Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Discharge Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map(p => (
                      <tr key={p._id} className={`border-b hover:bg-gray-50 ${isAdmin ? "cursor-pointer" : ""}`}
                        onClick={() => isAdmin && navigate(`/ipd/edit/${p._id}`)}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.admissionId}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{p.title} {p.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.gender} / {p.ageYears}Y</td>
                        <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {p.bedNo
                            ? <span className="inline-flex items-center gap-1">
                                <span className="font-semibold">{p.bedNo}</span>
                                {p.bedCategory && <span className="text-xs text-gray-400 hidden lg:inline">({p.bedCategory})</span>}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-35 truncate">
                          {p.doctors?.length ? p.doctors.map(d => d.doctorName).join(", ") : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {new Date(p.admissionDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {p.dischargeDate
                            ? new Date(p.dischargeDate).toLocaleDateString("en-IN")
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={p.status === "Admitted"
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-orange-100 text-orange-700 hover:bg-orange-100"}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {isAdmin && (
                              <Button size="sm" variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-700"
                                onClick={() => navigate(`/ipd/edit/${p._id}`)}
                                title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button size="sm" variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-700"
                                onClick={() => navigate(`/ipd/billing/${p._id}`)}
                                title="Billing">
                                <IndianRupee className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
