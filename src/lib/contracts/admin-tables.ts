import type { TableStatus } from "@/lib/domain/table-status";

export interface AdminTableListItem {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  status: TableStatus;
  currentMatchId: string | null;
  occupantNicknames: string[];
  heldByAdminDisplayName: string | null;
}
