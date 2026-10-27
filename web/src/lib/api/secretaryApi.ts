import { apiClient, type GetOptions } from './apiClient';

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
  consultation_fee?: number;
}

export const secretaryApi = {
  // Get secretary profile (includes assigned doctor_id)
  getProfile: async (options?: GetOptions): Promise<{ success: boolean; data?: SecretaryProfile; error?: string }> => {
    return apiClient.get<SecretaryProfile>('/secretaries/me', options);
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

  // Payments: list payments for secretary (filtered by assigned doctor)
  getPayments: async (status?: string): Promise<{ success: boolean; data?: Payment[]; error?: string }> => {
    const queryParams = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<Payment[]>(`/payments${queryParams}`);
  },

  // Payments: get payment counts by status
  getPaymentCounts: async (): Promise<{ success: boolean; data?: { UNPAID: number; PENDING_VERIFICATION: number; PAID: number; REJECTED: number; CANCELLED: number }; error?: string }> => {
    return apiClient.get<{ UNPAID: number; PENDING_VERIFICATION: number; PAID: number; REJECTED: number; CANCELLED: number }>('/payments/counts');
  },

  // Payments: get payment by appointment ID
  getPayment: async (appointmentId: string): Promise<{ success: boolean; data?: Payment; error?: string }> => {
    return apiClient.get<Payment>(`/payments/${appointmentId}`);
  },

  // Payments: verify payment (by payment ID)
  verifyPayment: async (id: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/payments/${id}/verify`, {});
  },

  // Payments: reject payment (by payment ID)
  rejectPayment: async (id: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/payments/${id}/reject`, {});
  },

  // Payments: mark as paid (for cash payments, by payment ID)
  markAsPaid: async (id: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/payments/${id}/mark-paid`, {});
  },

  // Payments: get signed receipt URL (by payment ID)
  getSignedReceiptUrl: async (id: string): Promise<{ success: boolean; data?: { signedUrl: string }; error?: string }> => {
    return apiClient.get<{ signedUrl: string }>(`/payments/${id}/receipt-url`);
  },

  // Payments: add charge to payment (by payment ID)
  addCharge: async (paymentId: string, payload: {
    chargeType?: 'ADDITIONAL' | 'MEDICINE';
    description?: string;
    amount?: number;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    prescriptionItemId?: string;
  }): Promise<{ success: boolean; data?: PaymentCharge; error?: string }> => {
    return apiClient.post<PaymentCharge>(`/payments/${paymentId}/charges`, payload);
  },

  // Payments: delete charge from payment (by payment ID and charge ID)
  deleteCharge: async (paymentId: string, chargeId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.delete<void>(`/payments/${paymentId}/charges/${chargeId}`);
  },

  // Payments: record payment (works for both walk-in and booked patients)
  recordPayment: async (payload: {
    appointmentId: string;
    paymentMethod: 'CASH' | 'GCASH';
    consultationFee: number;
    additionalCharges: Array<{ description: string; amount: number }>;
  }): Promise<{ success: boolean; data?: { paymentId: string }; error?: string }> => {
    return apiClient.post<{ paymentId: string }>('/payments/record', payload);
  },

  // Payments: record walk-in payment (deprecated - use recordPayment instead)
  recordWalkInPayment: async (payload: {
    appointmentId: string;
    paymentMethod: 'CASH' | 'GCASH';
    consultationFee: number;
    additionalCharges: Array<{ description: string; amount: number }>;
  }): Promise<{ success: boolean; data?: { paymentId: string }; error?: string }> => {
    return apiClient.post<{ paymentId: string }>('/payments/walk-in', payload);
  },

  // Prescriptions: get patient's prescriptions (with items for medicine charge linking)
  // Note: Backend endpoint GET /api/v1/prescriptions/patients/:patientId currently only allows PATIENT and DOCTOR roles
  // and returns prescriptions without items. This method is added for future backend support.
  getPatientPrescriptions: async (patientId: string): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    return apiClient.get<any[]>(`/prescriptions/patients/${patientId}`);
  },

  // Get secretary dashboard summary
  getDashboard: async (date?: string, options?: GetOptions): Promise<{ success: boolean; data?: SecretaryDashboard; error?: string }> => {
    const queryParams = date ? `?date=${encodeURIComponent(date)}` : '';
    return apiClient.get<SecretaryDashboard>(`/secretaries/me/dashboard${queryParams}`, options);
  },
};

// Payment charge (from payment_charges table)
export interface PaymentCharge {
  id: string;
  payment_id: string;
  charge_type?: 'ADDITIONAL' | 'MEDICINE';
  description: string;
  amount: number;
  quantity?: number | null;
  unit_price?: number | null;
  prescription_item_id?: string | null;
  created_at: string;
  created_by?: string | null;
  created_by_first_name?: string | null;
  created_by_last_name?: string | null;
}

// Payment (from payments table with joined patient/appointment/verifier data)
export interface Payment {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED' | 'CANCELLED';
  payment_method: string;
  receipt_url?: string | null;
  consultation_amount: number;
  total_additional_charges: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  verified_by?: string | null;
  verified_at?: string | null;
  // Patient details (joined)
  patient_first_name?: string;
  patient_last_name?: string;
  patient_phone?: string;
  // Verifier details (joined)
  verified_by_first_name?: string | null;
  verified_by_last_name?: string | null;
  // Appointment details (joined)
  appointment_date?: string;
  reason_for_visit?: string;
  // Nested charges
  charges?: PaymentCharge[];
}

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
  last_message_sender_user_id: string | null;
  unread_count: number | string;
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

// Notification interface (from notifications table)
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

// Secretary dashboard interface
export interface SecretaryDashboard {
  date: string;
  queueCounts: {
    waiting: number;
    inConsultation: number;
    done: number;
  };
  capacity: {
    remaining: number;
    total: number;
  };
  pendingVerificationPayments: number;
  unreadMessages: number;
  todayQueue: Array<{
    queueNumber: number;
    patientName: string;
    reason: string | null;
    status: string;
    appointmentId: string | null;
    registrationSource: string;
  }>;
  paymentsNeedingAction: Array<{
    id: string;
    appointmentId: string;
    status: string;
    paymentMethod: string;
    totalAmount: number;
    patientName: string;
    appointmentDate: string;
    appointmentStatus: string;
  }>;
  recentConversations: Array<{
    id: string | null;
    patientId: string;
    patientName: string;
    unreadCount: number;
    updatedAt: string | null;
  }>;
}

// Notifications API
export const notificationApi = {
  // Get all notifications for current user
  getNotifications: async (): Promise<{ success: boolean; data?: Notification[]; error?: string }> => {
    return apiClient.get<Notification[]>('/notifications');
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<{ success: boolean; error?: string }> => {
    return apiClient.patch<void>(`/notifications/${notificationId}/read`, {});
  },
};
