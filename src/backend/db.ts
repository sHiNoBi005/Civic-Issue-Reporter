import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import bcrypt from 'bcryptjs';
import { CivicIssue } from '../types.js';

// User Interface definition
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'citizen' | 'officer';
}

// Global database connection instance
let db: Database | null = null;

/**
 * Parses a database row back into a strongly typed CivicIssue object,
 * handling deserialization of the JSON escalation draft.
 */
function parseIssue(row: any): CivicIssue {
  return {
    ...row,
    escalationDraft: typeof row.escalationDraft === 'string' 
      ? JSON.parse(row.escalationDraft) 
      : row.escalationDraft
  };
}

/**
 * Initializes the SQLite database, creates the required tables if they don't exist,
 * performs migrations, and seeds it with default issues/users if empty.
 */
export async function initDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // 1. Create issues table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      photoUrl TEXT,
      description TEXT,
      category TEXT,
      severityScore INTEGER,
      severityReasoning TEXT,
      lat REAL,
      lng REAL,
      status TEXT,
      verificationCount INTEGER,
      escalationDraft TEXT,
      createdAt TEXT
    )
  `);

  // 2. Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT
    )
  `);

  // 3. Migrate votes table from IP-based to User-based
  const tableInfo = await db.all("PRAGMA table_info(votes)");
  const hasIp = tableInfo.some(col => col.name === 'ip');
  if (hasIp) {
    console.log("Migrating votes table schema (dropping old IP-based votes table)...");
    await db.exec('DROP TABLE IF EXISTS votes;');
  }

  // Create votes table with userId and issueId composite primary key
  await db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      userId TEXT,
      issueId TEXT,
      PRIMARY KEY (userId, issueId)
    )
  `);

  // Seed default issues if empty
  const countResult = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM issues');
  if (countResult && countResult.count === 0) {
    const seedIssues: CivicIssue[] = [
      {
        id: 'issue-1',
        photoUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
        description: 'Huge pothole in the middle of the right lane. Cars are swerving to avoid it, creating a major hazard.',
        category: 'Pothole',
        severityScore: 4,
        severityReasoning: 'The pothole is deep and located on a medium-traffic street. Swerving vehicles pose an active safety risk to oncoming traffic and cyclists.',
        lat: 12.9749,
        lng: 77.5994,
        status: 'reported',
        verificationCount: 1,
        escalationDraft: {
          recipient: 'Department of Public Works (DPW)',
          subject: 'Urgent: Dangerous Pothole reported at 12.9749, 77.5994',
          body: 'Dear DPW Engineering Department,\n\nA severe pothole has been reported by local residents at coordinates (12.9749, 77.5994) on Main Street. This pothole is causing active safety hazards with vehicles and bikes swerving into oncoming lanes. Please schedule an emergency pothole filling repair immediately.'
        },
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
      },
      {
        id: 'issue-2',
        photoUrl: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&w=600&q=80',
        description: 'Main water line burst under the sidewalk, streaming water continuously onto the road and flooding the pedestrian walk.',
        category: 'Water Leak',
        severityScore: 5,
        severityReasoning: 'Continuous gushing water indicates a high-volume pipe break. It wastes municipal water, blocks pedestrian access, and risks undermining the sidewalk and roadbed structure.',
        lat: 12.9833,
        lng: 77.5967,
        status: 'verified',
        verificationCount: 4,
        escalationDraft: {
          recipient: 'Municipal Water Authority',
          subject: 'Critical: Water Main Burst under footpath near 12.9833, 77.5967',
          body: 'Dear Water Utility Operations,\n\nA critical water leak/burst main has been reported and community-verified near the central park area at (12.9833, 77.5967). Water is streaming continuously, causing localized road flooding and footpath erosion. Immediate intervention is required to shut off the supply valve and repair the pipeline.'
        },
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString() // 24 hours ago
      },
      {
        id: 'issue-3',
        photoUrl: 'https://images.unsplash.com/photo-1508873535684-277a3cbcc4e8?auto=format&fit=crop&w=600&q=80',
        description: 'Streetlight has been flickering wildly at night, eventually going completely black. Makes the street feel unsafe.',
        category: 'Electrical & Lighting',
        severityScore: 2,
        severityReasoning: 'Reduces visibility and safety for pedestrians at night, but does not present an immediate life-threatening situation or structural structural damage.',
        lat: 12.9752,
        lng: 77.6021,
        status: 'reported',
        verificationCount: 0,
        escalationDraft: {
          recipient: 'City Power & Light Authority',
          subject: 'Maintenance Request: Flickering / Outage Streetlight at 12.9752, 77.6021',
          body: 'Dear Power Authority Support,\n\nA streetlight outage has been reported near (12.9752, 77.6021) near Commercial Avenue. The light fixture flickers intermittently before going dark, reducing safety for pedestrians and vehicle navigation at night. Please dispatch a technician to inspect and resolve this issue.'
        },
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString() // 48 hours ago
      }
    ];

    for (const issue of seedIssues) {
      await db.run(
        `INSERT INTO issues (id, photoUrl, description, category, severityScore, severityReasoning, lat, lng, status, verificationCount, escalationDraft, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          issue.id,
          issue.photoUrl,
          issue.description,
          issue.category,
          issue.severityScore,
          issue.severityReasoning,
          issue.lat,
          issue.lng,
          issue.status,
          issue.verificationCount,
          JSON.stringify(issue.escalationDraft),
          issue.createdAt
        ]
      );
    }
  }

  // Seed default users if empty
  const userCountResult = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (userCountResult && userCountResult.count === 0) {
    console.log("Seeding default demo users (citizen/officer)...");
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('password123', salt);

    await db.run(
      'INSERT INTO users (id, username, passwordHash, role) VALUES (?, ?, ?, ?)',
      ['user-citizen', 'citizen', defaultPasswordHash, 'citizen']
    );

    await db.run(
      'INSERT INTO users (id, username, passwordHash, role) VALUES (?, ?, ?, ?)',
      ['user-officer', 'officer', defaultPasswordHash, 'officer']
    );
  }

  return db;
}

