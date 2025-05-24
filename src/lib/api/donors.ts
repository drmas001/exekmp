import type { DonorFormData } from '@/types/donor';
import type { DonorApp as Donor } from '@/types/donor';
import type { HLATypingApp as HLATyping } from '@/types/recipient';

// Helper function to transform database donor data (flat HLA) to the application's Donor type (nested hlaTyping)
function transformDonorData(dbDonor: any): Donor | null {
  if (!dbDonor) return null;

  // Basic transformation for fields like id, mrn, etc.
  const donorApp: Partial<Donor> = {
    id: dbDonor.id,
    mrn: dbDonor.mrn,
    nationalId: dbDonor.nationalId,
    fullName: dbDonor.fullName,
    age: dbDonor.age,
    bloodType: dbDonor.bloodType,
    mobileNumber: dbDonor.mobileNumber,
    crossmatchResult: dbDonor.crossmatchResult,
    serumCreatinine: dbDonor.serumCreatinine,
    egfr: dbDonor.egfr,
    bloodPressure: dbDonor.bloodPressure,
    viralScreening: dbDonor.viralScreening,
    cmvStatus: dbDonor.cmvStatus,
    medicalConditions: dbDonor.medicalConditions,
    notes: dbDonor.notes,
    highResTyping: dbDonor.highResTyping,
    antigenMismatch: dbDonor.antigenMismatch,
    status: dbDonor.status || 'Available', // Default status if not provided
  };

  // Construct hlaTyping object from individual HLA fields in dbDonor
  donorApp.hlaTyping = {
    hlaA: dbDonor.hlaA || '',
    hlaB: dbDonor.hlaB || '',
    hlaC: dbDonor.hlaC || '',
    hlaDR: dbDonor.hlaDR || '',
    hlaDQ: dbDonor.hlaDQ || '',
    hlaDP: dbDonor.hlaDP || '',
  };

  // Transform donor_antibodies (assuming JSON string of array)
  if (dbDonor.donorAntibodies && typeof dbDonor.donorAntibodies === 'string') {
    try {
      const antibodies = JSON.parse(dbDonor.donorAntibodies);
      donorApp.donorAntibodies = Array.isArray(antibodies) ? antibodies.map(String) : [];
    } catch (error) {
      console.error('Failed to parse donor_antibodies for donor:', dbDonor.id, error);
      donorApp.donorAntibodies = [];
    }
  } else if (Array.isArray(dbDonor.donorAntibodies)) {
    donorApp.donorAntibodies = dbDonor.donorAntibodies.map(String);
  } else {
    donorApp.donorAntibodies = [];
  }

  // Transform dsa_result
  if (dbDonor.dsaResult && typeof dbDonor.dsaResult === 'string') {
    try {
      const dsa = JSON.parse(dbDonor.dsaResult);
      donorApp.dsaResult = {
        detected: !!dsa.detected,
        specificities: dsa.specificities || '',
        strength: dsa.strength || '',
      };
    } catch (error) {
      console.error('Failed to parse dsa_result for donor:', dbDonor.id, error);
      donorApp.dsaResult = { detected: false, specificities: '', strength: '' };
    }
  } else if (dbDonor.dsaResult && typeof dbDonor.dsaResult === 'object'){
    const dsaSource = dbDonor.dsaResult;
    donorApp.dsaResult = {
      detected: !!dsaSource.detected,
      specificities: dsaSource.specificities || '',
      strength: dsaSource.strength || '',
    };
  } else {
    donorApp.dsaResult = { detected: false, specificities: '', strength: '' };
  }
  
  // isDsaDetected can be derived from dsaResult.detected
  donorApp.isDsaDetected = donorApp.dsaResult.detected;

  return donorApp as Donor;
}

function handleSQLiteError(error: any): Error {
  if (error instanceof Error) {
    if (error.message?.includes('SQLITE_CONSTRAINT')) {
      if (error.message.includes('donors.nationalId')) {
        return new Error('A donor with this National ID already exists');
      }
      if (error.message.includes('donors.mrn')) {
        return new Error('A donor with this MRN already exists');
      }
      return new Error('A database constraint was violated.');
    }
    return error;
  }
  return new Error('An unknown error occurred');
}

export async function createDonor(data: DonorFormData): Promise<Donor | null> {
  try {
    const dataForIPC = {
      ...data,
      mrn: data.mrn.toUpperCase(),
      nationalId: data.nationalId.toUpperCase(),
      status: 'Available', // Default status for new donors
    };
    const result = await window.electronAPI.addDonor(dataForIPC);
    if (!result || !result.success || !result.id) {
      throw new Error('Failed to create donor in database.');
    }
    // Fetch the newly created donor to return the full object
    const newDonorRaw = await window.electronAPI.getDonorById(result.id);
    return transformDonorData(newDonorRaw);
  } catch (error) {
    throw handleSQLiteError(error);
  }
}

