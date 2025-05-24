const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Path to your SQLite database file
const dbPath = path.join(__dirname, 'data.sqlite');

// Function to create and open the database connection
let db;
function initializeDB() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database in main process', err.message);
    } else {
      console.log('Connected to the SQLite database in main process.');
      // You might want to ensure tables exist here as well, or rely on init-db.cjs
    }
  });
}

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // if you have a preload script
      nodeIntegration: false, // It's better to keep this false for security
      contextIsolation: true, // Protect against prototype pollution
      enableRemoteModule: false, // Turn off remote module for security
    }
  });

  // and load the index.html of the app.
  // This path assumes your React app is built into a 'dist' folder
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'dist', 'index.html'),
    protocol: 'file:',
    slashes: true
  });
  mainWindow.loadURL(startUrl);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initializeDB();
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
// Example: Handle request to get tasks
ipcMain.handle('db:get-tasks', async (event) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized.'));
    }
    db.all("SELECT * FROM tasks", [], (err, rows) => {
      if (err) {
        console.error('Error fetching tasks:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

// Handle request to insert a matching result
ipcMain.handle('db:insert-matching-result', async (event, matchData) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized.'));
    }

    const newId = matchData.id || crypto.randomUUID(); // Use provided ID or generate a new one
    const {
      recipient_id,
      donor_id,
      compatibility_score,
      match_details, // This should be a JSON string
      exclusion_reason,
      status
      // created_at will use default
    } = matchData;

    const sql = `
      INSERT INTO matching_results (
        id, recipient_id, donor_id, compatibility_score, 
        match_details, exclusion_reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure match_details is stringified if it's an object
    const detailsString = typeof match_details === 'string' ? match_details : JSON.stringify(match_details);

    db.run(sql, [
      newId,
      recipient_id,
      donor_id,
      compatibility_score,
      detailsString,
      exclusion_reason,
      status
    ], function(err) { // Use function keyword to get `this.lastID` or `this.changes`
      if (err) {
        console.error('Error inserting matching result:', err.message);
        reject(err);
      } else {
        // this.lastID is for auto-incremented INTEGER PRIMARY KEY, not UUIDs
        // this.changes tells us the number of rows affected (should be 1)
        if (this.changes > 0) {
          resolve({ success: true, id: newId, changes: this.changes });
        } else {
          reject(new Error('Failed to insert matching result, no rows changed.'));
        }
      }
    });
  });
});

ipcMain.handle('db:get-matching-results', async (event, recipientId) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized.'));
    }
    if (!recipientId) {
      return reject(new Error('Recipient ID is required.'));
    }

    const sql = "SELECT * FROM matching_results WHERE recipient_id = ?";
    db.all(sql, [recipientId], (err, rows) => {
      if (err) {
        console.error('Error fetching matching results:', err.message);
        reject(err);
      } else {
        // match_details is stored as JSON string, parse it back to an object
        const results = rows.map(row => {
          try {
            return {
              ...row,
              match_details: row.match_details ? JSON.parse(row.match_details) : null
            };
          } catch (parseError) {
            console.error('Error parsing match_details for row:', row.id, parseError);
            return { ...row, match_details: null }; // or handle error as appropriate
          }
        });
        resolve(results);
      }
    });
  });
});

ipcMain.handle('db:update-matching-result-status', async (event, { id, status }) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized.'));
    }
    if (!id || !status) {
      return reject(new Error('ID and status are required for update.'));
    }
    // Optional: Validate status value
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) { // Added 'Pending' as a valid status
        return reject(new Error('Invalid status value.'));
    }

    const sql = "UPDATE matching_results SET status = ? WHERE id = ?";
    db.run(sql, [status, id], function(err) { // Use function to get this.changes
      if (err) {
        console.error('Error updating matching result status:', err.message);
        reject(err);
      } else {
        if (this.changes > 0) {
          resolve({ success: true, id: id, changes: this.changes });
        } else {
          // Could be that the ID was not found
          resolve({ success: false, id: id, changes: 0, message: 'Matching result not found or status unchanged.' });
        }
      }
    });
  });
});

// Helper function to transform a database row to a Recipient object for the frontend
function transformDbRowToRecipient(row) {
  if (!row) {
    console.log('[transformDbRowToRecipient] Received null or undefined row');
    return null;
  }
  console.log(`[transformDbRowToRecipient] Processing row ID: ${row.id}`);

  let hlaTyping = { hlaA: '', hlaB: '', hlaC: '', hlaDR: '', hlaDQ: '', hlaDP: '' };
  console.log(`[transformDbRowToRecipient] Raw hla_typing for recipient ${row.id}:`, row.hla_typing);
  try {
    const parsedHla = JSON.parse(row.hla_typing);
    console.log(`[transformDbRowToRecipient] Parsed hla_typing for recipient ${row.id}:`, JSON.stringify(parsedHla));
    hlaTyping = {
      hlaA: parsedHla.hlaA || parsedHla.hla_a || '',
      hlaB: parsedHla.hlaB || parsedHla.hla_b || '',
      hlaC: parsedHla.hlaC || parsedHla.hla_c || '',
      hlaDR: parsedHla.hlaDR || parsedHla.hla_dr || '',
      hlaDQ: parsedHla.hlaDQ || parsedHla.hla_dq || '',
      hlaDP: parsedHla.hlaDP || parsedHla.hla_dp || ''
    };
    console.log(`[transformDbRowToRecipient] Final hlaTyping for recipient ${row.id}:`, JSON.stringify(hlaTyping));
  } catch (e) {
    console.error(`[transformDbRowToRecipient] Error parsing hla_typing for recipient ${row.id}:`, e, "Raw data:", row.hla_typing);
    hlaTyping = {}; // Default to empty object on error
  }

  // Helper to parse JSON array strings into string arrays
  const parseJsonStringToStringArray = (jsonString, fieldNameForLog = '') => {
    if (!jsonString || typeof jsonString !== 'string' || jsonString.trim() === '') {
      return [];
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item !== null && item !== undefined).map(item => String(item));
      }
      // If JSON.parse succeeded but it's not an array (e.g., a number or a simple string like "HLA-A2"),
      // we will not log a warning here anymore. We will fall through to the common splitting logic below.
    } catch (parseError) {
      // JSON.parse failed. This is expected for non-JSON strings like "A2,B7".
      // We will fall through to the common splitting logic below.
    }

    // If we reach here, jsonString was either not valid JSON, 
    // or it was valid JSON but not an array (e.g. "2" which parses to 2, or "someString" which parses to "someString").
    // In these cases, treat the original jsonString as a comma-separated list.
    // If jsonString was a number that got parsed (e.g. from "2"), String(jsonString) is needed.
    // However, jsonString is always a string here due to the initial check.
    return jsonString.split(',').map(item => item.trim()).filter(item => item !== '');
  };

  // Helper to parse potentially JSON array strings into comma-separated strings or keep as is (for fields like viral_screening)
  const parseJsonArrayStringToString = (jsonString, fieldName) => {
    if (!jsonString || typeof jsonString !== 'string') return jsonString || '';
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) return parsed.join(', ');
      return String(parsed);
    } catch (e) {
      return jsonString;
    }
  };

  return {
    id: row.id,
    mrn: row.mrn,
    nationalId: row.national_id,
    fullName: row.full_name,
    age: row.age,
    bloodType: row.blood_type,
    mobileNumber: row.mobile_number,
    hlaTyping: hlaTyping,
    pra: row.pra,
    crossmatchRequirement: row.crossmatch_requirement,
    unacceptableAntigens: parseJsonStringToStringArray(row.unacceptable_antigens, 'unacceptable_antigens'),
    donorAntibodies: parseJsonStringToStringArray(row.donor_antibodies, 'donor_antibodies'),
    viralScreening: parseJsonArrayStringToString(row.viral_screening, 'viral_screening'), 
    cmvStatus: row.cmv_status,
    medicalHistory: row.medical_history,
    notes: row.notes,
    serumCreatinine: row.serum_creatinine,
    egfr: row.egfr,
    bloodPressure: row.blood_pressure,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Add any other fields from your Recipient type, defaulting if necessary
    diagnosis: row.diagnosis || null, 
    urgency: row.urgency || null,
    // Fields from Recipient type that might not be in DB schema yet
    // hlaTypingComplete: row.hla_typing_complete || false, 
    // antibodyScreeningDone: row.antibody_screening_done || false,
    // antibodySpecificity: row.antibody_specificity || null,
  };
}

ipcMain.handle('db:get-recipient-by-id', async (event, id) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:get-recipient-by-id] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }
    if (!id) {
      console.error('[db:get-recipient-by-id] ID is required.');
      return reject(new Error('Recipient ID is required.'));
    }

    console.log(`[db:get-recipient-by-id] Fetching recipient with ID: ${id}`);
    const sql = "SELECT * FROM recipients WHERE id = ?";
    db.get(sql, [id], (err, row) => {
      if (err) {
        console.error(`[db:get-recipient-by-id] Error fetching recipient with ID ${id}:`, err.message);
        reject(err);
      } else {
        if (row) {
          console.log(`[db:get-recipient-by-id] Found recipient row for ID ${id}:`, row);
          resolve(transformDbRowToRecipient(row));
        } else {
          console.log(`[db:get-recipient-by-id] No recipient found with ID ${id}.`);
          resolve(null); // Resolve with null if no recipient is found
        }
      }
    });
  });
});

ipcMain.handle('db:get-available-donors', async () => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized.'));

    // Temporarily fetch all donors to inspect their statuses
    const sql = "SELECT * FROM donors"; 
    console.log('[main.cjs][db:get-available-donors] Executing SQL:', sql); // Log the query

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('[main.cjs][db:get-available-donors] Error fetching all donors:', err.message);
        return reject(err);
      }
      console.log('[main.cjs][db:get-available-donors] All donors fetched (before filtering by status):', 
        rows.map(r => ({ id: r.id, status: r.status, fullName: r.fullName })) // Log id, status, and name
      );

      // Original filtering logic - we'll re-apply it after logging to see what would happen
      // MODIFIED: Include donors where status is null as available
      const availableDonors = rows.filter(row => row.status === 'Available' || row.status === null).map(row => {
        let parsedDonorAntibodies = null;
        if (row.donorAntibodies) { 
          try {
            parsedDonorAntibodies = JSON.parse(row.donorAntibodies);
          } catch (parseError) {
            console.warn(`[main.cjs][db:get-available-donors] Error parsing donorAntibodies JSON for donor ${row.id}:`, parseError.message, "Raw value:", row.donorAntibodies);
            parsedDonorAntibodies = { error: 'Failed to parse donorAntibodies', raw: row.donorAntibodies }; 
          }
        }
        return {
          ...row, 
          donorAntibodies: parsedDonorAntibodies,
        };
      });
      console.log('[main.cjs][db:get-available-donors] Donors after filtering for status = \'Available\':', availableDonors.length);
      resolve(availableDonors); 
    });
  });
});

ipcMain.handle('db:add-donor', async (event, donorData) => {
  console.log('Received donor data in main.cjs:', donorData);

  if (!db) {
    console.error('Database not initialized before adding donor.');
    // Throwing an error here will cause the promise returned by ipcMain.handle to reject.
    throw new Error('Database not initialized.');
  }

  const { 
    mrn, nationalId, fullName, age, bloodType, donorAntibodies, 
    highResTyping, hlaA, hlaB, hlaC, hlaDR, hlaDQ, hlaDP, 
    viralScreening, cmvStatus, bloodPressure, serumCreatinine, egfr, 
    medicalConditions, crossmatchResult, antigenMismatch, mobileNumber, notes 
  } = donorData;

  let donorAntibodiesString = donorData.donorAntibodies;
  if (typeof donorData.donorAntibodies === 'object' && donorData.donorAntibodies !== null) {
    try {
      donorAntibodiesString = JSON.stringify(donorData.donorAntibodies);
    } catch (e) {
      console.error('Error stringifying donorAntibodies:', e);
      throw new Error('Failed to stringify donorAntibodies');
    }
  } else if (typeof donorData.donorAntibodies === 'undefined') {
    donorAntibodiesString = null; 
  }

  const params = [
    mrn, nationalId, fullName, age, bloodType, donorAntibodiesString, 
    highResTyping, hlaA, hlaB, hlaC, hlaDR, hlaDQ, hlaDP, 
    viralScreening, cmvStatus, bloodPressure, serumCreatinine, egfr, 
    medicalConditions, crossmatchResult, antigenMismatch, mobileNumber, notes
  ];

  console.log('Parameters for SQL:', params);

  const sql = `INSERT INTO donors (
    mrn, nationalId, fullName, age, bloodType, donorAntibodies, 
    highResTyping, hlaA, hlaB, hlaC, hlaDR, hlaDQ, hlaDP, 
    viralScreening, cmvStatus, bloodPressure, serumCreatinine, egfr, 
    medicalConditions, crossmatchResult, antigenMismatch, mobileNumber, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  console.log('SQL Query:', sql);

  try {
    console.log('[db:add-donor] Attempting to run db.run...');
    const result = await new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          console.error('[db:add-donor] Error callback from db.run:', err.message);
          reject(err); // Reject the promise if db.run reports an error
        } else {
          console.log(`[db:add-donor] Success callback from db.run. Donor added with ID: ${this.lastID}`);
          resolve({ success: true, id: this.lastID, changes: this.changes }); // Resolve with success
        }
      });
    });
    console.log('[db:add-donor] db.run Promise resolved successfully:', result);
    return result; // Return the resolved value to the IPC caller
  } catch (error) {
    // This catch block will handle rejections from the new Promise (e.g., if reject(err) was called)
    console.error('[db:add-donor] Error caught after awaiting db.run Promise:', error.message);
    // Re-throw the error to ensure the IPC call promise rejects, sending error to frontend.
    throw error; 
  }
});

