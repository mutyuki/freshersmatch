import type { JSX } from "react";

import { MatchTable } from "@/components/admin/match-table";
import type { AdminMatchListItem } from "@/lib/contracts/admin-matches";
import { getActiveEventId } from "@/lib/services/admin-dashboard-service";
import { listAdminMatches } from "@/lib/services/admin-match-service";

export default async function AdminMatchesPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData: AdminMatchListItem[] = await listAdminMatches(eventId);

  return <MatchTable eventId={eventId} initialData={initialData} />;
}
