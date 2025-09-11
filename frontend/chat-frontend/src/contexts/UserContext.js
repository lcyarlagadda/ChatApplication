// contexts/UserContext.js
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { authService } from "../api/auth";
import sessionManager from "../utils/sessionManager";

// Create the context
const UserContext = createContext(null);

// Custom hook to use the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

// Context Provider Component
export const UserProvider = ({ children }) => {
  // User-related state
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isError, setIsError] = useState(false);
  const [popupAlert, setPopupAlert] = useState({ show: false, message: "" });

  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Session state
  const [sessionInfo, setSessionInfo] = useState({
    isValid: false,
    timeUntilExpiry: 0,
    availableSessions: {},
  });

  // UI state
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // Initialize session management on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Update session info periodically
  useEffect(() => {
    const updateSessionInfo = () => {
      setSessionInfo({
        isValid: authService.isAuthenticated(),
        timeUntilExpiry: authService.getTimeUntilExpiry(),
        availableSessions: authService.getAvailableSessions(),
      });
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Set up auth event listeners
  useEffect(() => {
    const handleAuthFailure = (event) => {
      console.error("Auth failure detected:", event.detail);
      setCurrentUser(null);
      setConversations([]);
      setActiveChat(null);
      setOnlineUsers(new Set());
      setError(event.detail.message || "Session expired. Please login again.");
    };

    const handleAuthRestored = (event) => {
      // setCurrentUser(event.detail.user);
      setError("");
    };

    const handleAuthSwitched = (event) => {
      // setCurrentUser(event.detail.user);
      setError("");
      setConversations([]);
      setActiveChat(null);
      setOnlineUsers(new Set());
    };

    const removeAuthFailure = authService.onAuthFailure(handleAuthFailure);
    const removeAuthRestored = authService.onAuthRestored(handleAuthRestored);
    const removeAuthSwitched = authService.onAuthSwitched(handleAuthSwitched);

    return () => {
      removeAuthFailure();
      removeAuthRestored();
      removeAuthSwitched();
    };
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDark));
  }, [isDark]);

  // Initialize authentication
  const initializeAuth = async () => {
    try {
      setIsLoading(true);

      const session = authService.init();

      if (session) {
        console.log("Session found, setting basic user...");
        setCurrentUser(session.user);

        // CRITICAL: Always fetch complete profile immediately after setting basic user
        console.log("Fetching complete profile after session restore...");
        const completeUser = await fetchCompleteUserProfile();

        if (completeUser) {
          console.log(
            "Complete profile loaded on session restore:",
            completeUser.blockedUsers
          );
          setCurrentUser(completeUser);
        }

        setError("");
      } else {
        try {
          console.log("No session found, verifying token...");
          const response = await authService.verifyToken();
          if (response.success && response.user) {
            setCurrentUser(response.user);

            // CRITICAL: Also fetch complete profile after token verification
            console.log(
              "Fetching complete profile after token verification..."
            );
            const completeUser = await fetchCompleteUserProfile();

            if (completeUser) {
              console.log(
                "Complete profile loaded on token verification:",
                completeUser.blockedUsers
              );
              setCurrentUser(completeUser);
            }

            setError("");
          }
        } catch (verifyError) {
          console.error("Token verification failed:", verifyError.message);
        }
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      setError("Failed to initialize authentication");
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateUserProfile = useCallback((updatedUser) => {
    setCurrentUser((prevUser) => {
      if (!prevUser) return prevUser;

      const isSameUser =
        prevUser._id === updatedUser._id || prevUser.id === updatedUser.id;

      if (isSameUser) {
        const newUser = {
          ...prevUser,
          ...updatedUser,
          _id: prevUser._id || updatedUser._id,
          id: prevUser.id || updatedUser.id,
        };

        return newUser;
      }
      return prevUser;
    });

    // Update conversations with new user data
    setConversations((prevConversations) =>
      prevConversations.map((conversation) => {
        let hasChanges = false;

        const updatedParticipants = conversation.participants.map(
          (participant) => {
            const participantId = participant.user._id || participant.user.id;
            const updatedId = updatedUser._id || updatedUser.id;

            if (participantId === updatedId) {
              hasChanges = true;
              return {
                ...participant,
                user: {
                  ...participant.user,
                  ...updatedUser,
                  _id: participant.user._id || updatedUser._id,
                  id: participant.user.id || updatedUser.id,
                },
              };
            }
            return participant;
          }
        );

        let updatedLastMessage = conversation.lastMessage;
        if (conversation.lastMessage?.sender) {
          const senderId =
            conversation.lastMessage.sender._id ||
            conversation.lastMessage.sender.id;
          const updatedId = updatedUser._id || updatedUser.id;

          if (senderId === updatedId) {
            hasChanges = true;
            updatedLastMessage = {
              ...conversation.lastMessage,
              sender: {
                ...conversation.lastMessage.sender,
                ...updatedUser,
                _id: conversation.lastMessage.sender._id || updatedUser._id,
                id: conversation.lastMessage.sender.id || updatedUser.id,
              },
            };
          }
        }

        if (hasChanges) {
          return {
            ...conversation,
            participants: updatedParticipants,
            lastMessage: updatedLastMessage,
          };
        }

        return conversation;
      })
    );
  }, []);

  // Register user - uses your existing auth service
  const registerUser = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await authService.register(userData);

      if (response.success) {
        if (response.user && response.accessToken) {
          setCurrentUser(response.user);
          return response;
        } else {
          // Show popup for verification email
          setPopupAlert({
            show: true,
            message:
              "Verification email sent! Check your inbox and click the verification link.",
          });

          setTimeout(() => {
            setPopupAlert({ show: false, message: "" });
          }, 8000);

          return {
            success: true,
            message:
              response.message ||
              "Please check your email for verification instructions",
            emailVerificationRequired: true,
            email: userData.email,
          };
        }
      } else {
        throw new Error(response.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.message || "Registration failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCompleteUserProfile = useCallback(async () => {
    try {
      console.log("Fetching complete user profile...");

      const response = await sessionManager.authenticatedRequest(
        "/users/me/profile"
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const completeUser = {
            ...data.user,
            blockedUsers: data.user.blockedUsers || [],
          };

          // Only update if there are actual changes
          setCurrentUser((prev) => {
            if (!prev) return completeUser;

            const blockedUsersChanged =
              JSON.stringify(prev.blockedUsers || []) !==
              JSON.stringify(completeUser.blockedUsers);

            if (blockedUsersChanged || !prev.blockedUsers) {
              console.log(
                "User profile updated with blocked users:",
                completeUser.blockedUsers
              );
              return completeUser;
            }

            return prev; // No changes, prevent re-render
          });

          return completeUser;
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }, []); // No dependencies to prevent infinite loops

  // Login function - uses your existing auth service
  const loginUser = useCallback(
    async (credentials) => {
      try {
        setIsLoading(true);
        setError("");

        const response = await authService.login(credentials);

        if (response.success && response.user) {
          console.log("Login successful, setting basic user...");
          setCurrentUser(response.user);

          // CRITICAL: Always fetch complete profile immediately after login
          console.log("Fetching complete profile after login...");
          const completeUser = await fetchCompleteUserProfile();

          if (completeUser) {
            console.log(
              "Complete profile loaded after login:",
              completeUser.blockedUsers
            );
            setCurrentUser(completeUser);
          }

          return response;
        } else {
          throw new Error(response.message || "Login failed");
        }
      } catch (error) {
        console.error("Login error:", error);
        setError(error.message || "Login failed");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchCompleteUserProfile]
  );

  // Request password reset - uses your existing auth service
  const requestPasswordReset = useCallback(async (email) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await authService.forgotPassword(email);

      if (response.success) {
        // Show popup for reset email sent
        setPopupAlert({
          show: true,
          message:
            "Password reset instructions sent! Check your inbox for the reset link.",
        });

        setTimeout(() => {
          setPopupAlert({ show: false, message: "" });
        }, 8000);

        return {
          success: true,
          message:
            response.message ||
            "Password reset instructions sent to your email",
        };
      } else {
        throw new Error(
          response.message || "Failed to send reset instructions"
        );
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(error.message || "Failed to send reset instructions");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset password - uses your existing auth service
  const resetPassword = useCallback(async (token, newPassword) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await authService.resetPassword(token, newPassword);

      if (response.success) {
        // Redirect to root URL (remove both path and params)
        window.history.replaceState({}, "", "/");

        // Show popup for successful reset
        setPopupAlert({
          show: true,
          message:
            "Password reset successful! You can now sign in with your new password.",
        });

        setTimeout(() => {
          setPopupAlert({ show: false, message: "" });
        }, 10000);

        return {
          success: true,
          message: response.message || "Password reset successfully",
        };
      } else {
        throw new Error(response.message || "Password reset failed");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError(error.message || "Password reset failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout function - uses your existing auth service
  const logoutUser = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setCurrentUser(null);
      setConversations([]);
      setActiveChat(null);
      setOnlineUsers(new Set());
      setError("");
    }
  }, []);

  // Logout from all devices - uses your existing auth service
  const logoutAllDevices = useCallback(async () => {
    try {
      await authService.logoutAll();
    } catch (error) {
      console.error("Logout all error:", error);
    } finally {
      setCurrentUser(null);
      setConversations([]);
      setActiveChat(null);
      setOnlineUsers(new Set());
      setError("");
    }
  }, []);

  const switchUser = useCallback(
    async (userId) => {
      try {
        const session = authService.switchToUser(userId);
        if (session) {
          setCurrentUser(session.user);

          // CRITICAL: Fetch complete profile for switched user
          console.log("Fetching complete profile for switched user...");
          const completeUser = await fetchCompleteUserProfile();

          if (completeUser) {
            console.log(
              "Complete profile loaded for switched user:",
              completeUser.blockedUsers
            );
            setCurrentUser(completeUser);
          }

          setConversations([]);
          setActiveChat(null);
          setOnlineUsers(new Set());
          setError("");
          return session;
        }
        throw new Error("Failed to switch user session");
      } catch (error) {
        console.error("Switch user error:", error);
        setError(error.message || "Failed to switch user");
        throw error;
      }
    },
    [fetchCompleteUserProfile]
  );

  // Update conversations
  const updateConversations = useCallback((newConversations) => {
    setConversations(newConversations);
  }, []);

  // Add or update a single conversation
  const updateConversation = useCallback((updatedConversation) => {
    setConversations((prevConversations) => {
      const existingIndex = prevConversations.findIndex(
        (conv) => conv._id === updatedConversation._id
      );

      if (existingIndex >= 0) {
        const updated = [...prevConversations];
        updated[existingIndex] = updatedConversation;
        return updated;
      } else {
        return [updatedConversation, ...prevConversations];
      }
    });
  }, []);

  // Add this method in UserProvider:
  const verifyEmail = useCallback(async (email, token = null, code = null) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await authService.verifyEmail(email, token, code);

      if (response.success) {
        if (response.user && response.accessToken) {
          // User is now verified and logged in
          setCurrentUser(response.user);
          return response;
        } else {
          return {
            success: true,
            message: response.message || "Email verified successfully",
          };
        }
      } else {
        throw new Error(response.message || "Email verification failed");
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setError(error.message || "Email verification failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await authService.resendVerification(email);

      if (response.success) {
        return {
          success: true,
          message: response.message || "Verification email sent",
        };
      } else {
        throw new Error(response.message || "Failed to resend verification");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setError(error.message || "Failed to resend verification");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Remove a conversation
  const removeConversation = useCallback((conversationId) => {
    setConversations((prevConversations) =>
      prevConversations.filter((conv) => conv._id !== conversationId)
    );

    setActiveChat((prevActive) =>
      prevActive?._id === conversationId ? null : prevActive
    );
  }, []);

  // Update online users
  const updateOnlineUsers = useCallback((onlineUserIds) => {
    setOnlineUsers(new Set(onlineUserIds));
  }, []);

  // Update a specific user's online status
  const updateUserOnlineStatus = useCallback((userId, isOnline) => {
    setOnlineUsers((prevOnlineUsers) => {
      const newOnlineUsers = new Set(prevOnlineUsers);
      if (isOnline) {
        newOnlineUsers.add(userId);
      } else {
        newOnlineUsers.delete(userId);
      }
      return newOnlineUsers;
    });
  }, []);

  // Set active chat
  const setActiveChatHandler = useCallback((chat) => {
    setActiveChat(chat);
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError("");
    setIsError(false);
  }, []);

  // Refresh session info
  const refreshSessionInfo = useCallback(() => {
    setSessionInfo({
      isValid: authService.isAuthenticated(),
      timeUntilExpiry: authService.getTimeUntilExpiry(),
      availableSessions: authService.getAvailableSessions(),
    });
  }, []);

  // Inside UserProvider before returning value
  const completeLogin = useCallback(({ user, accessToken, refreshToken }) => {
    setSessionInfo({
      isValid: authService.isAuthenticated(),
      timeUntilExpiry: authService.getTimeUntilExpiry(),
      availableSessions: authService.getAvailableSessions(),
    });

    // Update context state
    setCurrentUser(user);
    setError("");
  }, []);

  // Extend session
  const extendSession = useCallback(() => {
    authService.extendSession();
    refreshSessionInfo();
  }, [refreshSessionInfo]);

  // Context value
  const value = {
    // User state
    currentUser,
    setCurrentUser,
    isLoading,
    setIsLoading,
    isError,
    error,
    setError,
    setIsError,
    clearError,
    completeLogin,

    // Session state
    sessionInfo,
    refreshSessionInfo,
    extendSession,

    // Conversations state
    conversations,
    activeChat,
    onlineUsers,

    // UI state
    isDark,
    setIsDark,

    // User actions
    updateUserProfile,
    loginUser,
    registerUser,
    requestPasswordReset,
    resetPassword,
    logoutUser,
    logoutAllDevices,
    switchUser,
    fetchCompleteUserProfile,
    popupAlert,
    setPopupAlert,

    // Conversation actions
    updateConversations,
    updateConversation,
    removeConversation,
    setActiveChat: setActiveChatHandler,

    // Online users actions
    updateOnlineUsers,
    updateUserOnlineStatus,

    verifyEmail,
    resendVerification,

    // UI actions
    toggleDarkMode,

    // Auth utilities
    isAuthenticated: () => authService.isAuthenticated(),
    getTimeUntilExpiry: () => authService.getTimeUntilExpiry(),
    getAvailableSessions: () => authService.getAvailableSessions(),
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
