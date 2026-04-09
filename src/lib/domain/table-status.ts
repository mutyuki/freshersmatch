export const TABLE_STATUSES = ["available", "reserved", "in_use", "admin_hold"] as const;

export type TableStatus = (typeof TABLE_STATUSES)[number];

export function isTableStatus(value: string): value is TableStatus {
  return TABLE_STATUSES.includes(value as TableStatus);
}
