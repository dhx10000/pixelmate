"use client";

import { motion } from "framer-motion";
import { useChatContext } from "@/context/ChatContext";

// ── Service label map ──────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  brand_identity: "Brand Identity",
  website_landing: "Website & Landing Pages",
  ai_assistant: "AI Assistant",
  business_automation: "Business Automation",
  offer_messaging: "Offer & Messaging",
  audit_strategy: "Audit & Strategy",
  custom_digital_solution: "Custom Digital Solution",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SummaryCard() {
  const { agentOutputs, forceState, sendMessage } = useChatContext();
  const { brief, services } = agentOutputs;

  if (!brief || !services?.top_match) return null;

  // Build service labels from all matched services above the confidence threshold
  const serviceLabels = services.matches
    .filter((m) => m.confidence >= 0.5)
    .map((m) => SERVICE_LABELS[m.service] ?? m.service);

  const servicesText =
    serviceLabels.length > 1
      ? `${serviceLabels.slice(0, -1).join(", ")} and ${serviceLabels[serviceLabels.length - 1]}`
      : serviceLabels[0] ?? SERVICE_LABELS[services.top_match] ?? services.top_match;

  // What's still needed — prefer service-level missing info, fall back to brief unknowns
  const topMatch = services.matches[0];
  const missingText =
    topMatch?.what_is_missing && topMatch.what_is_missing.toLowerCase() !== "nothing"
      ? topMatch.what_is_missing
      : brief.unknowns.length > 0
        ? brief.unknowns.join("; ")
        : "nothing specific at this stage";

  function handleConfirm() {
    forceState("CONTACT_CAPTURE");
    sendMessage("Everything looks right — let's continue.");
  }

  function handleClarify() {
    forceState("PROBLEM_DISCOVERY");
    sendMessage("Let me clarify something about my situation.");
  }

  return (
    <motion.div
      className="rounded-2xl p-4 sm:p-5 text-sm leading-relaxed"
      style={{
        background: "#18181C",
        border: "1px solid rgba(200,245,96,0.15)",
        marginTop: 4,
      }}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Summary text */}
      <p className="text-text-primary mb-3">
        From what you shared, I understand that{" "}
        <span className="text-text-primary font-medium">{brief.business_summary}</span>
      </p>

      <p className="text-text-secondary mb-3">
        Your main goal is{" "}
        <span className="text-text-primary">
          {brief.desired_outcome !== "UNKNOWN" ? brief.desired_outcome : "still being defined"}
        </span>
        .
      </p>

      <p className="text-text-secondary mb-3">
        Based on that, PIXEL may be able to help with{" "}
        <span className="text-accent font-medium">{servicesText}</span>.
      </p>

      <p className="text-text-secondary mb-5">
        To prepare a precise proposal, the team would still need{" "}
        <span className="text-text-primary">{missingText}</span>.
      </p>

      {/* Divider */}
      <div
        className="mb-4"
        style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-full px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
          style={{
            background: "#C8F560",
            color: "#0A0A0C",
          }}
        >
          Everything looks right
        </button>

        <button
          type="button"
          onClick={handleClarify}
          className="rounded-full px-4 py-2 text-xs font-medium transition-colors"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#9A9590",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(200,245,96,0.3)";
            e.currentTarget.style.color = "#E8E4DD";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color = "#9A9590";
          }}
        >
          Let me clarify something
        </button>
      </div>
    </motion.div>
  );
}
