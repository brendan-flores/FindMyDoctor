import { apiClient, type GetOptions } from './apiClient';

export interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN';
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  contactNumber?: string | null;
  specialty: string;
  credentials?: string | null;
  prcLicenseNumber: string;
  practiceName?: string | null;
  practiceAddress?: string | null;
  practicePhone?: string | null;
  practiceEmail?: string | null;
  professionalPhotoUrl?: string | null;
  yearsOfExperience?: number | null;
  areasOfExpertise?: string | null;
  biography?: string | null;
  consultationFee?: number | null;
  languagesSpoken?: string | null;
  isApproved: boolean;
  isActive?: boolean;
  approvalStatus?: 'PENDING' | 'ACTIVE' | 'REJECTED';
  profileCompletionStatus?: 'INCOMPLETE' | 'COMPLETE' | 'SUBMITTED';
  profileSubmittedAt?: string | null;
  practiceLatitude?: number;
  practiceLongitude?: number;
  practiceDescription?: string;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  gcashQrCodeUrl?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt?: string;
}

export interface Secretary {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  firstName: string;
  lastName: string;
  doctorId: string;
  doctorFirstName?: string;
  doctorLastName?: string;
  doctorSpecialty?: string;
  isApproved: boolean;
  createdAt: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  consultationDurationMinutes: number;
  isActive: boolean;
}

export interface DashboardStats {
  doctors: {
    total: number;
    pending: number;
    active: number;
    rejected: number;
  };
  users: {
    patient: number;
    doctor: number;
    secretary: number;
    admin: number;
    superadmin: number;
  };
  unassignedSecretaries: number;
  pendingApprovals: Array<{
    id: string;
    firstName: string;
    lastName: string;
    specialty: string;
    profileSubmittedAt: string | null;
    profileCompletionStatus: string;
    email: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  targetRole: string | null;
  targetType: string | null;
  timestamp: string;
  reason: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminApi = {
  // User Management
  getAllUsers: async () => {
    return apiClient.get<User[]>('/admin/users');
  },

  // Doctor Management
  getAllDoctors: async () => {
    return apiClient.get<Doctor[]>('/admin/doctors');
  },
  createDoctor: async (doctorData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    specialty: string;
    prcLicenseNumber: string;
    practiceName?: string;
    practiceAddress?: string;
    practiceLatitude?: number;
    practiceLongitude?: number;
    practicePhone?: string;
    practiceEmail?: string;
    practiceDescription?: string;
    operatingHoursStart?: string;
    operatingHoursEnd?: string;
    gcashQrCodeUrl?: string;
  }) => {
    return apiClient.post<{ doctor: Doctor }>('/admin/doctors', doctorData);
  },

  approveDoctor: async (doctorId: string) => {
    return apiClient.patch<{ doctor: Doctor }>(`/admin/doctors/${doctorId}/approve`, {});
  },

  getDoctorById: async (doctorId: string) => {
    return apiClient.get<Doctor>(`/admin/doctors/${doctorId}`);
  },

  rejectDoctor: async (doctorId: string, reason: string) => {
    return apiClient.patch(`/admin/doctors/${doctorId}/reject`, { reason });
  },

  getDoctorSchedules: async (doctorId: string) => {
    return apiClient.get<DoctorSchedule[]>(`/admin/doctors/${doctorId}/schedules`);
  },

  // Secretary Management
  createSecretary: async (secretaryData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    doctorId: string;
  }) => {
    return apiClient.post<{ secretary: Secretary }>('/admin/secretaries', secretaryData);
  },

  approveSecretary: async (secretaryId: string) => {
    return apiClient.patch<{ secretary: Secretary }>(`/admin/secretaries/${secretaryId}/approve`, {});
  },

  getAllSecretaries: async () => {
    return apiClient.get<Secretary[]>('/admin/secretaries');
  },

  // Dashboard Statistics
  getDashboardStats: async (options?: GetOptions) => {
    return apiClient.get<DashboardStats>('/admin/dashboard/stats', options);
  },

  // Doctor Account Status Controls
  deactivateDoctor: async (doctorId: string) => {
    return apiClient.patch(`/admin/doctors/${doctorId}/deactivate`, {});
  },

  reactivateDoctor: async (doctorId: string) => {
    return apiClient.patch(`/admin/doctors/${doctorId}/reactivate`, {});
  },

  // Secretary Account Status Controls
  deactivateSecretary: async (secretaryId: string) => {
    return apiClient.patch(`/admin/secretaries/${secretaryId}/deactivate`, {});
  },

  reactivateSecretary: async (secretaryId: string) => {
    return apiClient.patch(`/admin/secretaries/${secretaryId}/reactivate`, {});
  },

  resetSecretaryPassword: async (secretaryId: string) => {
    return apiClient.post<{ email: string; temporaryPassword: string }>(`/admin/secretaries/${secretaryId}/reset-password`, {});
  },

  // Audit Log
  getAuditLog: async (params?: {
    action?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }, options?: GetOptions) => {
    const queryParams = new URLSearchParams();
    if (params?.action) queryParams.append('action', params.action);
    if (params?.actorId) queryParams.append('actorId', params.actorId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    return apiClient.get<AuditLogResponse>(`/admin/audit-log${queryString ? `?${queryString}` : ''}`, options);
  },
};