import type { ReactNode } from "react";

interface SubmitButtonProps {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}

export function SubmitButton({ pending, pendingLabel, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 w-full rounded-md bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
