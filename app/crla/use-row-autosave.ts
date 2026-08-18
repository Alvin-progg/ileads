"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "failed";

const DEBOUNCE_MS = 800;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function backoffFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
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
};

/**
 * Per-row autosave with retry, backoff, and a localStorage write buffer.
 *
 * The buffer is not offline mode — there is no read cache and no sync engine.
 * It exists so that a crash, reload, or closed tab cannot destroy keystrokes
 * that have not yet reached the server, which is what "nothing is lost"
 * actually requires.
 *
 * @param storagePrefix scopes drafts so different rounds cannot collide.
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

  const runtime = useRef<Record<string, RowRuntime>>({});
  // Latest values per row, read at flush time so a retry always sends the
  // newest data rather than whatever was current when the attempt was queued.
  const pending = useRef<Record<string, T>>({});
  const saveRef = useRef(save);
  saveRef.current = save;

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
    };
    return runtime.current[rowId];
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

  const flush = useCallback(
    async (rowId: string) => {
      const state = rt(rowId);
      if (state.inFlight) {
        state.queued = true;
        return;
      }
      const values = pending.current[rowId];
      if (values === undefined) return;

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
        setStatuses((s) => ({ ...s, [rowId]: "failed" }));
        setLastError((e) => ({ ...e, [rowId]: error! }));
        // Keep retrying indefinitely: an unsaved row is data loss waiting to
        // happen, so giving up is never the right default.
        state.timer = setTimeout(() => flush(rowId), backoffFor(state.attempt));
        return;
      }

      state.attempt = 0;
      setLastError((e) => {
        const { [rowId]: _removed, ...rest } = e;
        return rest;
      });

      if (state.queued) {
        // A newer edit landed mid-flight; send it rather than marking clean.
        state.queued = false;
        void flush(rowId);
        return;
      }

      delete pending.current[rowId];
      clearDraft(rowId);
      setStatuses((s) => ({ ...s, [rowId]: "saved" }));
      onSaved?.(rowId);
    },
    [rt, clearDraft, onSaved]
  );

  /** Records a change and schedules a debounced save. */
  const queueSave = useCallback(
    (rowId: string, values: T) => {
      pending.current[rowId] = values;
      writeDraft(rowId, values);

      const state = rt(rowId);
      if (state.timer) clearTimeout(state.timer);
      setStatuses((s) => ({ ...s, [rowId]: "dirty" }));
      state.timer = setTimeout(() => flush(rowId), DEBOUNCE_MS);
    },
    [rt, writeDraft, flush]
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

  /** Retries every unsaved row now — used on reconnect and manual retry. */
  const flushAll = useCallback(() => {
    for (const rowId of Object.keys(pending.current)) {
      const state = rt(rowId);
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      state.attempt = 0;
      void flush(rowId);
    }
  }, [rt, flush]);

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

  const hasUnsaved = Object.keys(pending.current).length > 0;
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (Object.keys(pending.current).length === 0) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    const timers = runtime.current;
    return () => {
      for (const state of Object.values(timers)) {
        if (state.timer) clearTimeout(state.timer);
      }
    };
  }, []);

  return {
    statuses,
    lastError,
    queueSave,
    flushNow,
    flushAll,
    readDrafts,
    hasUnsaved,
  };
}
