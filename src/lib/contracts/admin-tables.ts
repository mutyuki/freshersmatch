import type { TableStatus } from "@/lib/domain/table-status";

export interface AdminTableListItem {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  ruleId: string | null;
  ruleTitle: string | null;
  hasRule: boolean;
  status: TableStatus;
  currentMatchId: string | null;
  occupantNicknames: string[];
  heldByAdminDisplayName: string | null;
}
