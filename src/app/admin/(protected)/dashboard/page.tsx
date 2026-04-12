import type { JSX } from "react";

import { DashboardSummary } from "@/components/admin/dashboard-summary";
import { getActiveEventId, getAdminDashboardData } from "@/lib/services/admin-dashboard-service";

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData = await getAdminDashboardData(eventId);

  return <DashboardSummary eventId={eventId} initialData={initialData} />;
}
