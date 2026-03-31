import { getIdToken } from 'firebase/auth';
import { auth } from './firebase';

// Strip any trailing slash so URLs never become //path/to/endpoint
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// ─── Response Types ────────────────────────────────────────────────────────────

export interface SpeakerEnrollmentResponse {
  status: string;
  speaker_id: string;
}

export interface SpeakerVerificationResponse {
  speaker_id: string;
  similarity: number;
  eer: number;
  decision: string;
}

export interface PronunciationAnalysisResponse {
  transcript: string;
  reference: string;
  wer: number;
  cer: number;
  accuracy: number;
}

export interface GenerateTextResponse {
  sentence: string;
  fact?: string;
  tip?: string;
  words?: string[];
  level?: string;
  audio_url?: string;
  sentence_id?: string;
}

export interface SentencePoolResponse {
  [level: string]: GenerateTextResponse[];
}

export interface UserProfileResponse {
  uid: string;
  full_name: string;
  email: string;
  role: 'student' | 'teacher';
  enrollment_number?: string;
  age?: number;
  enrolled?: boolean;
  created_at?: string;
}

export interface AssessmentRecord {
  id: string;
  target_text: string;
  accuracy: number;
  wer: number;
  cer: number;
  assessed_at: string;
}

export interface StudentWithAssessments extends UserProfileResponse {
  assessments: AssessmentRecord[];
  avgAccuracy?: number;
  totalSessions: number;
}

// ─── Auth header ─────────────────────────────────────────────────────────────

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated. Please log in first.');
  // forceRefresh=true ensures we always have a valid token, especially
  // immediately after Google sign-in when the cached token may not exist yet.
  const token = await getIdToken(user, true);
  return { Authorization: `Bearer ${token}` };
}

// ─── Response handler ─────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Server error ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail || body?.message || JSON.stringify(body);
    } catch {
      message = await res.text().catch(() => message);
    }
    throw new Error(message);
  }
  return res.json();
}

// ─── User / Profile endpoints ─────────────────────────────────────────────────

/** POST /user/profile — create or update profile in MongoDB on signup/login */
export const saveUserProfile = async (profile: {
  full_name: string;
  email: string;
  role: 'student' | 'teacher';
  enrollment_number?: string;
}): Promise<UserProfileResponse> => {
  const res = await fetch(`${API_BASE_URL}/user/profile`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return handleResponse<UserProfileResponse>(res);
};

/** GET /user/profile — fetch the logged-in user's profile from MongoDB */
export const getUserProfile = async (): Promise<UserProfileResponse> => {
  const res = await fetch(`${API_BASE_URL}/user/profile`, {
    headers: await authHeader(),
  });
  return handleResponse<UserProfileResponse>(res);
};

/** GET /admin/students — teacher-only: all students + their assessments */
export const getStudents = async (): Promise<StudentWithAssessments[]> => {
  const res = await fetch(`${API_BASE_URL}/admin/students`, {
    headers: await authHeader(),
  });
  return handleResponse<StudentWithAssessments[]>(res);
};

// ─── Voice endpoints ──────────────────────────────────────────────────────────

/** POST /speaker/enroll */
export const enrollSpeaker = async (
  speakerId: string,
  age: number,
  audioBlob: Blob
): Promise<SpeakerEnrollmentResponse> => {
  const formData = new FormData();
  formData.append('speaker_id', speakerId);
  formData.append('age', age.toString());
  formData.append('file', audioBlob, 'audio.wav');
  const res = await fetch(`${API_BASE_URL}/speaker/enroll`, {
    method: 'POST',
    headers: await authHeader(),
    body: formData,
  });
  return handleResponse<SpeakerEnrollmentResponse>(res);
};

/** POST /speaker/verify */
export const verifySpeaker = async (
  speakerId: string,
  age: number,
  audioBlob: Blob
): Promise<SpeakerVerificationResponse> => {
  const formData = new FormData();
  formData.append('speaker_id', speakerId);
  formData.append('age', age.toString());
  formData.append('file', audioBlob, 'audio.wav');
  const res = await fetch(`${API_BASE_URL}/speaker/verify`, {
    method: 'POST',
    headers: await authHeader(),
    body: formData,
  });
  return handleResponse<SpeakerVerificationResponse>(res);
};

/** POST /pronunciation/analyze */
export const analyzePronunciation = async (
  text: string,
  audioBlob: Blob
): Promise<PronunciationAnalysisResponse> => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('file', audioBlob, 'audio.wav');
  const res = await fetch(`${API_BASE_URL}/pronunciation/analyze`, {
    method: 'POST',
    headers: await authHeader(),
    body: formData,
  });
  return handleResponse<PronunciationAnalysisResponse>(res);
};

/** GET /generate-text (public) */
export const generateText = async (
  level: string = 'Medium'
): Promise<GenerateTextResponse> => {
  const res = await fetch(`${API_BASE_URL}/generate-text?level=${encodeURIComponent(level)}`);
  return handleResponse<GenerateTextResponse>(res);
};

/** GET /sentences/pool — fetch all cached sentences from MongoDB for offline fallback */
export const getSentencePool = async (): Promise<SentencePoolResponse> => {
  const res = await fetch(`${API_BASE_URL}/sentences/pool`);
  return handleResponse<SentencePoolResponse>(res);
};

/** GET / (public health check) */
export const checkHealth = async (): Promise<{ message: string; device: string }> => {
  const res = await fetch(`${API_BASE_URL}/`);
  return handleResponse(res);
};
