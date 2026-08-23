"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useJoyride, STATUS } from "react-joyride";
import {
  firstEncodingEntry,
  headTour,
  teacherTour,
  type TourStep,
} from "@/lib/tour/steps.ts";
import { useTourStore } from "@/lib/tour/store.ts";
import { markTourSeen } from "./actions.ts";
import { TourLoader } from "./tour-loader.tsx";
import { TourBeacon } from "./tour-beacon.tsx";

const MOBILE_GATE_QUERY = "(min-width: 768px)";

/** Polls a predicate on the next-paint cadence rather than a fixed interval,
 * so the wait resolves as soon as App Router's client navigation lands. */
function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    function tick() {
      if (predicate() || performance.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

function canRunTour(): boolean {
  return window.matchMedia(MOBILE_GATE_QUERY).matches;
}

/**
 * The app's own content region (see #app-scroll-region in
 * app/(authenticated)/layout.tsx) scrolls independently of the window.
 * Next.js only resets *window* scroll on navigation, so without this a step
 * reached right after a deep scroll on the previous page (e.g. the bottom of
 * a long dashboard) opens still scrolled to that old offset — Joyride then
 * computes its scroll-into-view from the wrong starting position.
 */
function resetScrollRegion() {
  document.getElementById("app-scroll-region")?.scrollTo({ top: 0, behavior: "instant" });
}

export function GuidedTour({
  isHead,
  allowedGrades,
  hasSeenTour,
  sampleLearnerId,
}: {
  isHead: boolean;
  allowedGrades: number[];
  hasSeenTour: boolean;
  sampleLearnerId: string | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState(false);
  const markedRef = useRef(false);
  const requestId = useTourStore((s) => s.requestId);
  const initialRequestId = useRef(requestId);

  const tourSteps = useMemo<TourStep[]>(
    () =>
      isHead
        ? headTour(allowedGrades, sampleLearnerId)
        : teacherTour(firstEncodingEntry(allowedGrades), sampleLearnerId),
    [isHead, allowedGrades, sampleLearnerId]
  );

  const steps = useMemo(
    () =>
      tourSteps.map((s) => ({
        target: s.target,
        title: s.title,
        content: s.body,
        placement: s.placement ?? "bottom",
        hideOverlay: s.live ?? false,
        before: async () => {
          const path = s.route.split("?")[0];
          if (window.location.pathname !== path) {
            router.push(s.route);
            await waitFor(() => window.location.pathname === path, 8000);
            // Lets the new route's RSC payload paint before the tour starts
            // probing for the step's target.
            await new Promise((resolve) => setTimeout(resolve, 60));
            resetScrollRegion();
          }
        },
      })),
    [tourSteps, router]
  );

  const { Tour } = useJoyride({
    continuous: true,
    run,
    steps,
    scrollToFirstStep: true,
    loaderComponent: TourLoader,
    beaconComponent: TourBeacon,
    options: {
      showProgress: true,
      buttons: ["back", "skip", "primary"],
      targetWaitTimeout: 5000,
      beforeTimeout: 9000,
      primaryColor: "#059669",
    },
    onEvent: (data) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        setRun(false);
        if (!markedRef.current) {
          markedRef.current = true;
          void markTourSeen();
        }
      }
    },
  });

  // First login: auto-start once, desktop-width only. Has to happen after
  // mount — matchMedia doesn't exist during SSR, and reading it during the
  // initial render would make the client tree disagree with the server HTML.
  useEffect(() => {
    if (hasSeenTour) return;
    if (!canRunTour()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(true);
    // Only ever the initial mount's hasSeenTour value matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Take the tour" — from the sidebar or Help, on any page, any time.
  // Syncs local run state from the zustand store's requestId, which a
  // different component (TakeTourButton) bumps.
  useEffect(() => {
    if (requestId === initialRequestId.current) return;
    if (!canRunTour()) {
      toast("The tour needs a wider screen. Use the printable reference on Help instead.");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(true);
  }, [requestId]);

  return Tour;
}
