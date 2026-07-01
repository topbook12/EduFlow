import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  User, 
  Filter, 
  Search, 
  AlertTriangle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  X,
  MapPin,
  CalendarDays,
  FileText,
  Video,
  GripVertical,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { AppUser, BatchSchedule } from '../types';
import { updateBatchSchedule } from '../dbUtils';
import { generateWeeklySchedulePDF } from '../utils/reportGenerator';

export interface CalendarClassItem {
  day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  time: string; // "14:30" style 24h
  batchId: string;
  batchName: string;
  subject: string;
  code?: string;
  teacherName?: string;
  accentIndex?: number;
}

interface WeeklyCalendarViewProps {
  items: CalendarClassItem[];
  userRole: 'teacher' | 'student';
  onQuickReschedule?: (batchId: string) => void;
  batchesList?: any[];
  user?: AppUser;
}

const BENGALI_DAYS: Record<string, string> = {
  Sunday: 'রবিবার',
  Monday: 'সোমবার',
  Tuesday: 'মঙ্গলবার',
  Wednesday: 'বুধবার',
  Thursday: 'বৃহস্পতিবার',
  Friday: 'শুক্রবার',
  Saturday: 'শনিবার',
};

const BENGALI_DAYS_SHORT: Record<string, string> = {
  Sunday: 'রবি',
  Monday: 'সোম',
  Tuesday: 'মঙ্গল',
  Wednesday: 'বুধ',
  Thursday: 'বৃহস্পতি',
  Friday: 'শুক্র',
  Saturday: 'শনি',
};

const DAYS_OF_WEEK: CalendarClassItem['day'][] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// Beautiful card background border and shadow combinations based on index
const THEME_STYLES = [
  {
    border: 'border-t-teal-500',
    bg: 'from-teal-50/45 to-white',
    badge: 'bg-teal-500 text-white',
    lightBadge: 'bg-teal-50 text-teal-700 border-teal-200/50',
    ring: 'focus:ring-teal-500/20',
    accent: 'teal'
  },
  {
    border: 'border-t-violet-500',
    bg: 'from-violet-50/45 to-white',
    badge: 'bg-violet-500 text-white',
    lightBadge: 'bg-violet-50 text-violet-700 border-violet-200/50',
    ring: 'focus:ring-violet-500/20',
    accent: 'violet'
  },
  {
    border: 'border-t-orange-500',
    bg: 'from-orange-50/45 to-white',
    badge: 'bg-orange-500 text-white',
    lightBadge: 'bg-orange-50 text-orange-700 border-orange-200/50',
    ring: 'focus:ring-orange-500/20',
    accent: 'orange'
  },
  {
    border: 'border-t-emerald-500',
    bg: 'from-emerald-50/45 to-white',
    badge: 'bg-emerald-500 text-white',
    lightBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    ring: 'focus:ring-emerald-500/20',
    accent: 'emerald'
  },
  {
    border: 'border-t-amber-500',
    bg: 'from-amber-50/45 to-white',
    badge: 'bg-amber-500 text-white',
    lightBadge: 'bg-amber-50 text-amber-700 border-amber-200/50',
    ring: 'focus:ring-amber-500/20',
    accent: 'amber'
  },
  {
    border: 'border-t-sky-500',
    bg: 'from-sky-50/45 to-white',
    badge: 'bg-sky-500 text-white',
    lightBadge: 'bg-sky-50 text-sky-700 border-sky-200/50',
    ring: 'focus:ring-sky-500/20',
    accent: 'sky'
  },
  {
    border: 'border-t-rose-500',
    bg: 'from-rose-50/45 to-white',
    badge: 'bg-rose-500 text-white',
    lightBadge: 'bg-rose-50 text-rose-700 border-rose-200/50',
    ring: 'focus:ring-rose-500/20',
    accent: 'rose'
  }
];

