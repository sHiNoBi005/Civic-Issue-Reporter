/**
 * Represents a geographical tag for an issue, including its coordinates and an optional physical address.
 */
export interface GeoTag {
  /** The latitude of the location. */
  lat: number;
  /** The longitude of the location. */
  lng: number;
  /** An optional, human-readable address of the location. */
  address?: string;
}

/**
 * Represents a drafted escalation message to be sent to city authorities or civic organizations.
 */
export interface EscalationDraft {
  /** The designated recipient of the escalation (e.g., Department of Transportation, local council). */
  recipient: string;
  /** The subject line of the escalation request. */
  subject: string;
  /** The full text body of the escalation request detailing the issue and severity. */
  body: string;
}

/**
 * Represents a reported civic issue with category, severity assessment, location, and escalation details.
 */
export interface CivicIssue {
  /** The unique identifier of the reported issue. */
  id: string;
  /** The URL or base64 data URI of the photo uploaded by the user. */
  photoUrl: string;
  /** The user's detailed description of the reported civic issue. */
  description: string;
  /** The category of the issue as assessed by AI (e.g., Pothole, Water Leak, Damaged Sign, Illegal Dumping). */
  category: string;
  /** The AI-generated severity score from 1 (low severity) to 5 (critical severity). */
  severityScore: number;
  /** The AI's detailed explanation and reasoning for the assigned severity score. */
  severityReasoning: string;
  /** The latitude coordinate where the issue was reported. */
  lat: number;
  /** The longitude coordinate where the issue was reported. */
  lng: number;
  /** The current operational status of the report (e.g., 'reported', 'verified', 'escalated', 'resolved'). */
  status: 'reported' | 'verified' | 'escalated' | 'resolved';
  /** The number of verification votes from other community members confirming the issue exists. */
  verificationCount: number;
  /** The AI-drafted email or message to be sent to local authorities for escalation. */
  escalationDraft: EscalationDraft;
  /** The ISO timestamp indicating when the civic issue was originally reported. */
  createdAt: string;
}
