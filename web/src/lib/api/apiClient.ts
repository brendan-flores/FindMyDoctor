const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
  httpStatus?: number;
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
      return { ...normalized, httpStatus: status };
    }
  } catch {
    // not valid JSON
  }
  return {
    success: false,
    error: `Server error (${status}): ${text}`,
    httpStatus: status,
  };
}

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    // Load tokens from localStorage on initialization
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('token');
      const storedRefresh = localStorage.getItem('refreshToken');
      if (stored && stored !== 'undefined' && stored !== 'null') {
        this.token = stored;
      }
      if (storedRefresh && storedRefresh !== 'undefined' && storedRefresh !== 'null') {
        this.refreshToken = storedRefresh;
      }
    }
  }

  setToken(token: string, refreshToken?: string) {
    if (!token || token === 'undefined' || token === 'null') {
      this.clearToken();
      return;
    }
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        localStorage.setItem('refreshToken', refreshToken);
      }
    }
  }

  clearToken() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }

  private subscribeTokenRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeTokenRefresh((token) => resolve(token));
      });
    }

    this.isRefreshing = true;

    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      if (data.success && data.data && data.data.accessToken) {
        const newToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        
        this.setToken(newToken, newRefreshToken);
        
        this.onTokenRefreshed(newToken);
        
        return newToken;
      }

      throw new Error('Invalid refresh response');
    } catch (error) {
      this.clearToken();
      this.handleSessionExpired();
      return null;
    } finally {
      this.isRefreshing = false;
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
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          return normalizeApiResponse<T>(data);
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
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

  async post<T>(endpoint: string, body: any = {}, options?: { isFormData?: boolean; headers?: HeadersInit }): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = options?.headers as Record<string, string> || {};

      // Add Authorization header if not provided
      if (!headers['Authorization']) {
        const cookieToken = this.getCookie('accessToken');
        const tokenToUse = cookieToken || this.token;
        if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
      }

      // Don't set Content-Type for FormData - let the browser set it with boundary
      if (!options?.isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: headers as HeadersInit,
        body: options?.isFormData ? body : JSON.stringify(body),
        credentials: 'include',
      });

      if (response.status === 401) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryHeaders: Record<string, string> = options?.headers as Record<string, string> || {};
          if (!retryHeaders['Authorization']) {
            const cookieToken = this.getCookie('accessToken');
            const tokenToUse = cookieToken || this.token;
            if (tokenToUse && tokenToUse !== 'undefined' && tokenToUse !== 'null') {
              retryHeaders['Authorization'] = `Bearer ${tokenToUse}`;
            }
          }
          if (!options?.isFormData && !retryHeaders['Content-Type']) {
            retryHeaders['Content-Type'] = 'application/json';
          }

          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: retryHeaders as HeadersInit,
            body: options?.isFormData ? body : JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          return normalizeApiResponse<T>(data);
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
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
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          return normalizeApiResponse<T>(data);
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
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
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          return normalizeApiResponse<T>(data);
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
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
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          // Retry the request with new token
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include',
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return parseErrorResponse<T>(retryResponse.status, errorText);
          }

          const data = await retryResponse.json();
          return normalizeApiResponse<T>(data);
        }
        return {
          success: false,
          error: 'Session expired',
          httpStatus: 401,
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
