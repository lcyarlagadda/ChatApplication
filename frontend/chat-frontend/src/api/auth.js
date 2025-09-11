// api/auth.js (or wherever your authService is)
import apiClient from "./client";
import API_CONFIG from "./config";

class AuthService {
  constructor() {
    this.sessionManager = null;
  }

  // Set session manager when available
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Login with session management
  async login(credentials) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      if (response.success && response.accessToken && response.refreshToken) {
        // Store session with 1-hour expiry using sessionManager
        if (this.sessionManager) {
          this.sessionManager.setSession(
            response.user,
            response.accessToken,
            response.refreshToken,
            60 // 1 hour
          );
        } else {
          // Fallback for backward compatibility
          apiClient.setAuthToken(response.accessToken);
        }
      }

      return response;
    } catch (error) {
      throw new Error(error.message || "Login failed");
    }
  }

  // Register with session management
  async register(userData) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.AUTH.REGISTER,
        userData
      );

      if (response.success && response.accessToken && response.refreshToken) {
        // Store session with 1-hour expiry
        if (this.sessionManager) {
          this.sessionManager.setSession(
            response.user,
            response.accessToken,
            response.refreshToken,
            60 // 1 hour
          );
        } else {
          // Fallback for backward compatibility
          apiClient.setAuthToken(response.accessToken);
        }
      }

      return response;
    } catch (error) {
      throw new Error(error.message || "Registration failed");
    }
  }

  // Logout with session cleanup
  async logout() {
    try {
      // Try to logout on server using authenticated request
      if (this.sessionManager) {
        await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.LOGOUT),
          { method: "POST" }
        );
      } else {
        // Fallback
        await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout API call failed:", error);
    } finally {
      // Always clear local session
      if (this.sessionManager) {
        this.sessionManager.logout();
      } else {
        apiClient.removeAuthToken();
      }
    }
  }

  // Add these missing methods to your authService class:

async verifyEmail(email, token = null, code = null) {
  try {
    const response = await apiClient.post(
      API_CONFIG.ENDPOINTS.AUTH.VERIFY_EMAIL,
      { email, token, code }
    );

    if (response.success && response.accessToken && response.refreshToken) {
      // Store session after successful verification
      if (this.sessionManager) {
        this.sessionManager.setSession(
          response.user,
          response.accessToken,
          response.refreshToken,
          60 // 1 hour
        );
      }
      apiClient.setAuthToken(response.accessToken);
    }

    return response;
  } catch (error) {
    throw new Error(error.message || "Email verification failed");
  }
}

