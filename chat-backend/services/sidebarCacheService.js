// services/sidebarCacheService.js - Focused caching for sidebar data
const { createClient } = require('redis');

class SidebarCacheService {
  constructor() {
    this.redisClient = null;
    this.isConnected = false;
    this.initializeRedis();
  }

  async initializeRedis() {
    console.log('🔄 Initializing Redis sidebar cache...');
    console.log('REDIS_URL exists:', !!process.env.REDIS_URL);
    console.log('REDIS_URL value:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
    
    if (process.env.REDIS_URL && process.env.REDIS_URL !== 'disabled') {
      try {
        this.redisClient = createClient({
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 3) return new Error('Redis connection failed');
              return Math.min(retries * 100, 3000);
            }
          }
        });

        this.redisClient.on('error', (err) => {
          console.warn('Redis sidebar cache error:', err.message);
          this.isConnected = false;
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis sidebar cache connected');
          this.isConnected = true;
          
          // Start cleanup job for expired online users
          this.startCleanupJob();
        });

        await this.redisClient.connect();
        console.log('🎉 Redis sidebar cache initialization completed');
      } catch (error) {
        console.warn('⚠️ Redis sidebar cache initialization failed:', error.message);
        this.isConnected = false;
      }
    } else {
      console.log('⚠️ Redis URL not provided, skipping cache initialization');
    }
  }

  // Cache user's sidebar data (conversations with last messages and unread counts)
  async cacheUserSidebar(userId, sidebarData, ttl = 300) { // 5 minutes
    console.log(`🔄 Attempting to cache sidebar for user ${userId}, Redis connected: ${this.isConnected}`);
    if (!this.isConnected) {
      console.log(`❌ Cannot cache sidebar for user ${userId} - Redis not connected`);
      return false;
    }
    
    try {
      const key = `sidebar:${userId}`;
      await this.redisClient.setEx(key, ttl, JSON.stringify(sidebarData));
      console.log(`📦 Cached sidebar for user ${userId} (${sidebarData.length} conversations)`);
      return true;
    } catch (error) {
      console.warn('Sidebar cache set error:', error.message);
      return false;
    }
  }

  // Get user's cached sidebar data
  async getUserSidebar(userId) {
    console.log(`🔄 Checking cache for user ${userId}, Redis connected: ${this.isConnected}`);
    if (!this.isConnected) {
      console.log(`❌ Cannot get sidebar cache for user ${userId} - Redis not connected`);
      return null;
    }
    
    try {
      const key = `sidebar:${userId}`;
      const cached = await this.redisClient.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        console.log(`✅ Sidebar cache HIT for user ${userId} (${data.length} conversations)`);
        return data;
      }
      console.log(`❌ Sidebar cache MISS for user ${userId}`);
      return null;
    } catch (error) {
      console.warn('Sidebar cache get error:', error.message);
      return null;
    }
  }

  // Cache conversation last message
  async cacheConversationLastMessage(conversationId, lastMessage, ttl = 600) { // 10 minutes
    if (!this.isConnected) return false;
    
    try {
      const key = `conv:${conversationId}:last_message`;
      await this.redisClient.setEx(key, ttl, JSON.stringify(lastMessage));
      return true;
    } catch (error) {
      console.warn('Last message cache error:', error.message);
      return false;
    }
  }

  // Get cached conversation last message
  async getConversationLastMessage(conversationId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `conv:${conversationId}:last_message`;
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get last message cache error:', error.message);
      return null;
    }
  }

  // Cache unread message count for a user-conversation pair
  async cacheUnreadCount(userId, conversationId, count, ttl = 300) { // 5 minutes
    if (!this.isConnected) return false;
    
    try {
      const key = `unread:${userId}:${conversationId}`;
      await this.redisClient.setEx(key, ttl, count.toString());
      console.log(`📦 Cached unread count for user ${userId}, conversation ${conversationId}: ${count}`);
      return true;
    } catch (error) {
      console.warn('Unread count cache error:', error.message);
      return false;
    }
  }

  // Get cached unread count
  async getUnreadCount(userId, conversationId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `unread:${userId}:${conversationId}`;
      const cached = await this.redisClient.get(key);
      const count = cached ? parseInt(cached) : 0;
      console.log(`📊 Retrieved unread count for user ${userId}, conversation ${conversationId}: ${count}`);
      return count;
    } catch (error) {
      console.warn('Get unread count cache error:', error.message);
      return null;
    }
  }

  // Increment unread count when new message arrives
  async incrementUnreadCount(userId, conversationId, increment = 1, ttl = 300) {
    if (!this.isConnected) return false;
    
    try {
      const key = `unread:${userId}:${conversationId}`;
      const currentCount = await this.redisClient.get(key);
      const newCount = currentCount ? parseInt(currentCount) + increment : increment;
      
      await this.redisClient.setEx(key, ttl, newCount.toString());
      console.log(`➕ Incremented unread count for user ${userId}, conversation ${conversationId}: ${currentCount || 0} → ${newCount}`);
      return newCount;
    } catch (error) {
      console.warn('Increment unread count error:', error.message);
      return false;
    }
  }

  // Reset unread count to 0 when user opens conversation
  async resetUnreadCount(userId, conversationId, ttl = 300) {
    if (!this.isConnected) return false;
    
    try {
      const key = `unread:${userId}:${conversationId}`;
      await this.redisClient.setEx(key, ttl, '0');
      console.log(`🔄 Reset unread count for user ${userId}, conversation ${conversationId}: → 0`);
      return true;
    } catch (error) {
      console.warn('Reset unread count error:', error.message);
      return false;
    }
  }

  // Get all unread counts for a user across all conversations
  async getAllUnreadCounts(userId) {
    if (!this.isConnected) return {};
    
    try {
      const pattern = `unread:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length === 0) {
        console.log(`📊 No unread counts found for user ${userId}`);
        return {};
      }
      
      const unreadCounts = {};
      for (const key of keys) {
        const conversationId = key.split(':')[2]; // Extract conversationId from "unread:userId:conversationId"
        const count = await this.redisClient.get(key);
        unreadCounts[conversationId] = count ? parseInt(count) : 0;
      }
      
      console.log(`📊 Retrieved all unread counts for user ${userId}:`, unreadCounts);
      return unreadCounts;
    } catch (error) {
      console.warn('Get all unread counts error:', error.message);
      return {};
    }
  }

  // INVALIDATION STRATEGIES

  // Invalidate user's entire sidebar cache
  async invalidateUserSidebar(userId) {
    if (!this.isConnected) return false;
    
    try {
      await this.redisClient.del(`sidebar:${userId}`);
      console.log(`🗑️ Invalidated sidebar cache for user ${userId}`);
      return true;
    } catch (error) {
      console.warn('Sidebar invalidation error:', error.message);
      return false;
    }
  }

  // Invalidate conversation-related caches when new message arrives
  async invalidateConversationCache(conversationId, userIds = []) {
    if (!this.isConnected) return false;
    
    try {
      // Delete last message cache
      await this.redisClient.del(`conv:${conversationId}:last_message`);
      
      // Delete unread counts for all participants
      const promises = [];
      for (const userId of userIds) {
        promises.push(this.redisClient.del(`unread:${userId}:${conversationId}`));
        promises.push(this.redisClient.del(`sidebar:${userId}`));
      }
      
      await Promise.all(promises);
      console.log(`🗑️ Invalidated conversation cache for ${conversationId}`);
      return true;
    } catch (error) {
      console.warn('Conversation invalidation error:', error.message);
      return false;
    }
  }

  // Invalidate when user reads messages (updates unread count)
  async invalidateUserConversationRead(userId, conversationId) {
    if (!this.isConnected) return false;
    
    try {
      await this.redisClient.del(`unread:${userId}:${conversationId}`);
      await this.redisClient.del(`sidebar:${userId}`);
      console.log(`🗑️ Invalidated read cache for user ${userId}, conversation ${conversationId}`);
      return true;
    } catch (error) {
      console.warn('Read invalidation error:', error.message);
      return false;
    }
  }

  // Invalidate when conversation metadata changes (name, participants, etc.)
  async invalidateConversationMetadata(conversationId, userIds = []) {
    if (!this.isConnected) return false;
    
    try {
      // Delete last message cache
      await this.redisClient.del(`conv:${conversationId}:last_message`);
      
      // Delete sidebar caches for all participants
      const promises = [];
      for (const userId of userIds) {
        promises.push(this.redisClient.del(`sidebar:${userId}`));
      }
      
      await Promise.all(promises);
      console.log(`🗑️ Invalidated metadata cache for ${conversationId}`);
      return true;
    } catch (error) {
      console.warn('Metadata invalidation error:', error.message);
      return false;
    }
  }

  // ONLINE USERS CACHING

  // Add user to online users cache
  async addOnlineUser(userId, userInfo = {}, ttl = 300) { // 5 minutes
    if (!this.isConnected) return false;
    
    try {
      const key = `online:${userId}`;
      const onlineData = {
        userId,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        socketId: userInfo.socketId || null,
        userAgent: userInfo.userAgent || null,
        connectedAt: new Date().toISOString(),
        ...userInfo
      };
      
      await this.redisClient.setEx(key, ttl, JSON.stringify(onlineData));
      console.log(`🟢 User ${userId} marked as online`);
      return true;
    } catch (error) {
      console.warn('Add online user error:', error.message);
      return false;
    }
  }

  // Remove user from online users cache
  async removeOnlineUser(userId) {
    if (!this.isConnected) return false;
    
    try {
      const key = `online:${userId}`;
      await this.redisClient.del(key);
      console.log(`🔴 User ${userId} marked as offline`);
      return true;
    } catch (error) {
      console.warn('Remove online user error:', error.message);
      return false;
    }
  }

  // Check if user is online
  async isUserOnline(userId) {
    if (!this.isConnected) return false;
    
    try {
      const key = `online:${userId}`;
      const cached = await this.redisClient.get(key);
      return !!cached;
    } catch (error) {
      console.warn('Check online user error:', error.message);
      return false;
    }
  }

  // Get online user info
  async getOnlineUserInfo(userId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `online:${userId}`;
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get online user info error:', error.message);
      return null;
    }
  }

  // Get all online users
  async getAllOnlineUsers() {
    if (!this.isConnected) return [];
    
    try {
      const pattern = `online:*`;
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length === 0) {
        return [];
      }
      
      const onlineUsers = [];
      for (const key of keys) {
        const userData = await this.redisClient.get(key);
        if (userData) {
          onlineUsers.push(JSON.parse(userData));
        }
      }
      
      console.log(`👥 Retrieved ${onlineUsers.length} online users`);
      return onlineUsers;
    } catch (error) {
      console.warn('Get all online users error:', error.message);
      return [];
    }
  }

  // Get online user IDs only
  async getOnlineUserIds() {
    if (!this.isConnected) return [];
    
    try {
      const pattern = `online:*`;
      const keys = await this.redisClient.keys(pattern);
      
      return keys.map(key => key.replace('online:', ''));
    } catch (error) {
      console.warn('Get online user IDs error:', error.message);
      return [];
    }
  }

  // Update user's last activity (extend TTL)
  async updateUserActivity(userId, ttl = 300) {
    if (!this.isConnected) return false;
    
    try {
      const key = `online:${userId}`;
      const userData = await this.redisClient.get(key);
      
      if (userData) {
        const parsedData = JSON.parse(userData);
        parsedData.lastActivity = new Date().toISOString();
        
        await this.redisClient.setEx(key, ttl, JSON.stringify(parsedData));
        console.log(`🔄 Updated activity for user ${userId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Update user activity error:', error.message);
      return false;
    }
  }

  // Get online users count
  async getOnlineUsersCount() {
    if (!this.isConnected) return 0;
    
    try {
      const pattern = `online:*`;
      const keys = await this.redisClient.keys(pattern);
      return keys.length;
    } catch (error) {
      console.warn('Get online users count error:', error.message);
      return 0;
    }
  }

  // Clean up expired online users (called periodically)
  async cleanupExpiredOnlineUsers() {
    if (!this.isConnected) return 0;
    
    try {
      const pattern = `online:*`;
      const keys = await this.redisClient.keys(pattern);
      
      let cleanedCount = 0;
      for (const key of keys) {
        const ttl = await this.redisClient.ttl(key);
        if (ttl === -1) { // No expiration set, remove it
          await this.redisClient.del(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired online users`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.warn('Cleanup expired online users error:', error.message);
      return 0;
    }
  }

  // Get cache statistics
  async getCacheStats() {
    if (!this.isConnected) return { connected: false };
    
    try {
      const info = await this.redisClient.info('memory');
      const onlineCount = await this.getOnlineUsersCount();
      
      return {
        connected: true,
        onlineUsers: onlineCount,
        info: info
      };
    } catch (error) {
      console.warn('Cache stats error:', error.message);
      return { connected: false, error: error.message };
    }
  }

  // Start cleanup job for expired online users
  startCleanupJob(intervalMs = 60000) { // 1 minute default
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredOnlineUsers();
    }, intervalMs);
    
    console.log(`🧹 Started online users cleanup job (every ${intervalMs}ms)`);
  }

  // Stop cleanup job
  stopCleanupJob() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🧹 Stopped online users cleanup job');
    }
  }

  // Close connection
  async close() {
    this.stopCleanupJob();
    
    if (this.redisClient) {
      await this.redisClient.quit();
      this.isConnected = false;
    }
  }
}

// Export singleton instance
module.exports = new SidebarCacheService();
