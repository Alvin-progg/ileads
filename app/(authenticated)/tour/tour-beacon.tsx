import type { BeaconRenderProps } from "react-joyride";

/**
 * A bare pulsing dot doesn't read as "click here" to someone who has never
 * used a spotlight tour before — this labels it. Joyride only ever shows the
 * beacon on the tour's very first step (every step reached via Next/Back in
 * continuous mode skips straight to the tooltip), so this is effectively the
 * tour's "Start" marker.
 */
export function TourBeacon({ size }: BeaconRenderProps) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ height: size, width: size }}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/50" />
      <span className="absolute inset-[25%] rounded-full bg-emerald-600" />
      <span className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-white shadow-md">
        Start here
      </span>
    </span>
  );
}
