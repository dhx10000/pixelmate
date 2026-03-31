"use client";

import { useEffect, useRef, useState } from "react";

// ── Icons ──────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 1.5L9.2 6.8L14.5 8L9.2 9.2L8 14.5L6.8 9.2L1.5 8L6.8 6.8L8 1.5Z"
        fill="#0A0A0C"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05L12.25 20.24a6 6 0 0 1-8.49-8.49L14.5 1.01a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type Message = {
  id: number;
  role: "bot" | "user";
  text: string;
};

// ── Subcomponents ──────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent"
      aria-hidden="true"
    >
      <SparkleIcon />
    </div>
  );
}

function BotMessage({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-text-primary"
        style={{ background: "#18181C", maxWidth: "80%" }}
      >
        {text}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed text-bg-deep font-medium"
        style={{ background: "#C8F560", maxWidth: "80%" }}
      >
        {text}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: 0,
  role: "bot",
  text: "Hi! I'm PixelMate — PIXEL's AI assistant. Tell me about the challenge your business is facing, or pick one of the options below to get started.",
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: prev.length, role: "user", text },
    ]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="w-full mx-auto flex flex-col overflow-hidden"
      style={{
        maxWidth: 680,
        background: "#111114",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
      }}
    >
      {/* Message list */}
      <div className="flex flex-col gap-4 overflow-y-auto px-5 py-6 flex-1 min-h-0" style={{ maxHeight: 420 }}>
        {messages.map((msg) =>
          msg.role === "bot" ? (
            <BotMessage key={msg.id} text={msg.text} />
          ) : (
            <UserMessage key={msg.id} text={msg.text} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* Input bar */}
      <div className="px-4 py-4">
        <div
          className="flex items-end gap-2 rounded-full px-4 py-2.5"
          style={{
            background: "#1E1E24",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Mic button */}
          <button
            type="button"
            aria-label="Voice input"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-secondary"
          >
            <MicIcon />
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your challenge..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none leading-relaxed py-1"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              // Auto-grow textarea
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />

          {/* Paperclip button */}
          <button
            type="button"
            aria-label="Attach file"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-secondary"
          >
            <PaperclipIcon />
          </button>

          {/* Send button */}
          <button
            type="button"
            aria-label="Send message"
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bg-deep transition-opacity disabled:opacity-30"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
