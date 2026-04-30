import api from "@/lib/Api";

export const DEPARTMENTS = ["OPD", "DIALYSIS", "EMERGENCY", "IMPLANT", "PROCEDURE"];

export const REGISTRATION_TYPES = [
  { type: "NATIONAL", amount: 100 },
  { type: "INTERNATIONAL", amount: 500 },
];

export const DESIGNATIONS = [
  "ADV PHACO SURGERY, GLAUCOMA SURGERY", "ANESTHETIST", "CARDIOLOGIST",
  "CARDIOLOGIST & MEDICINE", "CHEST MEDICINE", "CHILD SPECIALIST",
  "CONSULTANT GYNAECOLOGIST & OBSTETRICIAN", "CONSULTANT PHYSICIAN & CARDIOLOGIST",
  "DENTAL SURGEON", "DERMATOLOGIST", "ENT SURGEON", "ENDOCRINOLOGIST",
  "EYE SURGEON", "GASTROINTESTINAL", "GENERAL PHYSICIAN (GP)",
  "GENERAL & LAPAROSCOPIC SURGEON", "GYNAECOLOGIST & OBSTETRICIAN",
  "GYNAECOLOGIST & INFERTILITY SPECIALIST", "HAEMATOLOGIST", "HOMEOPATHY",
  "NEPHROLOGIST", "NEUROLOGIST", "NEURO-PSYCHIATRIST", "NEUROSURGEON",
  "OBSTETRICIAN & GYNAECOLOGIST", "ONCOLOGIST", "ORTHOPAEDIC SURGEON",
  "PAEDIATRICIAN", "PATHOLOGIST", "PHYSIOTHERAPY", "PLASTIC SURGEON",
  "PSYCHIATRY", "PULMONOLOGIST", "RADIOLOGIST", "RMO",
  "SENIOR MEDICAL OFFICER", "SKIN SPECIALIST", "SURGEON", "UROLOGIST", "VASCULAR",
];
export const OPD_SERVICES = [
  { serviceName: "P. ENEMA", charge: 400 },
  { serviceName: "FINGERING ENEMA", charge: 900 },
  { serviceName: "IV INJECTION (FOR 30 MIN)", charge: 300 },
  { serviceName: "INJECTION SHORT", charge: 200 },
  { serviceName: "IM INJECTION", charge: 100 },
  { serviceName: "FOLYS CATHETER", charge: 800 },
  { serviceName: "RYLES'S TUBE", charge: 1000 },
  { serviceName: "DRESSING BIG", charge: 500 },
  { serviceName: "DRESSING SMALL", charge: 300 },
  { serviceName: "IV CHANNEL", charge: 400 },
  { serviceName: "ECG", charge: 350 },
  { serviceName: "STICH REMOVAL", charge: 100 }, // Note: per stitch logic can be added in remarks
  { serviceName: "INSULIN / SUBCUT INJ", charge: 100 },
  { serviceName: "CATHETER WASH / BLADDER WASH", charge: 400 },
  { serviceName: "SUCTION", charge: 300 },
];

