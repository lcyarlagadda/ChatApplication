import apiClient from './client';
import API_CONFIG from './config';

export const conversationsService = {
  // Get all conversations
  async getConversations() {
    return apiClient.get(API_CONFIG.ENDPOINTS.CONVERSATIONS.LIST);
  },

  // Get specific conversation
  async getConversation(id) {
    return apiClient.get(API_CONFIG.ENDPOINTS.CONVERSATIONS.GET(id));
  },

  // Create conversation
  async createConversation(data) {
    return apiClient.post(API_CONFIG.ENDPOINTS.CONVERSATIONS.CREATE, data);
  },

  // Update conversation
  async updateConversation(id, data) {
    return apiClient.put(API_CONFIG.ENDPOINTS.CONVERSATIONS.UPDATE(id), data);
  },

  // Delete conversation
  async deleteConversation(id) {
    return apiClient.delete(API_CONFIG.ENDPOINTS.CONVERSATIONS.DELETE(id));
  },

  // Get participants
  async getParticipants(id) {
    return apiClient.get(API_CONFIG.ENDPOINTS.CONVERSATIONS.PARTICIPANTS(id));
  }
};
