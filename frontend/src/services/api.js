/**
 * Centralized API client for communicating with the FastAPI backend.
 * Handles JWT token injection, centralized error handling, and 401 session expiration.
 */

export function getApiBaseUrl() {
  try {
    const custom = localStorage.getItem('faculty_hub_api_base_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {
    // LocalStorage unavailable
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '/api';
}

const TOKEN_KEY = 'faculty_hub_token';
const USER_KEY = 'faculty_hub_user';

export const authStorage = {
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      // Storage unavailable
    }
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      // Storage unavailable
    }
  },
  clearAuth: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      // Storage unavailable
    }
  },
};

async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  const token = authStorage.getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach signed JWT access token for authenticated requests
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Pydantic validation errors
            errorMessage = errorData.detail.map(err => {
              const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : '';
              return field ? `${field}: ${err.msg}` : err.msg;
            }).join(', ');
          } else {
            errorMessage = errorData.detail;
          }
        }
      } catch {
        // Response wasn't JSON
      }

      // If protected route returns 401 Unauthorized, automatically sign out and notify
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/google') {
        authStorage.clearAuth();
        window.dispatchEvent(new CustomEvent('auth:unauthorized', {
          detail: { message: errorMessage || 'Your session has expired. Please sign in again.' }
        }));
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    // Maintain security: Never log sensitive payloads, passwords, or tokens
    console.error(`API Error on ${endpoint}: ${error.message}`);
    throw error;
  }
}

export const api = {
  // Storage helpers
  getToken: authStorage.getToken,
  setToken: authStorage.setToken,
  getUser: authStorage.getUser,
  setUser: authStorage.setUser,
  clearAuth: authStorage.clearAuth,

  // Authentication
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  googleLogin: (googlePayload) => request('/auth/google', {
    method: 'POST',
    body: JSON.stringify(googlePayload),
  }),
  getCurrentUser: () => request('/auth/me'),

  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

  // Faculty
  getFaculty: (params = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.department) query.append('department', params.department);
    const queryString = query.toString();
    return request(`/faculty${queryString ? `?${queryString}` : ''}`);
  },
  getFacultyById: (id) => request(`/faculty/${id}`),
  createFaculty: (data) => request('/faculty', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateFaculty: (id, data) => request(`/faculty/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteFaculty: (id) => request(`/faculty/${id}`, {
    method: 'DELETE',
  }),

  // Activities
  getActivities: (params = {}) => {
    const query = new URLSearchParams();
    if (params.faculty_id) query.append('faculty_id', params.faculty_id);
    if (params.category) query.append('category', params.category);
    if (params.year) query.append('year', params.year);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    const queryString = query.toString();
    return request(`/activities${queryString ? `?${queryString}` : ''}`);
  },
  getActivityById: (id) => request(`/activities/${id}`),
  createActivity: (data) => request('/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateActivity: (id, data) => request(`/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteActivity: (id) => request(`/activities/${id}`, {
    method: 'DELETE',
  }),
  getCategories: () => request('/activities/meta/categories'),

  // Appraisal
  getFacultyAppraisal: (facultyId) => request(`/appraisal/${facultyId}`),

  // Configuration
  getBaseUrl: getApiBaseUrl,
  setCustomBaseUrl: (url) => {
    if (url) {
      localStorage.setItem('faculty_hub_api_base_url', url);
    } else {
      localStorage.removeItem('faculty_hub_api_base_url');
    }
  },
};
