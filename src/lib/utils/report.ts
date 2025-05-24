import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Database } from '@/types/supabase'; 
import type { RecipientApp } from '../../types/recipient';
import type { MatchResult as AppMatchResult, MatchDetailsInternal } from '../../types/matching';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: UserOptions) => void;
    lastAutoTable: { finalY: number };
  }
}

interface ReportData {
  recipient: RecipientApp; 
  results: AppMatchResult[]; 
  timestamp: string;
}

export function generatePDF(data: ReportData) {
  const { recipient, results, timestamp } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page dimensions and margins
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  let y = margin;
  const headerHeight = 25;
  const footerHeight = 15;
  let pageNumber = 1;

  // Helper functions
  const addHeader = () => {
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Kidney Match Report', pageWidth / 2, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${format(new Date(timestamp), 'PPpp')}`, pageWidth / 2, 18, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  const addFooter = () => {
    const footerY = pageHeight - footerHeight;
    doc.setFillColor(245, 245, 245);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('This report is for medical professional use only. All matches should be verified by laboratory testing.', pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text(`Page ${pageNumber}`, pageWidth - margin, footerY + 5, { align: 'right' });
    pageNumber++;
  };

  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - margin - footerHeight) {
      addFooter();
      doc.addPage();
      addHeader();
      y = margin + headerHeight;
      return true;
    }
    return false;
  };

  const addSection = (title: string) => {
    checkPageBreak(20);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.text(title, margin + 2, y + 2);
    const titleWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.5);
    doc.line(margin + 2, y + 4, margin + 2 + titleWidth, y + 4);
    y += 12;
    doc.setTextColor(0, 0, 0);
  };

  const addField = (label: string, value: string | number, color?: string) => {
    checkPageBreak(8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', margin + 2, y);
    doc.setFont('helvetica', 'normal');
    if (color) {
      const rgb = hexToRgb(color);
      if (rgb) doc.setTextColor(rgb.r, rgb.g, rgb.b);
    }
    doc.text(String(value), margin + 75, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Start generating the report
  addHeader();
  y = margin + headerHeight + 5;

  // Recipient Information
  addSection('Recipient Information');
  
  // Personal Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Personal Information', margin + 2, y);
  y += 8;

  const personalInfo = [
    { label: 'Full Name', value: recipient.fullName },
    { label: 'MRN', value: recipient.mrn },
    { label: 'National ID', value: recipient.nationalId },
    { label: 'Age', value: recipient.age },
    { label: 'Blood Type', value: recipient.bloodType },
    { label: 'Mobile Number', value: recipient.mobileNumber }
  ];

  personalInfo.forEach(info => {
    addField(info.label, info.value || 'N/A');
  });

  // HLA Typing
  addSection('HLA Typing Information');
  
  const hlaInfo = [
    { label: 'HLA-A', value: recipient.hlaTyping?.hlaA },
    { label: 'HLA-B', value: recipient.hlaTyping?.hlaB },
    { label: 'HLA-C', value: recipient.hlaTyping?.hlaC },
    { label: 'HLA-DR', value: recipient.hlaTyping?.hlaDR },
    { label: 'HLA-DQ', value: recipient.hlaTyping?.hlaDQ },
    { label: 'HLA-DP', value: recipient.hlaTyping?.hlaDP }
  ];

  hlaInfo.forEach(info => {
    addField(info.label, info.value || 'N/A');
  });

  // Medical Information
  addSection('Medical Information');

  const medicalInfo = [
    { label: 'Medical History', value: recipient.medicalHistory },
    { label: 'Serum Creatinine', value: recipient.serumCreatinine ? `${recipient.serumCreatinine} mg/dL` : 'N/A' },
    { label: 'eGFR', value: recipient.egfr ? `${recipient.egfr} mL/min/1.73m²` : 'N/A' },
    { label: 'Blood Pressure', value: recipient.bloodPressure },
    { label: 'Viral Screening', value: recipient.viralScreening },
    { label: 'CMV Status', value: recipient.cmvStatus }
  ];

  medicalInfo.forEach(info => {
    addField(info.label, info.value || 'N/A');
  });

  // Matching Summary
  addSection('Matching Summary');

  const compatibleDonors = results.filter(r => r.isCompatible);
  const incompatibleDonors = results.filter(r => 
    !r.isCompatible && 
    r.exclusionReason && 
    !r.exclusionReason.toLowerCase().includes('unacceptable antigen')
  );
  const excludedDonors = results.filter(r => 
    !r.isCompatible && 
    r.exclusionReason && 
    r.exclusionReason.toLowerCase().includes('unacceptable antigen')
  );

  // Summary statistics with colored indicators
  addField('Total Donors Evaluated', results.length.toString());
  addField('Compatible Donors', compatibleDonors.length.toString(), '#22c55e');
  addField('Incompatible Donors', incompatibleDonors.length.toString(), '#eab308');
  addField('Excluded Donors', excludedDonors.length.toString(), '#ef4444');

  if (compatibleDonors.length > 0) {
    const bestScore = Math.max(...compatibleDonors.map(r => r.compatibilityScore));
    addField('Best Match Score', `${(bestScore * 100).toFixed(1)}%`, '#22c55e');
  }

  // Compatible Donors Details
  if (compatibleDonors.length > 0) {
    addSection('Compatible Donors Details');
    doc.autoTable({
      startY: y,
      head: [['Donor ID', 'MRN', 'Blood Type', 'HLA Matches', 'Score']],
      body: compatibleDonors.map(r => [
        r.donor.id,
        r.donor.mrn || 'N/A',
        r.donor.bloodType || 'N/A',
        r.matchDetails?.hlaMatchCount ?? 0, 
        r.compatibilityScore.toString() + '%'
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber !== pageNumber) {
          pageNumber = hookData.pageNumber;
          addFooter(); 
          addHeader(); 
        }
      }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Excluded Donors Table
  if (excludedDonors.length > 0) {
    addSection('Excluded Donors Details (Unacceptable Antigens)');
    doc.autoTable({
      startY: y,
      head: [['Donor ID', 'MRN', 'Blood Type', 'Exclusion Reason']],
      body: excludedDonors.map(r => [
        r.donor.id,
        r.donor.mrn || 'N/A',
        r.donor.bloodType || 'N/A',
        r.exclusionReason || 'N/A' 
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' }, 
      didDrawPage: (hookData) => {
        if (hookData.pageNumber !== pageNumber) {
          pageNumber = hookData.pageNumber;
          addFooter();
          addHeader();
        }
      }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Finalize: Add footer to the last page if not already added by autoTable
  if (doc.internal.pages.length === pageNumber -1 ) { 
  } else {
    addFooter();
  }
  
  return doc;
}

export function printReport() {
  window.print();
}
