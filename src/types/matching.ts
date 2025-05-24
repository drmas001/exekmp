import { DonorApp } from './donor';
import { RecipientApp } from './recipient';

export type BloodType = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';

export interface MatchDetailsInternal {
  bloodTypeMatch: boolean;
  hlaMatches?: { 
    [key: string]: { 
      donorAlleles: string[];
      recipientAlleles: string[];
      matchedAlleles: string[];
    };
  } | undefined;
  hlaMatchCount?: number; // Primary match count (A, B, DR) for compatibility rules
  hlaTotalDetailedMatchCount?: number; // Total allele matches across all 6 loci (A,B,C,DR,DQ,DP) for display
  hlaLociMatchCount?: number; // Number of loci (out of 6) that have at least one match
  crossmatchCompatible: boolean;
  hasUnacceptableAntigens?: boolean;
  unacceptableAntigensDetails?: Array<{ antigen: string; locus: string }>;
  praCompatible?: boolean;
  isPediatric?: boolean; // Added for pediatric status
  potentialPositiveCrossmatch?: boolean; // Added for potential positive crossmatch
}

export interface MatchResult {
  donor: DonorApp;
  compatibilityScore: number;
  isCompatible: boolean;
  exclusionReason: string | null;
  matchDetails: MatchDetailsInternal | null;
}

export interface CompatibilityParams {
  bloodTypeMatch: boolean;
  hlaMatches: number;
  crossmatchCompatible: boolean;
  recipient: RecipientApp;
  donor: DonorApp;
}