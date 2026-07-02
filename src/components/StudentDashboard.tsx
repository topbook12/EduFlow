import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, 
  Calendar, 
  CreditCard, 
  FileText, 
  Bell, 
  Plus, 
  Clock, 
  User, 
  MapPin, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  enrollStudentInBatch, 
  reportPayment,
  subscribeToStudentEnrollments,
  subscribeToBatches,
  subscribeToNotices,
  subscribeToMaterials
} from '../dbUtils';
import { AppUser, Batch, Enrollment, StudyMaterial, Notice, DailyRoadmapItem } from '../types';
import { WeeklyCalendarView } from './WeeklyCalendarView';
import { StudentExamPerformance } from './StudentExamPerformance';

interface StudentDashboardProps {
  user: AppUser;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const generateMonthsList = () => {
  const months = [];
  const currentDate = new Date();
  for (let i = -6; i <= 6; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    months.push(`${monthName} ${year}`);
  }
  return months;
};

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const availableMonths = useMemo(() => generateMonthsList(), []);
  
  // Database States
  const [enrolledBatches, setEnrolledBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  
  // UI States
  const [inviteCode, setInviteCode] = useState('');
  const [enrollMessage, setEnrollMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  });
  const [joining, setJoining] = useState(false);
  const [reportingMap, setReportingMap] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'roadmap' | 'notices' | 'materials' | 'tuition' | 'exams'>('roadmap');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  // Rich Payment Reporting Modal States
  const [reportingBatch, setReportingBatch] = useState<Batch | null>(null);
  const [reportAmount, setReportAmount] = useState<number>(0);
  const [reportMethod, setReportMethod] = useState<string>('bKash');
  const [reportTrxId, setReportTrxId] = useState<string>('');
  const [reportNote, setReportNote] = useState<string>('');

