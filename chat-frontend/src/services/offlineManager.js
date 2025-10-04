import ObjectId from "../utils/ObjectId";
import API_CONFIG from "../api/config";
import sessionManager from "../utils/sessionManager";

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.messageQueue = [];
    this.drafts = {};
    this.syncInProgress = false;
    this.setupEventListeners();
    this.loadFromLocalStorage();
  }

  setupEventListeners() {
    const handleOnline = () => {
      this.isOnline = true;
      this.syncMessages();
    };

    const handleOffline = () => {
      this.isOnline = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  loadFromLocalStorage() {
    try {
      const storedMessages = localStorage.getItem('offlineMessages');
      if (storedMessages) {
        this.messageQueue = JSON.parse(storedMessages);
      }
      const storedDrafts = localStorage.getItem('offlineDrafts');
      if (storedDrafts) {
        this.drafts = JSON.parse(storedDrafts);
      }
    } catch (error) {
      this.messageQueue = [];
      this.drafts = {};
    }
  }

  saveToLocalStorage() {
    localStorage.setItem('offlineMessages', JSON.stringify(this.messageQueue));
    localStorage.setItem('offlineDrafts', JSON.stringify(this.drafts));
  }

  queueMessage(messageData) {
    const queuedMessage = {
      ...messageData,
      id: messageData._id, // Use the original _id as the offline id
      status: 'queued',
      timestamp: new Date().toISOString(),
      isOffline: true
    };
    this.messageQueue.push(queuedMessage);
    this.saveToLocalStorage();
    return queuedMessage;
  }

  async sendMessage(messageData) {
    if (!this.isOnline) {
      return this.queueMessage(messageData);
    }

    try {
      const response = await sessionManager.authenticatedRequest(
        `/messages/${messageData.conversationId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: messageData.content,
            messageType: messageData.messageType || 'text',
            replyTo: messageData.replyTo
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        return { ...result.data, status: 'sent' };
      } else {
        if (response.status === 404) {
          throw new Error(`Conversation not found: ${messageData.conversationId}`);
        } else if (response.status === 403) {
          throw new Error(`Access denied to conversation: ${messageData.conversationId}`);
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
    } catch (error) {
      if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('NetworkError')) {
        return this.queueMessage(messageData);
      } else {
        throw error;
      }
    }
  }

  async syncMessages() {
    if (!this.isOnline || this.syncInProgress || this.messageQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    const messagesToSync = [...this.messageQueue];
    let successCount = 0;

    for (const message of messagesToSync) {
      try {
        const response = await sessionManager.authenticatedRequest(
          `/messages/${message.conversationId}`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: message.content,
              messageType: message.messageType || 'text',
              replyTo: message.replyTo
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          this.removeFromQueue(message.id);
          successCount++;
          
          // Dispatch event for UI update
          window.dispatchEvent(new CustomEvent('offlineMessageSent', {
            detail: {
              messageId: message.id,
              conversationId: message.conversationId,
              serverMessage: result.data
            }
          }));
        } else {
          if (response.status === 404 || response.status === 403) {
            this.removeFromQueue(message.id);
          }
        }
      } catch (error) {
        // Keep message in queue for retry if it's a network error
      }
    }

    this.syncInProgress = false;
    window.dispatchEvent(new CustomEvent('offlineSyncComplete', { 
      detail: { successCount, totalCount: messagesToSync.length } 
    }));
  }

  removeFromQueue(offlineMessageId) {
    this.messageQueue = this.messageQueue.filter(msg => msg.id !== offlineMessageId);
    this.saveToLocalStorage();
  }

  saveDraft(conversationId, content) {
    this.drafts[conversationId] = content;
    this.saveToLocalStorage();
  }

  getDraft(conversationId) {
    return this.drafts[conversationId] || '';
  }

  clearDraft(conversationId) {
    delete this.drafts[conversationId];
    this.saveToLocalStorage();
  }

  getQueuedCount() {
    return this.messageQueue.length;
  }

  getOnlineStatus() {
    return this.isOnline;
  }

  clearAll() {
    this.messageQueue = [];
    this.drafts = {};
    this.saveToLocalStorage();
  }

  // Manual sync trigger (for debugging)
  forceSync() {
    this.syncMessages();
  }

  // Get current status (for debugging)
  getStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.messageQueue.length,
      syncInProgress: this.syncInProgress,
      drafts: Object.keys(this.drafts).length
    };
  }

}

const offlineManager = new OfflineManager();

if (typeof window !== 'undefined') {
  window.offlineManager = offlineManager;
  
  // Add debugging methods to window
  window.debugOffline = {
    status: () => offlineManager.getStatus(),
    forceSync: () => offlineManager.forceSync(),
    clearAll: () => offlineManager.clearAll(),
    queue: () => offlineManager.messageQueue,
    drafts: () => offlineManager.drafts
  };
}

export default offlineManager;
