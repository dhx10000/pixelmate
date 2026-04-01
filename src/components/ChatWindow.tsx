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

// ── Shared entrance animation for every item in the message list ───────────

const msgVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

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

function BotMessage({ text, isNew }: { text: string; isNew: boolean }) {
  return (
    <motion.div
      className="flex items-start gap-3"
      variants={msgVariants}
      initial={isNew ? "hidden" : false}
      animate="visible"
    >
      <BotAvatar />
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-text-primary"
        style={{ background: "#18181C", maxWidth: "80%" }}
      >
        {text}
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
  const { messages, isStreaming, isRestoring, currentState, agentOutputs, showChips, sendMessage, dismissChips, analyzeFiles } =
    useChatContext();

  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<VoiceInputHandle>(null);
  const fileRef = useRef<FileUploadHandle>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  // Track how many messages existed when the component first mounted (after
  // restore). Any message at an index >= this count is truly "new" and should
  // animate in.
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

  // When the virtual keyboard opens on mobile, scroll to keep input visible.
  // visualViewport fires "resize" when the keyboard appears/disappears.
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

  // Scroll the input into view when the keyboard opens on mobile
  function handleTextareaFocus() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 350);
  }

  return (
    <>
      <style>{`
        @keyframes pixelmate-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* FileDropZone wraps the whole chat card */}
      <FileDropZone
        ref={fileRef}
        onFiles={handleNewFiles}
      >
        {/*
          Mobile: flex-1 min-h-0 so this fills the remaining viewport height
          between Hero+ProgressBar and the bottom of the screen.
          Desktop: max-width 680, rounded corners, fixed message list height.
        */}
        <div
          className="w-full flex flex-col flex-1 min-h-0 overflow-hidden rounded-none sm:mx-auto sm:rounded-[20px]"
          style={{
            maxWidth: 680,
            background: "#111114",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Message list — grows to fill available space on mobile */}
          <div
            className="flex flex-col gap-4 overflow-y-auto px-4 py-5 flex-1 min-h-0 sm:px-5 sm:py-6 sm:max-h-[420px]"
          >
            {messages.map((msg, index) => {
              if (msg.role === "bot" && msg.streaming && msg.text === "") {
                return <TypingIndicator key={msg.id} />;
              }
              return msg.role === "bot" ? (
                <BotMessage key={msg.id} text={msg.text} isNew={isNewMessage(index)} />
              ) : (
                <UserMessage key={msg.id} text={msg.text} isNew={isNewMessage(index)} />
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

          {/* File preview cards */}
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
                disabled={isStreaming || isRestoring || currentState === "DONE"}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleTextareaFocus}
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

              {/* Paperclip — 44px touch target on mobile, 32px on desktop */}
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

              {/* Send — 44px touch target on mobile, 32px on desktop */}
              <button
                type="button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || isRestoring || currentState === "DONE"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg-deep transition-opacity disabled:opacity-30 sm:h-8 sm:w-8"
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
