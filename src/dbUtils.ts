import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppUser, Batch, Enrollment, StudyMaterial, Notice, Transaction, ExtraCharge, Attendance, Exam, ExamResult } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Constants for Demo UIDs
export const DEMO_TEACHER_UID = 'demo-teacher-rafid';
export const DEMO_STUDENT_UID = 'demo-student-sadman';

// --- HYBRID DATABASE ROBUSTNESS ENGINE ---
let isOfflineMode = false;
const offlineStatusListeners = new Set<(status: boolean) => void>();

export function getOfflineStatus() {
  return isOfflineMode;
}

export function setOfflineStatus(status: boolean) {
  isOfflineMode = status;
  offlineStatusListeners.forEach(listener => listener(status));
}

export function subscribeToOfflineStatus(listener: (status: boolean) => void) {
  offlineStatusListeners.add(listener);
  listener(isOfflineMode);
  return () => {
    offlineStatusListeners.delete(listener);
  };
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.code || error).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unreachable') ||
    msg.includes('failed to connect') ||
    msg.includes('unavailable') ||
    msg.includes('timeout')
  );
}

export async function runOnlineWrite(operation: () => Promise<any>): Promise<boolean> {
  try {
    await operation();
    // Successfully executed on Firestore, clear offline state if any
    setOfflineStatus(false);
    return true;
  } catch (fsError: any) {
    console.warn("Firestore write operation failed, continuing in offline cache mode:", fsError);
    if (isNetworkError(fsError)) {
      setOfflineStatus(true);
    }
    return false;
  }
}

// Active local subscriptions registry (Pub-Sub fallback)
type SubscriptionCallback<T> = (data: T[]) => void;

interface Subscription {
  id: string;
  type: string;
  filterFn: (item: any) => boolean;
  callback: SubscriptionCallback<any>;
}

let localSubscriptions: Subscription[] = [];

function getLocalCollection<T>(name: string): T[] {
  const data = localStorage.getItem(`coaching_connect_${name}`);
  return data ? JSON.parse(data) : [];
}

function setLocalCollection<T>(name: string, items: T[]) {
  localStorage.setItem(`coaching_connect_${name}`, JSON.stringify(items));
  triggerLocalSubscribers(name);
}

function triggerLocalSubscribers(collectionName: string) {
  const items = getLocalCollection<any>(collectionName);
  localSubscriptions
    .filter(sub => sub.type === collectionName)
    .forEach(sub => {
      try {
        const filtered = items.filter(sub.filterFn);
        sub.callback(filtered);
      } catch (err) {
        console.error("Error in local subscription callback:", err);
      }
    });
}

// Initial Sync from Firestore to LocalStorage
async function syncFirestoreToLocal() {
  try {
    const collectionsToSync = ['users', 'batches', 'enrollments', 'materials', 'notices', 'attendance', 'exams', 'examResults'];
    for (const col of collectionsToSync) {
      try {
        const snap = await getDocs(collection(db, col));
        const items: any[] = [];
        snap.forEach(doc => {
          items.push(doc.data());
        });
        localStorage.setItem(`coaching_connect_${col}`, JSON.stringify(items));
        triggerLocalSubscribers(col);
      } catch (e) {
        console.warn(`Could not sync collection ${col} from Firestore:`, e);
      }
    }
  } catch (err) {
    console.error("Failed to run syncFirestoreToLocal:", err);
  }
}

