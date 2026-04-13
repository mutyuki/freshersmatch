import type { JSX } from "react";

import { DashboardSummary } from "@/app/admin/(protected)/dashboard/dashboard-content";
import { getActiveEventId, getAdminDashboardData } from "@/lib/services/admin-dashboard-service";

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData = await getAdminDashboardData(eventId);

  return <DashboardSummary eventId={eventId} initialData={initialData} />;
}
