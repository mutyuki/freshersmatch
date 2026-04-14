import type { JSX, ReactNode } from "react";

export default function ParticipantLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col">
        <div className="pointer-events-none h-2 shrink-0 sm:h-4" aria-hidden="true" />
        <header className="px-1 pb-4 pt-1">
          <p className="freshers-logo">
            Freshers Match
          </p>
        </header>
        <div className="flex-1">{children}</div>
        <div className="pointer-events-none h-6 shrink-0 sm:h-8" aria-hidden="true" />
      </div>
    </div>
  );
}
