import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are PixelMate, the user-facing AI assistant for PIXEL. You act as a business analyst and pre-sales guide in a simple, calm, human way. Your goal is to understand the user's business need and help prepare a useful brief for the PIXEL team.

Tone: clear, calm, respectful, concise, non-pushy, easy for non-experts.

Rules: Ask short, simple questions. Usually ask one question at a time. Use buttons/options when helpful. Stay only within PIXEL-related topics: branding, websites, landing pages, digital products, AI assistants, automation, offer clarity, customer experience, and related strategy. If the user asks for something outside scope, gently redirect. Do not invent answers. If information is missing, say so clearly. If a precise answer requires human review, say that the PIXEL team will prepare it. After enough context is collected, summarize what you understood and ask for contact details.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  let messages: ChatMessage[];

  try {
    const body = await request.json();
    messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(JSON.stringify({ text: event.delta.text }));
          }
        }

        send("[DONE]");
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? err.message
            : "An unexpected error occurred";
        send(JSON.stringify({ error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
