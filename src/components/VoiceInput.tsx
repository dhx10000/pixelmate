"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// ── Browser type shim ──────────────────────────────────────────────────────
// The Web Speech API isn't in the default TS lib. We declare the minimum
// surface we use rather than pulling in a separate @types package.

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

// ── Public handle (for external trigger) ──────────────────────────────────

export type VoiceInputHandle = {
  /** Start listening — called by the 'Record voice' chip */
  start: () => void;
};

// ── Icons ──────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

type Props = {
  /** Called with the final transcript when the user stops speaking */
  onTranscript: (text: string) => void;
  /** Disable the button while the chat is streaming a reply */
  disabled?: boolean;
};

const VoiceInput = forwardRef<VoiceInputHandle, Props>(function VoiceInput(
  { onTranscript, disabled = false },
  ref
) {
  const [isListening, setIsListening] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const startListening = useCallback(() => {
    if (!isSupported || isListening || disabled) return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, isListening, disabled, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Stop on unmount to avoid orphaned recognition sessions
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // Imperative handle for the 'Record voice' chip
  useImperativeHandle(
    ref,
    () => ({ start: startListening }),
    [startListening]
  );

  function handleClick() {
    if (!isSupported) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  return (
    <div className="relative flex shrink-0">
      <button
        type="button"
        aria-label={isListening ? "Stop recording" : "Voice input"}
        onClick={handleClick}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        style={{
          color: isListening ? "#C8F560" : undefined,
        }}
      >
        {isListening ? (
          /* Pulsing recording indicator */
          <span
            className="block h-3 w-3 rounded-full"
            style={{
              background: "#C8F560",
              boxShadow: "0 0 0 0 rgba(200,245,96,0.6)",
              animation: "voice-pulse 1.2s ease-in-out infinite",
            }}
          />
        ) : (
          <span
            className={
              isSupported
                ? "text-text-muted hover:text-text-secondary transition-colors"
                : "text-text-muted opacity-50"
            }
          >
            <MicIcon />
          </span>
        )}
      </button>

      {/* Unsupported browser tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-xs text-text-secondary pointer-events-none"
          style={{
            background: "#18181C",
            border: "1px solid rgba(255,255,255,0.08)",
            animation: "pb-fadein 0.2s ease both",
          }}
        >
          Voice is supported in Chrome and Edge
          {/* Arrow */}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #18181C",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes voice-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(200,245,96,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(200,245,96,0); }
          100% { box-shadow: 0 0 0 0   rgba(200,245,96,0); }
        }
      `}</style>
    </div>
  );
});

export default VoiceInput;
