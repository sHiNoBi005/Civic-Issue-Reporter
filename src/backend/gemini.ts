import { GoogleGenAI, Type } from '@google/genai';
import { CivicIssue, EscalationDraft } from '../types';

// Lazy-initialize the Gemini client so it's created after dotenv.config() has loaded env vars.
// If instantiated at module top-level, process.env.GEMINI_API_KEY is undefined and the SDK
// falls back to Google Cloud ADC which fails outside GCP.
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return _ai;
}

/**
 * Helper to parse a standard Data URI (e.g., data:image/png;base64,...) 
 * into raw base64 data and its corresponding mimeType.
 */
function parseBase64Image(dataUri: string): { mimeType: string; data: string } {
  const match = dataUri.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: 'image/jpeg', // Default fallback
    data: dataUri,
  };
}

/**
 * PROMPT TEMPLATE FOR ANALYZING CIVIC ISSUES:
 * 
 * "You are an expert civic engineering AI agent. Analyze the provided photograph and user-provided description of a local civic issue.
 * 
 * Your task is to:
 * 1. Categorize the issue (e.g. Pothole, Streetlight Outage, Water Leak, Illegal Dumping, Road Hazard, etc.).
 * 2. Assess its severity on a scale of 1 to 5 (1 = Minor aesthetic issue, 5 = Critical immediate danger / high-volume hazard).
 * 3. Formulate a single-sentence reasoning for your score.
 * 4. Draft a highly professional escalation message addressed to the correct municipal authority, describing the issue politely and asking for prompt resolution.
 * 
 * User description: [DESCRIPTION]"
 */
export async function analyzeIssue(
  photoUrl: string,
  description: string
): Promise<{
  category: string;
  severityScore: number;
  severityReasoning: string;
  escalationDraft: EscalationDraft;
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const { mimeType, data } = parseBase64Image(photoUrl);

  const prompt = `You are an expert civic engineering AI agent. Analyze the provided photograph and user-provided description of a local civic issue.

User Description of the issue:
"${description}"

Your task is to:
1. Categorize the issue into a standard municipal category (e.g., 'Pothole', 'Streetlight Outage', 'Water Leak', 'Illegal Dumping', 'Road Hazard', or 'Other').
2. Assess its severity on a scale of 1 to 5, where:
   - 1: Very minor or aesthetic (e.g., slightly faded paint, graffiti).
   - 2: Minor convenience (e.g., overgrown weeds, dirty signs).
   - 3: Moderate hazard (e.g., flickering light, clogged storm drain).
   - 4: High risk / hazard (e.g., deep pothole in lane, broken pedestrian signal).
   - 5: Critical/Immediate danger (e.g., live wires exposed, massive flooding, burst gas pipe).
3. Draft a single, elegant sentence explaining the reasoning behind the severity score.
4. Draft a highly professional escalation message including:
   - A realistic municipal department name as the recipient (e.g., 'City Dept of Transportation' or 'Water Utility Authority').
   - An appropriate, urgent subject line.
   - A detailed, polite email body describing the problem and requesting prompt repair.`;

  const imagePart = {
    inlineData: {
      mimeType,
      data,
    },
  };

  const textPart = {
    text: prompt,
  };

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'The classified category of the civic issue (e.g. Pothole, Streetlight Outage, Water Leak, Illegal Dumping, Road Hazard).',
            },
            severityScore: {
              type: Type.INTEGER,
              description: 'Assessed severity level from 1 to 5.',
            },
            severityReasoning: {
              type: Type.STRING,
              description: 'A single concise sentence explaining the reasoning for the severity score.',
            },
            escalationDraft: {
              type: Type.OBJECT,
              properties: {
                recipient: {
                  type: Type.STRING,
                  description: 'The relevant authority or municipal agency to contact.',
                },
                subject: {
                  type: Type.STRING,
                  description: 'Email subject line.',
                },
                body: {
                  type: Type.STRING,
                  description: 'Highly professional, polite email body.',
                },
              },
              required: ['recipient', 'subject', 'body'],
            },
          },
          required: ['category', 'severityScore', 'severityReasoning', 'escalationDraft'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return JSON.parse(text);
  } catch (error) {
    console.error('Error analyzing civic issue with Gemini:', error);
    throw error;
  }
}

/**
 * PROMPT TEMPLATE FOR HOTSPOT SUMMARIZATION:
 * 
 * "You are a civic analytics AI helper. You are given a list of reported issues across the city including their description, category, severity score, status, and verification count.
 * 
 * Your task is to:
 * 1. Analyze this list of problems.
 * 2. Identify any common patterns, clustering of hazards, or critical issues that require immediate city focus.
 * 3. Provide a brief, actionable, and friendly natural-language summary (1-2 paragraphs) for a civic dashboard. Focus on areas of concern, high severity issues, and what needs immediate escalation."
 */
export async function generateHotspotSummary(issues: CivicIssue[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  if (issues.length === 0) {
    return "No reported issues are currently active in this area. Your neighborhood is clean and secure!";
  }

  const issuesListStr = issues
    .map(
      (issue, index) =>
        `Issue #${index + 1}:
- Category: ${issue.category}
- Severity: ${issue.severityScore}/5
- Location coordinates: (${issue.lat}, ${issue.lng})
- Status: ${issue.status}
- Verifications: ${issue.verificationCount}
- Description: ${issue.description}`
    )
    .join('\n\n');

  const prompt = `You are a civic analytics AI helper. Below is a list of active community-reported civic issues.

Please analyze the list and write a brief, action-oriented, natural-language summary (1 to 2 paragraphs maximum).
Your summary should:
1. Highlight any hotspots, critical problems (severity 4 or 5), or recurring patterns (e.g. multiple leaks or potholes in close proximity).
2. Recommend which reports need immediate municipal escalation or community attention based on their severity and verification counts.
3. Keep the tone professional, clean, and encouraging for community action.

List of Reported Issues:
${issuesListStr}`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      return 'Could not generate a summary at this time.';
    }

    return text.trim();
  } catch (error) {
    console.error('Error generating hotspot summary with Gemini:', error);
    return 'An error occurred while compiling the civic hotspot intelligence summary.';
  }
}
