export const PILOT_STAGES = ["pricing", "quote", "costs", "payment", "delivery", "other"] as const;
export type PilotStage = (typeof PILOT_STAGES)[number];

export const PILOT_STAGE_LABELS: Record<PilotStage, string> = {
  pricing: "Pricing an order",
  quote: "Sharing the quote",
  costs: "Tracking costs",
  payment: "Recording payment",
  delivery: "Completing delivery",
  other: "Something else",
};

export type PilotFeedbackInput = {
  stage: PilotStage;
  easeScore: number;
  blocker: string;
  workedWell: string;
};

export function parsePilotFeedback(value: unknown): PilotFeedbackInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.stage !== "string" || !PILOT_STAGES.includes(input.stage as PilotStage)) return null;
  if (!Number.isInteger(input.easeScore) || (input.easeScore as number) < 1 || (input.easeScore as number) > 5) return null;
  if (typeof input.blocker !== "string" || typeof input.workedWell !== "string") return null;
  const blocker = input.blocker.trim();
  const workedWell = input.workedWell.trim();
  if (blocker.length < 10 || blocker.length > 1200 || workedWell.length > 1200) return null;
  return { stage: input.stage as PilotStage, easeScore: input.easeScore as number, blocker, workedWell };
}
