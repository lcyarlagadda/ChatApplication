import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MessageSquare, Edit2, Save, X, Loader2, Check } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { usersService } from '../../api/users';

// Default avatar options
const DEFAULT_AVATARS = [
  '👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '👨‍🎓', '👩‍🎓',
  '👨‍🔬', '👩‍🔬', '👨‍💻', '👩‍💻', '👨‍🎨', '👩‍🎨', '👨‍🚀', '👩‍🚀',
  '🤴', '👸', '🦸', '🦸‍♀️', '🧙', '🧙‍♀️', '🧚', '🧚‍♀️',
  '🎭', '🎪', '🎨', '🎵', '🎸', '🎹', '🎺', '🎻',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱',
  '🌍', '🌎', '🌏', '🌙', '⭐', '🌟', '💫', '✨',
  '🔥', '💎', '🎯', '🎲', '🎮', '🕹️', '🎊', '🎉'
];

const ProfileModal = ({ user, onClose }) => {
  const { currentUser, updateUserProfile, isDark } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(user);
  const [editedUser, setEditedUser] = useState({
    name: user.name || '',
    email: user.email || '',
    bio: user.bio || '',
    phone: user.phone || '',
    status: user.status || 'online',
    avatar: user.avatar || ''
  });

  // Update currentUserData when user prop changes
  useEffect(() => {
    setCurrentUserData(user);
    setEditedUser({
      name: user.name || '',
      email: user.email || '',
      bio: user.bio || '',
      phone: user.phone || '',
      status: user.status || 'online',
      avatar: user.avatar || ''
    });
  }, [user]);

  const handleSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Prepare data to send (only changed fields)
      const updateData = {};
      if (editedUser.name !== currentUserData.name) updateData.name = editedUser.name;
      if (editedUser.email !== currentUserData.email) updateData.email = editedUser.email;
      if (editedUser.bio !== currentUserData.bio) updateData.bio = editedUser.bio;
      if (editedUser.phone !== currentUserData.phone) updateData.phone = editedUser.phone;
      if (editedUser.status !== currentUserData.status) updateData.status = editedUser.status;
      if (editedUser.avatar !== currentUserData.avatar) updateData.avatar = editedUser.avatar;

      // Only make API call if there are changes
      if (Object.keys(updateData).length > 0) {
        const response = await usersService.updateProfile(updateData);
        
        if (response.success) {
          // Update local state
          setCurrentUserData(response.user);
          
          // Update global user state using context (this will update sidebar automatically)
          updateUserProfile(response.user);
          
          setIsEditing(false);
        }
      } else {
        // No changes made
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to current values
    setEditedUser({
      name: currentUserData.name || '',
      email: currentUserData.email || '',
      bio: currentUserData.bio || '',
      phone: currentUserData.phone || '',
      status: currentUserData.status || 'online',
      avatar: currentUserData.avatar || ''
    });
    setError('');
    setIsEditing(false);
    setShowAvatarPicker(false);
  };

  const handleInputChange = (field, value) => {
    setEditedUser(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleAvatarSelect = (avatar) => {
    setEditedUser(prev => ({
      ...prev,
      avatar: avatar
    }));
    setShowAvatarPicker(false);
    
    // Clear error when user selects avatar
    if (error) {
      setError('');
    }
  };

  const isOwnProfile = (currentUserData._id === currentUser?._id) || 
                      (currentUserData.id === currentUser?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`w-full max-w-md mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-h-96 overflow-y-auto`}>
        {/* Profile Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <button 
              onClick={onClose} 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">Profile</h2>
            {isOwnProfile && (
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <button 
                      onClick={handleCancel}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                      disabled={isLoading}
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleSave}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Save className="w-5 h-5" />
                      )}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Profile Content */}
        <div className="p-6">
          {/* Avatar and basic info */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-3xl">
                {(isEditing ? editedUser.avatar : currentUserData.avatar) || currentUserData.name?.charAt(0).toUpperCase() || '👤'}
              </div>
              {isOwnProfile && isEditing && (
                <button 
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="absolute -bottom-2 -right-2 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Name */}
            <div className="mt-4">
              {isEditing ? (
                <input
                  type="text"
                  value={editedUser.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`text-xl font-semibold text-center w-full px-3 py-2 rounded-lg border ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  disabled={isLoading}
                  maxLength={50}
                  placeholder="Enter your name"
                />
              ) : (
                <h3 className="text-xl font-semibold">{currentUserData.name || 'No name set'}</h3>
              )}
            </div>

            {/* Email */}
            <div className="mt-2">
              {isEditing ? (
                <input
                  type="email"
                  value={editedUser.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`text-center w-full px-3 py-1 rounded-lg border ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-gray-400' 
                      : 'bg-white border-gray-300 text-gray-500'
                  } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  disabled={isLoading}
                  placeholder="Enter your email"
                />
              ) : (
                <p className="text-gray-500">{currentUserData.email || 'No email set'}</p>
              )}
            </div>

            {/* Status - Read Only */}
            <div className="mt-2">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                currentUserData.status === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                currentUserData.status === 'away' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {currentUserData.status || 'online'}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mb-6">
            <h4 className="font-semibold mb-2">About</h4>
            {isEditing ? (
              <textarea
                value={editedUser.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-300' 
                    : 'bg-white border-gray-300 text-gray-600'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
                placeholder="Tell us about yourself..."
                disabled={isLoading}
                maxLength={500}
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                {currentUserData.bio || 'No bio added yet.'}
              </p>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Contact Info</h4>
              <div className="space-y-3">
                {/* Phone */}
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedUser.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`flex-1 px-3 py-1 rounded-lg border ${
                        isDark 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      disabled={isLoading}
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <span>{currentUserData.phone || 'No phone number'}</span>
                  )}
                </div>
                
                {/* Email (read-only in contact section) */}
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span>{isEditing ? editedUser.email : currentUserData.email || 'No email set'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!isOwnProfile && (
            <div className="mt-6 space-y-3">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Send Message
              </button>
            </div>
          )}
        </div>

        {/* Avatar Picker Modal */}
        {showAvatarPicker && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`w-full max-w-md mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Choose Avatar</h3>
                  <button 
                    onClick={() => setShowAvatarPicker(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-8 gap-3 max-h-64 overflow-y-auto">
                  {DEFAULT_AVATARS.map((avatar, index) => (
                    <button
                      key={index}
                      onClick={() => handleAvatarSelect(avatar)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:scale-110 transition-all ${
                        editedUser.avatar === avatar
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {avatar}
                      {editedUser.avatar === avatar && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-4 h-4 text-blue-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 text-center">
                  <button
                    onClick={() => handleAvatarSelect('')}
                    className={`px-4 py-2 rounded-lg text-sm ${
                      editedUser.avatar === ''
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Use Initial Letter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;