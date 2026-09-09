export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T, message: string = 'Operation successful.'): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function error(code: string, message: string): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CAPACITY_FULL: 'CAPACITY_FULL',
  APPOINTMENT_SLOT_UNAVAILABLE: 'APPOINTMENT_SLOT_UNAVAILABLE',
  QUEUE_ASSIGNMENT_FAILED: 'QUEUE_ASSIGNMENT_FAILED',
  CONVERSATION_ACCESS_DENIED: 'CONVERSATION_ACCESS_DENIED',
  PAYMENT_VERIFICATION_REQUIRED: 'PAYMENT_VERIFICATION_REQUIRED',
  PAYMENT_ALREADY_VERIFIED: 'PAYMENT_ALREADY_VERIFIED',
  INVALID_PAYMENT_RECEIPT: 'INVALID_PAYMENT_RECEIPT',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  AI_RESPONSE_ERROR: 'AI_RESPONSE_ERROR',
  INVALID_APPOINTMENT_STATUS: 'INVALID_APPOINTMENT_STATUS',
  SERVER_ERROR: 'SERVER_ERROR',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
} as const;