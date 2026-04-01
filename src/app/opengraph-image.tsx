import { ImageResponse } from "next/og";

// ── Metadata ───────────────────────────────────────────────────────────────

export const alt = "PixelMate — AI Business Analyst by PIXEL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Image ──────────────────────────────────────────────────────────────────
//
// Rendered server-side using satori (subset of CSS — no grid, no box-shadow
// shorthand, percentages only on border-radius). All values are explicit.

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0C",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* Subtle grid texture — thin lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "28px",
          }}
        >
          {/* Green dot */}
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "6px",
              background: "#C8F560",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              letterSpacing: "0.25em",
              color: "#9A9590",
              textTransform: "uppercase",
            }}
          >
            PIXEL
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "80px",
            fontWeight: 700,
            color: "#E8E4DD",
            textAlign: "center",
            lineHeight: 1.05,
            marginBottom: "20px",
            letterSpacing: "-0.02em",
          }}
        >
          PixelMate
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "26px",
            color: "#9A9590",
            textAlign: "center",
          }}
        >
          AI Business Analyst by PIXEL
        </div>

        {/* Accent line */}
        <div
          style={{
            width: "48px",
            height: "3px",
            background: "#C8F560",
            marginTop: "44px",
            borderRadius: "2px",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
