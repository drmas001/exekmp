import type { HLATypingApp } from './recipient'; // Or from './hla' if created

export interface DonorFormData {
  // Personal Information
  mrn: string;
  nationalId: string;
  fullName: string;
  age: number;
  bloodType: string;
  mobileNumber: string;

  // HLA Typing
  hlaA: string;
  hlaB: string;
  hlaC: string;
  hlaDR: string;
  hlaDQ: string;
  hlaDP: string;
  highResTyping: string;
  donorAntibodies: string;
  antigenMismatch: number;
  crossmatchResult: string;

  // Medical Tests
  serumCreatinine: number;
  egfr: number;
  bloodPressure: string;
  viralScreening: string;
  cmvStatus: string;

  // Additional Information
  medicalConditions: string;
  notes: string;
}

// Application-specific Donor type (used after transformation from IPC/DB types)
export interface DonorApp {
  id: string;
  mrn?: string | null;
  nationalId?: string | null;
  fullName?: string | null;
  age?: number | null;
  bloodType?: string | null;
  mobileNumber?: string | null;
  hlaTyping: HLATypingApp; // Uses the App-specific HLA type
  crossmatchResult?: string | null;
  donorAntibodies: string[]; // Expecting parsed array of strings
  serumCreatinine: number;
  egfr: number;
  bloodPressure?: string | null;
  viralScreening?: string | null;
  cmvStatus?: string | null;
  medicalConditions?: string | null;
  notes?: string | null;
  highResTyping?: string | null;
  antigenMismatch: number;
  // The 'dsaResult' and 'detected' fields from the local DonorApp in matching.ts 
  // need clarification on their structure and source if they are to be included.
  // For now, including them as they were:
  dsaResult: { detected: boolean; specificities: string; strength: string }; 
  status: string; // e.g., 'Available', 'Utilized'
  // 'detected' field from original DonorApp in matching.ts was boolean. Clarify its purpose.
  // If it's related to dsaResult.detected, it might be redundant here.
  // Adding it as 'isDsaDetected' for clarity if it's separate.
  isDsaDetected?: boolean; 
}