// Get all donors
ipcMain.handle('db:get-donors', async () => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized.'));
    // Reverting to createdAt as per init-db.cjs schema
    db.all("SELECT * FROM donors ORDER BY createdAt DESC", [], (err, rows) => {
      if (err) {
        console.error('Error fetching donors:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db:get-donor-by-id', async (event, receivedId) => {
  return new Promise((resolve, reject) => {
    console.log(`[db:get-donor-by-id] Handler invoked. Received ID: "${receivedId}", Type: ${typeof receivedId}`);
    if (!db) {
      console.error('[db:get-donor-by-id] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }
    if (!receivedId) { 
        console.error(`[db:get-donor-by-id] Invalid or missing Donor ID. Received: "${receivedId}"`);
        return reject(new Error('Donor ID is required.'));
    }

    // Ensure the ID is an integer for the SQL query, as URL params are strings
    const queryId = parseInt(receivedId, 10); 
    if (isNaN(queryId)) {
        console.error(`[db:get-donor-by-id] Parsed ID is NaN. Original was: "${receivedId}"`);
        return reject(new Error('Parsed Donor ID is not a valid number.'));
    }
    console.log(`[db:get-donor-by-id] Querying database with parsed ID: ${queryId} (type: ${typeof queryId})`);

    db.get("SELECT * FROM donors WHERE id = ?", [queryId], (err, row) => {
      if (err) {
        console.error('[db:get-donor-by-id] SQL Error fetching donor by ID:', err.message);
        reject(err);
      } else {
        if (row) {
          console.log(`[db:get-donor-by-id] Row found for ID ${queryId}:`, row);
        } else {
          console.warn(`[db:get-donor-by-id] No row found for ID ${queryId}.`);
        }
        resolve(row || null);
      }
    });
  });
});

ipcMain.handle('db:update-donor', async (event, id, donorData) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized.'));
    if (!id) return reject(new Error('Donor ID is required for update.'));

    const now = new Date().toISOString();
    const {
      mrn, nationalId, fullName, age, bloodType, mobileNumber,
      hlaA, hlaB, hlaC, hlaDR, hlaDQ, hlaDP,
      highResTyping, donorAntibodies, antigenMismatch, crossmatchResult,
      serumCreatinine, egfr, bloodPressure, viralScreening, cmvStatus,
      medicalConditions, notes, status
    } = donorData;

    // Construct SET clauses dynamically based on provided fields if needed, or list all
    const sql = `UPDATE donors SET
      mrn = ?, nationalId = ?, fullName = ?, age = ?, bloodType = ?, mobileNumber = ?,
      hlaA = ?, hlaB = ?, hlaC = ?, hlaDR = ?, hlaDQ = ?, hlaDP = ?,
      highResTyping = ?, donorAntibodies = ?, antigenMismatch = ?, crossmatchResult = ?,
      serumCreatinine = ?, egfr = ?, bloodPressure = ?, viralScreening = ?, cmvStatus = ?,
      medicalConditions = ?, notes = ?, status = ?, updatedAt = ?
      WHERE id = ?`;

    const params = [
      mrn, nationalId, fullName, age, bloodType, mobileNumber,
      hlaA, hlaB, hlaC, hlaDR, hlaDQ, hlaDP,
      highResTyping, donorAntibodies, antigenMismatch, crossmatchResult,
      serumCreatinine, egfr, bloodPressure, viralScreening, cmvStatus,
      medicalConditions, notes, status, now, id
    ];

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error updating donor:', err.message);
        reject(err);
      } else {
        resolve({ success: true, id: id, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('db:delete-donor', async (event, id) => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized.'));
    if (!id) return reject(new Error('Donor ID is required for deletion.'));

    db.run("DELETE FROM donors WHERE id = ?", [id], function(err) {
      if (err) {
        console.error('Error deleting donor:', err.message);
        reject(err);
      } else {
        resolve({ success: true, id: id, changes: this.changes });
      }
    });
  });
});

// == Dashboard IPC Handlers ==

// Get total donor count
ipcMain.handle('db:get-donor-count', async () => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized.'));
    const sql = "SELECT COUNT(*) as count FROM donors";
    db.get(sql, [], (err, row) => {
      if (err) {
        console.error('Error fetching donor count:', err.message);
        return reject(err);
      }
      resolve(row.count);
    });
  });
});

// Get total recipient count
ipcMain.handle('db:get-recipient-count', async () => {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized for recipient count.'));
    db.get("SELECT COUNT(*) as count FROM recipients", [], (err, row) => {
      if (err) {
        console.error('Error fetching recipient count:', err.message);
        reject(err);
      } else {
        console.log('Recipient count fetched:', row.count);
        resolve(row.count);
      }
    });
  });
});

ipcMain.handle('db:get-recipients', async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:get-recipients] Database not initialized.');
      return reject(new Error('Database not initialized for getRecipients.'));
    }
    db.all("SELECT * FROM recipients ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error('[db:get-recipients] Error fetching recipients:', err.message);
        reject(err);
      } else {
        console.log(`[db:get-recipients] Fetched ${rows.length} rows.`);
        const transformedRecipients = rows.map(row => transformDbRowToRecipient(row));
        resolve(transformedRecipients);
      }
    });
  });
});

