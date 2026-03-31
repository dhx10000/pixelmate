import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

// Give Claude extra time for vision / PDF parsing
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type UploadedFile = {
  file_id: string;
  ext: string;
  filename: string;
  type: string;
};

const SYSTEM_PROMPT =
  "You are PixelMate, a pre-sales analyst for PIXEL — a digital agency. " +
  "Review the uploaded file and provide a concise, grounded analysis that helps " +
  "understand the user's business needs. Be specific to what you observe, not generic.";

const INSTRUCTIONS =
  "Provide a short summary (2–4 sentences) of what you observe that is relevant " +
  "to a business brief — branding, website, product, services, or audience. " +
  "Then ask 2–3 targeted follow-up questions to deepen understanding. " +
  "Format exactly as:\nSUMMARY\n[summary text]\n\nQUESTIONS\n1. [question]\n2. [question]\n3. [question]";

function parseResponse(text: string): { summary: string; questions: string[] } {
  const summaryMatch = text.match(/SUMMARY\s*\n([\s\S]*?)(?=\n\nQUESTIONS|$)/i);
  const questionsMatch = text.match(/QUESTIONS\s*\n([\s\S]*)/i);

  const summary = summaryMatch?.[1]?.trim() ?? text.trim();
  const questionsBlock = questionsMatch?.[1]?.trim() ?? "";
  const questions = questionsBlock
    .split(/\n\d+\.\s+/)
    .filter(Boolean)
    .map((q) => q.trim());

  return { summary, questions };
}

export async function POST(request: Request) {
  let body: UploadedFile;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { file_id, ext, filename, type } = body;
  if (!file_id || !filename || !type) {
    return Response.json(
      { error: "file_id, filename, and type are required" },
      { status: 400 }
    );
  }

  // DOC / DOCX / PPTX — Claude can't parse these binary formats natively
  const unreadableTypes = new Set([
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]);
  if (unreadableTypes.has(type)) {
    return Response.json({
      summary: `I received your file "${filename}". I can't read ${ext.toUpperCase()} files directly, but I've noted it's been shared.`,
      questions: [
        "Could you briefly describe what this document contains?",
        "What's the main goal or message in this file?",
        "Is there a specific section you'd like us to focus on?",
      ],
    });
  }

  // Read the stored file
  const filePath = join(tmpdir(), "pixelmate-uploads", `${file_id}.${ext}`);
  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(filePath);
  } catch {
    return Response.json(
      { error: "File not found — it may have expired" },
      { status: 404 }
    );
  }

  const base64 = fileBytes.toString("base64");

  // Build content blocks based on file type
  let content: Anthropic.MessageParam["content"];

  if (type.startsWith("image/")) {
    const mediaType = type as "image/png" | "image/jpeg" | "image/webp";
    content = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      },
      { type: "text", text: `File: "${filename}"\n\n${INSTRUCTIONS}` },
    ];
  } else {
    // PDF — use document block
    content = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf" as const,
          data: base64,
        },
      } as unknown as Anthropic.TextBlockParam,
      { type: "text", text: `File: "${filename}"\n\n${INSTRUCTIONS}` },
    ];
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const raw =
      response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text ?? "";

    return Response.json(parseResponse(raw));
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? err.message : "Analysis failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
