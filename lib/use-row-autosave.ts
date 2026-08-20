"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "failed" | "auth-expired";

const DEBOUNCE_MS = 800;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function backoffFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

/**
 * Distinguishes a dead session from a plain network blip. An expiring
 * *access* token refreshes transparently (Supabase's own client handles
 * that) — this only matches the rarer case where the *refresh* token itself
 * is dead: the Server Action's underlying request gets redirected to
 * /login, and Next's own client throws this exact message because a
 * redirected Server Action response isn't the RSC payload it expected.
 * Retrying that with the same dead session can never succeed, so it must
 * not be treated like an ordinary retryable failure.
 */
const AUTH_EXPIRED_PATTERN =
  /unexpected response was received from the server|jwt expired|session.*expired/i;

function isAuthExpired(message: string): boolean {
  return AUTH_EXPIRED_PATTERN.test(message);
}

type RowRuntime = {
  /** Pending debounce or retry timer. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Consecutive failures, drives the backoff. */
  attempt: number;
  /** A save is in flight; a newer change must wait rather than race it. */
  inFlight: boolean;
  /** A change arrived while a save was in flight. */
  queued: boolean;
  /** Settles when the current attempt chain finishes, true if the row landed. */
  promise: Promise<boolean> | null;
};

/**
 * Per-row autosave with retry, backoff, and a localStorage write buffer.
 *
 * The buffer is not offline mode — there is no read cache and no sync engine.
 * It exists so that a crash, reload, or closed tab cannot destroy keystrokes
 * that have not yet reached the server, which is what "nothing is lost"
 * actually requires.
 *
 * @param storagePrefix scopes drafts so different rounds and languages cannot
 *   collide.
 * @param save must be idempotent: retries re-send the same row.
 */