// IPC handler for getting all matching results statuses
ipcMain.handle('db:get-all-matching-results-status', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, status FROM matching_results ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error('Error fetching matching results statuses:', err.message);
        reject(new Error('Failed to fetch matching results statuses'));
      } else {
        resolve(rows || []);
      }
    });
  });
});

// IPC handler to get recent donors
ipcMain.handle('db:get-recent-donors', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, fullName, createdAt FROM donors ORDER BY createdAt DESC LIMIT 5", [], (err, rows) => {
      if (err) {
        console.error('Error fetching recent donors:', err.message);
        reject(new Error('Failed to fetch recent donors'));
      } else {
        resolve(rows || []);
      }
    });
  });
});

// Get recent matches with recipient name
ipcMain.handle('db:get-recent-matches', async () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mr.id, 
        mr.status, 
        mr.created_at, 
        r.full_name as recipient_full_name 
      FROM matching_results mr
      JOIN recipients r ON mr.recipient_id = r.id
      ORDER BY mr.created_at DESC LIMIT 5
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Error fetching recent matches:', err.message);
        reject(new Error('Failed to fetch recent matches'));
      } else {
        resolve(rows || []);
      }
    });
  });
});

ipcMain.handle('db:add-recipient', async (event, recipientData) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:add-recipient] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }

    console.log('[db:add-recipient] Received data for new recipient:', recipientData);

    // Helper to stringify if it's an object, otherwise use as is (or null if undefined)
    const ensureStringOrNull = (value) => {
      if (typeof value === 'object' && value !== null) return JSON.stringify(value);
      return value !== undefined ? value : null;
    };

    // Construct Hla object for hla_typing
    const hlaObject = {
      hlaA: recipientData.hlaA || '',
      hlaB: recipientData.hlaB || '',
      hlaC: recipientData.hlaC || '',
      hlaDR: recipientData.hlaDR || '',
      hlaDQ: recipientData.hlaDQ || '',
      hlaDP: recipientData.hlaDP || '',
    };

    const params = {
      $mrn: recipientData.mrn,
      $national_id: recipientData.nationalId,
      $full_name: recipientData.fullName,
      $age: recipientData.age,
      $blood_type: recipientData.bloodType,
      $mobile_number: recipientData.mobileNumber,
      $hla_typing: JSON.stringify(hlaObject), // Correctly stringify the constructed Hla object
      $pra: recipientData.pra,
      $crossmatch_requirement: recipientData.crossmatchRequirement,
      $unacceptable_antigens: ensureStringOrNull(recipientData.unacceptableAntigens),
      $donor_antibodies: ensureStringOrNull(recipientData.donorAntibodies),
      $serum_creatinine: recipientData.serumCreatinine,
      $egfr: recipientData.egfr,
      $blood_pressure: recipientData.bloodPressure,
      $viral_screening: ensureStringOrNull(recipientData.viralScreening),
      $cmv_status: recipientData.cmvStatus,
      $medical_history: recipientData.medicalHistory,
      $notes: recipientData.notes,
    };

    const sql = `INSERT INTO recipients (
      mrn, national_id, full_name, age, blood_type, mobile_number, hla_typing, pra, 
      crossmatch_requirement, unacceptable_antigens, donor_antibodies, serum_creatinine, 
      egfr, blood_pressure, viral_screening, cmv_status, medical_history, notes
    ) VALUES (
      $mrn, $national_id, $full_name, $age, $blood_type, $mobile_number, $hla_typing, $pra, 
      $crossmatch_requirement, $unacceptable_antigens, $donor_antibodies, $serum_creatinine, 
      $egfr, $blood_pressure, $viral_screening, $cmv_status, $medical_history, $notes
    )`;

    console.log('[db:add-recipient] Executing SQL:', sql);
    console.log('[db:add-recipient] With parameters:', params);

    db.run(sql, params, function (err) {
      if (err) {
        console.error('[db:add-recipient] SQL Error inserting recipient:', err.message);
        if (err.message.includes('UNIQUE constraint failed: recipients.mrn')) {
          return reject(new Error('A recipient with this MRN already exists.'));
        }
        if (err.message.includes('UNIQUE constraint failed: recipients.national_id')) {
          return reject(new Error('A recipient with this National ID already exists.'));
        }
        return reject(err);
      } else {
        const newRecipientId = this.lastID;
        console.log(`[db:add-recipient] New recipient inserted with ID: ${newRecipientId}`);
        // Resolve with success status and the new ID
        // The frontend will then fetch the full recipient details using this ID
        resolve({ success: true, id: newRecipientId, message: 'Recipient added successfully.' });
      }
    });
  });
});

