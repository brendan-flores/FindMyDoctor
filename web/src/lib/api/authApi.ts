import { apiClient } from './apiClient';

export interface LoginCredentials {
  email: string;
  password: string;
  expectedRole: 'DOCTOR' | 'SECRETARY' | 'ADMIN';
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'PATIENT' | 'DOCTOR' | 'SECRETARY' | 'ADMIN';
}

export interface SessionMetadata {
  rememberMe: boolean;
  persistent: boolean;
  idleTimeoutMinutes: number;
  maxSessionMinutes: number | null;
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
  rememberMe?: boolean;
  isTrustedBrowser?: boolean;
  requiresTrustPrompt?: boolean;
  session?: SessionMetadata;
}

export interface LoginOtpRequiredResponse {
  requiresOtp: true;
  challengeId: string;
  requiresTrustPrompt?: boolean;
  session?: SessionMetadata;
}

export interface CurrentDeviceResponse {
  deviceInfo: string | null;
  capturedAt: string;
}

export interface TrustedBrowser {
  id: string;
  device_info: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  /** True when this row belongs to the browser making the request. */
  is_current?: boolean;
}

export interface VerifyLoginOtpRequest {
  challengeId: string;
  otp: string;
}

export interface ResendLoginOtpRequest {
  challengeId: string;
}

export interface ResendLoginOtpResponse {
  challengeId: string;
}

export interface DoctorRegistrationRequest {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  credentials?: string;
  prcLicenseNumber: string;
  clinic: string;
  roomNumber?: string;
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
    middle_name: string | null;
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
    return apiClient.post<AuthResponse | LoginOtpRequiredResponse>('/auth/login', credentials);
  },

  verifyLoginOtp: async (payload: VerifyLoginOtpRequest) => {
    return apiClient.post<AuthResponse>('/auth/verify-login-otp', payload);
  },

  resendLoginOtp: async (payload: ResendLoginOtpRequest) => {
    return apiClient.post<ResendLoginOtpResponse>('/auth/resend-login-otp', payload);
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

  revokeTrustedBrowser: async () => {
    return apiClient.post('/auth/revoke-trusted-browser', {});
  },

  getTrustedBrowsers: async () => {
    return apiClient.get<{ browsers: TrustedBrowser[] }>('/auth/trusted-browsers');
  },

  getCurrentDevice: async () => {
    return apiClient.get<CurrentDeviceResponse>('/auth/trusted-browsers/current-device');
  },

  trustCurrentDevice: async () => {
    return apiClient.post<AuthResponse>('/auth/trusted-browsers/trust-current', {});
  },

  revokeTrustedBrowserById: async (id: string) => {
    return apiClient.delete<{ revoked: boolean }>(`/auth/trusted-browsers/${encodeURIComponent(id)}`);
  },

  signOutAllDevices: async () => {
    return apiClient.post('/auth/trusted-browsers/revoke-all', {});
  },

  refreshToken: async (refreshToken?: string) => {
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
  firstName: string;
  middleName?: string;
  lastName: string;
  contactNumber: string;
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
    middle_name: string | null;
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

// Password Reset API
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  data?: { message: string } | null;
  error?: string;
  errorCode?: string;
  message?: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export const passwordResetApi = {
  requestPasswordReset: async (payload: PasswordResetRequest): Promise<PasswordResetResponse> => {
    return apiClient.post<{ message: string }>('/auth/password-reset/request', payload);
  },

  resetPassword: async (payload: ResetPasswordRequest): Promise<PasswordResetResponse> => {
    return apiClient.post<{ message: string }>('/auth/password-reset/reset', payload);
  },
};