import { apiClient } from './apiClient';

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
  lastName: string;
  specialty: string;
  credentials?: string;
  prcLicenseNumber: string;
  isApproved: boolean;
  approvalStatus?: 'PENDING' | 'ACTIVE' | 'REJECTED';
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
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt?: string;
}

export interface Secretary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  doctorId: string;
  isApproved: boolean;
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
};