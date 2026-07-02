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
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Upload, 
  Filter, 
  Edit, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  LayoutGrid,
  List,
  CalendarDays,
  Download
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, Legend, LineChart, Line, AreaChart, Area, CartesianGrid } from 'recharts';
import { 
  createBatch, 
  updateBatchSchedule, 
  updateBatchInfo,
  uploadStudyMaterial, 
  postNotice, 
  confirmPaymentStatus, 
  deleteBatch,
  subscribeToTeacherBatches,
  subscribeToBatchEnrollments,
  subscribeToTeacherNotices,
  subscribeToTeacherMaterials,
  updateEnrollmentBilling,
  recordStudentPayment,
  rejectStudentPayment,
  removeStudentFromBatch,
  updateStudentExtraCharges,
  updateBatchWideExtraCharges,
  subscribeToBatchAttendance,
  saveStudentAttendance,
  seedAttendanceIfEmpty
} from '../dbUtils';
import { AppUser, Batch, Enrollment, StudyMaterial, Notice, BatchSchedule, ExtraCharge, Attendance } from '../types';
import { generateTeacherReport } from '../utils/reportGenerator';
import { TeacherPerformanceView } from './TeacherPerformanceView';
import { TeacherExamManager } from './TeacherExamManager';
import { motion } from 'motion/react';
import { WeeklyCalendarView } from './WeeklyCalendarView';

interface TeacherDashboardProps {
  user: AppUser;
}

const DAYS_OF_WEEK: BatchSchedule['day'][] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const BENGALI_DAYS: Record<string, string> = {
  Sunday: 'রবিবার',
  Monday: 'সোমবার',
  Tuesday: 'মঙ্গলবার',
  Wednesday: 'বুধবার',
  Thursday: 'বৃহস্পতিবার',
  Friday: 'শুক্রবার',
  Saturday: 'শনিবার',
};

const formatTimeTo12Hour = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayHourStr = String(displayHour).padStart(2, '0');
  return `${displayHourStr}:${minStr} ${ampm}`;
};

