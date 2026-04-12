import { redirect } from "next/navigation";
import type { JSX } from "react";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLoginPage(): Promise<JSX.Element> {
  try {
    await requireAdminSession();
  } catch {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_36%,#020617_100%)] px-6 py-16 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center justify-center">
          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="flex flex-col justify-center rounded-[2rem] border border-white/10 bg-white/[0.05] p-10 text-white shadow-[0_24px_80px_-46px_rgba(15,23,42,0.9)] backdrop-blur-md">
              <div className="inline-flex w-fit items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-1.5 text-sm font-semibold tracking-[0.24em] text-cyan-100 uppercase">
                Freshers Match Admin
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white lg:text-5xl">
                会場運営ログイン
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 lg:text-lg">
                ダッシュボード、参加者操作、試合復旧の入口です。PC
                ブラウザ前提で、いま使っているこの端末だけに運営セッションを発行します。
              </p>
              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-slate-950/35 px-5 py-4 text-sm leading-6 text-slate-300">
                ログアウトすると現在のブラウザだけが解除され、他端末の運営セッションには影響しません。
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-white px-8 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.16)] lg:px-10 lg:py-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Secure Access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                パスコードを入力
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                会場共有のパスコードでログインすると、すぐに管理画面へ移動します。
              </p>
              <div className="mt-8">
                <AdminLoginForm />
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  redirect("/admin/dashboard");
}