export async function getDonors(): Promise<Donor[]> {
  try {
    const donorsRaw = await window.electronAPI.getDonors();
    if (!donorsRaw) return [];
    return donorsRaw.map(transformDonorData).filter((d: Donor | null) => d !== null) as Donor[];
  } catch (error) {
    console.error('Error fetching donors:', error);
    throw new Error('Failed to fetch donors');
  }
}

export async function getDonor(id: string): Promise<Donor | null> {
  try {
    const donorRaw = await window.electronAPI.getDonorById(id);
    return transformDonorData(donorRaw);
  } catch (error) {
    console.error(`Error fetching donor ${id}:`, error);
    throw new Error('Failed to fetch donor');
  }
}

export async function updateDonor(id: string, updates: Partial<DonorFormData & { status?: 'Available' | 'Utilized' }>): Promise<Donor | null> {
  try {
    const currentDonorRaw = await window.electronAPI.getDonorById(id);
    if (!currentDonorRaw) {
      throw new Error('Donor not found for update.');
    }

    // Prepare the full data object for the IPC call, merging updates
    const dataForIPC = {
      mrn: updates.mrn !== undefined ? updates.mrn.trim().toUpperCase() : currentDonorRaw.mrn,
      nationalId: updates.nationalId !== undefined ? updates.nationalId.trim().toUpperCase() : currentDonorRaw.nationalId,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : currentDonorRaw.fullName,
      age: updates.age !== undefined ? updates.age : currentDonorRaw.age,
      bloodType: updates.bloodType !== undefined ? updates.bloodType : currentDonorRaw.bloodType,
      mobileNumber: updates.mobileNumber !== undefined ? updates.mobileNumber.trim() : currentDonorRaw.mobileNumber,
      hlaA: updates.hlaA !== undefined ? updates.hlaA.trim() : currentDonorRaw.hlaA,
      hlaB: updates.hlaB !== undefined ? updates.hlaB.trim() : currentDonorRaw.hlaB,
      hlaC: updates.hlaC !== undefined ? updates.hlaC.trim() : currentDonorRaw.hlaC,
      hlaDR: updates.hlaDR !== undefined ? updates.hlaDR.trim() : currentDonorRaw.hlaDR,
      hlaDQ: updates.hlaDQ !== undefined ? updates.hlaDQ.trim() : currentDonorRaw.hlaDQ,
      hlaDP: updates.hlaDP !== undefined ? updates.hlaDP.trim() : currentDonorRaw.hlaDP,
      highResTyping: updates.highResTyping !== undefined ? updates.highResTyping.trim() : currentDonorRaw.highResTyping,
      donorAntibodies: updates.donorAntibodies !== undefined ? updates.donorAntibodies.trim() : currentDonorRaw.donorAntibodies,
      antigenMismatch: updates.antigenMismatch !== undefined ? updates.antigenMismatch : currentDonorRaw.antigenMismatch,
      crossmatchResult: updates.crossmatchResult !== undefined ? updates.crossmatchResult : currentDonorRaw.crossmatchResult,
      serumCreatinine: updates.serumCreatinine !== undefined ? updates.serumCreatinine : currentDonorRaw.serumCreatinine,
      egfr: updates.egfr !== undefined ? updates.egfr : currentDonorRaw.egfr,
      bloodPressure: updates.bloodPressure !== undefined ? updates.bloodPressure.trim() : currentDonorRaw.bloodPressure,
      viralScreening: updates.viralScreening !== undefined ? updates.viralScreening.trim() : currentDonorRaw.viralScreening,
      cmvStatus: updates.cmvStatus !== undefined ? updates.cmvStatus : currentDonorRaw.cmvStatus,
      medicalConditions: updates.medicalConditions !== undefined ? updates.medicalConditions.trim() : currentDonorRaw.medicalConditions,
      notes: updates.notes !== undefined ? updates.notes.trim() : currentDonorRaw.notes,
      status: updates.status !== undefined ? updates.status : currentDonorRaw.status,
    };

    const result = await window.electronAPI.updateDonor(id, dataForIPC);
    if (!result || !result.success || result.changes === 0) {
      // This could also mean the data was identical and no changes were made by SQLite.
      // For now, we assume a change was expected if the call was made.
      // Consider if 'no changes' should still fetch and return data.
      console.warn('Update donor IPC call reported no changes or failed for ID:', id);
    }

    const updatedDonorRaw = await window.electronAPI.getDonorById(id);
    return transformDonorData(updatedDonorRaw);
  } catch (error) {
    throw handleSQLiteError(error);
  }
}

export async function deleteDonor(id: string): Promise<void> {
  try {
    const result = await window.electronAPI.deleteDonor(id);
    if (!result || !result.success || result.changes === 0) {
      throw new Error('Failed to delete donor or donor not found.');
    }
  } catch (error) {
    console.error(`Error deleting donor ${id}:`, error);
    throw new Error('Failed to delete donor');
  }
}

export async function updateDonorStatus(id: string, status: 'Available' | 'Utilized'): Promise<Donor | null> {
  // This function now uses the general updateDonor, passing only the status field.
  // The updateDonor function is responsible for fetching current data and merging.
  return updateDonor(id, { status });
}