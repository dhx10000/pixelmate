// ── Case Study data ────────────────────────────────────────────────────────
//
// To add case studies, push entries into this array following the CaseStudy
// interface below. Each entry will automatically render as a compact card
// in the chat when a user requests "Show similar cases".
//
// Example entry:
//
//   {
//     id: "cs-001",
//     title: "E-commerce Rebrand & Growth Platform",
//     industry: "Retail",
//     services_used: ["brand_identity", "website_landing", "business_automation"],
//     summary:
//       "Helped a DTC fashion brand unify their visual identity and build a "
//       + "conversion-optimised storefront that cut cart abandonment by 34%.",
//     image_url: "/case-studies/cs-001.jpg",
//     link: "https://pixelsite.ai/work/cs-001",
//   },

export interface CaseStudy {
  /** Unique identifier — used as React key */
  id: string;
  /** Short project title shown as the card heading */
  title: string;
  /** Client industry for the industry tag (e.g. "Retail", "SaaS", "Healthcare") */
  industry: string;
  /** PIXEL service keys used on the engagement — matches SERVICE_LABELS in SummaryCard */
  services_used: string[];
  /** One or two sentences shown in the card body */
  summary: string;
  /** Optional hero image path or URL */
  image_url?: string;
  /** Optional deep-link to the full case study page */
  link?: string;
}

// Populate this array to enable case study cards in the PixelMate chat.
// Leave empty to show the "being prepared" placeholder instead.
export const caseStudies: CaseStudy[] = [];
