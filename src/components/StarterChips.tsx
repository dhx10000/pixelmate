"use client";

import { useEffect, useState } from "react";

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

const ALL_CHIPS_COUNT = PRIMARY_CHIPS.length + SECONDARY_CHIPS.length;

type Props = {
  onSelect: (text: string) => void;
};

export default function StarterChips({ onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Trigger entrance on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClick(text: string) {
    if (exiting) return;
    setExiting(true);
    // Wait for exit animation before sending the message
    setTimeout(() => onSelect(text), 280);
  }

  function chipStyle(index: number): React.CSSProperties {
    const delay = exiting ? 0 : index * 50;
    const opacity = exiting ? 0 : visible ? 1 : 0;
    const translateY = exiting ? 6 : visible ? 0 : 10;
    return {
      opacity,
      transform: `translateY(${translateY}px)`,
      transition: `opacity 0.25s ease ${delay}ms, transform 0.25s ease ${delay}ms`,
    };
  }

  // For the label, stagger after all chips
  const labelStyle: React.CSSProperties = {
    opacity: exiting ? 0 : visible ? 1 : 0,
    transition: `opacity 0.25s ease ${exiting ? 0 : ALL_CHIPS_COUNT * 10}ms`,
  };

  return (
    <div className="mt-3 ml-11">
      {/* Label */}
      <p
        className="font-mono text-xs text-text-muted mb-3 tracking-wide"
        style={labelStyle}
      >
        Where shall we start?
      </p>

      {/* Primary chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRIMARY_CHIPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => handleClick(label)}
            className="group rounded-full px-3.5 py-1.5 text-xs text-text-secondary transition-colors"
            style={{
              ...chipStyle(i),
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(200,245,96,0.07)";
              e.currentTarget.style.borderColor = "rgba(200,245,96,0.2)";
              e.currentTarget.style.color = "#E8E4DD";
              e.currentTarget.style.transform = chipStyle(i).transform
                ? `translateY(${parseFloat((chipStyle(i).transform as string).replace("translateY(", "")) - 1}px)`
                : "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "";
              e.currentTarget.style.transform = chipStyle(i).transform as string;
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Secondary chips (dashed border) */}
      <div className="flex flex-wrap gap-2">
        {SECONDARY_CHIPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => handleClick(label)}
            className="rounded-full px-3.5 py-1.5 text-xs text-text-muted transition-colors"
            style={{
              ...chipStyle(PRIMARY_CHIPS.length + i),
              background: "transparent",
              border: "1px dashed rgba(255,255,255,0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(200,245,96,0.07)";
              e.currentTarget.style.borderColor = "rgba(200,245,96,0.3)";
              e.currentTarget.style.color = "#E8E4DD";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              e.currentTarget.style.color = "";
              e.currentTarget.style.transform = chipStyle(
                PRIMARY_CHIPS.length + i
              ).transform as string;
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
