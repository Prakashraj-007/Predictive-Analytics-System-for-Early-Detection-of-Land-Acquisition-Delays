import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import SyntheticNote from '../components/SyntheticNote';

const isMock = import.meta.env.VITE_USE_MOCK !== 'false';

export default function Login() {
  const { login, switchDemoRole, demoUsers, authError, setAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = 'Institutional Sign In | LandSentinel';
  }, []);

  // Redirect destination after successful login
  const from = location.state?.from?.pathname || '/overview';

  const [email, setEmail] = useState('pm@landsentinel.gov.in');
  const [password, setPassword] = useState('demo123');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState(true);

  const handleProfileQuickSelect = (e) => {
    const selectedUserId = e.target.value;
    if (!selectedUserId) return;
    const matched = demoUsers.find((u) => u.user_id === selectedUserId || u.role === selectedUserId);
    if (matched) {
      setEmail(matched.email || matched.aliasEmail);
      setPassword(matched.defaultPassword || 'demo123');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (setAuthError) setAuthError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Authenticated successfully');
      navigate(from, { replace: true });
    } catch (err) {
      let msg = err.message || 'Authentication failed. Please verify credentials.';
      if (msg === 'Network Error' || err.code === 'ERR_NETWORK') {
        msg = 'Backend server on port 8000 is not reachable. To connect to the live backend, start it with: uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000';
      }
      setLocalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSelect = async (demoUser) => {
    setLocalError('');
    if (setAuthError) setAuthError(null);
    setSubmitting(true);
    try {
      await switchDemoRole(demoUser.role);
      toast.success(`Signed in as ${demoUser.name} (${demoUser.role})`);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || 'Failed to switch demo role.';
      setLocalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-center items-center p-4 selection:bg-[#C8792C] selection:text-white font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Institutional Government Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#2A1F18] to-[#1A130E] font-headline font-bold text-2xl text-[#F4D9A0] border border-[rgba(244,217,160,0.35)] shadow-lg mb-1">
            LS
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#C4B5A5]">
              Government of Tamil Nadu &bull; Land Administration
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-wide text-[#F4D9A0] mt-0.5">
              LandSentinel Console
            </h1>
          </div>
          <p className="text-xs text-[#C4B5A5] max-w-sm mx-auto leading-relaxed">
            Statutory Predictive Analytics &amp; Corridor Delay Mitigation Terminal
          </p>
        </div>

        {/* Auth Card */}
        <div className="peace-card p-6 space-y-5 shadow-2xl border border-[rgba(244,217,160,0.18)]">
          <div className="border-b border-[rgba(244,217,160,0.1)] pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider">
                Official Terminal Sign-In
              </h2>
              <p className="text-[11px] text-[#C4B5A5] mt-0.5">
                Authorized departmental personnel only
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#86EFAC] ring-4 ring-[#86EFAC]/20" title="System Online" />
          </div>

          {/* Error Message Box */}
          {displayError && (
            <div className="p-3 rounded-lg bg-[#331411] border border-[#7F261E] text-[#FCA5A5] text-xs flex items-start gap-2.5 animate-fadeIn">
              <svg className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <span className="font-semibold block">Access Verification Notice</span>
                <span className="text-[11px] leading-tight text-[#FECACA]">{displayError}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Official Department Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peace-input w-full pl-9"
                  placeholder="officer@landsentinel.gov.in"
                />
                <svg
                  className="w-4 h-4 text-[#8E7E70] absolute left-3 top-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#C4B5A5]">
                  Security Passcode
                </label>
                <span className="text-[10px] text-[#8E7E70] font-mono">
                  Standard Passcode: <code className="text-[#F4D9A0]">demo123</code>
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peace-input w-full pl-9 pr-9"
                  placeholder="••••••••••••"
                />
                <svg
                  className="w-4 h-4 text-[#8E7E70] absolute left-3 top-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-[#8E7E70] hover:text-[#F4D9A0] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#C4B5A5]">
                <input
                  type="checkbox"
                  checked={rememberTerminal}
                  onChange={(e) => setRememberTerminal(e.target.checked)}
                  className="rounded border-[rgba(244,217,160,0.3)] bg-[#201812] text-[#C8792C] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Remember this terminal</span>
              </label>
              <span className="text-[#8E7E70] text-[11px]">DPDP Act 2023 Compliant</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-amber w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Statutory Clearance...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Authenticate &amp; Enter Console</span>
                </>
              )}
            </button>
          </form>

          {/* Authorized Officer Profile Quick-Selector (Professional Auto-Fill) */}
          <div className="pt-3 border-t border-[rgba(244,217,160,0.1)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5A5]">
                Statutory Profile Auto-Fill
              </span>
              <span className="text-[10px] font-mono text-[#F4D9A0]">
                Evaluation Preset
              </span>
            </div>

            <select
              onChange={handleProfileQuickSelect}
              defaultValue=""
              className="peace-input w-full text-xs font-medium cursor-pointer"
            >
              <option value="" disabled>
                Select an authorized officer profile to auto-fill credentials...
              </option>
              {demoUsers.map((item) => (
                <option key={item.user_id || item.role} value={item.user_id || item.role}>
                  {item.name} &bull; {item.district || item.role}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Security & Audit Protocol Footer */}
        <div className="space-y-2 pt-1 text-center">
          <div className="text-[10px] font-mono text-[#8E7E70] tracking-wider">
            GOVERNMENT INTRANET &bull; ENCRYPTED TLS 1.3 &bull; AUDIT LOGGED
          </div>
          <div className="flex justify-center">
            <SyntheticNote compact />
          </div>
        </div>
      </div>
    </div>
  );
}