  useEffect(() => {
    setPortalNode(document.getElementById('desktop-nav-portal'));
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday, etc.
  const todayName = DAYS_OF_WEEK[todayIndex];

  // 1. Listen to Student's Enrollments
  useEffect(() => {
    const unsubscribe = subscribeToStudentEnrollments(user.uid, (enrollmentList) => {
      setEnrollments(enrollmentList);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // 2. Listen to Batches, Notices, and Materials based on Enrollments
  useEffect(() => {
    const batchIds = enrollments.filter(e => e.status === 'active').map(e => e.batchId);
    
    if (batchIds.length === 0) {
      setEnrolledBatches([]);
      setNotices([]);
      setMaterials([]);
      return;
    }

    const unsubBatches = subscribeToBatches(batchIds, (batchList) => {
      setEnrolledBatches(batchList);
    });

    const unsubNotices = subscribeToNotices(batchIds, (noticeList) => {
      setNotices(noticeList);
    });

    const unsubMaterials = subscribeToMaterials(batchIds, (materialList) => {
      setMaterials(materialList);
    });

    return () => {
      unsubBatches();
      unsubNotices();
      unsubMaterials();
    };
  }, [enrollments]);

  // Handle joining a new batch
  const handleJoinBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setJoining(true);
    setEnrollMessage(null);
    try {
      const result = await enrollStudentInBatch(user.uid, user, inviteCode);
      if (result.success) {
        setEnrollMessage({ type: 'success', text: result.message });
        setInviteCode('');
      } else {
        setEnrollMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setEnrollMessage({ type: 'error', text: "An error occurred. Please try again." });
    } finally {
      setJoining(false);
    }
  };

  // Student opens report payment modal
  const handleOpenReportPayment = (batch: Batch, defaultPayable: number) => {
    setReportingBatch(batch);
    setReportAmount(defaultPayable);
    setReportMethod('bKash');
    setReportTrxId('');
    setReportNote('');
  };

  // Student submits the payment report modal
  const handleSubmitReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingBatch) return;
    const key = `${reportingBatch.id}_${selectedMonth}`;
    setReportingMap(prev => ({ ...prev, [key]: true }));
    try {
      await reportPayment(
        reportingBatch.id,
        user.uid,
        selectedMonth,
        reportAmount,
        reportMethod,
        reportTrxId,
        reportNote
      );
      setReportingBatch(null);
    } catch (error) {
      console.error("Payment reporting failed:", error);
    } finally {
      setReportingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  // Helper to construct dynamic roadmap
  const getRoadmapData = (): DailyRoadmapItem[] => {
    const roadmap: DailyRoadmapItem[] = [];
    enrolledBatches.forEach(batch => {
      batch.schedule.forEach(sched => {
        // Format 24h to 12h time with AM/PM
        const [hourStr, minStr] = sched.time.split(':');
        const hour = parseInt(hourStr);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const displayTime = `${displayHour}:${minStr} ${ampm}`;

        roadmap.push({
          day: sched.day,
          batchId: batch.id,
          batchName: batch.name,
          subject: batch.subject,
          teacherName: batch.teacherName,
          time: displayTime
        });
      });
    });

    // Sort roadmap items chronologically inside each day
    // We can group them by day for the dashboard view
    return roadmap;
  };

  const roadmapItems = getRoadmapData();

  // Count student payment verification states for notification badges
  const studentPendingCount = enrollments.reduce((acc, enroll) => {
    if (!enroll.paymentStatus) return acc;
    const pendingMonths = Object.values(enroll.paymentStatus).filter(status => status === 'pending');
    return acc + pendingMonths.length;
  }, 0);

  // Count enrolled batches with unpaid status for selectedMonth
  const studentUnpaidCount = enrollments.filter(e => {
    const status = e.paymentStatus?.[selectedMonth] || 'unpaid';
    return status === 'unpaid';
  }).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 lg:pb-8 sm:px-6 lg:px-8">
      
      {/* Bangladesh Context Greeting Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-gray-150 animate-fade-in">
        <div className="relative z-10 md:flex md:items-center md:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center space-x-1.5 rounded-full bg-teal-50 text-teal-700 px-3.5 py-1 text-xs font-bold shadow-sm ring-1 ring-teal-100/50">
              <span>কোচিং শিক্ষার্থী</span>
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🎈</span> অভিনন্দন, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              আজ: {new Date().toLocaleDateString('bn-BD')} • আপনার পার্সোনাল স্টাডি ড্যাশবোর্ড
            </p>
          </div>
          <div className="mt-5 md:mt-0 flex shrink-0">
            <button
              onClick={() => setActiveTab('roadmap')}
              className="flex items-center space-x-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer"
            >
              <Calendar className="h-4.5 w-4.5" />
              <span>নিজের রুটিন দেখুন</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
      {/* Top Segmented Navigation Tab Bar (Desktop/Tablet Only) - Portaled to Navbar */}
      {isDesktop && portalNode && createPortal(
        <div className="flex items-center overflow-x-auto scrollbar-none gap-2">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>রুটিন</span>
          </button>

          <button
            onClick={() => setActiveTab('notices')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 relative cursor-pointer ${
              activeTab === 'notices'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">📢</span>
            <span>নোটিশ</span>
            {notices.length > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-orange-400 animate-pulse ring-2 ring-[#0f865f]"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'materials'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">📚</span>
            <span>লেকচার শিট</span>
          </button>

          <button
            onClick={() => setActiveTab('tuition')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer relative ${
              activeTab === 'tuition'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">💳</span>
            <span>বেতন</span>
            {studentPendingCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white ring-2 ring-[#0f865f] animate-pulse" title="পেমেন্ট ভেরিফিকেশন পেন্ডিং">
                ⏳
              </span>
            ) : studentUnpaidCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-[#0f865f]" title="বেতন বকেয়া রয়েছে">
                ৳
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer relative ${
              activeTab === 'exams'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">📝</span>
            <span>এক্সাম ও ফলাফল</span>
          </button>
        </div>,
        portalNode
      )}

      <div className="space-y-8 min-w-0">
          
          {/* Section 1: Dynamic Weekly Roadmap & Join Batch (Shows on 'roadmap' tab) */}
          {activeTab === 'roadmap' && (() => {
            const studentSchedules: any[] = [];
            enrolledBatches.forEach((batch, bIdx) => {
              if (batch.schedule && Array.isArray(batch.schedule)) {
                batch.schedule.forEach(sched => {
                  studentSchedules.push({
                    day: sched.day,
                    time: sched.time,
                    batchId: batch.id,
                    batchName: batch.name,
                    subject: batch.subject,
                    code: batch.code,
                    teacherName: batch.teacherName,
                    accentIndex: bIdx,
                  });
                });
              }
            });

            return (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                  {enrolledBatches.length === 0 ? (
                    <div className="rounded-3xl border border-teal-100 bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/40 relative overflow-hidden text-center py-14">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl"></div>
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-4 shadow-inner">
                        <Calendar className="h-7 w-7" />
                      </div>
                      <h4 className="text-base font-extrabold text-gray-800">কোনো রোডম্যাপ পাওয়া যায়নি</h4>
                      <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1.5 font-medium leading-relaxed">
                        আপনি এখনো কোনো কোচিং ব্যাচে যুক্ত হননি। পাশে শিক্ষক থেকে পাওয়া "Batch Code" দিয়ে ব্যাচে যোগ দিন।
                      </p>
                    </div>
                  ) : (
                    <WeeklyCalendarView 
                      items={studentSchedules} 
                      userRole="student" 
                      batchesList={enrolledBatches} 
                      user={user}
                    />
                  )}
                </div>
                <div className="xl:col-span-4 space-y-8">
                  {/* Module A: Join Batch Card */}
                  <div className="rounded-3xl border-2 border-teal-500/20 bg-gradient-to-b from-teal-50/30 to-white p-6 sm:p-8 shadow-xl shadow-teal-900/5 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-teal-500/10 rounded-full blur-xl"></div>
                    <h3 className="font-display text-xl font-black text-gray-950 mb-2">কোচিং ব্যাচে যোগ দিন ✨</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-5 font-semibold leading-relaxed">
                      আপনার শিক্ষক থেকে প্রাপ্ত ৬ ডিজিটের ইনভাইট কোডটি ব্যবহার করে ব্যাচে এনরোল করুন।
                    </p>

                    {enrollMessage && (
                      <div className={`flex items-start space-x-2.5 text-xs sm:text-sm rounded-2xl p-4 mb-5 border-2 ${
                        enrollMessage.type === 'success' 
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                          : 'bg-red-50 text-red-900 border-red-200'
                      }`}>
                        {enrollMessage.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                        )}
                        <span className="font-bold leading-relaxed">{enrollMessage.text}</span>
                      </div>
                    )}

                    <form onSubmit={handleJoinBatch} className="space-y-4">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          placeholder="MATH-ADV-10"
                          className="w-full uppercase px-4 py-4 text-center text-lg font-black tracking-widest border-2 border-teal-150 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 bg-white placeholder-gray-300 shadow-inner animate-pulse-subtle"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={joining}
                        className="shimmer-btn w-full flex items-center justify-center space-x-2.5 py-4 px-5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl text-sm sm:text-base shadow-lg shadow-teal-600/10 transition-all duration-150 transform active:scale-[0.98] cursor-pointer"
                      >
                        <span className="font-black">{joining ? 'যোগদান চলছে...' : 'ব্যাচে যোগ দিন'}</span>
                        <Plus className="h-5 w-5" />
                      </button>
                    </form>

                    {enrolledBatches.length === 0 && (
                      <div className="mt-5 bg-amber-50 rounded-2xl p-4 border-2 border-amber-100 text-xs sm:text-sm text-amber-900 flex items-start space-x-2.5 font-semibold leading-relaxed">
                        <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                        <span>
                          ডেমো টেস্ট করতে ইনভাইট কোড ব্যবহার করুন: <br />
                          <strong className="text-teal-950 bg-teal-500/20 border border-teal-500/30 px-2 py-0.5 rounded-lg select-all font-mono">MATH-ADV-10</strong> (ম্যাথ ব্যাচ)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section 2: Notice Board (With special highlight on schedule changes) */}
          {activeTab === 'notices' && (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/40 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl"></div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center space-x-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 border border-orange-100 text-orange-700 shadow-inner">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-black text-gray-950">নোটিশ বোর্ড ও রুটিন আপডেট 📣</h2>
                    <p className="text-xs sm:text-sm font-bold text-gray-500">ক্লাস রুটিন পরিবর্তন, পরীক্ষা বা শিক্ষকের গুরুত্বপূর্ণ নোটিফিকেশন</p>
                  </div>
                </div>
              </div>

              {notices.length === 0 ? (
                <div className="rounded-3xl bg-gray-50/50 border border-dashed border-gray-250 py-14 px-6 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-4 shadow-inner animate-float">
                    <Bell className="h-7 w-7" />
                  </div>
                  <p className="text-base font-extrabold text-gray-700">আপনার ব্যাচগুলোর কোনো নোটিশ নেই।</p>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mt-1 font-medium">শিক্ষক কোনো পরিবর্তন জানালে সরাসরি এখানে দেখতে পাবেন।</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {notices.map((notice) => {
                    const isScheduleChange = notice.type === 'schedule_change';
                    const isExam = notice.type === 'exam_alert';

                    return (
                      <div 
                        key={notice.id} 
                        className={`rounded-2xl p-5 border-2 transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${
                          isScheduleChange 
                            ? 'bg-amber-50/30 border-amber-200/80 shadow-sm shadow-amber-500/5' 
                            : isExam 
                              ? 'bg-red-50/30 border-red-200/80 shadow-sm shadow-red-500/5'
                              : 'bg-teal-50/20 border-teal-150/80 shadow-sm shadow-teal-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2.5">
                            <span className={`rounded-xl px-3 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-sm border ${
                              isScheduleChange 
                                ? 'bg-amber-100 text-amber-850 border-amber-200' 
                                : isExam 
                                  ? 'bg-red-100 text-red-850 border-red-200'
                                  : 'bg-teal-100 text-teal-850 border-teal-200'
                            }`}>
                              {isScheduleChange ? 'Schedule Changed' : isExam ? 'Exam Alert' : 'Announcement'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-gray-900">{notice.batchName}</span>
                          </div>
                          <span className="text-xs font-black text-gray-400">
                            {new Date(notice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-gray-800 leading-relaxed font-semibold">
                          {notice.message}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 border-t border-gray-150/55 pt-3">
                          <span className="font-extrabold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">শিক্ষক: {notice.teacherName}</span>
                          <span className="font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">রিয়েল-টাইম রুটিন নোটিফিকেশন</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Study Materials Hub */}
          {activeTab === 'materials' && (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/40 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center space-x-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 shadow-inner">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-black text-gray-950">লেকচার শিট ও মেটেরিয়াল হাব (Materials) 📚</h2>
                    <p className="text-xs sm:text-sm font-bold text-gray-500">আপনার শিক্ষকদের শেয়ার করা পিডিএফ, লিংক ও প্র্যাকটিস শিট</p>
                  </div>
                </div>
              </div>

              {materials.length === 0 ? (
                <div className="rounded-3xl bg-gray-50/50 border border-dashed border-gray-250 py-14 px-6 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 mb-4 shadow-inner animate-float">
                    <FileText className="h-7 w-7" />
                  </div>
                  <p className="text-base font-extrabold text-gray-750">আপলোড করা কোনো স্টাডি মেটেরিয়াল পাওয়া যায়নি।</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {materials.map((material) => (
                    <div 
                      key={material.id}
                      className="flex flex-col justify-between rounded-2xl border-2 border-gray-100 bg-white p-6 hover:border-purple-550 hover:shadow-lg transition-all duration-300 relative group overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all duration-300"></div>
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="rounded-xl bg-purple-100/75 border border-purple-200 px-3 py-1 text-xs font-black text-purple-700">
                            {material.batchName} Sheet
                          </span>
                          <span className="text-xs font-black text-gray-400">
                            {new Date(material.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-gray-900 group-hover:text-purple-950 transition-colors">{material.title}</h4>
                        <p className="text-sm text-gray-650 mt-2.5 leading-relaxed font-semibold">
                          {material.description}
                        </p>
                      </div>

                      <a 
                        href={material.fileUrl} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        className="shimmer-btn mt-6 flex items-center justify-center space-x-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white py-3.5 text-sm font-black transition-all duration-150 transform active:scale-95 cursor-pointer shadow-md shadow-purple-600/10"
                      >
                        <Download className="h-5 w-5" />
                        <span>ডাউনলোড / ফাইল দেখুন</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Module B: Tuition Payments & Fees Tracker */}
          {activeTab === 'tuition' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in">
              <div className="xl:col-span-8 space-y-8">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/40 relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
                  <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 pb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 shadow-inner">
                      <CreditCard className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg sm:text-xl font-black text-gray-950">বেতন ট্র্যাকার ৳</h3>
                      <p className="text-xs sm:text-sm font-bold text-gray-500">মাসিক বেতন পরিশোধ বিবরণী</p>
                    </div>
                  </div>

                  {/* Select Month */}
                  <div className="mb-6">
                    <label className="block text-xs font-black text-gray-700 uppercase mb-2 tracking-wider">সিলেক্ট করুন (Month)</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-2xl p-3.5 text-sm sm:text-base focus:outline-none focus:border-teal-500 font-extrabold bg-white cursor-pointer"
                    >
                      {availableMonths.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                  </div>

                  {enrolledBatches.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8 italic font-semibold">কোনো কোচিং ফি বিবরণী নেই</p>
                  ) : (
                    <div className="space-y-4">
                      {enrolledBatches.map((batch) => {
                        const enrollment = enrollments.find(e => e.batchId === batch.id);
                        const status = enrollment?.paymentStatus?.[selectedMonth] || 'unpaid';
                        const defaultFee = batch.monthlyFee || 1200;
                        const fee = enrollment?.customFee !== undefined ? enrollment.customFee : defaultFee;
                        const discount = enrollment?.discount || 0;
                        const extraCharges = enrollment?.extraCharges?.[selectedMonth] || [];
                        const extraChargesSum = extraCharges.reduce((sum, item) => sum + item.amount, 0) || 0;
                        const netPayable = Math.max(0, fee - discount) + extraChargesSum;
                        const paidAmount = enrollment?.paidAmountMap?.[selectedMonth] || 0;
                        const dueAmount = Math.max(0, netPayable - paidAmount);

                        return (
                          <div 
                            key={batch.id} 
                            className="rounded-2xl border-2 border-gray-100 bg-gray-50/20 p-4 space-y-4 hover:border-teal-200 transition-all duration-205"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-black text-sm sm:text-base text-gray-950 leading-snug">{batch.name}</h4>
                                <span className="text-xs text-gray-500 mt-1 block font-bold">শিক্ষক: {batch.teacherName}</span>
                              </div>
                              <span className="font-display font-black text-base sm:text-lg text-teal-800">৳ {netPayable}</span>
                            </div>

                            {/* Fee Breakdown Details */}
                            <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs space-y-1.5 font-bold text-gray-600">
                              <div className="flex justify-between">
                                <span>টুইশন ফি (Base Tuition Fee):</span>
                                <span className="text-gray-900">৳{fee}</span>
                              </div>
                              {discount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                  <span>বিশেষ ছাড় (Discount):</span>
                                  <span>-৳{discount}</span>
                                </div>
                              )}
                              {extraCharges.length > 0 && (
                                <div className="pt-1.5 border-t border-dashed border-gray-100 space-y-1">
                                  <span className="text-amber-700 block text-[10px] font-black uppercase tracking-wider">অতিরিক্ত চার্জ ও ফি (Exam/Fine):</span>
                                  {extraCharges.map((item) => (
                                    <div key={item.id} className="flex justify-between text-amber-600 pl-2 text-[11px] font-medium">
                                      <span>• {item.description}:</span>
                                      <span>+৳{item.amount}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="pt-2 border-t border-gray-150 flex justify-between font-black text-gray-900">
                                <span>সর্বমোট দেয় (Total Payable):</span>
                                <span className="text-teal-700">৳{netPayable}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-gray-500">
                                <span>পরিশোধিত (Paid Amount):</span>
                                <span className="text-emerald-700">৳{paidAmount}</span>
                              </div>
                              {dueAmount > 0 && (
                                <div className="flex justify-between font-black text-red-600">
                                  <span>অবশিষ্ট বকেয়া (Due Amount):</span>
                                  <span>৳{dueAmount}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-100/60 pt-3.5">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs text-gray-500 font-extrabold">স্ট্যাটাস:</span>
                                <span className={`inline-block rounded-full px-3 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider border ${
                                  status === 'paid' 
                                    ? 'bg-emerald-100 text-emerald-850 border-emerald-250 shadow-sm' 
                                    : status === 'pending'
                                      ? 'bg-amber-100 text-amber-850 border-amber-250 animate-pulse'
                                      : 'bg-red-100 text-red-850 border-red-250 shadow-sm'
                                }`}>
                                  {status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending Review' : 'Unpaid'}
                                </span>
                              </div>

                              {status === 'unpaid' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReportPayment(batch, dueAmount)}
                                  disabled={reportingMap[`${batch.id}_${selectedMonth}`]}
                                  className="shimmer-btn text-xs font-black bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 transition-all duration-150 transform active:scale-95 cursor-pointer shadow-md"
                                >
                                  {reportingMap[`${batch.id}_${selectedMonth}`] ? 'Reporting...' : 'Pay/Report'}
                                </button>
                              )}
                            </div>

                            {status === 'pending' && (
                              <div className="bg-amber-50 rounded-xl p-3 border-2 border-amber-100 text-xs text-amber-900 leading-relaxed font-bold">
                                ⚠️ পেমেন্ট রিপোর্ট করা হয়েছে! শিক্ষক ভেরিফাই করলেই এটি <strong className="text-emerald-850 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-150">"Paid"</strong> এ পরিবর্তিত হবে।
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="xl:col-span-4 space-y-8">
                {/* Help Center Card */}
                <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/40 relative overflow-hidden">
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-gray-100 rounded-full blur-xl animate-float"></div>
                  <h4 className="font-display text-base sm:text-lg font-black text-gray-950 mb-2">সাহায্য প্রয়োজন? 📞</h4>
                  <p className="text-xs sm:text-sm text-gray-650 leading-relaxed font-semibold">
                    আপনার ক্লাস শিডিউল পরিবর্তন কিংবা পেমেন্ট সংক্রান্ত কোনো অভিযোগ থাকলে সংশ্লিষ্ট শিক্ষকের সাথে সরাসরি যোগাযোগ করুন।
                  </p>
                  <div className="mt-5 flex items-center space-x-2.5 text-xs sm:text-sm text-gray-750 font-extrabold border-t border-gray-100 pt-4">
                    <User className="h-5 w-5 text-gray-400 shrink-0" />
                    <span>জরুরি সাহায্য: support@coachingconnect.bd</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <StudentExamPerformance
              studentId={user.uid}
              enrolledBatches={enrolledBatches}
            />
          )}

        </div>

      </div>

      {/* Mobile Bottom Navigation Bar (PWA Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-teal-100/60 px-3 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[safe-area-inset-bottom]">
        <div className="flex items-center justify-around">
            <button
              onClick={() => setActiveTab('roadmap')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'roadmap' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'roadmap' ? 'opacity-100' : 'opacity-60 grayscale'}`}>🏠</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">রুটিন</span>
            </button>
            
            <button
              onClick={() => setActiveTab('notices')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer relative ${
                activeTab === 'notices' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'notices' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📢</span>
              {notices.length > 0 && (
                <span className="absolute top-1 right-2.5 flex h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-white animate-pulse"></span>
              )}
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">নোটিশ</span>
            </button>

            <button
              onClick={() => setActiveTab('materials')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'materials' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'materials' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📚</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">লেকচার</span>
            </button>

            <button
              onClick={() => setActiveTab('tuition')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer relative ${
                activeTab === 'tuition' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'tuition' ? 'opacity-100' : 'opacity-60 grayscale'}`}>💳</span>
              {studentPendingCount > 0 ? (
                <span className="absolute top-0.5 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-white ring-2 ring-white animate-pulse">
                  ⏳
                </span>
              ) : studentUnpaidCount > 0 ? (
                <span className="absolute top-0.5 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-white">
                  ৳
                </span>
              ) : null}
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">বেতন</span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer relative ${
                activeTab === 'exams' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'exams' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📝</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">এক্সাম</span>
            </button>
          </div>
        </div>

      {/* Student Rich Payment Reporting Modal */}
      {reportingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-600" />
                <span>পেমেন্ট রিপোর্ট করুন</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold">{reportingBatch.name} • শিক্ষক: {reportingBatch.teacherName}</p>
            </div>

            <form onSubmit={handleSubmitReportPayment} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">প্রদত্ত পরিমাণ (৳ Amount Paid) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={reportAmount || ''}
                  onChange={(e) => setReportAmount(Number(e.target.value))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 font-bold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">পেমেন্ট মেথড *</label>
                  <select
                    value={reportMethod}
                    onChange={(e) => setReportMethod(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="bKash">bKash (বিকাশ)</option>
                    <option value="Nagad">Nagad (নগদ)</option>
                    <option value="Rocket">Rocket (রকেট)</option>
                    <option value="Cash">Cash (ক্যাশ টাকা)</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">লেনদেন আইডি (TrxID)</label>
                  <input
                    type="text"
                    value={reportTrxId}
                    onChange={(e) => setReportTrxId(e.target.value)}
                    placeholder="যেমনঃ XM93K8S2"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">অতিরিক্ত তথ্য (নোট)</label>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="যেমনঃ 017xxxxxxxx নম্বর থেকে পেমেন্ট করেছি"
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                >
                  পেমেন্ট রিপোর্ট সাবমিট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setReportingBatch(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
