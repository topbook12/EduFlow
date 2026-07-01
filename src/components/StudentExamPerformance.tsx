import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, AlertTriangle, CheckCircle, BookOpen, Clock } from 'lucide-react';
import { Batch, Exam, ExamResult, Enrollment } from '../types';
import { subscribeToBatchExams, subscribeToExamResults } from '../dbUtils';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as ChartTooltip, BarChart, Bar, Cell } from 'recharts';

interface StudentExamPerformanceProps {
  studentId: string;
  enrolledBatches: Batch[];
}

export const StudentExamPerformance: React.FC<StudentExamPerformanceProps> = ({ studentId, enrolledBatches }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);

  useEffect(() => {
    if (enrolledBatches.length === 0) return;

    // We need to subscribe to exams for ALL enrolled batches
    const unsubscribes: (() => void)[] = [];
    let allExams: Exam[] = [];

    enrolledBatches.forEach(batch => {
      const unsub = subscribeToBatchExams(batch.id, (batchExams) => {
        allExams = [...allExams.filter(e => e.batchId !== batch.id), ...batchExams];
        setExams([...allExams]);
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [enrolledBatches]);

  useEffect(() => {
    const examIds = exams.map(e => e.id);
    if (examIds.length === 0) {
      setResults([]);
      return;
    }

    const unsub = subscribeToExamResults(examIds, (resList) => {
      // Only keep this student's results
      setResults(resList.filter(r => r.studentId === studentId));
    });

    return () => unsub();
  }, [exams, studentId]);

  // Analytics Calculation
  const getSubjectPerformance = () => {
    const subjectMap: Record<string, { totalEarned: number, totalMax: number, count: number }> = {};

    results.forEach(res => {
      const exam = exams.find(e => e.id === res.examId);
      if (exam) {
        if (!subjectMap[exam.subject]) {
          subjectMap[exam.subject] = { totalEarned: 0, totalMax: 0, count: 0 };
        }
        subjectMap[exam.subject].totalEarned += res.marksObtained;
        subjectMap[exam.subject].totalMax += exam.totalMarks;
        subjectMap[exam.subject].count++;
      }
    });

    return Object.keys(subjectMap).map(subj => {
      const data = subjectMap[subj];
      const percentage = (data.totalEarned / data.totalMax) * 100;
      return {
        subject: subj,
        percentage: Math.round(percentage),
        count: data.count
      };
    });
  };

  const subjectPerf = getSubjectPerformance();
  const sortedSubj = [...subjectPerf].sort((a, b) => b.percentage - a.percentage);
  
  const bestSubject = sortedSubj.length > 0 ? sortedSubj[0] : null;
  const weakSubject = sortedSubj.length > 0 && sortedSubj[sortedSubj.length - 1].percentage < 60 ? sortedSubj[sortedSubj.length - 1] : null;

  const totalExams = results.length;
  const avgPercentage = totalExams > 0 
    ? Math.round(results.reduce((acc, r) => {
        const exam = exams.find(e => e.id === r.examId);
        if (!exam) return acc;
        return acc + (r.marksObtained / exam.totalMarks) * 100;
      }, 0) / totalExams)
    : 0;

  // Trend Data for overall progress
  const trendData = results.map(res => {
    const exam = exams.find(e => e.id === res.examId);
    return {
      title: exam?.title || 'Unknown',
      date: exam?.examDate || '',
      percentage: exam ? Math.round((res.marksObtained / exam.totalMarks) * 100) : 0
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md shadow-gray-50/50">
        <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <span>📊</span> আমার পরীক্ষার পারফরম্যান্স
        </h2>
        <p className="text-xs text-slate-500 mt-1">সবগুলো কোচিংয়ের পরীক্ষার ফলাফল ও এনালাইসিস</p>
      </div>

      {totalExams === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-md">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 font-medium">কোনো পরীক্ষার ফলাফল পাওয়া যায়নি</p>
          <p className="text-xs text-slate-400 mt-1">পরীক্ষা দিলে এখানে আপনার পারফরম্যান্স দেখা যাবে।</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 mb-1">মোট পরীক্ষা</p>
              <h3 className="font-display text-3xl font-black text-slate-900">{totalExams}</h3>
            </div>
            
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 mb-1">গড় পারফরম্যান্স</p>
              <h3 className="font-display text-3xl font-black text-slate-900">{avgPercentage}%</h3>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-amber-50/80 to-white p-6 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 mb-1">সেরা বিষয়</p>
              <h3 className="font-display text-xl font-black text-slate-900 mt-1 truncate">
                {bestSubject?.subject || 'N/A'}
              </h3>
            </div>
          </div>

          {weakSubject && (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 flex gap-4 items-start shadow-sm">
              <AlertTriangle className="h-6 w-6 text-rose-500 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-rose-800 text-sm">সতর্কতা: {weakSubject.subject} বিষয়ে দুর্বলতা</h4>
                <p className="text-xs text-rose-600 mt-1">
                  এই বিষয়ে আপনার গড় মার্কস মাত্র {weakSubject.percentage}%। এখানে আপনার আরও বেশি মনোযোগ দেওয়া প্রয়োজন।
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject wise performance chart */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">বিষয়ভিত্তিক পারফরম্যান্স</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectPerf} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="subject" type="category" width={80} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <ChartTooltip 
                      contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                      formatter={(value: number) => [`${value}%`, 'নম্বর']}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
                      {subjectPerf.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percentage > 75 ? '#10b981' : entry.percentage > 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overall Trend */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 text-sm mb-4">প্রগ্রেস রেট (ট্রেন্ড)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="title" stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => val.substring(0, 10) + '...'} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} domain={[0, 100]} />
                    <ChartTooltip 
                      contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                      formatter={(value: number) => [`${value}%`, 'প্রাপ্ত নম্বর']}
                    />
                    <Area type="monotone" dataKey="percentage" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProgress)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">সাম্প্রতিক ফলাফলসমূহ</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {results.slice().reverse().map(res => {
                const exam = exams.find(e => e.id === res.examId);
                const perc = exam ? Math.round((res.marksObtained / exam.totalMarks) * 100) : 0;
                let badgeColor = 'bg-rose-100 text-rose-700';
                if (perc >= 80) badgeColor = 'bg-emerald-100 text-emerald-700';
                else if (perc >= 60) badgeColor = 'bg-amber-100 text-amber-700';

                return (
                  <div key={res.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{exam?.title || 'Unknown Exam'}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{exam?.batchName} &bull; {exam?.examDate}</p>
                      {res.remarks && (
                        <p className="text-[11px] text-slate-600 mt-2 bg-slate-100 px-2 py-1 rounded-md inline-block">
                          শিক্ষকের মন্তব্য: {res.remarks}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display font-black text-lg text-slate-900">
                        {res.marksObtained} <span className="text-xs text-slate-400 font-bold">/ {exam?.totalMarks}</span>
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {perc}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
