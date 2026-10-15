import { apiClient } from './apiClient';

// Patient interface (schema verified from 001_initial_schema.sql)
export interface Patient {
  id: string;
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth?: string;
  sex?: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  medical_history?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  email?: string;
}

// Secretary profile (verified from secretaries.ts lines 15-19)
export interface SecretaryProfile {
  id: string;
  user_id: string;
  doctor_id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact_number?: string;
  two_factor_enabled?: boolean;
  is_approved?: boolean;
  email?: string;
  role?: string;
  must_change_password?: boolean;
  doctor_first_name?: string;
  doctor_last_name?: string;
  practice_name?: string;
}

// Walk-in search response (verified from walk-ins.ts lines 38-39)
export interface WalkInPatientSearch {
  id: string;
  email: string;
  role: string;
  must_change_password: boolean;
  patient_id: string;
  first_name: string;
  last_name: string;
}

// Walk-in create account request/response (verified from walk-ins.ts)
export interface CreateWalkInAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  doctorId: string;
}

export interface CreateWalkInAccountResponse {
  user: {
    id: string;
    email: string;
    mustChangePassword: boolean;
  };
  patient?: {
    id: string;
  };
  temporaryPassword: string;
}

// Walk-in patient details request/response (verified from walk-ins.ts)
export interface WalkInPatientDetailsRequest {
  patientId: string;
  doctorId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
}

// Walk-in registration request/response (verified from walk-ins.ts)
export interface WalkInRegistrationRequest {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  reasonForVisit?: string;
}

export interface WalkInRegistrationResponse {
  appointmentId: string;
  queueNumber: number;
  totalPatients: number;
}

// Update patient request (CORRECTED: 6 required fields per endpoint plan)
export interface UpdatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  middleName?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  medicalHistory?: string | null;
  allergies?: string | null;
  currentMedications?: string | null;
}

export const secretaryApi = {
  // Get secretary profile (includes assigned doctor_id)
  getProfile: async (): Promise<{ success: boolean; data?: SecretaryProfile; error?: string }> => {
    return apiClient.get<SecretaryProfile>('/secretaries/me');
  },

  // Search patients (by email, phone, firstName, lastName)
  searchPatients: async (params: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string
  }): Promise<{ success: boolean; data?: Patient[]; error?: string }> => {
    const queryParams = new URLSearchParams();
    if (params.email) queryParams.append('email', params.email);
    if (params.phone) queryParams.append('phone', params.phone);
    if (params.firstName) queryParams.append('firstName', params.firstName);
    if (params.lastName) queryParams.append('lastName', params.lastName);
    return apiClient.get<Patient[]>(`/patients/search?${queryParams.toString()}`);
  },

  // Get patient by ID
  getPatientById: async (patientId: string): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.get<Patient>(`/patients/${patientId}`);
  },

  // Update patient by ID
  updatePatient: async (patientId: string, payload: UpdatePatientRequest): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.put<Patient>(`/patients/${patientId}`, payload);
  },

  // Walk-in: search patient by email
  searchWalkInPatient: async (email: string): Promise<{ success: boolean; data?: WalkInPatientSearch; error?: string; httpStatus?: number }> => {
    return apiClient.get<WalkInPatientSearch>(`/walk-ins/search?email=${encodeURIComponent(email)}`);
  },

  // Walk-in: create new patient account
  createWalkInAccount: async (payload: CreateWalkInAccountRequest): Promise<{ success: boolean; data?: CreateWalkInAccountResponse; error?: string }> => {
    return apiClient.post<CreateWalkInAccountResponse>('/walk-ins/create-account', payload);
  },

  // Walk-in: submit patient details
  submitWalkInPatientDetails: async (payload: WalkInPatientDetailsRequest): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.post<Patient>('/walk-ins/submit-patient-details', payload);
  },

  // Walk-in: register walk-in
  registerWalkIn: async (payload: WalkInRegistrationRequest): Promise<{ success: boolean; data?: WalkInRegistrationResponse; error?: string }> => {
    return apiClient.post<WalkInRegistrationResponse>('/walk-ins', payload);
  },
};
