import apiClient from './client';
import API_CONFIG from './config';

export const messagesService = {
  // Get messages
  async getMessages(conversationId, page = 1, limit = 50) {
    return apiClient.get(`${API_CONFIG.ENDPOINTS.MESSAGES.LIST(conversationId)}?page=${page}&limit=${limit}`);
  },

  // Send message
  async sendMessage(conversationId, messageData) {
    return apiClient.post(API_CONFIG.ENDPOINTS.MESSAGES.SEND(conversationId), messageData);
  },

  // Send file message
  async sendFileMessage(conversationId, formData) {
    return apiClient.upload(API_CONFIG.ENDPOINTS.MESSAGES.SEND(conversationId), formData);
  },

  // Edit message
  async editMessage(messageId, content) {
    return apiClient.put(API_CONFIG.ENDPOINTS.MESSAGES.EDIT(messageId), content);
  },

  // Delete message
  async deleteMessage(messageId) {
    return apiClient.delete(API_CONFIG.ENDPOINTS.MESSAGES.DELETE(messageId));
  },

  // React to message
  async reactToMessage(messageId, emoji) {
    return apiClient.post(API_CONFIG.ENDPOINTS.MESSAGES.REACT(messageId), emoji);
  }
};
