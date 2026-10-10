const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
}

/**
 * The backend returns errors as `{ success: false, error: { code, message } }`.
 * Normalize that into the flat shape the pages consume so error messages can be
 * displayed directly.
 */
function normalizeApiResponse<T>(payload: any): ApiResponse<T> {
  if (payload && payload.success === false && payload.error && typeof payload.error === 'object') {
    const code = typeof payload.error.code === 'string' ? payload.error.code : undefined;
    const message = typeof payload.error.message === 'string' ? payload.error.message : 'Request failed';

    return { success: false, error: message, errorCode: code };
  }

  return payload as ApiResponse<T>;
}

function parseErrorResponse<T>(status: number, text: string): ApiResponse<T> {
  try {
    const json = JSON.parse(text);
    const normalized = normalizeApiResponse<T>(json);
    if (normalized && normalized.error) {
      return normalized;
    }
  } catch {
    // not valid JSON
  }
  return {
    success: false,
    error: `Server error (${status}): ${text}`,
  };
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization (for backward compatibility)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('token');
      if (stored && stored !== 'undefined' && stored !== 'null') {
        this.token = stored;
      }
    }
  }

  setToken(token: string) {
    if (!token || token === 'undefined' || token === 'null') {
      this.clearToken();
      return;
    }
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  private handleSessionExpired() {
    this.clearToken();
    if (typeof window !== 'undefined') {
      // Redirect to login with session expired message
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/doctor')) {
        window.location.href = '/doctor-login?session=expired';
      } else if (currentPath.startsWith('/secretary')) {
        window.location.href = '/secretary-login?session=expired';
      } else if (currentPath.startsWith('/admin')) {
        window.location.href = '/admin/login?session=expired';
      }
    }
  }

  private getCookie(name: string): string | null {
    if (typeof window === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    
    return null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Prefer token from cookies (HttpOnly), fall back to localStorage (for backward compatibility)
    const cookieToken = this.getCookie('accessToken');
    const tokenToUse = cookieToken || this.token;

    if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
      headers['Authorization'] = `Bearer ${tokenToUse}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
      });

      if (response.status === 401) {
        this.handleSessionExpired();
        return {
          success: false,
          error: 'Session expired',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      return normalizeApiResponse<T>(data);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async post<T>(endpoint: string, body: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401) {
        this.handleSessionExpired();
        return {
          success: false,
          error: 'Session expired',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      return normalizeApiResponse<T>(data);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async put<T>(endpoint: string, body: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401) {
        this.handleSessionExpired();
        return {
          success: false,
          error: 'Session expired',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      return normalizeApiResponse<T>(data);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async patch<T>(endpoint: string, body: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401) {
        this.handleSessionExpired();
        return {
          success: false,
          error: 'Session expired',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      return normalizeApiResponse<T>(data);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'include',
      });

      if (response.status === 401) {
        this.handleSessionExpired();
        return {
          success: false,
          error: 'Session expired',
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return parseErrorResponse<T>(response.status, errorText);
      }

      const data = await response.json();
      return normalizeApiResponse<T>(data);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }
}

export const apiClient = new ApiClient();