"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Field } from "../../../components/Field";
import { Notice } from "../../../components/Notice";
import { SubmitButton } from "../../../components/SubmitButton";
import { ApiError } from "../../../lib/api";
import { RegisteredButLoginFailed, useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";
import { parseRegister, type FieldErrors } from "../../../lib/validation";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const parsed = parseRegister(
      String(data.get("email") ?? ""),
      String(data.get("password") ?? ""),
    );
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      await register(parsed.value);
      // The (auth) layout sees the new session and moves the user to /jobs.
    } catch (error) {
      if (error instanceof RegisteredButLoginFailed) {
        router.replace("/login?reason=registered");
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: he.errors.emailTaken });
      } else {
        setFormError(he.errors.generic);
      }
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{he.register.title}</h1>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
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
          autoComplete="new-password"
          label={he.common.password}
          hint={he.register.passwordHint}
          error={fieldErrors.password}
        />
        {formError && (
          <Notice tone="error">
            <p>{formError}</p>
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
        <SubmitButton pending={pending} pendingLabel={he.common.sending}>
          {he.register.submit}
        </SubmitButton>
      </form>
      <p className="mt-6 text-sm text-stone-600">
        {he.register.hasAccount}{" "}
        <Link href="/login" className="font-medium text-accent-700 underline">
          {he.register.toLogin}
        </Link>
      </p>
    </>
  );
}
