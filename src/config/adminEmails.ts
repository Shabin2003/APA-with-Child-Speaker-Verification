/**
 * ADMIN / TEACHER EMAIL WHITELIST
 * Add or remove teacher emails here. Only these emails can register/login as teachers.
 * This list is checked client-side; also enforce server-side via Supabase RLS.
 */
export const ADMIN_EMAIL_LIST: string[] = [
  'admin@voiceassessment.edu',
  'teacher@voiceassessment.edu',
  'supervisor@voiceassessment.edu',
  'priya.sharma@school.edu',
  'rahul.verma@school.edu',
  'sunita.gupta@school.edu',
];

export const isAdminEmail = (email: string): boolean =>
  ADMIN_EMAIL_LIST.some(e => e.toLowerCase() === email.toLowerCase());
