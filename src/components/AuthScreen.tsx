import React, { useState } from 'react';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  School, 
  ArrowRight, 
  Sparkles, 
  BookOpen, 
  Calendar, 
  CreditCard, 
  AlertCircle
} from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { createUserProfile, seedDemoData, DEMO_STUDENT_UID, DEMO_TEACHER_UID, getUserProfile } from '../dbUtils';
import { AppUser, UserRole } from '../types';

interface AuthScreenProps {
  onAuthSuccess: (user: AppUser) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>('student');
  
  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  
  const [error, setError] = useState<React.ReactNode>('');
  const [loading, setLoading] = useState(false);

  // Quick seed & demo login
  const handleDemoLogin = async (demoRole: UserRole) => {
    setError('');
    setLoading(true);
    try {
      // First seed the demo data to firestore
      await seedDemoData();
      
      const targetUid = demoRole === 'teacher' ? DEMO_TEACHER_UID : DEMO_STUDENT_UID;
      const profile = await getUserProfile(targetUid);
      if (profile) {
        onAuthSuccess(profile);
      } else {
        throw new Error("Could not retrieve demo profile document.");
      }
    } catch (err: any) {
      console.warn("Demo login action prevented:", err.message);
      setError("Failed to initialize demo session. Please try regular signup/login.");
    } finally {
      setLoading(false);
    }
  };

  // Regular Email Auth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        
        // Fetch the existing user profile from Firestore/LocalStorage
        let profile = await getUserProfile(userCredential.user.uid);
        
        if (!profile) {
          // Fallback to creating a basic profile only if one does not exist
          profile = await createUserProfile(userCredential.user.uid, { email: email.trim() });
        }
        