// Initial Local Seeding Data Setup
function seedLocalData() {
  console.log("Seeding demo data to local storage cache...");
  
  const demoTeacher: AppUser = {
    uid: DEMO_TEACHER_UID,
    name: "Rafid Islam",
    email: "teacher.rafid@coachingconnect.bd",
    role: 'teacher',
    phone: "01712345678",
    institution: "BUET, Department of CSE",
    createdAt: new Date().toISOString()
  };

  const demoStudent: AppUser = {
    uid: DEMO_STUDENT_UID,
    name: "Sadman Sakib",
    email: "student.sadman@coachingconnect.bd",
    role: 'student',
    phone: "01598765432",
    institution: "Notre Dame College (HSC 2026)",
    createdAt: new Date().toISOString()
  };
  setLocalCollection('users', [demoTeacher, demoStudent]);

  const physicsBatchId = 'batch-physics-hsc2026';
  const mathBatchId = 'batch-math-class10';

  const physicsBatch: Batch = {
    id: physicsBatchId,
    name: "HSC 2026 Physics (Gravity & Newtonian Mechanics)",
    subject: "Physics",
    teacherId: DEMO_TEACHER_UID,
    teacherName: "Rafid Islam",
    schedule: [
      { day: 'Sunday', time: '16:00' },
      { day: 'Tuesday', time: '16:00' }
    ],
    monthlyFee: 1500,
    code: "PHY-GRAV-11",
    createdAt: new Date().toISOString()
  };

  const mathBatch: Batch = {
    id: mathBatchId,
    name: "Class 10 Advanced Math & Geometry",
    subject: "Advanced Math",
    teacherId: DEMO_TEACHER_UID,
    teacherName: "Rafid Islam",
    schedule: [
      { day: 'Monday', time: '17:30' },
      { day: 'Wednesday', time: '17:30' }
    ],
    monthlyFee: 1200,
    code: "MATH-ADV-10",
    createdAt: new Date().toISOString()
  };
  setLocalCollection('batches', [physicsBatch, mathBatch]);

  const enrollmentId = `${physicsBatchId}_${DEMO_STUDENT_UID}`;
  const physicsEnrollment: Enrollment = {
    id: enrollmentId,
    batchId: physicsBatchId,
    studentId: DEMO_STUDENT_UID,
    studentName: "Sadman Sakib",
    studentEmail: "student.sadman@coachingconnect.bd",
    studentPhone: "01598765432",
    studentInstitution: "Notre Dame College (HSC 2026)",
    status: 'active',
    enrolledAt: new Date().toISOString(),
    paymentStatus: {
      "May 2026": "paid",
      "June 2026": "pending"
    }
  };
  setLocalCollection('enrollments', [physicsEnrollment]);

  const material1Id = 'mat-newtonian-sheet';
  const material1: StudyMaterial = {
    id: material1Id,
    batchId: physicsBatchId,
    batchName: "HSC 2026 Physics (Gravity & Newtonian Mechanics)",
    teacherId: DEMO_TEACHER_UID,
    title: "Newtonian Mechanics Lecture Sheet & Formulas",
    description: "Class handouts covering torque, rotational kinetic energy, and angular momentum. Recommended practice problems included on page 14.",
    fileUrl: "https://drive.google.com/drive/folders/mock-physics-newtonian-handouts",
    createdAt: new Date().toISOString()
  };

  const material2Id = 'mat-vector-quiz-solutions';
  const material2: StudyMaterial = {
    id: material2Id,
    batchId: physicsBatchId,
    batchName: "HSC 2026 Physics (Gravity & Newtonian Mechanics)",
    teacherId: DEMO_TEACHER_UID,
    title: "Solutions to Vector Practice Quiz",
    description: "Fully worked-out solutions to the weekly quiz held on June 18th.",
    fileUrl: "https://drive.google.com/file/d/mock-vector-solutions/view",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  };
  setLocalCollection('materials', [material1, material2]);

  const notice1Id = 'notice-quiz-physics';
  const notice1: Notice = {
    id: notice1Id,
    batchId: physicsBatchId,
    batchName: "HSC 2026 Physics (Gravity & Newtonian Mechanics)",
    teacherId: DEMO_TEACHER_UID,
    teacherName: "Rafid Islam",
    type: 'exam_alert',
    message: "📣 Monthly Physics Evaluation Test on Dynamics will be held this Sunday! Focus on rotational motion. Duration: 45 minutes.",
    createdAt: new Date().toISOString()
  };

  const notice2Id = 'notice-welcome-math';
  const notice2: Notice = {
    id: notice2Id,
    batchId: mathBatchId,
    batchName: "Class 10 Advanced Math & Geometry",
    teacherId: DEMO_TEACHER_UID,
    teacherName: "Rafid Islam",
    type: 'general',
    message: "Welcome to the Advanced Math batch! Please download our coordinate geometry book syllabus from our study materials panel.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  };
  setLocalCollection('notices', [notice1, notice2]);

  localStorage.setItem('coaching_connect_seeded', 'true');
}

/**
 * Seeds demo data into Firestore if it doesn't exist yet.
 * Switches seamlessly to offline storage mode if client is offline or network is blocked.
 */
export async function seedDemoData() {
  try {
    const isSeededLocally = localStorage.getItem('coaching_connect_seeded') === 'true';
    if (!isSeededLocally) {
      seedLocalData();
    }

    let isSeededInFirestore = false;
    if (!isOfflineMode) {
      try {
        const teacherDocRef = doc(db, 'users', DEMO_TEACHER_UID);
        const teacherSnap = await getDoc(teacherDocRef);
        if (teacherSnap.exists()) {
          isSeededInFirestore = true;
        }
      } catch (fsError) {
        console.warn("Could not check Firestore seeding status, activating Local Offline mode:", fsError);
        if (isNetworkError(fsError)) setOfflineStatus(true);
      }
    }

    if (isSeededInFirestore) {
      await syncFirestoreToLocal();
      return;
    }

    // Try seeding Firestore if we are supposedly online
    if (!isOfflineMode) {
      try {
        console.log("Seeding coaching connect demo data to Firestore server...");
        const batch = writeBatch(db);

        const users = getLocalCollection<AppUser>('users');
        users.forEach(u => batch.set(doc(db, 'users', u.uid), u));

        const batches = getLocalCollection<Batch>('batches');
        batches.forEach(b => batch.set(doc(db, 'batches', b.id), b));

        const enrollments = getLocalCollection<Enrollment>('enrollments');
        enrollments.forEach(e => batch.set(doc(db, 'enrollments', e.id), e));

        const mList = getLocalCollection<StudyMaterial>('materials');
        mList.forEach(m => batch.set(doc(db, 'materials', m.id), m));

        const nList = getLocalCollection<Notice>('notices');
        nList.forEach(n => batch.set(doc(db, 'notices', n.id), n));

        await batch.commit();
        console.log("Firestore seeding completed successfully!");
      } catch (fsError) {
        console.warn("Failed to commit seed batch to Firestore, continuing with Offline storage:", fsError);
        if (isNetworkError(fsError)) setOfflineStatus(true);
      }
    }
  } catch (error) {
    console.error("Resilient seedDemoData completed with local persistence fallbacks:", error);
  }
}

/**
 * Creates/Updates user profile in Firestore and Local Storage
 */
export async function createUserProfile(uid: string, data: Partial<AppUser>) {
  const users = getLocalCollection<AppUser>('users');
  let existingUser = users.find(u => u.uid === uid);

  // If not found in local storage, check Firestore first to prevent overwriting an existing user profile
  if (!existingUser && !isOfflineMode) {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        existingUser = { ...snap.data(), uid } as AppUser;
        // Merge with any new incoming data fields
        Object.assign(existingUser, data);
        users.push(existingUser);
      }
    } catch (e) {
      console.warn("Firestore getUserProfile check inside createUserProfile failed, continuing:", e);
    }
  }

  if (!existingUser) {
    existingUser = {
      uid,
      name: data.name || "Unknown User",
      email: data.email || "",
      role: data.role || 'student',
      phone: data.phone || "",
      institution: data.institution || "",
      createdAt: new Date().toISOString()
    };
    users.push(existingUser);
  } else {
    Object.assign(existingUser, data);
  }
  setLocalCollection('users', users);

  await runOnlineWrite(async () => {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, existingUser, { merge: true });
  });

  return existingUser;
}

/**
 * Fetch a single user profile (Resilient online/offline lookup)
 */
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const localUser = getLocalCollection<AppUser>('users').find(u => u.uid === uid);

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const userObj = snap.data() as AppUser;
      
      const users = getLocalCollection<AppUser>('users').filter(u => u.uid !== uid);
      users.push(userObj);
      setLocalCollection('users', users);
      setOfflineStatus(false);
      return userObj;
    }
  } catch (fsError: any) {
    console.warn("Firestore getUserProfile failed, falling back to Local Storage:", fsError);
    if (isNetworkError(fsError)) {
      setOfflineStatus(true);
    }
    // Critical: If we are on a new device with no local cached user, throw the error
    // so the application knows there's a connection/loading issue, rather than assuming no profile exists.
    if (!localUser) {
      throw fsError;
    }
    return localUser;
  }

  return localUser || null;
}

