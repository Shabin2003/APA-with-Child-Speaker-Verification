import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Shield, BookOpen, Users, LogOut, ShieldCheck, Hash, Palette, Apple, Calculator } from 'lucide-react';
import { SpeakerEnrollment } from './components/SpeakerEnrollment';
import { SpeakerVerification } from './components/SpeakerVerification';
import { PronunciationAssessment } from './components/PronunciationAssessment';
import { FruitsNaming } from './components/FruitsNaming';
import { ColoursMatching } from './components/ColoursMatching';
import { BodmasModule } from './components/bodmas/BodmasModule';
import { useAuth } from './contexts/AuthContext';

type Tab = 'enrollment' | 'verification' | 'assessment' | 'fruits' | 'colours' | 'bodmas';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('enrollment');
  const { user, signOut, isTeacher } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <header className="bg-white border-b-2 border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-200 rounded-full blur-lg opacity-20" />
              <Mic className="w-12 h-12 text-blue-500 relative" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Voice Assessment System
              </h1>
              <p className="text-gray-600 mt-1">
                Automatic Pronunciation Assessment & Speaker Verification for Children
              </p>
            </div>

            {/* User info + actions */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800">{user.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize flex items-center gap-1 justify-end">
                    {user.role === 'teacher'
                      ? <><ShieldCheck className="w-3 h-3 text-emerald-500" /> Teacher</>
                      : <><Hash className="w-3 h-3 text-blue-400" /> {(user as any).enrollment_number || 'Student'}</>
                    }
                  </p>
                </div>
                {isTeacher && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-lg transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Panel
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('enrollment')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'enrollment'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              Enrollment
            </button>

            <button
              onClick={() => setActiveTab('verification')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'verification'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg border-green-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Shield className="w-5 h-5" />
              Verification
            </button>

            <button
              onClick={() => setActiveTab('assessment')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'assessment'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              Assessment
            </button>

            <button
              onClick={() => setActiveTab('fruits')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'fruits'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg border-orange-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Apple className="w-5 h-5" />
              Fruit Naming
            </button>

            <button
              onClick={() => setActiveTab('colours')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'colours'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg border-sky-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Palette className="w-5 h-5" />
              Colours
            </button>

            <button
              onClick={() => setActiveTab('bodmas')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap border-2 ${
                activeTab === 'bodmas'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg border-purple-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Calculator className="w-5 h-5" />
              BODMAS
            </button>
          </nav>
        </div>
      </header>

      <main className="py-8">
        {activeTab === 'enrollment' && <SpeakerEnrollment />}
        {activeTab === 'verification' && <SpeakerVerification />}
        {activeTab === 'assessment' && <PronunciationAssessment />}
        {activeTab === 'fruits' && <FruitsNaming />}
        {activeTab === 'colours' && <ColoursMatching />}
        {activeTab === 'bodmas' && <BodmasModule />}
      </main>

      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white mt-16 border-t-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-3 text-blue-300">Features</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Real-time voice recording</li>
                <li>• Audio visualization</li>
                <li>• Instant feedback</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3 text-green-300">How It Works</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>1. Enroll a speaker profile</li>
                <li>2. Verify speaker identity</li>
                <li>3. Assess pronunciation</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3 text-blue-300">Technology</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• React with TypeScript</li>
                <li>• Web Audio API</li>
                <li>• Supabase Backend</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 text-center text-gray-400 text-sm">
            <p>Advanced voice assessment system for automatic pronunciation evaluation and speaker verification</p>
            <p className="mt-2">© 2024 Voice Assessment System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
