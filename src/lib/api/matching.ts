// Define the window.electronAPI structure if you haven't in a global .d.ts file
// For example, in a file like src/electron.d.ts:
// declare global {
//   interface Window {
//     electronAPI: {
//       insertMatchingResult: (data: any) => Promise<{ success: boolean; id: string; changes: number }>;
//       getMatchingResults: (recipientId: string) => Promise<any>;
//       // other API methods
//     };
//   }
// }

import type { RecipientIPC, DonorIPC, HLATypingIPC, MatchingResultIPC, MatchDetailsIPC as MatchDetailsIPCType } from '../../../electron.d.ts';

// Import App-specific types from the types directory
import type { HLATypingApp, RecipientApp } from '../../types/recipient';
import type { DonorApp } from '../../types/donor';
import type { MatchResult, MatchDetailsInternal, CompatibilityParams } from '../../types/matching';

// --- End of Application-specific types ---

export async function createMatchingResult(data: {
  recipient_id: string;
  donor_id: string;
  compatibility_score: number;
  match_details: MatchDetailsIPCType; // This is the structure sent to main.js
  status?: string;
  id?: string; // Optional, if frontend generates UUID
}) {
  const insertData = {
    id: data.id, // Pass if you allow providing an ID (main.js should handle stringifying match_details)
    recipient_id: data.recipient_id,
    donor_id: data.donor_id,
    compatibility_score: data.compatibility_score,
    match_details: data.match_details, // Already an object, main.js will stringify
    status: data.status || 'Pending'
  };

  try {
    if (!window.electronAPI || !window.electronAPI.insertMatchingResult) {
      throw new Error('Electron API for insertMatchingResult is not available.');
    }
    // The IPC handler expects `match_details` as an object, it will stringify it.
    const result = await window.electronAPI.insertMatchingResult(insertData);

    if (result && result.success) {
      return {
        id: result.id, // ID returned from the database operation
        ...data, // Return the original input data for consistency with previous behavior
        created_at: new Date().toISOString(), // Approximate, actual is DB default
        status: insertData.status,
      };
    } else {
      throw new Error(result?.message || 'Failed to create matching result via IPC.');
    }
  } catch (error) {
    console.error('Error creating matching result:', error);
    throw error;
  }
}

export async function getMatchingResults(recipientId: string): Promise<MatchingResultIPC[]> {
  try {
    if (!window.electronAPI || !window.electronAPI.getMatchingResults) {
      throw new Error('Electron API for getMatchingResults is not available.');
    }
    const results = await window.electronAPI.getMatchingResults(recipientId);
    return results; // Already parsed by main.js
  } catch (error) {
    console.error(`Error fetching matching results for recipient ${recipientId}:`, error);
    throw error;
  }
}

export async function updateMatchingResultStatus(
  id: string, // This 'id' is effectively the matchId
  status: NonNullable<MatchingResultIPC['status']> // Ensure MatchingResultIPC is defined or imported
) {
  try {
    if (!window.electronAPI || !window.electronAPI.updateMatchingResultStatus) {
      throw new Error('Electron API for updateMatchingResultStatus is not available.');
    }
    // 1. Correct the argument passed to the Electron API
    const result = await window.electronAPI.updateMatchingResultStatus({ matchId: id, status });

    if (result && result.success) {
      // 2. Adjust the returned object to match the expected type
      // Assuming result.id from the backend is the matchId
      return { matchId: result.id, status: status };
    } else {
      throw new Error(result?.message || `Matching result with ID ${id} not found or status unchanged.`);
    }
  } catch (error) {
    console.error(`Error updating status for matching result ${id}:`, error);
    throw error;
  }
}

