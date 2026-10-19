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
  room_number?: string | null;
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

// Direct walk-in registration request/response (new consolidated endpoint)
export interface DirectWalkInRegistrationRequest {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
}

export interface DirectWalkInRegistrationResponse {
  patientName: string;
  doctorName: string;
  queueNumber: number;
  registrationStatus: string;
  patientEmail: string;
  temporaryPassword: string;
  appointmentId: string;
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

// Queue entry interface (from queue_entries table and joined patient/doctor data)
export interface QueueEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  queue_date: string;
  queue_number: number;
  registration_source: 'ONLINE' | 'WALK_IN';
  status: 'WAITING' | 'CALLED' | 'NOT_PRESENT' | 'SKIPPED' | 'IN_CHECKUP' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  called_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_email?: string;
  doctor_first_name: string;
  doctor_last_name: string;
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

  // Walk-in: direct registration (consolidated endpoint)
  directRegisterWalkIn: async (payload: DirectWalkInRegistrationRequest): Promise<{ success: boolean; data?: DirectWalkInRegistrationResponse; error?: string }> => {
    return apiClient.post<DirectWalkInRegistrationResponse>('/walk-ins/direct-register', payload);
  },

  // Queue: get queue for a specific date (automatically filtered by assigned doctor for secretaries)
  getQueue: async (date: string): Promise<{ success: boolean; data?: QueueEntry[]; error?: string }> => {
    return apiClient.get<QueueEntry[]>(`/queue/${date}`);
  },

  // Queue: call next patient
  callNextPatient: async (date: string): Promise<{ success: boolean; data?: QueueEntry; error?: string }> => {
    return apiClient.post<QueueEntry>(`/queue/${date}/next`, {});
  },

  // Queue: update queue status
  updateQueueStatus: async (queueId: string, status: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/queue/${queueId}/status`, { status });
  },

  // Queue: start checkup
  startCheckup: async (queueId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.post<void>(`/queue/${queueId}/start-checkup`, {});
  },

  // Queue: complete checkup
  completeCheckup: async (queueId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.post<void>(`/queue/${queueId}/complete`, {});
  },

  // Queue: skip patient
  skipPatient: async (queueId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.post<void>(`/queue/${queueId}/skip`, {});
  },

  // Queue: mark as not present
  markNotPresent: async (queueId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.post<void>(`/queue/${queueId}/not-present`, {});
  },
};

// Conversation list entry (matches GET /conversations response shape)
export interface Conversation {
  id: string | null; // null for patients without conversations
  patient_id: string;
  secretary_id: string | null; // null for patients without conversations
  doctor_id: string;
  status: string | null; // null for patients without conversations
  created_at: string | null; // null for patients without conversations
  updated_at: string | null; // null for patients without conversations
  last_message_preview: string | null;
  last_message_sent_at: string | null;
  unread_count: number;
  secretary_first_name?: string;
  secretary_last_name?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  doctor_first_name?: string;
  doctor_last_name?: string;
  practice_name?: string;
}

// Chat message (matches GET /conversations/:id/messages response shape)
export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  message: string;
  sent_at: string;
  read_at: string | null;
  sender_email: string;
}

// Patient-info sheet (read-only appointment summary from GET /conversations/:id/appointment-summary)
export interface AppointmentSummary {
  patient: {
    id: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    email: string | null;
  };
  appointment: {
    appointmentDate: string;
    status: string;
    reasonForVisit: string | null;
    queueNumber: number | null;
  } | null;
  doctor: {
    firstName: string;
    lastName: string;
    practiceName: string;
  };
}

// Conversations: secretaries only see their assigned doctor's patients
export const conversationApi = {
  // List conversations (patient details, unread badges, latest-message previews)
  getConversations: async (): Promise<{ success: boolean; data?: Conversation[]; error?: string }> => {
    return apiClient.get<Conversation[]>('/conversations');
  },

  // Create a conversation (for secretaries to start chat with a patient)
  createConversation: async (payload: { patientId: string }): Promise<{ success: boolean; data?: Conversation; error?: string }> => {
    return apiClient.post<Conversation>('/conversations', payload);
  },

  // Retrieve a single conversation
  getConversation: async (conversationId: string): Promise<{ success: boolean; data?: Conversation; error?: string }> => {
    return apiClient.get<Conversation>(`/conversations/${conversationId}`);
  },

  // Retrieve message history
  getMessages: async (conversationId: string): Promise<{ success: boolean; data?: ConversationMessage[]; error?: string }> => {
    return apiClient.get<ConversationMessage[]>(`/conversations/${conversationId}/messages`);
  },

  // Send a message
  sendMessage: async (conversationId: string, message: string): Promise<{ success: boolean; data?: ConversationMessage; error?: string }> => {
    return apiClient.post<ConversationMessage>(`/conversations/${conversationId}/messages`, { message });
  },

  // Mark incoming messages as read
  markAsRead: async (conversationId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/conversations/${conversationId}/read`, {});
  },

  // Read-only patient-info sheet for the selected conversation
  getAppointmentSummary: async (conversationId: string): Promise<{ success: boolean; data?: AppointmentSummary; error?: string }> => {
    return apiClient.get<AppointmentSummary>(`/conversations/${conversationId}/appointment-summary`);
  },

  // Read-only patient-info sheet by patient ID (for patients without conversations)
  getAppointmentSummaryByPatientId: async (patientId: string): Promise<{ success: boolean; data?: AppointmentSummary; error?: string }> => {
    return apiClient.get<AppointmentSummary>(`/conversations/patient/${patientId}/appointment-summary`);
  },
};
