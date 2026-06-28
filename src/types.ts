export type UserRole = 'student' | 'teacher';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  institution?: string;
  createdAt: any; // Timestamp or string
}

export interface BatchSchedule {
  day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  time: string; // HH:MM (24h format)
}

export interface Batch {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  schedule: BatchSchedule[];
  monthlyFee: number; // in BDT (৳)
  code: string; // unique invite code (e.g., MATH-402)
  createdAt: any;
  deleted?: boolean;
}

export interface Transaction {
  id: string;
  month: string;
  amount: number;
  date: string;
  method: string; // e.g. 'Bkash' | 'Nagad' | 'Rocket' | 'Cash' | 'Other'
  trxId?: string;
  note?: string;
}

export interface ExtraCharge {
  id: string;
  description: string; // e.g. 'Model Test', 'Fine', 'Ad-hoc'
  amount: number;
}

export interface Enrollment {
  id: string; // batchId_studentId
  batchId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentInstitution?: string;
  status: 'active' | 'pending';
  enrolledAt: any;
  paymentStatus: {
    [month: string]: 'paid' | 'pending' | 'unpaid'; // e.g. "June 2026": "paid"
  };
  customFee?: number; // custom tuition fee for this specific student
  discount?: number;  // custom discount for this specific student in BDT
  paidAmountMap?: {
    [month: string]: number; // actual amount paid for that month
  };
  paymentHistory?: Transaction[];
  extraCharges?: {
    [month: string]: ExtraCharge[]; // ad-hoc exam/test charges or fines for a specific month
  };
}

export interface StudyMaterial {
  id: string;
  batchId: string;
  batchName: string;
  teacherId: string;
  title: string;
  description: string;
  fileUrl: string; // drive/pdf link
  createdAt: any;
}

export interface Notice {
  id: string;
  batchId: string;
  batchName: string;
  teacherId: string;
  teacherName: string;
  type: 'schedule_change' | 'general' | 'exam_alert';
  message: string;
  createdAt: any;
}

export interface DailyRoadmapItem {
  day: string;
  batchId: string;
  batchName: string;
  subject: string;
  teacherName: string;
  time: string; // e.g. "04:30 PM"
}
