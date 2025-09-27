// api/config.js
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
  TIMEOUT: 30000, // 30 seconds
  
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      LOGOUT: '/auth/logout',
      LOGOUT_ALL: '/auth/logout-all',
      REFRESH: '/auth/refresh',
      REFRESH_TOKEN: '/auth/refresh-token',
      VERIFY_TOKEN: '/auth/verify-token',
      ME: '/auth/me',
      PROFILE: '/auth/profile',
      CHANGE_PASSWORD: '/auth/change-password',
      FORGOT_PASSWORD: '/auth/forgot-password',
      RESET_PASSWORD: '/auth/reset-password',
      VERIFY_EMAIL: '/auth/verify-email',
      RESEND_VERIFICATION: '/auth/resend-verification',
    },
    
    CONVERSATIONS: {
      LIST: '/conversations',
      CREATE: '/conversations',
      GET: (id) => `/conversations/${id}`,
      UPDATE: (id) => `/conversations/${id}`,
      DELETE: (id) => `/conversations/${id}`,
      LEAVE: (id) => `/conversations/${id}/leave`,
      PARTICIPANTS: (id) => `/conversations/${id}/participants`,
      ADD_PARTICIPANT: (id) => `/conversations/${id}/participants`,
      REMOVE_PARTICIPANT: (id, userId) => `/conversations/${id}/participants/${userId}`,
      MESSAGES: (id) => `/conversations/${id}/messages`
    },
    
    MESSAGES: {
      LIST: (conversationId) => `/messages/${conversationId}?page=1&limit=50`,
      SEND: (conversationId) => `/messages/${conversationId}`,
      SEND_FILE: (conversationId) => `/messages/${conversationId}/file`,
      GET: (id) => `/messages/${id}`,
      EDIT: (id) => `/messages/${id}`,
      DELETE: (id) => `/messages/${id}`,
      REACT: (id) => `/messages/${id}/react`,
      UNREACT: (id) => `/messages/${id}/unreact`,
      PIN: (id) => `/messages/${id}/pin`,
      UNPIN: (id) => `/messages/${id}/unpin`,
      REPORT: (id) => `/messages/${id}/report`
    },
    
    USERS: {
      LIST: '/users',
      SEARCH: '/users/search',
      SEARCH_BY_EMAIL: '/users/search',
      ONLINE_STATUS: '/users/online',
      ONLINE_USERS: '/users/online-users',
      UPDATE_STATUS: '/users/status',
      CONTACTS: '/users/me/contacts',
      UPDATE_PROFILE: '/users/me/profile',
      
      // Dynamic endpoints
      GET_PROFILE: (id) => `/users/${id}`,
      CREATE_CONVERSATION: (id) => `/users/${id}/conversation`,
      MUTUAL_CONVERSATIONS: (id) => `/users/${id}/mutual-conversations`,
      BLOCK_USER: (id) => `/users/${id}/block`,
      REPORT_USER: (id) => `/users/${id}/report`,
      
      // Additional endpoints
      UPLOAD_AVATAR: '/users/me/avatar',
      PREFERENCES: '/users/me/preferences',
      SESSIONS: '/users/me/sessions',
      STATS: '/users/me/stats',
      ACTIVITY: '/users/me/activity',
      EXPORT_DATA: '/users/me/export',
      DELETE_ACCOUNT: '/users/me/delete',
      BLOCKED_USERS: '/users/me/blocked',
      CHECK_EMAIL: '/users/check-email',
      BATCH_UPDATE: '/users/batch'
    },
    
    FILES: {
      UPLOAD: '/files/upload',
      DOWNLOAD: (fileId) => `/files/${fileId}/download`,
      DELETE: (fileId) => `/files/${fileId}`,
      METADATA: (fileId) => `/files/${fileId}/metadata`
    },
    
    ADMIN: {
      USERS: '/admin/users',
      CONVERSATIONS: '/admin/conversations',
      MESSAGES: '/admin/messages',
      REPORTS: '/admin/reports',
      ANALYTICS: '/admin/analytics',
      SETTINGS: '/admin/settings'
    },
    
    HEALTH: '/health',
    INFO: ''
  },
  
  // WebSocket configuration
  WEBSOCKET: {
    URL: process.env.REACT_APP_WS_URL || 'ws://localhost:5000',
    RECONNECT_INTERVAL: 3000, // 3 seconds
    MAX_RECONNECT_ATTEMPTS: 5
  },
  
  // File upload limits
  FILES: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_TYPES: {
      IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      DOCUMENTS: [
        'application/pdf', 
        'text/plain', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      VIDEO: ['video/mp4', 'video/webm', 'video/ogg']
    },
    AVATAR_MAX_SIZE: 5 * 1024 * 1024 // 5MB for avatars
  },
  
  // Session configuration
  SESSION: {
    DEFAULT_EXPIRY_MINUTES: 60, // 1 hour
    REFRESH_THRESHOLD_MINUTES: 5, // Refresh when < 5 minutes remaining
    ACTIVITY_EXTENSION_MINUTES: 60, // Extend by 1 hour on activity
    CLEANUP_INTERVAL_MS: 60000, // Clean up expired sessions every minute
    MAX_SESSIONS_PER_USER: 5 // Maximum sessions per user
  },
  
  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MESSAGES_PAGE_SIZE: 50,
    USERS_PAGE_SIZE: 20,
    CONVERSATIONS_PAGE_SIZE: 20
  },
  
  // Rate limiting (for client-side throttling)
  RATE_LIMITS: {
    MESSAGES_PER_MINUTE: 30,
    FILE_UPLOADS_PER_HOUR: 20,
    API_REQUESTS_PER_MINUTE: 100,
    LOGIN_ATTEMPTS_PER_HOUR: 10
  },
  
  // Feature flags
  FEATURES: {
    FILE_UPLOADS: true,
    VIDEO_CALLS: false,
    VOICE_MESSAGES: true,
    MESSAGE_REACTIONS: true,
    MESSAGE_EDITING: true,
    MESSAGE_DELETION: true,
    TYPING_INDICATORS: true,
    READ_RECEIPTS: true,
    PUSH_NOTIFICATIONS: false,
    DARK_MODE: true,
    MULTI_USER_SESSIONS: true,
    SESSION_MANAGEMENT: true,
    AUTO_TOKEN_REFRESH: true
  },
  
  // UI Constants
  UI: {
    TOAST_DURATION: 5000, // 5 seconds
    TYPING_TIMEOUT: 2000, // 2 seconds
    MESSAGE_MAX_LENGTH: 4096,
    CONVERSATION_NAME_MAX_LENGTH: 100,
    USER_BIO_MAX_LENGTH: 500,
    SEARCH_DEBOUNCE_MS: 300
  },
  
  // Storage keys (for localStorage/sessionStorage)
  STORAGE_KEYS: {
    DARK_MODE: 'darkMode',
    USER_PREFERENCES: 'userPreferences',
    CHAT_APP_ACCESS_TOKEN: 'chatapp_access_token',
    CHAT_APP_REFRESH_TOKEN: 'chatapp_refresh_token',
    CHAT_APP_USER: 'chatapp_user',
    CHAT_APP_USER_SESSIONS: 'chatapp_user_sessions',
    CHAT_APP_CURRENT_USER_TAB: 'chatapp_current_user_tab'
  }
};

export default API_CONFIG;
