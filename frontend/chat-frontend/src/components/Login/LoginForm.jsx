// components/LoginForm.js - CLEANED VERSION
import React, { useState } from "react";
import {
  MessageSquare,
  Sun,
  Moon,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Phone,
  Users,
  MailIcon,
} from "lucide-react";
import { ArrowLeft, Send } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import sessionManager from "../../utils/sessionManager";
import { useEffect } from "react";

const LoginForm = ({ onLogin, isDark, setIsDark, showVerificationAlert }) => {
  const { registerUser, sessionInfo, requestPasswordReset, resetPassword, completeLogin, verifyEmail, resendVerification } =
    useUser();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState("login");

  // Simplified verification form state (token only, no code)
  const [verificationForm, setVerificationForm] = useState({
    email: "",
    token: "", // Hidden from user
  });

  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    email: "",
  });

  // Simplified reset form (no token display)
  const [resetPasswordForm, setResetPasswordForm] = useState({
    token: "", // Hidden from user, auto-filled from URL
    newPassword: "",
    confirmPassword: "",
  });

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    bio: "",
  });

  // Helper function to clear URL parameters
  const clearUrlParams = () => {
    const url = new URL(window.location);
    url.search = '';
    window.history.replaceState({}, '', url);
  };

  useEffect(() => {
    // Check URL parameters for different authentication flows
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get("resetToken");
    const verifyToken = urlParams.get("verifyToken");
    const email = urlParams.get("email");
    
    // Legacy support for generic "token" parameter
    const genericToken = urlParams.get("token");
    
    if (resetToken || (genericToken && window.location.pathname.includes('reset'))) {
      // Password reset flow - auto-fill token but don't display it
      console.log("🔄 Detected password reset flow");
      setMode("resetPassword");
      setResetPasswordForm((prev) => ({
        ...prev,
        token: resetToken || genericToken, // Hidden from user
      }));
      if (email) {
        setForgotPasswordForm((prev) => ({
          ...prev,
          email: email,
        }));
      }
    } else if (verifyToken || (genericToken && window.location.pathname.includes('verify'))) {
      // Email verification flow - auto-fill token but don't display it
      console.log("✉️ Detected email verification flow");
      setMode("emailVerification");
      setVerificationForm((prev) => ({
        ...prev,
        token: verifyToken || genericToken, // Hidden from user
        email: email || "",
      }));
    } else if (genericToken) {
      // Fallback: try to determine from URL context
      if (window.location.search.includes('reset') || window.location.hash.includes('reset')) {
        setMode("resetPassword");
        setResetPasswordForm((prev) => ({
          ...prev,
          token: genericToken, // Hidden from user
        }));
      } else {
        setMode("emailVerification");
        setVerificationForm((prev) => ({
          ...prev,
          token: genericToken, // Hidden from user
          email: email || "",
        }));
      }
    }
  }, []);

  // Available sessions for switching
  const availableSessions = sessionInfo.availableSessions || {};
  const hasAvailableSessions = Object.keys(availableSessions).length > 0;

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    if (!phone.trim()) return true;
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone.length >= 7 && cleanPhone.length <= 15;
  };

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers,
      minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
    };
  };

  const validateLoginForm = () => {
    if (!loginForm.email.trim()) {
      setError("Email is required");
      return false;
    }

    if (!loginForm.password.trim()) {
      setError("Password is required");
      return false;
    }

    if (!validateEmail(loginForm.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    return true;
  };

  const validateSignupForm = () => {
    if (!signupForm.name.trim()) {
      setError("Full name is required");
      return false;
    }

    if (!signupForm.email.trim()) {
      setError("Email is required");
      return false;
    }

    if (!signupForm.password.trim()) {
      setError("Password is required");
      return false;
    }

    if (!signupForm.confirmPassword.trim()) {
      setError("Password confirmation is required");
      return false;
    }

    if (!validateEmail(signupForm.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    if (!validatePhone(signupForm.phone)) {
      setError("Please enter a valid phone number");
      return false;
    }

    const passwordValidation = validatePassword(signupForm.password);
    if (!passwordValidation.isValid) {
      setError("Password must be at least 6 characters long");
      return false;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const validateForgotPasswordForm = () => {
    if (!forgotPasswordForm.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!validateEmail(forgotPasswordForm.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const validateResetPasswordForm = () => {
    if (!resetPasswordForm.newPassword.trim()) {
      setError("New password is required");
      return false;
    }
    const passwordValidation = validatePassword(resetPasswordForm.newPassword);
    if (!passwordValidation.isValid) {
      setError(
        "Password must be at least 8 characters with uppercase, lowercase, and numbers"
      );
      return false;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  // Simplified verification form validation (no code)
  const validateVerificationForm = () => {
    if (!verificationForm.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!validateEmail(verificationForm.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  // Simplified verification submit (token auto-filled from URL)
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!validateVerificationForm()) {
      setLoading(false);
      return;
    }

    try {
      const response = await verifyEmail(
        verificationForm.email,
        verificationForm.token, // Auto-filled from URL
        null // No code
      );

      if (response.success) {
        clearUrlParams(); // Clear URL parameters
        if (response.user && response.accessToken) {
          // User is now verified and logged in
          setSuccess("Email verified successfully! You are now logged in.");
          await completeLogin({
            success: true,
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
        } else {
          setSuccess("Email verified successfully! You can now sign in.");
          setMode("login");
          resetForms();
        }
      }
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationForm.email.trim()) {
      setError("Email is required to resend verification");
      return;
    }

    setLoading(true);
    try {
      await resendVerification(verificationForm.email);
      setSuccess("Verification email sent! Please check your inbox.");
    } catch (err) {
      setError(err.message || "Failed to resend verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!validateLoginForm()) {
      setLoading(false);
      return;
    }

    try {
      clearUrlParams(); // Clear URL parameters on successful login
      console.log("Im submitting for a login");
      await onLogin(loginForm);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

const handleSignupSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  setSuccess("");

  if (!validateSignupForm()) {
    setLoading(false);
    return;
  }

  try {
    const { confirmPassword, ...signupData } = signupForm;
    const response = await registerUser(signupData);
    console.log("Showing signup");

    if (response.emailVerificationRequired) {
      setSuccess(
        "Account created! Please check your email for verification instructions."
      );
      showVerificationAlert(true);
      console.log("Showing popup");
      setMode("emailVerification");
      setVerificationForm((prev) => ({ ...prev, email: signupData.email }));
      
      // Return response so parent can handle popup
      return response;
    } else {
      clearUrlParams(); // Clear URL parameters on successful signup
      setSuccess("Account created successfully! You are now signed in.");
    }
  } catch (err) {
    setError(err.message || "Registration failed");
  } finally {
    setLoading(false);
  }
};

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!validateForgotPasswordForm()) {
      setLoading(false);
      return;
    }

    try {
      await requestPasswordReset(forgotPasswordForm.email);
      setSuccess(
        "Reset instructions sent to your email. Please check your inbox."
      );
      setMode("resetPassword");
    } catch (err) {
      setError(
        err.message || "Failed to send reset instructions. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!validateResetPasswordForm()) {
      setLoading(false);
      return;
    }

    try {
      await resetPassword(
        resetPasswordForm.token, // Auto-filled from URL
        resetPasswordForm.newPassword
      );
      clearUrlParams(); // Clear URL parameters after successful reset
      setSuccess(
        "Password reset successfully! Please sign in with your new password."
      );
      setMode("login");
      resetForms();
    } catch (err) {
      setError(
        err.message ||
          "Failed to reset password. Please try again or request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle switching to existing session
  const handleSwitchToSession = async (userId) => {
    try {
      setLoading(true);
      setError("");

      const session = sessionManager.switchToUser(userId);
      if (session) {
        clearUrlParams(); // Clear URL parameters when switching sessions
        await onLogin({
          success: true,
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        });
      }
    } catch (error) {
      setError(error.message || "Failed to switch session");
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setLoginForm({ email: "", password: "" });
    setSignupForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      bio: "",
    });
    setVerificationForm({
      email: "",
      token: "",
    });
    setForgotPasswordForm({
      email: "",
    });
    setResetPasswordForm({
      token: "",
      newPassword: "",
      confirmPassword: "",
    });
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setIsLogin(newMode === "login");
    resetForms();
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        isDark ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <div
        className={`w-full max-w-md p-8 rounded-2xl shadow-2xl transition-all duration-300 ${
          isDark ? "bg-gray-800 text-white" : "bg-white"
        }`}
      >
        <h1 className="text-2xl font-bold mb-2 text-center">
          {mode === "login"
            ? "Welcome Back!"
            : mode === "signup"
            ? "Join ChatApp"
            : mode === "forgotPassword"
            ? "Forgot Password"
            : mode === "resetPassword"
            ? "Reset Password"
            : mode === "emailVerification"
            ? "Verify Your Email"
            : "ChatApp"}
        </h1>
        <p className="text-gray-500">
          {mode === "login"
            ? "Sign in to continue messaging"
            : mode === "signup"
            ? "Create your account to get started"
            : mode === "forgotPassword"
            ? "Enter your email to receive reset instructions"
            : mode === "resetPassword"
            ? "Enter your new password"
            : mode === "emailVerification"
            ? "Click the link in your email to verify your account"
            : ""}
        </p>

        {/* Available Sessions */}
        {hasAvailableSessions && mode === "login" && (
          <div className="mb-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Continue as existing user
            </div>
            <div className="space-y-2">
              {Object.entries(availableSessions).map(([userId, session]) => (
                <button
                  key={userId}
                  onClick={() => handleSwitchToSession(userId)}
                  disabled={loading}
                  className={`w-full p-3 rounded-lg border transition-all flex items-center space-x-3 ${
                    isDark
                      ? "border-gray-600 hover:border-gray-500 hover:bg-gray-700"
                      : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {session.user.avatar ||
                        session.user.name?.charAt(0) ||
                        "?"}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{session.user.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last active:{" "}
                      {new Date(session.lastActive).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="my-4 flex items-center">
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              <span className="px-3 text-sm text-gray-500 dark:text-gray-400">
                or
              </span>
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-100 border border-green-300 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Login Form */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Email address"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMode("forgotPassword")}
              className="text-sm text-blue-500 hover:text-blue-600"
              disabled={loading}
            >
              Forgot your password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Full name"
                value={signupForm.name}
                onChange={(e) =>
                  setSignupForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Email"
                value={signupForm.email}
                onChange={(e) =>
                  setSignupForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                placeholder="Phone number (optional)"
                value={signupForm.phone}
                onChange={(e) =>
                  setSignupForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={signupForm.password}
                onChange={(e) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={signupForm.confirmPassword}
                onChange={(e) =>
                  setSignupForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <textarea
              placeholder="Bio (optional)"
              value={signupForm.bio}
              onChange={(e) =>
                setSignupForm((prev) => ({ ...prev, bio: e.target.value }))
              }
              rows={3}
              className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none ${
                isDark
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-gray-50 border-gray-300"
              }`}
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}

        {/* Email Verification Form - SIMPLIFIED (no code input) */}
        {mode === "emailVerification" && (
          <form onSubmit={handleVerificationSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Enter your email address"
                value={verificationForm.email}
                onChange={(e) =>
                  setVerificationForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-blue-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="text-sm text-blue-500 hover:text-blue-600 font-medium"
              >
                {loading ? "Sending..." : "Resend verification email"}
              </button>
            </div>

            {verificationForm.token && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                <p className="text-center">
                  Verification link detected! Click "Verify Email" to complete
                  the process.
                </p>
              </div>
            )}
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === "forgotPassword" && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Enter your email address"
                value={forgotPasswordForm.email}
                onChange={(e) =>
                  setForgotPasswordForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? "Sending..." : "Send Reset Instructions"}</span>
            </button>
          </form>
        )}

        {/* Reset Password Form - SIMPLIFIED (no token display) */}
        {mode === "resetPassword" && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            {/* Token is auto-filled from URL but not displayed to user */}
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={resetPasswordForm.newPassword}
                onChange={(e) =>
                  setResetPasswordForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={resetPasswordForm.confirmPassword}
                onChange={(e) =>
                  setResetPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className={`w-full pl-10 pr-10 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Show helpful message if token is present */}
            {resetPasswordForm.token && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                <p className="text-center">
                  ✅ Reset link verified! Enter your new password above.
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        {/* Switch Mode */}
        <div className="mt-6 text-center">
          {mode === "login" ? (
            <p className="text-gray-500 text-sm">
              Don't have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-blue-500 hover:text-blue-600 font-semibold"
                disabled={loading}
              >
                Sign up
              </button>
            </p>
          ) : mode === "signup" ? (
            <p className="text-gray-500 text-sm">
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-blue-500 hover:text-blue-600 font-semibold"
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          ) : (
            <button
              onClick={() => setMode("login")}
              className="flex items-center space-x-2 text-blue-500 hover:text-blue-600 font-semibold mx-auto"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </button>
          )}
        </div>

        {/* Session Info */}
        {hasAvailableSessions && mode === "login" && (
          <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {Object.keys(availableSessions).length} saved session
            {Object.keys(availableSessions).length !== 1 ? "s" : ""} available
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isDark
              ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          disabled={loading}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default LoginForm;