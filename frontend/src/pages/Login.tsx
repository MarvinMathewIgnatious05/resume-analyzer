import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCredentials } from '../store/authSlice';
import { Mail, ShieldCheck, KeyRound, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface LoginProps {
  isVerifyMode?: boolean;
}

export default function Login({ isVerifyMode = false }: LoginProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { deviceFingerprint } = useAppSelector((state) => state.auth);

  // Form states
  const [email, setEmail] = useState(() => {
    return sessionStorage.getItem('auth_email') || '';
  });
  const [otp, setOtp] = useState('');
  const [method, setMethod] = useState<'magic-link' | 'otp'>('magic-link');
  const [step, setStep] = useState<'request' | 'verify'>(() => {
    if (isVerifyMode && searchParams.get('token')) {
      return 'verify';
    }
    return sessionStorage.getItem('auth_email') ? 'verify' : 'request';
  });
  
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle auto-verification if URL has magic link token
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && isVerifyMode) {
      handleVerifyMagicLink(token);
    }
  }, [searchParams, isVerifyMode]);

  const handleRequestAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const resp = await axios.post('http://localhost:8000/api/users/auth/request/', {
        email: cleanEmail,
        method
      });
      
      sessionStorage.setItem('auth_email', cleanEmail);
      setSuccessMsg(resp.data.detail || 'Code sent successfully!');
      if (method === 'otp') {
        setStep('verify');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication request failed. Please check rate limits.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanOtp = otp.trim();
    if (!cleanEmail) {
      setError('Email address is missing. Please try again.');
      setStep('request');
      return;
    }
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await axios.post('http://localhost:8000/api/users/auth/verify-otp/', {
        email: cleanEmail,
        otp: cleanOtp
      }, {
        headers: {
          'X-Device-Fingerprint': deviceFingerprint
        }
      });

      sessionStorage.removeItem('auth_email');
      dispatch(setCredentials(resp.data));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMagicLink = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const resp = await axios.post('http://localhost:8000/api/users/auth/verify-link/', {
        token
      }, {
        headers: {
          'X-Device-Fingerprint': deviceFingerprint
        }
      });

      dispatch(setCredentials(resp.data));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to verify magic link. It may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-12 md:mt-24 px-4">
      <div className="glass-panel p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-slate-800">
        {/* Visual Highlights */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mb-4 text-brand-400">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to Resume Analyzer</h2>
          <p className="text-sm text-slate-400 mt-2">
            {step === 'request' 
              ? 'Sign in securely with passwordless magic links or OTP verification.' 
              : 'Verifying your credentials...'}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">
            <ShieldCheck size={18} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestAuth} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg glass-input text-sm text-white"
                />
              </div>
            </div>

            {/* Method Toggle */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Verification Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('magic-link')}
                  className={`py-2 text-sm rounded-lg font-medium border transition-all ${
                    method === 'magic-link'
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Email Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('otp')}
                  className={`py-2 text-sm rounded-lg font-medium border transition-all ${
                    method === 'otp'
                      ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  One-Time Code (OTP)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-brand-600/20 transition-all"
            >
              {loading ? 'Sending Request...' : 'Request Verification'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Enter Verification Code</label>
                {email && <span className="text-xs text-brand-400 font-medium max-w-[180px] truncate">{email}</span>}
              </div>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg glass-input text-center tracking-widest text-lg text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Didn't receive code?</span>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-brand-400 hover:underline"
              >
                Try again
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-brand-600/20 transition-all"
            >
              {loading ? 'Verifying...' : 'Verify & Log In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
