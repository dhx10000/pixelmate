"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StarterChips from "./StarterChips";
import SummaryCard from "./SummaryCard";
import ContactForm from "./ContactForm";
import OfferCard from "./OfferCard";
import VoiceInput, { type VoiceInputHandle } from "./VoiceInput";
import {
  FileDropZone,
  FilePreviewList,
  type FileUploadHandle,
} from "./FileUpload";
import { useChatContext } from "@/context/ChatContext";

// ── Icons ──────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L9.2 6.8L14.5 8L9.2 9.2L8 14.5L6.8 9.2L1.5 8L6.8 6.8L8 1.5Z" fill="#0A0A0C" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05L12.25 20.24a6 6 0 0 1-8.49-8.49L14.5 1.01a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ── Message subcomponents ──────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent" aria-hidden="true">
      <SparkleIcon />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3.5"
        style={{ background: "#18181C" }}
        aria-label="PixelMate is typing"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-text-muted"
            style={{
              animation: "pixelmate-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
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
        className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed font-medium"
        style={{
          background: "rgba(200,245,96,0.12)",
          border: "1px solid rgba(200,245,96,0.2)",
          color: "#E8E4DD",
          maxWidth: "80%",
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatWindow() {
  const { messages, isStreaming, isRestoring, currentState, agentOutputs, showChips, sendMessage, dismissChips, analyzeFiles } =
    useChatContext();

  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<VoiceInputHandle>(null);
  const fileRef = useRef<FileUploadHandle>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleNewFiles = useCallback((files: File[]) => {
    const newFiles: File[] = [];
    setUploadedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const deduped = files.filter((f) => !existing.has(`${f.name}-${f.size}`));
      newFiles.push(...deduped);
      return [...prev, ...deduped];
    });
    // Trigger analysis after dedup — runs after state update settles
    setTimeout(() => {
      if (newFiles.length > 0) analyzeFiles(newFiles);
    }, 0);
  }, [analyzeFiles]);

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(text);
  }

  function handleTranscript(text: string) {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }

  function handleChipSelect(text: string) {
    dismissChips();
    if (text === "Record voice") {
      voiceRef.current?.start();
      return;
    }
    if (text === "Upload files") {
      fileRef.current?.open();
      return;
    }
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <style>{`
        @keyframes pixelmate-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* FileDropZone wraps the whole chat card so drag works over all of it */}
      <FileDropZone
        ref={fileRef}
        onFiles={handleNewFiles}
      >
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
          <div
            className="flex flex-col gap-4 overflow-y-auto px-5 py-6"
            style={{ maxHeight: 420 }}
          >
            {messages.map((msg) => {
              if (msg.role === "bot" && msg.streaming && msg.text === "") {
                return <TypingIndicator key={msg.id} />;
              }
              return msg.role === "bot" ? (
                <BotMessage key={msg.id} text={msg.text} />
              ) : (
                <UserMessage key={msg.id} text={msg.text} />
              );
            })}

            {showChips && !hasUserMessages && (
              <StarterChips onSelect={handleChipSelect} />
            )}

            {currentState === "SUMMARY_REVIEW" && !isStreaming && (
              <SummaryCard />
            )}

            {currentState === "CONTACT_CAPTURE" && !isStreaming && (
              <ContactForm />
            )}

            {(currentState === "OFFER_DRAFT" || currentState === "DONE") &&
              !!agentOutputs.offer &&
              !isStreaming && <OfferCard />}

            <div ref={bottomRef} />
          </div>

          {/* File preview cards — shown between messages and input bar */}
          <FilePreviewList files={uploadedFiles} onRemove={removeFile} />

          {/* Divider */}
          <div
            className={uploadedFiles.length > 0 ? "mt-3" : ""}
            style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
          />

          {/* Input bar */}
          <div className="px-4 py-4">
            <div
              className="flex items-end gap-2 rounded-full px-4 py-2.5"
              style={{
                background: "#1E1E24",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <VoiceInput
                ref={voiceRef}
                onTranscript={handleTranscript}
                disabled={isStreaming || isRestoring || currentState === "DONE"}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentState === "DONE"
                    ? "This conversation is complete."
                    : isRestoring
                      ? "Restoring your conversation…"
                      : isStreaming
                        ? "PixelMate is thinking…"
                        : "Tell me about your challenge..."
                }
                disabled={isStreaming || isRestoring || currentState === "DONE"}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none leading-relaxed py-1 disabled:cursor-not-allowed"
                style={{ maxHeight: 120 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />

              {/* Paperclip — opens file picker */}
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileRef.current?.open()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
                style={{
                  color:
                    uploadedFiles.length > 0 ? "#C8F560" : undefined,
                }}
              >
                <span
                  className={
                    uploadedFiles.length > 0
                      ? ""
                      : "text-text-muted hover:text-text-secondary transition-colors"
                  }
                >
                  <PaperclipIcon />
                </span>
              </button>

              <button
                type="button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || isRestoring || currentState === "DONE"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-bg-deep transition-opacity disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </FileDropZone>
    </>
  );
}
