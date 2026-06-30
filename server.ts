import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { 
  createIssue, 
  getAllIssues, 
  getIssueById, 
  upvoteIssue, 
  updateIssueStatus, 
  initDb,
  createUser,
  getUserByUsername,
  getUserById
} from './src/backend/db.js';
import { analyzeIssue, generateHotspotSummary } from './src/backend/gemini.js';
import { CivicIssue } from './src/types.js';

// Load environment variables
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'civic-pulse-super-secret-key-12345';

// 1. General API rate limiter (protects database / server endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: { error: 'Too many API requests from this IP, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. AI endpoints rate limiter (protects Gemini API quota from exhaustion)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: { error: 'Too many reports filed or insights compiled from this IP, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication Middleware: Verifies JWT token in the Authorization header
 * and attaches the decoded user payload to req.user.
 */
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: 'citizen' | 'officer' };
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authorization token.' });
  }
};

/**
 * Authorization Middleware: Checks if the authenticated user has the required role.
 */
const requireRole = (role: 'citizen' | 'officer') => {
  return [
    requireAuth,
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = (req as any).user;
      if (user && user.role === role) {
        next();
      } else {
        res.status(403).json({ error: `Access denied. Requires '${role}' permissions.` });
      }
    }
  ];
};

async function startServer() {
  // Initialize SQLite database, tables, and seed data before handling requests
  try {
    console.log('Initializing SQLite database...');
    await initDb();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  const app = express();

  // Trust first proxy (required if running behind a reverse proxy like Cloud Run, Heroku, Nginx, etc. for correct client IP detection)
  app.set('trust proxy', 1);

  // Handle large base64 image uploads from client
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Apply general API rate limiting to all /api/ endpoints
  app.use('/api/', apiLimiter);

  // --- AUTHENTICATION ROUTES ---

  // Register Endpoint
  app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
      const existingUser = await getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const user = await createUser(username, passwordHash, 'citizen'); // Registers as 'citizen' by default

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.status(201).json({ token, user: { username: user.username, role: user.role } });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Failed to register account.' });
    }
  });

  // Login Endpoint
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
      const user = await getUserByUsername(username);
      if (!user) {
        return res.status(400).json({ error: 'Invalid username or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid username or password.' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.json({ token, user: { username: user.username, role: user.role } });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  // Get current user profile endpoint
  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({ username: user.username, role: user.role });
  });

  // --- CIVIC ISSUE ROUTES ---

  // API Route: Get all reported issues (Public access)
  app.get('/api/issues', async (req, res) => {
    try {
      const issues = await getAllIssues();
      res.json(issues);
    } catch (error) {
      console.error('Error fetching issues:', error);
      res.status(500).json({ error: 'Failed to fetch issues' });
    }
  });

  // API Route: Create/report a new civic issue (with AI Limiter & Auth protection)
  // Body parameter expected: { photoUrl: string, description: string, lat: number, lng: number }
  app.post('/api/issues', requireAuth, aiLimiter, async (req, res) => {
    const { photoUrl, description, lat, lng } = req.body;

    if (!photoUrl || !description) {
      return res.status(400).json({ error: 'Photo and description are required.' });
    }

    const latitude = typeof lat === 'number' ? lat : 12.9716; // Default latitude
    const longitude = typeof lng === 'number' ? lng : 77.5946; // Default longitude

    try {
      console.log('Analyzing reported civic issue with Gemini...');
      // Analyze with Gemini to classify, score, and draft escalation
      const aiAnalysis = await analyzeIssue(photoUrl, description);

      // Create full CivicIssue object
      const newIssue: CivicIssue = {
        id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        photoUrl,
        description,
        category: aiAnalysis.category,
        severityScore: aiAnalysis.severityScore,
        severityReasoning: aiAnalysis.severityReasoning,
        lat: latitude,
        lng: longitude,
        status: 'reported',
        verificationCount: 0,
        escalationDraft: aiAnalysis.escalationDraft,
        createdAt: new Date().toISOString(),
      };

      const savedIssue = await createIssue(newIssue);
      console.log('Successfully saved analyzed issue:', savedIssue.id);
      res.status(201).json(savedIssue);
    } catch (error) {
      console.error('Error reporting issue:', error);
      res.status(500).json({ 
        error: 'AI analysis failed. Please verify your photo format and try again.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API Route: Upvote/verify a reported issue (with Auth duplicate checks by User ID)
  app.post('/api/issues/:id/upvote', requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = (req as any).user.id;

    try {
      const updatedIssue = await upvoteIssue(id, userId);
      if (!updatedIssue) {
        return res.status(404).json({ error: 'Issue not found' });
      }
      res.json(updatedIssue);
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_VOTE') {
        return res.status(400).json({ error: 'You have already verified this issue.' });
      }
      console.error('Error upvoting issue:', error);
      res.status(500).json({ error: 'Failed to record verification' });
    }
  });

  // API Route: Escalate a reported issue (updates status to 'escalated' — restricted to Officers)
  app.post('/api/issues/:id/escalate', requireRole('officer'), async (req, res) => {
    const { id } = req.params;
    try {
      const updatedIssue = await updateIssueStatus(id, 'escalated');
      if (!updatedIssue) {
        return res.status(404).json({ error: 'Issue not found' });
      }
      res.json(updatedIssue);
    } catch (error) {
      console.error('Error escalating issue:', error);
      res.status(500).json({ error: 'Failed to escalate issue' });
    }
  });

  // API Route: Resolve a reported issue (updates status to 'resolved' — restricted to Officers)
  app.post('/api/issues/:id/resolve', requireRole('officer'), async (req, res) => {
    const { id } = req.params;
    try {
      const updatedIssue = await updateIssueStatus(id, 'resolved');
      if (!updatedIssue) {
        return res.status(404).json({ error: 'Issue not found' });
      }
      res.json(updatedIssue);
    } catch (error) {
      console.error('Error resolving issue:', error);
      res.status(500).json({ error: 'Failed to resolve issue' });
    }
  });

  // API Route: Get AI-generated civic insights & hotspots summary (restricted to Officers + AI Limiter)
  app.get('/api/insights', requireRole('officer'), aiLimiter, async (req, res) => {
    try {
      const currentIssues = await getAllIssues();
      const insights = await generateHotspotSummary(currentIssues);
      res.json({ insights });
    } catch (error) {
      console.error('Error compiling insights:', error);
      res.status(500).json({ error: 'Failed to generate hotspot intelligence summary.' });
    }
  });

  // Vite Integration for Asset Serving
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Civic Issue Backend Server running on http://localhost:${PORT}`);
  });
}

startServer();
