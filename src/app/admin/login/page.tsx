import { redirect } from "next/navigation";
import type { JSX } from "react";

import { LoginFormClient } from "@/app/admin/login/login-form-client";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLoginPage(): Promise<JSX.Element> {
  try {
    await requireAdminSession();
  } catch {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center justify-center">
          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="flex flex-col justify-center rounded-2xl border bg-card p-10 shadow-sm">
              <p className="freshers-logo">Freshers Match</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                Admin
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] lg:text-5xl">
                会場運営ログイン
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground lg:text-lg">
                ダッシュボード、参加者操作、試合復旧の入口です。PC
                ブラウザ前提で、いま使っているこの端末だけに運営セッションを発行します。
              </p>
              <div className="mt-8 rounded-xl border bg-muted/30 px-5 py-4 text-sm leading-6 text-muted-foreground">
                ログアウトすると現在のブラウザだけが解除され、他端末の運営セッションには影響しません。
              </div>
            </section>

            <section className="rounded-2xl border bg-card px-8 py-8 shadow-sm lg:px-10 lg:py-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Secure Access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">パスコードを入力</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                会場共有のパスコードでログインすると、すぐに管理画面へ移動します。
              </p>
              <div className="mt-8">
                <LoginFormClient />
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  redirect("/admin/dashboard");
}
