import type { JSX, ReactNode } from "react";

export default function ParticipantLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,248,241,0.92)_0%,rgba(250,245,239,0.98)_24%,rgba(246,241,234,1)_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col">
        <div className="pointer-events-none h-3 shrink-0 sm:h-5" aria-hidden="true" />
        <div className="flex-1">{children}</div>
        <div className="pointer-events-none h-6 shrink-0 sm:h-8" aria-hidden="true" />
      </div>
    </div>
  );
}