export const WeeklyCalendarView: React.FC<WeeklyCalendarViewProps> = ({
  items,
  userRole,
  onQuickReschedule,
  batchesList = [],
  user
}) => {
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMobileDay, setSelectedMobileDay] = useState<CalendarClassItem['day']>(() => {
    const todayEnglish = DAYS_OF_WEEK[new Date().getDay()];
    return todayEnglish;
  });
  const [activeDetailItem, setActiveDetailItem] = useState<CalendarClassItem | null>(null);

  // Drag and Drop States
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<CalendarClassItem | null>(null);
  const [draggedOverDay, setDraggedOverDay] = useState<CalendarClassItem['day'] | null>(null);
  
  // Reschedule Confirmation Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rescheduleTargetDay, setRescheduleTargetDay] = useState<CalendarClassItem['day']>('Sunday');
  const [rescheduleTargetTime, setRescheduleTargetTime] = useState<string>('14:30');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);

  // Success/Error Feedback Alerts
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const COMMON_TIME_SLOTS = [
    { time: '08:00', label: 'সকাল ০৮:০০' },
    { time: '10:30', label: 'সকাল ১০:৩০' },
    { time: '12:00', label: 'দুপুর ১২:০০' },
    { time: '14:30', label: 'দুপুর ০২:৩০' },
    { time: '16:00', label: 'বিকাল ০৪:০০' },
    { time: '18:00', label: 'সন্ধ্যা ০৬:০০' },
    { time: '19:30', label: 'সন্ধ্যা ০৭:৩০' },
  ];

  const handleDragStart = (e: React.DragEvent, item: CalendarClassItem) => {
    if (userRole !== 'teacher') return;
    setIsDragging(true);
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', item.batchId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedOverDay(null);
  };

  const handleDragOver = (e: React.DragEvent, dayName: CalendarClassItem['day']) => {
    if (userRole !== 'teacher') return;
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, dayName: CalendarClassItem['day']) => {
    if (userRole !== 'teacher') return;
    e.preventDefault();
    setDraggedOverDay(dayName);
  };

  const handleDropGeneral = (e: React.DragEvent, dayName: CalendarClassItem['day']) => {
    if (userRole !== 'teacher' || !draggedItem) return;
    e.preventDefault();
    
    setRescheduleTargetDay(dayName);
    setRescheduleTargetTime(draggedItem.time);
    setRescheduleReason('');
    setShowConfirmModal(true);
    
    setIsDragging(false);
    setDraggedOverDay(null);
  };

  const handleDropWithTime = (dayName: CalendarClassItem['day'], time: string) => {
    if (userRole !== 'teacher' || !draggedItem) return;
    
    setRescheduleTargetDay(dayName);
    setRescheduleTargetTime(time);
    setRescheduleReason('');
    setShowConfirmModal(true);
    
    setIsDragging(false);
    setDraggedOverDay(null);
  };

  const executeReschedule = async () => {
    if (!draggedItem || !user) {
      setErrorMessage('রুটিন আপডেট করার জন্য আপনি শিক্ষক হিসেবে লগইন থাকা আবশ্যক।');
      return;
    }
    setRescheduling(true);
    try {
      const batchObj = batchesList?.find(b => b.id === draggedItem.batchId);
      if (!batchObj) {
        throw new Error('ব্যাচ সংক্রান্ত তথ্য খুঁজে পাওয়া যায়নি।');
      }

      const hasConflict = batchObj.schedule.some(
        (s: any) => s.day === rescheduleTargetDay && s.time === rescheduleTargetTime
      );

      let updatedSchedule: BatchSchedule[] = [];
      if (hasConflict) {
        updatedSchedule = batchObj.schedule.filter(
          (s: any) => !(s.day === draggedItem.day && s.time === draggedItem.time)
        );
      } else {
        updatedSchedule = batchObj.schedule.map((s: any) => {
          if (s.day === draggedItem.day && s.time === draggedItem.time) {
            return { day: rescheduleTargetDay, time: rescheduleTargetTime };
          }
          return s;
        });
      }

      await updateBatchSchedule(
        draggedItem.batchId,
        batchObj.name,
        user.uid,
        user.name,
        updatedSchedule,
        rescheduleReason.trim()
      );

      setSuccessMessage(
        `সফলভাবে "${batchObj.name}" এর ক্লাস ${BENGALI_DAYS[draggedItem.day]} থেকে ${BENGALI_DAYS[rescheduleTargetDay]} ${formatTimeTo12Hour(rescheduleTargetTime)} টায় স্থানান্তর করা হয়েছে!`
      );
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);

      setShowConfirmModal(false);
      setDraggedItem(null);
    } catch (err: any) {
      console.error('Error rescheduling class:', err);
      setErrorMessage(err.message || 'ক্লাস স্থানান্তর করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => {
        setErrorMessage('');
      }, 5000);
    } finally {
      setRescheduling(false);
    }
  };

  const currentEnglishDay = useMemo(() => {
    return DAYS_OF_WEEK[new Date().getDay()];
  }, []);

  const currentFormattedTime = useMemo(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  }, []);

  // Format 24h to 12h nicely
  const formatTimeTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hourStr, minStr] = time24.split(':');
    const hour = parseInt(hourStr);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minStr} ${ampm}`;
  };

  // Extract unique batches represented in current schedules for the filtering row
  const uniqueBatches = useMemo(() => {
    const batchMap = new Map<string, { id: string; name: string; subject: string }>();
    items.forEach(item => {
      if (!batchMap.has(item.batchId)) {
        batchMap.set(item.batchId, {
          id: item.batchId,
          name: item.batchName,
          subject: item.subject
        });
      }
    });
    return Array.from(batchMap.values());
  }, [items]);

  // Filtered schedule list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesBatch = selectedBatchFilter === 'all' || item.batchId === selectedBatchFilter;
      const matchesSearch = searchQuery.trim() === '' || 
        item.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.teacherName && item.teacherName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        BENGALI_DAYS[item.day].includes(searchQuery) ||
        item.time.includes(searchQuery);
      return matchesBatch && matchesSearch;
    });
  }, [items, selectedBatchFilter, searchQuery]);

  // Group classes by day for easier rendering
  const classesByDay = useMemo(() => {
    const map: Record<CalendarClassItem['day'], CalendarClassItem[]> = {
      Sunday: [],
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: []
    };
    filteredItems.forEach(item => {
      map[item.day].push(item);
    });
    // Sort each day's classes chronologically by time
    DAYS_OF_WEEK.forEach(day => {
      map[day].sort((a, b) => a.time.localeCompare(b.time));
    });
    return map;
  }, [filteredItems]);

  // Detect live classes happening right now (within 1.5 hours of scheduled time on today's day)
  const getLiveClassState = (item: CalendarClassItem) => {
    if (item.day !== currentEnglishDay) return { isLive: false, label: '' };
    
    const [itemHr, itemMin] = item.time.split(':').map(Number);
    const [nowHr, nowMin] = currentFormattedTime.split(':').map(Number);
    
    const itemMinutes = itemHr * 60 + itemMin;
    const nowMinutes = nowHr * 60 + nowMin;
    
    // Class is considered live if it started in the last 90 minutes or starts in the next 10 minutes
    const diff = nowMinutes - itemMinutes;
    if (diff >= -10 && diff <= 90) {
      if (diff < 0) {
        return { isLive: true, label: 'কিছুক্ষণের মধ্যে শুরু হবে' };
      }
      return { isLive: true, label: 'লাইভ ক্লাস চলছে' };
    }
    return { isLive: false, label: '' };
  };

  const animationContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemAnimation = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 12 } }
  };

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-5 sm:p-6 shadow-xl shadow-gray-100/40 relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-44 h-44 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Success & Error Floating Banners */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-start gap-2.5 shadow-sm text-xs sm:text-sm font-bold z-30 relative"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 bg-rose-50 border-2 border-rose-200 text-rose-950 p-4 rounded-2xl flex items-start gap-2.5 shadow-sm text-xs sm:text-sm font-bold z-30 relative"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg sm:text-xl font-black text-slate-900">
                ইন্টারেক্টিভ সাপ্তাহিক রুটিন বোর্ড ⚡
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200/40 px-2.5 py-0.5 text-[10px] font-extrabold text-teal-800 animate-pulse">
                <Sparkles className="h-3 w-3" />
                স্মার্ট ক্যালেন্ডার
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-gray-500 mt-0.5">
              {userRole === 'teacher' 
                ? 'আপনার সকল ব্যাচের ক্লাস টাইমলাইন এক নজরে দেখুন ও ইনস্ট্যান্ট আপডেট করুন' 
                : 'আপনার এনরোল করা সকল ব্যাচের ক্লাসের পূর্ণাঙ্গ সাপ্তাহিক সময়সূচী'}
            </p>
          </div>
        </div>

        {/* Action Controls / Counter */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <button
            onClick={() => {
              if (batchesList && user) {
                generateWeeklySchedulePDF({
                  userName: user.name,
                  role: userRole,
                  batches: batchesList
                });
              }
            }}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            title="রুটিন ডাউনলোড করুন (PDF)"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">রুটিন (PDF)</span>
          </button>
          <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-xl">
            <span className="text-xs font-black text-slate-700 px-3">
              মোট ক্লাস: <span className="text-teal-600 text-sm font-black">{items.length}টি</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
        {/* Search Bar */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ব্যাচের নাম, বিষয় বা কোড দিয়ে খুঁজুন..."
            className="w-full bg-white border border-gray-250/70 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all placeholder-gray-400"
          />
        </div>

        {/* Batch Filter Dropdown */}
        <div className="md:col-span-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 shrink-0 hidden sm:inline" />
          <select
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
            className="w-full bg-white border border-gray-250/70 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
          >
            <option value="all">সব ব্যাচ ({uniqueBatches.length})</option>
            {uniqueBatches.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.subject})</option>
            ))}
          </select>
        </div>

        {/* Live Filter Indicator / Reset */}
        <div className="md:col-span-3 flex justify-end items-center">
          {(selectedBatchFilter !== 'all' || searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedBatchFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-red-500 hover:text-red-600 hover:underline px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50/50 cursor-pointer w-full text-center"
            >
              ফিল্টার রিসেট করুন
            </button>
          )}
          {selectedBatchFilter === 'all' && searchQuery === '' && (
            <div className="text-right w-full hidden md:block text-[11px] font-bold text-slate-400 italic">
              সাপ্তাহিক ছক ভিউ সচল রয়েছে
            </div>
          )}
        </div>
      </div>

      {/* Desktop Weekly Grid (7 Columns) */}
      <div className="hidden lg:grid lg:grid-cols-7 gap-3.5">
        {DAYS_OF_WEEK.map((dayName, index) => {
          const dayClasses = classesByDay[dayName];
          const isToday = dayName === currentEnglishDay;
          
          return (
            <div 
              key={dayName}
              onDragOver={(e) => handleDragOver(e, dayName)}
              onDragEnter={(e) => handleDragEnter(e, dayName)}
              onDrop={(e) => handleDropGeneral(e, dayName)}
              className={`rounded-2xl border-2 p-3 transition-all duration-300 flex flex-col min-h-[380px] relative ${
                draggedOverDay === dayName
                  ? 'border-teal-500 bg-teal-50/25 ring-4 ring-teal-500/10 shadow-lg shadow-teal-500/5'
                  : isToday 
                  ? 'border-teal-500 bg-gradient-to-b from-teal-50/30 to-teal-50/5 shadow-md shadow-teal-500/5 ring-4 ring-teal-500/5' 
                  : 'border-slate-100 bg-slate-50/20 hover:border-slate-200 hover:bg-white'
              }`}
            >
              {/* Day Header */}
              <div className={`flex flex-col items-center justify-center pb-2.5 mb-3 border-b border-dashed ${
                isToday ? 'border-teal-200' : 'border-slate-200/60'
              }`}>
                <span className={`text-xs font-black tracking-wide ${isToday ? 'text-teal-900 font-extrabold bg-teal-500/20 px-2.5 py-0.5 rounded-lg border border-teal-500/30' : 'text-slate-500'}`}>
                  {BENGALI_DAYS[dayName]}
                </span>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 mt-0.5 tracking-wider">
                  {dayName.substring(0, 3)}
                </span>
              </div>

              {/* Day Class List */}
              <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5 flex-1 flex flex-col">
                  {dayClasses.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                      <Calendar className="h-5 w-5 text-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400 mt-1 italic">ফ্রি ডে (No Class)</span>
                    </div>
                  ) : (
                    dayClasses.map((cl, clIdx) => {
                      const style = THEME_STYLES[cl.accentIndex !== undefined ? cl.accentIndex % THEME_STYLES.length : clIdx % THEME_STYLES.length];
                      const liveState = getLiveClassState(cl);

                      return (
                        <motion.div
                          key={`${cl.batchId}-${clIdx}`}
                          layoutId={`card-${cl.batchId}-${cl.time}`}
                          whileHover={{ scale: 1.03, y: -2 }}
                          onClick={() => setActiveDetailItem(cl)}
                          draggable={userRole === 'teacher'}
                          onDragStart={(e) => handleDragStart(e, cl)}
                          onDragEnd={handleDragEnd}
                          className={`bg-white rounded-xl border-t-4 ${style.border} border-x border-b border-slate-100 shadow-sm p-3 hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer text-left relative overflow-hidden group select-none ${
                            userRole === 'teacher' ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${
                            draggedItem?.batchId === cl.batchId && draggedItem?.time === cl.time && draggedItem?.day === cl.day
                              ? 'opacity-45 scale-95 border-dashed border-teal-400 ring-2 ring-teal-500/20'
                              : ''
                          }`}
                        >
                          {liveState.isLive && (
                            <div className="absolute top-0 right-0 left-0 bg-rose-500 text-white text-[8px] font-black text-center py-0.5 animate-pulse uppercase tracking-widest z-10">
                              🔴 লাইভ চলছে
                            </div>
                          )}
                          
                          <div className={`pt-1.5 ${liveState.isLive ? 'mt-2.5' : ''}`}>
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-[10px] font-black text-teal-700 truncate">{cl.subject}</p>
                              {userRole === 'teacher' && (
                                <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-400 shrink-0 cursor-grab" />
                              )}
                            </div>
                            <h4 className="text-[11px] font-black text-slate-900 tracking-tight leading-snug mt-1 group-hover:text-teal-600 transition-colors truncate">
                              {cl.batchName}
                            </h4>
                            
                            <div className="mt-3.5 pt-2 border-t border-slate-50 flex items-center gap-1.5 text-[10px] text-slate-500 font-extrabold">
                              <Clock className={`h-3 w-3 ${liveState.isLive ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'}`} />
                              <span className={liveState.isLive ? 'text-rose-600 font-extrabold' : 'text-slate-700'}>
                                {formatTimeTo12Hour(cl.time)}
                              </span>
                            </div>

                            {cl.code && (
                              <span className="absolute bottom-2.5 right-2 text-[8px] font-extrabold tracking-wider bg-slate-50 border border-slate-100 px-1 py-0.2 rounded-md text-slate-400 uppercase">
                                {cl.code.substring(0, 6)}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Common Time Slots Drop-zones (Shown while actively dragging) */}
                {isDragging && userRole === 'teacher' && (
                  <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 space-y-1 bg-slate-50/50 p-1.5 rounded-xl animate-fade-in z-20">
                    <span className="text-[8px] font-black text-teal-600 block text-center uppercase tracking-wider mb-1">
                      এখানে ছেড়ে দিন (সময়):
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {COMMON_TIME_SLOTS.map((slot) => (
                        <div
                          key={slot.time}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDropWithTime(dayName, slot.time);
                          }}
                          className="border border-dashed border-teal-200/80 hover:border-teal-500 hover:bg-teal-50 text-[8px] font-extrabold text-teal-700 py-1 rounded text-center transition-all cursor-pointer hover:shadow-xs"
                        >
                          {slot.label} ({slot.time})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile & Tablet Interactive Day View (Optimized for touches & slides) */}
      <div className="lg:hidden">
        {/* Horizontal Day Selector tabs */}
        <div className="flex overflow-x-auto gap-2 pb-3 mb-4 no-scrollbar -mx-2 px-2">
          {DAYS_OF_WEEK.map((dayName) => {
            const isSelected = selectedMobileDay === dayName;
            const isToday = dayName === currentEnglishDay;
            const dayCount = classesByDay[dayName].length;

            return (
              <button
                key={dayName}
                type="button"
                onClick={() => setSelectedMobileDay(dayName)}
                className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl py-2 px-4 border-2 transition-all min-w-[72px] cursor-pointer ${
                  isSelected
                    ? 'border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-600/10'
                    : isToday
                    ? 'border-teal-200 bg-teal-50 text-teal-800'
                    : 'border-slate-100 bg-slate-50/50 text-slate-600'
                }`}
              >
                <span className={`text-[10px] uppercase font-extrabold tracking-wider ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                  {BENGALI_DAYS_SHORT[dayName]}
                </span>
                <span className="text-xs font-black mt-0.5">
                  {dayName.substring(0, 3)}
                </span>
                {dayCount > 0 && (
                  <span className={`mt-1.5 text-[8px] font-black rounded-full px-1.5 py-0.2 ${
                    isSelected ? 'bg-white text-teal-700' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {dayCount}টি
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day View Card List */}
        <div className="bg-slate-50/55 rounded-3xl p-4 border border-slate-150/70">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150/50">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse"></span>
              <h4 className="font-display font-extrabold text-slate-900 text-sm">
                {BENGALI_DAYS[selectedMobileDay]} ({selectedMobileDay}) এর ক্লাসসমূহ
              </h4>
            </div>
            <span className="text-xs font-black bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-600">
              {classesByDay[selectedMobileDay].length} ক্লাস
            </span>
          </div>

          <motion.div 
            variants={animationContainer}
            initial="hidden"
            animate="show"
            key={selectedMobileDay}
            className="space-y-3"
          >
            {classesByDay[selectedMobileDay].length === 0 ? (
              <div className="text-center py-10 rounded-2xl bg-white border border-dashed border-slate-250/60 p-5">
                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h5 className="font-extrabold text-slate-800 text-xs">এই দিন কোনো ক্লাস রুটিন নেই</h5>
                <p className="text-[11px] text-slate-400 mt-1">সপ্তাহের অন্য কোন দিন নির্বাচন করুন বা ফিল্টার পরিবর্তন করুন</p>
              </div>
            ) : (
              classesByDay[selectedMobileDay].map((cl, clIdx) => {
                const style = THEME_STYLES[cl.accentIndex !== undefined ? cl.accentIndex % THEME_STYLES.length : clIdx % THEME_STYLES.length];
                const liveState = getLiveClassState(cl);

                return (
                  <motion.div
                    key={`${cl.batchId}-${clIdx}`}
                    variants={itemAnimation}
                    onClick={() => setActiveDetailItem(cl)}
                    className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 active:scale-98 transition-transform cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                        style.accent === 'teal' ? 'from-teal-400 to-teal-600' :
                        style.accent === 'violet' ? 'from-violet-400 to-violet-600' :
                        style.accent === 'orange' ? 'from-orange-400 to-orange-600' :
                        style.accent === 'emerald' ? 'from-emerald-400 to-emerald-600' :
                        style.accent === 'amber' ? 'from-amber-400 to-amber-600' :
                        style.accent === 'sky' ? 'from-sky-400 to-sky-600' :
                        'from-rose-400 to-rose-600'
                      } text-white font-black text-[10px]`}>
                        {cl.subject.substring(0, 3).toUpperCase()}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${style.lightBadge} border`}>
                            {cl.code || 'BATCH'}
                          </span>
                          {liveState.isLive && (
                            <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.2 rounded animate-pulse">
                              LIVE
                            </span>
                          )}
                        </div>
                        <h5 className="font-display font-black text-sm text-slate-900 truncate mt-1">
                          {cl.batchName}
                        </h5>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                          {cl.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1 text-slate-800 font-extrabold text-xs">
                        <Clock className={`h-3 w-3 ${liveState.isLive ? 'text-rose-500' : 'text-slate-400'}`} />
                        <span className={liveState.isLive ? 'text-rose-600 font-extrabold' : ''}>
                          {formatTimeTo12Hour(cl.time)}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 mt-1">
                        {cl.teacherName ? `শিক্ষক: ${cl.teacherName}` : 'নির্ধারিত ক্লাস'}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </div>
      </div>

      {/* Aesthetic Detail & Interaction Modal */}
      <AnimatePresence>
        {activeDetailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDetailItem(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
            >
              {/* Colored top gradient light bar */}
              <div className="absolute top-0 right-0 left-0 h-2.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-violet-600"></div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveDetailItem(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {/* Modal Body */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/50 rounded-lg">
                    {activeDetailItem.code || 'BATCH INFO'}
                  </span>
                  {getLiveClassState(activeDetailItem).isLive && (
                    <span className="px-2 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-lg animate-pulse">
                      🔴 লাইভ চলছে
                    </span>
                  )}
                </div>

                <h3 className="font-display text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {activeDetailItem.batchName}
                </h3>
                
                <p className="text-sm font-bold text-slate-500 mt-1">
                  বিষয়: {activeDetailItem.subject}
                </p>

                {/* Information Card Grid */}
                <div className="mt-5 space-y-3.5 bg-slate-50 border border-slate-150/70 p-4 rounded-2xl">
                  {/* Schedule Day details */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-150 flex items-center justify-center text-teal-600 shrink-0">
                      <Calendar className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 leading-none">শ্রেণী দিন</p>
                      <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                        {BENGALI_DAYS[activeDetailItem.day]} ({activeDetailItem.day})
                      </p>
                    </div>
                  </div>

                  {/* Class Time details */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-violet-50 border border-violet-150 flex items-center justify-center text-violet-600 shrink-0">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 leading-none">ক্লাস টাইম</p>
                      <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                        {formatTimeTo12Hour(activeDetailItem.time)} ({activeDetailItem.time})
                      </p>
                    </div>
                  </div>

                  {/* Teacher details */}
                  {activeDetailItem.teacherName && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-600 shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 leading-none">শিক্ষক</p>
                        <p className="text-xs sm:text-sm font-black text-slate-800 mt-1">
                          {activeDetailItem.teacherName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conflict indicator if conflicts happen for teachers */}
                {userRole === 'teacher' && (
                  <div className="mt-4 bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] sm:text-xs text-amber-900 flex items-start space-x-2 font-medium">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      যদি আপনার এই সময়ে অন্য কোনো ক্লাস থেকে থাকে, তাহলে দয়া করে রুটিন শিডিউলার থেকে পরিবর্তন করুন।
                    </span>
                  </div>
                )}

                {/* Modal footer Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveDetailItem(null)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                  
                  {userRole === 'teacher' && onQuickReschedule && (
                    <button
                      type="button"
                      onClick={() => {
                        onQuickReschedule(activeDetailItem.batchId);
                        setActiveDetailItem(null);
                      }}
                      className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs sm:text-sm transition-all duration-150 text-center shadow-md shadow-teal-600/10 cursor-pointer"
                    >
                      রুটিন পরিবর্তন
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reschedule Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && draggedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
            ></motion.div>

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
            >
              {/* Colored top gradient light bar */}
              <div className="absolute top-0 right-0 left-0 h-2.5 bg-gradient-to-r from-amber-500 via-teal-400 to-violet-600"></div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {/* Modal Body */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/50 rounded-lg">
                    রুটিন পরিবর্তন ⚡
                  </span>
                </div>

                <h3 className="font-display text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {draggedItem.batchName}
                </h3>
                
                <p className="text-sm font-bold text-slate-500 mt-1">
                  বিষয়: {draggedItem.subject}
                </p>

                {/* Reschedule visual comparison */}
                <div className="mt-4 grid grid-cols-1 gap-2.5 bg-slate-50 border border-slate-150/75 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">পূর্বের সময়</p>
                      <p className="text-xs sm:text-sm font-black text-slate-500 line-through mt-0.5">
                        {BENGALI_DAYS[draggedItem.day]} ({formatTimeTo12Hour(draggedItem.time)})
                      </p>
                    </div>
                    <span className="text-xl">➔</span>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-teal-500">নতুন সময়</p>
                      <p className="text-xs sm:text-sm font-black text-teal-700 mt-0.5">
                        {BENGALI_DAYS[rescheduleTargetDay]} ({formatTimeTo12Hour(rescheduleTargetTime)})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fine adjustments: Time Picker */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-500" />
                    <span>নতুন সময় সূক্ষ্মভাবে পরিবর্তন করুন (ঐচ্ছিক):</span>
                  </label>
                  <input
                    type="time"
                    value={rescheduleTargetTime}
                    onChange={(e) => setRescheduleTargetTime(e.target.value)}
                    className="w-full bg-slate-50/50 border-2 border-slate-150 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* Reason input for notification */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-500" />
                    <span>পরিবর্তনের কারণ/বিশেষ নোট (শিক্ষার্থীদের নোটিশ পাঠানো হবে):</span>
                  </label>
                  <textarea
                    placeholder="যেমন: অনিবার্য কারণে এই সপ্তাহের ক্লাসটি স্থানান্তর করা হলো।"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50/50 border-2 border-slate-150 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all resize-none"
                  ></textarea>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={rescheduling}
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-extrabold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    বাতিল করুন
                  </button>
                  
                  <button
                    type="button"
                    disabled={rescheduling}
                    onClick={executeReschedule}
                    className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black rounded-xl text-xs sm:text-sm transition-all duration-150 text-center shadow-md shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {rescheduling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>অপেক্ষা করুন...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>নিশ্চিত করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
