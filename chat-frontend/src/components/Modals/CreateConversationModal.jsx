import React, { useState, useEffect } from 'react';
import { X, Users, Search, Plus, Crown, Check, UserPlus, MessageSquare, Radio, Shield } from 'lucide-react';
import { usersService } from '../../api/users';
import { useUser } from '../../contexts/UserContext';

const CreateConversationModal = ({ 
  isOpen, 
  onClose, 
  onCreateConversation,
  onCreateDirectConversation,
  isDark,
  mode = 'select' // 'select', 'direct', 'group', 'broadcast'
}) => {
  const { currentUser, conversations } = useUser();
  
  // Modal state
  const [currentMode, setCurrentMode] = useState(mode);
  const [step, setStep] = useState(1); // 1: Type selection or details, 2: Add participants, 3: Admin settings
  
  // Common form data
  const [conversationName, setConversationName] = useState('');
  const [conversationDescription, setConversationDescription] = useState('');
  const [conversationAvatar, setConversationAvatar] = useState('👥');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Admin management
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [isBroadcast, setIsBroadcast] = useState(false);
  
  // Avatar options for different conversation types
  const groupAvatars = ['👥', '🎉', '💼', '🎮', '📚', '⚽', '🎵', '🍕', '✈️', '🌟'];
  const broadcastAvatars = ['📢', '📺', '📻', '🔊', '📡', '🎯', '🚨', '📰', '📣', '🎪'];

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      setStep(mode === 'select' ? 1 : (mode === 'direct' ? 2 : 1));
      setConversationName('');
      setConversationDescription('');
      setConversationAvatar(mode === 'broadcast' ? '📢' : '👥');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedParticipants([]);
      setSelectedAdmins([]);
      setIsBroadcast(mode === 'broadcast');
      setError('');
    }
  }, [isOpen, mode]);

  // Search for users with debouncing
  const handleSearchUsers = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError('');

    try {
      const result = await usersService.searchByEmail(query);
      if (result.success && result.users) {
        // Filter out current user and already selected participants
        const filteredUsers = result.users.filter(user => 
          user._id !== currentUser._id && 
          !selectedParticipants.some(p => p._id === user._id)
        );
        setSearchResults(filteredUsers);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to search users');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add participant
  const handleAddParticipant = (user) => {
    if (!selectedParticipants.some(p => p._id === user._id)) {
      setSelectedParticipants([...selectedParticipants, user]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // Remove participant
  const handleRemoveParticipant = (userId) => {
    setSelectedParticipants(selectedParticipants.filter(p => p._id !== userId));
    // Also remove from admins if they were an admin
    setSelectedAdmins(selectedAdmins.filter(adminId => adminId !== userId));
  };

  // Toggle admin status
  const handleToggleAdmin = (userId) => {
    if (selectedAdmins.includes(userId)) {
      setSelectedAdmins(selectedAdmins.filter(id => id !== userId));
    } else {
      setSelectedAdmins([...selectedAdmins, userId]);
    }
  };

  // Handle direct message creation
  const handleCreateDirectMessage = async () => {
    if (selectedParticipants.length !== 1) {
      setError('Please select exactly one person for direct message');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if conversation already exists
      const foundUser = selectedParticipants[0];
      const existingConv = conversations.find(conv => 
        conv.type === 'direct' && 
        conv.participants.some(participant => 
          participant.user._id === foundUser._id
        )
      );

      if (existingConv) {
        onClose();
        // The parent component should handle setting active chat
        return;
      }

      await onCreateDirectConversation(foundUser._id);
      onClose();
    } catch (error) {
      console.error('Failed to create direct conversation:', error);
      setError('Failed to create conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Navigation functions
  const handleNext = () => {
    if (step === 1 && currentMode !== 'direct') {
      if (!conversationName.trim()) {
        setError(`${currentMode === 'broadcast' ? 'Channel' : 'Group'} name is required`);
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (currentMode === 'direct') {
        handleCreateDirectMessage();
      } else if (selectedParticipants.length === 0) {
        setError('Please add at least one participant');
        return;
      } else {
        setError('');
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      if (currentMode === 'direct') {
        setCurrentMode('select');
        setStep(1);
      } else {
        setStep(1);
      }
    } else if (step === 1 && currentMode !== 'select') {
      setCurrentMode('select');
    }
    setError('');
  };

  // Create conversation
  const handleCreate = async () => {
    if (selectedParticipants.length === 0) {
      setError('Please add at least one participant');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const participantIds = selectedParticipants.map(p => p._id);
      const conversationType = currentMode === 'broadcast' ? 'broadcast' : 'group';
      
      // For broadcast channels, only creator is admin unless specified
      const adminIds = currentMode === 'broadcast' 
        ? [currentUser._id, ...selectedAdmins]
        : [currentUser._id, ...selectedAdmins];
      
      await onCreateConversation(
        participantIds,
        conversationName.trim(),
        conversationType,
        {
          description: conversationDescription.trim(),
          avatar: conversationAvatar,
          admins: adminIds,
          isBroadcast: currentMode === 'broadcast'
        }
      );

      onClose();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setError(`Failed to create ${currentMode === 'broadcast' ? 'channel' : 'group'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Get current avatar options
  const getAvatarOptions = () => {
    return currentMode === 'broadcast' ? broadcastAvatars : groupAvatars;
  };

  // Get step title
  const getStepTitle = () => {
    if (currentMode === 'select') return 'New Conversation';
    if (currentMode === 'direct') return 'Direct Message';
    if (currentMode === 'broadcast') {
      if (step === 1) return 'Create Broadcast Channel';
      if (step === 2) return 'Add Subscribers';
      if (step === 3) return 'Admin Settings';
    } else {
      if (step === 1) return 'Create Group';
      if (step === 2) return 'Add Participants';
      if (step === 3) return 'Admin Settings';
    }
    return 'New Conversation';
  };

  // Get step description
  const getStepDescription = () => {
    if (currentMode === 'select') return 'Choose conversation type';
    if (currentMode === 'direct') return 'Find someone to chat with';
    if (currentMode === 'broadcast') {
      if (step === 1) return 'Set up your broadcast channel';
      if (step === 2) return `${selectedParticipants.length} subscribers selected`;
      if (step === 3) return 'Manage channel administrators';
    } else {
      if (step === 1) return 'Set up your group details';
      if (step === 2) return `${selectedParticipants.length} participants selected`;
      if (step === 3) return 'Choose group administrators';
    }
    return '';
  };

  if (!isOpen) return null;

return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl ${
        isDark ? 'bg-gray-800 text-white' : 'bg-white'
      }`}>
        {/* Header - Fixed */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentMode === 'broadcast' 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                  : currentMode === 'group'
                  ? 'bg-gradient-to-r from-green-500 to-teal-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600'
              }`}>
                {currentMode === 'broadcast' ? (
                  <Radio className="w-5 h-5 text-white" />
                ) : currentMode === 'group' ? (
                  <Users className="w-5 h-5 text-white" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{getStepTitle()}</h2>
                <p className="text-sm text-gray-500">{getStepDescription()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6">
            {/* Step 1: Type Selection or Details */}
            {step === 1 && currentMode === 'select' && (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  What type of conversation would you like to create?
                </p>
                
                {/* Direct Message Option */}
                <button
                  onClick={() => setCurrentMode('direct')}
                  className={`w-full p-4 rounded-lg border-2 border-dashed transition-all hover:shadow-md ${
                    isDark 
                      ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-700' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Direct Message</h3>
                      <p className="text-sm text-gray-500">Private conversation with one person</p>
                    </div>
                  </div>
                </button>

                {/* Group Option */}
                <button
                  onClick={() => setCurrentMode('group')}
                  className={`w-full p-4 rounded-lg border-2 border-dashed transition-all hover:shadow-md ${
                    isDark 
                      ? 'border-gray-600 hover:border-green-500 hover:bg-gray-700' 
                      : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Group Chat</h3>
                      <p className="text-sm text-gray-500">Group conversation with multiple people</p>
                    </div>
                  </div>
                </button>

                {/* Broadcast Channel Option */}
                <button
                  onClick={() => setCurrentMode('broadcast')}
                  className={`w-full p-4 rounded-lg border-2 border-dashed transition-all hover:shadow-md ${
                    isDark 
                      ? 'border-gray-600 hover:border-purple-500 hover:bg-gray-700' 
                      : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Broadcast Channel</h3>
                      <p className="text-sm text-gray-500">One-way communication channel (read-only for subscribers)</p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Step 1: Group/Broadcast Details */}
            {step === 1 && (currentMode === 'group' || currentMode === 'broadcast') && (
              <div className="space-y-6">
                {/* Avatar Selection */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    {currentMode === 'broadcast' ? 'Channel' : 'Group'} Avatar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {getAvatarOptions().map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setConversationAvatar(emoji)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
                          conversationAvatar === emoji
                            ? currentMode === 'broadcast'
                              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white scale-110'
                              : 'bg-gradient-to-r from-green-500 to-teal-600 text-white scale-110'
                            : isDark
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {currentMode === 'broadcast' ? 'Channel' : 'Group'} Name *
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter ${currentMode === 'broadcast' ? 'channel' : 'group'} name`}
                    value={conversationName}
                    onChange={(e) => setConversationName(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 ${
                      currentMode === 'broadcast' 
                        ? 'focus:ring-purple-500' 
                        : 'focus:ring-green-500'
                    } focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 border-gray-300'
                    }`}
                    maxLength={50}
                  />
                  <div className="flex justify-between mt-1">
                    <span></span>
                    <span className="text-xs text-gray-500">
                      {conversationName.length}/50
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder={`What's this ${currentMode === 'broadcast' ? 'channel' : 'group'} about?`}
                    value={conversationDescription}
                    onChange={(e) => setConversationDescription(e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 ${
                      currentMode === 'broadcast' 
                        ? 'focus:ring-purple-500' 
                        : 'focus:ring-green-500'
                    } focus:border-transparent transition-all resize-none ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 border-gray-300'
                    }`}
                    maxLength={200}
                  />
                  <div className="flex justify-between mt-1">
                    <span></span>
                    <span className="text-xs text-gray-500">
                      {conversationDescription.length}/200
                    </span>
                  </div>
                </div>

                {currentMode === 'broadcast' && (
                  <div className={`p-4 rounded-lg border ${
                    isDark ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-200'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <Radio className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-purple-700 dark:text-purple-300">Broadcast Channel</h4>
                        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                          Only admins can send messages. Subscribers can only read messages.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Add Participants */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Search Users */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {currentMode === 'direct' 
                      ? 'Search by email' 
                      : currentMode === 'broadcast'
                      ? 'Search subscribers by email'
                      : 'Search participants by email'}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 ${
                        currentMode === 'broadcast' 
                          ? 'focus:ring-purple-500' 
                          : currentMode === 'group'
                          ? 'focus:ring-green-500'
                          : 'focus:ring-blue-500'
                      } focus:border-transparent transition-all ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${
                          currentMode === 'broadcast' 
                            ? 'border-purple-500' 
                            : currentMode === 'group'
                            ? 'border-green-500'
                            : 'border-blue-500'
                        }`}></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-500">Search Results</h3>
                    <div className="max-h-32 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {searchResults.map((user) => (
                        <div
                          key={user._id}
                          onClick={() => handleAddParticipant(user)}
                          className={`p-3 rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                            isDark 
                              ? 'bg-gray-700 hover:bg-gray-600' 
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {user.avatar || user.name?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.name}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <Plus className={`w-4 h-4 ${
                              currentMode === 'broadcast' 
                                ? 'text-purple-500' 
                                : currentMode === 'group'
                                ? 'text-green-500'
                                : 'text-blue-500'
                            }`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Participants */}
                {selectedParticipants.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-500">
                      Selected {currentMode === 'broadcast' ? 'Subscribers' : 'Participants'} ({selectedParticipants.length})
                    </h3>
                    <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {selectedParticipants.map((user) => (
                        <div
                          key={user._id}
                          className={`p-3 rounded-lg ${
                            isDark ? 'bg-gray-700' : 
                            currentMode === 'broadcast' ? 'bg-purple-50' :
                            currentMode === 'group' ? 'bg-green-50' :
                            'bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {user.avatar || user.name?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{user.name}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveParticipant(user._id)}
                              className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900 text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Admin Settings */}
            {step === 3 && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${
                  isDark ? 'bg-gray-700 border-gray-600' : 
                  currentMode === 'broadcast' ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      currentMode === 'broadcast' 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                        : 'bg-gradient-to-r from-green-500 to-teal-600'
                    }`}>
                      <span className="text-white text-xl">{conversationAvatar}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{conversationName}</p>
                      <p className="text-sm text-gray-500">
                        {selectedParticipants.length + 1} {currentMode === 'broadcast' ? 'subscribers' : 'members'} (including you)
                      </p>
                    </div>
                    <Crown className="w-5 h-5 text-yellow-500 ml-auto" title="You'll be the admin" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">
                    Choose Additional Administrators
                    {currentMode === 'broadcast' && (
                      <span className="block text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Only admins can send messages in broadcast channels
                      </span>
                    )}
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {selectedParticipants.map((user) => (
                      <div
                        key={user._id}
                        className={`p-3 rounded-lg transition-all cursor-pointer ${
                          selectedAdmins.includes(user._id)
                            ? isDark 
                              ? 'bg-yellow-900/20 border border-yellow-700' 
                              : 'bg-yellow-50 border border-yellow-200'
                            : isDark 
                            ? 'bg-gray-700 hover:bg-gray-600' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => handleToggleAdmin(user._id)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                              {user.avatar || user.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {selectedAdmins.includes(user._id) && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              selectedAdmins.includes(user._id)
                                ? 'bg-yellow-500 border-yellow-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {selectedAdmins.includes(user._id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAdmins.length > 0 && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-300">
                        {selectedAdmins.length + 1} administrator{selectedAdmins.length > 0 ? 's' : ''} selected (including you)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between space-x-3">
            {(step > 1 || (step === 1 && currentMode !== 'select')) && (
              <button
                onClick={handleBack}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Back
              </button>
            )}
            
            <div className="flex space-x-3 ml-auto">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Cancel
              </button>
              
              {currentMode === 'select' ? null : step < (currentMode === 'direct' ? 2 : 3) ? (
                <button
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !conversationName.trim() && currentMode !== 'direct') ||
                    (step === 2 && currentMode === 'direct' && selectedParticipants.length !== 1) ||
                    (step === 2 && currentMode !== 'direct' && selectedParticipants.length === 0)
                  }
                  className={`px-6 py-2 text-white rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                    currentMode === 'broadcast' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      : currentMode === 'group'
                      ? 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {step === 2 && currentMode === 'direct' ? 'Create Chat' : 'Next'}
                </button>
              ) : (
                <button
                  onClick={currentMode === 'direct' ? handleCreateDirectMessage : handleCreate}
                  disabled={
                    loading || 
                    (currentMode !== 'direct' && selectedParticipants.length === 0)
                  }
                  className={`px-6 py-2 text-white rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2 ${
                    currentMode === 'broadcast' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                      : currentMode === 'group'
                      ? 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Create {currentMode === 'broadcast' ? 'Channel' : currentMode === 'group' ? 'Group' : 'Chat'}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateConversationModal;