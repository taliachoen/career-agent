// Limits matter beyond UX: in step 3c the profile text is sent to the LLM on every
// scoring run, so unbounded text means unbounded cost.
// Mirrored in apps/web/src/lib/validation.ts; keep the two in sync.
export const CV_MIN_LENGTH = 200;
export const CV_MAX_LENGTH = 20_000;
export const LOOKING_FOR_MAX_LENGTH = 2_000;

export interface ProfileInput {
  cvText: string;
  lookingFor: string;
}

// What the API returns. `updatedAt` is null while the user has no profile yet.
export interface ProfileView extends ProfileInput {
  updatedAt: Date | null;
}
