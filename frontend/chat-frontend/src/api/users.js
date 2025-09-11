// api/users.js
import sessionManager from '../utils/sessionManager';
import API_CONFIG from './config';

export const usersService = {
  // Search users by name or email
  async searchByEmail(email) {
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.SEARCH}?email=${encodeURIComponent(email)}`
    );
    return await response.json();
  },

  // Get all users with pagination and search
  async getAllUsers(page = 1, limit = 20, search = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search })
    });
    
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.LIST}?${params}`
    );
    return await response.json();
  },

  // Get user profile by ID
  async getUserProfile(userId) {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.GET_PROFILE(userId)
    );
    return await response.json();
  },

  // Get current user's profile
  async getMyProfile() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.GET_PROFILE('me')
    );
    return await response.json();
  },

  // Update user profile (current user only)
  async updateProfile(userData) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.UPDATE_PROFILE, 
        {
          method: 'PUT',
          body: JSON.stringify(userData)
        }
      );
      
      return await response.json();
    } catch (error) {
      // Enhanced error handling for profile updates
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || 'Invalid profile data';
        const validationErrors = error.response.data?.errors || [];
        
        throw new Error(validationErrors.length > 0 
          ? validationErrors.map(err => err.msg).join(', ')
          : errorMessage
        );
      }
      throw error;
    }
  },

  // Update specific profile fields (partial update)
  async updateProfileFields(fields) {
    // Filter out undefined/null values and empty strings
    const cleanFields = Object.entries(fields).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});

    return this.updateProfile(cleanFields);
  },

  // Update user avatar/profile picture
  async updateAvatar(avatarData) {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.UPDATE_AVATAR || `${API_CONFIG.ENDPOINTS.USERS.UPDATE_PROFILE}/avatar`,
      {
        method: 'PUT',
        body: JSON.stringify(avatarData)
      }
    );
    return await response.json();
  },

  // Get online users
  async getOnlineUsers() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.ONLINE_STATUS || '/users/online'
    );
    return await response.json();
  },

  // Update user status (online, away, offline, busy)
  async updateStatus(status) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.UPDATE_STATUS, 
        {
          method: 'PUT',
          body: JSON.stringify({ status })
        }
      );
      return await response.json();
    } catch (error) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid status value');
      }
      throw error;
    }
  },

  // Create or get direct conversation with a user
  async createConversation(userId) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.CREATE_CONVERSATION(userId),
        { method: 'POST' }
      );
      return await response.json();
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('User not found');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Cannot create conversation');
      }
      throw error;
    }
  },

  // Get mutual conversations with a user
  async getMutualConversations(userId) {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.MUTUAL_CONVERSATIONS(userId)
    );
    return await response.json();
  },

  // Get user's contacts (users they've chatted with)
  async getContacts() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.CONTACTS
    );
    return await response.json();
  },

  // Block or unblock a user
  async blockUser(userId, blocked = true) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.BLOCK_USER(userId),
        {
          method: 'PUT',
          body: JSON.stringify({ blocked })
        }
      );
      return await response.json();
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('User not found');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Cannot block/unblock user');
      }
      throw error;
    }
  },

  // Unblock a user (convenience method)
  async unblockUser(userId) {
    return this.blockUser(userId, false);
  },

  // Search users with additional filters
  async searchUsers(query, limit = 10) {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString()
    });
    
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.SEARCH}?${params}`
    );
    return await response.json();
  },

  // Advanced search with multiple criteria
  async advancedSearch(criteria) {
    const { query, status, page = 1, limit = 20 } = criteria;
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(query && { search: query }),
      ...(status && { status })
    });
    
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.LIST}?${params}`
    );
    return await response.json();
  },

  // Get user's blocked list
  async getBlockedUsers() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.BLOCKED_USERS || `${API_CONFIG.ENDPOINTS.USERS.CONTACTS}/blocked`
    );
    return await response.json();
  },

  // Validate profile data before sending
  validateProfileData(userData) {
    const errors = [];

    if (userData.name !== undefined) {
      if (!userData.name || userData.name.trim().length === 0) {
        errors.push('Name is required');
      } else if (userData.name.length > 50) {
        errors.push('Name must not exceed 50 characters');
      }
    }

    if (userData.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!userData.email || !emailRegex.test(userData.email)) {
        errors.push('Please enter a valid email address');
      }
    }

    if (userData.bio !== undefined && userData.bio.length > 500) {
      errors.push('Bio must not exceed 500 characters');
    }

    if (userData.phone !== undefined && userData.phone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(userData.phone)) {
        errors.push('Please enter a valid phone number');
      }
    }

    if (userData.status !== undefined) {
      const validStatuses = ['online', 'away', 'offline', 'busy'];
      if (!validStatuses.includes(userData.status)) {
        errors.push('Status must be online, away, offline, or busy');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Update profile with client-side validation
  async updateProfileWithValidation(userData) {
    const validation = this.validateProfileData(userData);
    
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    return this.updateProfile(userData);
  },

  // Refresh user data
  async refreshUserData(userId = 'me') {
    return this.getUserProfile(userId);
  },

  // Check if email is available
  async checkEmailAvailability(email) {
    try {
      const response = await sessionManager.authenticatedRequest(
        `${API_CONFIG.ENDPOINTS.USERS.CHECK_EMAIL || `${API_CONFIG.ENDPOINTS.USERS.LIST}/check-email`}?email=${encodeURIComponent(email)}`
      );
      return await response.json();
    } catch (error) {
      if (error.response?.status === 409) {
        return { available: false, message: 'Email is already in use' };
      }
      throw error;
    }
  },

  // Upload profile picture
  async uploadProfilePicture(file) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const session = sessionManager.getCurrentSession();
      const response = await fetch(`${API_CONFIG.ENDPOINTS.USERS.UPLOAD_AVATAR || '/users/me/avatar'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Profile picture upload failed:', error);
      throw error;
    }
  },

  // Get user statistics
  async getUserStats(userId = 'me') {
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.STATS || `/users/${userId}/stats`}`
    );
    return await response.json();
  },

  // Get user activity
  async getUserActivity(userId = 'me', days = 30) {
    const response = await sessionManager.authenticatedRequest(
      `${API_CONFIG.ENDPOINTS.USERS.ACTIVITY || `/users/${userId}/activity`}?days=${days}`
    );
    return await response.json();
  },

  // Report user
  async reportUser(userId, reason, description = '') {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.REPORT_USER(userId),
        {
          method: 'POST',
          body: JSON.stringify({ reason, description })
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Report user failed:', error);
      throw error;
    }
  },

  // Get user preferences
  async getUserPreferences() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.PREFERENCES || '/users/me/preferences'
    );
    return await response.json();
  },

  // Update user preferences
  async updateUserPreferences(preferences) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.PREFERENCES || '/users/me/preferences',
        {
          method: 'PUT',
          body: JSON.stringify(preferences)
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Update preferences failed:', error);
      throw error;
    }
  },

  // Delete user account
  async deleteAccount(password) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.DELETE_ACCOUNT || '/users/me/delete',
        {
          method: 'DELETE',
          body: JSON.stringify({ password })
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        // Clear session after account deletion
        sessionManager.logoutAll();
      }
      
      return result;
    } catch (error) {
      console.error('Delete account failed:', error);
      throw error;
    }
  },

  // Get user sessions (for session management)
  async getUserSessions() {
    const response = await sessionManager.authenticatedRequest(
      API_CONFIG.ENDPOINTS.USERS.SESSIONS || '/users/me/sessions'
    );
    return await response.json();
  },

  // Revoke user session
  async revokeSession(sessionId) {
    try {
      const response = await sessionManager.authenticatedRequest(
        `${API_CONFIG.ENDPOINTS.USERS.SESSIONS || '/users/me/sessions'}/${sessionId}`,
        { method: 'DELETE' }
      );
      return await response.json();
    } catch (error) {
      console.error('Revoke session failed:', error);
      throw error;
    }
  },

  // Batch operations
  async batchUpdateUsers(userUpdates) {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.BATCH_UPDATE || '/users/batch',
        {
          method: 'PUT',
          body: JSON.stringify({ updates: userUpdates })
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Batch update failed:', error);
      throw error;
    }
  },

  // Export user data
  async exportUserData() {
    try {
      const response = await sessionManager.authenticatedRequest(
        API_CONFIG.ENDPOINTS.USERS.EXPORT_DATA || '/users/me/export'
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'user-data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        return { success: true, message: 'Data exported successfully' };
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export user data failed:', error);
      throw error;
    }
  }
};