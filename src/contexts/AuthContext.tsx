import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getUserProfile, saveUserProfile } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'teacher';
  enrollment_number?: string;
  age?: number;
  enrolled?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'teacher',
    enrollmentNumber?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (
    role: 'student' | 'teacher',
    enrollmentNumber?: string
  ) => Promise<{ isNewUser: boolean }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Retry up to 3 times — profile save from Google signup may still be
        // in-flight when onAuthStateChanged fires immediately after popup close.
        let profile = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            profile = await getUserProfile();
            break;
          } catch {
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 800)); // wait 800ms then retry
            }
          }
        }

        if (profile) {
          setUser({ id: firebaseUser.uid, ...profile });
        } else {
          // Profile genuinely doesn't exist yet (new Google user mid-flow)
          setUser({
            id:        firebaseUser.uid,
            full_name: firebaseUser.displayName ?? '',
            email:     firebaseUser.email ?? '',
            role:      'student',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Email/password signup ───────────────────────────────────────────────────
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'student' | 'teacher',
    enrollmentNumber?: string
  ) => {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(fbUser, { displayName: fullName });
    // Saves to MongoDB — backend enforces enrollment_number uniqueness
    await saveUserProfile({ full_name: fullName, email, role, enrollment_number: enrollmentNumber });
  };

  // ── Email/password login ────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // ── Google sign-in ──────────────────────────────────────────────────────────
  // Returns { isNewUser: true } if this is a first-time Google login so the
  // UI can prompt for enrollment number before saving the profile.
  const signInWithGoogle = async (
    role: 'student' | 'teacher',
    enrollmentNumber?: string
  ): Promise<{ isNewUser: boolean }> => {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    // Force-refresh the ID token so authHeader() works immediately after popup
    await fbUser.getIdToken(true);

    // Check if a profile already exists in MongoDB
    let existingProfile = null;
    try {
      existingProfile = await getUserProfile();
    } catch {
      // 404 — new user, profile doesn't exist yet
    }

    if (!existingProfile) {
      // New Google user — save profile to MongoDB
      await saveUserProfile({
        full_name:         fbUser.displayName ?? fbUser.email ?? '',
        email:             fbUser.email ?? '',
        role,
        enrollment_number: enrollmentNumber,
      });
      return { isNewUser: true };
    }

    return { isNewUser: false };
  };

  // ── Sign out ────────────────────────────────────────────────────────────────
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      isAuthenticated: !!user,
      isTeacher:       user?.role === 'teacher',
      isStudent:       user?.role === 'student',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
