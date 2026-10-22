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

export interface JobWithPostings {
  id: string;
  title: string;
  company: string;
  description: string;
  createdAt: string;
  postings: JobPosting[];
}
