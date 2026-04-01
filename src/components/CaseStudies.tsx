"use client";

import { motion } from "framer-motion";
import { caseStudies, type CaseStudy } from "@/data/caseStudies";

// ── Animation ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 10, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
};

// ── Sparkle icon (matches BotAvatar in ChatWindow) ─────────────────────────

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L9.2 6.8L14.5 8L9.2 9.2L8 14.5L6.8 9.2L1.5 8L6.8 6.8L8 1.5Z" fill="#0A0A0C" />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ background: "#C8F560" }}
      aria-hidden="true"
    >
      <SparkleIcon />
    </div>
  );
}

// ── External link icon ─────────────────────────────────────────────────────

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Single case study card ─────────────────────────────────────────────────

function CaseStudyCard({ study }: { study: CaseStudy }) {
  const content = (
    <div
      className="rounded-xl p-3.5 text-sm transition-colors"
      style={{
        background: "#18181C",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Industry tag */}
      <span
        className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide mb-2"
        style={{
          background: "rgba(200,245,96,0.1)",
          border: "1px solid rgba(200,245,96,0.2)",
          color: "#C8F560",
        }}
      >
        {study.industry}
      </span>

      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-medium text-text-primary leading-snug">{study.title}</p>
        {study.link && (
          <span className="shrink-0 mt-0.5" style={{ color: "#9A9590" }}>
            <ExternalLinkIcon />
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-text-muted leading-relaxed text-[12.5px]">{study.summary}</p>
    </div>
  );

  if (study.link) {
    return (
      <motion.a
        href={study.link}
        target="_blank"
        rel="noopener noreferrer"
        variants={cardVariants}
        className="block focus:outline-none"
        onMouseEnter={(e) => {
          const card = e.currentTarget.firstElementChild as HTMLElement;
          if (card) card.style.borderColor = "rgba(200,245,96,0.2)";
        }}
        onMouseLeave={(e) => {
          const card = e.currentTarget.firstElementChild as HTMLElement;
          if (card) card.style.borderColor = "rgba(255,255,255,0.07)";
        }}
      >
        {content}
      </motion.a>
    );
  }

  return <motion.div variants={cardVariants}>{content}</motion.div>;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CaseStudies() {
  const hasStudies = caseStudies.length > 0;

  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <BotAvatar />

      <div className="flex-1 min-w-0">
        {/* Bot message bubble */}
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed mb-3"
          style={{
            background: "#18181C",
            color: "#E8E4DD",
            display: "inline-block",
            maxWidth: "100%",
          }}
        >
          {hasStudies
            ? "Here are some projects that might be relevant to what you're building:"
            : "Case studies are being prepared. The PIXEL team will include relevant examples in your proposal."}
        </div>

        {/* Case study cards — only rendered when data is available */}
        {hasStudies && (
          <motion.div
            className="flex flex-col gap-2.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {caseStudies.map((study) => (
              <CaseStudyCard key={study.id} study={study} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
