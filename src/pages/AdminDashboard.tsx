import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, LogOut, GraduationCap, Search,
  ChevronDown, ChevronUp, Hash, Mail, Star,
  TrendingUp, BookOpen, Mic, AlertCircle, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { getStudents } from '../lib/api';
import type { StudentWithAssessments } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_EMAIL_LIST } from '../config/adminEmails';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentRecord {
  id: string;
  target_text: string;
  accuracy: number;
  wer: number;
  cer: number;
  assessed_at: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  enrollment_number?: string;
  created_at: string;
  assessments?: AssessmentRecord[];
  avgAccuracy?: number;
  totalSessions?: number;
}

type SortKey = 'name' | 'enrollment' | 'score' | 'sessions' | 'joined';
type SortDir = 'asc' | 'desc';

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut, isTeacher } = useAuth();

  const [students, setStudents]     = useState<StudentWithAssessments[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey]       = useState<SortKey>('name');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [activeTab, setActiveTab]   = useState<'students' | 'teachers'>('students');

  useEffect(() => {
    if (!isTeacher) { navigate('/'); return; }
    fetchStudents();
  }, [isTeacher]);

  // ── Fetch all students + their assessments from Firestore ──────────────────
  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.enrollment_number ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = '', vb: string | number = '';
    if (sortKey === 'name')       { va = a.full_name;              vb = b.full_name; }
    if (sortKey === 'enrollment') { va = a.enrollment_number ?? ''; vb = b.enrollment_number ?? ''; }
    if (sortKey === 'score')      { va = a.avgAccuracy  ?? -1;     vb = b.avgAccuracy  ?? -1; }
    if (sortKey === 'sessions')   { va = a.totalSessions ?? 0;     vb = b.totalSessions ?? 0; }
    if (sortKey === 'joined')     { va = a.created_at;             vb = b.created_at; }
    if (typeof va === 'string')
      return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <span className="opacity-30 text-xs">↕</span>;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalStudents  = students.length;
  const totalSessions  = students.reduce((s, st) => s + (st.totalSessions ?? 0), 0);
  const scoredStudents = students.filter(s => s.avgAccuracy != null);
  const avgClassScore  = scoredStudents.length
    ? Math.round(scoredStudents.reduce((s, st) => s + (st.avgAccuracy ?? 0), 0) / scoredStudents.length)
    : 0;

  const scoreColor = (n: number) =>
    n >= 85 ? 'text-emerald-600 bg-emerald-50' : n >= 65 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  const scoreBar = (n: number) =>
    n >= 85 ? 'bg-emerald-500' : n >= 65 ? 'bg-amber-400' : 'bg-red-400';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-xs text-gray-500">{user?.full_name} · {user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchStudents} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          <StatCard icon={<Users className="w-5 h-5 text-blue-500" />}   label="Total Students"  value={totalStudents}                    bg="bg-blue-50" />
          <StatCard icon={<Mic   className="w-5 h-5 text-purple-500" />} label="Total Sessions"  value={totalSessions}                    bg="bg-purple-50" />
          <StatCard icon={<Star  className="w-5 h-5 text-amber-500" />}  label="Avg Class Score" value={avgClassScore ? `${avgClassScore}%` : '—'} bg="bg-amber-50" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['students', 'teachers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold capitalize transition border-b-2 -mb-px ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'students' ? `Students (${totalStudents})` : `Authorized Teachers (${ADMIN_EMAIL_LIST.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'teachers' ? <TeachersTab /> : (
          <>
            {/* Search */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email or enrollment no."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
                />
              </div>
              <span className="text-xs text-gray-400">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Loading from Firestore...
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No students found</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {[
                        { k: 'name'       as SortKey, label: 'Student' },
                        { k: 'enrollment' as SortKey, label: 'Enrollment No.' },
                        { k: 'sessions'   as SortKey, label: 'Sessions' },
                        { k: 'score'      as SortKey, label: 'Avg Score' },
                        { k: 'joined'     as SortKey, label: 'Joined' },
                      ].map(col => (
                        <th
                          key={col.k} onClick={() => toggleSort(col.k)}
                          className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none"
                        >
                          <span className="flex items-center gap-1">{col.label} <SortIcon k={col.k} /></span>
                        </th>
                      ))}
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((student, i) => (
                      <>
                        <tr
                          key={student.id}
                          onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}
                          className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition ${
                            expandedId === student.id ? 'bg-blue-50/60' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {student.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{student.full_name}</p>
                                <p className="text-xs text-gray-500">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="flex items-center gap-1.5 font-mono text-sm text-gray-700">
                              <Hash className="w-3 h-3 text-gray-400" />
                              {student.enrollment_number ?? <span className="text-gray-300 italic font-sans text-xs">not set</span>}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                              {student.totalSessions ?? 0}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {student.avgAccuracy != null ? (
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${scoreColor(student.avgAccuracy)}`}>
                                  {student.avgAccuracy}%
                                </span>
                                <div className="flex-1 min-w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${scoreBar(student.avgAccuracy)}`} style={{ width: `${student.avgAccuracy}%` }} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs italic">No data yet</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-500">
                            {student.created_at
                              ? new Date(student.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="px-5 py-4 text-gray-400">
                            {expandedId === student.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        {expandedId === student.id && (
                          <tr key={`${student.id}-detail`} className="bg-blue-50/30">
                            <td colSpan={6} className="px-8 py-5">
                              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <TrendingUp className="w-4 h-4 text-blue-500" />
                                Assessment History — {student.full_name}
                              </div>
                              {!student.assessments?.length ? (
                                <p className="text-sm text-gray-400 italic">No assessments recorded yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-400 uppercase tracking-wide">
                                        <th className="text-left pb-2 pr-4">Text Spoken</th>
                                        <th className="text-left pb-2 pr-4">Accuracy</th>
                                        <th className="text-left pb-2 pr-4">WER</th>
                                        <th className="text-left pb-2 pr-4">CER</th>
                                        <th className="text-left pb-2">Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {student.assessments.map(a => (
                                        <tr key={a.id} className="border-t border-blue-100">
                                          <td className="py-2 pr-4 font-medium text-gray-700 max-w-xs truncate">{a.target_text}</td>
                                          <td className="py-2 pr-4"><ScorePill value={a.accuracy} /></td>
                                          <td className="py-2 pr-4"><span className="text-gray-600">{(a.wer * 100).toFixed(1)}%</span></td>
                                          <td className="py-2 pr-4"><span className="text-gray-600">{(a.cer * 100).toFixed(1)}%</span></td>
                                          <td className="py-2 text-gray-500">
                                            {a.assessed_at ? new Date(a.assessed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-5 border border-white shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span></div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ScorePill({ value }: { value: number }) {
  const pct = Math.round(value);
  const cls = pct >= 85 ? 'text-emerald-700 bg-emerald-100' : pct >= 65 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
  return <span className={`inline-block px-2 py-0.5 rounded font-bold ${cls}`}>{pct}%</span>;
}

function TeachersTab() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50">
        <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Only these emails can sign up / sign in as teachers. Edit <code className="font-mono bg-emerald-100 px-1 rounded">src/config/adminEmails.ts</code> to update.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody>
          {ADMIN_EMAIL_LIST.map((email, i) => (
            <tr key={email} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-6 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
              <td className="px-6 py-3 font-medium text-gray-800">
                <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-400" />{email}</span>
              </td>
              <td className="px-6 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Authorized
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
