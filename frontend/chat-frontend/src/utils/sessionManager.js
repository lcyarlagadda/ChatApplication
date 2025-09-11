// utils/sessionManager.js
class SessionManager {
  constructor() {
    this.accessTokenKey = 'chatapp_access_token';
    this.refreshTokenKey = 'chatapp_refresh_token';
    this.userKey = 'chatapp_user';
    this.currentUserTabKey = 'chatapp_current_user_tab';
    this.userSessionsKey = 'chatapp_user_sessions';
    this.pendingVerificationKey = 'chatapp_pending_verification';
    this.sessionExpiryMinutes = 60; // 1 hour
    
    // Setup token refresh timer
    this.setupTokenRefresh();
    
    // Setup activity tracking for session extension
    this.setupActivityTracking();
    
    // Setup cleanup timer
    this.startCleanupTimer();
  }

  // Send email verification code for login
  async sendLoginVerificationCode(email) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/send-login-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        // Store pending verification info
        const pendingData = {
          email,
          type: 'login',
          timestamp: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };
        sessionStorage.setItem(this.pendingVerificationKey, JSON.stringify(pendingData));
        return data;
      } else {
        throw new Error(data.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Send login verification code error:', error);
      throw error;
    }
  }

  // Verify login code and complete authentication
  async verifyLoginCode(email, code) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/verify-login-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear pending verification
        sessionStorage.removeItem(this.pendingVerificationKey);
        
        // Set session with tokens
        this.setSession(data.user, data.accessToken, data.refreshToken);
        
        return data;
      } else {
        throw new Error(data.message || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Verify login code error:', error);
      throw error;
    }
  }

  // Send email verification code for registration
  async sendRegistrationVerificationCode(userData) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/send-registration-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (data.success) {
        // Store pending verification info with user data
        const pendingData = {
          ...userData,
          type: 'registration',
          timestamp: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };
        sessionStorage.setItem(this.pendingVerificationKey, JSON.stringify(pendingData));
        return data;
      } else {
        throw new Error(data.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Send registration verification code error:', error);
      throw error;
    }
  }

  // Verify registration code and complete registration
  async verifyRegistrationCode(email, code) {
    try {
      const pendingData = this.getPendingVerification();
      if (!pendingData || pendingData.email !== email || pendingData.type !== 'registration') {
        throw new Error('No pending registration found');
      }

      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/verify-registration-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          code,
          userData: {
            name: pendingData.name,
            email: pendingData.email,
            phone: pendingData.phone,
            bio: pendingData.bio,
            password: pendingData.password
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear pending verification
        sessionStorage.removeItem(this.pendingVerificationKey);
        
        // Set session with tokens
        this.setSession(data.user, data.accessToken, data.refreshToken);
        
        return data;
      } else {
        throw new Error(data.message || 'Registration verification failed');
      }
    } catch (error) {
      console.error('Verify registration code error:', error);
      throw error;
    }
  }

  // Send password reset code
  async sendPasswordResetCode(email) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/send-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        // Store pending verification info
        const pendingData = {
          email,
          type: 'password_reset',
          timestamp: Date.now(),
          expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
        };
        sessionStorage.setItem(this.pendingVerificationKey, JSON.stringify(pendingData));
        return data;
      } else {
        throw new Error(data.message || 'Failed to send reset code');
      }
    } catch (error) {
      console.error('Send password reset code error:', error);
      throw error;
    }
  }

  // Verify reset code and update password
  async verifyPasswordResetCode(email, code, newPassword) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code, newPassword })
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear pending verification
        sessionStorage.removeItem(this.pendingVerificationKey);
        return data;
      } else {
        throw new Error(data.message || 'Password reset verification failed');
      }
    } catch (error) {
      console.error('Verify password reset code error:', error);
      throw error;
    }
  }

  // Resend verification code
  async resendVerificationCode() {
    try {
      const pendingData = this.getPendingVerification();
      if (!pendingData) {
        throw new Error('No pending verification found');
      }

      let baseUrl = 'http://localhost:5000/api';
      let endpoint;
      let body;

      switch (pendingData.type) {
        case 'login':
          endpoint = '/auth/send-login-code';
          body = { email: pendingData.email };
          break;
        case 'registration':
          endpoint = '/auth/send-registration-code';
          body = {
            name: pendingData.name,
            email: pendingData.email,
            phone: pendingData.phone,
            bio: pendingData.bio,
            password: pendingData.password
          };
          break;
        case 'password_reset':
          endpoint = '/auth/send-reset-code';
          body = { email: pendingData.email };
          break;
        default:
          throw new Error('Invalid verification type');
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (data.success) {
        // Update pending verification timestamp
        pendingData.timestamp = Date.now();
        pendingData.expiresAt = Date.now() + (10 * 60 * 1000);
        sessionStorage.setItem(this.pendingVerificationKey, JSON.stringify(pendingData));
        return data;
      } else {
        throw new Error(data.message || 'Failed to resend verification code');
      }
    } catch (error) {
      console.error('Resend verification code error:', error);
      throw error;
    }
  }

  // Get pending verification data
  getPendingVerification() {
    try {
      const data = sessionStorage.getItem(this.pendingVerificationKey);
      if (!data) return null;

      const pendingData = JSON.parse(data);
      
      // Check if expired
      if (Date.now() > pendingData.expiresAt) {
        sessionStorage.removeItem(this.pendingVerificationKey);
        return null;
      }

      return pendingData;
    } catch (error) {
      console.error('Error parsing pending verification:', error);
      sessionStorage.removeItem(this.pendingVerificationKey);
      return null;
    }
  }

  // Clear pending verification
  clearPendingVerification() {
    sessionStorage.removeItem(this.pendingVerificationKey);
  }

  // Get time until verification expires
  getVerificationTimeRemaining() {
    const pendingData = this.getPendingVerification();
    if (!pendingData) return 0;
    
    return Math.max(0, pendingData.expiresAt - Date.now());
  }

  // Check if user exists (for login vs registration flow)
  async checkUserExists(email) {
    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/check-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      return data.exists || false;
    } catch (error) {
      console.error('Check user exists error:', error);
      return false;
    }
  }

  // Set user session with both tokens
  setSession(userData, accessToken, refreshToken, expiryMinutes = this.sessionExpiryMinutes) {
    const now = Date.now();
    const tabId = this.getOrCreateTabId();
    
    // Store current user in sessionStorage (tab-specific)
    sessionStorage.setItem(this.currentUserTabKey, userData.id || userData._id);
    sessionStorage.setItem(this.accessTokenKey, accessToken);
    sessionStorage.setItem(this.userKey, JSON.stringify(userData));
    
    // Store all user sessions in localStorage with expiration
    const sessions = this.getSessions();
    const userId = userData.id || userData._id;
    sessions[userId] = {
      accessToken,
      refreshToken,
      user: userData,
      expiry: now + (expiryMinutes * 60 * 1000),
      lastActive: now,
      tabId: tabId
    };
    
    localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  // Get current tab's session
  getCurrentSession() {
    const currentUserId = sessionStorage.getItem(this.currentUserTabKey);
    const accessToken = sessionStorage.getItem(this.accessTokenKey);
    const userData = sessionStorage.getItem(this.userKey);

    if (!currentUserId || !accessToken || !userData) {
      // Try to restore from localStorage if available
      return this.restoreSessionFromStorage();
    }

    try {
      const user = JSON.parse(userData);
      return {
        userId: currentUserId,
        accessToken,
        refreshToken: localStorage.getItem(this.refreshTokenKey),
        user
      };
    } catch (error) {
      console.error('Error parsing user data:', error);
      this.clearCurrentSession();
      return null;
    }
  }

  // Restore session from localStorage if valid
  restoreSessionFromStorage() {
    const sessions = this.getSessions();
    const now = Date.now();
    
    // Find a valid session
    for (const [userId, session] of Object.entries(sessions)) {
      if (now < session.expiry) {
        // Restore to current tab
        sessionStorage.setItem(this.currentUserTabKey, userId);
        sessionStorage.setItem(this.accessTokenKey, session.accessToken);
        sessionStorage.setItem(this.userKey, JSON.stringify(session.user));
        
        // Update last active
        session.lastActive = now;
        sessions[userId] = session;
        localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
        
        return {
          userId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user
        };
      }
    }
    
    return null;
  }

  // Get all stored sessions
  getSessions() {
    try {
      return JSON.parse(localStorage.getItem(this.userSessionsKey) || '{}');
    } catch (error) {
      console.error('Error parsing sessions:', error);
      return {};
    }
  }

  // Update access token after refresh
  updateAccessToken(newAccessToken) {
    const currentUserId = sessionStorage.getItem(this.currentUserTabKey);
    if (!currentUserId) return;

    // Update in sessionStorage
    sessionStorage.setItem(this.accessTokenKey, newAccessToken);

    // Update in localStorage
    const sessions = this.getSessions();
    if (sessions[currentUserId]) {
      sessions[currentUserId].accessToken = newAccessToken;
      sessions[currentUserId].lastActive = Date.now();
      localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    const session = this.getCurrentSession();
    if (!session?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      let baseUrl = 'http://localhost:5000/api';
      const response = await fetch(`${baseUrl}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: session.refreshToken
        })
      });

      const data = await response.json();

      if (data.success) {
        this.updateAccessToken(data.accessToken);
        
        // Update user data if provided
        if (data.user) {
          sessionStorage.setItem(this.userKey, JSON.stringify(data.user));
          
          const sessions = this.getSessions();
          const currentUserId = sessionStorage.getItem(this.currentUserTabKey);
          if (sessions[currentUserId]) {
            sessions[currentUserId].user = data.user;
            localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
          }
        }

        return data.accessToken;
      } else {
        throw new Error(data.message || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearCurrentSession();
      throw error;
    }
  }

  // Make authenticated API request with auto token refresh
  async authenticatedRequest(url, options = {}) {
    const session = this.getCurrentSession();
    if (!session?.accessToken) {
      throw new Error('No access token available');
    }

    let baseUrl = 'http://localhost:5000/api';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    // Add authorization header
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${session.accessToken}`
    };

    console.log("headers", headers);

    // Prepare request configuration
    const requestConfig = {
      method: 'GET',
      ...options,
      headers
    };

    // Handle body for POST/PUT/PATCH requests
    if (options.body && typeof options.body === 'string') {
      requestConfig.body = options.body;
    } else if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      requestConfig.body = JSON.stringify(options.body);
    } else if (options.body instanceof FormData) {
      delete requestConfig.headers['Content-Type'];
      requestConfig.body = options.body;
    } else if (options.body) {
      requestConfig.body = options.body;
    }

    try {
      const response = await fetch(fullUrl, requestConfig);

      // If token expired, try to refresh and retry
      if (response.status === 401) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { message: 'Unauthorized' };
        }
        
        if (errorData.code === 'TOKEN_EXPIRED' || errorData.message?.includes('expired')) {
          try {
            await this.refreshAccessToken();
            
            // Retry request with new token
            const newSession = this.getCurrentSession();
            const retryConfig = {
              ...requestConfig,
              headers: {
                ...requestConfig.headers,
                'Authorization': `Bearer ${newSession.accessToken}`
              }
            };
            
            const retryResponse = await fetch(fullUrl, retryConfig);
            return retryResponse;
          } catch (refreshError) {
            this.handleAuthFailure();
            throw new Error('Authentication failed');
          }
        }
      }

      return response;
    } catch (error) {
      console.error('❌ Authenticated request error:', error);
      throw error;
    }
  }

  // Extend current session
  extendSession(additionalMinutes = this.sessionExpiryMinutes) {
    const currentUserId = sessionStorage.getItem(this.currentUserTabKey);
    if (!currentUserId) return;

    const sessions = this.getSessions();
    if (sessions[currentUserId]) {
      const now = Date.now();
      sessions[currentUserId].expiry = now + (additionalMinutes * 60 * 1000);
      sessions[currentUserId].lastActive = now;
      localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
    }
  }

  // Clear current tab's session
  clearCurrentSession() {
    sessionStorage.removeItem(this.currentUserTabKey);
    sessionStorage.removeItem(this.accessTokenKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.pendingVerificationKey);
  }

  // Logout specific user
  logout(userId = null) {
    const currentUserId = userId || sessionStorage.getItem(this.currentUserTabKey);
    
    if (currentUserId) {
      const sessions = this.getSessions();
      delete sessions[currentUserId];
      localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
      
      // If logging out current user, clear session storage
      if (currentUserId === sessionStorage.getItem(this.currentUserTabKey)) {
        this.clearCurrentSession();
      }
    }
    
    // Clear refresh token if no sessions left
    const remainingSessions = this.getSessions();
    if (Object.keys(remainingSessions).length === 0) {
      localStorage.removeItem(this.refreshTokenKey);
    }
  }

  // Logout all users
  logoutAll() {
    localStorage.removeItem(this.userSessionsKey);
    localStorage.removeItem(this.refreshTokenKey);
    this.clearCurrentSession();
  }

  // Get or create tab ID
  getOrCreateTabId() {
    let tabId = sessionStorage.getItem('tabId');
    if (!tabId) {
      tabId = Date.now() + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('tabId', tabId);
    }
    return tabId;
  }

  // Check if session is valid (not expired)
  isSessionValid() {
    const session = this.getCurrentSession();
    if (!session) return false;

    const sessions = this.getSessions();
    const userSession = sessions[session.userId];
    
    if (!userSession) return false;
    
    return Date.now() < userSession.expiry;
  }

  // Get time until session expires (in milliseconds)
  getTimeUntilExpiry() {
    const session = this.getCurrentSession();
    if (!session) return 0;

    const sessions = this.getSessions();
    const userSession = sessions[session.userId];
    
    if (!userSession) return 0;
    
    return Math.max(0, userSession.expiry - Date.now());
  }

  // Setup automatic token refresh
  setupTokenRefresh() {
    setInterval(async () => {
      const timeUntilExpiry = this.getTimeUntilExpiry();
      
      if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }
    }, 60000);
  }

  // Setup activity tracking for session extension
  setupActivityTracking() {
    let lastActivity = 0;
    
    const activityEvents = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 5 * 60 * 1000) {
        this.extendSession();
        lastActivity = now;
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
  }

  // Start cleanup timer for expired sessions
  startCleanupTimer() {
    setInterval(() => {
      const sessions = this.getSessions();
      const now = Date.now();
      let hasChanges = false;

      Object.keys(sessions).forEach(userId => {
        if (now > sessions[userId].expiry) {
          delete sessions[userId];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem(this.userSessionsKey, JSON.stringify(sessions));
        
        const currentUserId = sessionStorage.getItem(this.currentUserTabKey);
        if (currentUserId && !sessions[currentUserId]) {
          this.clearCurrentSession();
          this.handleAuthFailure();
        }
      }
    }, 60000);
  }

  // Handle authentication failure
  handleAuthFailure() {
    this.clearCurrentSession();
    
    window.dispatchEvent(new CustomEvent('auth:failure', {
      detail: { message: 'Session expired. Please login again.' }
    }));
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  // Initialize session manager
  init() {
    const session = this.getCurrentSession();
    if (session && this.isSessionValid()) {
      window.dispatchEvent(new CustomEvent('auth:restored', {
        detail: { user: session.user }
      }));
      return session;
    } else {
      this.clearCurrentSession();
      return null;
    }
  }

  // Get available user sessions (for switching between users)
  getAvailableSessions() {
    const sessions = this.getSessions();
    const now = Date.now();
    const validSessions = {};

    Object.entries(sessions).forEach(([userId, session]) => {
      if (now < session.expiry) {
        validSessions[userId] = {
          user: session.user,
          lastActive: session.lastActive,
          expiry: session.expiry
        };
      }
    });

    return validSessions;
  }

  // Switch to different user session
  switchToUser(userId) {
    const sessions = this.getSessions();
    const session = sessions[userId];
    
    if (!session || Date.now() > session.expiry) {
      throw new Error('Session not found or expired');
    }

    sessionStorage.setItem(this.currentUserTabKey, userId);
    sessionStorage.setItem(this.accessTokenKey, session.accessToken);
    sessionStorage.setItem(this.userKey, JSON.stringify(session.user));

    window.dispatchEvent(new CustomEvent('auth:switched', {
      detail: { user: session.user }
    }));

    return session;
  }
}

// Create and export singleton instance
const sessionManager = new SessionManager();

// Export both the class and instance
export default sessionManager;
export { SessionManager };