import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GraduationCap, ShieldCheck, Eye, EyeOff, AlertCircle, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail, ADMIN_EMAIL_LIST } from '../config/adminEmails';

type UserType = 'student' | 'teacher';
type AuthMode = 'login' | 'signup';

// ── Google "G" SVG icon ───────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [userType, setUserType] = useState<UserType>('student');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Shown after Google sign-in if the student is new and hasn't set enrollment no. yet
  const [showEnrollmentPrompt, setShowEnrollmentPrompt] = useState(false);
  const [pendingEnrollment, setPendingEnrollment]       = useState('');
  const [pendingGoogleRole, setPendingGoogleRole]       = useState<UserType>('student');

  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', enrollmentNumber: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  // ── Email/password submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (userType === 'teacher' && !isAdminEmail(formData.email)) {
      setError('This email is not on the authorized teacher list.');
      return;
    }
    if (userType === 'student' && authMode === 'signup' && !formData.enrollmentNumber.trim()) {
      setError('Enrollment number is required for student registration.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signup') {
        if (!formData.fullName.trim()) { setError('Full name is required.'); return; }
        await signUp(formData.email, formData.password, formData.fullName, userType,
          userType === 'student' ? formData.enrollmentNumber : undefined);
      } else {
        await signIn(formData.email, formData.password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google sign-in ────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');

    // Teachers can sign in with Google directly (no enrollment number needed)
    if (userType === 'teacher') {
      setGoogleLoading(true);
      try {
        await signInWithGoogle('teacher');
        navigate('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    // Students: attempt Google sign-in
    setGoogleLoading(true);
    try {
      const { isNewUser } = await signInWithGoogle('student');
      if (isNewUser) {
        // New student via Google — need to collect enrollment number
        setPendingGoogleRole('student');
        setShowEnrollmentPrompt(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Save enrollment number after Google signup ────────────────────────────
  const handleEnrollmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pendingEnrollment.trim()) {
      setError('Enrollment number is required.');
      return;
    }
    setLoading(true);
    try {
      // Re-run signInWithGoogle now with enrollment number to save profile
      await signInWithGoogle(pendingGoogleRole, pendingEnrollment.trim());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save enrollment number.');
    } finally {
      setLoading(false);
    }
  };

  const switchUserType = (type: UserType) => {
    setUserType(type);
    setError('');
    setFormData({ email: '', password: '', fullName: '', enrollmentNumber: '' });
    setShowEnrollmentPrompt(false);
  };

  const switchMode = () => {
    setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
    setError('');
    setFormData({ email: '', password: '', fullName: '', enrollmentNumber: '' });
  };

  const isStudent = userType === 'student';

  // ── Enrollment number prompt (shown after first Google sign-in) ───────────
  if (showEnrollmentPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
        style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-2xl">
              <Hash className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">One more step</h1>
          <p className="text-center text-gray-500 text-sm mb-8">
            Enter your enrollment number to complete your student registration.
            This must be unique — it identifies you across the system.
          </p>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleEnrollmentSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Enrollment Number
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={pendingEnrollment}
                  onChange={e => { setPendingEnrollment(e.target.value); setError(''); }}
                  placeholder="e.g. EN2024001"
                  className="field-input pl-9"
                  required autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Must be unique — no two students can share an enrollment number.</p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-all flex items-center justify-center gap-2">
              {loading ? <><Spinner /> Saving...</> : 'Complete Registration'}
            </button>
          </form>
        </div>
        <style>{fieldStyle}</style>
      </div>
    );
  }

  // ── Main login page ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-12 text-white relative overflow-hidden"
        style={{
          background: isStudent
            ? 'linear-gradient(145deg,#1e40af 0%,#0ea5e9 50%,#10b981 100%)'
            : 'linear-gradient(145deg,#065f46 0%,#10b981 50%,#0ea5e9 100%)',
          transition: 'background 0.5s ease',
        }}>
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'white', transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'white', transform: 'translate(-40%,40%)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">VoiceAssess</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            {isStudent ? 'Track your pronunciation journey' : "Monitor every student's progress"}
          </h2>
          <p className="text-white text-opacity-80 text-lg leading-relaxed">
            {isStudent
              ? 'Practice, get assessed, and see how your speaking skills improve over time.'
              : 'View detailed assessments, manage classes, and guide students toward fluency.'}
          </p>
          <div className="mt-10 space-y-4">
            {isStudent ? (
              <>
                <Feature icon="🎙️" text="Real-time pronunciation scoring" />
                <Feature icon="📈" text="Personal progress dashboard" />
                <Feature icon="🔊" text="Speaker verification" />
              </>
            ) : (
              <>
                <Feature icon="📊" text="Full student progress overview" />
                <Feature icon="🏫" text="Class & enrollment management" />
                <Feature icon="🔒" text="Authorized teacher access only" />
              </>
            )}
          </div>
        </div>

        <div className="relative z-10 text-sm text-white text-opacity-60">
          Automatic Pronunciation Assessment System • Child Speaker Verification
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Student / Teacher toggle */}
          <div className="flex bg-white rounded-2xl p-1.5 shadow-md mb-8 border border-gray-100">
            <button onClick={() => switchUserType('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                isStudent ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <GraduationCap className="w-4 h-4" /> Student
            </button>
            <button onClick={() => switchUserType('teacher')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                !isStudent ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <ShieldCheck className="w-4 h-4" /> Teacher / Admin
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {authMode === 'login' ? 'Welcome back' : 'Create account'}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {isStudent
                  ? authMode === 'login' ? 'Sign in to your student account' : 'Register with your enrollment number'
                  : authMode === 'login' ? 'Sign in with your authorized teacher email' : 'Register — email must be on the approved list'}
              </p>
            </div>

            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex gap-3 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            {/* ── Google sign-in button ── */}
            <button onClick={handleGoogleSignIn} disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 font-semibold text-gray-700 text-sm transition-all mb-4 disabled:opacity-50">
              {googleLoading ? <Spinner /> : <GoogleIcon />}
              {googleLoading ? 'Connecting...' : `Continue with Google`}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or use email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* ── Email/password form ── */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <Field label="Full Name">
                  <input name="fullName" type="text" value={formData.fullName}
                    onChange={handleChange} placeholder="Your full name"
                    className="field-input" required />
                </Field>
              )}

              <Field label="Email Address">
                <input name="email" type="email" value={formData.email}
                  onChange={handleChange}
                  placeholder={isStudent ? 'student@school.edu' : 'teacher@school.edu'}
                  className="field-input" required />
              </Field>

              {/* Enrollment number — students only, signup only */}
              {isStudent && authMode === 'signup' && (
                <Field label="Enrollment Number">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input name="enrollmentNumber" type="text" value={formData.enrollmentNumber}
                      onChange={handleChange} placeholder="e.g. EN2024001"
                      className="field-input pl-9" required />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Must be unique across all students.</p>
                </Field>
              )}

              <Field label="Password">
                <div className="relative">
                  <input name="password" type={showPassword ? 'text' : 'password'}
                    value={formData.password} onChange={handleChange}
                    placeholder="••••••••" className="field-input pr-10"
                    required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {!isStudent && authMode === 'signup' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <strong>Authorized emails:</strong>{' '}
                  {ADMIN_EMAIL_LIST.slice(0, 3).join(', ')}{ADMIN_EMAIL_LIST.length > 3 ? ', ...' : ''}
                </div>
              )}

              <button type="submit" disabled={loading || googleLoading}
                className={`w-full mt-2 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md ${
                  isStudent
                    ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                }`}>
                {loading ? <><Spinner />{authMode === 'login' ? 'Signing in...' : 'Creating account...'}</> 
                  : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <button onClick={switchMode} className="text-sm text-gray-500 hover:text-gray-800 transition">
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">Voice Assessment System · Secure Login</p>
        </div>
      </div>

      <style>{fieldStyle}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fieldStyle = `
  .field-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1.5px solid #e5e7eb;
    border-radius: 0.75rem;
    outline: none;
    font-size: 0.9rem;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #fafafa;
  }
  .field-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
    background: white;
  }
`;

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-white text-opacity-90 text-sm font-medium">{text}</span>
    </div>
  );
}
