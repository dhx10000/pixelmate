"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConversationState } from "@/lib/stateMachine";

// ── Types ──────────────────────────────────────────────────────────────────

export type Message = {
  id: number;
  role: "bot" | "user";
  text: string;
  streaming?: boolean;
};

// Discriminated union yielded by the SSE parser
type SSEEvent =
  | { type: "text"; text: string }
  | { type: "state"; state: ConversationState };

type ChatContextValue = {
  sessionId: string;
  currentState: ConversationState;
  messages: Message[];
  isStreaming: boolean;
  showChips: boolean;
  dismissChips: () => void;
  sendMessage: (text: string) => void;
  analyzeFiles: (files: File[]) => void;
};

// ── SSE helper ─────────────────────────────────────────────────────────────

async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
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
        if (typeof parsed.text === "string") {
          yield { type: "text", text: parsed.text };
        } else if (typeof parsed.state === "string") {
          yield { type: "state", state: parsed.state as ConversationState };
        }
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
  const [currentState, setCurrentState] = useState<ConversationState>("WELCOME");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showChips, setShowChips] = useState(true);

  // Stable ref so the async closure always sees the latest values
  const isStreamingRef = useRef(false);
  const currentStateRef = useRef<ConversationState>("WELCOME");

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  const streamBotReply = useCallback(
    async (history: Message[], sid: string) => {
      // Build API payload — skip the welcome message (UI-only).
      // Anthropic requires messages to start with "user".
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
          body: JSON.stringify({
            messages: apiMessages,
            sessionId: sid,
            currentState: currentStateRef.current,
          }),
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        for await (const event of readSSEStream(reader)) {
          if (event.type === "text") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botId ? { ...m, text: m.text + event.text } : m
              )
            );
          } else if (event.type === "state") {
            setCurrentState(event.state);
          }
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

  const analyzeFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    // Run async without blocking — state updates happen inside
    (async () => {
      setIsStreaming(true);
      const botId = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: botId, role: "bot", text: "", streaming: true },
      ]);

      try {
        const results: string[] = [];

        for (const file of files) {
          // 1. Upload
          const form = new FormData();
          form.append("file", file);
          const upRes = await fetch("/api/files/upload", {
            method: "POST",
            body: form,
          });
          if (!upRes.ok) {
            const { error } = await upRes.json();
            results.push(`**${file.name}** — upload failed: ${error}`);
            continue;
          }
          const { file_id, ext, filename, type } = await upRes.json();

          // 2. Analyze
          const anRes = await fetch("/api/files/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_id, ext, filename, type }),
          });
          if (!anRes.ok) {
            const { error } = await anRes.json();
            results.push(`**${file.name}** — analysis failed: ${error}`);
            continue;
          }
          const { summary, questions } = await anRes.json();
          const qs = (questions as string[]).map((q, i) => `${i + 1}. ${q}`).join("\n");
          results.push(`**${filename}**\n${summary}\n\n${qs}`);
        }

        const fullText =
          (files.length > 1 ? "I've reviewed your files:\n\n" : "I've reviewed your file.\n\n") +
          results.join("\n\n---\n\n");

        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: fullText } : m))
        );
        setCurrentState("FILE_REVIEW");
      } catch (err) {
        const errText = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? { ...m, text: `Sorry, I couldn't analyse the file(s): ${errText}` }
              : m
          )
        );
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, streaming: false } : m))
        );
        setIsStreaming(false);
      }
    })();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        sessionId,
        currentState,
        messages,
        isStreaming,
        showChips,
        sendMessage,
        dismissChips,
        analyzeFiles,
      }}
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
