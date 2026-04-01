"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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

function RetryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// ── Shared entrance animation ──────────────────────────────────────────────

const msgVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

// ── Error accent colours (used across message + retry button) ──────────────

const ERROR_BG   = "rgba(239,68,68,0.07)";
const ERROR_BDR  = "rgba(239,68,68,0.18)";
const ERROR_TEXT = "rgba(255,120,100,0.95)";

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
    <motion.div
      className="flex items-start gap-3"
      variants={msgVariants}
      initial="hidden"
      animate="visible"
    >
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
    </motion.div>
  );
}

function BotMessage({
  text,
  isNew,
  isError,
  errorType,
  onRetry,
}: {
  text: string;
  isNew: boolean;
  isError?: boolean;
  errorType?: "timeout" | "api" | "rateLimit";
  onRetry?: () => void;
}) {
  const isRateLimit = errorType === "rateLimit";

  return (
    <motion.div
      className="flex items-start gap-3"
      variants={msgVariants}
      initial={isNew ? "hidden" : false}
      animate="visible"
    >
      <BotAvatar />
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
        style={{
          background: isError ? ERROR_BG : "#18181C",
          border: isError ? `1px solid ${ERROR_BDR}` : undefined,
          color: isError ? ERROR_TEXT : "#E8E4DD",
          maxWidth: "80%",
        }}
        role={isError ? "alert" : undefined}
      >
        {text}

        {/* Retry button — shown on api/timeout errors, not on rateLimit */}
        {isError && !isRateLimit && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2.5 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-75"
            style={{ color: ERROR_TEXT }}
          >
            <RetryIcon />
            Try again
          </button>
        )}
      </div>
    </motion.div>
  );
}

function UserMessage({ text, isNew }: { text: string; isNew: boolean }) {
  return (
    <motion.div
      className="flex justify-end"
      variants={msgVariants}
      initial={isNew ? "hidden" : false}
      animate="visible"
    >
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
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ChatWindow() {
  const {
    messages, isStreaming, isRestoring, currentState, agentOutputs,
    showChips, sendMessage, retryLastMessage, dismissChips, analyzeFiles,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<VoiceInputHandle>(null);
  const fileRef = useRef<FileUploadHandle>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  // Has the session hit the message limit?
  const isRateLimited = messages.some(
    (m) => m.isError && m.errorType === "rateLimit"
  );

  // Track how many messages existed at mount (post-restore) — skip animation
  // for pre-existing messages so scrolling history doesn't re-trigger it.
  const initialCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isRestoring && initialCountRef.current === null) {
      initialCountRef.current = messages.length;
    }
  }, [isRestoring, messages.length]);

  function isNewMessage(index: number) {
    return initialCountRef.current === null || index >= initialCountRef.current;
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Update browser tab title while bot is streaming
  useEffect(() => {
    document.title = isStreaming ? "PixelMate · Typing…" : "PixelMate";
    return () => { document.title = "PixelMate"; };
  }, [isStreaming]);

  // Scroll to bottom when the virtual keyboard opens on mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onVVResize() {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      });
    }
    vv.addEventListener("resize", onVVResize);
    return () => vv.removeEventListener("resize", onVVResize);
  }, []);

  const handleNewFiles = useCallback((files: File[]) => {
    const newFiles: File[] = [];
    setUploadedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const deduped = files.filter((f) => !existing.has(`${f.name}-${f.size}`));
      newFiles.push(...deduped);
      return [...prev, ...deduped];
    });
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
    if (text === "Record voice") { voiceRef.current?.start(); return; }
    if (text === "Upload files") { fileRef.current?.open(); return; }
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Scroll input into view when keyboard opens on mobile
  function handleTextareaFocus() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 350);
  }

  // Combined disabled state for the input area
  const inputDisabled =
    isStreaming || isRestoring || currentState === "DONE" || isRateLimited;

  const inputPlaceholder = isRateLimited
    ? "Message limit reached."
    : currentState === "DONE"
      ? "This conversation is complete."
      : isRestoring
        ? "Restoring your conversation…"
        : isStreaming
          ? "PixelMate is thinking…"
          : "Tell me about your challenge...";

  return (
    <>
      <FileDropZone ref={fileRef} onFiles={handleNewFiles}>
        <div
          className="w-full flex flex-col flex-1 min-h-0 overflow-hidden rounded-none sm:mx-auto sm:rounded-[20px]"
          style={{
            maxWidth: 680,
            background: "#111114",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Message list */}
          <div className="pm-scrollbar flex flex-col gap-4 overflow-y-auto px-4 py-5 flex-1 min-h-0 sm:px-5 sm:py-6 sm:max-h-[420px]">
            {messages.map((msg, index) => {
              if (msg.role === "bot" && msg.streaming && msg.text === "") {
                return <TypingIndicator key={msg.id} />;
              }
              return msg.role === "bot" ? (
                <BotMessage
                  key={msg.id}
                  text={msg.text}
                  isNew={isNewMessage(index)}
                  isError={msg.isError}
                  errorType={msg.errorType}
                  onRetry={
                    msg.isError && msg.errorType !== "rateLimit"
                      ? retryLastMessage
                      : undefined
                  }
                />
              ) : (
                <UserMessage
                  key={msg.id}
                  text={msg.text}
                  isNew={isNewMessage(index)}
                />
              );
            })}

            {showChips && !hasUserMessages && (
              <StarterChips onSelect={handleChipSelect} />
            )}

            {currentState === "SUMMARY_REVIEW" && !isStreaming && <SummaryCard />}
            {currentState === "CONTACT_CAPTURE" && !isStreaming && <ContactForm />}
            {(currentState === "OFFER_DRAFT" || currentState === "DONE") &&
              !!agentOutputs.offer && !isStreaming && <OfferCard />}

            <div ref={bottomRef} />
          </div>

          {/* File preview */}
          <FilePreviewList files={uploadedFiles} onRemove={removeFile} />

          {/* Divider */}
          <div
            className={uploadedFiles.length > 0 ? "mt-3" : ""}
            style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
          />

          {/* Input bar */}
          <div className="px-3 py-3 sm:px-4 sm:py-4">
            <div
              className="flex items-end gap-1.5 sm:gap-2 rounded-full px-3 py-2 sm:px-4 sm:py-2.5"
              style={{
                background: "#1E1E24",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <VoiceInput
                ref={voiceRef}
                onTranscript={handleTranscript}
                disabled={inputDisabled}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleTextareaFocus}
                placeholder={inputPlaceholder}
                disabled={inputDisabled}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none leading-relaxed py-1 disabled:cursor-not-allowed"
                style={{ maxHeight: 120 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />

              {/* Paperclip — 44px touch target on mobile */}
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileRef.current?.open()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-8"
                style={{
                  color: uploadedFiles.length > 0 ? "#C8F560" : undefined,
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

              {/* Send — 44px touch target on mobile */}
              <motion.button
                type="button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!input.trim() || inputDisabled}
                whileHover={!input.trim() || inputDisabled ? {} : { scale: 1.08 }}
                whileTap={!input.trim() || inputDisabled ? {} : { scale: 0.92 }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg-deep transition-opacity disabled:opacity-30 sm:h-8 sm:w-8"
              >
                <SendIcon />
              </motion.button>
            </div>
          </div>
        </div>
      </FileDropZone>
    </>
  );
}
