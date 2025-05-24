import type { RecipientFormData, RecipientApp, HLATypingApp } from '@/types/recipient';

// Helper function to transform recipient data received from IPC to the RecipientApp type
function transformDbRecipientToApp(dbRecipient: any): RecipientApp | null {
  if (!dbRecipient) return null;

  // Default HLA typing structure with empty strings
  let hlaTyping: HLATypingApp = { hlaA: '', hlaB: '', hlaC: '', hlaDR: '', hlaDQ: '', hlaDP: '' };

  // The main process (transformDbRowToRecipient in main.cjs) should send
  // the parsed HLA data as an object under the key 'hlaTyping' (camelCase).
  if (dbRecipient.hlaTyping && typeof dbRecipient.hlaTyping === 'object') {
    const incomingHlaObject = dbRecipient.hlaTyping;
    hlaTyping = {
      hlaA: incomingHlaObject.hlaA || '', // Ensure empty string if source is null/undefined
      hlaB: incomingHlaObject.hlaB || '',
      hlaC: incomingHlaObject.hlaC || '',
      hlaDR: incomingHlaObject.hlaDR || '',
      hlaDQ: incomingHlaObject.hlaDQ || '',
      hlaDP: incomingHlaObject.hlaDP || '',
    };
  } else if (dbRecipient.hla_typing && typeof dbRecipient.hla_typing === 'string') {
    // Fallback: If main process sent raw JSON string as 'hla_typing' (snake_case)
    // This path should ideally not be taken if main.cjs is consistent.
    console.warn('[transformDbRecipientToApp] Received hla_typing as a string (fallback). Main process might have changed. Parsing it now.');
    try {
      const parsedHla = JSON.parse(dbRecipient.hla_typing);
      hlaTyping = { // Assuming parsed JSON also uses camelCase keys like "hlaA"
        hlaA: parsedHla.hlaA || '',
        hlaB: parsedHla.hlaB || '',
        hlaC: parsedHla.hlaC || '',
        hlaDR: parsedHla.hlaDR || '',
        hlaDQ: parsedHla.hlaDQ || '',
        hlaDP: parsedHla.hlaDP || '',
      };
    } catch (e) {
      console.error('[transformDbRecipientToApp] Failed to parse hla_typing string fallback:', e);
      // hlaTyping remains the default (all empty strings)
    }
  } else {
    // If HLA data is missing or in an unexpected format, log a warning.
    if (dbRecipient && typeof dbRecipient === 'object' && 'id' in dbRecipient) {
        console.warn(`[transformDbRecipientToApp] HLA data (expected as 'hlaTyping' object or 'hla_typing' string) not found or in unexpected format for recipient ID ${dbRecipient.id}. Using default empty HLA. Received:`, JSON.stringify(dbRecipient));
    } else if (dbRecipient) {
        console.warn(`[transformDbRecipientToApp] HLA data not found or in unexpected format. Input object was not a recognizable recipient. Using default empty HLA. Received:`, JSON.stringify(dbRecipient));
    }
    // hlaTyping remains the default (all empty strings)
  }

  return {
    id: dbRecipient.id,
    mrn: dbRecipient.mrn,
    nationalId: dbRecipient.national_id || dbRecipient.nationalId, // Handle both cases
    fullName: dbRecipient.full_name || dbRecipient.fullName,
    age: dbRecipient.age,
    bloodType: dbRecipient.blood_type || dbRecipient.bloodType,
    mobileNumber: dbRecipient.mobile_number || dbRecipient.mobileNumber,
    hlaTyping: hlaTyping,
    pra: dbRecipient.pra,
    crossmatchRequirement: dbRecipient.crossmatch_requirement || dbRecipient.crossmatchRequirement,
    viralScreening: dbRecipient.viral_screening || dbRecipient.viralScreening,
    cmvStatus: dbRecipient.cmv_status || dbRecipient.cmvStatus,
    
    unacceptableAntigens: (() => {
      const uaValue = dbRecipient.unacceptable_antigens || dbRecipient.unacceptableAntigens;
      if (Array.isArray(uaValue)) {
        return uaValue.map(String).filter(s => s.trim() !== ''); // Ensure strings and filter empty
      }
      if (typeof uaValue === 'string' && uaValue.trim() !== '') {
        return uaValue.split(',').map(antigen => antigen.trim()).filter(antigen => antigen !== '');
      }
      return [];
    })(),
    donorAntibodies: (() => {
      const daValue = dbRecipient.donor_antibodies || dbRecipient.donorAntibodies;
      if (Array.isArray(daValue)) {
        return daValue.map(String).filter(s => s.trim() !== ''); // Ensure strings and filter empty
      }
      if (typeof daValue === 'string' && daValue.trim() !== '') {
        return daValue.split(',').map(antibody => antibody.trim()).filter(antibody => antibody !== '');
      }
      return [];
    })(),

    medicalHistory: dbRecipient.medical_history || dbRecipient.medicalHistory,
    notes: dbRecipient.notes,
    serumCreatinine: dbRecipient.serum_creatinine || dbRecipient.serumCreatinine,
    egfr: dbRecipient.egfr,
    bloodPressure: dbRecipient.blood_pressure || dbRecipient.bloodPressure,
    // Ensure all other fields from RecipientApp are mapped or defaulted
  } as RecipientApp;
}

