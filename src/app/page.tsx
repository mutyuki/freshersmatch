export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-10 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Setup ready</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Freshers Match development environment
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Next.js, Supabase packages, shadcn/ui, Biome, Vitest, Testing Library, and Playwright are
          installed. The next step is wiring the app structure to the design and task documents in
          this repository.
        </p>
      </div>
    </main>
  );
}
