export interface HLATyping {
  hlaA: string;
  hlaB: string;
  hlaC: string;
  hlaDR: string;
  hlaDQ: string;
  hlaDP: string;
}

export interface Recipient {
  id: string;
  mrn: string;
  nationalId: string;      // In DB: national_id
  fullName: string;        // In DB: full_name
  age: number;
  bloodType: string;       // In DB: blood_type
  mobileNumber: string;
  hlaTyping: HLATyping;
  pra: number;
  crossmatchRequirement: string;
  viralScreening: string;
  cmvStatus: string;
  unacceptableAntigens: string; 
  donorAntibodies: string;    
  medicalHistory: string;     
  notes: string; 
  serumCreatinine: number;    
  egfr: number;               
  bloodPressure: string;      
  diagnosis?: string; 
  hlaTypingComplete?: boolean; 
  antibodyScreeningDone?: boolean; 
  antibodySpecificity?: string; 
  urgency?: string;
  createdAt?: string;       // In DB: created_at
  updatedAt?: string;       // In DB: updated_at
}

// Application-specific HLA Typing (used after transformation)
export interface HLATypingApp {
  hlaA: string;
  hlaB: string;
  hlaC: string;
  hlaDR: string;
  hlaDQ: string;
  hlaDP: string;
}

// Application-specific Recipient type (used after transformation from IPC/DB types)
export interface RecipientApp {
  id: string;
  mrn?: string | null;
  nationalId?: string | null;
  fullName?: string | null;
  age?: number | null;
  bloodType?: string | null;
  mobileNumber?: string | null;
  hlaTyping: HLATypingApp; // Uses the App-specific HLA type
  pra: number;
  crossmatchRequirement?: string | null;
  viralScreening?: string | null;
  cmvStatus?: string | null;
  unacceptableAntigens: string[]; // Expecting parsed array of strings
  donorAntibodies: string[];    // Expecting parsed array of strings
  medicalHistory?: string | null;
  notes?: string | null;
  serumCreatinine: number;
  egfr: number;
  bloodPressure?: string | null;
  // Fields from Recipient that might be missing or need confirmation:
  // diagnosis?: string;
  // hlaTypingComplete?: boolean;
  // antibodyScreeningDone?: boolean;
  // antibodySpecificity?: string;
  // urgency?: string;
  // createdAt?: string;
  // updatedAt?: string;
}

export interface RecipientFormData {
  // Personal Information
  mrn: string;
  nationalId: string;
  fullName: string;
  age: number;
  bloodType: string;
  mobileNumber: string;

  // HLA Typing Requirements
  hlaA: string;
  hlaB: string;
  hlaC: string;
  hlaDR: string;
  hlaDQ: string;
  hlaDP: string;
  unacceptableAntigens: string;
  pra: number;
  crossmatchRequirement: string;
  donorAntibodies: string;

  // Medical Information
  serumCreatinine: number;
  egfr: number;
  bloodPressure: string;
  viralScreening: string;
  cmvStatus: string;

  // Additional Details
  medicalHistory: string;
  notes: string;
}