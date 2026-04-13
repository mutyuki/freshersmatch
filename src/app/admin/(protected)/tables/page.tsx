import type { JSX } from "react";

import { TableGrid } from "@/app/admin/(protected)/tables/table-grid-client";
import type { AdminTableListItem } from "@/lib/contracts/admin-tables";
import { getActiveEventId } from "@/lib/services/admin-dashboard-service";
import { listAdminTables } from "@/lib/services/admin-match-service";

export default async function AdminTablesPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData: AdminTableListItem[] = await listAdminTables(eventId);

  return <TableGrid eventId={eventId} initialData={initialData} />;
}
