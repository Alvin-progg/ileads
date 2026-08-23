"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useJoyride, STATUS, EVENTS } from "react-joyride";
import { headTour, teacherTour, type TourStep } from "@/lib/tour/steps.ts";
import { useTourStore } from "@/lib/tour/store.ts";
import { markTourSeen } from "./actions.ts";
import { TourLoader } from "./tour-loader.tsx";
import { TourBeacon } from "./tour-beacon.tsx";

const MOBILE_GATE_QUERY = "(min-width: 768px)";

/**
 * Polls a predicate every 30ms until it passes or timeoutMs elapses.
 * setTimeout rather than requestAnimationFrame: rAF callbacks simply don't
 * run while a tab is backgrounded, which would make both the poll *and its
 * own timeout* hang indefinitely if the user tabbed away mid-navigation.
 */
function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    function tick() {
      if (predicate() || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 30);
    }
    tick();
  });
}

function canRunTour(): boolean {
  return window.matchMedia(MOBILE_GATE_QUERY).matches;
}

/**
 * #app-scroll-region (app/(authenticated)/layout.tsx) carries an
 * overflow-y-auto class, but its flex-1 parent has no bounded height, so it
 * grows to fit its content instead of clipping it — it never actually
 * develops internal overflow. The page really scrolls at the document level.
 * Joyride's own scroll-into-view picks the *nearest ancestor with an
 * overflow-auto style* as the "scroll parent" regardless of whether it
 * currently overflows — finds that div, sees scrollHeight === clientHeight,
 * concludes there's nothing to scroll, and silently does nothing. That's
 * invisible for a target near the top of a page (nothing needed scrolling
 * anyway) and total for one near the bottom of a long one (the card renders
 * thousands of pixels below the viewport). `skipScroll` below turns
 * Joyride's own attempt off entirely so this can't fight with our own scroll.
 */
function scrollTargetIntoView(target: string) {
  document.querySelector(target)?.scrollIntoView({ block: "center", behavior: "instant" });
}

/**
 * Centering the *target* doesn't guarantee the tooltip *card* — anchored
 * beside it, and taller for 'top'/'bottom' placements — ends up fully within
 * the viewport too. Once the tooltip has actually rendered (EVENTS.TOOLTIP,
 * after positioning has settled, so this can't race it), nudge the real
 * document scroll by however much of the card is clipped top or bottom.
 */
async function ensureTooltipFullyVisible() {
  // A brief settle delay for the DOM/layout to catch up with the event.
  // setTimeout rather than requestAnimationFrame: rAF callbacks don't run at
  // all while a tab is backgrounded (e.g. the user alt-tabbed away exactly
  // when clicking Next), which would leave this hung indefinitely.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const floater = document.querySelector(".react-joyride__floater") as HTMLElement | null;
  if (!floater) return;

  const rect = floater.getBoundingClientRect();
  const margin = 16;

  // instant, not smooth: a smooth scroll only animates via the same
  // compositor frame loop requestAnimationFrame relies on, so it can stall
  // the same way in a backgrounded tab. scrollTargetIntoView above already
  // used instant for the same reason.
  if (rect.top < margin) {
    window.scrollBy({ top: rect.top - margin, behavior: "instant" });
  } else if (rect.bottom > window.innerHeight - margin) {
    window.scrollBy({ top: rect.bottom - (window.innerHeight - margin), behavior: "instant" });
  }
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
        : teacherTour(allowedGrades, sampleLearnerId),
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
          }
          scrollTargetIntoView(s.target);
        },
      })),
    [tourSteps, router]
  );

  const { Tour } = useJoyride({
    continuous: true,
    run,
    steps,
    loaderComponent: TourLoader,
    beaconComponent: TourBeacon,
    options: {
      showProgress: true,
      buttons: ["back", "skip", "primary"],
      targetWaitTimeout: 5000,
      beforeTimeout: 9000,
      primaryColor: "#059669",
      // Joyride's own scroll-into-view misdetects #app-scroll-region as the
      // scroll parent (see scrollTargetIntoView above) and no-ops on deep
      // targets. We scroll ourselves in `before` instead.
      skipScroll: true,
    },
    onEvent: (data) => {
      if (data.type === EVENTS.TOOLTIP) {
        void ensureTooltipFullyVisible();
      }
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
