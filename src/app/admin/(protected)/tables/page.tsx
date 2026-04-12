import type { JSX } from "react";

import { TableGrid } from "@/components/admin/table-grid";
import type { AdminTableListItem } from "@/lib/contracts/admin-tables";
import { getActiveEventId } from "@/lib/services/admin-dashboard-service";
import { listAdminTables } from "@/lib/services/admin-match-service";

export default async function AdminTablesPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData: AdminTableListItem[] = await listAdminTables(eventId);

  return <TableGrid eventId={eventId} initialData={initialData} />;
}