/**
 * Create a new batch
 */
export async function createBatch(batchData: Omit<Batch, 'id' | 'createdAt'>): Promise<string> {
  const batchId = 'batch-' + Math.random().toString(36).substring(2);
  const newBatch: Batch = {
    ...batchData,
    id: batchId,
    createdAt: new Date().toISOString()
  };

  // 1. Write to local storage
  const batches = getLocalCollection<Batch>('batches');
  batches.push(newBatch);
  setLocalCollection('batches', batches);

  // 2. Post welcome notice
  await postNotice(
    batchId,
    batchData.name,
    batchData.teacherId,
    batchData.teacherName,
    'general',
    `🎉 New batch "${batchData.name}" has been created! Join using the invite code: ${batchData.code}`
  );

  // 3. Write to Firestore
  await runOnlineWrite(async () => {
    const batchRef = doc(db, 'batches', batchId);
    await setDoc(batchRef, newBatch);
  });

  return batchId;
}

/**
 * Enroll student in batch using Invite Code
 */
export async function enrollStudentInBatch(
  studentId: string, 
  studentUser: AppUser, 
  inviteCode: string
): Promise<{ success: boolean; message: string }> {
  try {
    const inviteClean = inviteCode.trim().toUpperCase();
    const batches = getLocalCollection<Batch>('batches');
    const batchObj = batches.find(b => b.code.toUpperCase() === inviteClean && !b.deleted);

    if (!batchObj) {
      return { success: false, message: "Invalid Invite Code! Please check with your teacher." };
    }

    const enrollmentId = `${batchObj.id}_${studentId}`;
    const enrollments = getLocalCollection<Enrollment>('enrollments');
    const existingEnroll = enrollments.find(e => e.id === enrollmentId);

    if (existingEnroll) {
      return { success: false, message: `You are already enrolled/pending in "${batchObj.name}"!` };
    }

    const newEnrollment: Enrollment = {
      id: enrollmentId,
      batchId: batchObj.id,
      studentId: studentId,
      studentName: studentUser.name,
      studentEmail: studentUser.email,
      studentPhone: studentUser.phone,
      studentInstitution: studentUser.institution || '',
      status: 'active',
      enrolledAt: new Date().toISOString(),
      paymentStatus: {}
    };

    enrollments.push(newEnrollment);
    setLocalCollection('enrollments', enrollments);

    await postNotice(
      batchObj.id,
      batchObj.name,
      batchObj.teacherId,
      batchObj.teacherName,
      'general',
      `👤 Student "${studentUser.name}" has joined the batch!`
    );

    await runOnlineWrite(async () => {
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      await setDoc(enrollmentRef, newEnrollment);
    });

    return { success: true, message: `Successfully enrolled in "${batchObj.name}"!` };
  } catch (error: any) {
    console.error("Enrollment error:", error);
    return { success: false, message: error.message || "An error occurred while enrolling." };
  }
}

/**
 * Update batch routine schedule
 */
export async function updateBatchSchedule(
  batchId: string,
  batchName: string,
  teacherId: string,
  teacherName: string,
  newSchedule: Batch['schedule'],
  scheduleChangeNote: string = ""
): Promise<void> {
  const batches = getLocalCollection<Batch>('batches');
  const batchObj = batches.find(b => b.id === batchId);
  if (batchObj) {
    batchObj.schedule = newSchedule;
    setLocalCollection('batches', batches);
  }

  const formattedSchedule = newSchedule.map(s => `${s.day} at ${s.time}`).join(', ');
  const notificationMessage = `📅 Batch Routine Changed! "${batchName}" is now scheduled on: ${formattedSchedule}. ${scheduleChangeNote ? `Note: ${scheduleChangeNote}` : ''}`;

  await postNotice(
    batchId,
    batchName,
    teacherId,
    teacherName,
    'schedule_change',
    notificationMessage
  );

  await runOnlineWrite(async () => {
    const batchRef = doc(db, 'batches', batchId);
    await updateDoc(batchRef, { schedule: newSchedule });
  });
}

/**
 * Update batch basic information (name, subject, monthly fee)
 */
export async function updateBatchInfo(
  batchId: string,
  updatedData: { name: string; subject: string; monthlyFee: number }
): Promise<void> {
  const batches = getLocalCollection<Batch>('batches');
  const batchObj = batches.find(b => b.id === batchId);
  if (batchObj) {
    batchObj.name = updatedData.name;
    batchObj.subject = updatedData.subject;
    batchObj.monthlyFee = updatedData.monthlyFee;
    setLocalCollection('batches', batches);
  }

  await runOnlineWrite(async () => {
    const batchRef = doc(db, 'batches', batchId);
    await updateDoc(batchRef, {
      name: updatedData.name,
      subject: updatedData.subject,
      monthlyFee: updatedData.monthlyFee
    });
  });
}

/**
 * Upload study material
 */
export async function uploadStudyMaterial(
  batchId: string,
  batchName: string,
  teacherId: string,
  title: string,
  description: string,
  fileUrl: string
): Promise<void> {
  const matId = 'mat-' + Math.random().toString(36).substring(2);
  const newMaterial: StudyMaterial = {
    id: matId,
    batchId,
    batchName,
    teacherId,
    title,
    description,
    fileUrl,
    createdAt: new Date().toISOString()
  };

  const mList = getLocalCollection<StudyMaterial>('materials');
  mList.push(newMaterial);
  setLocalCollection('materials', mList);

  await postNotice(
    batchId,
    batchName,
    teacherId,
    "EduFlow Material Hub",
    'general',
    `📚 New Material Available: "${title}". Click to view in your Study Materials panel.`
  );

  await runOnlineWrite(async () => {
    const materialsColl = collection(db, 'materials');
    await setDoc(doc(materialsColl, matId), newMaterial);
  });
}

/**
 * Post an announcement/notice
 */
