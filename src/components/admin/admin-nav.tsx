"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";
import { LayoutDashboard, Swords, Table2, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const ADMIN_NAV_ITEMS = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    description: "会場全体",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/participants",
    label: "Participants",
    description: "参加者操作",
    icon: Users,
  },
  {
    href: "/admin/matches",
    label: "Matches",
    description: "試合復旧",
    icon: Swords,
  },
  {
    href: "/admin/tables",
    label: "Tables",
    description: "卓管理",
    icon: Table2,
  },
] as const;

export function AdminNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-full min-h-24 flex-col justify-between rounded-[1.4rem] border px-5 py-4 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  isActive
                    ? "border-cyan-300/70 bg-cyan-300/12 text-white shadow-[0_18px_45px_-28px_rgba(34,211,238,0.55)] ring-1 ring-cyan-200/30"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-slate-400 uppercase transition-colors group-hover:text-slate-300">
                      {item.description}
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{item.label}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-2xl border transition-colors",
                      isActive
                        ? "border-cyan-200/60 bg-cyan-200/18 text-cyan-50"
                        : "border-white/12 bg-white/6 text-slate-300 group-hover:border-white/18 group-hover:text-white",
                    )}
                  >
                    <Icon className="size-4.5" />
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-6 text-sm font-medium transition-colors",
                    isActive ? "text-cyan-100" : "text-slate-400 group-hover:text-slate-200",
                  )}
                >
                  Open section
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
