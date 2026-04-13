import { redirect } from "next/navigation";
import type { JSX, ReactNode } from "react";
import Link from "next/link";

import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLayout(
  props: Readonly<{ children: ReactNode }>,
): Promise<JSX.Element> {
  try {
    await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 text-foreground lg:px-10 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border bg-card px-7 py-7 shadow-sm">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                Freshers Match Admin
              </div>
              <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Admin Console</h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
                会場の状況確認とトラブル対応を、一覧性を落とさず操作できる共通レイアウトです。
              </p>
            </div>
            <nav aria-label="Admin navigation">
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["/admin/dashboard", "Dashboard"],
                  ["/admin/participants", "Participants"],
                  ["/admin/matches", "Matches"],
                  ["/admin/tables", "Tables"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex h-full min-h-20 items-center rounded-xl border px-4 py-3 text-sm font-medium hover:bg-accent"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main className="flex-1">{props.children}</main>
      </div>
    </div>
  );
}