export async function postNotice(
  batchId: string,
  batchName: string,
  teacherId: string,
  teacherName: string,
  type: Notice['type'],
  message: string
): Promise<void> {
  const noticeId = 'notice-' + Math.random().toString(36).substring(2);
  const newNotice: Notice = {
    id: noticeId,
    batchId,
    batchName,
    teacherId,
    teacherName,
    type,
    message,
    createdAt: new Date().toISOString()
  };

  const nList = getLocalCollection<Notice>('notices');
  nList.push(newNotice);
  setLocalCollection('notices', nList);

  await runOnlineWrite(async () => {
    const noticesColl = collection(db, 'notices');
    await setDoc(doc(noticesColl, noticeId), newNotice);
  });
}

/**
 * Report student payment
 */
export async function reportPayment(
  batchId: string,
  studentId: string,
  month: string,
  amountPaid?: number,
  method?: string,
  trxId?: string,
  note?: string
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;

  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);
  if (enrollObj) {
    enrollObj.paymentStatus = { ...enrollObj.paymentStatus, [month]: 'pending' };
    
    if (amountPaid !== undefined) {
      if (!enrollObj.paymentHistory) enrollObj.paymentHistory = [];
      const newTx: Transaction = {
        id: 'rep_' + Math.random().toString(36).substring(2, 9),
        month,
        amount: amountPaid,
        date: new Date().toISOString(),
        method: method || 'bKash',
        trxId: trxId?.trim() || undefined,
        note: `[পেন্ডিং রিপোর্ট] ${note?.trim() || ''}`.trim()
      };
      enrollObj.paymentHistory.push(newTx);
    }
    
    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    if (enrollObj) {
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Teacher confirms payment status
 */
export async function confirmPaymentStatus(
  batchId: string,
  studentId: string,
  month: string,
  status: 'paid' | 'pending' | 'unpaid'
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;

  let finalPaidAmount: number | undefined = undefined;

  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);
  if (enrollObj) {
    enrollObj.paymentStatus = { ...enrollObj.paymentStatus, [month]: status };
    
    if (status === 'paid') {
      const batches = getLocalCollection<Batch>('batches');
      const batchObj = batches.find(b => b.id === batchId);
      const fee = enrollObj.customFee !== undefined ? enrollObj.customFee : (batchObj?.monthlyFee || 1200);
      const discount = enrollObj.discount || 0;
      const extraTotal = enrollObj.extraCharges?.[month]?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const netPayable = Math.max(0, fee - discount) + extraTotal;
      
      if (!enrollObj.paidAmountMap) enrollObj.paidAmountMap = {};
      enrollObj.paidAmountMap[month] = netPayable;
      finalPaidAmount = netPayable;
    }
    
    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    try {
      const updates: any = { [`paymentStatus.${month}`]: status };
      if (finalPaidAmount !== undefined) {
        updates[`paidAmountMap.${month}`] = finalPaidAmount;
      }
      await updateDoc(enrollmentRef, updates);
    } catch (fsError) {
      const snap = await getDoc(enrollmentRef);
      if (snap.exists()) {
        const currentStatus = snap.data()?.paymentStatus || {};
        const currentPaidMap = snap.data()?.paidAmountMap || {};
        
        const updates: any = { paymentStatus: { ...currentStatus, [month]: status } };
        if (finalPaidAmount !== undefined) {
          updates.paidAmountMap = { ...currentPaidMap, [month]: finalPaidAmount };
        }
        await updateDoc(enrollmentRef, updates);
      } else {
        throw fsError;
      }
    }
  });
}

/**
 * Update enrollment billing settings (customFee, discount, status)
 */
