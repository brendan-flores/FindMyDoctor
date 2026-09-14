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

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    return apiClient.post<AuthResponse>('/auth/login', credentials);
  },

  register: async (credentials: RegisterCredentials) => {
    return apiClient.post<AuthResponse>('/auth/register', credentials);
  },

  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },

  refreshToken: async (refreshToken: string) => {
    return apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
  },
};