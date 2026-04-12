import { redirect } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLayout(
  props: Readonly<{ children: ReactNode }>,
): Promise<JSX.Element> {
  const { children } = props;

  try {
    await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
