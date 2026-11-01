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
  const [password, setPassword] = useState('demo1234');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

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
      const msg = err.message || 'Authentication failed. Please verify credentials.';
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
    <div className="min-h-screen bg-[#140F0B] flex flex-col justify-center items-center p-4 selection:bg-[#C8792C] selection:text-white font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Institutional Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[#2A1F18] font-headline font-bold text-2xl text-[#F4D9A0] border border-[rgba(244,217,160,0.3)] shadow-inner mb-1">
            LS
          </div>
          <h1 className="text-2xl font-bold font-headline tracking-wide text-[#F4D9A0]">
            LandSentinel
          </h1>
          <p className="text-xs text-[#C4B5A5] max-w-xs mx-auto leading-relaxed">
            Predictive Analytics System for Early Detection and Mitigation of Infrastructure Land Acquisition Delays
          </p>
        </div>

        {/* Mandatory Synthetic Data Notice */}
        <div className="flex justify-center">
          <SyntheticNote />
        </div>

        {/* Auth Card */}
        <div className="peace-card p-6 space-y-5">
          <div className="border-b border-[rgba(244,217,160,0.1)] pb-3">
            <h2 className="text-xs font-semibold text-[#F4D9A0] uppercase font-mono tracking-wider">
              Department Portal Sign-In
            </h2>
            <p className="text-[11px] text-[#C4B5A5] mt-0.5">
              Enter official credentials or select a fast-track evaluation officer role below
            </p>
          </div>

          {/* Error Message Box */}
          {displayError && (
            <div className="p-3 rounded bg-[#331411] border border-[#7F261E] text-[#FCA5A5] text-xs flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <span className="font-semibold block">Authentication Error</span>
                <span className="text-[11px] leading-tight text-[#FECACA]">{displayError}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Official Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="peace-input w-full"
                placeholder="officer@landsentinel.gov.in"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4B5A5] mb-1">
                Password / Secure Passcode
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="peace-input w-full"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-amber w-full py-2.5 text-xs font-medium"
            >
              {submitting ? 'Verifying Credentials...' : 'Sign In to Infrastructure Terminal'}
            </button>
          </form>

          {/* Mock Mode Shortcut Buttons */}
          {isMock && (
            <div className="pt-4 border-t border-[rgba(244,217,160,0.1)]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#C4B5A5] mb-2.5 flex items-center justify-between">
                <span>Prototype Evaluation Roles</span>
                <span className="text-[#F4D9A0]">1-Click Fast Access</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {demoUsers.map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleDemoSelect(item)}
                    className="flex items-center justify-between p-2 rounded bg-[#16100C] hover:bg-[#2A1F18] border border-[rgba(244,217,160,0.1)] hover:border-[#C8792C] transition-all text-left text-xs group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#F3EDE2]">{item.name}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#2A1F18] text-[#F4D9A0] border border-[rgba(244,217,160,0.2)] uppercase">
                          {item.district}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8E7E70] block mt-0.5">{item.desc}</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase font-semibold text-[#F4D9A0] group-hover:text-[#C8792C] shrink-0 ml-2 transition-colors">
                      Enter &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security & Audit Protocol Note & Synthetic Disclaimer */}
        <div className="space-y-3 pt-1 text-center">
          <div className="text-[10px] font-mono text-[#8E7E70] tracking-wider">
            SECURE PROTOCOL • ENCRYPTED SESSION • AUDIT LOGGED
          </div>
          <div className="flex justify-center">
            <SyntheticNote compact />
          </div>
        </div>
      </div>
    </div>
  );
}
