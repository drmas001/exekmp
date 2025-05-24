// /Users/moh/Downloads/Kmpfinal-main/electron.d.ts

// Define the IPC data structures
export interface RecentDonorIPC {
  id: string;
  full_name: string; // Was 'name'
  created_at: string; // Was 'dateAdded', and ensure it's a string if that's what's sent
  // Add other relevant donor properties here
}

export interface RecentMatchIPC {
  id: string; // Was 'matchId'
  donorName?: string; // Keep if used elsewhere, or remove if only full_name is used for donor
  recipient_full_name: string; // Was 'recipientName'
  matchDate?: string; // Keep if used elsewhere
  created_at: string; // Added this property
  status: string;
  // Add other relevant match properties here
}

export interface MatchingResultStatusIPC {
  id: string;
  status: 'successful' | 'pending' | 'failed' | string; // Allow for other statuses
  recipientId?: string;
  donorId?: string;
  details?: string;
  // Add other relevant status properties here
}

// Added missing IPC type definitions
export interface HLATypingIPC {
  hlaA?: string;
  hlaB?: string;
  hlaC?: string;
  hlaDR?: string;
  hlaDQ?: string;
  hlaDP?: string;
}

export interface DonorIPC {
  id: string;
  mrn?: string;
  nationalId?: string;
  fullName?: string;
  age?: number;
  bloodType?: string;
  mobileNumber?: string;
  hlaTyping?: HLATypingIPC; // Existing: Keep as optional for now
  // Add top-level HLA properties, as these are likely what main.cjs sends
  hlaA?: string;
  hlaB?: string;
  hlaC?: string;
  hlaDR?: string;
  hlaDQ?: string;
  hlaDP?: string;
  status?: 'Available' | 'Utilized' | string; // Match Donor type status
  crossmatchResult?: string;
  donorAntibodies?: string;
  serumCreatinine?: number;
  egfr?: number;
  bloodPressure?: string;
  viralScreening?: string;
  cmvStatus?: string;
  medicalConditions?: string;
  notes?: string;
  highResTyping?: string;
  antigenMismatch?: number | string;
  dsaResult?: { detected?: boolean; specificities?: string; strength?: string; };
}

export interface RecipientIPC {
  id: string;
  fullName?: string;
  mrn?: string;
  nationalId?: string;
  age?: number;
  bloodType?: string;
  mobileNumber?: string;
  hlaTyping?: HLATypingIPC;
  pra?: string | number;
  crossmatchRequirement?: string;
  viralScreening?: string;
  cmvStatus?: string;
  unacceptableAntigens?: string | string[];
  donorAntibodies?: string; // Note: Also on DonorIPC, seems specific to donor context but present in recipient access patterns
  medicalHistory?: string;
  notes?: string;
  serumCreatinine?: number;
  egfr?: number;
  bloodPressure?: string;
}

export interface MatchingResultIPC {
  id: string;
  donorId: string;
  recipientId: string;
  matchDate?: string;
  status?: string; // e.g., 'Preliminary', 'Confirmed', 'CrossmatchPending'
  // Add other relevant match result fields
}

export interface MatchDetailsIPC {
  matchId: string;
  compatibilityScore?: number;
  mismatchedAntigens?: string[];
  // Add other detailed fields about a match
}

import { Donor, DonorFormData } from './src/types/donor';
import { Recipient, RecipientFormData } from './src/types/recipient';
import { MatchResult } from './src/types/matching';

export interface IElectronAPI {
  getTasks: () => Promise<any[]>;

  insertMatchingResult: (data: any) => Promise<any>; 
  getMatchingResults: (recipientId: string) => Promise<any[]>; 
  updateMatchingResultStatus: (data: { matchId: string; status: string }) => Promise<any>; 

  getRecipientById: (id: number | string) => Promise<Recipient | null>; 
  getAvailableDonors: () => Promise<any[]>;

  // Donor CRUD operations
  addDonor: (donorData: any) => Promise<any>; 
  getDonors: () => Promise<any[]>; 
  getDonorById: (id: string) => Promise<any | null>; 
  updateDonor: (id: string, donorData: any) => Promise<any>; 
  deleteDonor: (id: string) => Promise<{ success: boolean; changes: number }>;

  // Recipient specific APIs
  addRecipient: (recipientData: RecipientFormData) => Promise<{ success: boolean; id?: string; message?: string; error?: string }>;
  createRecipient: (data: RecipientFormData) => Promise<{ success: boolean; id?: string; message?: string; error?: string; }>;
  getRecipients: () => Promise<any[]>; 
  getRecipientById: (id: number | string) => Promise<Recipient | null>; 
  updateRecipient: (id: string, recipientData: Partial<RecipientFormData>) => Promise<{ success: boolean; message?: string; error?: string }>; 
  deleteRecipient: (id: string) => Promise<{ success: boolean; changes: number }>;

  // Dashboard specific IPC calls
  getDonorCount: () => Promise<number>;
  getRecipientCount: () => Promise<number>; 
  getAllMatchingResultsStatus: () => Promise<MatchingResultStatusIPC[]>;
  getRecentDonors: () => Promise<RecentDonorIPC[]>;
  getRecentMatches: () => Promise<RecentMatchIPC[]>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
