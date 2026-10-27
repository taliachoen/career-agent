import { he } from "../lib/strings.he";

export type ScoreBand = "high" | "mid" | "low";

export function scoreBand(score: number): ScoreBand {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

const BAND_STYLES: Record<ScoreBand, string> = {
  high: "border-emerald-300 bg-emerald-100 text-emerald-900",
  mid: "border-amber-300 bg-amber-100 text-amber-900",
  low: "border-rose-300 bg-rose-100 text-rose-900",
};

// The number is always shown: the colour alone never carries the meaning.
export function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span
      data-band={band}
      className={`inline-flex min-w-11 shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums ${BAND_STYLES[band]}`}
    >
      <span className="sr-only">{he.scoring.scoreLabel} </span>
      {score}
    </span>
  );
}
