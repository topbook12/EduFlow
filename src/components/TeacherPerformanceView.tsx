import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  BookOpen, 
  Sparkles, 
  Award,
  Search,
  Check,
  UserCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Batch, Enrollment, Attendance } from '../types';
import { subscribeToBatchAttendance, saveStudentAttendance, seedAttendanceIfEmpty } from '../dbUtils';

interface TeacherPerformanceViewProps {
  batches: Batch[];
  enrollments: Enrollment[];
}

const TRACKED_MONTHS = ['April 2026', 'May 2026', 'June 2026', 'July 2026'];

export const TeacherPerformanceView: React.FC<TeacherPerformanceViewProps> = ({ batches, enrollments }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  
  // Attendance logger form state
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loggingStatus, setLoggingStatus] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Auto seed and subscribe when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;

    // Seed dummy data if empty to make visual analytics ready-to-use
    seedAttendanceIfEmpty(selectedBatchId, enrollments).then(() => {
      // Subscribe to real-time attendance
      const unsubscribe = subscribeToBatchAttendance(selectedBatchId, (records) => {
        setAttendanceRecords(records);
        
        // Populate the logging form with today's/selected date's existing record if any
        const todayRecords = records.filter(r => r.date === attendanceDate);
        const initialStatus: Record<string, 'present' | 'absent' | 'late'> = {};
        todayRecords.forEach(r => {
          initialStatus[r.studentId] = r.status;
        });
        setLoggingStatus(initialStatus);
      });
      return unsubscribe;
    });
  }, [selectedBatchId, enrollments, attendanceDate]);

  const activeBatch = batches.find(b => b.id === selectedBatchId);
  const activeEnrollments = enrollments.filter(e => e.batchId === selectedBatchId && e.status === 'active');

  // Handle single student attendance log
  const handleMarkAttendance = async (studentId: string, studentName: string, status: 'present' | 'absent' | 'late') => {
    setLoggingStatus(prev => ({ ...prev, [studentId]: status }));
    try {
      await saveStudentAttendance(selectedBatchId, attendanceDate, studentId, studentName, status);
      setSuccessMsg('উপস্থিতি সফলভাবে সংরক্ষণ করা হয়েছে!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error("Failed to save attendance:", err);
    }
  };

  // Quick mark all as Present
  const handleMarkAllPresent = async () => {
    const updated: Record<string, 'present' | 'absent' | 'late'> = {};
    for (const student of activeEnrollments) {
      updated[student.studentId] = 'present';
      await saveStudentAttendance(selectedBatchId, attendanceDate, student.studentId, student.studentName, 'present');
    }
    setLoggingStatus(updated);
    setSuccessMsg('সকল শিক্ষার্থীকে উপস্থিত নিশ্চিত করা হয়েছে!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Calculate stats & metrics
  // 1. Attendance Metrics
  const totalClassesLog: string[] = Array.from(new Set(attendanceRecords.map(a => a.date))).sort() as string[];
  const latestClasses = totalClassesLog.slice(-10); // last 10 dates
  
  const overallPresentCount = attendanceRecords.filter(a => a.status === 'present').length;
  const overallLateCount = attendanceRecords.filter(a => a.status === 'late').length;
  const overallAbsentCount = attendanceRecords.filter(a => a.status === 'absent').length;
  const overallTotalCount = attendanceRecords.length;

  const attendanceRate = overallTotalCount > 0 
    ? Math.round(((overallPresentCount + overallLateCount) / overallTotalCount) * 100) 
    : 100;

  // 2. Attendance Trend Data over time
  const attendanceTrendData = totalClassesLog.map(date => {
    const dayRecords = attendanceRecords.filter(a => a.date === date);
    const present = dayRecords.filter(r => r.status === 'present').length;
    const late = dayRecords.filter(r => r.status === 'late').length;
    const absent = dayRecords.filter(r => r.status === 'absent').length;
    const total = dayRecords.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    
    // Format date beautifully to DD-MMM (e.g. 15-Jun)
    const dateObj = new Date(date as string);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
      : (date as string);

    return {
      date: date as string,
      formattedDate,
      'উপস্থিতি হার (%)': rate,
      'উপস্থিত': present,
      'বিলম্বিত': late,
      'অনুপস্থিত': absent,
      'মোট ছাত্র': total
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // 3. Payment Compliance Metrics (for selected batch & active students)
  const totalExpectedPayments = activeEnrollments.length * TRACKED_MONTHS.length;
  let totalPaidPayments = 0;
  let totalPendingPayments = 0;
  let totalUnpaidPayments = 0;

  activeEnrollments.forEach(enroll => {
    TRACKED_MONTHS.forEach(month => {
      const status = enroll.paymentStatus?.[month] || 'unpaid';
      if (status === 'paid') totalPaidPayments++;
      else if (status === 'pending') totalPendingPayments++;
      else totalUnpaidPayments++;
    });
  });

  const paymentComplianceRate = totalExpectedPayments > 0
    ? Math.round((totalPaidPayments / totalExpectedPayments) * 100)
    : 100;

  // 4. Monthly Payment Compliance breakdown
  const monthlyComplianceData = TRACKED_MONTHS.map(month => {
    let paid = 0;
    let pending = 0;
    let unpaid = 0;
    let collectedRevenue = 0;
    let expectedRevenue = 0;

    activeEnrollments.forEach(enroll => {
      const status = enroll.paymentStatus?.[month] || 'unpaid';
      const fee = enroll.customFee ?? (activeBatch?.monthlyFee || 0);
      const discount = enroll.discount || 0;
      const netFee = Math.max(0, fee - discount);

      expectedRevenue += netFee;

      if (status === 'paid') {
        paid++;
        const paidAmount = enroll.paidAmountMap?.[month] ?? netFee;
        collectedRevenue += paidAmount;
      } else if (status === 'pending') {
        pending++;
        // maybe partially paid
        const paidAmount = enroll.paidAmountMap?.[month] ?? 0;
        collectedRevenue += paidAmount;
      } else {
        unpaid++;
      }
    });

    return {
      month,
      'পরিশোধিত': paid,
      'যাচাই অপেক্ষারত': pending,
      'বকেয়া': unpaid,
      'আদায়কৃত টাকা (৳)': collectedRevenue,
      'বকেয়া টাকা (৳)': Math.max(0, expectedRevenue - collectedRevenue),
      'মোট সম্ভাব্য আদায় (৳)': expectedRevenue
    };
  });

  // 5. Individual Student performance row metrics
  const studentPerformanceMetrics = activeEnrollments.map(student => {
    const studentAttendance = attendanceRecords.filter(a => a.studentId === student.studentId);
    const present = studentAttendance.filter(a => a.status === 'present').length;
    const late = studentAttendance.filter(a => a.status === 'late').length;
    const total = studentAttendance.length;
    const attRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

    let paidMonths = 0;
    TRACKED_MONTHS.forEach(m => {
      if (student.paymentStatus?.[m] === 'paid') paidMonths++;
    });
    const payRate = Math.round((paidMonths / TRACKED_MONTHS.length) * 100);

    let performanceStatus: 'excellent' | 'good' | 'warning' = 'good';
    if (attRate >= 85 && payRate >= 75) performanceStatus = 'excellent';
    else if (attRate < 60 || payRate < 50) performanceStatus = 'warning';

    return {
      ...student,
      attRate,
      payRate,
      performanceStatus
    };
  });

  return (
    <div className="space-y-8 animate-fade-in" id="performance-tab-view">
      {/* Batch Header & Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-md shadow-gray-50/50">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <span>📈</span> ব্যাচ পারফরম্যান্স এবং ট্রেন্ড অ্যানালিটিক্স
          </h2>
          <p className="text-xs text-slate-500 mt-1">শিক্ষার্থীদের ক্লাস উপস্থিতি ও বেতন পরিশোধের প্রগতিশীল চিত্র</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">ব্যাচ নির্বাচন করুন:</label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="border-2 border-teal-600 bg-teal-50 text-teal-800 rounded-2xl px-3 py-1.5 text-xs font-black focus:outline-none cursor-pointer"
          >
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.subject})</option>
            ))}
          </select>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-md">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 font-medium">কোনো সক্রিয় ব্যাচ পাওয়া যায়নি। পারফরম্যান্স দেখতে একটি ব্যাচ তৈরি করুন।</p>
        </div>
      ) : activeEnrollments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-md">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 font-medium">এই ব্যাচে কোনো সক্রিয় শিক্ষার্থী ভর্তি নেই।</p>
          <p className="text-xs text-slate-400 mt-1">শিক্ষার্থীরা যুক্ত হলে তাদের উপস্থিতি ও পেমেন্ট অ্যানালিটিক্স এখানে লোড হবে।</p>
        </div>
      ) : (
        <>
          {/* Key Metric Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1 */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">গড় উপস্থিতি হার</p>
                  <h3 className="font-display text-2xl font-black text-slate-900 mt-1">{attendanceRate}%</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <UserCheck className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="text-emerald-600 font-extrabold">✓ সন্তোষজনক</span>
                <span className="text-slate-400">• সর্বমোট {overallTotalCount} লেকচার লগ</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">বেতন পরিশোধ হার</p>
                  <h3 className="font-display text-2xl font-black text-slate-900 mt-1">{paymentComplianceRate}%</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <TrendingUp className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="text-indigo-600 font-bold">৳ {totalPaidPayments} Paid</span>
                <span className="text-slate-400">• মোট {totalExpectedPayments} ইনভয়েস</span>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-amber-50/50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">যাচাই অপেক্ষারত</p>
                  <h3 className="font-display text-2xl font-black text-slate-900 mt-1">{totalPendingPayments} টি</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <Clock className="h-6 w-6 animate-pulse" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-800">
                <span className="font-bold">⚠️ ভেরিফিকেশন প্রয়োজন</span>
              </div>
            </div>

            {/* Metric 4 */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-rose-50/50 to-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">বকেয়া পেমেন্ট</p>
                  <h3 className="font-display text-2xl font-black text-rose-600 mt-1">{totalUnpaidPayments} টি</h3>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-800">
                <span className="font-bold">🚨 তাগাদা দিন</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart 1: Attendance Trend Over Time */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md shadow-gray-50/50">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>📅</span> উপস্থিতি হার ট্রেন্ডলাইন
                  </h3>
                  <p className="text-[10px] text-slate-400">প্রতিটি ক্লাসের গড় উপস্থিতি হারের গতিপথ</p>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold">রিয়েল-টাইম</span>
              </div>

              <div className="h-72">
                {attendanceTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    উপস্থিতির কোনো তথ্য পাওয়া যায়নি
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} domain={[0, 100]} />
                      <ChartTooltip 
                        contentStyle={{ background: '#0f172a', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="উপস্থিতি হার (%)" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAtt)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Payment Compliance Breakdown */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md shadow-gray-50/50">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>💳</span> মাসিক পেমেন্ট কমপ্লায়েন্স ব্রেকডাউন
                  </h3>
                  <p className="text-[10px] text-slate-400">মাসিক পরিশোধিত ও বকেয়া চালানের অনুপাত</p>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComplianceData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <ChartTooltip 
                      contentStyle={{ background: '#0f172a', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '10px' }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="পরিশোধিত" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="যাচাই অপেক্ষারত" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="বকেয়া" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Section 2: Attendance Logger & Roster Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Interactive Attendance Logger (Quick-Log Form) */}
            <div className="lg:col-span-5 rounded-3xl border border-slate-100 bg-slate-50/50 p-6 shadow-sm">
              <div className="border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>📝</span> দ্রুত উপস্থিতি গ্রহণ করুন (Quick Attendance)
                  </h3>
                  <button
                    onClick={handleMarkAllPresent}
                    className="text-[10px] font-bold text-teal-700 bg-teal-100/60 hover:bg-teal-100 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  >
                    সবাইকে উপস্থিত করুন
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">তারিখ সিলেক্ট করে নিচে শিক্ষার্থীদের টিক দিন</p>
              </div>

              {/* Date Selector */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ক্লাসের তারিখ:</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {successMsg && (
                <div className="mb-3 text-[10px] font-bold bg-emerald-50 text-emerald-800 rounded-xl p-2 text-center border border-emerald-100">
                  {successMsg}
                </div>
              )}

              {/* Student Roster Log Rows */}
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                {activeEnrollments.map(student => {
                  const status = loggingStatus[student.studentId];
                  return (
                    <div key={student.studentId} className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-150">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-extrabold text-slate-800 truncate">{student.studentName}</p>
                        <p className="text-[9px] text-slate-400 truncate">{student.studentPhone}</p>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMarkAttendance(student.studentId, student.studentName, 'present')}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                            status === 'present'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          উপস্থিত
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkAttendance(student.studentId, student.studentName, 'late')}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                            status === 'late'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          দেরি
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkAttendance(student.studentId, student.studentName, 'absent')}
                          className={`px-2.5 py-1 text-[10px] font-extrabold rounded-xl transition-all cursor-pointer ${
                            status === 'absent'
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          অনুপস্থিত
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student Performance Matrix Table */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-100 bg-white p-6 shadow-md shadow-gray-50/50">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-display text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>🏆</span> শিক্ষার্থী-ভিত্তিক পারফরম্যান্স ইন্ডিকেটর
                </h3>
                <p className="text-[10px] text-slate-400">ব্যক্তিগত উপস্থিতি হার ও পেমেন্ট কমপ্লায়েন্স স্ট্যাটাস</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5">শিক্ষার্থীর নাম</th>
                      <th className="py-2.5 text-center">উপস্থিতি হার</th>
                      <th className="py-2.5 text-center">পরিশোধ হার</th>
                      <th className="py-2.5 text-right">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentPerformanceMetrics.map(student => (
                      <tr key={student.id} className="text-xs">
                        <td className="py-3">
                          <div className="font-extrabold text-slate-800">{student.studentName}</div>
                          <div className="text-[9px] text-slate-400">{student.studentPhone}</div>
                        </td>
                        <td className="py-3 text-center font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded-full ${
                            student.attRate >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {student.attRate}%
                          </span>
                        </td>
                        <td className="py-3 text-center font-bold">
                          <span className={`inline-block px-2 py-0.5 rounded-full ${
                            student.payRate >= 75 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {student.payRate}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {student.performanceStatus === 'excellent' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                              <Award className="h-3 w-3" /> চমৎকার
                            </span>
                          ) : student.performanceStatus === 'warning' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                              ⚠️ সতর্কাবস্থা
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              ✓ সন্তোষজনক
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
