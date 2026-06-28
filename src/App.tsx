import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getUserProfile } from './dbUtils';
import { AppUser } from './types';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { GraduationCap, Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Synchronize Auth State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileError(null);
      if (firebaseUser) {
        try {
          // Fetch the database profile associated with this user
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            // Document truly doesn't exist in Firestore
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Student User",
              email: firebaseUser.email || "",
              role: 'student',
              phone: "",
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error retrieving user profile on state change:", error);
          setProfileError("আপনার প্রোফাইল লোড করতে সমস্যা হচ্ছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে পুনরায় চেষ্টা করুন।");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Sign Out
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Direct success handler for instant login (like Demo mode)
  const handleAuthSuccess = (authenticatedUser: AppUser) => {
    setUser(authenticatedUser);
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-700">
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-xl shadow-teal-500/15">
              <GraduationCap className="h-9 w-9 animate-bounce" />
            </div>
            <span className="absolute -right-2 -top-2 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow ring-2 ring-white animate-pulse">
              ৳
            </span>
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-gray-900">EduFlow (এডুফ্লো)</h3>
            <p className="text-xs text-gray-500">প্রবেশদ্বার লোড হচ্ছে...</p>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto" />
        </div>
      </div>
    );
  }

  // 1.5. Profile Loading Error layout
  if (profileError && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-indigo-950 px-4 py-12 sm:px-6 lg:px-8 text-white relative">
        <div className="w-full max-w-md bg-white text-gray-900 rounded-[2rem] shadow-xl border border-gray-100 p-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
            <AlertCircle className="h-8 w-8 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display font-bold text-xl text-gray-900">নেটওয়ার্ক সমস্যা ⚠️</h3>
            <p className="text-sm text-gray-600 leading-relaxed font-semibold">
              {profileError}
            </p>
          </div>
          <div className="flex flex-col space-y-3 pt-2">
            <button
              id="retry-load-profile-btn"
              onClick={async () => {
                setLoading(true);
                setProfileError(null);
                const currentUser = auth.currentUser;
                if (currentUser) {
                  try {
                    const profile = await getUserProfile(currentUser.uid);
                    if (profile) {
                      setUser(profile);
                    } else {
                      setProfileError("প্রোফাইলটি ফায়ারবেস ডেটাবেজে খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন বা নতুন অ্যাকাউন্ট খুলুন।");
                    }
                  } catch (err) {
                    setProfileError("আবারও লোড করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করুন।");
                  }
                }
                setLoading(false);
              }}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm transition-all shadow-md shadow-teal-600/10 cursor-pointer"
            >
              আবার চেষ্টা করুন (Retry)
            </button>
            <button
              id="logout-fallback-btn"
              onClick={handleLogout}
              className="w-full py-3 px-4 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
            >
              সাইন আউট করুন (Sign Out)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Layout
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <Navbar user={null} onLogout={() => {}} />
        <main className="pb-16">
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        </main>
        <PWAInstallPrompt />
      </div>
    );
  }

  // 3. Authenticated Layout
  return (
    <div className="min-h-screen bg-slate-50/40">
      <Navbar user={user} onLogout={handleLogout} />
      
      <main className="pb-16 animate-fade-in">
        {user.role === 'teacher' ? (
          <TeacherDashboard user={user} />
        ) : (
          <StudentDashboard user={user} />
        )}
      </main>
      <PWAInstallPrompt />
    </div>
  );
}
