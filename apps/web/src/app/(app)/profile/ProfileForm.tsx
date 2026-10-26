"use client";

import type { Profile } from "@career-agent/types";
import { useRef, useState, type FormEvent } from "react";
import { Notice } from "../../../components/Notice";
import { SubmitButton } from "../../../components/SubmitButton";
import { TextareaField } from "../../../components/TextareaField";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";
import {
  CV_MAX_LENGTH,
  LOOKING_FOR_MAX_LENGTH,
  parseProfile,
  type ProfileFieldErrors,
} from "../../../lib/validation";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" });
}

export function ProfileForm({ initial }: { initial: Profile }) {
  const { authedPut } = useAuth();
  const [cvText, setCvText] = useState(initial.cvText);
  const [lookingFor, setLookingFor] = useState(initial.lookingFor);
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [justSaved, setJustSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setJustSaved(false);
    const parsed = parseProfile(cvText, lookingFor);
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setFormError(false);
      return;
    }

    setFieldErrors({});
    setFormError(false);
    setPending(true);
    try {
      const saved = await authedPut<Profile>("/profile", parsed.value);
      setCvText(saved.cvText);
      setLookingFor(saved.lookingFor);
      setUpdatedAt(saved.updatedAt);
      setJustSaved(true);
    } catch {
      // A 401 is already handled by authedPut (redirect to the login screen); the
      // message below is harmless in that case because the page is replaced.
      setFormError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {updatedAt === null && (
        <div className="mb-4">
          <Notice tone="info">
            <p className="font-medium">{he.profile.introTitle}</p>
            <p className="mt-1">{he.profile.introBody}</p>
          </Notice>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
        <TextareaField
          id="cvText"
          name="cvText"
          rows={14}
          label={he.profile.cvLabel}
          hint={he.profile.cvHint}
          value={cvText}
          limit={CV_MAX_LENGTH}
          error={fieldErrors.cvText}
          onChange={(event) => {
            setCvText(event.target.value);
            setJustSaved(false);
          }}
        />
        <TextareaField
          id="lookingFor"
          name="lookingFor"
          rows={4}
          label={he.profile.lookingForLabel}
          hint={he.profile.lookingForHint}
          value={lookingFor}
          limit={LOOKING_FOR_MAX_LENGTH}
          error={fieldErrors.lookingFor}
          onChange={(event) => {
            setLookingFor(event.target.value);
            setJustSaved(false);
          }}
        />
        {formError && (
          <Notice tone="error">
            <p>{he.errors.generic}</p>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={pending}
              className="mt-1 min-h-11 font-medium underline disabled:opacity-60"
            >
              {he.common.retry}
            </button>
          </Notice>
        )}
        {justSaved && (
          <Notice tone="info">
            <p className="font-medium">{he.profile.saved}</p>
          </Notice>
        )}
        <SubmitButton pending={pending} pendingLabel={he.common.sending}>
          {he.profile.submit}
        </SubmitButton>
        {updatedAt !== null && (
          <p className="text-sm text-stone-600">
            {he.profile.updatedAt} {formatUpdatedAt(updatedAt)}
          </p>
        )}
      </form>
    </>
  );
}
