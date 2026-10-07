import { apiClient } from './apiClient';

export interface DoctorProfile {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  contact_number: string;
  professional_photo_url?: string | null;
  specialty?: string | null;
  credentials?: string | null;
  prc_license_number?: string | null;
  practice_name?: string | null;
  years_of_experience?: number | null;
  areas_of_expertise?: string | null;
  biography?: string | null;
  consultation_fee?: number | null;
  consultation_type?: string | null;
  languages_spoken?: string | null;
  profile_completion_status?: 'INCOMPLETE' | 'COMPLETE' | 'SUBMITTED';
  profile_submitted_at?: string | null;
  approval_status?: 'PENDING' | 'REJECTED' | 'ACTIVE';
  rejection_reason?: string | null;
}

export interface UpdateProfileRequest {
  professional_photo_url?: string;
  specialty?: string;
  credentials?: string;
  prc_license_number?: string;
  practice_name?: string;
  years_of_experience?: number;
  areas_of_expertise?: string;
  biography?: string;
  consultation_fee?: number;
  consultation_type?: string;
  languages_spoken?: string;
}

export interface SubmitProfileResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
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
};
