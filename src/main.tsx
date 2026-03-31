import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// ── Check env vars BEFORE importing anything Firebase-related ─────────────────
// This runs synchronously at module evaluation time with zero Firebase imports.

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingKeys = REQUIRED.filter(k => {
  const v = (import.meta.env as Record<string, string>)[k];
  return !v || v.startsWith('your-') || v.includes('your-project');
});

// ── Setup screen — shown when .env is not filled in ───────────────────────────
if (missingKeys.length > 0) {
  createRoot(document.getElementById('root')!).render(
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)',
      fontFamily: "'Segoe UI',sans-serif", padding: '2rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '1rem',
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        padding: '2.5rem', maxWidth: '520px', width: '100%',
      }}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🔥</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', textAlign: 'center', margin: '0 0 0.5rem' }}>
          Firebase not configured
        </h1>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Fill in your Firebase project keys in{' '}
          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>.env</code>
          {' '}to start the app.
        </p>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            Missing / placeholder keys:
          </p>
          {missingKeys.map(k => (
            <div key={k} style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#b91c1c', padding: '2px 0' }}>
              ✗ {k}
            </div>
          ))}
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.85rem', color: '#475569' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>Steps to fix:</p>
          <ol style={{ paddingLeft: '1.2rem', lineHeight: 2, margin: 0 }}>
            <li>Go to <strong>Firebase Console</strong> → your project → <strong>Project Settings</strong></li>
            <li>Under <strong>Your apps</strong>, click the web <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>&lt;/&gt;</code> icon</li>
            <li>Copy the <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>firebaseConfig</code> values</li>
            <li>Paste into <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>.env</code> as <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>VITE_FIREBASE_*</code></li>
            <li>Restart: <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>bun run dev</code></li>
          </ol>
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          See <strong>FIREBASE_SETUP.md</strong> in the project root for full instructions.
        </p>
      </div>
    </div>
  );
} else {
  // ── Normal app boot — all Firebase imports happen lazily inside these modules ─
  const { BrowserRouter, Routes, Route, Navigate } = await import('react-router-dom');
  const { AuthProvider }    = await import('./contexts/AuthContext');
  const { ProtectedRoute }  = await import('./components/ProtectedRoute');
  const AppComp             = lazy(() => import('./App'));
  const LoginPageComp       = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
  const AdminDashboardComp  = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

  const Spinner = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <svg style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="4" />
        <path fill="#3b82f6" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/login" element={<LoginPageComp />} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboardComp /></ProtectedRoute>} />
              <Route path="/"      element={<ProtectedRoute><AppComp /></ProtectedRoute>} />
              <Route path="*"      element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  );
}
