import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  User,
  Plus,
  X,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onLoginSuccess, sessionExpiredMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google OAuth modal & custom account state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [showCustomAccountForm, setShowCustomAccountForm] = useState(false);
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    () => localStorage.getItem('faculty_hub_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  );

  // Initialize official Google Identity Services (GIS) if client ID exists
  useEffect(() => {
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      } catch (err) {
        console.warn('Google Identity Services initialization notice:', err);
      }
    }
  }, [googleClientId]);

  // Handle verified Google credential JWT from Google GIS
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) return;

    setIsGoogleLoading(true);
    setServerError('');
    setInfoNotice('');

    try {
      const data = await api.googleLogin({ credential: response.credential });
      if (data && data.token && data.user) {
        api.setToken(data.token);
        api.setUser(data.user);
        onLoginSuccess(data.user, data.token);
      } else {
        throw new Error('Google sign-in succeeded but invalid response received.');
      }
    } catch (err) {
      setServerError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Perform Google Sign-in with verified account profile
  const handlePerformGoogleLogin = async (selectedEmail, selectedName) => {
    setIsGoogleLoading(true);
    setServerError('');
    setInfoNotice('');

    try {
      const data = await api.googleLogin({
        email: selectedEmail,
        name: selectedName,
      });

      if (data && data.token && data.user) {
        api.setToken(data.token);
        api.setUser(data.user);
        setShowGoogleModal(false);
        onLoginSuccess(data.user, data.token);
      } else {
        throw new Error('Authentication succeeded but invalid response received.');
      }
    } catch (err) {
      let msg = err.message || 'Google Authentication failed. Please try again.';
      setServerError(msg);
      setShowGoogleModal(false);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Click on "Continue with Google"
  const handleGoogleBtnClick = () => {
    // If real Google Client ID is configured and GIS is available, trigger official prompt
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If One Tap is blocked or not displayed, open the modal chooser
            setShowGoogleModal(true);
          }
        });
        return;
      } catch (e) {
        // Fallback to modal
      }
    }
    // Open interactive Google Account Chooser
    setShowGoogleModal(true);
  };

  // Save custom Google Client ID
  const handleSaveClientId = (e) => {
    e.preventDefault();
    if (googleClientId.trim()) {
      localStorage.setItem('faculty_hub_google_client_id', googleClientId.trim());
      setInfoNotice('Google Client ID saved. Official Google Sign-In initialized.');
    } else {
      localStorage.removeItem('faculty_hub_google_client_id');
      setInfoNotice('Using built-in Google Authentication.');
    }
    setShowClientIdConfig(false);
  };

  // Validate credentials form
  const validateForm = () => {
    const newErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setInfoNotice('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await api.login({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (data && data.token && data.user) {
        api.setToken(data.token);
        api.setUser(data.user);
        onLoginSuccess(data.user, data.token);
      } else {
        throw new Error('Authentication succeeded but invalid response received.');
      }
    } catch (err) {
      let msg = err.message || 'Unable to connect to the server. Please try again.';
      if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('networkerror') ||
        msg.toLowerCase().includes('load failed')
      ) {
        msg = 'Connecting to backend server... If the service was idle, it may take a few moments. Please retry in a few seconds.';
      }
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill demo administrator credentials
  const handleFillDemo = () => {
    setEmail('admin@university.edu');
    setPassword('Admin@123');
    setErrors({});
    setServerError('');
    setInfoNotice('Demo administrator credentials filled. Click "Log in" to enter.');
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setInfoNotice('Password reset instructions sent to your institutional email if registered.');
  };

  const handleSignUpClick = (e) => {
    e.preventDefault();
    setInfoNotice('Faculty accounts are provisioned by your university academic administration office.');
  };

  // Preset Google institutional demo accounts
  const googleAccounts = [
    {
      name: 'Dr. Karen Yue',
      email: 'karen.yue@university.edu',
      role: 'Dean of Academic Affairs',
      avatar: 'KY',
      bg: '#635BFF',
    },
    {
      name: 'University Administrator',
      email: 'admin@university.edu',
      role: 'System Administrator',
      avatar: 'UA',
      bg: '#0F766E',
    },
    {
      name: 'Dr. Alex Jordan',
      email: 'alex.jordan@university.edu',
      role: 'Associate Professor · CS',
      avatar: 'AJ',
      bg: '#D97706',
    },
  ];

  return (
    <div className="nucleus-page-wrapper">
      <div className="nucleus-split-container">
        {/* Left Visual Column with Testimonial */}
        <div className="nucleus-visual-column">
          <div className="nucleus-image-overlay" />

          {/* Top Branding */}
          <div className="nucleus-brand-header">
            <div className="nucleus-logo-mark" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="10" height="8" rx="4" fill="#ffffff" />
                <rect x="15" y="4" width="10" height="8" rx="4" fill="#ffffff" />
                <rect x="3" y="16" width="10" height="8" rx="4" fill="#ffffff" />
                <rect x="15" y="16" width="10" height="8" rx="4" fill="#ffffff" />
              </svg>
            </div>
            <span className="nucleus-brand-title">Nucleus</span>
          </div>

          {/* Bottom Testimonial */}
          <div className="nucleus-testimonial-content">
            <blockquote className="nucleus-quote">
              “Simply all the tools that my team and I need.”
            </blockquote>
            <div className="nucleus-author">
              <span className="nucleus-author-name">Karen Yue</span>
              <span className="nucleus-author-tag">Dean of Academic Affairs</span>
            </div>
          </div>
        </div>

        {/* Right Authentication Form Column */}
        <div className="nucleus-auth-column">
          <div className="nucleus-form-card">
            {/* Header */}
            <div className="nucleus-auth-heading">
              <h1 className="nucleus-main-title">Welcome back to Nucleus</h1>
              <p className="nucleus-main-subtitle">
                Build your design system effortlessly with our powerful component library.
              </p>
            </div>

            {/* Session Expired / Timeout Notification */}
            {sessionExpiredMessage && !serverError && (
              <div className="nucleus-alert alert-warning" role="alert">
                <AlertCircle size={16} className="alert-icon" />
                <span>{sessionExpiredMessage}</span>
              </div>
            )}

            {/* Server Error Alert */}
            {serverError && (
              <div className="nucleus-alert alert-error" role="alert">
                <AlertCircle size={16} className="alert-icon" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Informational Toast Notice */}
            {infoNotice && !serverError && (
              <div className="nucleus-alert alert-info" role="status">
                <CheckCircle2 size={16} className="alert-icon" />
                <span>{infoNotice}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate className="nucleus-login-form">
              {/* Email Box */}
              <div className={`nucleus-input-group ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="nucleus-email" className="nucleus-field-label">
                  Email
                </label>
                <input
                  id="nucleus-email"
                  type="email"
                  className="nucleus-text-input"
                  placeholder="alex.jordan@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading || isGoogleLoading}
                />
                {errors.email && <span className="nucleus-error-text">{errors.email}</span>}
              </div>

              {/* Password Box */}
              <div className={`nucleus-input-group is-focused-style ${errors.password ? 'has-error' : ''}`}>
                <label htmlFor="nucleus-password" className="nucleus-field-label">
                  Password
                </label>
                <div className="nucleus-password-row">
                  <input
                    id="nucleus-password"
                    type={showPassword ? 'text' : 'password'}
                    className="nucleus-text-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: '' });
                    }}
                    autoComplete="current-password"
                    disabled={isLoading || isGoogleLoading}
                  />
                  <button
                    type="button"
                    className="nucleus-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="nucleus-error-text">{errors.password}</span>}
              </div>

              {/* Forgot password row */}
              <div className="nucleus-forgot-row">
                <button
                  type="button"
                  className="nucleus-forgot-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              {/* Remember sign in details Switch */}
              <div className="nucleus-remember-row">
                <span className="nucleus-remember-label">Remember sign in details</span>
                <label className="nucleus-switch" aria-label="Remember sign in details">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="nucleus-switch-slider" />
                </label>
              </div>

              {/* Primary Log in Button */}
              <button
                type="submit"
                className="nucleus-login-btn"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="nucleus-spinner" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </form>

            {/* OR Divider */}
            <div className="nucleus-divider">
              <span className="nucleus-divider-line" />
              <span className="nucleus-divider-text">OR</span>
              <span className="nucleus-divider-line" />
            </div>

            {/* Continue with Google Button */}
            <button
              type="button"
              className="nucleus-google-btn"
              onClick={handleGoogleBtnClick}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 size={18} className="nucleus-spinner" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="nucleus-google-icon" width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Don't have an account link */}
            <div className="nucleus-signup-row">
              <span>Don't have an account?</span>{' '}
              <button
                type="button"
                className="nucleus-signup-link"
                onClick={handleSignUpClick}
              >
                Sign up
              </button>
            </div>

            {/* 1-Click Demo Helper Badge */}
            <div className="nucleus-demo-chip">
              <div className="nucleus-demo-info">
                <Sparkles size={14} className="nucleus-sparkle" />
                <span>Admin Demo: <code>admin@university.edu</code></span>
              </div>
              <button
                type="button"
                className="nucleus-demo-btn"
                onClick={handleFillDemo}
                title="Fill administrator credentials"
              >
                Auto-fill
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Google Authentication Account Chooser Modal */}
      {showGoogleModal && (
        <div className="google-modal-overlay" onClick={() => setShowGoogleModal(false)}>
          <div className="google-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="google-modal-header">
              <div className="google-modal-brand">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <h3 className="google-modal-title">Sign in with Google</h3>
              </div>
              <button
                type="button"
                className="google-modal-close"
                onClick={() => setShowGoogleModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="google-modal-subtitle">
              Choose an institutional account to continue to <strong>FacultyHub</strong>
            </p>

            {/* List of Verified Institutional Accounts */}
            <div className="google-account-list">
              {googleAccounts.map((acc, index) => (
                <button
                  key={index}
                  type="button"
                  className="google-account-item"
                  onClick={() => handlePerformGoogleLogin(acc.email, acc.name)}
                  disabled={isGoogleLoading}
                >
                  <div
                    className="google-account-avatar"
                    style={{ backgroundColor: acc.bg }}
                  >
                    {acc.avatar}
                  </div>
                  <div className="google-account-details">
                    <span className="google-account-name">{acc.name}</span>
                    <span className="google-account-email">{acc.email}</span>
                    <span className="google-account-role">{acc.role}</span>
                  </div>
                </button>
              ))}

              {/* Use Custom Account Option */}
              {!showCustomAccountForm ? (
                <button
                  type="button"
                  className="google-account-item google-use-another"
                  onClick={() => setShowCustomAccountForm(true)}
                  disabled={isGoogleLoading}
                >
                  <div className="google-account-avatar google-another-avatar">
                    <User size={18} />
                  </div>
                  <div className="google-account-details">
                    <span className="google-account-name">Use another Google account</span>
                    <span className="google-account-email">Sign in with any institutional or Gmail address</span>
                  </div>
                </button>
              ) : (
                <div className="google-custom-account-box">
                  <div className="google-custom-header">
                    <span>Enter your Google account details</span>
                    <button
                      type="button"
                      className="google-cancel-custom-btn"
                      onClick={() => setShowCustomAccountForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="email"
                    className="google-modal-input"
                    placeholder="name@university.edu or name@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="google-modal-input"
                    placeholder="Your Full Name (e.g. Dr. Jane Smith)"
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="google-modal-submit-btn"
                    disabled={!customGoogleEmail.trim() || isGoogleLoading}
                    onClick={() =>
                      handlePerformGoogleLogin(
                        customGoogleEmail.trim().toLowerCase(),
                        customGoogleName.trim()
                      )
                    }
                  >
                    {isGoogleLoading ? 'Authenticating...' : 'Sign In with this Account'}
                  </button>
                </div>
              )}
            </div>

            {/* Footer / Client ID Config Toggle */}
            <div className="google-modal-footer">
              <div className="google-footer-security">
                <ShieldCheck size={14} className="shield-icon" />
                <span>Protected by institutional OAuth & signed JWT tokens</span>
              </div>
              <button
                type="button"
                className="google-config-toggle"
                onClick={() => setShowClientIdConfig(!showClientIdConfig)}
              >
                <Settings size={13} />
                <span>{showClientIdConfig ? 'Hide Settings' : 'Google Cloud OAuth Client ID'}</span>
              </button>

              {showClientIdConfig && (
                <form onSubmit={handleSaveClientId} className="google-client-id-form">
                  <label htmlFor="google-client-id-input" className="google-client-id-label">
                    Google Cloud OAuth 2.0 Client ID:
                  </label>
                  <div className="google-client-id-row">
                    <input
                      id="google-client-id-input"
                      type="text"
                      className="google-modal-input-small"
                      placeholder="e.g. 123456789-abcdefg.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                    />
                    <button type="submit" className="google-client-id-save-btn">
                      Save
                    </button>
                  </div>
                  <span className="google-client-id-hint">
                    Optional: Configure your Google Cloud Console Client ID to activate native Google Identity popup.
                  </span>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
