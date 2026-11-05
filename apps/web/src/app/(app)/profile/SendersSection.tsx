"use client";

import type { GmailSender, GmailSendersView } from "@career-agent/types";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Field } from "../../../components/Field";
import { Notice } from "../../../components/Notice";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { he } from "../../../lib/strings.he";

type LoadState =
  { status: "loading" } | { status: "error" } | { status: "done"; view: GmailSendersView };

// The senders whose mail is read: the built-in list (read only) and the user's own.
export function SendersSection() {
  const { authedGet, authedPost, authedDelete } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<"add" | string | null>(null);

  const fetchSenders = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "done", view: await authedGet<GmailSendersView>("/gmail/senders") });
    } catch (error) {
      // A 401 is already handled by authedGet (redirect to the login screen).
      if (!(error instanceof ApiError && error.status === 401)) setLoad({ status: "error" });
    }
  }, [authedGet]);

  useEffect(() => {
    void fetchSenders();
  }, [fetchSenders]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || load.status !== "done") return;
    setFailed(false);
    if (value.trim() === "") {
      setFieldError(he.gmail.senders.invalid);
      return;
    }
    setFieldError(undefined);
    setPending("add");
    try {
      const sender = await authedPost<GmailSender>("/gmail/senders", { value });
      const { view } = load;
      setLoad({ status: "done", view: { ...view, mine: [...view.mine, sender] } });
      setValue("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      if (error instanceof ApiError && error.status === 409) {
        setFieldError(he.gmail.senders.duplicate);
      } else if (error instanceof ApiError && error.status === 400) {
        setFieldError(
          error.message.includes("at most") ? he.gmail.senders.tooMany : he.gmail.senders.invalid,
        );
      } else {
        setFailed(true);
      }
    } finally {
      setPending(null);
    }
  }

  async function remove(sender: GmailSender) {
    if (pending || load.status !== "done") return;
    setFailed(false);
    setPending(sender.id);
    try {
      await authedDelete<unknown>(`/gmail/senders/${sender.id}`);
    } catch (error) {
      // Already gone (404, another tab) is the state the user wanted.
      if (error instanceof ApiError && error.status === 401) return;
      if (!(error instanceof ApiError && error.status === 404)) {
        setFailed(true);
        setPending(null);
        return;
      }
    }
    const { view } = load;
    setLoad({
      status: "done",
      view: { ...view, mine: view.mine.filter((s) => s.id !== sender.id) },
    });
    setPending(null);
  }

  return (
    <div className="space-y-3 border-t border-stone-200 pt-4">
      <h3 className="font-semibold">{he.gmail.senders.title}</h3>
      <p className="text-sm text-stone-600">{he.gmail.senders.intro}</p>

      {load.status === "loading" && (
        <div
          role="status"
          aria-label={he.common.loading}
          className="h-11 animate-pulse rounded bg-stone-100"
        />
      )}

      {load.status === "error" && (
        <Notice tone="error">
          <p>{he.gmail.senders.loadFailed}</p>
          <button
            type="button"
            onClick={() => void fetchSenders()}
            className="mt-1 min-h-11 font-medium underline"
          >
            {he.common.retry}
          </button>
        </Notice>
      )}

      {load.status === "done" && (
        <>
          <details className="rounded-md border border-stone-200 bg-white px-3 py-2">
            <summary className="min-h-8 cursor-pointer text-sm font-medium">
              {he.gmail.senders.knownTitle} ({load.view.defaults.length})
            </summary>
            <p className="mt-2 text-sm text-stone-500">{he.gmail.senders.knownHint}</p>
            <ul
              aria-label={he.gmail.senders.knownTitle}
              className="mt-2 space-y-1 text-sm text-stone-800"
            >
              {load.view.defaults.map((sender) => (
                <li key={sender}>
                  <bdi dir="ltr">{sender}</bdi>
                </li>
              ))}
            </ul>
          </details>

          <div>
            <h4 className="text-sm font-medium text-stone-700">{he.gmail.senders.mineTitle}</h4>
            {load.view.mine.length === 0 ? (
              <p className="mt-1 text-sm text-stone-500">{he.gmail.senders.mineEmpty}</p>
            ) : (
              <ul
                aria-label={he.gmail.senders.mineTitle}
                className="mt-1 divide-y divide-stone-100"
              >
                {load.view.mine.map((sender) => (
                  <li key={sender.id} className="flex items-center justify-between gap-3 py-1">
                    <bdi dir="ltr" className="min-w-0 break-all text-sm text-stone-800">
                      {sender.value}
                    </bdi>
                    <button
                      type="button"
                      onClick={() => void remove(sender)}
                      disabled={pending !== null}
                      aria-label={he.gmail.senders.remove(sender.value)}
                      className="min-h-11 shrink-0 px-2 text-sm font-medium text-red-700 underline disabled:opacity-60"
                    >
                      {he.gmail.senders.removeButton}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={add} noValidate className="space-y-2">
            <Field
              id="sender-value"
              name="sender"
              dir="ltr"
              autoComplete="off"
              label={he.gmail.senders.addLabel}
              hint={he.gmail.senders.addHint}
              error={fieldError}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setFieldError(undefined);
              }}
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="min-h-11 rounded-md bg-accent-700 px-4 py-2 font-medium text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === "add" ? he.gmail.senders.adding : he.gmail.senders.add}
            </button>
          </form>
          {failed && (
            <Notice tone="error">
              <p>{he.gmail.senders.failed}</p>
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
