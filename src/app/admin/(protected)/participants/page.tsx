import type { JSX } from "react";

import { ParticipantTable } from "@/app/admin/(protected)/participants/participant-table-client";
import type { AdminParticipantListItem } from "@/lib/contracts/admin-participants";
import { getActiveEventId } from "@/lib/services/admin-dashboard-service";
import { listAdminParticipants } from "@/lib/services/admin-participant-service";

export default async function AdminParticipantsPage(): Promise<JSX.Element> {
  const eventId = await getActiveEventId();
  const initialData: AdminParticipantListItem[] = await listAdminParticipants(eventId);

  return <ParticipantTable eventId={eventId} initialData={initialData} />;
}