async resendVerification(email) {
  try {
    const response = await apiClient.post(
      API_CONFIG.ENDPOINTS.AUTH.RESEND_VERIFICATION,
      { email }
    );
    return response;
  } catch (error) {
    throw new Error(error.message || "Failed to resend verification");
  }
}

  // Logout from all devices
  async logoutAll() {
    try {
      if (this.sessionManager) {
        await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.LOGOUT_ALL),
          { method: "POST" }
        );
      } else {
        await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT_ALL);
      }
    } catch (error) {
      console.error("Logout all API call failed:", error);
    } finally {
      if (this.sessionManager) {
        this.sessionManager.logoutAll();
      } else {
        apiClient.removeAuthToken();
      }
    }
  }

  // Verify token and restore session
  async verifyToken() {
    try {
      if (this.sessionManager) {
        const session = this.sessionManager.getCurrentSession();

        if (!session?.accessToken) {
          throw new Error("No access token available");
        }

        // Use authenticated request to verify token
        const response = await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.VERIFY_TOKEN),
          { method: "POST" }
        );

        if (response.success) {
          // Update API client token
          apiClient.setAuthToken(session.accessToken);
          return response;
        }

        throw new Error("Token verification failed");
      } else {
        // Fallback for backward compatibility
        const response = await apiClient.post(
          API_CONFIG.ENDPOINTS.AUTH.VERIFY_TOKEN
        );
        return response;
      }
    } catch (error) {
      // Clear invalid session
      if (this.sessionManager) {
        this.sessionManager.logout();
      } else {
        apiClient.removeAuthToken();
      }
      throw error;
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      if (this.sessionManager) {
        const response = await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.ME)
        );
        return response;
      } else {
        return await apiClient.get(API_CONFIG.ENDPOINTS.AUTH.ME);
      }
    } catch (error) {
      console.error("Get current user failed:", error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken() {
    try {
      if (this.sessionManager) {
        return await this.sessionManager.refreshAccessToken();
      } else {
        // Fallback refresh using refresh endpoint
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await apiClient.post(
          API_CONFIG.ENDPOINTS.AUTH.REFRESH_TOKEN,
          {
            refreshToken,
          }
        );

        if (response.success && response.accessToken) {
          apiClient.setAuthToken(response.accessToken);
          return response.accessToken;
        }

        throw new Error("Token refresh failed");
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      // Clear invalid session
      if (this.sessionManager) {
        this.sessionManager.logout();
      } else {
        apiClient.removeAuthToken();
      }
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    if (this.sessionManager) {
      return this.sessionManager.isSessionValid();
    } else {
      return !!apiClient.getAuthToken();
    }
  }

  // Get current session info
  getCurrentSession() {
    if (this.sessionManager) {
      return this.sessionManager.getCurrentSession();
    } else {
      const token = apiClient.getAuthToken();
      return token ? { accessToken: token } : null;
    }
  }

  // Get time until session expires
  getTimeUntilExpiry() {
    if (this.sessionManager) {
      return this.sessionManager.getTimeUntilExpiry();
    } else {
      return 0; // Unknown for legacy sessions
    }
  }

  // Extend current session
  extendSession() {
    if (this.sessionManager) {
      return this.sessionManager.extendSession();
    }
    // No-op for legacy sessions
  }

  // Get available user sessions (for multi-user support)
  getAvailableSessions() {
    if (this.sessionManager) {
      return this.sessionManager.getAvailableSessions();
    } else {
      return {}; // No multi-user support in legacy mode
    }
  }

  // Switch to different user session
  switchToUser(userId) {
    if (this.sessionManager) {
      const session = this.sessionManager.switchToUser(userId);
      if (session) {
        apiClient.setAuthToken(session.accessToken);
      }
      return session;
    } else {
      throw new Error("Multi-user sessions not supported in legacy mode");
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      let response;
      if (this.sessionManager) {
        response = await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD),
          {
            method: "POST",
            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          }
        );
      } else {
        response = await apiClient.post(
          API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD,
          {
            currentPassword,
            newPassword,
          }
        );
      }

      if (response.success) {
        // Password change usually requires re-login
        if (this.sessionManager) {
          this.sessionManager.logout();
        } else {
          apiClient.removeAuthToken();
        }
      }

      return response;
    } catch (error) {
      console.error("Change password failed:", error);
      throw error;
    }
  }

  // Forgot password
  async forgotPassword(email) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD,
        { email }
      );
      return response;
    } catch (error) {
      throw new Error(error.message || "Forgot password request failed");
    }
  }

  // Reset password
  async resetPassword(token, newPassword) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD,
        {
          token,
          newPassword,
        }
      );
      return response;
    } catch (error) {
      throw new Error(error.message || "Password reset failed");
    }
  }

  // Update profile
  async updateProfile(profileData) {
    try {
      let response;
      if (this.sessionManager) {
        response = await this.sessionManager.authenticatedRequest(
          apiClient.buildUrl(API_CONFIG.ENDPOINTS.AUTH.PROFILE),
          {
            method: "PUT",
            body: JSON.stringify(profileData),
          }
        );
      } else {
        response = await apiClient.put(
          API_CONFIG.ENDPOINTS.AUTH.PROFILE,
          profileData
        );
      }

      if (response.success && response.user) {
        // Update session with new user data
        if (this.sessionManager) {
          const currentSession = this.sessionManager.getCurrentSession();
          if (currentSession) {
            this.sessionManager.setSession(
              response.user,
              currentSession.accessToken,
              currentSession.refreshToken,
              60
            );
          }
        }
      }

      return response;
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  }

  // Initialize session manager
  init() {
    if (this.sessionManager) {
      return this.sessionManager.init();
    } else {
      // Legacy initialization - check if token exists
      const token = apiClient.getAuthToken();
      return token ? { accessToken: token } : null;
    }
  }

  // Session event listeners
  onAuthFailure(callback) {
    window.addEventListener("auth:failure", callback);
    return () => window.removeEventListener("auth:failure", callback);
  }

  onAuthRestored(callback) {
    window.addEventListener("auth:restored", callback);
    return () => window.removeEventListener("auth:restored", callback);
  }

  onAuthSwitched(callback) {
    window.addEventListener("auth:switched", callback);
    return () => window.removeEventListener("auth:switched", callback);
  }
}

// Create and export singleton instance
const authService = new AuthService();

// Set session manager when it's available
if (typeof window !== "undefined") {
  import("../utils/sessionManager")
    .then((module) => {
      authService.setSessionManager(module.default);
    })
    .catch((error) => {
      console.warn(
        "SessionManager not available, using legacy auth mode:",
        error
      );
    });
}

export { authService };
