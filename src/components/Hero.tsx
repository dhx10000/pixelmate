"use client";

import { useEffect, useRef } from "react";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Trigger fade-up by removing the initial hidden state
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
      className="w-full max-w-2xl mx-auto px-6 pt-16 pb-10 text-center"
    >
      {/* Logo row */}
      <div className="flex items-center justify-center gap-2.5 mb-8">
        {/* Glowing green dot */}
        <span
          className="block h-2 w-2 rounded-full bg-accent"
          style={{
            boxShadow: "0 0 6px 2px #C8F560",
          }}
        />
        <span className="font-mono text-xs tracking-[0.3em] text-text-secondary uppercase">
          PIXEL
        </span>
      </div>

      {/* Headline */}
      <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight text-text-primary mb-4">
        Describe your challenge.{" "}
        <span className="text-accent">PixelMate</span> will help.
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-lg mx-auto">
        PIXEL&apos;s AI assistant will ask a few simple questions, review your
        materials, and prepare a clear brief for the team.
      </p>
    </div>
  );
}