/**
 * Internal helper to ensure database is initialized before execution.
 */
async function getDb(): Promise<Database> {
  if (!db) {
    await initDb();
  }
  return db!;
}

/**
 * Creates and stores a new user in the SQLite database.
 */
export async function createUser(username: string, passwordHash: string, role: 'citizen' | 'officer'): Promise<User> {
  const database = await getDb();
  const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await database.run(
    'INSERT INTO users (id, username, passwordHash, role) VALUES (?, ?, ?, ?)',
    [id, username, passwordHash, role]
  );
  return { id, username, passwordHash, role };
}

/**
 * Retrieves a user by their username.
 */
export async function getUserByUsername(username: string): Promise<User | undefined> {
  const database = await getDb();
  return await database.get<User>('SELECT * FROM users WHERE username = ?', [username]);
}

/**
 * Retrieves a user by their ID.
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const database = await getDb();
  return await database.get<User>('SELECT * FROM users WHERE id = ?', [id]);
}

/**
 * Creates and stores a new civic issue in the SQLite database.
 * @param issue The civic issue details to create.
 * @returns The newly created CivicIssue object.
 */
export async function createIssue(issue: CivicIssue): Promise<CivicIssue> {
  const database = await getDb();
  await database.run(
    `INSERT INTO issues (id, photoUrl, description, category, severityScore, severityReasoning, lat, lng, status, verificationCount, escalationDraft, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      issue.id,
      issue.photoUrl,
      issue.description,
      issue.category,
      issue.severityScore,
      issue.severityReasoning,
      issue.lat,
      issue.lng,
      issue.status,
      issue.verificationCount,
      JSON.stringify(issue.escalationDraft),
      issue.createdAt
    ]
  );
  return issue;
}

/**
 * Retrieves all reported civic issues, sorted by creation date descending.
 * @returns An array of all CivicIssue objects.
 */
export async function getAllIssues(): Promise<CivicIssue[]> {
  const database = await getDb();
  const rows = await database.all('SELECT * FROM issues ORDER BY createdAt DESC');
  return rows.map(parseIssue);
}

/**
 * Retrieves a single civic issue by its unique ID.
 * @param id The unique ID of the issue.
 * @returns The CivicIssue object if found, or undefined.
 */
export async function getIssueById(id: string): Promise<CivicIssue | undefined> {
  const database = await getDb();
  const row = await database.get('SELECT * FROM issues WHERE id = ?', [id]);
  return row ? parseIssue(row) : undefined;
}

/**
 * Increments the verification count of a reported issue by 1.
 * If the verification count reaches 3 or more, the status is automatically elevated to 'verified'
 * (unless it is already escalated or resolved).
 * Ensures that each User can only upvote a specific issue once.
 * @param id The unique ID of the issue.
 * @param userId The ID of the logged-in user.
 * @returns The updated CivicIssue object if found, or undefined.
 */
export async function upvoteIssue(id: string, userId: string): Promise<CivicIssue | undefined> {
  const database = await getDb();
  const issue = await getIssueById(id);
  if (!issue) return undefined;

  // Check if this user has already voted for this issue
  const existingVote = await database.get('SELECT 1 FROM votes WHERE userId = ? AND issueId = ?', [userId, id]);
  if (existingVote) {
    throw new Error('DUPLICATE_VOTE');
  }

  // Insert vote record
  await database.run('INSERT INTO votes (userId, issueId) VALUES (?, ?)', [userId, id]);

  const newVerificationCount = issue.verificationCount + 1;
  let newStatus = issue.status;

  // Auto-upgrade status to 'verified' at 3+ votes if currently 'reported'
  if (newVerificationCount >= 3 && issue.status === 'reported') {
    newStatus = 'verified';
  }

  await database.run(
    'UPDATE issues SET verificationCount = ?, status = ? WHERE id = ?',
    [newVerificationCount, newStatus, id]
  );

  return {
    ...issue,
    verificationCount: newVerificationCount,
    status: newStatus
  };
}

/**
 * Groups issues by rough geographical proximity (rounding lat/lng to 2 decimal places, ~1.1km).
 * This is useful for summarizing clusters/hotspots of civic problems for AI context.
 * @returns An array of hotspot groups containing coordinate information and their grouped issues.
 */
export async function getHotspotSummaryData(): Promise<{
  lat: number;
  lng: number;
  key: string;
  issues: CivicIssue[];
}[]> {
  const allIssues = await getAllIssues();
  const groups: { [key: string]: { lat: number; lng: number; issues: CivicIssue[] } } = {};

  allIssues.forEach(issue => {
    // Rounding to 2 decimal places groups items within ~1.1 kilometers of each other
    const approxLat = Math.round(issue.lat * 100) / 100;
    const approxLng = Math.round(issue.lng * 100) / 100;
    const key = `${approxLat.toFixed(2)},${approxLng.toFixed(2)}`;

    if (!groups[key]) {
      groups[key] = {
        lat: approxLat,
        lng: approxLng,
        issues: []
      };
    }
    groups[key].issues.push(issue);
  });

  return Object.keys(groups).map(key => ({
    key,
    lat: groups[key].lat,
    lng: groups[key].lng,
    issues: groups[key].issues
  }));
}

/**
 * Updates the operational status of an issue.
 * @param id The unique ID of the issue.
 * @param status The new status to transition to.
 * @returns The updated CivicIssue or undefined.
 */
export async function updateIssueStatus(
  id: string,
  status: 'reported' | 'verified' | 'escalated' | 'resolved'
): Promise<CivicIssue | undefined> {
  const database = await getDb();
  const issue = await getIssueById(id);
  if (!issue) return undefined;

  await database.run('UPDATE issues SET status = ? WHERE id = ?', [status, id]);
  
  return {
    ...issue,
    status
  };
}
