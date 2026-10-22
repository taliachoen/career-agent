"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Field } from "../../../components/Field";
import { Notice } from "../../../components/Notice";
import { SubmitButton } from "../../../components/SubmitButton";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";
import { parseLogin, type FieldErrors } from "../../../lib/validation";

export function LoginForm({ notice }: { notice?: "expired" | "registered" }) {
  const { login } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const parsed = parseLogin(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      await login(parsed.value);
      // The (auth) layout sees the new session and moves the user to /jobs.
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 401
          ? he.errors.badCredentials
          : he.errors.generic,
      );
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{he.login.title}</h1>
      {notice === "expired" && <Notice tone="error">{he.errors.sessionExpired}</Notice>}
      {notice === "registered" && <Notice tone="info">{he.errors.registeredLoginFailed}</Notice>}
      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <Field
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          label={he.common.email}
          error={fieldErrors.email}
        />
        <Field
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          label={he.common.password}
          error={fieldErrors.password}
        />
        {formError && (
          <Notice tone="error">
            <p>{formError}</p>
            {formError === he.errors.generic && (
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                disabled={pending}
                className="mt-1 min-h-11 font-medium underline disabled:opacity-60"
              >
                {he.common.retry}
              </button>
            )}
          </Notice>
        )}
        <SubmitButton pending={pending} pendingLabel={he.common.sending}>
          {he.login.submit}
        </SubmitButton>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        {he.login.noAccount}{" "}
        <Link href="/register" className="font-medium text-accent-700 underline">
          {he.login.toRegister}
        </Link>
      </p>
    </>
  );
}
