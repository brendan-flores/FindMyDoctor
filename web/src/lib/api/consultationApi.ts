import { apiClient, type GetOptions } from './apiClient';

export interface ConsultationAppointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason_for_visit?: string | null;
  practice_name?: string | null;
  specialty?: string | null;
  queue_number?: number | null;
  queue_status?: string | null;
  queue_started_at?: string | null;
}

export interface ConsultationPatient {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth?: string | null;
  sex?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  allergies?: string | null;
  allergies_confirmed_none?: boolean;
  current_medications?: string | null;
  medications_confirmed_none?: boolean;
  medical_history?: string | null;
}

export interface ConsultationVisit {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  visit_date: string;
  reason_for_visit?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  blood_pressure?: string | null;
  weight?: number | string | null;
  height?: number | string | null;
  temperature?: number | string | null;
  status: 'DRAFT' | 'ISSUED';
  issued_at?: string | null;
  doctor_finished_at?: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
  prescription_draft?: { items?: MedicationInput[]; notes?: string | null } | null;
  draft_updated_at?: string | null;
  updated_at?: string | null;
}

export interface MedicationInput {
  id?: string;
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: number | string | null;
  instructions?: string | null;
}

export interface ConsultationPrescriptionItem extends MedicationInput {
  id: string;
  prescription_id: string;
  medication_name?: string;
  created_at?: string;
}

export interface ConsultationPrescription {
  id: string;
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  prescription_date: string;
  notes?: string | null;
  status: 'ISSUED' | 'VOIDED';
  voided_at?: string | null;
  void_reason?: string | null;
  replaces_prescription_id?: string | null;
  has_pdf?: boolean;
  pdf_url?: string | null;
  items: ConsultationPrescriptionItem[];
}

export interface ConsultationFavorite {
  id: string;
  doctor_id: string;
  medication_name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

export interface ConsultationEditHistoryEntry {
  id: string;
  visit_id: string;
  edited_by: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  reason?: string | null;
  created_at: string;
  edited_by_email?: string | null;
}

export interface ConsultationContext {
  appointment: ConsultationAppointment;
  patient: ConsultationPatient;
  visit: ConsultationVisit | null;
  prescriptions: ConsultationPrescription[];
  previousPrescription: ConsultationPrescription | null;
  favorites: ConsultationFavorite[];
  editHistory: ConsultationEditHistoryEntry[];
  lastVisitDate: string | null;
  firstVisit: boolean;
  isInCheckup: boolean;
  canStart: boolean;
  doctorFinished: boolean;
  isDraft: boolean;
  missingPatientInfo: string[];
  canIssue: boolean;
}

export interface ConsultationDraftPayload {
  reasonForVisit?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  bloodPressure?: string | null;
  weight?: number | null;
  height?: number | null;
  temperature?: number | null;
  prescriptionDraft: {
    items: MedicationInput[];
    notes?: string | null;
  };
  baseUpdatedAt?: string | null;
}

export interface IssueResult {
  visit: ConsultationVisit;
  prescription: ConsultationPrescription | null;
  pdfGenerated: boolean;
  pdfError?: string | null;
  notificationSent: boolean;
}

export const consultationApi = {
  getContext: async (
    appointmentId: string,
    options?: GetOptions
  ): Promise<{ success: boolean; data?: ConsultationContext; error?: string }> => {
    return apiClient.get<ConsultationContext>(`/consultation/appointments/${appointmentId}`, options);
  },

  start: async (appointmentId: string): Promise<{ success: boolean; data?: ConsultationVisit; error?: string }> => {
    return apiClient.post<ConsultationVisit>(`/consultation/appointments/${appointmentId}/start`, {});
  },

  saveDraft: async (
    visitId: string,
    payload: ConsultationDraftPayload
  ): Promise<{ success: boolean; data?: ConsultationVisit; error?: string }> => {
    return apiClient.patch<ConsultationVisit>(`/consultation/visits/${visitId}/draft`, payload);
  },

  issue: async (
    visitId: string,
    payload: Omit<ConsultationDraftPayload, 'baseUpdatedAt'>
  ): Promise<{ success: boolean; data?: IssueResult; error?: string }> => {
    return apiClient.post<IssueResult>(`/consultation/visits/${visitId}/issue`, payload);
  },

  issueReplacement: async (
    visitId: string,
    payload: { prescriptionDraft: { items: MedicationInput[]; notes?: string | null } }
  ): Promise<{ success: boolean; data?: { prescription: ConsultationPrescription; pdfGenerated: boolean; pdfError?: string | null; notificationSent: boolean }; error?: string }> => {
    return apiClient.post(`/consultation/visits/${visitId}/prescriptions`, payload);
  },

  voidPrescription: async (
    prescriptionId: string,
    reason: string
  ): Promise<{ success: boolean; data?: { prescription: ConsultationPrescription; notificationSent: boolean }; error?: string }> => {
    return apiClient.post(`/consultation/prescriptions/${prescriptionId}/void`, { reason });
  },

  updatePatient: async (
    patientId: string,
    payload: {
      allergies?: string | null;
      allergiesConfirmedNone?: boolean;
      currentMedications?: string | null;
      medicationsConfirmedNone?: boolean;
      dateOfBirth?: string;
      sex?: string;
    }
  ): Promise<{ success: boolean; data?: ConsultationPatient; error?: string }> => {
    return apiClient.patch<ConsultationPatient>(`/consultation/patients/${patientId}`, payload);
  },

  updateVisit: async (
    visitId: string,
    payload: {
      reasonForVisit?: string;
      diagnosis?: string;
      notes?: string;
      bloodPressure?: string;
      weight?: number;
      height?: number;
      temperature?: number;
      editReason?: string;
    }
  ): Promise<{ success: boolean; data?: ConsultationVisit; error?: string }> => {
    return apiClient.put<ConsultationVisit>(`/visits/${visitId}`, payload);
  },

  getEditHistory: async (visitId: string): Promise<{ success: boolean; data?: ConsultationEditHistoryEntry[]; error?: string }> => {
    return apiClient.get<ConsultationEditHistoryEntry[]>(`/consultation/visits/${visitId}/edit-history`);
  },

  getFavorites: async (): Promise<{ success: boolean; data?: ConsultationFavorite[]; error?: string }> => {
    return apiClient.get<ConsultationFavorite[]>('/consultation/favorites');
  },

  saveFavorite: async (payload: {
    medicationName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }): Promise<{ success: boolean; data?: ConsultationFavorite; error?: string }> => {
    return apiClient.post<ConsultationFavorite>('/consultation/favorites', payload);
  },

  removeFavorite: async (id: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.delete(`/consultation/favorites/${id}`);
  },

  getMedicationSuggestions: async (): Promise<{ success: boolean; data?: string[]; error?: string }> => {
    return apiClient.get<string[]>('/consultation/medication-suggestions');
  },
};