        onAuthSuccess(profile);
      } else {
        // Sign Up
        if (!name) {
          setError("Full Name is required.");
          setLoading(false);
          return;
        }
        if (!phone) {
          setError("Phone number is required (for class reminders & SMS updates).");
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newProfile = await createUserProfile(userCredential.user.uid, {
          name: name.trim(),
          email: email.trim(),
          role,
          phone: phone.trim(),
          institution: institution.trim(),
        });
        onAuthSuccess(newProfile);
      }
    } catch (err: any) {
      console.warn("Auth action prevented:", err.message);
      let errMsg: React.ReactNode = "অথেন্টিকেশন ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার তথ্য চেক করুন।";
      
      const errStr = String(err.message || err).toLowerCase();
      
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "এই ইমেইল এড্রেসটি দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "নিরাপত্তার জন্য পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে।";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "অনুগ্রহ করে একটি সঠিক ফরম্যাটের ইমেইল এড্রেস প্রবেশ করান।";
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে পুনরায় চেক করে চেষ্টা করুন।";
      } else if (errStr.includes("network") || errStr.includes("unreachable") || errStr.includes("offline")) {
        errMsg = "ইন্টারনেট সংযোগ বিচ্ছিন্ন বা ধীরগতির। অনুগ্রহ করে আপনার নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।";
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = (
          <div className="space-y-2 text-left">
            <p className="font-black text-red-950 text-xs sm:text-sm">ইমেইল/পাসওয়ার্ড অথেন্টিকেশন নিষ্ক্রিয় (Auth Disabled) ⚠️</p>
            <p className="text-xs text-red-900 leading-relaxed font-semibold">
              ফায়ারবেস প্রজেক্টে ইমেইল/পাসওয়ার্ড লগইন সক্রিয় করা হয়নি। এটি চালু করার নিয়ম:
            </p>
            <ul className="list-disc list-inside text-xs text-red-900 space-y-1.5 font-semibold pl-1">
              <li>আপনার <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline font-black text-red-950 hover:text-red-800">Firebase Console</a>-এ যান।</li>
              <li>বাম পাশের মেনু থেকে <strong className="font-extrabold text-red-950">Build &gt; Authentication</strong> সিলেক্ট করুন।</li>
              <li><strong className="font-extrabold text-red-950">Sign-in method</strong> ট্যাবে ক্লিক করে <strong className="font-extrabold text-red-950">Email/Password</strong> ইনেবল করুন ও সেভ করুন।</li>
            </ul>
            <p className="text-xs text-red-950 font-black pt-1">
              💡 অফলাইনে অথবা ডেমো টেস্ট করতে উপরে থাকা "ঝটপট ডেমো লগইন" বাটনগুলো ব্যবহার করুন অথবা নিচের "গুগল দিয়ে লগইন" বাটনটি ট্রাই করুন!
            </p>
          </div>
        );
      } else {
        errMsg = `ত্রুটি ঘটেছে: ${err.message || err}`;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if they have an existing profile
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        // Create new profile with the Google account details and the currently selected role
        profile = await createUserProfile(user.uid, {
          name: user.displayName || "Google User",
          email: user.email || "",
          role: role, // use currently selected role
          phone: user.phoneNumber || "",
          institution: "",
        });
      }
      onAuthSuccess(profile);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("সাইন-ইন পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজারের পপআপ সেটিংস চেক করুন এবং অনুমতি দিন।");
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("গুগল সাইন-ইন পপআপটি বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError("পূর্ববর্তী সাইন-ইন অনুরোধটি বাতিল করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(
          <div className="space-y-1 text-left">
            <p className="font-black text-red-950 text-xs">গুগল সাইন-ইন নিষ্ক্রিয় (Google Sign-In Disabled) ⚠️</p>
            <p className="text-xs text-red-900 leading-relaxed font-semibold">
              ফায়ারবেস কনসোলে গুগল সাইন-ইন সক্রিয় করা নেই। অনুগ্রহ করে <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline font-black">Firebase Console</a> &gt; Authentication &gt; Sign-in method এ গিয়ে Google সক্রিয় করুন।
            </p>
          </div>
        );
      } else {
        setError(`গুগল সাইন-ইন ব্যর্থ হয়েছে: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-indigo-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Shifting Glowing Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-[120px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[150px] animate-float pointer-events-none"></div>
      <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-amber-500/5 blur-[100px] pointer-events-none"></div>

      {/* Platform Welcome Card */}
      <div className="w-full max-w-5xl bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_100px_rgba(0,0,0,0.4)] border border-white/20 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 transition-all duration-300">
        
        {/* Left column: Context & Feature Highlights (Bangladesh Context) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-teal-950 via-teal-900 to-slate-950 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden border-r border-white/5">
          {/* Internal gradient glows */}
          <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-teal-500/20 blur-2xl"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/25 blur-3xl animate-float"></div>

          <div className="relative z-10 space-y-8">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg px-4 py-1.5 rounded-full border border-white/10 shadow-inner animate-pulse">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span className="text-xs font-bold text-teal-100 uppercase tracking-widest">কোচিং কানেক্ট প্লাটফর্ম</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-teal-100 to-emerald-200">
                Bridge the Gap in Offline Coaching
              </h1>
              <p className="text-teal-200 text-sm leading-relaxed font-medium">
                বাংলাদেশের যেকোনো অফলাইন কোচিং সেন্টার, ব্যাচ শিক্ষক এবং শিক্ষার্থীদের জন্য সমন্বিত ডিজিটাল ক্লাসরুম রুটিন ও কমিউনিকেশন ম্যানেজার।
              </p>
            </div>

            <div className="space-y-6 pt-4">
              {/* Feature 1 */}
              <div className="flex items-start space-x-4 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800/80 text-emerald-300 shrink-0 border border-teal-700 shadow-glow-teal group-hover:scale-110 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-emerald-300 transition-colors">রিয়েল-টাইম রুটিন চেঞ্জার</h4>
                  <p className="text-xs text-teal-200/90 font-medium mt-0.5 leading-relaxed">শিক্ষক ক্লাস পরিবর্তন করলেই ওই নির্দিষ্ট ব্যাচের সকল স্টুডেন্টের ড্যাশবোর্ডে সাথে সাথে অ্যালার্ট চলে যাবে।</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start space-x-4 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800/80 text-teal-200 shrink-0 border border-teal-700 shadow-glow-teal group-hover:scale-110 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-teal-200 transition-colors">লেকচার শিট ও মেটেরিয়াল হাব</h4>
                  <p className="text-xs text-teal-200/90 font-medium mt-0.5 leading-relaxed">সব মেটেরিয়াল একসাথে ড্রাইভ লিংকের মাধ্যমে ড্যাশবোর্ডে থাকবে। কোনো গ্রুপ খোঁজার ঝামেলা নেই।</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start space-x-4 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800/80 text-amber-300 shrink-0 border border-teal-700 shadow-glow-amber group-hover:scale-110 transition-transform">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors">বেতন ও পেমেন্ট ট্র্যাকার</h4>
                  <p className="text-xs text-teal-200/90 font-medium mt-0.5 leading-relaxed">বিকাশ/নগদ বা ক্যাশ পেমেন্ট রিপোর্ট করা এবং শিক্ষকের সহজে পেমেন্ট ভেরিফাই করার সুবিধা।</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 mt-8 border-t border-white/10 text-teal-300 text-xs flex justify-between items-center font-bold">
            <span>Powered by Firestore & Auth</span>
            <span className="font-mono text-xs tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-glow-teal">৳ 100% SECURE</span>
          </div>
        </div>

        {/* Right column: Auth Forms & Instant Sandbox Access */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
          
          {/* Regular Login/Signup Form */}
          <div>
            {/* Tabs */}
            <div className="flex rounded-2xl bg-gray-100 p-1.5 mb-6">
              <button
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 text-center py-3 text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-150 transform active:scale-95 cursor-pointer ${
                  isLogin ? 'bg-white text-gray-950 shadow-sm shadow-gray-200/80 scale-[1.01]' : 'text-gray-500 hover:text-gray-950'
                }`}
              >
                লগইন করুন (Sign In)
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 text-center py-3 text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-150 transform active:scale-95 cursor-pointer ${
                  !isLogin ? 'bg-white text-gray-950 shadow-sm shadow-gray-200/80 scale-[1.01]' : 'text-gray-500 hover:text-gray-950'
                }`}
              >
                নতুন রেজিস্ট্রেশন (Sign Up)
              </button>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-5 border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50/10 text-gray-700 hover:text-teal-900 font-extrabold rounded-2xl text-xs sm:text-sm shadow-sm transition-all duration-150 transform active:scale-[0.98] mb-6 cursor-pointer"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.38C21.68,11.83 21.56,11.41 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.6c2.59,0 4.77,-0.86 6.36,-2.3l-3.3,-2.58c-0.92,0.62 -2.1,0.98 -3.06,0.98c-2.42,0 -4.47,-1.64 -5.2,-3.84H3.38v2.66C4.98,18.7 8.24,20.6 12,20.6z" fill="#34A853" />
                  <path d="M6.8,12.86c-0.18,-0.54 -0.28,-1.12 -0.28,-1.71s0.1,-1.17 0.28,-1.71V6.78H3.38C2.77,8 2.42,9.4 2.42,10.9s0.35,2.9 0.96,4.12l3.42,-2.66z" fill="#FBBC05" />
                  <path d="M12,5.26c1.41,0 2.68,0.49 3.68,1.44l2.76,-2.76C16.76,2.44 14.58,1.52 12,1.52C8.24,1.52 4.98,3.42 3.38,6.58l3.42,2.66C7.53,6.9 9.58,5.26 12,5.26z" fill="#EA4335" />
                </g>
              </svg>
              <span>{isLogin ? 'গুগল দিয়ে লগইন (Google Sign-In)' : `গুগল দিয়ে রেজিস্টার (${role === 'teacher' ? 'Teacher' : 'Student'})`}</span>
            </button>

            {error && (
              <div className="flex items-center space-x-2.5 bg-red-50 text-red-800 text-xs sm:text-sm rounded-2xl p-4 mb-5 border-2 border-red-150 animate-fade-in">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Registration Only Fields */}
              {!isLogin && (
                <div className="space-y-4 animate-fade-in">
                  {/* Role selection */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2.5">
                      আপনি কি একজন শিক্ষক নাকি ছাত্র? (Select Role)
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-center border-2 transition-all duration-150 transform active:scale-95 cursor-pointer ${
                          role === 'student' 
                            ? 'border-teal-500 bg-teal-50/60 text-teal-900 shadow-sm shadow-teal-500/5' 
                            : 'border-gray-150 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        🎓 ছাত্র / ছাত্রী (Student)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold text-center border-2 transition-all duration-150 transform active:scale-95 cursor-pointer ${
                          role === 'teacher' 
                            ? 'border-teal-500 bg-teal-50/60 text-teal-900 shadow-sm shadow-teal-500/5' 
                            : 'border-gray-150 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        👨‍🏫 শিক্ষক (Teacher)
                      </button>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      সম্পূর্ণ নাম (Full Name) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                        <User className="h-5 w-5" />
                      </span>
                      <input
                        type="text"
                        required={!isLogin}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="উদাঃ সাদমান চৌধুরী"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 bg-white font-semibold transition-all duration-150 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      মোবাইল নম্বর (Phone Number) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                        <Phone className="h-5 w-5" />
                      </span>
                      <input
                        type="tel"
                        required={!isLogin}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="উদাঃ 01712345678"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 bg-white font-semibold transition-all duration-150 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Institution */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      স্কুল / কলেজ / বিশ্ববিদ্যালয় (Institution)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                        <School className="h-5 w-5" />
                      </span>
                      <input
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="উদাঃ নটর ডেম কলেজ"
                        className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 bg-white font-semibold transition-all duration-150 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                  ইমেইল এড্রেস (Email Address) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@coachingconnect.bd"
                    className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 bg-white font-semibold transition-all duration-150 shadow-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                  পাসওয়ার্ড (Password) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 bg-white font-semibold transition-all duration-150 shadow-sm"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="shimmer-btn w-full mt-4 flex items-center justify-center space-x-2.5 py-4 px-5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl text-sm sm:text-base shadow-lg shadow-teal-600/10 transition-all duration-150 transform active:scale-[0.98] disabled:opacity-50 disabled:transform-none cursor-pointer"
              >
                {loading ? (
                  <span className="font-extrabold">প্রক্রিয়া চলছে...</span>
                ) : (
                  <>
                    <span className="font-black">{isLogin ? 'লগইন করুন' : 'নতুন একাউন্ট খুলুন'}</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