export function transformRecipientData(recipientData: RecipientIPC): RecipientApp {
  return {
    id: recipientData.id,
    mrn: recipientData.mrn,
    nationalId: recipientData.nationalId,
    fullName: recipientData.fullName,
    age: recipientData.age,
    bloodType: recipientData.bloodType,
    mobileNumber: recipientData.mobileNumber,
    hlaTyping: {
      hlaA: recipientData.hlaTyping?.hlaA || '',
      hlaB: recipientData.hlaTyping?.hlaB || '',
      hlaC: recipientData.hlaTyping?.hlaC || '',
      hlaDR: recipientData.hlaTyping?.hlaDR || '',
      hlaDQ: recipientData.hlaTyping?.hlaDQ || '',
      hlaDP: recipientData.hlaTyping?.hlaDP || ''
    },
    pra: typeof recipientData.pra === 'string' ? (parseInt(recipientData.pra, 10) || 0) : (recipientData.pra || 0),
    crossmatchRequirement: recipientData.crossmatchRequirement,
    viralScreening: recipientData.viralScreening,
    cmvStatus: recipientData.cmvStatus,
    unacceptableAntigens: typeof recipientData.unacceptableAntigens === 'string' 
      ? recipientData.unacceptableAntigens.split(',').map(s => s.trim()).filter(s => s) 
      : Array.isArray(recipientData.unacceptableAntigens) 
        ? recipientData.unacceptableAntigens.map(s => String(s).trim()).filter(s => s) 
        : [],
    donorAntibodies: typeof recipientData.donorAntibodies === 'string' ? [recipientData.donorAntibodies] : [], // Assuming RecipientApp expects string[] and IPC might send string
    medicalHistory: recipientData.medicalHistory,
    notes: recipientData.notes,
    serumCreatinine: recipientData.serumCreatinine || 0,
    egfr: recipientData.egfr || 0,
    bloodPressure: recipientData.bloodPressure || 'N/A'
  };
}

export function transformDonorData(donorData: DonorIPC): DonorApp {
  const dsaFromIPC = donorData.dsaResult;
  const appDsaResult = dsaFromIPC 
    ? { 
        detected: dsaFromIPC.detected ?? false, 
        specificities: dsaFromIPC.specificities ?? '', 
        strength: dsaFromIPC.strength ?? '' 
      }
    : { detected: false, specificities: '', strength: '' };

  const donorApp = {
    id: donorData.id,
    mrn: donorData.mrn,
    nationalId: donorData.nationalId,
    fullName: donorData.fullName,
    age: donorData.age,
    bloodType: donorData.bloodType,
    mobileNumber: donorData.mobileNumber,
    hlaTyping: {
      hlaA: donorData.hlaA || '', // Use direct property donorData.hlaA
      hlaB: donorData.hlaB || '', // Use direct property donorData.hlaB
      hlaC: donorData.hlaC || '', // Use direct property donorData.hlaC
      hlaDR: donorData.hlaDR || '', // Use direct property donorData.hlaDR
      hlaDQ: donorData.hlaDQ || '', // Use direct property donorData.hlaDQ
      hlaDP: donorData.hlaDP || ''  // Use direct property donorData.hlaDP
    },
    crossmatchResult: donorData.crossmatchResult,
    donorAntibodies: typeof donorData.donorAntibodies === 'string' ? [donorData.donorAntibodies] : [], // Assuming DonorApp expects string[] and IPC might send string
    serumCreatinine: donorData.serumCreatinine || 0,
    egfr: donorData.egfr || 0,
    bloodPressure: donorData.bloodPressure || 'N/A',
    viralScreening: donorData.viralScreening,
    cmvStatus: donorData.cmvStatus,
    medicalConditions: donorData.medicalConditions,
    notes: donorData.notes,
    highResTyping: donorData.highResTyping || '',
    antigenMismatch: typeof donorData.antigenMismatch === 'string' ? (parseInt(donorData.antigenMismatch, 10) || 0) : (donorData.antigenMismatch || 0),
    dsaResult: appDsaResult,
    isDsaDetected: appDsaResult.detected,
    status: donorData.status || 'Unknown'
  };
  return donorApp;
}

