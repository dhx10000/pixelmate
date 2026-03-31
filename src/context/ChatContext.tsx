"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type Message = {
  id: number;
  role: "bot" | "user";
  text: string;
  streaming?: boolean;
};

type ChatContextValue = {
  sessionId: string;
  messages: Message[];
  isStreaming: boolean;
  showChips: boolean;
  dismissChips: () => void;
  sendMessage: (text: string) => void;
};

// ── SSE helper ─────────────────────────────────────────────────────────────

async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.text === "string") yield parsed.text;
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ── Welcome message ────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: 0,
  role: "bot",
  text: "Hi! I'm PixelMate — PIXEL's AI assistant. Tell me about the challenge your business is facing, or pick one of the options below to get started.",
};

// ── Context ────────────────────────────────────────────────────────────────

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showChips, setShowChips] = useState(true);

  // Keep a stable ref to isStreaming so the async streamBotReply closure
  // always sees the latest value without needing it as a dependency.
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const streamBotReply = useCallback(
    async (history: Message[], sid: string) => {
      // Skip the welcome message (id 0) — it's UI-only, not part of the API conversation.
      // Anthropic requires messages to start with "user", so this keeps the history valid.
      const apiMessages = history
        .filter((m) => m.id !== 0)
        .map((m) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.text,
        }));

      setIsStreaming(true);

      const botId = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: botId, role: "bot", text: "", streaming: true },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, sessionId: sid }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        for await (const chunk of readSSEStream(reader)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botId ? { ...m, text: m.text + chunk } : m
            )
          );
        }
      } catch (err) {
        const errText =
          err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? { ...m, text: `Sorry, I ran into an issue: ${errText}` }
              : m
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, streaming: false } : m))
        );
        setIsStreaming(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (isStreamingRef.current) return;
      const userMsg: Message = { id: Date.now(), role: "user", text };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        streamBotReply(next, sessionId);
        return next;
      });
    },
    [sessionId, streamBotReply]
  );

  const dismissChips = useCallback(() => setShowChips(false), []);

  return (
    <ChatContext.Provider
      value={{ sessionId, messages, isStreaming, showChips, sendMessage, dismissChips }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
}
