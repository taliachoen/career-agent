export interface HealthStatus {
  status: "ok";
  service: string;
}

// API response shapes as they arrive over JSON: dates are ISO strings.

export interface SafeUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: SafeUser;
}

export interface JobPosting {
  id: string;
  jobId: string;
  url: string;
  site: string;
  source: "MANUAL" | "EMAIL";
  sourceMessageId: string | null;
  createdAt: string;
}

// `updatedAt` is null while the user has not saved a profile yet.
export interface Profile {
  cvText: string;
  lookingFor: string;
  updatedAt: string | null;
}

export interface JobScore {
  score: number;
  summary: string;
  matches: string[];
  gaps: string[];
  model: string;
  scoredAt: string;
  // The profile was saved after this score was made.
  stale: boolean;
}

export interface ScoreRunResult {
  scored: number;
  failed: number;
  // Jobs that still need a score, failed ones included.
  remaining: number;
}

export interface JobWithPostings {
  id: string;
  title: string;
  company: string;
  description: string;
  // EMAIL_SNIPPET: the description is only the snippet from an alert email, so the score rests on less.
  descriptionSource: "FULL" | "EMAIL_SNIPPET";
  location: string | null;
  createdAt: string;
  postings: JobPosting[];
  // null until the job is scored.
  score: JobScore | null;
}

// Gmail connection. Never carries a token; `email` is the connected (or last connected) address.
export interface GmailStatus {
  state: "not_connected" | "connected" | "needs_reconnect";
  email: string | null;
}

export interface GmailConnectResult {
  authUrl: string;
}

// `revoked` is false when Google could not be reached: the local tokens are gone anyway,
// and the user should remove the app in their Google account settings.
export interface GmailDisconnectResult {
  revoked: boolean;
}

// Senders whose mail is read: the built-in list (addresses or domains) and the user's own.
export interface GmailSender {
  id: string;
  value: string;
}

export interface GmailSendersView {
  defaults: string[];
  mine: GmailSender[];
}

// What one POST /gmail/sync did. All numbers: no mail content.
export interface SyncResult {
  // Mails looked at this time, whatever came of them.
  checked: number;
  // Mails with at least one valid job.
  withJobs: number;
  // New jobs, and postings added to a job that already existed (the same job on another site).
  added: number;
  attached: number;
  // Jobs skipped because their URL was already saved.
  duplicates: number;
  // Jobs the model returned that were dropped: a URL not in the mail, or an unusable entry.
  rejected: number;
  // Mails skipped because Gmail could not verify the sender's DKIM signature. Not sent to the model.
  unauthenticated: number;
  // Mails that were not from an allowed sender after all. Not sent to the model.
  ignored: number;
  // Mails that could not be read or understood; they are tried again next time.
  failedEmails: number;
  // More unread mail from allowed senders is waiting: sync again.
  moreAvailable: boolean;
  scored: number;
  scoreFailed: number;
  // Jobs still without a score after this run.
  scoringRemaining: number;
  scoring:
    | "done"
    | "not_needed"
    | "skipped_no_profile"
    | "skipped_busy"
    | "skipped_unavailable"
    | "failed";
}
