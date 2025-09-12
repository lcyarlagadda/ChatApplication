import React, { useState, useEffect } from "react";
import {
  X,
  Crown,
  Users,
  Radio,
  Settings,
  UserPlus,
  UserMinus,
  Trash2,
  Edit3,
  Shield,
  Calendar,
  Plus,
  Search,
  User2,
  AlertTriangle,
} from "lucide-react";
import { formatTime } from "../../utils/helpers";
import { usersService } from "../../api/users";

// Move ConfirmationModal outside as a separate component
const ConfirmationModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default",
  isDark,
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          iconBg: "bg-red-100 dark:bg-red-900/50",
          iconColor: "text-red-600 dark:text-red-400",
          confirmButton: "bg-red-600 hover:bg-red-700 text-white",
        };
      case "warning":
        return {
          iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          confirmButton: "bg-yellow-600 hover:bg-yellow-700 text-white",
        };
      default:
        return {
          iconBg: "bg-blue-100 dark:bg-blue-900/50",
          iconColor: "text-blue-600 dark:text-blue-400",
          confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div
        className={`max-w-md w-full rounded-lg shadow-xl ${
          isDark ? "bg-gray-800 text-white" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${styles.iconBg}`}
            >
              <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
          <div className="flex space-x-3 justify-end">
            <button
              onClick={onCancel}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? "border-gray-600 hover:bg-gray-700 text-gray-300"
                  : "border-gray-300 hover:bg-gray-50 text-gray-700"
              }`}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg transition-colors ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInfoModal = ({
  conversation,
  currentUser,
  isAdmin,
  isDark,
  onClose,
  onUpdateConversation,
  onDeleteConversation,
  onAddParticipant,
  onRemoveParticipant,
  onAddAdmin,
  onRemoveAdmin,
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: conversation.name || "",
    description: conversation.description || "",
    avatar: conversation.avatar || "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "default",
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  // Add participant state
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
  console.log('🔍 Conversation data format check:', {
    admin: conversation.admin,
    adminType: typeof conversation.admin,
    admins: conversation.admins,
    adminsTypes: conversation.admins?.map(admin => ({
      admin,
      type: typeof admin,
      hasId: admin?._id ? 'yes' : 'no'
    }))
  });
}, [conversation.admin, conversation.admins]);

  const isMainAdmin = (conversation.admin === currentUser._id || conversation.admin.id === currentUser._id);
  const isBroadcast = (conversation.type === "broadcast");

  // Add these helper functions after the state declarations
  const showConfirmation = (config) => {
    setConfirmModal({
      isOpen: true,
      ...config,
    });
  };

  const hideConfirmation = () => {
    setConfirmModal({
      isOpen: false,
      title: "",
      message: "",
      onConfirm: () => {},
      type: "default",
      confirmText: "Confirm",
      cancelText: "Cancel",
    });
  };

  // Fix the isUserAdmin function
// Fix the isUserAdmin function
const isUserAdmin = (userId) => {
  if (!userId || !conversation) return false;

  // Check main admin - handle both string and object formats
  const mainAdminId = typeof conversation.admin === 'string' 
    ? conversation.admin 
    : conversation.admin?._id;
  
  if (mainAdminId === userId) return "main";

  // Check admins array - handle mixed formats
  if (conversation.admins && Array.isArray(conversation.admins)) {
    const isAdminUser = conversation.admins.some((admin) => {
      // Handle both string IDs and objects with _id property
      const adminUserId = typeof admin === 'string' ? admin : admin?._id;
      return adminUserId === userId;
    });
    if (isAdminUser) return "admin";
  }
  return false;
};

  const handleUpdateConversation = async () => {
    try {
      await onUpdateConversation(conversation._id, editForm);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update conversation:", error);
    }
  };

  const handleDeleteConversation = async () => {
    showConfirmation({
      title: `Delete ${isBroadcast ? "Channel" : "Group"}`,
      message: `Are you sure you want to delete this ${
        isBroadcast ? "channel" : "group"
      }? This action cannot be undone and all messages will be permanently deleted.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await onDeleteConversation(conversation._id);
          onClose();
        } catch (error) {
          console.error("Failed to delete conversation:", error);
        }
        hideConfirmation();
      },
    });
  };

  const handleRemoveParticipant = async (participantId) => {
    const participant = conversation.participants?.find(
      (p) => p.user?._id === participantId
    );
    if (!participant) return;

    const adminStatus = isUserAdmin(participantId);

    // Cannot remove main admin
    if (adminStatus === "main") {
      showConfirmation({
        title: "Cannot Remove Main Administrator",
        message: "The main administrator cannot be removed from the group.",
        confirmText: "OK",
        type: "warning",
        onConfirm: hideConfirmation,
      });
      return;
    }

    // If participant is an admin (but not main admin), require them to be demoted first
    if (adminStatus === "admin") {
      showConfirmation({
        title: "Remove Administrator",
        message: `${participant.user.name} is an administrator. They must be demoted to a regular member before removal. Do you want to demote them first?`,
        confirmText: "Demote First",
        cancelText: "Cancel",
        type: "warning",
        onConfirm: async () => {
          try {
            await onRemoveAdmin(conversation._id, participantId);
            hideConfirmation();

            // After successful demotion, ask if they want to remove the participant
            setTimeout(() => {
              showConfirmation({
                title: "Remove Participant",
                message: `Admin privileges have been removed from ${
                  participant.user.name
                }. Do you want to remove them from the ${
                  isBroadcast ? "channel" : "group"
                }?`,
                confirmText: "Remove",
                cancelText: "Keep as Member",
                type: "danger",
                onConfirm: async () => {
                  try {
                    await onRemoveParticipant(conversation._id, participantId);
                  } catch (error) {
                    console.error("Failed to remove participant:", error);
                  }
                  hideConfirmation();
                },
              });
            }, 500);
          } catch (error) {
            console.error("Failed to demote admin:", error);
            hideConfirmation();
          }
        },
      });
      return;
    }

    // For regular participants
    showConfirmation({
      title: "Remove Participant",
      message: `Are you sure you want to remove ${
        participant.user.name
      } from the ${isBroadcast ? "channel" : "group"}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await onRemoveParticipant(conversation._id, participantId);
        } catch (error) {
          console.error("Failed to remove participant:", error);
        }
        hideConfirmation();
      },
    });
  };

  const handleToggleAdmin = async (participantId) => {
    const participant = conversation.participants?.find(
      (p) => p.user?._id === participantId
    );
    if (!participant) return;

    const adminStatus = isUserAdmin(participantId);

    // Only main admin can toggle admin status
    if (!isMainAdmin) {
      showConfirmation({
        title: "Permission Denied",
        message: "Only the main administrator can manage admin privileges.",
        confirmText: "OK",
        type: "warning",
        onConfirm: hideConfirmation,
      });
      return;
    }

    if (adminStatus === "admin") {
      showConfirmation({
        title: "Remove Admin Privileges",
        message: `Are you sure you want to remove admin privileges from ${
          participant.user.name
        }? They will become a regular ${
          isBroadcast ? "subscriber" : "member"
        }.`,
        confirmText: "Remove Admin",
        cancelText: "Cancel",
        type: "warning",
        onConfirm: async () => {
          try {
            await onRemoveAdmin(conversation._id, participantId);
          } catch (error) {
            console.error("Failed to remove admin:", error);
          }
          hideConfirmation();
        },
      });
    } else if (adminStatus === false) {
      showConfirmation({
        title: "Promote to Administrator",
        message: `Are you sure you want to promote ${
          participant.user.name
        } to administrator? They will be able to manage ${
          isBroadcast ? "subscribers" : "members"
        } and ${isBroadcast ? "channel" : "group"} settings.`,
        confirmText: "Make Admin",
        cancelText: "Cancel",
        type: "default",
        onConfirm: async () => {
          try {
            await onAddAdmin(conversation._id, participantId);
          } catch (error) {
            console.error("Failed to add admin:", error);
          }
          hideConfirmation();
        },
      });
    }
  };

  // Search for users to add
  const handleSearchUsers = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await usersService.searchByEmail(query);
      if (result.success && result.users) {
        // Filter out current participants
        const filteredUsers = result.users.filter(
          (user) =>
            !conversation.participants.some((p) => p.user._id === user._id)
        );
        setSearchResults(filteredUsers);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showAddParticipant) {
        handleSearchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddParticipant]);

  useEffect(() => {
    setEditForm({
      name: conversation.name || "",
      description: conversation.description || "",
      avatar: conversation.avatar || "",
    });
  }, [conversation]);

  const handleAddParticipantClick = async (user) => {
    showConfirmation({
      title: `Add ${isBroadcast ? "Subscriber" : "Member"}`,
      message: `Are you sure you want to add ${user.name} to the ${
        isBroadcast ? "channel" : "group"
      }?`,
      confirmText: "Add",
      cancelText: "Cancel",
      type: "default",
      onConfirm: async () => {
        try {
          await onAddParticipant(conversation._id, user._id);
          setSearchQuery("");
          setSearchResults([]);
          setShowAddParticipant(false);
        } catch (error) {
          console.error("Failed to add participant:", error);
        }
        hideConfirmation();
      },
    });
  };

  const getParticipantRole = (participant) => {
    const adminRole = isUserAdmin(participant.user._id);
    if (adminRole == "main") return "Main Admin";
    if (adminRole == "admin") return "Admin";
    return isBroadcast ? "Subscriber" : "Member";
  };

  const getRoleColor = (participant) => {
    const adminStatus = isUserAdmin(participant.user._id);
    if (adminStatus === "main")
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (adminStatus === "admin")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  // Sort participants: Main admin first, then admins, then regular members
  const sortedParticipants = [...conversation.participants].sort((a, b) => {
    const aAdminStatus = isUserAdmin(a.user?._id);
    const bAdminStatus = isUserAdmin(b.user?._id);

    if (aAdminStatus === "main") return -1;
    if (bAdminStatus === "main") return 1;
    if (aAdminStatus === "admin" && bAdminStatus === false) return -1;
    if (bAdminStatus === "admin" && aAdminStatus === false) return 1;

    return a.user.name.localeCompare(b.user.name);
  });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
            isDark ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          {/* Header */}
          {console.log("ChatInfo", conversation)}
          {console.log("parts", conversation.participants)}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                    isBroadcast
                      ? "bg-gradient-to-r from-purple-500 to-pink-600"
                      : "bg-gradient-to-r from-green-500 to-teal-600"
                  }`}
                >
                  {editForm.avatar || conversation.avatar}
                </div>
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className={`text-xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                      placeholder="Enter name"
                    />
                  ) : (
                    <h2 className="text-xl font-bold flex items-center space-x-2">
                      <span>{conversation.name}</span>
                      {isBroadcast ? (
                        <Radio className="w-5 h-5 text-purple-500" />
                      ) : (
                        <Users className="w-5 h-5 text-green-500" />
                      )}
                      {isAdmin && (
                        <Crown
                          className="w-4 h-4 text-yellow-500"
                          title={isMainAdmin ? "Main Admin" : "Admin"}
                        />
                      )}
                    </h2>
                  )}
                  <p className="text-sm text-gray-500">
                    {conversation.participants.length}{" "}
                    {isBroadcast ? "subscribers" : "members"}
                    {conversation.admins && conversation.admins.length > 0 && (
                      <span className="ml-2">
                        • {1 + conversation.admins.length} admin
                        {conversation.admins.length > 0 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Edit conversation"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    className={`w-full p-2 rounded-lg border resize-none ${
                      isDark
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-50 border-gray-300"
                    }`}
                    rows={2}
                    placeholder="Enter description"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdateConversation}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: conversation.name || "",
                        description: conversation.description || "",
                        avatar: conversation.avatar || "",
                      });
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("info")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "info"
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab("members")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "members"
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {isBroadcast ? "Subscribers" : "Members"} (
              {conversation.participants.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "settings"
                    ? "border-b-2 border-blue-500 text-blue-500"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Admin Panel
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {activeTab === "info" && (
              <div className="space-y-4">
                {conversation.description && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      Description
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {conversation.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      isDark ? "bg-gray-700" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Created</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatTime(conversation.createdAt)}
                    </p>
                  </div>

                  <div
                    className={`p-3 rounded-lg ${
                      isDark ? "bg-gray-700" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <User2 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Type</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {conversation.type}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "members" && (
              <div className="space-y-3">
                {sortedParticipants.map((participant) => {
                  const isCurrentUser =
                    participant.user._id === currentUser._id;
                  const adminStatus = isUserAdmin(participant.user._id);
                  const isMainAdminUser = adminStatus === "main";
                  const isAdminUser = adminStatus === "admin";

                  return (
                    <div
                      key={participant.user._id}
                      className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
                    >
                      <div
                        className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold relative"
                      >
                        {participant.user.avatar ||
                          participant.user.name?.charAt(0).toUpperCase() ||
                          "?"}
                        {/* Admin crown overlay */}
                        {(isAdmin) && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center border border-white">
                            <Crown className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {participant.user.name} {isCurrentUser && "(You)"}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${getRoleColor(
                              participant
                            )}`}
                          >
                            {getParticipantRole(participant)}
                          </span>
                          {isMainAdminUser && (
                            <Crown className="w-3 h-3 text-yellow-500" />
                          )}
                          {isAdminUser && !isMainAdminUser && (
                            <Crown className="w-3 h-3 text-blue-500" />
                          )}
                        </div>
                      </div>

                      {/* Admin actions */}
                      {isAdmin && !isCurrentUser && (
                        <div className="flex items-center space-x-1">
                          {/* Toggle admin status - only main admin can do this */}
                          {!isMainAdminUser && (
                            <button
                              onClick={() =>
                                handleToggleAdmin(participant.user._id)
                              }
                              className={`p-2 rounded-lg transition-colors ${
                                isAdminUser
                                  ? "text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                              title={
                                isAdminUser
                                  ? "Remove admin privileges"
                                  : "Make admin"
                              }
                            >
                              <Crown className="w-4 h-4" />
                            </button>
                          )}

                          {/* Remove participant */}
                          {!isMainAdminUser && (
                            <button
                              onClick={() =>
                                handleRemoveParticipant(participant.user._id)
                              }
                              className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                              title={`Remove from ${
                                isBroadcast ? "channel" : "group"
                              }`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add participant section */}
                {isAdmin && (
                  <div className="border-t pt-3 mt-3">
                    {!showAddParticipant ? (
                      <button
                        onClick={() => setShowAddParticipant(true)}
                        className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex items-center justify-center space-x-2 text-gray-500 hover:text-blue-500"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Add {isBroadcast ? "Subscriber" : "Member"}</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="email"
                              placeholder="Search by email..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                                isDark
                                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                                  : "bg-gray-50 border-gray-300"
                              }`}
                            />
                            {searching && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowAddParticipant(false);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                          <div className="max-h-32 overflow-y-auto space-y-2 border rounded-lg p-2">
                            {searchResults.map((user) => (
                              <div
                                key={user._id}
                                onClick={() => handleAddParticipantClick(user)}
                                className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-600`}
                              >
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                  {user.avatar ||
                                    user.name?.charAt(0).toUpperCase() ||
                                    "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {user.name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {user.email}
                                  </p>
                                </div>
                                <Plus className="w-4 h-4 text-green-500" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && isAdmin && (
              <div className="space-y-6">
                {/* Admin Overview */}
                <div
                  className={`p-4 rounded-lg border ${
                    isBroadcast
                      ? "border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
                      : "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                  }`}
                >
                  <h3 className="font-medium mb-3 flex items-center space-x-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <span>Admin Panel</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {1 + (conversation.admins?.length || 0)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Total Admins
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {conversation.participants.length -
                          1 -
                          (conversation.admins?.length || 0)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Regular {isBroadcast ? "Subscribers" : "Members"}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {isBroadcast
                      ? "As an admin, you can send messages, manage subscribers, and control channel settings."
                      : "As an admin, you can manage members, add other admins, and control group settings."}
                  </p>

                  {isMainAdmin && (
                    <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <Crown className="w-4 h-4" />
                        <span className="font-medium">
                          You are the main administrator
                        </span>
                      </div>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        You can promote/demote other admins and have full
                        control over this {isBroadcast ? "channel" : "group"}.
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div>
                  <h4 className="font-medium mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setActiveTab("members");
                        setShowAddParticipant(true);
                      }}
                      className="p-3 rounded-lg border border-green-200 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20 transition-colors flex items-center space-x-2"
                    >
                      <UserPlus className="w-4 h-4 text-green-600" />
                      <span className="text-sm">
                        Add {isBroadcast ? "Subscriber" : "Member"}
                      </span>
                    </button>

                    {isMainAdmin && (
                      <button
                        onClick={() => setActiveTab("members")}
                        className="p-3 rounded-lg border border-blue-200 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20 transition-colors flex items-center space-x-2"
                      >
                        <Crown className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Manage Admins</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin List */}
                <div>
                  <h4 className="font-medium mb-3">Current Administrators</h4>
                  <div className="space-y-2">
                    {/* Main Admin */}
                    {conversation.admin &&
                      (() => {
                        const mainAdmin = conversation.participants.find(
                          (p) => p.user._id === conversation.admin
                        );
                        return mainAdmin ? (
                          <div
                            key={mainAdmin.user._id}
                            className="flex items-center space-x-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700"
                          >
                            <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white text-sm font-semibold relative">
                              {mainAdmin.user.avatar ||
                                mainAdmin.user.name?.charAt(0).toUpperCase() ||
                                "?"}
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                                <Crown className="w-1.5 h-1.5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {mainAdmin.user.name}{" "}
                                {mainAdmin.user._id === currentUser._id &&
                                  "(You)"}
                              </p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                Main Administrator
                              </p>
                            </div>
                            <Crown className="w-4 h-4 text-yellow-500" />
                          </div>
                        ) : null;
                      })()}

                    {/* Additional Admins */}
                    {conversation.admins &&
                      conversation.admins.map((adminId) => {
                        const admin = conversation.participants.find(
                          (p) => p.user._id === adminId
                        );
                        return admin ? (
                          <div
                            key={admin.user._id}
                            className="flex items-center space-x-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                          >
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold relative">
                              {admin.user.avatar ||
                                admin.user.name?.charAt(0).toUpperCase() ||
                                "?"}
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                <Shield className="w-1.5 h-1.5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {admin.user.name}{" "}
                                {admin.user._id === currentUser._id && "(You)"}
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                Administrator
                              </p>
                            </div>
                            {isMainAdmin &&
                              admin.user._id !== currentUser._id && (
                                <button
                                  onClick={() =>
                                    handleToggleAdmin(admin.user._id)
                                  }
                                  className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                  title="Remove admin privileges"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                        ) : null;
                      })}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
                  <h3 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center space-x-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Danger Zone</span>
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mb-3">
                    This action cannot be undone. All messages and member data
                    will be permanently deleted.
                  </p>
                  <button
                    onClick={handleDeleteConversation}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete {isBroadcast ? "Channel" : "Group"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render the Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmModal.onConfirm}
        onCancel={hideConfirmation}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        isDark={isDark}
      />
    </>
  );
};

export default ChatInfoModal;
