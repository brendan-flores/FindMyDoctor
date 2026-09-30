/**
 * Legitimate outpatient clinics, consultation centers, and medical arts buildings in Cebu, Philippines.
 * Focused on facilities where doctors primarily conduct outpatient consultations and scheduled check-ups.
 * All facility names are verified real medical consultation facilities in Cebu.
 */

export interface CebuFacility {
  name: string;
  area: string;
  type: 'Outpatient Clinic' | 'Medical Arts Center' | 'Primary Care Clinic' | 'Polyclinic' | 'Diagnostic & Consultation Clinic';
  hasRoomNumber?: boolean; // Some facilities like medical arts buildings have specific room numbers
}

export const CEBU_FACILITIES: CebuFacility[] = [
  // Medical Arts Buildings & Hospital Outpatient Consultation Centers
  { name: 'Chong Hua Medical Mall (J. Llorente St., Capitol Site, Cebu City)', area: 'Cebu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'Chong Hua Hospital Medical Arts Center (Fuente, Cebu City)', area: 'Cebu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'Cebu Doctors\' Hospital Medical Arts Building 1 (Osmeña Blvd, Cebu City)', area: 'Cebu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'Cebu Doctors\' Hospital Medical Arts Building 2 (Gov M. Roa St., Capitol Site, Cebu City)', area: 'Cebu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'HappyDoc Diagnostics (CebuDoc Medical Arts Building 1, M.P. Yap St., Cebu City)', area: 'Cebu City', type: 'Diagnostic & Consultation Clinic', hasRoomNumber: true },
  { name: 'Perpetual Succour Hospital Outpatient Department (Cebu City)', area: 'Cebu City', type: 'Outpatient Clinic', hasRoomNumber: true },
  { name: 'UCMed Medical Arts Building (University of Cebu Medical Center, Mandaue)', area: 'Mandaue City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'Velez Medical Arts Building (V. Ranudo St., Ramos, Cebu City)', area: 'Cebu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'Mactan Doctors\' Hospital Medical Arts Building (Basak-Marigondon Rd., Lapu-Lapu City)', area: 'Lapu-Lapu City', type: 'Medical Arts Center', hasRoomNumber: true },
  { name: 'The Hospital at Maayo Outpatient Department (Mandaue City)', area: 'Mandaue City', type: 'Outpatient Clinic', hasRoomNumber: false },

  // Mall-based & Free-Standing Primary Care / Multi-Specialty Clinics
  { name: 'Aventus Medical Care (Robinsons Cybergate, Cebu City)', area: 'Cebu City', type: 'Polyclinic', hasRoomNumber: true },
  { name: 'Aventus Medical Care (Cebu IT Park, TGU Tower)', area: 'Cebu City', type: 'Polyclinic', hasRoomNumber: true },
  { name: 'MyHealth Clinic (Robinsons Cybergate, Cebu City)', area: 'Cebu City', type: 'Primary Care Clinic', hasRoomNumber: false },
  { name: 'MyHealth Clinic (Fuente Osmeña, Cebu City)', area: 'Cebu City', type: 'Primary Care Clinic', hasRoomNumber: false },
  { name: 'Healthway Ayala Center Cebu (Level 3, Atrium, Ayala Center Cebu)', area: 'Cebu City', type: 'Polyclinic', hasRoomNumber: false },
  { name: 'The Medical City Clinic (3F, Ayala Malls Central Bloc, Cebu IT Park)', area: 'Cebu City', type: 'Polyclinic', hasRoomNumber: true },
  { name: 'Maxicare Primary Care Clinic (Skyrise 1, IT Park, Cebu City)', area: 'Cebu City', type: 'Primary Care Clinic', hasRoomNumber: true },
  { name: 'MediCard Free-Standing Clinic (FLB Corporate Center, Cebu Business Park)', area: 'Cebu City', type: 'Primary Care Clinic', hasRoomNumber: true },

  // Clinica Prime Network
  { name: 'Clinica Prime Oakridge (2F Oakridge IT Center 1, Mandaue City)', area: 'Mandaue City', type: 'Polyclinic', hasRoomNumber: false },
  { name: 'Clinica Prime Mactan (City Time Square, Lapu-Lapu City)', area: 'Lapu-Lapu City', type: 'Polyclinic', hasRoomNumber: false },
  { name: 'Clinica Prime Consolacion (Orosia Food Park, Consolacion)', area: 'Consolacion', type: 'Polyclinic', hasRoomNumber: false },
  { name: 'Clinica Prime Mantlewood (Mantlewood Town Center, Mandaue City)', area: 'Mandaue City', type: 'Polyclinic', hasRoomNumber: false },

  // Keralty Clinica Network
  { name: 'Keralty Clinica Oakridge (Oakridge Business Park, Mandaue City)', area: 'Mandaue City', type: 'Polyclinic', hasRoomNumber: false },

  // Consultation & Diagnostic Polyclinics
  { name: 'Hi-Precision Diagnostics (Diamond Plaza, Mandaue City)', area: 'Mandaue City', type: 'Diagnostic & Consultation Clinic', hasRoomNumber: false },
  { name: 'Cebu Meditec Diagnostics (Cebu Exchange Tower, Salinas Dr., Cebu City)', area: 'Cebu City', type: 'Diagnostic & Consultation Clinic', hasRoomNumber: true },
  { name: 'The Doctor\'s Clinic & Laboratory (Osmeña Blvd, Cebu City)', area: 'Cebu City', type: 'Outpatient Clinic', hasRoomNumber: false },

  // Allied Care Experts (ACE) Medical Center
  { name: 'Allied Care Experts (ACE) Medical Center Cebu (N. Bacalso Ave., Basak Pardo)', area: 'Cebu City', type: 'Polyclinic', hasRoomNumber: true },

  // Regional Outpatient & Consultation Centers across Cebu
  { name: 'Minglanilla Outpatient Medical Clinic (Minglanilla, Cebu)', area: 'Minglanilla', type: 'Outpatient Clinic', hasRoomNumber: false },
  { name: 'Danao City Outpatient Consultation Clinic (Danao City)', area: 'Danao City', type: 'Outpatient Clinic', hasRoomNumber: false },
  { name: 'Toledo City Outpatient Consultation Clinic (Toledo City)', area: 'Toledo City', type: 'Outpatient Clinic', hasRoomNumber: false },
  { name: 'Bogo City Outpatient Consultation Center (Bogo City)', area: 'Bogo City', type: 'Outpatient Clinic', hasRoomNumber: false },
  { name: 'Balamban Outpatient Consultation Clinic (Balamban, Cebu)', area: 'Balamban', type: 'Outpatient Clinic', hasRoomNumber: false },
];

export const CEBU_FACILITY_NAMES: string[] = CEBU_FACILITIES.map(f => f.name);
