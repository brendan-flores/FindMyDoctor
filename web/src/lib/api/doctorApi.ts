import { apiClient } from './apiClient';

export interface DoctorProfile {
  id: string;
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email?: string;
  email_verified?: boolean;
  contact_number: string;
  professional_photo_url?: string | null;
  specialty?: string | null;
  credentials?: string | null;
  prc_license_number?: string | null;
  practice_name?: string | null;
  room_number?: string | null;
  years_of_experience?: number | null;
  areas_of_expertise?: string | null;
  biography?: string | null;
  consultation_fee?: number | null;
  languages_spoken?: string | null;
  profile_completion_status?: 'INCOMPLETE' | 'COMPLETE' | 'SUBMITTED';
  profile_submitted_at?: string | null;
  approval_status?: 'PENDING' | 'REJECTED' | 'ACTIVE';
  rejection_reason?: string | null;
  two_factor_enabled?: boolean;
}

export interface UpdateProfileRequest {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact_number?: string;
  professional_photo_url?: string;
  specialty?: string;
  credentials?: string;
  prc_license_number?: string;
  practice_name?: string;
  room_number?: string;
  years_of_experience?: number;
  areas_of_expertise?: string;
  biography?: string;
  consultation_fee?: number;
  languages_spoken?: string;
}

export interface SubmitProfileResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
}

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

export interface Prescription {
  id: string;
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  prescription_date: string;
  notes?: string | null;
  doctor_first_name?: string;
  doctor_last_name?: string;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface UpdatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  middleName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
}

export interface AssociatePatientRequest {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  middleName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
}

export interface Visit {
  id: string;
  appointment_id?: string;
  patient_id: string;
  doctor_id: string;
  visit_date: string;
  reason_for_visit?: string;
  diagnosis?: string;
  notes?: string;
  blood_pressure?: string;
  weight?: number;
  height?: number;
  temperature?: number;
  appointment_date?: string;
  doctor_first_name?: string;
  doctor_last_name?: string;
}

export const doctorApi = {
  // Get current doctor's profile
  getProfile: async (): Promise<{ success: boolean; data?: DoctorProfile; error?: string }> => {
    return apiClient.get<DoctorProfile>('/doctors/me');
  },

  // Update doctor's professional profile
  updateProfile: async (payload: UpdateProfileRequest): Promise<{ success: boolean; data?: DoctorProfile; error?: string }> => {
    return apiClient.put<DoctorProfile>('/doctors/me/profile', payload);
  },

  // Submit profile for admin approval
  submitProfile: async (): Promise<SubmitProfileResponse> => {
    return apiClient.post<{ message: string }>('/doctors/me/profile/submit', {});
  },

  // Get doctor's schedules
  getSchedules: async (): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    return apiClient.get<any[]>('/doctors/me/schedules');
  },

  // Create a new schedule
  createSchedule: async (payload: any): Promise<{ success: boolean; data?: any; error?: string }> => {
    return apiClient.post<any>('/doctors/me/schedules', payload);
  },

  // Update a schedule
  updateSchedule: async (id: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> => {
    return apiClient.put<any>(`/doctors/me/schedules/${id}`, payload);
  },

  // Delete a schedule
  deleteSchedule: async (id: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.delete<{ success: boolean }>(`/doctors/me/schedules/${id}`);
  },

  // Delete professional photo
  deletePhoto: async (): Promise<{ success: boolean; error?: string }> => {
    return apiClient.delete<{ success: boolean }>('/doctors/me/photo');
  },

  // Get patients for the authenticated doctor
  getPatients: async (doctorId: string): Promise<{ success: boolean; data?: Patient[]; error?: string }> => {
    return apiClient.get<Patient[]>(`/patients/doctor/${doctorId}`);
  },

  // Get patient by ID
  getPatientById: async (patientId: string): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.get<Patient>(`/patients/${patientId}`);
  },

  // Get patient's prescriptions
  getPatientPrescriptions: async (patientId: string): Promise<{ success: boolean; data?: Prescription[]; error?: string }> => {
    return apiClient.get<Prescription[]>(`/prescriptions/patients/${patientId}`);
  },

  // Update patient information
  updatePatient: async (patientId: string, payload: UpdatePatientRequest): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.put<Patient>(`/patients/${patientId}`, payload);
  },

  // Get patient's visit history
  getPatientVisits: async (patientId: string): Promise<{ success: boolean; data?: Visit[]; error?: string }> => {
    return apiClient.get<Visit[]>(`/visits/patient/${patientId}`);
  },

  // Associate patient with doctor (create association and submit initial details)
  associatePatient: async (payload: AssociatePatientRequest): Promise<{ success: boolean; data?: Patient; error?: string }> => {
    return apiClient.post<Patient>('/patients/associate', payload);
  },

  // Get doctor dashboard summary
  getDashboard: async (date?: string): Promise<{ success: boolean; data?: DoctorDashboard; error?: string }> => {
    const queryParams = date ? `?date=${encodeURIComponent(date)}` : '';
    return apiClient.get<DoctorDashboard>(`/doctors/me/dashboard${queryParams}`);
  },
};

export interface DoctorDashboard {
  date: string;
  appointmentCounts: {
    completed: number;
    waiting: number;
    cancelled: number;
  };
  capacity: {
    used: number;
    total: number;
    remaining: number;
  };
  nextPatient: {
    queueNumber: number;
    patientName: string;
    appointmentId: string | null;
  } | null;
  todayQueue: Array<{
    queueNumber: number;
    patientName: string;
    reason: string | null;
    status: string;
    appointmentId: string | null;
  }>;
  upcomingAppointments: Array<{
    date: string;
    patientName: string;
    reason: string | null;
    status: string;
    queueNumber: number | null;
  }>;
  todaySchedule: {
    workingHours: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
    hasException: boolean;
    exception: {
      startDate: string;
      endDate: string;
      reason: string | null;
    } | null;
  };
}
