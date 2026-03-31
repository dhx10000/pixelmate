"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileCategory(
  type: string
): "pdf" | "image" | "doc" | "ppt" | "generic" {
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (
    type === "application/msword" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "doc";
  if (
    type ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "ppt";
  return "generic";
}

// ── File type icons ────────────────────────────────────────────────────────

function FileIcon({ type }: { type: string }) {
  const cat = getFileCategory(type);

  const shared =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-mono font-semibold";

  if (cat === "pdf")
    return (
      <div className={shared} style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
        PDF
      </div>
    );
  if (cat === "image")
    return (
      <div className={shared} style={{ background: "rgba(200,245,96,0.12)", color: "#C8F560" }}>
        IMG
      </div>
    );
  if (cat === "doc")
    return (
      <div className={shared} style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
        DOC
      </div>
    );
  if (cat === "ppt")
    return (
      <div className={shared} style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>
        PPT
      </div>
    );
  return (
    <div className={shared} style={{ background: "rgba(255,255,255,0.06)", color: "#9A9590" }}>
      FILE
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1 1l10 10M11 1L1 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Preview card ───────────────────────────────────────────────────────────

function FileCard({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2"
      style={{
        background: "#18181C",
        border: "1px solid rgba(255,255,255,0.06)",
        minWidth: 0,
      }}
    >
      <FileIcon type={file.type} />
      <div className="flex min-w-0 flex-col">
        <span
          className="truncate text-xs text-text-primary"
          style={{ maxWidth: 160 }}
        >
          {file.name}
        </span>
        <span className="font-mono text-xs text-text-muted">
          {formatBytes(file.size)}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="ml-1 shrink-0 text-text-muted transition-colors hover:text-text-secondary"
      >
        <RemoveIcon />
      </button>
    </div>
  );
}

// ── File preview list (used inside ChatWindow above the input bar) ──────────

export function FilePreviewList({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-5 pt-3">
      {files.map((file, i) => (
        <FileCard key={`${file.name}-${i}`} file={file} onRemove={() => onRemove(i)} />
      ))}
    </div>
  );
}

// ── Public handle ──────────────────────────────────────────────────────────

export type FileUploadHandle = {
  /** Programmatically open the file picker */
  open: () => void;
};

// ── FileDropZone ───────────────────────────────────────────────────────────
//
// Wraps children in a dropzone. Renders a full-cover overlay while dragging.
// Exposes `open()` via ref for the paperclip button and chip trigger.

type FileDropZoneProps = {
  children: React.ReactNode;
  onFiles: (files: File[]) => void;
};

export const FileDropZone = forwardRef<FileUploadHandle, FileDropZoneProps>(
  function FileDropZone({ children, onFiles }, ref) {
    const [rejections, setRejections] = useState<string[]>([]);

    const onDrop = useCallback(
      (accepted: File[], rejected: { file: File; errors: { message: string }[] }[]) => {
        if (accepted.length > 0) onFiles(accepted);
        if (rejected.length > 0) {
          const msgs = rejected.map(({ file, errors }) => {
            const reason = errors[0]?.message ?? "Invalid file";
            return `${file.name}: ${reason}`;
          });
          setRejections(msgs);
          setTimeout(() => setRejections([]), 4000);
        }
      },
      [onFiles]
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
      onDrop,
      accept: ACCEPTED_TYPES,
      maxSize: MAX_SIZE,
      noClick: true,   // we control clicks manually via ref
      noKeyboard: true,
    });

    useImperativeHandle(ref, () => ({ open }), [open]);

    return (
      <div {...getRootProps()} className="relative w-full">
        <input {...getInputProps()} />

        {children}

        {/* Drag-over overlay */}
        {isDragActive && (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[20px]"
            style={{
              background: "rgba(10,10,12,0.85)",
              border: "1.5px dashed rgba(200,245,96,0.5)",
              backdropFilter: "blur(2px)",
            }}
          >
            <span
              className="block h-3 w-3 rounded-full bg-accent"
              style={{ boxShadow: "0 0 8px 2px rgba(200,245,96,0.5)" }}
            />
            <p className="font-mono text-xs tracking-wide text-accent">
              Drop files here
            </p>
            <p className="font-mono text-xs text-text-muted">
              PDF · PNG · JPG · WEBP · DOC · DOCX · PPTX · max 10 MB
            </p>
          </div>
        )}

        {/* Rejection toasts */}
        {rejections.length > 0 && (
          <div
            className="absolute bottom-full left-0 right-0 mb-2 flex flex-col gap-1 px-2"
            style={{ zIndex: 30 }}
          >
            {rejections.map((msg, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2 font-mono text-xs text-text-secondary"
                style={{
                  background: "#18181C",
                  border: "1px solid rgba(239,68,68,0.3)",
                  animation: "pb-fadein 0.2s ease both",
                }}
              >
                {msg}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