ipcMain.handle('db:update-recipient', async (event, id, recipientData) => {
  console.log(`[db:update-recipient] Handler invoked. Arguments received: event=${!!event}, id=${JSON.stringify(id)}, recipientData=${JSON.stringify(recipientData)}`);
  // console.log('[db:update-recipient] Full arguments object:', arguments); // 'arguments' is less safe with async/await, direct params are better

  if (!id) {
    console.error('[db:update-recipient] Recipient ID is required for update. ID received:', id);
    throw new Error('Recipient ID is required for update.');
  }
  if (!recipientData || Object.keys(recipientData).length === 0) {
    console.warn('[db:update-recipient] No data provided for update for ID:', id);
    // Depending on desired behavior, you might fetch and return the recipient as is, or throw an error.
    // For now, throwing an error as it's likely an unintended call or missing data.
    throw new Error('No data provided for recipient update.');
  }

  console.log(`[db:update-recipient] Updating recipient ID: ${id} with data:`, recipientData);

  const fieldMappings = {
    mrn: 'mrn',
    nationalId: 'national_id',
    fullName: 'full_name',
    age: 'age',
    bloodType: 'blood_type',
    mobileNumber: 'mobile_number',
    // hlaTyping is handled separately
    pra: 'pra',
    crossmatchRequirement: 'crossmatch_requirement',
    unacceptableAntigens: 'unacceptable_antigens',
    donorAntibodies: 'donor_antibodies',
    serumCreatinine: 'serum_creatinine',
    egfr: 'egfr',
    bloodPressure: 'blood_pressure',
    viralScreening: 'viral_screening',
    cmvStatus: 'cmv_status',
    medicalHistory: 'medical_history',
    notes: 'notes',
    diagnosis: 'diagnosis',
    urgency: 'urgency'
  };

  const setClauses = [];
  const params = [];

  // Check for HLA fields and construct hla_typing if any are present
  const hlaFieldsFromData = {
    hlaA: recipientData.hlaA,
    hlaB: recipientData.hlaB,
    hlaC: recipientData.hlaC,
    hlaDR: recipientData.hlaDR,
    hlaDQ: recipientData.hlaDQ,
    hlaDP: recipientData.hlaDP,
  };

  // Only create hlaUpdateObject if at least one HLA field is provided in recipientData
  const hlaKeysPresent = Object.keys(hlaFieldsFromData).filter(key => hlaFieldsFromData[key] !== undefined);

  if (hlaKeysPresent.length > 0) {
    const hlaUpdateObject = {};
    hlaKeysPresent.forEach(key => {
      hlaUpdateObject[key] = hlaFieldsFromData[key] || ''; // Default to empty string if undefined after check
    });
    setClauses.push('hla_typing = ?');
    params.push(JSON.stringify(hlaUpdateObject));
  }

  for (const key in recipientData) {
    // Skip individual HLA fields as they are handled by hla_typing
    if (['hlaA', 'hlaB', 'hlaC', 'hlaDR', 'hlaDQ', 'hlaDP'].includes(key)) {
      continue;
    }

    if (recipientData.hasOwnProperty(key) && fieldMappings[key]) {
      const dbField = fieldMappings[key];
      let value = recipientData[key];

      // Stringify if it's an object (for unacceptableAntigens, donorAntibodies, viralScreening)
      if (['unacceptableAntigens', 'donorAntibodies', 'viralScreening'].includes(key)) {
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        } else if (value === undefined || value === null) {
          value = null;
        }
      }
      setClauses.push(`${dbField} = ?`);
      params.push(value);
    }
  }

  if (setClauses.length === 0) {
    console.warn('[db:update-recipient] No valid fields to update for ID:', id);
    throw new Error('No valid fields provided for update.');
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id); // For the WHERE clause

  const sql = `UPDATE recipients SET ${setClauses.join(', ')} WHERE id = ?`;
  console.log('[db:update-recipient] Executing SQL:', sql, 'with params:', params);

  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:update-recipient] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }
    db.run(sql, params, function(err) {
      if (err) {
        console.error(`[db:update-recipient] SQL Error updating recipient ID ${id}:`, err.message);
        reject(err);
      } else {
        if (this.changes === 0) {
          console.warn(`[db:update-recipient] No recipient found with ID ${id} to update, or data was the same.`);
          resolve(null); 
        }
        console.log(`[db:update-recipient] Recipient ID ${id} updated successfully. Changes: ${this.changes}`);
        db.get("SELECT * FROM recipients WHERE id = ?", [id], (fetchErr, row) => {
          if (fetchErr) {
            console.error(`[db:update-recipient] Error fetching updated recipient ID ${id}:`, fetchErr.message);
            return reject(fetchErr);
          }
          if (row) {
            resolve(transformDbRowToRecipient(row));
          } else {
            console.error(`[db:update-recipient] Failed to fetch updated recipient ID ${id} despite successful update.`);
            resolve(null); 
          }
        });
      }
    });
  });
});