function handleSQLiteError(error: any): Error {
  // Basic implementation, can be expanded
  if (error instanceof Error) {
    // Check for specific SQLite constraint errors if needed
    if (error.message?.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      if (error.message.includes('recipients.mrn')) {
        return new Error('A recipient with this MRN already exists.');
      }
      if (error.message.includes('recipients.national_id')) {
        return new Error('A recipient with this National ID already exists.');
      }
      return new Error('A database constraint was violated (e.g., unique field already exists).');
    }
    return error;
  }
  return new Error(String(error) || 'An unknown error occurred');
}

// Renamed to addRecipient for consistency with other API functions, but maps to 'createRecipient' in preload
export async function addRecipient(data: RecipientFormData): Promise<RecipientApp | null> {
  if (!window.electronAPI || typeof window.electronAPI.createRecipient !== 'function') {
    console.error('[recipients.ts] Electron API for createRecipient (which addRecipient uses) is not available.');
    throw new Error('Add recipient functionality is not available at the moment.');
  }

  try {
    const dataForIPC = {
      ...data,
      mrn: data.mrn.toUpperCase(),
      nationalId: data.nationalId.toUpperCase(),
    };
    
    // Call the main process to add the recipient to the database
    const result = await window.electronAPI.createRecipient(dataForIPC);

    if (!result || !result.success || !result.id) {
      // If main process indicates failure or doesn't return an ID
      console.error('[recipients.ts] Failed to create recipient in database or result structure is unexpected:', result);
      throw new Error(result?.message || 'Failed to create recipient in the database.');
    }

    // Fetch the newly created recipient to return the full object, transformed
    const newRecipientRaw = await window.electronAPI.getRecipientById(result.id);
    if (!newRecipientRaw) {
        console.error(`[recipients.ts] Failed to fetch newly created recipient with ID: ${result.id}`);
        // Return null or throw, depending on desired strictness. Throwing is often better for operations that expect a result.
        throw new Error(`Failed to retrieve the new recipient (ID: ${result.id}) after creation.`);
    }
    
    // Transform the raw database row to the application-specific Recipient type
    return transformDbRecipientToApp(newRecipientRaw);
  } catch (error) {
    console.error('[recipients.ts] Error in addRecipient:', error);
    // Use the handleSQLiteError for consistent error handling
    throw handleSQLiteError(error);
  }
}

export const getRecipients = async (): Promise<RecipientApp[]> => {
  if (!window.electronAPI || typeof window.electronAPI.getRecipients !== 'function') {
    console.error('Electron API for getRecipients is not available.');
    return [];
  }
  try {
    const dbRecipients = await window.electronAPI.getRecipients();
    if (!Array.isArray(dbRecipients)) {
      console.error('Received non-array from getRecipients IPC call:', dbRecipients);
      return [];
    }
    return dbRecipients.map(transformDbRecipientToApp).filter(r => r !== null) as RecipientApp[];
  } catch (error) {
    console.error('Error fetching recipients via IPC:', error);
    throw error;
  }
};

export const getRecipientById = async (id: string): Promise<RecipientApp | null> => {
  if (!window.electronAPI || typeof window.electronAPI.getRecipientById !== 'function') {
    console.error('Electron API for getRecipientById is not available.');
    return null;
  }
  try {
    const dbRecipient = await window.electronAPI.getRecipientById(id);
    return transformDbRecipientToApp(dbRecipient);
  } catch (error) {
    console.error(`Error fetching recipient ${id} via IPC:`, error);
    throw error;
  }
};

export const updateRecipient = async (id: string, recipientData: Partial<RecipientFormData>): Promise<{ success: boolean; message?: string; error?: string }> => {
  if (!window.electronAPI || typeof window.electronAPI.updateRecipient !== 'function') {
    console.error('Electron API for updateRecipient is not available.');
    return { success: false, message: 'Update recipient functionality is not available.' };
  }
  try {
    const result = await window.electronAPI.updateRecipient(id, recipientData);
    return result;
  } catch (error: any) {
    console.error(`Error updating recipient ${id} via IPC:`, error);
    return { success: false, message: error.message || 'Failed to update recipient.' };
  }
};

export const deleteRecipient = async (id: string): Promise<{ success: boolean; changes: number; message?: string }> => {
  if (!window.electronAPI || typeof window.electronAPI.deleteRecipient !== 'function') {
    console.error('Electron API for deleteRecipient is not available.');
    return { success: false, changes: 0, message: 'Delete recipient functionality is not available.' };
  }
  try {
    const result = await window.electronAPI.deleteRecipient(id);
    if (typeof result.success === 'boolean' && typeof result.changes === 'number') {
      return result;
    }
    console.error('Unexpected result format from deleteRecipient IPC:', result);
    return { success: false, changes: 0, message: 'Unexpected result from delete operation.' };
  } catch (error: any) {
    console.error(`Error deleting recipient ${id} via IPC:`, error);
    return { success: false, changes: 0, message: error.message || 'Failed to delete recipient.' };
  }
};