"use client";

import { useChatContext } from "@/context/ChatContext";
import type { ConversationState } from "@/lib/stateMachine";

// ── Step definitions ───────────────────────────────────────────────────────

type Step = {
  label: string;
  percent: number; // 0–100, drives the progress line width
};

const STEP_MAP: Partial<Record<ConversationState, Step>> = {
  INTENT_CAPTURE:    { label: "Step 1: Understanding your goal",        percent: 17 },
  BUSINESS_CONTEXT:  { label: "Step 2: Learning about your business",   percent: 33 },
  PROBLEM_DISCOVERY: { label: "Step 3: Exploring the problem",          percent: 50 },
  GOAL_DISCOVERY:    { label: "Step 4: Defining the outcome",           percent: 67 },
  SERVICE_MATCH:     { label: "Step 5: Finding the right solution",     percent: 83 },
  CONTACT_CAPTURE:   { label: "Almost done: Your contact details",      percent: 95 },
};

export default function ProgressBar() {
  const { currentState } = useChatContext();

  const step = STEP_MAP[currentState];

  // Only render for the six mapped states
  if (!step) return null;

  return (
    <div
      className="w-full mx-auto mb-3"
      style={{ maxWidth: 680 }}
      role="status"
      aria-label={step.label}
    >
      {/* Label */}
      <p
        className="font-mono text-xs text-text-muted mb-2 tracking-wide"
        style={{
          animation: "pb-fadein 0.4s ease both",
        }}
      >
        {step.label}
      </p>

      {/* Track */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: 2,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        {/* Fill */}
        <div
          className="h-full rounded-full"
          style={{
            width: `${step.percent}%`,
            background: "#C8F560",
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 0 6px rgba(200,245,96,0.4)",
          }}
        />
      </div>

      <style>{`
        @keyframes pb-fadein {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
