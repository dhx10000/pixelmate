"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY_CHIPS = [
  "I need a website or landing page",
  "I want to automate part of my business",
  "I need an AI assistant",
  "I want to improve my brand & packaging",
  "I'm not sure what I need yet",
  "I want an audit of my current site",
];

const SECONDARY_CHIPS = [
  "Record voice",
  "Upload files",
  "Start with 3 quick questions",
];

type Props = {
  onSelect: (text: string) => void;
};

// ── Animation variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
  exit:   { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

const chipVariants = {
  hidden:  { opacity: 0, scale: 0.94, y: 6 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  exit:    { opacity: 0, scale: 0.96, y: 4, transition: { duration: 0.18, ease: "easeIn"  as const } },
};

const labelVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, delay: 0.04 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function StarterChips({ onSelect }: Props) {
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  function handleClick(text: string) {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      setGone(true);
      onSelect(text);
    }, 260);
  }

  if (gone) return null;

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          className="mt-3 ml-11"
          variants={containerVariants}
          initial="hidden"
          animate={exiting ? "exit" : "visible"}
        >
          {/* Label */}
          <motion.p
            className="font-mono text-xs text-text-muted mb-3 tracking-wide"
            variants={labelVariants}
          >
            Where shall we start?
          </motion.p>

          {/* Primary chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {PRIMARY_CHIPS.map((label) => (
              <motion.button
                key={label}
                type="button"
                onClick={() => handleClick(label)}
                variants={chipVariants}
                whileHover={{ y: -1 }}
                className="rounded-full px-3 py-1 text-[12.5px] text-text-secondary sm:px-3.5 sm:py-1.5 sm:text-xs"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(200,245,96,0.07)";
                  e.currentTarget.style.borderColor = "rgba(200,245,96,0.2)";
                  e.currentTarget.style.color = "#E8E4DD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "";
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>

          {/* Secondary chips (dashed border) */}
          <div className="flex flex-wrap gap-2">
            {SECONDARY_CHIPS.map((label) => (
              <motion.button
                key={label}
                type="button"
                onClick={() => handleClick(label)}
                variants={chipVariants}
                whileHover={{ y: -1 }}
                className="rounded-full px-3 py-1 text-[12.5px] text-text-muted sm:px-3.5 sm:py-1.5 sm:text-xs"
                style={{
                  background: "transparent",
                  border: "1px dashed rgba(255,255,255,0.15)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(200,245,96,0.07)";
                  e.currentTarget.style.borderColor = "rgba(200,245,96,0.3)";
                  e.currentTarget.style.color = "#E8E4DD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.color = "";
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