export const MEDICINES = [
  // Analgesics & Antipyretics
  "PARACETAMOL 500MG", "PARACETAMOL 650MG",
  "IBUPROFEN 200MG", "IBUPROFEN 400MG", "IBUPROFEN 600MG",
  "DICLOFENAC SODIUM 50MG", "DICLOFENAC SODIUM 75MG",
  "ASPIRIN 75MG", "ASPIRIN 150MG", "ASPIRIN 325MG",
  "TRAMADOL 50MG", "NAPROXEN 250MG", "NAPROXEN 500MG",
  // Antibiotics
  "AMOXICILLIN 250MG", "AMOXICILLIN 500MG",
  "AMOXICILLIN + CLAVULANATE 625MG",
  "AZITHROMYCIN 250MG", "AZITHROMYCIN 500MG",
  "CIPROFLOXACIN 250MG", "CIPROFLOXACIN 500MG",
  "DOXYCYCLINE 100MG", "METRONIDAZOLE 200MG", "METRONIDAZOLE 400MG",
  "CEFIXIME 200MG", "CEFIXIME 400MG",
  "CEFALEXIN 250MG", "CEFALEXIN 500MG",
  "CEFTRIAXONE 1G INJ",
  // Antacids & GI
  "OMEPRAZOLE 20MG", "OMEPRAZOLE 40MG",
  "PANTOPRAZOLE 40MG", "RABEPRAZOLE 20MG",
  "RANITIDINE 150MG", "DOMPERIDONE 10MG",
  "ONDANSETRON 4MG", "ONDANSETRON 8MG",
  "METOCLOPRAMIDE 10MG", "LACTULOSE SYRUP",
  "ANTACID SUSPENSION", "SIMETHICONE",
  // Antihypertensives
  "AMLODIPINE 2.5MG", "AMLODIPINE 5MG", "AMLODIPINE 10MG",
  "ATENOLOL 25MG", "ATENOLOL 50MG",
  "LOSARTAN 25MG", "LOSARTAN 50MG",
  "TELMISARTAN 40MG", "TELMISARTAN 80MG",
  "RAMIPRIL 2.5MG", "RAMIPRIL 5MG", "RAMIPRIL 10MG",
  "ENALAPRIL 5MG", "ENALAPRIL 10MG",
  // Antidiabetics
  "METFORMIN 500MG", "METFORMIN 850MG", "METFORMIN 1000MG",
  "GLIPIZIDE 5MG", "GLIMEPIRIDE 1MG", "GLIMEPIRIDE 2MG", "GLIBENCLAMIDE 5MG",
  // Vitamins & Supplements
  "VITAMIN C 500MG", "VITAMIN D3 60000IU (WEEKLY)", "VITAMIN D3 1000IU",
  "CALCIUM CARBONATE + VIT D3", "B-COMPLEX TABLET",
  "FERROUS SULPHATE + FOLIC ACID", "ZINC SULPHATE 20MG", "MULTIVITAMIN TABLET",
  // Respiratory & Allergy
  "SALBUTAMOL 2MG", "SALBUTAMOL 4MG",
  "MONTELUKAST 4MG", "MONTELUKAST 10MG",
  "CETIRIZINE 5MG", "CETIRIZINE 10MG", "LEVOCETRIZINE 5MG",
  "CHLORPHENIRAMINE 4MG", "AMBROXOL 30MG", "BROMHEXINE 8MG",
  "DEXTROMETHORPHAN SYRUP",
  // Cardiac & Lipid
  "ATORVASTATIN 10MG", "ATORVASTATIN 20MG", "ATORVASTATIN 40MG",
  "ROSUVASTATIN 10MG", "ROSUVASTATIN 20MG",
  "CLOPIDOGREL 75MG", "FUROSEMIDE 20MG", "FUROSEMIDE 40MG",
  "SPIRONOLACTONE 25MG", "SPIRONOLACTONE 50MG", "DIGOXIN 0.25MG",
  // Neurological
  "METHYLCOBALAMIN 500MCG", "GABAPENTIN 100MG", "GABAPENTIN 300MG",
  "PREGABALIN 75MG", "ALPRAZOLAM 0.25MG", "ALPRAZOLAM 0.5MG",
  "DIAZEPAM 5MG", "SERTRALINE 50MG",
  // Thyroid
  "LEVOTHYROXINE 25MCG", "LEVOTHYROXINE 50MCG", "LEVOTHYROXINE 100MCG",
  // Topical
  "BETAMETHASONE CREAM", "HYDROCORTISONE CREAM", "CLOTRIMAZOLE CREAM",
  // Eye / Ear Drops
  "CIPROFLOXACIN EYE DROPS", "MOXIFLOXACIN EYE DROPS", "TOBRAMYCIN EYE DROPS",
  // Injections
  "DICLOFENAC INJ 75MG/3ML", "ONDANSETRON INJ 4MG/2ML",
];

const opdService = {
  getDoctors:         ()          => api.get("/opd/doctors"),
  createDoctor:       (data: any) => api.post("/opd/doctors", data),
  getDashboardStats:  ()          => api.get("/opd/stats/dashboard"),
  getTodayActivity:   ()          => api.get("/opd/stats/today-activity"),
  getNextId:          ()          => api.get("/opd/patients/next-id"),
  createPatient:      (data: any) => api.post("/opd/patients", data),
  updatePatient:      (id: string, data: any) => api.put(`/opd/patients/${id}`, data),
  searchPatients:     (params: any) => api.get("/opd/patients", { params }),
  getPatient:         (id: string) => api.get(`/opd/patients/${id}`),
  createBooking:      (data: any) => api.post("/opd/bookings", data),
  getBooking:         (id: string) => api.get(`/opd/bookings/${id}`),
  updateBooking:      (id: string, data: any) => api.put(`/opd/bookings/${id}`, data),
  getPatientBookings:     (patientId: string) => api.get(`/opd/bookings/patient/${patientId}`),
  createPrescription:     (data: any)         => api.post("/opd/prescriptions", data),
  getPatientPrescriptions:(patientId: string) => api.get(`/opd/prescriptions/patient/${patientId}`),
  deletePatient:          (id: string)        => api.delete(`/opd/patients/${id}`),
};

export default opdService;