export async function findCompatibleDonors(recipientId: string): Promise<MatchResult[]> {
  console.log('[matching.ts] findCompatibleDonors called with recipientId:', recipientId);

  if (!window.electronAPI || !window.electronAPI.getRecipientById || !window.electronAPI.getAvailableDonors) {
    console.error('[matching.ts] Electron API for fetching recipient or donors is not available.');
    throw new Error('Electron API for fetching recipient or donors is not available.');
  }

  console.log('[matching.ts] Attempting to get recipient by ID:', recipientId);
  const recipientDataIPC = await window.electronAPI.getRecipientById(recipientId);
  console.log('[matching.ts] Received recipientDataIPC:', recipientDataIPC);
  if (!recipientDataIPC) {
    console.error(`[matching.ts] Recipient with ID ${recipientId} not found.`);
    throw new Error(`Recipient with ID ${recipientId} not found.`);
  }
  const recipient = transformRecipientData(recipientDataIPC);
  console.log('[matching.ts] Transformed recipient:', recipient);

  console.log('[matching.ts] Attempting to get available donors');
  const donorsIPC = await window.electronAPI.getAvailableDonors();
  console.log('[matching.ts] Received donorsIPC:', donorsIPC);
  if (!donorsIPC || donorsIPC.length === 0) {
    console.warn('[matching.ts] No available donors found or failed to fetch.');
    return []; 
  }

  const results: MatchResult[] = [];

  for (const donorIPC of donorsIPC) {
    const donor = transformDonorData(donorIPC);
    console.log(`[matching.ts] Processing donor: ${donor.fullName} (ID: ${donor.id}) for recipient ${recipient.fullName} (ID: ${recipient.id})`);

    let matchDetails: MatchDetailsInternal = {
      bloodTypeMatch: false, 
      hlaMatches: undefined, 
      hlaMatchCount: 0,      
      hlaTotalDetailedMatchCount: 0, 
      hlaLociMatchCount: 0, 
      crossmatchCompatible: true, 
      hasUnacceptableAntigens: false, 
      unacceptableAntigensDetails: [], 
      praCompatible: true, 
      isPediatric: typeof recipient.age === 'number' && recipient.age < 18, 
      potentialPositiveCrossmatch: false, 
    };

    // 1. Check for Unacceptable Antigens FIRST
    // recipient.unacceptableAntigens is string[] due to transformRecipientData
    const unacceptableCheck = checkUnacceptableAntigens(donor.hlaTyping, recipient.unacceptableAntigens);
    matchDetails.hasUnacceptableAntigens = unacceptableCheck.hasUnacceptableAntigens;
    matchDetails.unacceptableAntigensDetails = unacceptableCheck.unacceptableAntigensDetails;

    if (unacceptableCheck.hasUnacceptableAntigens) {
      console.log(`[matching.ts] Donor ${donor.id} excluded for recipient ${recipient.id} due to unacceptable antigens:`, unacceptableCheck.unacceptableAntigensDetails);
      results.push({
        donor,
        compatibilityScore: 0, 
        isCompatible: false,
        exclusionReason: "Incompatible – Unacceptable Antigen Present",
        matchDetails,
      });
      continue; // Skip to the next donor
    }

    // If donor passes unacceptable antigen check, proceed with other compatibility evaluations.

    // STEP 2: Check blood type compatibility
    console.log('[matching.ts] Checking blood type compatibility for donor:', donor.id);
    const bloodTypeCompatible = isBloodTypeCompatible(donor.bloodType || '', recipient.bloodType || '');
    matchDetails.bloodTypeMatch = bloodTypeCompatible;
    console.log('[matching.ts] Blood type compatible:', bloodTypeCompatible);

    if (!bloodTypeCompatible) {
      console.log('[matching.ts] Donor excluded due to blood type incompatibility:', donor.id);
      results.push({
        donor,
        compatibilityScore: 0,
        isCompatible: false,
        exclusionReason: 'Blood type incompatible',
        matchDetails, // Contains bloodTypeMatch: false
      });
      continue; // Skip to the next donor
    }

    // STEP 2.5: Check actual crossmatch result from donor data
    console.log('[matching.ts] Checking actual crossmatch result for donor:', donor.id, 'Result:', donor.crossmatchResult);
    if (donor.crossmatchResult && donor.crossmatchResult.toLowerCase() === 'positive') {
      console.log('[matching.ts] Donor excluded due to positive actual crossmatch:', donor.id);
      matchDetails.crossmatchCompatible = false; // Update matchDetails
      results.push({
        donor,
        compatibilityScore: 0,
        isCompatible: false,
        exclusionReason: 'Actual crossmatch positive',
        matchDetails,
      });
      continue; // Skip to the next donor
    }
    // If crossmatchResult is present and not positive, it's compatible for this check
    // This also means matchDetails.crossmatchCompatible remains true (its default if not overridden by PRA later)
    if (donor.crossmatchResult && donor.crossmatchResult.trim() !== '') {
        matchDetails.crossmatchCompatible = donor.crossmatchResult.toLowerCase() !== 'positive';
    }

    // STEP 2.6: Check Donor Specific Antibodies (DSA)
    console.log('[matching.ts] Checking DSA for donor:', donor.id, 'DSA Detected:', donor.dsaResult?.detected);
    if (donor.dsaResult?.detected) {
      console.log('[matching.ts] Donor excluded due to detected DSA:', donor.id);
      matchDetails.potentialPositiveCrossmatch = true; // DSA detected implies potential issues
      // Depending on clinical rules, DSA might make crossmatchCompatible false or lead to exclusion
      results.push({
        donor,
        compatibilityScore: 0, // Or a very low score, or based on policy
        isCompatible: false, // Typically DSA positive is a contraindication or requires further investigation
        exclusionReason: `Donor-Specific Antibodies (DSA) detected. Specificities: ${donor.dsaResult.specificities || 'N/A'}, Strength: ${donor.dsaResult.strength || 'N/A'}`, 
        matchDetails,
      });
      continue; // Skip to the next donor
    }

    // STEP 3: Calculate HLA matches
    console.log('[matching.ts] Calculating HLA matches for donor:', donor.id);
    const {
      detailedMatches: hlaMatchesDetails,
      primaryMatchCount: hlaPrimaryMatchCount,
      totalDetailedMatchCount: hlaTotalDetailedMatchCount,
      lociWithMatchCount: hlaLociWithMatchCount
    } = calculateHLAMatches(donor.hlaTyping, recipient.hlaTyping);
    console.log('[matching.ts] HLA primary matches (A,B,DR):', hlaPrimaryMatchCount, 'HLA total detailed matches (all loci):', hlaTotalDetailedMatchCount, 'HLA loci with match:', hlaLociWithMatchCount);

    matchDetails.hlaMatches = hlaMatchesDetails;
    matchDetails.hlaMatchCount = hlaPrimaryMatchCount;
    matchDetails.hlaTotalDetailedMatchCount = hlaTotalDetailedMatchCount;
    matchDetails.hlaLociMatchCount = hlaLociWithMatchCount;

    // STEP 4: Determine Final Crossmatch Status (Virtual Crossmatch if actual not definitive or not present)
    let crossmatchMethod = "Actual Lab Result"; // Default if donor.crossmatchResult was present and used
    if (!(donor.crossmatchResult && donor.crossmatchResult.trim() !== '')) {
        // No actual/definitive crossmatch result, so rely on virtual crossmatch (PRA-based)
        matchDetails.praCompatible = !(recipient.pra > 80); // PRA > 80 implies potential positive virtual crossmatch
        matchDetails.crossmatchCompatible = matchDetails.praCompatible;
        crossmatchMethod = "Virtual (PRA-based)";
        if (!matchDetails.crossmatchCompatible) {
            matchDetails.potentialPositiveCrossmatch = true; // PRA > 80 suggests this
        }
    } // If actual crossmatch was done and negative, matchDetails.crossmatchCompatible is already true.
      // If actual crossmatch was positive, we would have 'continue'd earlier.

    console.log(`[matching.ts] Final crossmatch status for donor ${donor.id}: ${matchDetails.crossmatchCompatible} (Method: ${crossmatchMethod})`);

    // STEP 5: Calculate overall compatibility score
    console.log('[matching.ts] Calculating compatibility score for donor:', donor.id);
    const compatibilityParams: CompatibilityParams = {
      bloodTypeMatch: true, // Must be true to reach here
      hlaMatches: hlaPrimaryMatchCount, // Use primary match count for scoring rules
      crossmatchCompatible: matchDetails.crossmatchCompatible, // Use the determined final status
      recipient,
      donor
    };
    const score = calculateCompatibilityScore(compatibilityParams);
    console.log('[matching.ts] Compatibility score:', score);

    let finalIsCompatible = true;
    let finalExclusionReason: string | null = null;

    // Determine final compatibility based on rules (e.g., minimum HLA matches, score threshold)
    console.log(`[matching.ts] Checking final compatibility for donor ${donor.id}. HLA Primary Match Count (A,B,DR): ${hlaPrimaryMatchCount}`);

    if (hlaPrimaryMatchCount < 3) { // Example rule: min 3 primary matches (A,B,DR)
      finalIsCompatible = false;
      finalExclusionReason = `Insufficient primary HLA matches: ${hlaPrimaryMatchCount}/6 (A, B, DR). Minimum 3 required.`;
      console.log(`[matching.ts] Donor ${donor.id} INCOMPATIBLE due to insufficient primary HLA matches.`);
    } else if (!matchDetails.crossmatchCompatible) {
      finalIsCompatible = false;
      finalExclusionReason = `Crossmatch incompatible (Method: ${crossmatchMethod}${donor.crossmatchResult && donor.crossmatchResult.trim() !== '' ? ', Actual Result: ' + donor.crossmatchResult : ''})`;
      console.log(`[matching.ts] Donor ${donor.id} INCOMPATIBLE due to crossmatch.`);
    } else if (score < 50) { // Example rule: min score 50 for compatibility
      finalIsCompatible = false;
      finalExclusionReason = 'Compatibility score below threshold';
      console.log(`[matching.ts] Donor ${donor.id} INCOMPATIBLE due to low score (Score: ${score}).`);
    } else {
      console.log(`[matching.ts] Donor ${donor.id} is preliminarily COMPATIBLE.`);
    }

    results.push({
      donor,
      compatibilityScore: score,
      isCompatible: finalIsCompatible,
      exclusionReason: finalExclusionReason,
      matchDetails, // This now contains all accumulated details
    });
  } // End of for...of loop for donorsIPC
  console.log('[matching.ts] Final compatible donors results:', results);
  return results.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

// Helper function to check for unacceptable antigens
function checkUnacceptableAntigens(
  donorHLA: HLATypingApp, 
  unacceptableAntigensList: string[] 
): {
  hasUnacceptableAntigens: boolean;
  unacceptableAntigensDetails: Array<{ antigen: string; locus: string }>;
} {
  const unacceptableAntigensDetails: Array<{ antigen: string; locus: string }> = [];
  let hasUnacceptableAntigens = false;

  if (!unacceptableAntigensList || unacceptableAntigensList.length === 0) {
    return { hasUnacceptableAntigens: false, unacceptableAntigensDetails: [] };
  }

  const cleanedUnacceptableList = unacceptableAntigensList.map(ua => ua.trim().toUpperCase()).filter(ua => ua);
  if (cleanedUnacceptableList.length === 0) {
    return { hasUnacceptableAntigens: false, unacceptableAntigensDetails: [] };
  }

  const loci: Array<keyof HLATypingApp> = ['hlaA', 'hlaB', 'hlaC', 'hlaDR', 'hlaDQ', 'hlaDP'];

  for (const locus of loci) {
    const donorAllelesString = donorHLA[locus];
    if (donorAllelesString && typeof donorAllelesString === 'string') {
      const donorAlleles = donorAllelesString.split(',').map(a => a.trim().toUpperCase()).filter(a => a);
      for (const allele of donorAlleles) {
        if (cleanedUnacceptableList.includes(allele)) {
          hasUnacceptableAntigens = true;
          if (!unacceptableAntigensDetails.some(d => d.antigen === allele && d.locus === locus)) {
             unacceptableAntigensDetails.push({ antigen: allele, locus: locus as string });
          }
        }
      }
    }
  }
  return { hasUnacceptableAntigens, unacceptableAntigensDetails };
}

// Helper function to calculate HLA matches
function calculateHLAMatches(donorHLA: HLATypingApp, recipientHLA: HLATypingApp): {
  detailedMatches: MatchDetailsInternal['hlaMatches'],
  primaryMatchCount: number, 
  totalDetailedMatchCount: number, 
  lociWithMatchCount: number 
} {
  const detailedMatches: MatchDetailsInternal['hlaMatches'] = {};
  let primaryMatchCount = 0;
  let totalDetailedMatchCount = 0;
  let lociWithMatchCount = 0;

  const loci: Array<keyof HLATypingApp> = ['hlaA', 'hlaB', 'hlaC', 'hlaDR', 'hlaDQ', 'hlaDP'];

  loci.forEach(locus => {
    const recipientAlleles = new Set((recipientHLA[locus] || '').split(',').map(a => a.trim().toUpperCase()).filter(a => a));
    const donorAlleles = new Set((donorHLA[locus] || '').split(',').map(a => a.trim().toUpperCase()).filter(a => a));
    
    const matchedAlleles: string[] = [];
    recipientAlleles.forEach(rAllele => {
      if (donorAlleles.has(rAllele)) {
        matchedAlleles.push(rAllele);
      }
    });

    detailedMatches[locus] = {
      recipientAlleles: Array.from(recipientAlleles),
      donorAlleles: Array.from(donorAlleles),
      matchedAlleles: matchedAlleles,
    };

    if (locus === 'hlaA' || locus === 'hlaB' || locus === 'hlaDR') {
        primaryMatchCount += matchedAlleles.length;
    }
    totalDetailedMatchCount += matchedAlleles.length; 

    if (matchedAlleles.length > 0) {
      lociWithMatchCount++;
    }
  });

  console.log('[matching.ts] Calculated HLA primaryMatchCount (A,B,DR):', primaryMatchCount, 'totalDetailedMatchCount (all alleles):', totalDetailedMatchCount, 'lociWithMatchCount (out of 6):', lociWithMatchCount, 'Detailed all loci:', detailedMatches);
  return { detailedMatches, primaryMatchCount, totalDetailedMatchCount, lociWithMatchCount };
}

// Check blood type compatibility
function isBloodTypeCompatible(donorTypeStr: string, recipientTypeStr: string): boolean {
  if (!donorTypeStr || !recipientTypeStr) return false;

  const parseBloodType = (typeStr: string): { abo: string; rh: string } | null => {
    const upperType = typeStr.toUpperCase().trim();
    let abo = '';
    let rh = '';

    if (upperType.endsWith('+')) {
      rh = '+';
      abo = upperType.slice(0, -1);
    } else if (upperType.endsWith('-')) {
      rh = '-';
      abo = upperType.slice(0, -1);
    } else {
      abo = upperType;
      rh = ''; // Assume compatible if not specified, or handle as error depending on policy
    }

    if (!['A', 'B', 'AB', 'O'].includes(abo)) {
      return null;
    }
    return { abo, rh };
  };

  const donor = parseBloodType(donorTypeStr);
  const recipient = parseBloodType(recipientTypeStr);

  if (!donor || !recipient) return false;

  let aboCompatible = false;
  if (recipient.abo === 'O') {
    aboCompatible = donor.abo === 'O';
  } else if (recipient.abo === 'A') {
    aboCompatible = donor.abo === 'A' || donor.abo === 'O';
  } else if (recipient.abo === 'B') {
    aboCompatible = donor.abo === 'B' || donor.abo === 'O';
  } else if (recipient.abo === 'AB') {
    aboCompatible = true;
  }

  if (!aboCompatible) return false;

  if (recipient.rh === '-') {
    if (donor.rh === '+') {
      return false;
    }
  }
  return true;
}

// Calculate overall compatibility score
function calculateCompatibilityScore(params: CompatibilityParams): number {
  console.log('[matching.ts] calculateCompatibilityScore input - params:', params);
  let score = 0;

  if (params.bloodTypeMatch) {
    score += 40;
  } else {
    return 0; 
  }

  score += params.hlaMatches * 10;

  if (params.crossmatchCompatible) {
    score += 20;
  } else {
    score -= 30;
  }
  
  return Math.max(0, Math.min(100, score));
}