const getBatchAccentColors = (index: number) => {
  const colorSets = [
    { bg: 'bg-emerald-50/70', text: 'text-emerald-850', border: 'border-emerald-250/70', hover: 'hover:bg-emerald-100/50', ring: 'ring-emerald-100', textLight: 'text-emerald-500' },
    { bg: 'bg-violet-50/70', text: 'text-violet-850', border: 'border-violet-250/70', hover: 'hover:bg-violet-100/50', ring: 'ring-violet-100', textLight: 'text-violet-500' },
    { bg: 'bg-amber-50/70', text: 'text-amber-850', border: 'border-amber-250/70', hover: 'hover:bg-amber-100/50', ring: 'ring-amber-100', textLight: 'text-amber-500' },
    { bg: 'bg-rose-50/70', text: 'text-rose-850', border: 'border-rose-250/70', hover: 'hover:bg-rose-100/50', ring: 'ring-rose-100', textLight: 'text-rose-500' },
    { bg: 'bg-sky-50/70', text: 'text-sky-850', border: 'border-sky-250/70', hover: 'hover:bg-sky-100/50', ring: 'ring-sky-100', textLight: 'text-sky-500' },
    { bg: 'bg-indigo-50/70', text: 'text-indigo-850', border: 'border-indigo-250/70', hover: 'hover:bg-indigo-100/50', ring: 'ring-indigo-100', textLight: 'text-indigo-500' },
  ];
  return colorSets[index % colorSets.length];
};

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

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const availableMonths = useMemo(() => generateMonthsList(), []);
  
  // Database States
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);

  // Form States (New Batch)
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchSubject, setNewBatchSubject] = useState('');
  const [newBatchFee, setNewBatchFee] = useState(1200);
  const [selectedDays, setSelectedDays] = useState<BatchSchedule[]>([]);
  const [currentDay, setCurrentDay] = useState<BatchSchedule['day']>('Sunday');
  const [currentTime, setCurrentTime] = useState('16:00');
  
  // Form States (Notice Board)
  const [broadcastTargetBatchId, setBroadcastTargetBatchId] = useState('');
  const [broadcastType, setBroadcastType] = useState<Notice['type']>('general');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Form States (Study Material)
  const [materialTargetBatchId, setMaterialTargetBatchId] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [materialLink, setMaterialLink] = useState('');

  // Form States (Schedule Edit)
  const [editRoutineBatchId, setEditRoutineBatchId] = useState('');
  const [editDays, setEditDays] = useState<BatchSchedule[]>([]);
  const [editChangeNote, setEditChangeNote] = useState('');

  // Form States (Batch Details Edit)
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [editBatchName, setEditBatchName] = useState('');
  const [editBatchSubject, setEditBatchSubject] = useState('');
  const [editBatchFee, setEditBatchFee] = useState(1200);

  // Advanced Student & Payment Management States
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [customStudentName, setCustomStudentName] = useState('');
  const [customStudentPhone, setCustomStudentPhone] = useState('');
  const [customStudentInstitution, setCustomStudentInstitution] = useState('');
  const [customStudentFee, setCustomStudentFee] = useState(1200);
  const [customStudentDiscount, setCustomStudentDiscount] = useState(0);
  const [customStudentStatus, setCustomStudentStatus] = useState<'active' | 'pending'>('active');

  const [payingEnrollment, setPayingEnrollment] = useState<Enrollment | null>(null);
  const [recordAmount, setRecordAmount] = useState<number>(0);
  const [recordMethod, setRecordMethod] = useState<string>('Cash');
  const [recordTrxId, setRecordTrxId] = useState<string>('');
  const [recordNote, setRecordNote] = useState<string>('');

  // Advanced manual extra charges states (e.g., Exam fees, late fine, etc.)
  const [managingExtraChargesEnrollment, setManagingExtraChargesEnrollment] = useState<Enrollment | null>(null);
  const [newExtraChargeDesc, setNewExtraChargeDesc] = useState('');
  const [newExtraChargeAmount, setNewExtraChargeAmount] = useState<number>(0);
  const [currentExtraChargesList, setCurrentExtraChargesList] = useState<ExtraCharge[]>([]);

  // Batch-wide extra charges states
  const [showBatchWideChargeModal, setShowBatchWideChargeModal] = useState(false);
  const [batchWideChargeDesc, setBatchWideChargeDesc] = useState('');
  const [batchWideChargeAmount, setBatchWideChargeAmount] = useState<number>(0);

  // Safe non-blocking modal confirmation states
  const [showDeleteBatchId, setShowDeleteBatchId] = useState<string | null>(null);
  const [showRemoveStudentInfo, setShowRemoveStudentInfo] = useState<{ batchId: string; studentId: string; name: string } | null>(null);
  
  // Rejection and payment controls
  const [rejectingStudentEnrollment, setRejectingStudentEnrollment] = useState<Enrollment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // UI Filter States
  const [paymentFilterMonth, setPaymentFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'pending' | 'unpaid'>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Notification States
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'batches' | 'broadcast' | 'materials' | 'students' | 'performance' | 'exams'>('batches');
  const [scheduleViewMode, setScheduleViewMode] = useState<'calendar' | 'cards' | 'list'>('calendar');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPortalNode(document.getElementById('desktop-nav-portal'));
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Listen to Teacher's Batches
  useEffect(() => {
    const unsubscribe = subscribeToTeacherBatches(user.uid, (batchList) => {
      setBatches(batchList);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Synchronize selectedBatchId when batches change (e.g. deletion, initial load)
  useEffect(() => {
    if (batches.length > 0) {
      if (!selectedBatchId || (!batches.some(b => b.id === selectedBatchId) && selectedBatchId !== 'all')) {
        const firstId = batches[0].id;
        setSelectedBatchId(firstId);
        setBroadcastTargetBatchId(firstId);
        setMaterialTargetBatchId(firstId);
        setEditRoutineBatchId(firstId);
      }
    } else {
      setSelectedBatchId('');
    }
  }, [batches, selectedBatchId]);

  // 2. Listen to Enrollments, Notices, and Materials based on Teacher ID
  useEffect(() => {
    if (batches.length === 0) return;

    const batchIds = batches.map(b => b.id);

    // Listen to all enrollments for this teacher's batches
    const unsubscribe = subscribeToBatchEnrollments(batchIds, (enrollmentList) => {
      setEnrollments(enrollmentList);
    });

    // Listen to notices published by this teacher
    const unsubNotices = subscribeToTeacherNotices(user.uid, (noticeList) => {
      setNotices(noticeList);
    });

    // Listen to materials uploaded by this teacher
    const unsubMaterials = subscribeToTeacherMaterials(user.uid, (materialList) => {
      setMaterials(materialList);
    });

    return () => {
      unsubscribe();
      unsubNotices();
      unsubMaterials();
    };
  }, [batches]);

  // Handle adding a day/time block during batch creation
  const handleAddScheduleBlock = () => {
    // Check if day already added
    if (selectedDays.some(s => s.day === currentDay)) {
      setErrorMsg(`Day ${currentDay} is already added in this routine.`);
      return;
    }
    setSelectedDays(prev => [...prev, { day: currentDay, time: currentTime }]);
    setErrorMsg('');
  };

  // Generate Invite Code (6 characters unique prefix-based)
  const generateInviteCode = (subName: string): string => {
    const cleanSub = subName.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${cleanSub || 'BAT'}-${randomNum}`;
  };

  // Handle Creating a Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newBatchName.trim() || !newBatchSubject.trim()) {
      setErrorMsg("Batch name and Subject are required.");
      return;
    }

    if (selectedDays.length === 0) {
      setErrorMsg("Please add at least one day and time to the routine.");
      return;
    }

    setLoading(true);
    try {
      const inviteCode = generateInviteCode(newBatchSubject);
      const batchId = await createBatch({
        name: newBatchName.trim(),
        subject: newBatchSubject.trim(),
        teacherId: user.uid,
        teacherName: user.name,
        schedule: selectedDays,
        monthlyFee: newBatchFee,
        code: inviteCode
      });

      setSuccessMsg(`Batch "${newBatchName}" created successfully! Code: ${inviteCode}`);
      setNewBatchName('');
      setNewBatchSubject('');
      setSelectedDays([]);
      setShowCreateBatch(false);
    } catch (err: any) {
      console.error("Error creating batch:", err);
      setErrorMsg("Failed to create batch. Please check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Broadcaster
  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim() || !broadcastTargetBatchId) return;

    setLoading(true);
    try {
      const targetBatch = batches.find(b => b.id === broadcastTargetBatchId);
      if (!targetBatch) return;

      await postNotice(
        broadcastTargetBatchId,
        targetBatch.name,
        user.uid,
        user.name,
        broadcastType,
        broadcastMessage.trim()
      );

      setSuccessMsg("Notice successfully published to batch students!");
      setBroadcastMessage('');
    } catch (error) {
      setErrorMsg("Failed to broadcast notice.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Upload Study Material
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim() || !materialLink.trim() || !materialTargetBatchId) return;

    setLoading(true);
    try {
      const targetBatch = batches.find(b => b.id === materialTargetBatchId);
      if (!targetBatch) return;

      await uploadStudyMaterial(
        materialTargetBatchId,
        targetBatch.name,
        user.uid,
        materialTitle.trim(),
        materialDesc.trim(),
        materialLink.trim()
      );

      setSuccessMsg(`Material "${materialTitle}" has been shared with students!`);
      setMaterialTitle('');
      setMaterialDesc('');
      setMaterialLink('');
    } catch (error) {
      setErrorMsg("Failed to share material.");
    } finally {
      setLoading(false);
    }
  };

  // Edit/Change Routine and Auto-notify Students in that Batch
  const handleUpdateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoutineBatchId || editDays.length === 0) {
      setErrorMsg("Please select a batch and set at least one routine day.");
      return;
    }

    setLoading(true);
    try {
      const targetBatch = batches.find(b => b.id === editRoutineBatchId);
      if (!targetBatch) return;

      await updateBatchSchedule(
        editRoutineBatchId,
        targetBatch.name,
        user.uid,
        user.name,
        editDays,
        editChangeNote.trim()
      );

      setSuccessMsg(`Routine updated live and students of "${targetBatch.name}" have been notified!`);
      setEditChangeNote('');
      setEditDays([]);
    } catch (error) {
      setErrorMsg("Failed to update schedule routine.");
    } finally {
      setLoading(false);
    }
  };

  // Download Batch Summary PDF Report
  const handleDownloadReport = () => {
    try {
      generateTeacherReport({
        teacherName: user.name,
        batches,
        enrollments,
        selectedMonth: paymentFilterMonth
      });
      setSuccessMsg('ব্যাচ ও আর্থিক সামারি পিডিএফ রিপোর্টটি সফলভাবে ডাউনলোড হয়েছে!');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setErrorMsg('পিডিএফ রিপোর্ট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  // Download Tuition Payment Status as CSV
  const handleDownloadCSV = () => {
    try {
      const roster = getSelectedBatchRoster();
      if (roster.length === 0) {
        setErrorMsg('ডাউনলোড করার জন্য কোনো তথ্য পাওয়া যায়নি।');
        return;
      }

      // Headers for CSV
      const headers = [
        'Student Name (শিক্ষার্থীর নাম)',
        'Phone (মোবাইল নম্বর)',
        'Email (ইমেইল)',
        'Institution (শিক্ষা প্রতিষ্ঠান)',
        'Batch Name (ব্যাচ)',
        'Base Fee (নির্ধারিত বেতন)',
        'Discount (ছাড়)',
        'Extra Charges (অতিরিক্ত ফি/জরিমানা)',
        'Total Payable (মোট প্রদেয়)',
        'Amount Paid (পরিশোধিত)',
        'Due (বকেয়া)',
        'Payment Status (স্ট্যাটাস)',
        'Trx ID / Notes (ট্রানজেকশন/মন্তব্য)'
      ];

      const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')];

      roster.forEach(student => {
        const studentBatch = batches.find(b => b.id === student.batchId);
        const bName = studentBatch ? studentBatch.name : 'Unknown';
        const defFee = studentBatch?.monthlyFee || 1200;
        const fee = student.customFee !== undefined ? student.customFee : defFee;
        const discount = student.discount || 0;
        const extraChargesSum = student.extraCharges?.[paymentFilterMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
        const netPayable = Math.max(0, fee - discount) + extraChargesSum;

        const paid = student.paidAmountMap?.[paymentFilterMonth] !== undefined
          ? student.paidAmountMap[paymentFilterMonth]
          : (student.paymentStatus?.[paymentFilterMonth] === 'paid' ? netPayable : 0);

        const due = Math.max(0, netPayable - paid);
        const status = student.paymentStatus?.[paymentFilterMonth] || 'unpaid';
        
        // Map status to readable format
        let statusText = 'Unpaid (বকেয়া)';
        if (status === 'paid') statusText = 'Paid (পরিশোধিত)';
        else if (status === 'pending') statusText = 'Pending Review (পেন্ডিং)';

        // Combine recent transactions/notes
        const monthTx = student.paymentHistory?.filter(t => t.month === paymentFilterMonth) || [];
        const txDetail = monthTx.map(t => `${t.amount} via ${t.method}${t.trxId ? ` [TrxID: ${t.trxId}]` : ''}${t.note ? ` (${t.note})` : ''}`).join('; ');

        const row = [
          student.studentName,
          student.studentPhone,
          student.studentEmail,
          student.studentInstitution || 'N/A',
          bName,
          fee.toString(),
          discount.toString(),
          extraChargesSum.toString(),
          netPayable.toString(),
          paid.toString(),
          due.toString(),
          statusText,
          txDetail || 'N/A'
        ];

        csvRows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
      });

      const csvContent = "\ufeff" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tuition_Payments_${paymentFilterMonth.replace(/\s+/g, '_')}_${selectedBatchId === 'all' ? 'All_Batches' : (batches.find(b => b.id === selectedBatchId)?.name || 'Batch').replace(/\s+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg(`পেমেন্ট রিপোর্ট (${paymentFilterMonth}) সফলভাবে CSV ফরম্যাটে ডাউনলোড হয়েছে!`);
    } catch (err) {
      console.error('CSV Generation Error:', err);
      setErrorMsg('CSV রিপোর্ট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  // Confirm/Alter Student Payment Status
  const handleVerifyPayment = async (batchId: string, studentId: string, status: 'paid' | 'unpaid') => {
    try {
      await confirmPaymentStatus(batchId, studentId, paymentFilterMonth, status);
      setSuccessMsg("পেমেন্ট সফলভাবে একসেপ্ট করা হয়েছে ও পেমেন্ট স্ট্যাটাস আপডেট হয়েছে!");
    } catch (error) {
      console.error("Failed to update payment status:", error);
    }
  };

  // Open rejection UI for pending payment
  const handleRejectPayment = (student: Enrollment) => {
    setRejectingStudentEnrollment(student);
    setRejectionReason('ভুল ট্রানজেকশন আইডি অথবা পরিশোধিত টাকা পাওয়া যায়নি।');
  };

  // Handle submit of payment rejection
  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingStudentEnrollment) return;
    try {
      setLoading(true);
      await rejectStudentPayment(
        rejectingStudentEnrollment.batchId,
        rejectingStudentEnrollment.studentId,
        paymentFilterMonth,
        rejectionReason
      );
      setSuccessMsg(`${rejectingStudentEnrollment.studentName}-এর পেমেন্ট রিকোয়েস্টটি সফলভাবে প্রত্যাখ্যান করা হয়েছে।`);
      setRejectingStudentEnrollment(null);
      setRejectionReason('');
    } catch (error) {
      console.error("Rejection failed:", error);
      setErrorMsg("পেমেন্ট প্রত্যাখ্যান করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // Process direct cash payment for student
  const handleDirectCashPayment = async (student: Enrollment, dueAmount: number) => {
    try {
      setLoading(true);
      await recordStudentPayment(
        student.batchId,
        student.studentId,
        paymentFilterMonth,
        dueAmount,
        'Cash',
        '',
        'সরাসরি ক্যাশে গ্রহণ করা হয়েছে'
      );
      setSuccessMsg(`${student.studentName}-এর ক্যাশ পেমেন্ট ৳${dueAmount} সফলভাবে রেকর্ড করা হয়েছে!`);
    } catch (error) {
      console.error("Failed to record cash payment:", error);
      setErrorMsg("ক্যাশ পেমেন্ট রেকর্ড করতে ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // Delete Batch Helper
  const handleDeleteBatch = async (batchId: string) => {
    try {
      await deleteBatch(batchId);
      setSuccessMsg("Batch successfully archived.");
      setShowDeleteBatchId(null);
    } catch (error) {
      console.error("Archive error:", error);
      setErrorMsg("Failed to archive/delete batch.");
    }
  };

  // Open edit modal for student
  const handleOpenEditStudent = (student: Enrollment) => {
    setEditingEnrollment(student);
    setCustomStudentName(student.studentName);
    setCustomStudentPhone(student.studentPhone);
    setCustomStudentInstitution(student.studentInstitution || '');
    const studentBatch = batches.find(b => b.id === student.batchId);
    setCustomStudentFee(student.customFee !== undefined ? student.customFee : (studentBatch?.monthlyFee || 1200));
    setCustomStudentDiscount(student.discount || 0);
    setCustomStudentStatus(student.status);
  };

  // Submit edit for student enrollment details
  const handleSubmitEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnrollment) return;
    setLoading(true);
    try {
      await updateEnrollmentBilling(editingEnrollment.batchId, editingEnrollment.studentId, {
        studentName: customStudentName.trim(),
        studentPhone: customStudentPhone.trim(),
        studentInstitution: customStudentInstitution.trim() || undefined,
        customFee: customStudentFee,
        discount: customStudentDiscount,
        status: customStudentStatus
      });
      setSuccessMsg("Student details and billing updated successfully!");
      setEditingEnrollment(null);
    } catch (err) {
      console.error("Failed to update student details:", err);
      setErrorMsg("Failed to update student details.");
    } finally {
      setLoading(false);
    }
  };

  // Open record payment modal
  const handleOpenRecordPayment = (student: Enrollment) => {
    setPayingEnrollment(student);
    const studentBatch = batches.find(b => b.id === student.batchId);
    const fee = student.customFee !== undefined ? student.customFee : (studentBatch?.monthlyFee || 1200);
    const discount = student.discount || 0;
    const netPayable = Math.max(0, fee - discount);
    const paid = student.paidAmountMap?.[paymentFilterMonth] || 0;
    const due = Math.max(0, netPayable - paid);
    
    setRecordAmount(due); // default to remaining dues
    setRecordMethod('Cash');
    setRecordTrxId('');
    setRecordNote('');
  };

  // Submit recorded payment
  const handleSubmitRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingEnrollment) return;
    if (recordAmount <= 0) {
      setErrorMsg("জমার পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }
    setLoading(true);
    try {
      await recordStudentPayment(
        payingEnrollment.batchId,
        payingEnrollment.studentId,
        paymentFilterMonth,
        recordAmount,
        recordMethod,
        recordTrxId,
        recordNote
      );
      setSuccessMsg(`৳${recordAmount} payment recorded for ${payingEnrollment.studentName}!`);
      setPayingEnrollment(null);
    } catch (err) {
      console.error("Failed to record payment:", err);
      setErrorMsg("Failed to record payment.");
    } finally {
      setLoading(false);
    }
  };

  // Submit student removal/unenrollment
  const handleRemoveStudent = async () => {
    if (!showRemoveStudentInfo) return;
    setLoading(true);
    try {
      await removeStudentFromBatch(showRemoveStudentInfo.batchId, showRemoveStudentInfo.studentId);
      setSuccessMsg(`${showRemoveStudentInfo.name} removed from batch successfully.`);
      setShowRemoveStudentInfo(null);
    } catch (err) {
      console.error("Failed to remove student:", err);
      setErrorMsg("Failed to remove student.");
    } finally {
      setLoading(false);
    }
  };

  // Open extra charges modal
  const handleOpenExtraCharges = (student: Enrollment) => {
    setManagingExtraChargesEnrollment(student);
    setCurrentExtraChargesList(student.extraCharges?.[paymentFilterMonth] || []);
    setNewExtraChargeDesc('');
    setNewExtraChargeAmount(0);
  };

  // Add temporary item to the extra charges list
  const handleAddExtraChargeItem = () => {
    if (!newExtraChargeDesc.trim() || newExtraChargeAmount <= 0) {
      setErrorMsg("বিবরণ এবং সঠিক পরিমাণ লিখুন।");
      return;
    }
    const newItem: ExtraCharge = {
      id: Math.random().toString(36).substring(2, 9),
      description: newExtraChargeDesc.trim(),
      amount: Number(newExtraChargeAmount)
    };
    setCurrentExtraChargesList([...currentExtraChargesList, newItem]);
    setNewExtraChargeDesc('');
    setNewExtraChargeAmount(0);
  };

  // Remove item from extra charges list
  const handleRemoveExtraChargeItem = (id: string) => {
    setCurrentExtraChargesList(currentExtraChargesList.filter(item => item.id !== id));
  };

  // Submit extra charges list to Firestore/Local DB
  const handleSubmitExtraCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingExtraChargesEnrollment) return;
    setLoading(true);
    try {
      await updateStudentExtraCharges(
        selectedBatchId,
        managingExtraChargesEnrollment.studentId,
        paymentFilterMonth,
        currentExtraChargesList
      );
      setSuccessMsg(`Extra charges (exam/fine) updated for ${managingExtraChargesEnrollment.studentName}!`);
      setManagingExtraChargesEnrollment(null);
    } catch (err) {
      console.error("Failed to update extra charges:", err);
      setErrorMsg("Failed to update extra charges.");
    } finally {
      setLoading(false);
    }
  };

  // Submit batch-wide extra charges to Firestore/Local DB
  const handleSubmitBatchWideExtraCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setErrorMsg("দয়া করে প্রথমে একটি ব্যাচ সিলেক্ট করুন।");
      return;
    }
    if (!batchWideChargeDesc.trim() || batchWideChargeAmount <= 0) {
      setErrorMsg("বিবরণ এবং সঠিক পরিমাণ লিখুন।");
      return;
    }
    setLoading(true);
    try {
      await updateBatchWideExtraCharges(
        selectedBatchId,
        paymentFilterMonth,
        batchWideChargeDesc.trim(),
        batchWideChargeAmount
      );
      setSuccessMsg(`ব্যাচের সকল শিক্ষার্থীর জন্য "${batchWideChargeDesc.trim()}" (৳${batchWideChargeAmount}) সফলভাবে যোগ করা হয়েছে!`);
      setShowBatchWideChargeModal(false);
      setBatchWideChargeDesc('');
      setBatchWideChargeAmount(0);
    } catch (err) {
      console.error("Failed to update batch-wide extra charges:", err);
      setErrorMsg("অতিরিক্ত ফি যোগ করতে ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // Synchronize batch details states with active batch
  useEffect(() => {
    const active = batches.find(b => b.id === selectedBatchId);
    if (active) {
      setEditBatchName(active.name);
      setEditBatchSubject(active.subject);
      setEditBatchFee(active.monthlyFee);
      setIsEditingBatch(false);
    }
  }, [selectedBatchId, batches]);

  // Handle Editing Batch Details
  const handleUpdateBatchInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;
    if (!editBatchName.trim() || !editBatchSubject.trim()) {
      setErrorMsg("Batch name and Subject are required.");
      return;
    }

    setLoading(true);
    try {
      await updateBatchInfo(selectedBatchId, {
        name: editBatchName.trim(),
        subject: editBatchSubject.trim(),
        monthlyFee: editBatchFee
      });
      setSuccessMsg("Batch details updated successfully!");
      setIsEditingBatch(false);
    } catch (err: any) {
      console.error("Error updating batch info:", err);
      setErrorMsg("Failed to update batch details.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered Roster Lists for Selected Batch
  const getSelectedBatchRoster = () => {
    const teacherBatchIds = batches.map(b => b.id);
    const roster = selectedBatchId === 'all'
      ? enrollments.filter(e => teacherBatchIds.includes(e.batchId))
      : enrollments.filter(e => e.batchId === selectedBatchId);
    
    // Apply enrollment status filter
    const statusFiltered = roster.filter(student => {
      if (studentStatusFilter === 'all') return true;
      return student.status === studentStatusFilter;
    });

    // Apply payment filter
    const paymentFiltered = statusFiltered.filter(student => {
      const status = student.paymentStatus?.[paymentFilterMonth] || 'unpaid';
      if (paymentStatusFilter === 'all') return true;
      return status === paymentStatusFilter;
    });

    // Apply text search (searches student details + batch details)
    if (!studentSearchQuery.trim()) return paymentFiltered;
    const query = studentSearchQuery.toLowerCase();
    return paymentFiltered.filter(student => {
      const batchObj = batches.find(b => b.id === student.batchId);
      const bName = batchObj ? batchObj.name.toLowerCase() : '';
      const bSubject = batchObj ? batchObj.subject.toLowerCase() : '';

      return student.studentName.toLowerCase().includes(query) ||
        student.studentPhone.includes(query) ||
        (student.studentInstitution && student.studentInstitution.toLowerCase().includes(query)) ||
        bName.includes(query) ||
        bSubject.includes(query);
    });
  };

  const selectedBatchRoster = getSelectedBatchRoster();
  const activeBatch = batches.find(b => b.id === selectedBatchId);

  // Quick helper to fill edit-routine schedule state with original times when batch selected for editing
  const fillEditRoutineDays = (batchId: string) => {
    const selected = batches.find(b => b.id === batchId);
    if (selected) {
      setEditDays(selected.schedule);
    }
  };

  // Derived state for the Combined Weekly Schedule & Analysis
  const currentEnglishDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const combinedSchedules: {
    day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
    time: string;
    batchId: string;
    batchName: string;
    subject: string;
    code: string;
    accentIndex: number;
  }[] = [];

  batches.forEach((b, bIdx) => {
    if (b.schedule && Array.isArray(b.schedule)) {
      b.schedule.forEach(sched => {
        combinedSchedules.push({
          day: sched.day,
          time: sched.time,
          batchId: b.id,
          batchName: b.name,
          subject: b.subject,
          code: b.code,
          accentIndex: bIdx,
        });
      });
    }
  });

  // Sort by time
  combinedSchedules.sort((a, b) => a.time.localeCompare(b.time));

  // Detect conflicts
  const conflictMap: Record<string, typeof combinedSchedules> = {};
  combinedSchedules.forEach(item => {
    const key = `${item.day}_${item.time}`;
    if (!conflictMap[key]) {
      conflictMap[key] = [];
    }
    conflictMap[key].push(item);
  });

  const activeConflicts = Object.entries(conflictMap)
    .filter(([_, items]) => items.length > 1)
    .map(([key, items]) => {
      const [day, time] = key.split('_');
      return {
        day: day as any,
        time,
        batches: items,
      };
    });

  // Find up to 4 suggested free slots from typical coaching times
  const typicalSlots = ['15:00', '16:30', '18:00', '19:30'];
  const suggestedFreeSlots: { day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'; time: string }[] = [];

  // Order days logically starting from today
  const orderedDays = [...DAYS_OF_WEEK];
  const todayIdx = orderedDays.indexOf(currentEnglishDay as any);
  if (todayIdx !== -1) {
    const after = orderedDays.slice(todayIdx);
    const before = orderedDays.slice(0, todayIdx);
    orderedDays.splice(0, orderedDays.length, ...after, ...before);
  }

  for (const day of orderedDays) {
    for (const slot of typicalSlots) {
      const isTaken = combinedSchedules.some(item => item.day === day && item.time === slot);
      if (!isTaken) {
        suggestedFreeSlots.push({ day, time: slot });
        if (suggestedFreeSlots.length >= 4) break;
      }
    }
    if (suggestedFreeSlots.length >= 4) break;
  }

  const handleQuickReschedule = (batchId: string) => {
    setEditRoutineBatchId(batchId);
    const selected = batches.find(b => b.id === batchId);
    if (selected) {
      setEditDays(selected.schedule);
    }
    
    setTimeout(() => {
      const element = document.getElementById('change-routine-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-amber-400/80', 'transition-all', 'duration-300');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-amber-400/80');
        }, 1500);
      }
    }, 50);
  };

  const handleSelectSuggestedSlot = (day: string, time: string) => {
    const targetBatchId = editRoutineBatchId || (batches[0] ? batches[0].id : '');
    if (!targetBatchId) return;

    setEditRoutineBatchId(targetBatchId);
    const selected = batches.find(b => b.id === targetBatchId);
    if (selected) {
      const alreadyExists = editDays.some(d => d.day === day && d.time === time);
      if (!alreadyExists) {
        setEditDays(prev => [...prev, { day: day as any, time }]);
      }
    }

    setTimeout(() => {
      const element = document.getElementById('change-routine-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-amber-400/80', 'transition-all', 'duration-300');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-amber-400/80');
        }, 1500);
      }
    }, 50);

    setSuccessMsg(`রুটিন পরিবর্তন ফর্মে ${BENGALI_DAYS[day]} ${formatTimeTo12Hour(time)} স্লটটি সফলভাবে যুক্ত করা হয়েছে!`);
  };

  // Count total notifications (pending payments and join requests)
  const pendingPaymentCount = enrollments.reduce((acc, enroll) => {
    if (!enroll.paymentStatus) return acc;
    const pendingMonths = Object.values(enroll.paymentStatus).filter(status => status === 'pending');
    return acc + pendingMonths.length;
  }, 0);

  const pendingJoinCount = enrollments.filter(e => e.status === 'pending').length;
  const totalStudentNotifications = pendingPaymentCount + pendingJoinCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 lg:pb-8 sm:px-6 lg:px-8">
      
      {/* Teacher Welcoming Banner */}
      {activeTab === 'batches' && (
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-gray-150 animate-fade-in">
          <div className="relative z-10 md:flex md:items-center md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center space-x-1.5 rounded-full bg-teal-50 text-teal-700 px-3.5 py-1 text-xs font-bold shadow-sm ring-1 ring-teal-100/50">
                <span>শিক্ষক কন্ট্রোল প্যানেল</span>
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
                <span className="text-2xl">👨‍🏫</span> আসসালামু আলাইকুম, {user.name}!
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                আজ: {new Date().toLocaleDateString('bn-BD')} • আপনার সকল ব্যাচের সামারি
              </p>
            </div>
            <div className="mt-5 md:mt-0 flex shrink-0">
              <button
                onClick={() => {
                  const el = document.getElementById('new-batch-form');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center space-x-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>নতুন ব্যাচ তৈরি করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Segmented Navigation Tab Bar (Desktop/Tablet Only) - Portaled to Navbar */}
      {isDesktop && portalNode && createPortal(
        <div className="flex items-center overflow-x-auto scrollbar-none gap-2">
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'batches'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">🏫</span>
            <span>ব্যাচসমূহ</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 relative cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">📢</span>
            <span>নোটিশ</span>
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
            <span>মেটেরিয়াল</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer relative ${
              activeTab === 'students'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">👨‍🎓</span>
            <span>শিক্ষার্থী</span>
            {totalStudentNotifications > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-[#0f865f] animate-pulse">
                {totalStudentNotifications}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeTab === 'performance'
                ? 'bg-white text-[#0f865f] shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-lg">📈</span>
            <span>পারফরম্যান্স</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
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

      {/* Global Success / Error Alerts */}
      {successMsg && (
        <div className="mb-6 flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl p-4 text-sm animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-950 font-bold px-2">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-center justify-between bg-red-50 text-red-800 border border-red-200 rounded-2xl p-4 text-sm animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-700 hover:text-red-950 font-bold px-2">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        
        {/* LEFT COLUMN: Manage & Publish */}
        {(activeTab === 'batches' || activeTab === 'broadcast' || activeTab === 'materials') && (
          <div className="space-y-8">
          
          {/* Combined Weekly Schedule (Visual Dashboard) */}
          {activeTab === 'batches' && batches.length > 0 && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Pending Requests Alert Banner */}
              {totalStudentNotifications > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl"></div>
                  <div className="flex items-start sm:items-center gap-3 relative z-10">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white animate-pulse text-sm">
                      🔔
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-amber-950 animate-pulse">
                        নতুন পেন্ডিং রিকোয়েস্ট রয়েছে!
                      </h4>
                      <p className="text-xs text-amber-850 font-bold mt-0.5">
                        {pendingPaymentCount > 0 && `${pendingPaymentCount} টি পেমেন্ট ভেরিফিকেশন`}
                        {pendingPaymentCount > 0 && pendingJoinCount > 0 && ' এবং '}
                        {pendingJoinCount > 0 && `${pendingJoinCount} টি ব্যাচ জয়েন রিকোয়েস্ট`} অনুমোদন অপেক্ষমান রয়েছে।
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('students');
                      // If there is only pending join requests, set the filter to pending
                      if (pendingJoinCount > 0 && pendingPaymentCount === 0) {
                        setStudentStatusFilter('pending');
                      } else if (pendingPaymentCount > 0) {
                        setPaymentStatusFilter('pending');
                      }
                    }}
                    className="flex items-center justify-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer shadow-md shadow-amber-600/10 hover:shadow-lg active:scale-97 shrink-0"
                  >
                    <span>✓ পেন্ডিং রিকোয়েস্ট রিভিউ করুন</span>
                  </button>
                </div>
              )}

              {/* Dashboard Header & Export Action */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-50/70 to-emerald-50/20 p-4 sm:p-5 rounded-2xl border border-teal-100/50 shadow-sm">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse shrink-0"></span>
                    <span>ব্যাচ ও আর্থিক সামারি ড্যাশবোর্ড</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">আপনার সকল সক্রিয় ব্যাচ, সাপ্তাহিক ক্লাস শিডিউল এবং চলতি মাসের আর্থিক হিসাবের একটি সুবিন্যস্ত সামারি রিপোর্ট ডাউনলোড করুন।</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="flex items-center justify-center space-x-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-xs sm:text-sm px-4.5 py-3 rounded-xl shadow-md shadow-teal-600/10 hover:from-teal-700 hover:to-emerald-700 hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-97 shrink-0"
                >
                  <FileText className="w-4 h-4 text-white/90" />
                  <span>সামারি রিপোর্ট ডাউনলোড (PDF)</span>
                </button>
              </div>

              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">মোট ব্যাচ</p>
                    <p className="text-2xl font-display font-extrabold text-gray-900">{batches.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">আজকের ক্লাস</p>
                    <p className="text-2xl font-display font-extrabold text-gray-900">{combinedSchedules.filter(s => s.day === currentEnglishDay).length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">সক্রিয় দিন</p>
                    <p className="text-2xl font-display font-extrabold text-gray-900">{new Set(combinedSchedules.map(s => s.day)).size}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">মোট ক্লাস/সপ্তাহ</p>
                    <p className="text-2xl font-display font-extrabold text-gray-900">{combinedSchedules.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 mb-4">
                <div className="flex items-center space-x-3">
                  <h3 className="font-display text-xl font-bold text-gray-900">আমার সাপ্তাহিক রুটিন</h3>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600">
                    আজ: {BENGALI_DAYS[currentEnglishDay as keyof typeof BENGALI_DAYS].slice(0, 4)}
                  </span>
                </div>
                
                <div className="flex items-center bg-gray-100/50 p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setScheduleViewMode('calendar')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      scheduleViewMode === 'calendar' 
                        ? 'bg-teal-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>ক্যালেন্ডার ছক</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setScheduleViewMode('cards')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      scheduleViewMode === 'cards' 
                        ? 'bg-teal-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>কার্ডস</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setScheduleViewMode('list')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      scheduleViewMode === 'list' 
                        ? 'bg-teal-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>লিস্ট</span>
                  </button>
                </div>
              </div>

              {/* Conflict Warnings Banner */}
              {activeConflicts.length > 0 && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 animate-pulse mb-6">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">সতর্কতা: একই সময়ে একাধিক ব্যাচের ক্লাস ডিক্লেয়ার করা আছে!</p>
                      <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                        {activeConflicts.map((conf, idx) => (
                          <li key={idx}>
                            <strong>{BENGALI_DAYS[conf.day]} {formatTimeTo12Hour(conf.time)}</strong> এ একই সাথে{' '}
                            {conf.batches.map(b => `'${b.batchName}' (${b.subject})`).join(' ও ')} ক্লাস ডিক্লেয়ার করা আছে।
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-red-700 font-semibold mt-1">শ্রেণীকক্ষে সময় সংঘাত এড়াতে ক্লাস পরিবর্তন বা সমন্বয় করুন।</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Weekly Day Sections */}
              {scheduleViewMode === 'calendar' ? (
                <div className="space-y-6">
                  <WeeklyCalendarView 
                    items={combinedSchedules.map(cl => ({
                      day: cl.day,
                      time: cl.time,
                      batchId: cl.batchId,
                      batchName: cl.batchName,
                      subject: cl.subject,
                      code: cl.code,
                      accentIndex: cl.accentIndex,
                      teacherName: user.name
                    }))}
                    userRole="teacher"
                    onQuickReschedule={handleQuickReschedule}
                    batchesList={batches}
                    user={user}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {DAYS_OF_WEEK.map(dayName => {
                    const dayClasses = combinedSchedules.filter(item => item.day === dayName);
                    if (dayClasses.length === 0) return null;
                    
                    return (
                      <div key={dayName} className="space-y-3">
                        {/* Day Title Row */}
                        <div className="flex items-center justify-between bg-white border border-gray-150 rounded-xl px-4 py-3 shadow-sm">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                            <h4 className="font-display font-bold text-gray-900">{BENGALI_DAYS[dayName]}</h4>
                          </div>
                          <span className="text-xs font-medium text-gray-500">{dayClasses.length} ক্লাস</span>
                        </div>
                        
                        {scheduleViewMode === 'cards' ? (
                          /* Classes Grid - Cards View */
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-0 sm:pl-4">
                            {dayClasses.map((cl, clIdx) => {
                              const colors = [
                                'border-t-orange-500', 'border-t-teal-500', 
                                'border-t-violet-500', 'border-t-amber-500', 
                                'border-t-rose-500', 'border-t-sky-500'
                              ];
                              const badgeBgColors = [
                                'bg-orange-500', 'bg-teal-500', 
                                'bg-violet-500', 'bg-amber-500', 
                                'bg-rose-500', 'bg-sky-500'
                              ];
                              const colorClass = colors[cl.accentIndex % colors.length];
                              const badgeClass = badgeBgColors[cl.accentIndex % badgeBgColors.length];

                              return (
                                <div 
                                  key={clIdx}
                                  className={`bg-white rounded-xl shadow-sm border border-gray-150 border-t-4 ${colorClass} p-4 flex flex-col justify-between group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                                >
                                  <div>
                                    <div className="flex items-center space-x-2 mb-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold text-white ${badgeClass} uppercase tracking-wider`}>
                                        {cl.code}
                                      </span>
                                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate max-w-[150px]">
                                        {cl.subject}
                                      </span>
                                    </div>
                                    <h5 className="font-display font-bold text-sm text-gray-900 mb-4 leading-tight">
                                      {cl.batchName}
                                    </h5>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2 text-gray-600">
                                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-[11px] font-medium font-sans">
                                          {formatTimeTo12Hour(cl.time)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2 text-gray-600">
                                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-[11px] font-medium truncate">
                                          {user.name}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickReschedule(cl.batchId)}
                                      className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded cursor-pointer"
                                    >
                                      <Edit className="w-3 h-3" />
                                      <span>পরিবর্তন করুন</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Classes Grid - List View */
                          <div className="space-y-2.5 pl-0 sm:pl-4">
                            {dayClasses.map((cl, clIdx) => {
                              const borderColors = [
                                'border-l-orange-500', 'border-l-teal-500', 
                                'border-l-violet-500', 'border-l-amber-500', 
                                'border-l-rose-500', 'border-l-sky-500'
                              ];
                              const badgeBgColors = [
                                'bg-orange-500', 'bg-teal-500', 
                                'bg-violet-500', 'bg-amber-500', 
                                'bg-rose-500', 'bg-sky-500'
                              ];
                              const borderClass = borderColors[cl.accentIndex % borderColors.length];
                              const badgeClass = badgeBgColors[cl.accentIndex % badgeBgColors.length];

                              return (
                                <div 
                                  key={clIdx}
                                  className={`bg-white rounded-xl shadow-sm border border-gray-150 border-l-4 ${borderClass} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all duration-150 hover:bg-gray-50/75`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                    {/* Code and Subject badges */}
                                    <div className="flex items-center space-x-2 shrink-0">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold text-white ${badgeClass} uppercase tracking-wider`}>
                                        {cl.code}
                                      </span>
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                        {cl.subject}
                                      </span>
                                    </div>
                                    
                                    {/* Batch name */}
                                    <h5 className="font-display font-bold text-sm text-gray-900 truncate">
                                      {cl.batchName}
                                    </h5>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                                    {/* Time and Teacher */}
                                    <div className="flex items-center space-x-4">
                                      <div className="flex items-center space-x-1.5 text-gray-600">
                                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-xs font-bold text-gray-700 font-sans">
                                          {formatTimeTo12Hour(cl.time)}
                                        </span>
                                      </div>
                                      <div className="hidden min-[450px]:flex items-center space-x-1.5 text-gray-600">
                                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-xs font-medium text-gray-500 max-w-[80px] truncate">
                                          {user.name.split(' ')[0]}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Edit button */}
                                    <button
                                      type="button"
                                      onClick={() => handleQuickReschedule(cl.batchId)}
                                      className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                    >
                                      <Edit className="w-3 h-3" />
                                      <span className="hidden sm:inline">পরিবর্তন করুন</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Suggested Free Slots Assistant */}
              <div className="mt-8 bg-teal-50/30 border border-teal-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10 text-teal-700 shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">স্মার্ট শিডিউলার এসিস্ট্যান্ট (Smart Scheduler Assistant)</h4>
                    <p className="text-xs text-gray-500 mt-1">আপনার পূর্ববর্তী ক্লাস সমূহের ডাটা বিশ্লেষণ করে সম্পূর্ণ ফাঁকা স্লটসমূহ চিহ্নিত করা হয়েছে</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {suggestedFreeSlots.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">কোনো ফাঁকা স্লট সাজেস্ট করা যাচ্ছে না।</span>
                  ) : (
                    suggestedFreeSlots.map((slot, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSelectSuggestedSlot(slot.day, slot.time)}
                        className="flex items-center space-x-2 rounded-xl bg-white border border-teal-150 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 hover:border-teal-400 hover:scale-[1.02] active:scale-95 transition-all shadow-sm transform duration-150 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{BENGALI_DAYS[slot.day]} {formatTimeTo12Hour(slot.time)}</span>
                      </button>
                    ))
                  )}
                </div>
                <p className="text-[11px] text-teal-800 font-medium mt-3 flex items-center space-x-1.5">
                  <span>💡</span>
                  <span>ওপরে যেকোনো ফাঁকা স্লটে ক্লিক করলে তা স্বয়ংক্রিয়ভাবে নিচে "রুটিন পরিবর্তন" (Change Routine) ফর্মে যুক্ত হয়ে যাবে!</span>
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Create a Coaching Batch */}
          {activeTab === 'batches' && (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md shadow-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 shrink-0">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-gray-900">নতুন কোচিং ব্যাচ খুলুন (Create Batch)</h3>
                  <p className="text-xs font-medium text-gray-500">শিক্ষার্থীদের জন্য অটো-জেনারেটেড কোড তৈরি হবে</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBatch(!showCreateBatch)}
                className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl transition-all duration-150 transform active:scale-95 cursor-pointer ${
                  showCreateBatch
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                    : 'bg-teal-600 text-white hover:bg-teal-700 hover:scale-[1.02] shadow-sm'
                }`}
              >
                {showCreateBatch ? 'ফর্মটি বন্ধ করুন' : 'নতুন ব্যাচ ফর্মটি খুলুন'}
              </button>
            </div>

            {showCreateBatch && (
              <form onSubmit={handleCreateBatch} className="space-y-4 animate-fade-in">
              {/* Batch Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">ব্যাচের নাম (Batch Name) *</label>
                <input
                  type="text"
                  required
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="উদাঃ HSC 26 Physics (Rotor Batch)"
                  className="w-full px-4 py-3 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white shadow-sm"
                />
              </div>

              {/* Subject & Monthly Fee Row */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">বিষয় (Subject) *</label>
                  <input
                    type="text"
                    required
                    value={newBatchSubject}
                    onChange={(e) => setNewBatchSubject(e.target.value)}
                    placeholder="Physics, Math, ইত্যাদি"
                    className="w-full px-4 py-3 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">মাসিক বেতন (BDT ৳) *</label>
                  <input
                    type="number"
                    required
                    value={newBatchFee}
                    onChange={(e) => setNewBatchFee(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 text-sm sm:text-base border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white shadow-sm"
                  />
                </div>
              </div>

              {/* Weekly schedule router selector */}
              <div className="bg-teal-50/40 rounded-2xl p-4 border border-teal-100">
                <label className="block text-xs sm:text-sm font-bold text-teal-900 uppercase tracking-wider mb-2.5">সাপ্তাহিক ক্লাস রুটিন যোগ করুন</label>
                
                <div className="flex items-center space-x-2.5 mb-3.5">
                  <select
                    value={currentDay}
                    onChange={(e) => setCurrentDay(e.target.value as any)}
                    className="flex-1 bg-white border-2 border-gray-100 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-teal-500"
                  >
                    {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(e.target.value)}
                    className="w-28 bg-white border-2 border-gray-100 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddScheduleBlock}
                    className="bg-teal-600 hover:bg-teal-700 hover:scale-[1.02] active:scale-95 text-white rounded-xl py-2.5 px-4 text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 transform cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Render selected routine items */}
                {selectedDays.length === 0 ? (
                  <p className="text-xs text-teal-800 italic font-medium">কোনো দিন যুক্ত করা হয়নি। উপরে "Add" বাটন চাপুন।</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDays.map((item, idx) => (
                      <span key={idx} className="inline-flex items-center space-x-1.5 rounded-xl bg-teal-100 text-teal-800 px-3 py-1.5 text-xs sm:text-sm font-bold shadow-sm">
                        <span>{item.day}: {item.time}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDays(prev => prev.filter((_, i) => i !== idx))}
                          className="text-teal-950 hover:text-red-700 text-sm font-bold ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 hover:scale-[1.01] active:scale-95 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-teal-600/15 transform duration-150 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{loading ? 'লঞ্চ হচ্ছে...' : 'নতুন ব্যাচ সক্রিয় করুন'}</span>
              </button>
            </form>
            )}
          </div>
          )}

          {/* Section 2: Real-time Schedule / Routine Modifier */}
          {batches.length > 0 && activeTab === 'batches' && (
            <div id="change-routine-section" className="rounded-3xl border border-amber-200 bg-amber-50/15 p-6 shadow-md shadow-amber-950/5 animate-fade-in scroll-mt-6">
              <div className="flex items-center space-x-2.5 border-b border-amber-200 pb-4 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Calendar className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900">ক্লাস রুটিন পরিবর্তন (Change Routine)</h3>
                  <p className="text-xs sm:text-sm font-medium text-amber-900/80">সংশ্লিষ্ট ব্যাচের স্টুডেন্টদের কাছে অটোমেটিক নোটিফিকেশন যাবে</p>
                </div>
              </div>

              <form onSubmit={handleUpdateRoutine} className="space-y-4">
                {/* Batch Select */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">ব্যাচ সিলেক্ট করুন (Select Batch)</label>
                  <select
                    value={editRoutineBatchId}
                    onChange={(e) => {
                      setEditRoutineBatchId(e.target.value);
                      fillEditRoutineDays(e.target.value);
                    }}
                    className="w-full border-2 border-amber-200/60 rounded-2xl p-3 text-sm font-semibold focus:outline-none focus:border-amber-500 bg-white"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Edit routine schedules */}
                <div className="bg-amber-100/40 rounded-2xl p-4 border border-amber-200">
                  <span className="block text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wider mb-2.5">নতুন পরিবর্তিত রুটিন ডিক্লেয়ার করুন</span>
                  
                  <div className="flex gap-2.5 mb-3.5">
                    <select
                      id="edit-day-select"
                      className="flex-1 bg-white border-2 border-amber-200/50 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:outline-none"
                    >
                      {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      id="edit-time-input"
                      type="time"
                      defaultValue="16:00"
                      className="w-28 bg-white border-2 border-amber-200/50 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const day = (document.getElementById('edit-day-select') as HTMLSelectElement).value as any;
                        const time = (document.getElementById('edit-time-input') as HTMLInputElement).value;
                        if (editDays.some(d => d.day === day)) return;
                        setEditDays(prev => [...prev, { day, time }]);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 hover:scale-[1.02] active:scale-95 text-white rounded-xl py-2.5 px-4 text-xs sm:text-sm font-bold shadow-sm transition-all duration-150 transform cursor-pointer animate-fade-in"
                    >
                      Add
                    </button>
                  </div>

                  {editDays.length === 0 ? (
                    <p className="text-xs text-amber-800 italic font-medium">কোনো দিন যুক্ত করা হয়নি। উপরে "Add" বাটন চাপুন।</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {editDays.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-100 text-amber-900 px-3 py-1.5 text-xs sm:text-sm font-bold shadow-sm border border-amber-200 animate-fade-in">
                          <span>{item.day}: {item.time}</span>
                          <button
                            type="button"
                            onClick={() => setEditDays(prev => prev.filter((_, i) => i !== idx))}
                            className="text-amber-950 font-bold ml-1.5 hover:text-red-700 text-sm cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optional Message */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">পরিবর্তনের কারণ/বার্তা (Optional Message) *</label>
                  <textarea
                    rows={2}
                    value={editChangeNote}
                    onChange={(e) => setEditChangeNote(e.target.value)}
                    placeholder="উদাঃ ল্যাব পরীক্ষার জন্য রবিবার বিকেল ৪টার ক্লাসটি ৫টায় শুরু হবে।"
                    className="w-full text-sm border-2 border-amber-200/40 rounded-2xl p-3 focus:outline-none bg-white shadow-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 hover:scale-[1.01] active:scale-95 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-amber-600/10 transform duration-150 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? 'আপডেট হচ্ছে...' : 'রুটিন আপডেট ও লাইভ নোটিফিকেশন পাঠান'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Section 3: Study Materials Broadcaster */}
          {batches.length > 0 && activeTab === 'materials' && (
            <div className="rounded-3xl border border-purple-200 bg-white p-6 shadow-md shadow-gray-50 animate-fade-in">
              <div className="flex items-center space-x-2.5 border-b border-purple-150 pb-4 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                  <Upload className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900">লেকচার শিট আপলোড (Study Material)</h3>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">গুগল ড্রাইভ পিডিএফ কিংবা লেকচার লিংক শেয়ার করুন</p>
                </div>
              </div>

              <form onSubmit={handleUploadMaterial} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">কোন ব্যাচ? (Batch)</label>
                    <select
                      value={materialTargetBatchId}
                      onChange={(e) => setMaterialTargetBatchId(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:outline-none bg-white font-semibold"
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">ফাইলের নাম (Title) *</label>
                    <input
                      type="text"
                      required
                      value={materialTitle}
                      onChange={(e) => setMaterialTitle(e.target.value)}
                      placeholder=" Newtonian Mechanics Sheet"
                      className="w-full px-4 py-3 text-sm border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-purple-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">রিসোর্স ড্রাইভ লিংক (File URL) *</label>
                  <input
                    type="url"
                    required
                    value={materialLink}
                    onChange={(e) => setMaterialLink(e.target.value)}
                    placeholder="উদাঃ https://drive.google.com/..."
                    className="w-full px-4 py-3 text-sm border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-purple-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">বর্ণনা ও নির্দেশনাবলী (Description)</label>
                  <textarea
                    rows={2}
                    value={materialDesc}
                    onChange={(e) => setMaterialDesc(e.target.value)}
                    placeholder="উদাঃ প্র্যাকটিস প্রবলেম ১৪-২০ সমাধান করে পরবর্তী ক্লাসে জমা দিতে হবে।"
                    className="w-full text-sm border-2 border-gray-100 rounded-2xl p-3 focus:outline-none focus:border-purple-500 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 hover:scale-[1.01] active:scale-95 text-white font-bold rounded-2xl text-sm transition-all shadow-md transform duration-150 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? 'প্রক্রিয়াধীন...' : 'মেটেরিয়াল শেয়ার করুন'}</span>
                </button>
              </form>

              {materials.length > 0 && (
                <div className="mt-10">
                  <h4 className="font-bold text-gray-800 mb-4 text-base border-b border-gray-100 pb-2">পূর্বে আপলোডকৃত মেটেরিয়াল সমূহ</h4>
                  <div className="space-y-3">
                    {materials.map(material => (
                      <div key={material.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-100 text-purple-800">
                            {material.batchName}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {new Date(material.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <h5 className="font-bold text-gray-800 mt-1">{material.title}</h5>
                        {material.description && <p className="text-sm text-gray-600">{material.description}</p>}
                        <a href={material.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-bold hover:underline mt-1 w-max">
                          ফাইলটি দেখুন ↗
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 4: Notice Board Broadcaster */}
          {batches.length > 0 && activeTab === 'broadcast' && (
            <div className="rounded-3xl border border-orange-200 bg-white p-6 shadow-md shadow-gray-50 animate-fade-in">
              <div className="flex items-center space-x-2.5 border-b border-orange-150 pb-4 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                  <Bell className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-gray-900">সাধারণ নোটিশ বোর্ড (Announce)</h3>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">পরীক্ষা বা সাধারণ নোটিশ শিক্ষার্থীদের জন্য প্রচার করুন</p>
                </div>
              </div>

              <form onSubmit={handlePostNotice} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">ব্যাচ (Batch)</label>
                    <select
                      value={broadcastTargetBatchId}
                      onChange={(e) => setBroadcastTargetBatchId(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:outline-none bg-white font-semibold"
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">ধরণ (Type)</label>
                    <select
                      value={broadcastType}
                      onChange={(e) => setBroadcastType(e.target.value as any)}
                      className="w-full border-2 border-gray-100 rounded-2xl p-3 text-sm focus:outline-none bg-white font-semibold"
                    >
                      <option value="general">সাধারণ নোটিশ</option>
                      <option value="exam_alert">পরীক্ষার বিজ্ঞপ্তি</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-1.5">নোটিশের বার্তা (Notice Message) *</label>
                  <textarea
                    required
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="উদাঃ আগামী সোমবারে তাপগতিবিদ্যার ওপর ২০ নম্বরের এমসিকিউ পরীক্ষা নেওয়া হবে।"
                    className="w-full text-sm border-2 border-gray-100 rounded-2xl p-3.5 focus:outline-none focus:border-orange-500 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 hover:scale-[1.01] active:scale-95 text-white font-bold rounded-2xl text-sm transition-all shadow-md transform duration-150 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? 'প্রচার চলছে...' : 'নোটিশ প্রচার করুন'}</span>
                </button>
              </form>

              {notices.length > 0 && (
                <div className="mt-10">
                  <h4 className="font-bold text-gray-800 mb-4 text-base border-b border-gray-100 pb-2">পূর্বে প্রকাশিত নোটিশ সমূহ</h4>
                  <div className="space-y-3">
                    {notices.map(notice => (
                      <div key={notice.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 text-slate-700">
                              {notice.type === 'exam_alert' ? 'পরীক্ষা' : notice.type === 'schedule_change' ? 'রুটিন' : 'সাধারণ'}
                            </span>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-orange-100 text-orange-800">
                              {notice.batchName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">
                            {new Date(notice.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{notice.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        )}

        {/* RIGHT COLUMN: Roster & Tuition Billings */}
        {activeTab === 'students' && (
          <div className="space-y-8 animate-fade-in">
          
          {/* Active Batch Overview & Selector */}
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md shadow-gray-50">
            <div className="sm:flex sm:items-center sm:justify-between border-b border-gray-150 pb-4 mb-5">
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900">শিক্ষার্থী ও বেতন ট্র্যাকিং বিবরণী</h3>
                <p className="text-xs text-gray-500">ব্যাচভিত্তিক পেমেন্ট স্ট্যাটাস ও স্টুডেন্ট রোস্টার</p>
              </div>
              <div className="mt-3 sm:mt-0 flex flex-wrap items-center gap-2">
                {batches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer shadow-sm active:scale-97"
                    title="ডাউনলোড পেমেন্ট লিস্ট (CSV)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>পেমেন্ট লিস্ট (CSV)</span>
                  </button>
                )}
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="border-2 border-teal-600 bg-teal-50 text-teal-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none h-[38px]"
                >
                  {batches.length > 0 && (
                    <option value="all">📁 সব ব্যাচ (All Batches)</option>
                  )}
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {batches.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-gray-700">কোনো ব্যাচ সক্রিয় নেই</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                  বামে নতুন কোচিং ব্যাচ খুলুন। ব্যাচ কোড শেয়ার করে শিক্ষার্থীদের আমন্ত্রণ জানান।
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Active Batch Code Widget */}
                {activeBatch && (
                  <div className="space-y-4">
                    {/* Batch Basic Details & Actions Panel */}
                    <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5">
                      {isEditingBatch ? (
                        <form onSubmit={handleUpdateBatchInfo} className="space-y-4">
                          <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
                            <Edit className="h-4 w-4 text-teal-600" />
                            ব্যাচের তথ্য পরিবর্তন করুন (Edit Batch Details)
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ব্যাচের নাম</label>
                              <input
                                type="text"
                                required
                                value={editBatchName}
                                onChange={(e) => setEditBatchName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">বিষয়</label>
                              <input
                                type="text"
                                required
                                value={editBatchSubject}
                                onChange={(e) => setEditBatchSubject(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">মাসিক বেতন (৳)</label>
                            <input
                              type="number"
                              required
                              value={editBatchFee}
                              onChange={(e) => setEditBatchFee(parseInt(e.target.value) || 0)}
                              className="w-full max-w-xs bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                            />
                          </div>

                          <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                            >
                              {loading ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingBatch(false);
                                setEditBatchName(activeBatch.name);
                                setEditBatchSubject(activeBatch.subject);
                                setEditBatchFee(activeBatch.monthlyFee);
                              }}
                              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
                            >
                              বাতিল (Cancel)
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full">
                                {activeBatch.subject}
                              </span>
                              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                                মাসিক ফি: ৳{activeBatch.monthlyFee}
                              </span>
                            </div>
                            <h4 className="font-display text-lg font-extrabold text-slate-900 mt-1">
                              {activeBatch.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsEditingBatch(true)}
                              className="flex items-center space-x-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 hover:text-teal-900 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                              <span>এডিট ব্যাচ (Edit Info)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setShowDeleteBatchId(activeBatch.id)}
                              className="flex items-center space-x-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
                              title="Delete/Archive Batch"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>ডিলিট (Delete)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Active Batch Invite Code & Schedule Widget */}
                    <div className="bg-teal-50/70 rounded-3xl border border-teal-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <span className="block text-xs sm:text-sm font-bold text-teal-900 uppercase">স্টুডেন্টদের শেয়ার করুন (Invite Code)</span>
                        <div className="flex items-center space-x-2.5 mt-2">
                          <span className="font-mono text-lg sm:text-xl font-extrabold text-teal-900 bg-white border-2 border-teal-200 px-4 py-2 rounded-2xl tracking-wider shadow-sm">
                            {activeBatch.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeBatch.code);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className={`text-xs sm:text-sm font-bold rounded-2xl px-4 py-2.5 transition-all duration-150 transform active:scale-95 shadow-md flex items-center space-x-1.5 cursor-pointer ${
                              copied 
                                ? 'bg-emerald-600 text-white scale-105 ring-2 ring-emerald-500/20' 
                                : 'bg-teal-600 text-white hover:bg-teal-700 hover:scale-[1.02]'
                            }`}
                          >
                            <span>{copied ? 'Copied! ✓' : 'Copy Code'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-teal-100 pt-3.5 sm:pt-0 sm:pl-5">
                        <span className="block text-xs sm:text-sm font-bold text-teal-900 uppercase">সাপ্তাহিক ক্লাসসমূহ</span>
                        <div className="flex flex-wrap gap-1.5 mt-2 justify-start sm:justify-end">
                          {activeBatch.schedule.map((s, idx) => (
                            <span key={idx} className="bg-white border border-teal-200 rounded-xl px-2.5 py-1 text-xs font-bold text-teal-800 shadow-sm">
                              {s.day} @ {s.time}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                  {/* Select billing month */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">মাস সিলেক্ট করুন</label>
                    <select
                      value={paymentFilterMonth}
                      onChange={(e) => setPaymentFilterMonth(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-1.5 text-xs focus:outline-none"
                    >
                      {availableMonths.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                  </div>

                  {/* Student Status Filter */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">ভর্তি স্ট্যাটাস ফিল্টার</label>
                    <select
                      value={studentStatusFilter}
                      onChange={(e) => setStudentStatusFilter(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-1.5 text-xs focus:outline-none"
                    >
                      <option value="all">সব ভর্তি স্ট্যাটাস</option>
                      <option value="active">Active (সক্রিয়)</option>
                      <option value="pending">Pending (অনুমোদন অপেক্ষমান)</option>
                    </select>
                  </div>

                  {/* Payment status selector */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">বেতন স্ট্যাটাস ফিল্টার</label>
                    <select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-1.5 text-xs focus:outline-none"
                    >
                      <option value="all">
                        সব পেমেন্ট স্ট্যাটাস ({
                          selectedBatchId === 'all'
                            ? enrollments.filter(e => batches.map(b => b.id).includes(e.batchId)).length
                            : enrollments.filter(e => e.batchId === selectedBatchId).length
                        })
                      </option>
                      <option value="paid">পরিশোধিত (Paid)</option>
                      <option value="pending">রিপোর্ট করেছেন (Pending Review)</option>
                      <option value="unpaid">বকেয়া (Unpaid)</option>
                    </select>
                  </div>

                  {/* Search query input */}
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">খুঁজুন (Search Student/Batch)</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="নাম, ফোন, প্রতিষ্ঠান বা ব্যাচ..."
                        className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-2.5 py-1 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Batch Action Bar */}
                {selectedBatchId && selectedBatchId !== 'all' && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                        <Plus className="h-4 w-4" />
                      </span>
                      <div>
                        <h5 className="text-xs font-black text-amber-950">একসাথে পুরো ব্যাচে ফি/জরিমানা ধার্য করুন (Batch-wide Charge)</h5>
                        <p className="text-[10px] text-amber-700 font-bold">মডেল টেস্ট ফি বা বকেয়া জরিমানা এক ক্লিকে পুরো ব্যাচের সব শিক্ষার্থীর জন্য যোগ করুন।</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBatchWideChargeModal(true)}
                      className="w-full sm:w-auto text-xs font-black bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      অতিরিক্ত ফি যোগ করুন (+৳)
                    </button>
                  </div>
                )}

                {/* Advanced Monthly Analytics Summary Cards */}
                 {selectedBatchId && (() => {
                  const teacherBatchIds = batches.map(b => b.id);
                  const activeRoster = selectedBatchId === 'all'
                    ? enrollments.filter(e => teacherBatchIds.includes(e.batchId))
                    : enrollments.filter(e => e.batchId === selectedBatchId);
                  const activeBatchObj = batches.find(b => b.id === selectedBatchId);

                  let totalExpected = 0;
                  let totalCollected = 0;
                  let totalDues = 0;
                  let paidCount = 0;
                  let pendingCount = 0;
                  let unpaidCount = 0;

                  activeRoster.forEach(student => {
                    const studentBatch = batches.find(b => b.id === student.batchId);
                    const defFee = studentBatch?.monthlyFee || 1200;
                    const fee = student.customFee !== undefined ? student.customFee : defFee;
                    const discount = student.discount || 0;
                    const extraChargesSum = student.extraCharges?.[paymentFilterMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                    const netPayable = Math.max(0, fee - discount) + extraChargesSum;

                    const paid = student.paidAmountMap?.[paymentFilterMonth] !== undefined
                      ? student.paidAmountMap[paymentFilterMonth]
                      : (student.paymentStatus?.[paymentFilterMonth] === 'paid' ? netPayable : 0);

                    const due = Math.max(0, netPayable - paid);

                    totalExpected += netPayable;
                    totalCollected += paid;
                    totalDues += due;

                    const status = student.paymentStatus?.[paymentFilterMonth] || 'unpaid';
                    if (status === 'paid') paidCount++;
                    else if (status === 'pending') pendingCount++;
                    else unpaidCount++;
                  });

                  const collectionData = [
                    { name: 'সংগৃহীত (Collected)', value: totalCollected, color: '#10b981' },
                    { name: 'বকেয়া (Due)', value: totalDues, color: '#f43f5e' }
                  ];

                  const statusData = [
                    { name: 'Paid (পরিশোধিত)', count: paidCount, color: '#10b981' },
                    { name: 'Review (পেন্ডিং)', count: pendingCount, color: '#f59e0b' },
                    { name: 'Unpaid (বকেয়া)', count: unpaidCount, color: '#ef4444' }
                  ];

                  const containerVariants = {
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08
                      }
                    }
                  };

                  const cardVariants = {
                    hidden: { opacity: 0, y: 15, scale: 0.97 },
                    show: { 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      transition: { 
                        type: 'spring', 
                        stiffness: 120, 
                        damping: 14 
                      } 
                    }
                  };

                  return (
                    <div className="space-y-5">
                      {/* 4 Summary Cards */}
                      <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-teal-50/20 p-4 rounded-3xl border border-teal-100/50"
                      >
                        <motion.div variants={cardVariants} className="bg-white p-3.5 rounded-2xl border border-teal-100/30 shadow-sm hover:shadow transition-shadow">
                          <span className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase">মোট শিক্ষার্থী</span>
                          <span className="text-base sm:text-lg font-extrabold text-teal-900">{activeRoster.length} জন</span>
                        </motion.div>
                        <motion.div variants={cardVariants} className="bg-white p-3.5 rounded-2xl border border-teal-100/30 shadow-sm hover:shadow transition-shadow">
                          <span className="block text-[10px] sm:text-xs font-bold text-gray-400 uppercase">মোট পরিশোধ্য ({paymentFilterMonth})</span>
                          <span className="text-base sm:text-lg font-extrabold text-teal-900">৳{totalExpected}</span>
                        </motion.div>
                        <motion.div variants={cardVariants} className="bg-white p-3.5 rounded-2xl border border-teal-100/30 shadow-sm hover:shadow transition-shadow">
                          <span className="block text-[10px] sm:text-xs font-bold text-emerald-600 uppercase">সংগৃহীত বেতন (Collected)</span>
                          <span className="text-base sm:text-lg font-extrabold text-emerald-700">৳{totalCollected}</span>
                        </motion.div>
                        <motion.div variants={cardVariants} className="bg-white p-3.5 rounded-2xl border border-teal-100/30 shadow-sm hover:shadow transition-shadow">
                          <span className="block text-[10px] sm:text-xs font-bold text-red-500 uppercase">বকেয়া বেতন (Dues/Baki)</span>
                          <span className="text-base sm:text-lg font-extrabold text-red-600">৳{totalDues}</span>
                        </motion.div>
                      </motion.div>

                      {/* Visual Dashboard Graphs */}
                      {activeRoster.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-teal-50/10 p-4 rounded-3xl border border-teal-100/30">
                          
                          {/* Left Graph: Pie Chart for Income Breakdown */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 self-start flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                              <span>বেতন কালেকশন অনুপাত (৳ Income Split)</span>
                            </h5>
                            
                            <div className="w-full h-44 flex items-center justify-center">
                              {totalExpected === 0 ? (
                                <p className="text-xs text-slate-400 italic">কোনো বেতন ধার্য করা নেই</p>
                              ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={collectionData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={50}
                                      outerRadius={70}
                                      paddingAngle={3}
                                      dataKey="value"
                                    >
                                      {collectionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <ChartTooltip formatter={(value) => `৳${value}`} />
                                  </PieChart>
                                </ResponsiveContainer>
                              )}
                            </div>
                            
                            {/* Legend */}
                            <div className="flex gap-4 text-xs font-medium text-slate-600 mt-2">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                <span>সংগৃহীত: ৳{totalCollected} ({totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}%)</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                                <span>বকেয়া: ৳{totalDues} ({totalExpected > 0 ? Math.round((totalDues / totalExpected) * 100) : 0}%)</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Graph: Bar Chart for Student Statuses */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 self-start flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                              <span>শিক্ষার্থী পেমেন্ট অবস্থা (রোল সংখ্যা)</span>
                            </h5>

                            <div className="w-full h-44 flex items-center justify-center">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <ChartTooltip />
                                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                    {statusData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex gap-3 text-[10px] sm:text-xs font-medium text-slate-600 mt-2">
                              <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                <span>Paid: {paidCount} জন</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                <span>Pending: {pendingCount} জন</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                                <span>Unpaid: {unpaidCount} জন</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Pending Verification Queue */}
                {(() => {
                  const teacherBatchIds = batches.map(b => b.id);
                  const pendingApprovalList = enrollments.filter(
                    e => (selectedBatchId === 'all' ? teacherBatchIds.includes(e.batchId) : e.batchId === selectedBatchId) && 
                         e.paymentStatus?.[paymentFilterMonth] === 'pending'
                  );
                  
                  if (pendingApprovalList.length === 0) return null;

                  const queueContainerVariants = {
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08
                      }
                    }
                  };

                  const queueItemVariants = {
                    hidden: { opacity: 0, scale: 0.97, y: 10 },
                    show: { 
                      opacity: 1, 
                      scale: 1, 
                      y: 0, 
                      transition: { 
                        type: 'spring', 
                        stiffness: 110, 
                        damping: 13 
                      } 
                    }
                  };

                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 rounded-3xl p-5 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white animate-bounce text-xs">
                            🔔
                          </span>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-800">পেন্ডিং পেমেন্ট রিভিউ তালিকা</h3>
                            <p className="text-[10px] text-amber-700 font-semibold">নিচের শিক্ষার্থীদের অনলাইন পেমেন্ট রিকোয়েস্টগুলো চেক করে একসেপ্ট অথবা রিজেক্ট করুন</p>
                          </div>
                        </div>
                        <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full">
                          {pendingApprovalList.length} টি পেন্ডিং
                        </span>
                      </div>

                      <motion.div 
                        variants={queueContainerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        {pendingApprovalList.map((student) => {
                          const latestTx = student.paymentHistory
                            ?.filter(t => t.month === paymentFilterMonth)
                            ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                          const defaultFee = activeBatch?.monthlyFee || 1200;
                          const fee = student.customFee !== undefined ? student.customFee : defaultFee;
                          const discount = student.discount || 0;
                          const extraChargesSum = student.extraCharges?.[paymentFilterMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                          const netPayable = Math.max(0, fee - discount) + extraChargesSum;

                          const paid = student.paidAmountMap?.[paymentFilterMonth] !== undefined
                            ? student.paidAmountMap[paymentFilterMonth]
                            : 0;

                          const due = Math.max(0, netPayable - paid);

                          return (
                            <motion.div 
                              variants={queueItemVariants}
                              key={`pending-q-${student.id}`} 
                              className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow transition-all"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-sm text-slate-900">{student.studentName}</h4>
                                  <p className="text-[10px] text-gray-500">📞 {student.studentPhone}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-800 block">৳{netPayable}</span>
                                  <span className="text-[9px] text-amber-600 font-bold uppercase">বকেয়া: ৳{due}</span>
                                </div>
                              </div>

                              {latestTx && (
                                <div className="bg-slate-50 rounded-xl p-3 text-[11px] space-y-1.5 border border-slate-100">
                                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                                    <div>মাধ্যম: <strong className="text-slate-800">{latestTx.method}</strong></div>
                                    <div>পরিমাণ: <strong className="text-teal-600">৳{latestTx.amount}</strong></div>
                                  </div>
                                  {latestTx.trxId && (
                                    <div className="text-gray-500 bg-white border border-slate-200/60 px-2 py-1 rounded-lg font-mono text-[10px]">
                                      TrxID: <span className="font-extrabold text-slate-800 select-all">{latestTx.trxId}</span>
                                    </div>
                                  )}
                                  {latestTx.note && (
                                    <div className="text-gray-500 italic text-[10px] border-t border-dashed border-gray-200 pt-1">
                                      "{latestTx.note}"
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPayment(student.batchId, student.studentId, 'paid')}
                                  className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                                >
                                  ✓ একসেপ্ট করুন
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectPayment(student)}
                                  className="flex-1 h-9 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 transition-all cursor-pointer"
                                >
                                  ❌ রিজেক্ট করুন
                                </button>
                                {due > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectCashPayment(student, due)}
                                    className="h-9 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-100 transition-all cursor-pointer"
                                    title="সরাসরি ক্যাশে সম্পুর্ণ বকেয়া গ্রহণ"
                                  >
                                    💵 ক্যাশ
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  );
                })()}

                {/* Roster & Billing Table / Cards List */}
                {selectedBatchRoster.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50/40">
                    <p className="text-xs text-gray-500 italic">এই ফিল্টার অনুযায়ী কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {selectedBatchRoster.map((student) => {
                      const status = student.paymentStatus?.[paymentFilterMonth] || 'unpaid';
                      const studentBatch = batches.find(b => b.id === student.batchId);
                      const defaultFee = studentBatch?.monthlyFee || 1200;
                      const fee = student.customFee !== undefined ? student.customFee : defaultFee;
                      const discount = student.discount || 0;
                      const extraChargesSum = student.extraCharges?.[paymentFilterMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
                      const netPayable = Math.max(0, fee - discount) + extraChargesSum;

                      const paid = student.paidAmountMap?.[paymentFilterMonth] !== undefined
                        ? student.paidAmountMap[paymentFilterMonth]
                        : (status === 'paid' ? netPayable : 0);

                      const due = Math.max(0, netPayable - paid);

                      return (
                        <div 
                          key={student.id} 
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:border-teal-200 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        >
                          {/* Left Column: Student Bio */}
                          <div className="space-y-1 md:w-1/3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-gray-900">{student.studentName}</h4>
                              <span className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold ${
                                student.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}>
                                {student.status === 'active' ? 'Active' : 'Pending Request'}
                              </span>
                              {studentBatch && (
                                <span className="rounded-md bg-teal-50 text-teal-800 border border-teal-200/50 px-1.5 py-0.5 text-[9px] font-extrabold flex items-center gap-0.5">
                                  📚 {studentBatch.name}
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5 text-xs text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <span>📞 {student.studentPhone}</span>
                                {student.studentInstitution && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded-md truncate max-w-[120px]" title={student.studentInstitution}>
                                    {student.studentInstitution}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-gray-400 truncate" title={student.studentEmail}>
                                {student.studentEmail}
                              </div>
                            </div>

                            {(() => {
                              const latestTx = student.paymentHistory
                                ?.filter(t => t.month === paymentFilterMonth)
                                ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                              
                              if (!latestTx) return null;

                              const isRejected = latestTx.note?.includes('❌') || latestTx.method === 'System';

                              return (
                                <div className={`mt-2.5 text-[11px] rounded-2xl p-3 border space-y-1.5 leading-relaxed transition-all shadow-inner ${
                                  status === 'pending'
                                    ? 'bg-amber-50/70 border-amber-100'
                                    : isRejected
                                      ? 'bg-rose-50/60 border-rose-100'
                                      : 'bg-emerald-50/40 border-emerald-100'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`font-black uppercase tracking-wider ${
                                      status === 'pending'
                                        ? 'text-amber-800'
                                        : isRejected
                                          ? 'text-rose-800'
                                          : 'text-emerald-800'
                                    }`}>
                                      {status === 'pending' 
                                        ? '🔔 নতুন পেমেন্ট রিপোর্ট' 
                                        : isRejected
                                          ? '❌ রিজেক্টেড নোটিশ'
                                          : '✓ পেমেন্ট ট্রানজেকশন'}
                                    </span>
                                    <span className="text-gray-400 text-[9px]">
                                      {new Date(latestTx.date).toLocaleDateString('bn-BD')}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-gray-600 font-semibold">
                                    <div>মাধ্যম: <strong className="text-slate-800">{latestTx.method}</strong></div>
                                    <div>পরিমাণ: <strong className="text-slate-800">৳{latestTx.amount}</strong></div>
                                  </div>
                                  {latestTx.trxId && (
                                    <div className="text-gray-600 bg-white/60 border border-slate-100 px-2 py-1 rounded-lg font-mono text-[10px] flex justify-between items-center gap-1.5 shadow-sm">
                                      <span>TrxID: <span className="font-bold text-slate-800 select-all">{latestTx.trxId}</span></span>
                                    </div>
                                  )}
                                  {latestTx.note && (
                                    <div className="text-gray-500 italic text-[10px] border-t border-slate-100/50 pt-1 mt-1 font-medium">
                                      "{latestTx.note}"
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Middle Column: Fees & Discount */}
                          <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50 rounded-xl md:w-1/3 text-center">
                            <div>
                              <span className="block text-[8px] text-gray-400 uppercase font-bold">টুইশন ফি</span>
                              <span className="text-xs font-bold text-slate-700">
                                ৳{fee}
                                {student.customFee !== undefined && (
                                  <span className="text-[8px] text-teal-600 block">(কাস্টম)</span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-gray-400 uppercase font-bold">ছাড়</span>
                              <span className={`text-xs font-bold ${discount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>৳{discount}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-gray-400 uppercase font-bold">পরিশোধ্য</span>
                              <span className="text-xs font-extrabold text-slate-800">
                                ৳{netPayable}
                                {extraChargesSum > 0 && (
                                  <span className="text-[8px] text-amber-600 block font-bold" title={student.extraCharges?.[paymentFilterMonth]?.map(c => `${c.description}: ৳${c.amount}`).join(', ')}>
                                    (+৳{extraChargesSum} এক্সট্রা)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Right Column: Collection Status & Quick Controls */}
                          <div className="flex items-center justify-between md:justify-end gap-3.5 md:w-1/3">
                            {/* Paid & Dues Breakdown */}
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  status === 'paid' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : status === 'pending'
                                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                                      : paid > 0
                                        ? 'bg-cyan-100 text-cyan-800'
                                        : 'bg-red-100 text-red-800'
                                }`}>
                                  {status === 'paid' 
                                    ? 'Verified Paid' 
                                    : status === 'pending' 
                                      ? 'Pending Review' 
                                      : paid > 0 
                                        ? 'Partially Paid' 
                                        : 'Unpaid'}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1">
                                <span>জমা: <strong className="text-slate-800">৳{paid}</strong></span>
                                {due > 0 && (
                                  <span className="ml-2">বকেয়া: <strong className="text-red-600">৳{due}</strong></span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons Group */}
                            <div className="flex space-x-1 shrink-0 items-center">
                              {/* Approve Pending Payment */}
                              {status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(student.batchId, student.studentId, 'paid')}
                                    className="flex h-8 px-2.5 items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm cursor-pointer text-xs font-extrabold mr-1 shrink-0"
                                    title="পেমেন্ট একসেপ্ট করুন"
                                  >
                                    একসেপ্ট
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectPayment(student)}
                                    className="flex h-8 px-2.5 items-center justify-center bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-xl transition-all border border-rose-100 cursor-pointer text-xs font-bold mr-1 shrink-0"
                                    title="পেমেন্ট রিকোয়েস্ট রিজেক্ট করুন"
                                  >
                                    রিজেক্ট
                                  </button>
                                </>
                              )}

                              {/* Direct Cash Receipt shortcut */}
                              {due > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleDirectCashPayment(student, due)}
                                  className="flex h-8 px-2 items-center justify-center bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-xl transition-all border border-amber-100 cursor-pointer text-xs font-bold mr-1 shrink-0"
                                  title="সরাসরি ক্যাশে সম্পুর্ণ বকেয়া টাকা গ্রহণ করুন"
                                >
                                  💵 ক্যাশ গ্রহণ
                                </button>
                              )}

                              {/* Record Custom Payment */}
                              <button
                                type="button"
                                onClick={() => handleOpenRecordPayment(student)}
                                className="flex h-8 w-8 items-center justify-center bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-600 rounded-xl transition-all border border-teal-100 cursor-pointer"
                                title="টাকা জমা নিন (Record Payment)"
                              >
                                <span className="font-extrabold text-sm">৳</span>
                              </button>

                              {/* Manage Extra Charges (Fines/Exam Fees) */}
                              <button
                                type="button"
                                onClick={() => handleOpenExtraCharges(student)}
                                className="flex h-8 w-8 items-center justify-center bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-xl transition-all border border-amber-100 cursor-pointer"
                                title="পরীক্ষার ফি বা জরিমানা যোগ করুন (Manage Fines/Exam Fees)"
                              >
                                <span className="font-extrabold text-xs">+৳</span>
                              </button>

                              {/* Edit Student Billing Info */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditStudent(student)}
                                className="flex h-8 w-8 items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-100 cursor-pointer"
                                title="এডিট স্টুডেন্ট ও বিলিং (Edit Info)"
                              >
                                <Edit className="h-4 w-4" />
                              </button>

                              {/* Remove Student */}
                              <button
                                type="button"
                                onClick={() => setShowRemoveStudentInfo({ batchId: student.batchId, studentId: student.studentId, name: student.studentName })}
                                className="flex h-8 w-8 items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all border border-red-100 cursor-pointer"
                                title="স্টুডেন্ট বাতিল/kick করুন (Remove Student)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Tips / Bangladesh offline coaching help card */}
          <div className="rounded-3xl border border-teal-50 bg-teal-50/20 p-6">
            <h4 className="font-display text-sm font-bold text-teal-900 mb-2">💡 টিপস: বাংলাদেশের প্রেক্ষাপটে পেমেন্ট</h4>
            <p className="text-xs text-teal-800 leading-relaxed font-light">
              আমাদের দেশের শিক্ষার্থীরা অফলাইন কোচিং ফি সাধারণত ক্যাশ কিংবা বিকাশ/রকেটের মাধ্যমে প্রদান করে থাকে। স্টুডেন্ট যখন তাদের ড্যাশবোর্ড থেকে <strong>"Pay/Report"</strong> ক্লিক করবে, তখন আপনার এই প্যানেলে লাল রঙের <strong>"Pending Verify"</strong> স্ট্যাটাস জ্বলজ্বল করবে। আপনি নগদ টাকা কিংবা মোবাইলে টাকা বুঝে পেয়ে টিক চিহ্নে (<span className="text-emerald-700 font-bold">✓</span>) ক্লিক করলেই তাদের ড্যাশবোর্ড অটোমেটিক আপডেট হয়ে <strong>"Paid"</strong> হয়ে যাবে।
            </p>
          </div>

        </div>
        )}

        {activeTab === 'performance' && (
          <TeacherPerformanceView 
            batches={batches}
            enrollments={enrollments}
          />
        )}

        {activeTab === 'exams' && (
          <TeacherExamManager
            teacherId={user.uid}
            teacherName={user.name}
            batches={batches}
            enrollments={enrollments}
          />
        )}

      </div>

      {/* Mobile Bottom Navigation Bar (PWA Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-teal-100/60 px-3 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[safe-area-inset-bottom]">
        <div className="flex items-center justify-around">
            <button
              onClick={() => setActiveTab('batches')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'batches' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'batches' ? 'opacity-100' : 'opacity-60 grayscale'}`}>🏫</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">ব্যাচসমূহ</span>
            </button>
            
            <button
              onClick={() => setActiveTab('broadcast')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer relative ${
                activeTab === 'broadcast' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'broadcast' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📢</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">নোটিশ</span>
            </button>

            <button
              onClick={() => setActiveTab('materials')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'materials' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'materials' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📚</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">মেটেরিয়াল</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer relative ${
                activeTab === 'students' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'students' ? 'opacity-100' : 'opacity-60 grayscale'}`}>👨‍🎓</span>
              {totalStudentNotifications > 0 && (
                <span className="absolute top-0.5 right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
                  {totalStudentNotifications}
                </span>
              )}
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">স্টুডেন্ট</span>
            </button>

            <button
              onClick={() => setActiveTab('performance')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'performance' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'performance' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📈</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">রিপোর্ট</span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`flex flex-col items-center space-y-0.5 py-0.5 px-2 bg-transparent border-0 rounded-xl transition-all duration-100 transform active:scale-90 cursor-pointer ${
                activeTab === 'exams' ? 'text-teal-600 font-bold scale-105' : 'text-gray-500'
              }`}
            >
              <span className={`text-base drop-shadow-sm transition-all duration-150 ${activeTab === 'exams' ? 'opacity-100' : 'opacity-60 grayscale'}`}>📝</span>
              <span className="text-[9px] font-bold font-sans mt-0.5 tracking-wide">এক্সাম</span>
            </button>
          </div>
        </div>

      {/* ADVANCED MODALS LAYER */}

      {/* 1. Edit Student Modal */}
      {editingEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                <Edit className="h-5 w-5 text-teal-600" />
                <span>শিক্ষার্থী ও বিলিং এডিট করুন</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">{editingEnrollment.studentEmail}</p>
            </div>

            <form onSubmit={handleSubmitEditStudent} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">শিক্ষার্থীর নাম *</label>
                <input
                  type="text"
                  required
                  value={customStudentName}
                  onChange={(e) => setCustomStudentName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="text"
                    required
                    value={customStudentPhone}
                    onChange={(e) => setCustomStudentPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">শিক্ষা প্রতিষ্ঠান</label>
                  <input
                    type="text"
                    value={customStudentInstitution}
                    onChange={(e) => setCustomStudentInstitution(e.target.value)}
                    placeholder="College/School"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-teal-50/20 p-3 rounded-2xl border border-teal-100/40">
                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">টুইশন ফি (টাকা) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={customStudentFee}
                    onChange={(e) => setCustomStudentFee(Number(e.target.value))}
                    className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 bg-white font-bold text-teal-950 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider mb-1">বিশেষ ছাড় (টাকা)</label>
                  <input
                    type="number"
                    min={0}
                    value={customStudentDiscount}
                    onChange={(e) => setCustomStudentDiscount(Number(e.target.value))}
                    className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 bg-white font-bold text-emerald-700 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">ভর্তি স্ট্যাটাস</label>
                <select
                  value={customStudentStatus}
                  onChange={(e) => setCustomStudentStatus(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-xl p-2 bg-slate-50/50 focus:outline-none"
                >
                  <option value="active">Active (সক্রিয়)</option>
                  <option value="pending">Pending (অপেক্ষমান অনুরোধ)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-teal-600/10 cursor-pointer"
                >
                  {loading ? 'সংরক্ষণ হচ্ছে...' : 'সেভ করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEnrollment(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Record Custom Payment Modal */}
      {payingEnrollment && (() => {
        const fee = payingEnrollment.customFee !== undefined ? payingEnrollment.customFee : (activeBatch?.monthlyFee || 1200);
        const discount = payingEnrollment.discount || 0;
        const netPayable = Math.max(0, fee - discount);
        const paid = payingEnrollment.paidAmountMap?.[paymentFilterMonth] || 0;
        const due = Math.max(0, netPayable - paid);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center bg-teal-50 text-teal-700 rounded-lg text-sm font-extrabold">৳</span>
                    <span>ফি কালেকশন ও হিস্ট্রি রেকর্ড</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{payingEnrollment.studentName} ({paymentFilterMonth})</p>
                </div>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                  রোল/ইমেইল: {payingEnrollment.studentEmail.split('@')[0]}
                </span>
              </div>

              {/* Billing Info Widget */}
              <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded-2xl text-center border border-slate-150">
                <div>
                  <span className="block text-[8px] text-gray-400 uppercase font-bold">টুইশন ফি</span>
                  <span className="text-xs font-bold text-slate-700">৳{fee}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 uppercase font-bold">বিশেষ ছাড়</span>
                  <span className="text-xs font-bold text-emerald-600">৳{discount}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 uppercase font-bold">পরিশোধিত</span>
                  <span className="text-xs font-bold text-slate-800">৳{paid}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-red-500 uppercase font-bold">অবশিষ্ট বকেয়া</span>
                  <span className="text-xs font-extrabold text-red-600">৳{due}</span>
                </div>
              </div>

              <form onSubmit={handleSubmitRecordPayment} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">জমার পরিমাণ (টাকা) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={due > 0 ? due : undefined}
                      value={recordAmount}
                      onChange={(e) => setRecordAmount(Number(e.target.value))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">পেমেন্ট মাধ্যম *</label>
                    <select
                      value={recordMethod}
                      onChange={(e) => setRecordMethod(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl p-2 bg-slate-50/50 font-semibold focus:outline-none"
                    >
                      <option value="Cash">Cash (নগদ)</option>
                      <option value="bKash">bKash (বিকাশ)</option>
                      <option value="Nagad">Nagad (নগদ অ্যাপ)</option>
                      <option value="Rocket">Rocket (রকেট)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">TrxID (বিকাশ/নগদ রেফারেন্স)</label>
                    <input
                      type="text"
                      value={recordTrxId}
                      onChange={(e) => setRecordTrxId(e.target.value)}
                      placeholder="e.g. AX982LK09"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">সংক্ষিপ্ত নোট</label>
                    <input
                      type="text"
                      value={recordNote}
                      onChange={(e) => setRecordNote(e.target.value)}
                      placeholder="উদাঃ হাফ পেমেন্ট দিল"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submitting Buttons */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    {loading ? 'রেকর্ড হচ্ছে...' : 'পেমেন্ট জমা করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayingEnrollment(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              </form>

              {/* Transactions History Logs */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2 text-left">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">পূর্ববর্তী পেমেন্ট হিস্ট্রি ({paymentFilterMonth})</span>
                {(!payingEnrollment.paymentHistory || payingEnrollment.paymentHistory.filter(t => t.month === paymentFilterMonth).length === 0) ? (
                  <p className="text-xs text-slate-400 italic">এই মাসের কোনো পূর্ববর্তী পেমেন্ট ট্রানজেকশন নেই।</p>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {payingEnrollment.paymentHistory.filter(t => t.month === paymentFilterMonth).map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">৳{tx.amount} ({tx.method})</div>
                          {tx.trxId && <div className="text-[10px] text-teal-700 font-mono">TrxID: {tx.trxId}</div>}
                          {tx.note && <div className="text-[10px] text-slate-500 italic mt-0.5">মন্তব্য: {tx.note}</div>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(tx.date).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Delete Batch Confirmation Modal */}
      {showDeleteBatchId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">ব্যাচ ডিলিট নিশ্চিতকরণ</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                আপনি কি নিশ্চিত যে আপনি এই ব্যাচটি ডিলিট করতে চান? এর ফলে রুটিন ও শিক্ষার্থীদের সব রেকর্ড আর্কাইভ করা হবে।
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDeleteBatch(showDeleteBatchId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-red-600/10 cursor-pointer"
              >
                হ্যাঁ, নিশ্চিত ডিলিট
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteBatchId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Remove Student Confirmation Modal */}
      {showRemoveStudentInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-950">শিক্ষার্থী বাতিল নিশ্চিতকরণ</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                আপনি কি নিশ্চিত যে আপনি শিক্ষার্থী <strong>"{showRemoveStudentInfo.name}"</strong> কে এই ব্যাচ থেকে বাতিল (Kick/Unenroll) করতে চান?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemoveStudent}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-red-600/10 cursor-pointer"
              >
                হ্যাঁ, বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => setShowRemoveStudentInfo(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingStudentEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 text-lg font-bold">
                ⚠️
              </span>
              <div>
                <h3 className="font-display text-base font-black text-slate-950">পেমেন্ট প্রত্যাখ্যান করুন</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{rejectingStudentEnrollment.studentName} ({paymentFilterMonth})</p>
              </div>
            </div>

            <form onSubmit={handleSubmitRejection} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">প্রত্যাখ্যানের কারণ লিখুন (শিক্ষার্থী দেখতে পাবে):</label>
                <textarea
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 min-h-[90px] text-slate-800 leading-relaxed font-semibold"
                  placeholder="যেমন: ভুল ট্রানজেকশন আইডি অথবা টাকা পাওয়া যায়নি।"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-md shadow-rose-600/10 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'প্রসেসিং হচ্ছে...' : 'প্রত্যাখ্যান নিশ্চিত করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingStudentEnrollment(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer"
                >
                  বাতিল করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Manage Extra Charges (Fines/Exam Fees) Modal */}
      {managingExtraChargesEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-600" />
                <span>পরীক্ষার ফি বা জরিমানা যোগ করুন</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold">{managingExtraChargesEnrollment.studentName} ({paymentFilterMonth})</p>
            </div>

            {/* List of current extra charges */}
            <div className="space-y-2 text-left">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">চলতি মাসের অতিরিক্ত ফি তালিকা:</label>
              {currentExtraChargesList.length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">কোনো অতিরিক্ত ফি বা জরিমানা ধার্য করা হয়নি।</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {currentExtraChargesList.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-amber-50/40 rounded-xl border border-amber-100/50">
                      <div>
                        <span className="font-bold text-slate-800">{item.description}</span>
                        <span className="text-[10px] text-slate-400 block">ধার্যকৃত</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800">৳{item.amount}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraChargeItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 cursor-pointer"
                          title="বাতিল করুন"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to add a new extra charge */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3 text-left">
              <span className="block text-xs font-bold text-slate-800">নতুন চার্জ/জরিমানা ধার্য করুন:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">বিবরণ</label>
                  <input
                    type="text"
                    value={newExtraChargeDesc}
                    onChange={(e) => setNewExtraChargeDesc(e.target.value)}
                    placeholder="যেমনঃ মডেল টেস্ট ফি, জরিমানা"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">পরিমাণ (টাকা)</label>
                  <input
                    type="number"
                    min={1}
                    value={newExtraChargeAmount || ''}
                    onChange={(e) => setNewExtraChargeAmount(Number(e.target.value))}
                    placeholder="উদাঃ ২০০"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddExtraChargeItem}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                তালিকায় যোগ করুন (+)
              </button>
            </div>

            {/* Main Action Buttons */}
            <form onSubmit={handleSubmitExtraCharges} className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                {loading ? 'সংরক্ষণ হচ্ছে...' : 'সব পরিবর্তন সেভ করুন'}
              </button>
              <button
                type="button"
                onClick={() => setManagingExtraChargesEnrollment(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                বাতিল
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Batch-wide Extra Charges Modal */}
      {showBatchWideChargeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-600" />
                <span>পুরো ব্যাচে অতিরিক্ত ফি যোগ করুন</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                ব্যাচ: {batches.find(b => b.id === selectedBatchId)?.name || ''} ({paymentFilterMonth})
              </p>
            </div>

            <form onSubmit={handleSubmitBatchWideExtraCharges} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">ফি/জরিমানার বিবরণ *</label>
                <input
                  type="text"
                  required
                  value={batchWideChargeDesc}
                  onChange={(e) => setBatchWideChargeDesc(e.target.value)}
                  placeholder="যেমনঃ মডেল টেস্ট ফি, জরিমানা, শিট বা বুকলেট ফি"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">টাকার পরিমাণ *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={batchWideChargeAmount || ''}
                  onChange={(e) => setBatchWideChargeAmount(Number(e.target.value))}
                  placeholder="যেমনঃ ২০০"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-amber-50/40 border border-amber-100/50 p-3 rounded-xl text-[11px] text-amber-800 font-semibold space-y-1">
                <p className="font-bold">⚠️ সতর্কবার্তা:</p>
                <p>এটি এই ব্যাচের প্রত্যেক সক্রিয় শিক্ষার্থীর জন্য সিলেক্টকৃত মাসে ({paymentFilterMonth}) নির্ধারিত পরিমাণ টাকা যোগ করে দিবে। পরবর্তীতে কোনো শিক্ষার্থীর ক্ষেত্রে এটি পরিবর্তন করতে চাইলে একাকীও করা যাবে।</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {loading ? 'প্রক্রিয়াধীন...' : 'ধার্য করুন ও সংরক্ষণ করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchWideChargeModal(false)}
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
