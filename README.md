# Civic Issue Reporter

An AI-powered civic reporting app for capturing neighborhood hazards, classifying them with Gemini, and tracking them on an interactive map. Residents can submit issues with photos and coordinates, verify reports, and view municipal insights. Officers can escalate and resolve issues from the same dashboard.

## Features

- Photo-based civic issue reporting with geotagging
- Gemini-powered classification, severity scoring, and escalation drafting
- Interactive Leaflet map with issue markers and report pinning
- Issue browsing, detail view, and verification voting
- Citizen and officer authentication with JWT sessions
- Officer-only escalation, resolution, and hotspot insights
- Local SQLite storage seeded with sample issues and demo users

## Tech Stack

- Frontend: React, TypeScript, Vite, Motion, Lucide icons, Leaflet
- Backend: Express, SQLite, JWT, bcrypt
- AI: Google Gemini via `@google/genai`

## Prerequisites

- Node.js 18 or newer
- A Gemini API key

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local environment file by copying `.env.example` to `.env.local` in your editor or file explorer.
3. Update `.env.local` with your value:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

If you are running inside AI Studio, the secret is usually injected for you.

## Run Locally

Start the development server:

```bash
npm run dev
```

The app runs the Vite frontend and Express backend together through `server.ts`.

## Build And Start Production

```bash
npm run build
npm start
```

## Scripts

- `npm run dev` - start the local development server
- `npm run build` - build the frontend and bundle the Node server
- `npm start` - run the production server from `dist/server.cjs`
- `npm run lint` - type-check the project with `tsc --noEmit`

## Demo Accounts

The database seeds two local demo users on first run:

- Citizen: `citizen` / `password123`
- Officer: `officer` / `password123`

Use these only for local testing.

## How It Works

1. A citizen signs in and submits a photo, description, and map location.
2. The backend sends the image and description to Gemini for classification.
3. The app stores the generated category, severity score, and escalation draft in SQLite.
4. Other users can verify the report, while officers can escalate or resolve it.
5. Officers can also request AI-generated hotspot insights from the dashboard.

## Data And Environment Notes

- `database.sqlite` is created automatically on first run.
- `GEMINI_API_KEY` is required for issue analysis and insights.
- `JWT_SECRET` is optional and falls back to a local development default if unset.

## Repository Layout

- `src/` - React UI, shared types, and backend helpers
- `server.ts` - Express entry point and API routes
- `database.sqlite` - local SQLite database used for development

## Deployment

This project was generated for AI Studio / Cloud Run style deployment, but it also runs locally with the commands above. If you deploy it elsewhere, make sure the runtime environment provides `GEMINI_API_KEY` and persistent storage for SQLite if you want reports to survive restarts.
