// scripts/init-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database file
const dbPath = path.resolve(__dirname, '../data.sqlite');

// Connect to the SQLite database
// The database will be created if it doesn't exist
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  db.serialize(() => {
    // Create 'tasks' table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        is_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating tasks table:', err.message);
      } else {
        console.log('Table "tasks" created or already exists.');
      }

      // Create 'employees' table (nested to ensure it runs after tasks attempt)
      db.run(`
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          fullName TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT CHECK(role IN ('Doctor', 'Nurse', 'Administrator')) NOT NULL,
          employee_code TEXT UNIQUE NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastActive DATETIME
        )
      `, (err) => {
        if (err) {
          console.error('Error creating employees table:', err.message);
        } else {
          console.log('Table "employees" created or already exists.');
        }

        // Create 'donors' table
        db.run(`
          CREATE TABLE IF NOT EXISTS donors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mrn TEXT UNIQUE NOT NULL,
            nationalId TEXT UNIQUE NOT NULL,
            fullName TEXT NOT NULL,
            age INTEGER,
            bloodType TEXT,
            mobileNumber TEXT,
            hlaA TEXT,
            hlaB TEXT,
            hlaC TEXT,
            hlaDR TEXT,
            hlaDQ TEXT,
            hlaDP TEXT,
            highResTyping TEXT,
            donorAntibodies TEXT,
            antigenMismatch INTEGER,
            crossmatchResult TEXT,
            serumCreatinine REAL,
            egfr REAL,
            bloodPressure TEXT,
            viralScreening TEXT,
            cmvStatus TEXT,
            medicalConditions TEXT,
            notes TEXT,
            status TEXT, -- e.g., 'Available', 'Utilized'
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME
          )
        `, (err) => {
          if (err) {
            console.error('Error creating donors table:', err.message);
          } else {
            console.log('Table "donors" created or already exists.');
          }

          // Create 'matching_results' table (nested)
          db.run(`
            CREATE TABLE IF NOT EXISTS matching_results (
              id TEXT PRIMARY KEY,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              recipient_id TEXT,
              donor_id TEXT,
              compatibility_score REAL,
              match_details TEXT,
              exclusion_reason TEXT,
              status TEXT
            )
          `, (err) => {
            if (err) {
              console.error('Error creating matching_results table:', err.message);
            } else {
              console.log('Table "matching_results" created or already exists.');
            }

            // Create 'recipients' table (nested)
            db.run(`
              CREATE TABLE IF NOT EXISTS recipients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mrn TEXT UNIQUE NOT NULL,
                national_id TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                age INTEGER,
                blood_type TEXT,
                mobile_number TEXT,
                hla_typing TEXT, -- JSON string for HLA types
                pra REAL DEFAULT 0,
                crossmatch_requirement TEXT,
                viral_screening TEXT, -- Could be JSON string
                cmv_status TEXT,
                unacceptable_antigens TEXT, -- JSON array string
                donor_antibodies TEXT, -- JSON array string
                medical_history TEXT,
                notes TEXT,
                serum_creatinine REAL DEFAULT 0,
                egfr REAL DEFAULT 0,
                blood_pressure TEXT DEFAULT 'N/A',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                console.error('Error creating recipients table:', err.message);
              } else {
                console.log('Table "recipients" created or already exists.');
                // Create recipients trigger (nested)
                db.run(`
                  CREATE TRIGGER IF NOT EXISTS update_recipients_updated_at
                  AFTER UPDATE ON recipients
                  FOR EACH ROW
                  BEGIN
                    UPDATE recipients SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                  END;
                `, (triggerErr) => {
                  if (triggerErr) {
                    console.error('Error creating recipients updated_at trigger:', triggerErr.message);
                  } else {
                    console.log('Trigger "update_recipients_updated_at" created or already exists.');
                  }

                  // Close the database connection after all tables are processed
                  db.close((err) => {
                    if (err) {
                      console.error('Error closing database', err.message);
                    } else {
                      console.log('Database setup complete. Connection closed.');
                    }
                  });
                }); // End recipients trigger callback
              } // End else recipients table created
            }); // End recipients table db.run
          }); // End matching_results table callback
        }); // End donors table callback
      }); // End employees table callback
    }); // End tasks table callback
  }); // End db.serialize
}
