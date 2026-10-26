import type { TextareaHTMLAttributes } from "react";
import { he } from "../lib/strings.he";

interface TextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "value" | "maxLength"
> {
  id: string;
  label: string;
  value: string;
  /** Characters allowed; shown as a live counter. Not enforced with maxLength, which would cut a paste silently. */
  limit: number;
  error?: string;
  hint?: string;
}

export function TextareaField({
  id,
  label,
  value,
  limit,
  error,
  hint,
  ...textareaProps
}: TextareaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const describedBy = [error ? errorId : null, hint ? hintId : null, counterId]
    .filter(Boolean)
    .join(" ");
  // Counted after trim(), the same way the server counts.
  const remaining = limit - value.trim().length;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mb-2 text-sm text-stone-500">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-md border bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 ${
          error ? "border-red-600" : "border-stone-300"
        }`}
        {...textareaProps}
      />
      <p
        id={counterId}
        className={`mt-1 text-sm ${remaining < 0 ? "font-medium text-red-700" : "text-stone-500"}`}
      >
        {remaining < 0 ? he.profile.over(-remaining) : he.profile.remaining(remaining)}
      </p>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
