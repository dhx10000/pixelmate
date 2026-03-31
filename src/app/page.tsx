import Hero from "@/components/Hero";
import ChatWindow from "@/components/ChatWindow";
import ProgressBar from "@/components/ProgressBar";
import { ChatProvider } from "@/context/ChatContext";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-bg-deep flex flex-col items-center overflow-x-hidden">

      {/* Film-grain texture overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50"
        style={{ opacity: 0.025 }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Content */}
      <ChatProvider>
        <main className="flex w-full flex-col items-center flex-1 px-4">
          <Hero />
          <ProgressBar />
          <ChatWindow />
        </main>
      </ChatProvider>

      {/* Footer */}
      <footer className="w-full py-8 flex justify-center">
        <p className="font-mono text-xs tracking-wide text-text-muted text-center">
          AI assistant by PIXEL · Privacy-first · No data shared without consent
        </p>
      </footer>

    </div>
  );
}
