import { apiClient } from './apiClient';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN';
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword?: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface DoctorRegistrationRequest {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  credentials?: string;
  prcLicenseNumber: string;
  clinic: string;
  contactNumber?: string;
}

export interface DoctorRegistrationResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  doctor: {
    id: string;
    first_name: string;
    last_name: string;
    specialty: string;
    credentials: string | null;
    prc_license_number: string;
    practice_name: string;
    practice_phone: string | null;
    practice_email: string | null;
    is_approved: boolean;
  };
}

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    return apiClient.post<AuthResponse>('/auth/login', credentials);
  },

  register: async (credentials: RegisterCredentials) => {
    return apiClient.post<AuthResponse>('/auth/register', credentials);
  },

  registerDoctor: async (payload: DoctorRegistrationRequest) => {
    return apiClient.post<DoctorRegistrationResponse>('/auth/register/doctor', payload);
  },

  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },

  refreshToken: async (refreshToken: string) => {
    return apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
  },
};