export function useRowAutosave<T>({
  storagePrefix,
  save,
  onSaved,
}: {
  storagePrefix: string;
  save: (rowId: string, values: T) => Promise<{ error: string | null }>;
  onSaved?: (rowId: string) => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [lastError, setLastError] = useState<Record<string, string>>({});
  /** Rows still waiting to reach the server. State, so the UI can gate on it. */
  const [pendingCount, setPendingCount] = useState(0);

  const runtime = useRef<Record<string, RowRuntime>>({});
  // Latest values per row, read at flush time so a retry always sends the
  // newest data rather than whatever was current when the attempt was queued.
  const pending = useRef<Record<string, T>>({});
  const saveRef = useRef(save);
  // Retries scheduled inside a save need the latest callbacks; refs are synced
  // in an effect rather than during render.
  const flushRef = useRef<(rowId: string) => Promise<boolean>>(() =>
    Promise.resolve(false)
  );

  const draftKey = useCallback(
    (rowId: string) => `${storagePrefix}:${rowId}`,
    [storagePrefix]
  );

  const rt = useCallback((rowId: string): RowRuntime => {
    runtime.current[rowId] ??= {
      timer: null,
      attempt: 0,
      inFlight: false,
      queued: false,
      promise: null,
    };
    return runtime.current[rowId];
  }, []);

  const syncPendingCount = useCallback(() => {
    setPendingCount(Object.keys(pending.current).length);
  }, []);

  const writeDraft = useCallback(
    (rowId: string, values: T) => {
      try {
        localStorage.setItem(draftKey(rowId), JSON.stringify(values));
      } catch {
        // A full or unavailable localStorage must never break entry; the
        // in-memory retry still covers the reconnect case.
      }
    },
    [draftKey]
  );

  const clearDraft = useCallback(
    (rowId: string) => {
      try {
        localStorage.removeItem(draftKey(rowId));
      } catch {
        // Ignore — a stale draft is reconciled on next load.
      }
    },
    [draftKey]
  );

  /** One send, plus any edit that landed while it was in flight. */
  const attemptSave = useCallback(
    async (rowId: string): Promise<boolean> => {
      const state = rt(rowId);

      // Loops rather than recurses: an edit arriving mid-flight is sent by the
      // next pass, so the caller awaits the whole chain as one attempt.
      for (;;) {
        const values = pending.current[rowId];
        if (values === undefined) return true;

        state.inFlight = true;
        setStatuses((s) => ({ ...s, [rowId]: "saving" }));

        let error: string | null = null;
        try {
          ({ error } = await saveRef.current(rowId, values));
        } catch (e) {
          error = e instanceof Error ? e.message : "Network error";
        }

        state.inFlight = false;

        if (error) {
          state.attempt += 1;
          const authExpired = isAuthExpired(error);
          setStatuses((s) => ({ ...s, [rowId]: authExpired ? "auth-expired" : "failed" }));
          setLastError((e) => ({ ...e, [rowId]: error! }));
          // Keep retrying indefinitely: an unsaved row is data loss waiting to
          // happen, so giving up is never the right default — *unless* the
          // session itself is dead, in which case retrying can never succeed
          // and would just be silent noise. The value stays in `pending`
          // (and its localStorage draft) either way; the "online" listener
          // and a fresh page load after re-login (readDrafts) bring it back.
          if (!authExpired) {
            state.timer = setTimeout(() => {
              void flushRef.current(rowId);
            }, backoffFor(state.attempt));
          }
          return false;
        }

        state.attempt = 0;
        setLastError((e) => {
          const { [rowId]: _removed, ...rest } = e;
          return rest;
        });

        if (state.queued) {
          // A newer edit landed mid-flight; send it rather than marking clean.
          state.queued = false;
          continue;
        }

        delete pending.current[rowId];
        clearDraft(rowId);
        syncPendingCount();
        setStatuses((s) => ({ ...s, [rowId]: "saved" }));
        onSaved?.(rowId);
        return true;
      }
    },
    [rt, clearDraft, syncPendingCount, onSaved]
  );

  /**
   * Sends a row now. Callers arriving while a save is in flight await that
   * same attempt chain instead of racing a second request against it.
   */
  const flush = useCallback(
    (rowId: string): Promise<boolean> => {
      const state = rt(rowId);
      if (state.inFlight) {
        state.queued = true;
        return state.promise ?? Promise.resolve(false);
      }

      const promise = attemptSave(rowId).finally(() => {
        if (state.promise === promise) state.promise = null;
      });
      state.promise = promise;
      return promise;
    },
    [rt, attemptSave]
  );

  useEffect(() => {
    saveRef.current = save;
    flushRef.current = flush;
  });

  /** Records a change and schedules a debounced save. */
  const queueSave = useCallback(
    (rowId: string, values: T) => {
      pending.current[rowId] = values;
      writeDraft(rowId, values);
      syncPendingCount();

      const state = rt(rowId);
      if (state.timer) clearTimeout(state.timer);
      setStatuses((s) => ({ ...s, [rowId]: "dirty" }));
      state.timer = setTimeout(() => {
        void flushRef.current(rowId);
      }, DEBOUNCE_MS);
    },
    [rt, writeDraft, syncPendingCount]
  );

  /** Saves immediately, skipping the debounce (used on blur). */
  const flushNow = useCallback(
    (rowId: string) => {
      const state = rt(rowId);
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (pending.current[rowId] !== undefined) void flush(rowId);
    },
    [rt, flush]
  );

  /**
   * Sends every unsaved row now and reports whether they all landed.
   *
   * Used to gate navigation: a teacher switching language or round must not
   * leave rows in a debounce timer that unmounting would drop.
   */
  const flushAllAndWait = useCallback(async (): Promise<boolean> => {
    const rowIds = Object.keys(pending.current);
    await Promise.all(
      rowIds.map((rowId) => {
        const state = rt(rowId);
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = null;
        }
        // A row backing off should try again immediately, not on its schedule.
        state.attempt = 0;
        return flush(rowId);
      })
    );
    return Object.keys(pending.current).length === 0;
  }, [rt, flush]);

  /** Retries every unsaved row now — used on reconnect and manual retry. */
  const flushAll = useCallback(() => {
    void flushAllAndWait();
  }, [flushAllAndWait]);

  /** Drafts left behind by a crash or reload, keyed by row. */
  const readDrafts = useCallback((): Record<string, T> => {
    const out: Record<string, T> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(`${storagePrefix}:`)) continue;
        const raw = localStorage.getItem(key);
        if (raw) out[key.slice(storagePrefix.length + 1)] = JSON.parse(raw) as T;
      }
    } catch {
      // Unreadable drafts are skipped rather than blocking the grid.
    }
    return out;
  }, [storagePrefix]);

  // Reconnecting should flush immediately rather than waiting out a backoff.
  useEffect(() => {
    window.addEventListener("online", flushAll);
    return () => window.removeEventListener("online", flushAll);
  }, [flushAll]);

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (Object.keys(pending.current).length === 0) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // On unmount, send whatever is still pending rather than dropping its timer.
  // Navigation is normally gated on flushAllAndWait; this is the backstop for
  // the paths that are not, and the draft buffer still covers a hard failure.
  useEffect(() => {
    const timers = runtime.current;
    const buffer = pending.current;
    return () => {
      for (const state of Object.values(timers)) {
        if (state.timer) {
          clearTimeout(state.timer);
          state.timer = null;
        }
      }
      for (const rowId of Object.keys(buffer)) {
        void flushRef.current(rowId);
      }
    };
  }, []);

  return {
    statuses,
    lastError,
    pendingCount,
    hasUnsaved: pendingCount > 0,
    queueSave,
    flushNow,
    flushAll,
    flushAllAndWait,
    readDrafts,
  };
}
