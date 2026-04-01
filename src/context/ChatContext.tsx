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
import type { AgentOutputs } from "@/lib/agents/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type Message = {
  id: number;
  role: "bot" | "user";
  text: string;
  streaming?: boolean;
};

export type ContactData = {
  name: string;
  company_name: string;
  role: string;
  email: string;
  phone_or_messenger: string;
  website: string;
};

// Discriminated union yielded by the SSE parser
type SSEEvent =
  | { type: "text"; text: string }
  | { type: "state"; state: ConversationState }
  | { type: "agents"; agents: AgentOutputs };

type ChatContextValue = {
  sessionId: string;
  currentState: ConversationState;
  agentOutputs: AgentOutputs;
  contactData: ContactData | null;
  fileSummaries: string[];
  messages: Message[];
  isStreaming: boolean;
  isRestoring: boolean;
  showChips: boolean;
  dismissChips: () => void;
  sendMessage: (text: string) => void;
  analyzeFiles: (files: File[]) => void;
  forceState: (state: ConversationState) => void;
  submitContact: (data: ContactData) => void;
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
        } else if (parsed.agents && typeof parsed.agents === "object") {
          yield { type: "agents", agents: parsed.agents as AgentOutputs };
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

const LS_KEY = "pixelmate_session_id";

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [currentState, setCurrentState] = useState<ConversationState>("WELCOME");
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [showChips, setShowChips] = useState(true);
  const [agentOutputs, setAgentOutputs] = useState<AgentOutputs>({});
  const [fileSummaries, setFileSummaries] = useState<string[]>([]);
  const [contactData, setContactData] = useState<ContactData | null>(null);

  // Stable refs so async closures always see the latest values
  const isStreamingRef = useRef(false);
  const currentStateRef = useRef<ConversationState>("WELCOME");
  const agentOutputsRef = useRef<AgentOutputs>({});
  const fileSummariesRef = useRef<string[]>([]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  useEffect(() => {
    agentOutputsRef.current = agentOutputs;
  }, [agentOutputs]);

  useEffect(() => {
    fileSummariesRef.current = fileSummaries;
  }, [fileSummaries]);

  // ── Session restore on mount ───────────────────────────────────────────────
  //
  // 1. Read sessionId from localStorage.
  // 2. Fetch that session from Supabase via the restore route.
  // 3. If found and not DONE, hydrate all state from it.
  // 4. If not found / DONE / any error, generate a fresh session and persist it.

  useEffect(() => {
    async function restoreOrCreate() {
      const stored = localStorage.getItem(LS_KEY);

      if (stored) {
        try {
          const res = await fetch(`/api/session/${stored}`);
          if (res.ok) {
            const data = await res.json();
            // Don't restore completed sessions — start fresh
            if (data.current_state !== "DONE") {
              const restoredMessages: Message[] = Array.isArray(data.conversation_history)
                ? [
                    WELCOME,
                    ...data.conversation_history
                      .filter((m: { role: string }) => m.role !== "system")
                      .map(
                        (m: { role: string; content: string }, i: number) => ({
                          id: i + 1,
                          role: m.role === "assistant" ? "bot" : "user",
                          text: m.content,
                        } as Message)
                      ),
                  ]
                : [WELCOME];

              setSessionId(stored);
              setMessages(restoredMessages);
              setCurrentState(data.current_state as ConversationState);
              setAgentOutputs((data.agent_outputs as AgentOutputs) ?? {});
              setFileSummaries(
                Array.isArray(data.file_summaries) ? data.file_summaries : []
              );
              // Hide chips if there's real conversation history
              if (restoredMessages.length > 1) setShowChips(false);
              setIsRestoring(false);
              return;
            }
          }
        } catch {
          // Network error or bad JSON — fall through to fresh session
        }
      }

      // Fresh session — persist the new id
      const newId = crypto.randomUUID();
      setSessionId(newId);
      localStorage.setItem(LS_KEY, newId);
      setIsRestoring(false);
    }

    restoreOrCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist sessionId to localStorage whenever it changes
  useEffect(() => {
    if (!isRestoring) {
      localStorage.setItem(LS_KEY, sessionId);
    }
  }, [sessionId, isRestoring]);

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
            agentOutputs: agentOutputsRef.current,
            fileSummaries: fileSummariesRef.current,
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
          } else if (event.type === "agents") {
            setAgentOutputs(event.agents);
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

  const forceState = useCallback((state: ConversationState) => {
    currentStateRef.current = state;
    setCurrentState(state);
  }, []);

  const submitContact = useCallback(
    (data: ContactData) => {
      setContactData(data);
      // Build a readable summary so the bot has contact info in its history.
      // Do NOT forceState here — let the server receive currentState="CONTACT_CAPTURE"
      // so getNextState produces "OFFER_DRAFT" naturally, triggering runAgents to call
      // draftOffer before the stream opens.
      const parts = [
        `Name: ${data.name}`,
        `Company: ${data.company_name}`,
        data.role ? `Role: ${data.role}` : null,
        `Email: ${data.email}`,
        data.phone_or_messenger ? `Phone/Messenger: ${data.phone_or_messenger}` : null,
        data.website ? `Website: ${data.website}` : null,
      ].filter(Boolean);
      sendMessage(`Here are my contact details — ${parts.join(", ")}.`);
    },
    [sendMessage]
  );

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
        const newSummaries: string[] = [];

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
          newSummaries.push(`${filename}: ${summary}`);
        }

        // Accumulate file summaries for agent context
        if (newSummaries.length > 0) {
          setFileSummaries((prev) => [...prev, ...newSummaries]);
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
        agentOutputs,
        contactData,
        fileSummaries,
        messages,
        isStreaming,
        isRestoring,
        showChips,
        sendMessage,
        dismissChips,
        analyzeFiles,
        forceState,
        submitContact,
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