ipcMain.handle('db:delete-recipient', async (event, id) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:delete-recipient] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }
    if (!id) {
      console.error('[db:delete-recipient] Recipient ID is required for deletion.');
      return reject(new Error('Recipient ID is required for deletion.'));
    }

    console.log(`[db:delete-recipient] Deleting recipient with ID: ${id}`);
    const sql = "DELETE FROM recipients WHERE id = ?";

    db.run(sql, [id], function(err) {
      if (err) {
        console.error(`[db:delete-recipient] SQL Error deleting recipient ID ${id}:`, err.message);
        reject(err);
      } else {
        if (this.changes === 0) {
          console.warn(`[db:delete-recipient] No recipient found with ID ${id} to delete.`);
          // Indicate no changes but not necessarily an error in the operation itself
          resolve({ success: false, changes: 0, message: 'Recipient not found.' });
        } else {
          console.log(`[db:delete-recipient] Recipient ID ${id} deleted successfully. Changes: ${this.changes}`);
          resolve({ success: true, changes: this.changes });
        }
      }
    });
  });
});

// Helper function to transform a database row to a Donor object for the frontend
function transformDbRowToDonor(row) {
  if (!row) return null;
  console.log(`[transformDbRowToDonor] Processing row ID: ${row.id}`);
  // Ensure all expected fields are present and parsed correctly
  // Especially JSON string fields like hla_typing, donor_specific_antibodies, dsa_result
  const donor = {
    id: row.id,
    nationalId: row.national_id,
    fullName: row.full_name,
    age: row.age,
    bloodType: row.blood_type,
    mobileNumber: row.mobile_number,
    address: row.address,
    weight: row.weight,
    height: row.height,
    bmi: row.bmi,
    kinship: row.kinship,
    kinshipName: row.kinship_name,
    kinshipMobile: row.kinship_mobile,
    medicalHistory: row.medical_history,
    surgicalHistory: row.surgical_history,
    medications: row.medications,
    allergies: row.allergies,
    socialHistory: row.social_history,
    familyHistory: row.family_history,
    viralScreening: row.viral_screening,
    cmvStatus: row.cmv_status,
    chestXRay: row.chest_x_ray,
    ecg: row.ecg,
    echo: row.echo,
    abdominalUs: row.abdominal_us,
    renalUsDoppler: row.renal_us_doppler,
    ctAngio: row.ct_angio,
    urineAnalysis: row.urine_analysis,
    serumCreatinine: row.serum_creatinine,
    egfr: row.egfr,
    bloodPressure: row.blood_pressure,
    crossmatchResult: row.crossmatch_result, // Actual crossmatch result string
    notes: row.notes,
    status: row.status, // e.g., 'Available', 'Unavailable'
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  console.log(`[transformDbRowToDonor] Raw hla_typing for donor ${row.id}:`, row.hla_typing);
  try {
    donor.hlaTyping = row.hla_typing ? JSON.parse(row.hla_typing) : {};
    console.log(`[transformDbRowToDonor] Parsed hla_typing for donor ${row.id}:`, JSON.stringify(donor.hlaTyping));
  } catch (e) {
    console.error(`[transformDbRowToDonor] Error parsing hla_typing for donor ${row.id}:`, e, "Raw data:", row.hla_typing);
    donor.hlaTyping = {}; // Default to empty object on error
  }

  try {
    // Assuming donor_specific_antibodies might be stored as a JSON string array or similar
    donor.donorSpecificAntibodies = row.donor_specific_antibodies ? JSON.parse(row.donor_specific_antibodies) : [];
  } catch (e) {
    console.error(`[transformDbRowToDonor] Error parsing donor_specific_antibodies for donor ${row.id}:`, e, "Raw data:", row.donor_specific_antibodies);
    donor.donorSpecificAntibodies = [];
  }

  try {
    // dsa_result is expected to be an object like { detected: boolean, specificities: string, strength: string }
    donor.dsaResult = row.dsa_result ? JSON.parse(row.dsa_result) : { detected: false, specificities: '', strength: '' };
  } catch (e) {
    console.error(`[transformDbRowToDonor] Error parsing dsa_result for donor ${row.id}:`, e, "Raw data:", row.dsa_result);
    donor.dsaResult = { detected: false, specificities: '', strength: '' };
  }
  
  // Ensure all HLATypingApp fields are at least empty strings if not present after parse
  const hlaFields = ['hlaA', 'hlaB', 'hlaC', 'hlaDR', 'hlaDQ', 'hlaDP'];
  donor.hlaTyping = donor.hlaTyping || {}; // Ensure hlaTyping itself is an object
  hlaFields.forEach(field => {
    if (typeof donor.hlaTyping[field] !== 'string') {
        // If the field is missing or not a string, initialize to empty string
        // This handles cases where JSON.parse might result in undefined or non-string types for some loci
        donor.hlaTyping[field] = ''; 
    }
  });
  console.log(`[transformDbRowToDonor] Final hlaTyping for donor ${row.id}:`, JSON.stringify(donor.hlaTyping));

  return donor;
}

ipcMain.handle('db:get-available-donors', async () => {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[db:get-available-donors] Database not initialized.');
      return reject(new Error('Database not initialized.'));
    }

    const sql = "SELECT * FROM donors WHERE status = 'Available'";
    console.log('[main.cjs][db:get-available-donors] Executing SQL:', sql);

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('[db:get-available-donors] Error fetching available donors:', err.message);
        reject(err);
      } else {
        console.log(`[db:get-available-donors] Fetched ${rows.length} rows with status 'Available'.`);
        const availableDonors = rows.map(row => transformDbRowToDonor(row)).filter(donor => donor !== null);
        console.log(`[db:get-available-donors] Transformed ${availableDonors.length} donors.`);
        resolve(availableDonors);
      }
    });
  });
});

// Gracefully close the database on app quit
app.on('will-quit', () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
    });
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
