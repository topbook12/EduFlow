import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Batch, Enrollment } from '../types';

// Helper to format 24-hour time to 12-hour AM/PM format
const formatTimeTo12Hour = (timeStr: string): string => {
  if (!timeStr) return '';
  try {
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutesStr} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const BENGALI_DAYS: { [key: string]: string } = {
  'Sunday': 'রবিবার',
  'Monday': 'সোমবার',
  'Tuesday': 'মঙ্গলবার',
  'Wednesday': 'বুধবার',
  'Thursday': 'বৃহস্পতিবার',
  'Friday': 'শুক্রবার',
  'Saturday': 'শনিবার'
};

interface ReportData {
  teacherName: string;
  batches: Batch[];
  enrollments: Enrollment[];
  selectedMonth: string;
}

export const generateTeacherReport = (data: ReportData) => {
  const { teacherName, batches, enrollments, selectedMonth } = data;

  // Initialize jsPDF (A4 Portrait, measurement in mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Define color palette (matching the premium coaching connect teal/slate scheme)
  const primaryColor = [15, 134, 95]; // Teal #0f865f
  const secondaryColor = [12, 107, 76]; // Darker Teal
  const textColor = [51, 65, 85]; // Slate-700
  const lightBgColor = [248, 250, 252]; // Slate-50
  const borderColor = [226, 232, 240]; // Slate-200

  // Helper for drawing clean text header
  const drawHeader = () => {
    // Top colored accent bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 12, 'F');

    // Title & Logo Area
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('EDUFLOW', 14, 28);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('PREMIUM ACADEMIC MANAGEMENT COMPANION', 14, 33);

    // Right-aligned Metadata Info
    doc.setFontSize(9);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - 14, 24, { align: 'right' });
    doc.text(`Teacher: ${teacherName}`, pageWidth - 14, 29, { align: 'right' });
    doc.text(`Billing Month: ${selectedMonth}`, pageWidth - 14, 34, { align: 'right' });

    // Decorative Line Separator
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 38, pageWidth - 14, 38);
  };

  // Helper to draw Footer
  const drawFooter = (pageNumber: number, totalPages: number) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400

    // Footer divider line
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

    doc.text('EduFlow © 2026 - Batches Summary Report', 14, pageHeight - 10);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  };

  // 1. Initial Page Header
  drawHeader();

  // --- SUMMARY STATS CARDS ---
  // Aggregate some statistics
  const totalBatchesCount = batches.length;
  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const totalStudentsCount = activeEnrollments.length;

  // Let's count unique student IDs to get actual unique headcount
  const uniqueStudents = new Set(activeEnrollments.map(e => e.studentId)).size;

  // Calculate payment overview for the chosen month
  let totalPaidAmount = 0;
  let totalPendingAmount = 0;
  let totalUnpaidAmount = 0;
  let paidStudentsCount = 0;
  let pendingStudentsCount = 0;
  let unpaidStudentsCount = 0;

  activeEnrollments.forEach(e => {
    const batch = batches.find(b => b.id === e.batchId);
    if (!batch) return;

    const baseFee = e.customFee !== undefined ? e.customFee : batch.monthlyFee;
    const discount = e.discount || 0;
    const netFee = Math.max(0, baseFee - discount);

    const status = e.paymentStatus?.[selectedMonth] || 'unpaid';

    // Extra charges for the month
    const extraChargesSum = e.extraCharges?.[selectedMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalDue = netFee + extraChargesSum;

    // Actual paid amount
    const paid = e.paidAmountMap?.[selectedMonth] !== undefined
      ? e.paidAmountMap[selectedMonth]
      : (status === 'paid' ? totalDue : 0);

    if (status === 'paid') {
      totalPaidAmount += paid;
      paidStudentsCount++;
    } else if (status === 'pending') {
      totalPendingAmount += totalDue;
      pendingStudentsCount++;
    } else {
      totalUnpaidAmount += totalDue;
      unpaidStudentsCount++;
    }
  });

  // Render Stats Grid
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ACADEMIC OVERVIEW', 14, 46);

  // Stats Card Boxes
  const cardWidth = (pageWidth - 28 - 6) / 4; // 4 cards layout
  const cardY = 50;
  const cardHeight = 22;

  const drawCard = (x: number, title: string, value: string, subtext: string, bgColor: number[]) => {
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
    
    // Borders
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(title, x + 4, cardY + 6);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(value, x + 4, cardY + 13);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(subtext, x + 4, cardY + 18);
  };

  drawCard(14, 'TOTAL BATCHES', `${totalBatchesCount}`, 'Active courses', [240, 253, 250]); // Teal 50
  drawCard(14 + cardWidth + 2, 'TOTAL ENROLLMENTS', `${totalStudentsCount}`, `${uniqueStudents} unique students`, [240, 249, 255]); // Sky 50
  drawCard(14 + (cardWidth + 2) * 2, 'REVENUE COLLECTED', `BDT ${totalPaidAmount.toLocaleString()}`, `${paidStudentsCount} payments cleared`, [240, 253, 244]); // Green 50
  drawCard(14 + (cardWidth + 2) * 3, 'PENDING & UNPAID', `BDT ${(totalPendingAmount + totalUnpaidAmount).toLocaleString()}`, `${pendingStudentsCount + unpaidStudentsCount} students outstanding`, [254, 242, 242]); // Red 50


  // --- SECTION 1: BATCHES SUMMARY ---
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BATCHES DIRECTORY', 14, 82);

  const batchRows = batches.map((batch, index) => {
    const enrolledCount = enrollments.filter(e => e.batchId === batch.id && e.status === 'active').length;
    const scheduleStr = batch.schedule?.map(s => `${s.day.substring(0,3)} ${formatTimeTo12Hour(s.time)}`).join(', ') || 'N/A';
    
    return [
      `0${index + 1}`,
      batch.code || 'N/A',
      batch.name || 'N/A',
      batch.subject || 'N/A',
      `BDT ${batch.monthlyFee.toLocaleString()}`,
      `${enrolledCount} active`,
      scheduleStr
    ];
  });

  autoTable(doc, {
    startY: 86,
    head: [['#', 'Batch Code', 'Batch Name', 'Subject', 'Monthly Fee', 'Students', 'Class Schedules']],
    body: batchRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as [number, number, number],
      fontSize: 8.5,
      halign: 'left',
      textColor: [255, 255, 255]
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: textColor as [number, number, number],
      lineColor: borderColor as [number, number, number]
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 24, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 26 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 44 }
    }
  });


  // --- SECTION 2: CLASS SCHEDULES CALENDAR OVERVIEW ---
  // Group schedules by day
  const dailySchedules: { [day: string]: any[] } = {};
  batches.forEach(b => {
    b.schedule?.forEach(s => {
      if (!dailySchedules[s.day]) {
        dailySchedules[s.day] = [];
      }
      dailySchedules[s.day].push({
        time: s.time,
        batchName: b.name,
        subject: b.subject,
        code: b.code
      });
    });
  });

  const orderedDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const calendarRows: any[] = [];

  orderedDays.forEach(day => {
    const classes = dailySchedules[day] || [];
    if (classes.length === 0) return;

    // Sort classes by 24h time
    classes.sort((a, b) => a.time.localeCompare(b.time));

    classes.forEach((cl, idx) => {
      calendarRows.push([
        idx === 0 ? `${day} (${BENGALI_DAYS[day]})` : '',
        formatTimeTo12Hour(cl.time),
        cl.batchName,
        cl.code,
        cl.subject
      ]);
    });
  });

  // Calculate startY based on previous table
  const finalY1 = (doc as any).lastAutoTable.finalY || 140;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('WEEKLY SCHEDULE TIMELINE', 14, finalY1 + 10);

  autoTable(doc, {
    startY: finalY1 + 14,
    head: [['Day of the Week', 'Class Time', 'Batch Name', 'Batch Code', 'Subject']],
    body: calendarRows.length > 0 ? calendarRows : [['No schedules defined', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: secondaryColor as [number, number, number],
      fontSize: 8.5,
      textColor: [255, 255, 255]
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: textColor as [number, number, number],
      lineColor: borderColor as [number, number, number]
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 25, fontStyle: 'bold' },
      2: { cellWidth: 55 },
      3: { cellWidth: 35 },
      4: { cellWidth: 36 }
    }
  });


  // --- SECTION 3: DETAILED PAYMENT STATUS OVERVIEW ---
  // Create a new page for detailed student payment logs to maintain high fidelity
  doc.addPage();
  drawHeader();

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`STUDENT TUITION & BILLING LEDGER - ${selectedMonth.toUpperCase()}`, 14, 46);

  const paymentRows = activeEnrollments.map((e, index) => {
    const batch = batches.find(b => b.id === e.batchId);
    const batchName = batch ? batch.name : 'N/A';
    const baseFee = e.customFee !== undefined ? e.customFee : (batch ? batch.monthlyFee : 0);
    const discount = e.discount || 0;
    const netFee = Math.max(0, baseFee - discount);
    
    // Extra charges
    const extraChargesSum = e.extraCharges?. [selectedMonth]?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const totalDue = netFee + extraChargesSum;

    const status = e.paymentStatus?.[selectedMonth] || 'unpaid';
    
    // Actual paid amount
    const paid = e.paidAmountMap?.[selectedMonth] !== undefined
      ? e.paidAmountMap[selectedMonth]
      : (status === 'paid' ? totalDue : 0);

    const due = Math.max(0, totalDue - paid);

    let statusLabel = status.toUpperCase();
    if (status === 'paid') statusLabel = 'PAID (পরিশোধিত)';
    else if (status === 'pending') statusLabel = 'PENDING (অপেক্ষারত)';
    else statusLabel = 'UNPAID (বকেয়া)';

    return [
      `0${index + 1}`,
      e.studentName || 'N/A',
      e.studentPhone || 'N/A',
      batchName,
      `BDT ${totalDue.toLocaleString()}`,
      `BDT ${paid.toLocaleString()}`,
      `BDT ${due.toLocaleString()}`,
      statusLabel
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [['#', 'Student Name', 'Contact No', 'Enrolled Batch', 'Total Due', 'Paid Amt', 'Outstanding', 'Payment Status']],
    body: paymentRows.length > 0 ? paymentRows : [['No students enrolled in any batch', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor as [number, number, number],
      fontSize: 8.5,
      textColor: [255, 255, 255]
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: textColor as [number, number, number],
      lineColor: borderColor as [number, number, number]
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 38 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
      6: { cellWidth: 20 },
      7: { 
        cellWidth: 24, 
        fontStyle: 'bold',
        halign: 'center'
      }
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 7 && cellData.cell.section === 'body') {
        const val = String(cellData.cell.raw || '');
        if (val.includes('PAID')) {
          cellData.cell.styles.textColor = [16, 124, 65] as any; // Green
          cellData.cell.styles.fillColor = [240, 253, 244] as any; // Light Green
        } else if (val.includes('PENDING')) {
          cellData.cell.styles.textColor = [180, 83, 9] as any; // Amber
          cellData.cell.styles.fillColor = [254, 243, 199] as any; // Light Amber
        } else {
          cellData.cell.styles.textColor = [220, 38, 38] as any; // Red
          cellData.cell.styles.fillColor = [254, 242, 242] as any; // Light Red
        }
      }
    }
  });

  // Calculate page count and draw header/footer for all pages
  const totalPages = doc.internal.pages.length - 1; // jsPDF has a dummy empty page at start or end
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  // Save the PDF
  const filename = `${teacherName.replace(/\s+/g, '_')}_Batches_Summary_${selectedMonth.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
};