export async function updateEnrollmentBilling(
  batchId: string,
  studentId: string,
  billingData: { customFee?: number; discount?: number; status?: 'active' | 'pending'; studentName?: string; studentPhone?: string; studentInstitution?: string },
  recalculateMonth?: string
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);
  
  if (enrollObj) {
    if (billingData.customFee !== undefined) enrollObj.customFee = billingData.customFee;
    if (billingData.discount !== undefined) enrollObj.discount = billingData.discount;
    if (billingData.status !== undefined) enrollObj.status = billingData.status;
    if (billingData.studentName !== undefined) enrollObj.studentName = billingData.studentName;
    if (billingData.studentPhone !== undefined) enrollObj.studentPhone = billingData.studentPhone;
    if (billingData.studentInstitution !== undefined) enrollObj.studentInstitution = billingData.studentInstitution;

    if (recalculateMonth) {
      const batches = getLocalCollection<Batch>('batches');
      const batchObj = batches.find(b => b.id === batchId);
      const fee = enrollObj.customFee !== undefined ? enrollObj.customFee : (batchObj?.monthlyFee || 1200);
      const discount = enrollObj.discount || 0;
      const basePayable = Math.max(0, fee - discount);
      const extraTotal = enrollObj.extraCharges?.[recalculateMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const netPayable = basePayable + extraTotal;
      const paidTotal = enrollObj.paidAmountMap?.[recalculateMonth] || 0;

      if (paidTotal >= netPayable) {
        enrollObj.paymentStatus[recalculateMonth] = 'paid';
      } else if (paidTotal > 0) {
        enrollObj.paymentStatus[recalculateMonth] = 'pending';
      } else {
        enrollObj.paymentStatus[recalculateMonth] = 'unpaid';
      }
    }

    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    if (enrollObj) {
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Update extra charges (exam fees, model test fees, or fines) for a student for a specific month
 */
export async function updateStudentExtraCharges(
  batchId: string,
  studentId: string,
  month: string,
  extraCharges: ExtraCharge[]
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);

  if (enrollObj) {
    if (!enrollObj.extraCharges) enrollObj.extraCharges = {};
    enrollObj.extraCharges[month] = extraCharges;

    // Recalculate status based on paid vs new payable
    const batches = getLocalCollection<Batch>('batches');
    const batchObj = batches.find(b => b.id === batchId);
    const fee = enrollObj.customFee !== undefined ? enrollObj.customFee : (batchObj?.monthlyFee || 1200);
    const discount = enrollObj.discount || 0;
    const basePayable = Math.max(0, fee - discount);
    const extraTotal = extraCharges.reduce((sum, item) => sum + item.amount, 0);
    const netPayable = basePayable + extraTotal;

    const paidTotal = enrollObj.paidAmountMap?.[month] || 0;

    if (paidTotal >= netPayable) {
      enrollObj.paymentStatus[month] = 'paid';
    } else if (paidTotal > 0) {
      enrollObj.paymentStatus[month] = 'pending';
    } else {
      enrollObj.paymentStatus[month] = 'unpaid';
    }

    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    if (enrollObj) {
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Apply an extra charge (e.g., exam fee or model test fee) batch-wide to all students in a batch
 */
export async function updateBatchWideExtraCharges(
  batchId: string,
  month: string,
  description: string,
  amount: number
): Promise<void> {
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const batches = getLocalCollection<Batch>('batches');
  const batchObj = batches.find(b => b.id === batchId);
  const defFee = batchObj?.monthlyFee || 1200;

  const batchEnrollments = enrollments.filter(e => e.batchId === batchId);

  for (const enrollObj of batchEnrollments) {
    if (!enrollObj.extraCharges) enrollObj.extraCharges = {};
    if (!enrollObj.extraCharges[month]) enrollObj.extraCharges[month] = [];

    const exists = enrollObj.extraCharges[month].some(
      item => item.description.toLowerCase() === description.trim().toLowerCase()
    );

    if (!exists) {
      const newItem: ExtraCharge = {
        id: Math.random().toString(36).substring(2, 9),
        description: description.trim(),
        amount: Number(amount)
      };
      enrollObj.extraCharges[month].push(newItem);

      const fee = enrollObj.customFee !== undefined ? enrollObj.customFee : defFee;
      const discount = enrollObj.discount || 0;
      const basePayable = Math.max(0, fee - discount);
      const extraTotal = enrollObj.extraCharges[month].reduce((sum, item) => sum + item.amount, 0);
      const netPayable = basePayable + extraTotal;
      const paidTotal = enrollObj.paidAmountMap?.[month] || 0;

      if (paidTotal >= netPayable) {
        enrollObj.paymentStatus[month] = 'paid';
      } else if (paidTotal > 0) {
        enrollObj.paymentStatus[month] = 'pending';
      } else {
        enrollObj.paymentStatus[month] = 'unpaid';
      }
    }
  }

  setLocalCollection('enrollments', enrollments);

  await runOnlineWrite(async () => {
    for (const enrollObj of batchEnrollments) {
      const enrollmentRef = doc(db, 'enrollments', enrollObj.id);
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Record a custom student payment, tracks exact paid amounts & histories, and updates status
 */
export async function recordStudentPayment(
  batchId: string,
  studentId: string,
  month: string,
  amountPaid: number,
  method: string,
  trxId?: string,
  note?: string
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);

  if (enrollObj) {
    // 1. Initialize paidAmountMap and paymentHistory if not present
    if (!enrollObj.paidAmountMap) enrollObj.paidAmountMap = {};
    if (!enrollObj.paymentHistory) enrollObj.paymentHistory = [];

    // 2. Accumulate amount paid
    const prevPaid = enrollObj.paidAmountMap[month] || 0;
    const newPaidTotal = prevPaid + amountPaid;
    enrollObj.paidAmountMap[month] = newPaidTotal;

    // 3. Create transaction record
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      month,
      amount: amountPaid,
      date: new Date().toISOString(),
      method,
      trxId: trxId?.trim() || undefined,
      note: note?.trim() || undefined
    };
    enrollObj.paymentHistory.push(newTx);

    // 4. Update the paymentStatus based on the dues
    const batches = getLocalCollection<Batch>('batches');
    const batchObj = batches.find(b => b.id === batchId);
    const fee = enrollObj.customFee !== undefined ? enrollObj.customFee : (batchObj?.monthlyFee || 1200);
    const discount = enrollObj.discount || 0;
    const basePayable = Math.max(0, fee - discount);
    const extraTotal = enrollObj.extraCharges?.[month]?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const netPayable = basePayable + extraTotal;

    if (newPaidTotal >= netPayable) {
      enrollObj.paymentStatus[month] = 'paid';
    } else if (newPaidTotal > 0) {
      enrollObj.paymentStatus[month] = 'pending'; // partially paid behaves as pending
    } else {
      enrollObj.paymentStatus[month] = 'unpaid';
    }

    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    if (enrollObj) {
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Reject / Decline a reported student payment with custom note
 */
export async function rejectStudentPayment(
  batchId: string,
  studentId: string,
  month: string,
  rejectionNote: string
): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const enrollObj = enrollments.find(e => e.id === enrollmentId);

  if (enrollObj) {
    if (!enrollObj.paymentStatus) enrollObj.paymentStatus = {};
    if (!enrollObj.paymentHistory) enrollObj.paymentHistory = [];

    // Reset status to unpaid
    enrollObj.paymentStatus[month] = 'unpaid';

    // Add rejection system transaction to logs
    const newTx: Transaction = {
      id: 'rej_' + Math.random().toString(36).substring(2, 9),
      month,
      amount: 0,
      date: new Date().toISOString(),
      method: 'System',
      note: `❌ [প্রত্যাখ্যাত] ${rejectionNote.trim() || 'পেমেন্ট সঠিক নয় বা ট্রানজেকশন আইডি অমিল।'}`.trim()
    };
    enrollObj.paymentHistory.push(newTx);

    // Reset the paid amount for this month
    if (!enrollObj.paidAmountMap) enrollObj.paidAmountMap = {};
    enrollObj.paidAmountMap[month] = 0;

    setLocalCollection('enrollments', enrollments);
  }

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    if (enrollObj) {
      await setDoc(enrollmentRef, enrollObj, { merge: true });
    }
  });
}

/**
 * Completely remove / unenroll a student from a batch
 */
export async function removeStudentFromBatch(batchId: string, studentId: string): Promise<void> {
  const enrollmentId = `${batchId}_${studentId}`;
  const enrollments = getLocalCollection<Enrollment>('enrollments');
  const updatedEnrollments = enrollments.filter(e => e.id !== enrollmentId);
  setLocalCollection('enrollments', updatedEnrollments);

  await runOnlineWrite(async () => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    await deleteDoc(enrollmentRef);
  });
}

/**
 * Delete batch
 */
export async function deleteBatch(batchId: string): Promise<void> {
  const batches = getLocalCollection<Batch>('batches');
  const bObj = batches.find(b => b.id === batchId);
  if (bObj) {
    bObj.deleted = true;
    setLocalCollection('batches', batches);
  }

  await runOnlineWrite(async () => {
    const batchRef = doc(db, 'batches', batchId);
    await setDoc(batchRef, { id: batchId, deleted: true }, { merge: true });
  });
}

// --- HYBRID REACT SNAPSHOT LISTENERS ---

export function subscribeToStudentEnrollments(studentId: string, callback: SubscriptionCallback<Enrollment>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (e: Enrollment) => e.studentId === studentId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'enrollments',
    filterFn,
    callback
  };

  if (!isOfflineMode) {
    try {
      const enrollmentsRef = collection(db, 'enrollments');
      const q = query(enrollmentsRef, where('studentId', '==', studentId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Enrollment[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Enrollment);
        });

        const localList = getLocalCollection<Enrollment>('enrollments');
        const otherItems = localList.filter(e => e.studentId !== studentId);
        setLocalCollection('enrollments', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore enrollments watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<Enrollment>('enrollments').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore enrollments watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<Enrollment>('enrollments').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToBatches(batchIds: string[], callback: SubscriptionCallback<Batch>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (b: Batch) => batchIds.includes(b.id) && !b.deleted;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'batches',
    filterFn,
    callback
  };

  if (!isOfflineMode && batchIds.length > 0) {
    try {
      const batchesRef = collection(db, 'batches');
      const q = query(batchesRef, where('id', 'in', batchIds));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Batch[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Batch;
          if (!data.deleted) {
            list.push(data);
          }
        });

        const localList = getLocalCollection<Batch>('batches');
        const otherItems = localList.filter(b => !batchIds.includes(b.id));
        setLocalCollection('batches', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore batches watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<Batch>('batches').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore batches watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<Batch>('batches').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToNotices(batchIds: string[], callback: SubscriptionCallback<Notice>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (n: Notice) => batchIds.includes(n.batchId);

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'notices',
    filterFn,
    callback: (list: Notice[]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(sorted);
    }
  };

  if (!isOfflineMode && batchIds.length > 0) {
    try {
      const noticesRef = collection(db, 'notices');
      const q = query(noticesRef, where('batchId', 'in', batchIds));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Notice[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Notice);
        });

        const localList = getLocalCollection<Notice>('notices');
        const otherItems = localList.filter(n => !batchIds.includes(n.batchId));
        setLocalCollection('notices', [...otherItems, ...list]);
        
        const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      }, (err) => {
        console.warn("Firestore notices watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        const localList = getLocalCollection<Notice>('notices').filter(filterFn);
        const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      });
    } catch (err) {
      console.warn("Firestore notices watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  const localList = getLocalCollection<Notice>('notices').filter(filterFn);
  const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  callback(sorted);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToMaterials(batchIds: string[], callback: SubscriptionCallback<StudyMaterial>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (m: StudyMaterial) => batchIds.includes(m.batchId);

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'materials',
    filterFn,
    callback: (list: StudyMaterial[]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(sorted);
    }
  };

  if (!isOfflineMode && batchIds.length > 0) {
    try {
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('batchId', 'in', batchIds));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: StudyMaterial[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as StudyMaterial);
        });

        const localList = getLocalCollection<StudyMaterial>('materials');
        const otherItems = localList.filter(m => !batchIds.includes(m.batchId));
        setLocalCollection('materials', [...otherItems, ...list]);

        const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      }, (err) => {
        console.warn("Firestore materials watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        const localList = getLocalCollection<StudyMaterial>('materials').filter(filterFn);
        const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      });
    } catch (err) {
      console.warn("Firestore materials watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  const localList = getLocalCollection<StudyMaterial>('materials').filter(filterFn);
  const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  callback(sorted);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToTeacherBatches(teacherId: string, callback: SubscriptionCallback<Batch>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (b: Batch) => b.teacherId === teacherId && !b.deleted;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'batches',
    filterFn,
    callback
  };

  if (!isOfflineMode) {
    try {
      const batchesRef = collection(db, 'batches');
      const q = query(batchesRef, where('teacherId', '==', teacherId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Batch[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as Batch;
          if (!data.deleted) {
            list.push(data);
          }
        });

        const localList = getLocalCollection<Batch>('batches');
        const otherItems = localList.filter(b => b.teacherId !== teacherId);
        setLocalCollection('batches', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore teacher batches watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<Batch>('batches').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore teacher batches watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<Batch>('batches').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToBatchEnrollments(batchIds: string[], callback: SubscriptionCallback<Enrollment>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (e: Enrollment) => batchIds.includes(e.batchId);

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'enrollments',
    filterFn,
    callback
  };

  if (!isOfflineMode && batchIds.length > 0) {
    try {
      const enrollmentsRef = collection(db, 'enrollments');
      const q = query(enrollmentsRef, where('batchId', 'in', batchIds));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Enrollment[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Enrollment);
        });

        const localList = getLocalCollection<Enrollment>('enrollments');
        const otherItems = localList.filter(e => !batchIds.includes(e.batchId));
        setLocalCollection('enrollments', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore batch enrollments watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<Enrollment>('enrollments').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore batch enrollments watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<Enrollment>('enrollments').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToTeacherNotices(teacherId: string, callback: SubscriptionCallback<Notice>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (n: Notice) => n.teacherId === teacherId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'notices',
    filterFn,
    callback: (list: Notice[]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(sorted);
    }
  };

  if (!isOfflineMode) {
    try {
      const noticesRef = collection(db, 'notices');
      const q = query(noticesRef, where('teacherId', '==', teacherId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Notice[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Notice);
        });

        const localList = getLocalCollection<Notice>('notices');
        const otherItems = localList.filter(n => n.teacherId !== teacherId);
        setLocalCollection('notices', [...otherItems, ...list]);

        const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      }, (err) => {
        console.warn("Firestore teacher notices watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        const localList = getLocalCollection<Notice>('notices').filter(filterFn);
        const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      });
    } catch (err) {
      console.warn("Firestore teacher notices watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  const localList = getLocalCollection<Notice>('notices').filter(filterFn);
  const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  callback(sorted);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

export function subscribeToTeacherMaterials(teacherId: string, callback: SubscriptionCallback<StudyMaterial>) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (m: StudyMaterial) => m.teacherId === teacherId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'materials',
    filterFn,
    callback: (list: StudyMaterial[]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(sorted);
    }
  };

  if (!isOfflineMode) {
    try {
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('teacherId', '==', teacherId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: StudyMaterial[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as StudyMaterial);
        });

        const localList = getLocalCollection<StudyMaterial>('materials');
        const otherItems = localList.filter(m => m.teacherId !== teacherId);
        setLocalCollection('materials', [...otherItems, ...list]);

        const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      }, (err) => {
        console.warn("Firestore teacher materials watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        const localList = getLocalCollection<StudyMaterial>('materials').filter(filterFn);
        const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(sorted);
      });
    } catch (err) {
      console.warn("Firestore teacher materials watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  const localList = getLocalCollection<StudyMaterial>('materials').filter(filterFn);
  const sorted = [...localList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  callback(sorted);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

/**
 * Save or update student attendance
 */
export async function saveStudentAttendance(
  batchId: string,
  date: string,
  studentId: string,
  studentName: string,
  status: 'present' | 'absent' | 'late'
): Promise<void> {
  const attendanceId = `${batchId}_${date}_${studentId}`;
  const attendance = getLocalCollection<Attendance>('attendance');
  const existingIndex = attendance.findIndex(a => a.id === attendanceId);

  const newRecord: Attendance = {
    id: attendanceId,
    batchId,
    studentId,
    studentName,
    date,
    status
  };

  if (existingIndex > -1) {
    attendance[existingIndex] = newRecord;
  } else {
    attendance.push(newRecord);
  }

  setLocalCollection('attendance', attendance);

  await runOnlineWrite(async () => {
    const docRef = doc(db, 'attendance', attendanceId);
    await setDoc(docRef, newRecord);
  });
}

/**
 * Subscribe to batch attendance records
 */
export function subscribeToBatchAttendance(
  batchId: string,
  callback: (records: Attendance[]) => void
) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (a: Attendance) => a.batchId === batchId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'attendance',
    filterFn,
    callback
  };

  if (!isOfflineMode) {
    try {
      const colRef = collection(db, 'attendance');
      const q = query(colRef, where('batchId', '==', batchId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Attendance[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Attendance);
        });

        const localList = getLocalCollection<Attendance>('attendance');
        const otherItems = localList.filter(a => a.batchId !== batchId);
        setLocalCollection('attendance', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore attendance watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<Attendance>('attendance').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore attendance watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<Attendance>('attendance').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

/**
 * Seed realistic attendance data if empty for a batch to make visual trend analysis functional & gorgeous
 */
export async function seedAttendanceIfEmpty(batchId: string, enrollments: Enrollment[]): Promise<void> {
  const attendance = getLocalCollection<Attendance>('attendance');
  const batchRecords = attendance.filter(a => a.batchId === batchId);
  if (batchRecords.length > 0) return; // already has attendance records

  const activeStudents = enrollments.filter(e => e.batchId === batchId && e.status === 'active');
  if (activeStudents.length === 0) return;

  const datesToSeed = [
    '2026-06-02', '2026-06-05', '2026-06-09', '2026-06-12', '2026-06-16', '2026-06-19', '2026-06-23', '2026-06-26', '2026-06-30',
    '2026-05-02', '2026-05-05', '2026-05-09', '2026-05-12', '2026-05-16', '2026-05-19', '2026-05-23', '2026-05-26', '2026-05-30',
    '2026-04-03', '2026-04-07', '2026-04-10', '2026-04-14', '2026-04-17', '2026-04-21', '2026-04-24', '2026-04-28'
  ];

  const statuses: ('present' | 'absent' | 'late')[] = ['present', 'present', 'present', 'present', 'present', 'late', 'absent'];

  const seeded: Attendance[] = [];
  for (const date of datesToSeed) {
    for (const student of activeStudents) {
      // Add randomness but keep attendance high (~80% present/late)
      const rand = Math.floor(Math.random() * statuses.length);
      const status = statuses[rand];
      seeded.push({
        id: `${batchId}_${date}_${student.studentId}`,
        batchId,
        studentId: student.studentId,
        studentName: student.studentName,
        date,
        status
      });
    }
  }

  const updatedAttendance = [...attendance, ...seeded];
  setLocalCollection('attendance', updatedAttendance);

  // Write online in chunks safely (avoiding overloading write)
  await runOnlineWrite(async () => {
    // Write in background
    for (const rec of seeded.slice(0, 50)) { // just save a subset online to maintain Firestore sync without rate limits
      const docRef = doc(db, 'attendance', rec.id);
      setDoc(docRef, rec).catch(() => {});
    }
  });
}

/**
 * Create a new exam
 */
export async function createExam(examData: Omit<Exam, 'id' | 'createdAt'>, teacherId: string, teacherName: string): Promise<string> {
  const examId = 'exam-' + Math.random().toString(36).substring(2);
  const newExam: Exam = {
    ...examData,
    id: examId,
    createdAt: new Date().toISOString()
  };

  // 1. Write to local storage
  const exams = getLocalCollection<Exam>('exams');
  exams.push(newExam);
  setLocalCollection('exams', exams);

  // 2. Post exam alert notice
  await postNotice(
    examData.batchId,
    examData.batchName,
    teacherId,
    teacherName,
    'exam_alert',
    `📝 নতুন পরীক্ষা যুক্ত করা হয়েছে: "${examData.title}" (${examData.subject})। তারিখ: ${examData.examDate}। মোট নম্বর: ${examData.totalMarks}।`
  );

  // 3. Write to Firestore
  await runOnlineWrite(async () => {
    const examRef = doc(db, 'exams', examId);
    await setDoc(examRef, newExam);
  });

  return examId;
}

/**
 * Save or update student exam result
 */
export async function saveStudentExamResult(
  examId: string,
  batchId: string,
  studentId: string,
  studentName: string,
  marksObtained: number,
  remarks: string = ""
): Promise<void> {
  const resultId = `${examId}_${studentId}`;
  const results = getLocalCollection<ExamResult>('examResults');
  const existingIndex = results.findIndex(r => r.id === resultId);

  const newRecord: ExamResult = {
    id: resultId,
    examId,
    batchId,
    studentId,
    studentName,
    marksObtained,
    remarks,
    submittedAt: new Date().toISOString()
  };

  if (existingIndex > -1) {
    results[existingIndex] = newRecord;
  } else {
    results.push(newRecord);
  }

  setLocalCollection('examResults', results);

  await runOnlineWrite(async () => {
    const docRef = doc(db, 'examResults', resultId);
    await setDoc(docRef, newRecord);
  });
}

/**
 * Subscribe to batch exams
 */
export function subscribeToBatchExams(
  batchId: string,
  callback: (records: Exam[]) => void
) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (e: Exam) => e.batchId === batchId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'exams',
    filterFn,
    callback: (list: Exam[]) => {
      const sorted = [...list].sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
      callback(sorted);
    }
  };

  if (!isOfflineMode) {
    try {
      const colRef = collection(db, 'exams');
      const q = query(colRef, where('batchId', '==', batchId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: Exam[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as Exam);
        });

        const localList = getLocalCollection<Exam>('exams');
        const otherItems = localList.filter(e => e.batchId !== batchId);
        setLocalCollection('exams', [...otherItems, ...list]);
        
        const sorted = [...list].sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
        callback(sorted);
      }, (err) => {
        console.warn("Firestore exams watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        const localList = getLocalCollection<Exam>('exams').filter(filterFn);
        const sorted = [...localList].sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
        callback(sorted);
      });
    } catch (err) {
      console.warn("Firestore exams watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  const localList = getLocalCollection<Exam>('exams').filter(filterFn);
  const sorted = [...localList].sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
  callback(sorted);

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

/**
 * Subscribe to all exam results for a specific batch
 */
export function subscribeToBatchExamResults(
  batchId: string,
  callback: (records: ExamResult[]) => void
) {
  let unsubFirestore: (() => void) | null = null;
  const filterFn = (r: ExamResult) => r.batchId === batchId;

  const subId = Math.random().toString(36).substring(2);
  const localSub: Subscription = {
    id: subId,
    type: 'examResults',
    filterFn,
    callback
  };

  if (!isOfflineMode) {
    try {
      const colRef = collection(db, 'examResults');
      const q = query(colRef, where('batchId', '==', batchId));
      unsubFirestore = onSnapshot(q, (snapshot) => {
        const list: ExamResult[] = [];
        snapshot.forEach(doc => {
          list.push(doc.data() as ExamResult);
        });

        const localList = getLocalCollection<ExamResult>('examResults');
        const otherItems = localList.filter(r => r.batchId !== batchId);
        setLocalCollection('examResults', [...otherItems, ...list]);
        callback(list);
      }, (err) => {
        console.warn("Firestore examResults watch error, switching to local state:", err);
        if (isNetworkError(err)) setOfflineStatus(true);
        callback(getLocalCollection<ExamResult>('examResults').filter(filterFn));
      });
    } catch (err) {
      console.warn("Firestore examResults watch failed, using local state:", err);
      if (isNetworkError(err)) setOfflineStatus(true);
    }
  }

  localSubscriptions.push(localSub);
  callback(getLocalCollection<ExamResult>('examResults').filter(filterFn));

  return () => {
    if (unsubFirestore) unsubFirestore();
    localSubscriptions = localSubscriptions.filter(s => s.id !== subId);
  };
}

/**
 * Seed realistic exams and student marks if empty
 */
export async function seedExamsIfEmpty(batchId: string, enrollments: Enrollment[]): Promise<void> {
  const exams = getLocalCollection<Exam>('exams');
  const batchExams = exams.filter(e => e.batchId === batchId);
  if (batchExams.length > 0) return; // already has exams seeded

  const activeStudents = enrollments.filter(e => e.batchId === batchId && e.status === 'active');
  if (activeStudents.length === 0) return;

  const batches = getLocalCollection<Batch>('batches');
  const activeBatch = batches.find(b => b.id === batchId);
  const subjectName = activeBatch?.subject || "Physics";

  // Create 4 mock exams with standard historical dates in June/July 2026
  const examTemplates = [
    { title: "Weekly Test 01: Basics", totalMarks: 20, examDate: "2026-06-05" },
    { title: "Weekly Test 02: Formulas & Concepts", totalMarks: 25, examDate: "2026-06-12" },
    { title: "Monthly Assessment: Mid-term", totalMarks: 50, examDate: "2026-06-19" },
    { title: "Weekly Test 03: Advanced Practice", totalMarks: 30, examDate: "2026-06-26" }
  ];

  const seededExams: Exam[] = [];
  const seededResults: ExamResult[] = [];

  examTemplates.forEach((tpl, idx) => {
    const examId = `exam-${batchId}-${idx}`;
    seededExams.push({
      id: examId,
      batchId,
      batchName: activeBatch?.name || "Academic Batch",
      subject: subjectName,
      title: tpl.title,
      totalMarks: tpl.totalMarks,
      examDate: tpl.examDate,
      createdAt: new Date().toISOString()
    });

    activeStudents.forEach(student => {
      // Generate some realistic marks based on student (Sadman is a good student)
      let scorePercent = student.studentId === DEMO_STUDENT_UID ? 0.85 + Math.random() * 0.14 : 0.5 + Math.random() * 0.45;
      if (scorePercent > 1) scorePercent = 1;
      const score = Math.round(tpl.totalMarks * scorePercent);
      
      let remarks = "খুব ভালো";
      if (scorePercent >= 0.85) remarks = "অসাধারণ!";
      else if (scorePercent >= 0.7) remarks = "ভালো, তবে আরো সুযোগ আছে";
      else if (scorePercent < 0.6) remarks = "আরো মনোযোগ দিতে হবে";

      seededResults.push({
        id: `${examId}_${student.studentId}`,
        examId,
        batchId,
        studentId: student.studentId,
        studentName: student.studentName,
        marksObtained: score,
        remarks,
        submittedAt: new Date().toISOString()
      });
    });
  });

  const updatedExams = [...exams, ...seededExams];
  setLocalCollection('exams', updatedExams);

  const results = getLocalCollection<ExamResult>('examResults');
  const updatedResults = [...results, ...seededResults];
  setLocalCollection('examResults', updatedResults);

  // Write a few to Firestore to keep in sync
  await runOnlineWrite(async () => {
    for (const exam of seededExams) {
      await setDoc(doc(db, 'exams', exam.id), exam).catch(() => {});
    }
    for (const res of seededResults.slice(0, 30)) {
      await setDoc(doc(db, 'examResults', res.id), res).catch(() => {});
    }
  });
}
