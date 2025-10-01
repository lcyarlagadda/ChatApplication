// api/client.js - FIXED VERSION
import API_CONFIG from "./config";

class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.sessionManager = null; // Will be set when sessionManager is available
  }

  // Set session manager instance
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Get auth token - prioritize sessionManager, fallback to sessionStorage
  getAuthToken() {
    if (this.sessionManager) {
      const session = this.sessionManager.getCurrentSession();
      return session?.accessToken;
    }
    // Use consistent key with sessionManager
    return sessionStorage.getItem('chatapp_access_token');
  }

  // Set auth token (legacy method for compatibility)
  setAuthToken(token) {
    if (!this.sessionManager) {
      sessionStorage.setItem('chatapp_access_token', token);
    }
  }

  // Remove auth token (legacy method for compatibility)
  removeAuthToken() {
    if (!this.sessionManager) {
      sessionStorage.removeItem('chatapp_access_token');
      localStorage.removeItem('chatapp_refresh_token');
    }
  }

  // Build full URL
  buildUrl(endpoint) {
    return `${this.baseURL}${endpoint}`;
  }

  // Get default headers
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  // Generic request method with automatic token refresh
  async request(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const config = {
      ...options,
      headers: this.getHeaders(options.headers)
    };

    try {
      const response = await fetch(url, config);
      
      // Handle successful responses first
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else if (contentType?.includes('text/')) {
          return await response.text();
        } else {
          return await response.blob();
        }
      }

      // Handle error responses
      let errorData;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
        } else {
          errorData = { message: await response.text() };
        }
      } catch (parseError) {
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }

      // Handle token expiration with automatic refresh
      if (response.status === 401) {
        const isTokenExpired = errorData.code === 'TOKEN_EXPIRED' || 
                              errorData.message?.includes('token') || 
                              errorData.message?.includes('expired');
        
        if (isTokenExpired && this.sessionManager) {
          try {
            // Try to refresh token
            await this.sessionManager.refreshAccessToken();
            
            // Retry the original request with new token
            const newConfig = {
              ...config,
              headers: this.getHeaders(options.headers)
            };
            
            const retryResponse = await fetch(url, newConfig);
            
            if (retryResponse.ok) {
              const contentType = retryResponse.headers.get('content-type');
              if (contentType?.includes('application/json')) {
                return await retryResponse.json();
              } else if (contentType?.includes('text/')) {
                return await retryResponse.text();
              } else {
                return await retryResponse.blob();
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            // Clear session and redirect to login
            this.handleAuthFailure();
            throw new Error('Session expired. Please login again.');
          }
        } else {
          // No session manager or refresh failed
          this.handleAuthFailure();
          throw new Error('Authentication required');
        }
      }

      throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      
    } catch (error) {
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Handle authentication failure
  handleAuthFailure() {
    this.removeAuthToken();
    
    // Emit custom event for app to handle
    window.dispatchEvent(new CustomEvent('auth:failure', {
      detail: { message: 'Session expired. Please login again.' }
    }));
    
    // Clear session if sessionManager is available
    if (this.sessionManager) {
      this.sessionManager.logout();
    }
  }

  // Authenticated request using sessionManager if available
  async authenticatedRequest(endpoint, options = {}) {
    if (this.sessionManager) {
      // Use sessionManager's authenticated request for automatic token handling
      try {
        const response = await this.sessionManager.authenticatedRequest(
          endpoint,
          options
        );
        
        // Parse response - sessionManager returns Response object
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else if (contentType?.includes('text/')) {
          return await response.text();
        } else {
          return await response.blob();
        }
      } catch (error) {
        console.error('Authenticated request failed:', error);
        throw error;
      }
    } else {
      // Fallback to regular request
      return this.request(endpoint, options);
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // PATCH request
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file (multipart/form-data) - FIXED
  async upload(endpoint, formData) {
    const url = this.buildUrl(endpoint);
    const headers = {};
    
    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type - let browser set it for FormData
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  // Download file
  async downloadFile(endpoint, filename) {
    try {
      const response = await fetch(this.buildUrl(endpoint), {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return blob;
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Get base URL
  getBaseURL() {
    return this.baseURL;
  }

  // Set base URL
  setBaseURL(url) {
    this.baseURL = url;
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Dynamically import sessionManager to avoid circular dependencies
if (typeof window !== 'undefined') {
  import('../utils/sessionManager').then((module) => {
    apiClient.setSessionManager(module.default);
  }).catch((error) => {
    console.warn('SessionManager not available:', error);
  });
}

export default apiClient;