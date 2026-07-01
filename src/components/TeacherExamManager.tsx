import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Check, AlertTriangle, Download, TrendingUp, Award, User, Clock, ChevronRight } from 'lucide-react';
import { Batch, Exam, ExamResult, Enrollment } from '../types';
import { subscribeToBatchExams, subscribeToBatchExamResults, createExam, saveStudentExamResult } from '../dbUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid, LineChart, Line, AreaChart, Area, Legend } from 'recharts';

interface TeacherExamManagerProps {
  teacherId: string;
  batches: Batch[];
  enrollments: Enrollment[];
}

export const TeacherExamManager: React.FC<TeacherExamManagerProps> = ({ teacherId, batches, enrollments }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);

  // Create exam form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMarks, setNewMarks] = useState(50);
  const [newDate, setNewDate] = useState('');
  
  // Marks entry mode
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [marksInput, setMarksInput] = useState<Record<string, number>>({});
  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setExams([]);
      setExamResults([]);
      return;
    }

    const unsubExams = subscribeToBatchExams(selectedBatchId, (examList) => {
      setExams(examList);
    });

    return () => unsubExams();
  }, [selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setExamResults([]);
      return;
    }

    const unsubResults = subscribeToBatchExamResults(selectedBatchId, (resultList) => {
      setExamResults(resultList);
    });

    return () => unsubResults();
  }, [selectedBatchId]);

  const activeBatch = batches.find(b => b.id === selectedBatchId);
  const batchStudents = enrollments.filter(e => e.batchId === selectedBatchId && e.status === 'active');

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !activeBatch || !newTitle || newMarks <= 0 || !newDate) return;

    await createExam({
      batchId: selectedBatchId,
      batchName: activeBatch.name,
      subject: activeBatch.subject,
      title: newTitle,
      totalMarks: newMarks,
      examDate: newDate
    }, teacherId);

    setShowCreateModal(false);
    setNewTitle('');
    setNewMarks(50);
    setNewDate('');
  };

  const startEnteringMarks = (exam: Exam) => {
    setActiveExamId(exam.id);
    
    // Prefill existing marks
    const existing = examResults.filter(r => r.examId === exam.id);
    const marksInit: Record<string, number> = {};
    const remarksInit: Record<string, string> = {};
    
    existing.forEach(r => {
      marksInit[r.studentId] = r.marksObtained;
      remarksInit[r.studentId] = r.remarks || '';
    });
    
    setMarksInput(marksInit);
    setRemarksInput(remarksInit);
  };

  const handleSaveMarks = async (studentId: string, studentName: string) => {
    if (!activeExam) return;
    const marks = marksInput[studentId] || 0;
    const remarks = remarksInput[studentId] || '';
    
    await saveStudentExamResult(activeExam.id, activeExam.batchId, studentId, studentName, marks, remarks);
    // show small toast if needed, but reactiveness will handle UI
  };

  const activeExam = exams.find(e => e.id === activeExamId);

  // Analysis logic
  const getExamAverages = () => {
    return exams.map(exam => {
      const results = examResults.filter(r => r.examId === exam.id);
      if (results.length === 0) return { title: exam.title, avg: 0, date: exam.examDate, max: exam.totalMarks };
      const sum = results.reduce((acc, r) => acc + r.marksObtained, 0);
      const avgPercentage = ((sum / results.length) / exam.totalMarks) * 100;
      return {
        title: exam.title,
        avg: Math.round(avgPercentage),
        date: exam.examDate,
        max: exam.totalMarks
      };
    }).reverse(); // chronological
  };

  const trendData = getExamAverages();

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-md shadow-gray-50/50">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <span>📝</span> পরীক্ষা ও ফলাফল বিশ্লেষণ
          </h2>
          <p className="text-xs text-slate-500 mt-1">শিক্ষার্থীদের পারফরম্যান্স মূল্যায়ন এবং মার্কস এন্ট্রি</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">ব্যাচ:</label>
          <select
            value={selectedBatchId}
            onChange={(e) => {
              setSelectedBatchId(e.target.value);
              setActiveExamId(null);
            }}
            className="border-2 border-teal-600 bg-teal-50 text-teal-800 rounded-2xl px-3 py-1.5 text-xs font-black focus:outline-none cursor-pointer"
          >
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.subject})</option>
            ))}
          </select>
        </div>
      </div>

      {!activeExamId ? (
        <>
          {/* Dashboard View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Exam List */}
            <div className="lg:col-span-1 space-y-4">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl py-3 px-4 font-bold text-sm hover:bg-slate-800 transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" />
                নতুন পরীক্ষা যোগ করুন
              </button>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <BookOpen className="h-4 w-4 text-teal-600" /> 
                  ব্যাচের পরীক্ষাসমূহ
                </h3>
                
                {exams.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">কোনো পরীক্ষা পাওয়া যায়নি</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {exams.map(exam => {
                      const resultsCount = examResults.filter(r => r.examId === exam.id).length;
                      return (
                        <div key={exam.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-teal-50/50 transition-colors group">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-800">{exam.title}</h4>
                            <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">
                              {exam.totalMarks} Marks
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-3">
                            <Clock className="h-3 w-3" /> {exam.examDate}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                            <span className="text-xs font-semibold text-slate-600">
                              {resultsCount}/{batchStudents.length} খাতা দেখা হয়েছে
                            </span>
                            <button
                              onClick={() => startEnteringMarks(exam)}
                              className="text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-100/50 px-2 py-1 rounded-lg"
                            >
                              মার্কস এন্ট্রি &gt;
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Analytics */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 p-5 shadow-sm">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 mb-1">মোট পরীক্ষা</p>
                  <h3 className="font-display text-3xl font-black text-slate-900">{exams.length}</h3>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-white rounded-3xl border border-emerald-100 p-5 shadow-sm">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 mb-1">সর্বোচ্চ গড় পারফরম্যান্স</p>
                  <h3 className="font-display text-3xl font-black text-slate-900">
                    {trendData.length > 0 ? Math.max(...trendData.map(d => d.avg)) : 0}%
                  </h3>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="mb-6">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-teal-600" />
                    গড় মার্কস ট্রেন্ড (শতকরা)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">ব্যাচের শিক্ষার্থীদের সামগ্রিক অগ্রগতি</p>
                </div>
                
                <div className="h-64">
                  {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl">
                      পর্যাপ্ত ডাটা নেই
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f865f" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#0f865f" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="title" stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => val.substring(0, 10) + '...'} />
                        <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} domain={[0, 100]} />
                        <ChartTooltip 
                          contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                          formatter={(value: number) => [`${value}%`, 'গড় নম্বর']}
                        />
                        <Area type="monotone" dataKey="avg" stroke="#0f865f" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Marks Entry View */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <button 
                onClick={() => setActiveExamId(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 mb-2 flex items-center gap-1"
              >
                &larr; ফিরে যান
              </button>
              <h3 className="font-display text-lg font-black text-slate-900">{activeExam?.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                তারিখ: {activeExam?.examDate} &bull; পূর্ণমান: {activeExam?.totalMarks}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-extrabold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl rounded-bl-xl">শিক্ষার্থীর নাম</th>
                  <th className="px-4 py-3">প্রাপ্ত নম্বর</th>
                  <th className="px-4 py-3">মন্তব্য (অপশনাল)</th>
                  <th className="px-4 py-3 rounded-tr-xl rounded-br-xl text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchStudents.map(student => {
                  const currentMark = marksInput[student.studentId] ?? 0;
                  const currentRemark = remarksInput[student.studentId] ?? '';
                  const hasSaved = examResults.some(r => r.examId === activeExamId && r.studentId === student.studentId);

                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-800 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                          {student.studentName.charAt(0)}
                        </div>
                        {student.studentName}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={activeExam?.totalMarks || 100}
                            value={currentMark}
                            onChange={(e) => setMarksInput({...marksInput, [student.studentId]: Number(e.target.value)})}
                            className="w-20 border-2 border-slate-200 rounded-xl px-2 py-1.5 text-center font-bold focus:border-teal-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400 font-bold">/ {activeExam?.totalMarks}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          value={currentRemark}
                          onChange={(e) => setRemarksInput({...remarksInput, [student.studentId]: e.target.value})}
                          placeholder="যেমন: অসাধারণ!"
                          className="w-full border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleSaveMarks(student.studentId, student.studentName)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            hasSaved 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {hasSaved ? 'আপডেট' : 'সেভ করুন'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {batchStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                      এই ব্যাচে কোনো শিক্ষার্থী নেই
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-display text-xl font-bold text-slate-900">নতুন পরীক্ষা যুক্ত করুন</h3>
            </div>
            
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষার নাম/বিষয়</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="যেমন: Weekly Test 01: Physics"
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 font-medium focus:border-teal-500 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">মোট নম্বর</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newMarks}
                    onChange={e => setNewMarks(Number(e.target.value))}
                    className="w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">তারিখ</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-2xl px-4 py-2.5 font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
