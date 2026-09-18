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

// OTP Verification API for Doctor Signup
//
// Supabase handles only the email OTP. The doctor account itself is created in
// PostgreSQL by the backend after the OTP is verified, and the backend returns
// the application JWT used for subsequent requests.

export interface SendOtpRequest {
  email: string;
  fullName: string;
  contactNumber: string;
  specialty: string;
  credentials: string;
  prcLicenseNumber: string;
  clinic: string;
  password: string;
  confirmPassword: string;
}

export interface SendOtpResponse {
  success: boolean;
  data?: null;
  error?: string;
  errorCode?: string;
  message?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpData {
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
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  data?: VerifyOtpData | null;
  error?: string;
  errorCode?: string;
  message?: string;
}

export interface OtpStatusData {
  isRegistered: boolean;
  isVerified: boolean;
}

export interface OtpStatusResponse {
  success: boolean;
  data?: OtpStatusData | null;
  error?: string;
  errorCode?: string;
  message?: string;
}

export const otpApi = {
  // Validates the sign-up form, stages it server-side and asks the backend to
  // send the OTP through Supabase. No account is created yet.
  sendOtp: async (payload: SendOtpRequest): Promise<SendOtpResponse> => {
    return apiClient.post<null>('/auth/otp/send', payload);
  },

  // Verifies the OTP and, on success, creates the doctor account in PostgreSQL.
  verifyOtp: async (payload: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    return apiClient.post<VerifyOtpData>('/auth/otp/verify', payload);
  },

  resendOtp: async (email: string): Promise<SendOtpResponse> => {
    return apiClient.post<null>('/auth/otp/resend', { email });
  },

  checkOtpStatus: async (email: string): Promise<OtpStatusResponse> => {
    return apiClient.get<OtpStatusData>(`/auth/otp/status/${encodeURIComponent(email)}`);
  },
};