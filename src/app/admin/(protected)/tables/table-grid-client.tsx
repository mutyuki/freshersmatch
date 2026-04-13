"use client";

import { AlertTriangle, Lock, RefreshCw, Unlock, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminTablesRealtime } from "@/hooks/useAdminTablesRealtime";
import type { AdminTableListItem } from "@/lib/contracts/admin-tables";
import type { TableStatus } from "@/lib/domain/table-status";
import { cn } from "@/lib/utils";

type TableResponse = {
  data?: AdminTableListItem[];
  error?: {
    message?: string;
  };
};

type MutationResponse = {
  error?: {
    message?: string;
  };
};

type TableGridProps = {
  eventId: string;
  initialData: AdminTableListItem[];
};

type ActionState =
  | { type: "force-release"; tableId: string }
  | { type: "hold"; tableId: string }
  | { type: "release-hold"; tableId: string }
  | null;

const tableStatusConfig: Record<TableStatus, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  reserved: {
    label: "Reserved",
    className: "border-secondary/30 bg-secondary/20 text-secondary-foreground",
  },
  in_use: {
    label: "In Use",
    className: "border-accent/30 bg-accent/20 text-accent-foreground",
  },
  admin_hold: {
    label: "Admin Hold",
    className: "border-accent/30 bg-accent/20 text-accent-foreground",
  },
};

function TableStatusBadge(props: { status: TableStatus }): JSX.Element {
  const config = tableStatusConfig[props.status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-[0.68rem] font-semibold tracking-[0.14em] uppercase",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}

export function TableGrid(props: TableGridProps): JSX.Element {
  const [data, setData] = useState(props.initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingTableId, setSubmittingTableId] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setData(props.initialData);
  }, [props.initialData]);

  const refresh = useCallback(async (): Promise<void> => {
    if (isMountedRef.current) {
      setIsRefreshing(true);
      setRefreshError(null);
    }

    try {
      const response = await fetch(`/api/admin/tables?eventId=${props.eventId}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as TableResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "卓一覧の更新に失敗しました。少し待ってから再度お試しください。",
        );
      }

      if (isMountedRef.current) {
        setData(payload.data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setRefreshError(
          error instanceof Error
            ? error.message
            : "卓一覧の更新に失敗しました。少し待ってから再度お試しください。",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [props.eventId]);

  useAdminTablesRealtime({
    enabled: true,
    eventId: props.eventId,
    refresh,
  });

  const selectedTable = useMemo(
    () =>
      actionState ? (data.find((item) => item.tableId === actionState.tableId) ?? null) : null,
    [actionState, data],
  );

  const closeDialog = useCallback(() => {
    if (submittingTableId) {
      return;
    }

    setActionState(null);
    setActionError(null);
  }, [submittingTableId]);

  const runAction = useCallback(async (): Promise<void> => {
    if (!selectedTable || !actionState) {
      return;
    }

    setActionError(null);
    setSubmittingTableId(selectedTable.tableId);

    try {
      const endpoint =
        actionState.type === "force-release"
          ? "/api/admin/table/force-release"
          : actionState.type === "hold"
            ? "/api/admin/table/hold"
            : "/api/admin/table/release-hold";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableId: selectedTable.tableId,
          confirm: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as MutationResponse | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "卓操作に失敗しました。少し待ってから再度お試しください。",
        );
      }

      await refresh();
      setActionState(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "卓操作に失敗しました。少し待ってから再度お試しください。",
      );
    } finally {
      setSubmittingTableId(null);
    }
  }, [actionState, refresh, selectedTable]);

  return (
    <>
      <section className="rounded-[1.8rem] border border-border bg-card p-5 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.95)] ">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
              Table Recovery
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">Tables</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              卓の強制解放と admin hold の切り替えを一覧から実行できます。対戦中の卓は先に match
              解決が必要なことが一目で分かるように表示します。
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-[1.2rem] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <RefreshCw className={cn("size-4", isRefreshing ? "animate-spin" : "")} />
            <span>{isRefreshing ? "同期中" : "Realtime 監視中"}</span>
          </div>
        </div>

        {refreshError ? (
          <Alert className="mt-4 border-destructive/20 bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{refreshError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((table) => {
            const isSubmitting = submittingTableId === table.tableId;
            const canHold = table.status === "available";
            const canReleaseHold = table.status === "admin_hold";
            const canForceRelease =
              table.status === "reserved" ||
              table.status === "in_use" ||
              table.currentMatchId !== null;

            return (
              <article
                key={table.tableId}
                className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.95)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Table {table.tableNumber}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
                      {table.gameTitle}
                    </h3>
                  </div>
                  <TableStatusBadge status={table.status} />
                </div>

                <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Current match
                    </p>
                    <p className="mt-1">{table.currentMatchId ?? "なし"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Occupants</p>
                    <p className="mt-1">
                      {table.occupantNicknames.length > 0
                        ? table.occupantNicknames.join(" / ")
                        : "なし"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Held by</p>
                    <p className="mt-1">{table.heldByAdminDisplayName ?? "未保持"}</p>
                  </div>
                </div>

                {table.status === "reserved" || table.status === "in_use" ? (
                  <Alert className="mt-4 border-secondary/30 bg-secondary/20 text-secondary-foreground">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                      この卓は進行中です。強制解放すると関連 match を無効化して参加者を復旧します。
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canHold || isSubmitting}
                    onClick={() =>
                      setActionState({
                        type: "hold",
                        tableId: table.tableId,
                      })
                    }
                  >
                    Hold
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canReleaseHold || isSubmitting}
                    onClick={() =>
                      setActionState({
                        type: "release-hold",
                        tableId: table.tableId,
                      })
                    }
                  >
                    Hold解除
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canForceRelease || isSubmitting}
                    onClick={() =>
                      setActionState({
                        type: "force-release",
                        tableId: table.tableId,
                      })
                    }
                  >
                    強制解放
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AlertDialog open={actionState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent className="border-border bg-slate-950 text-foreground" size="default">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogMedia className="bg-card text-foreground">
              {actionState?.type === "hold" ? (
                <Lock className="size-5" />
              ) : actionState?.type === "release-hold" ? (
                <Unlock className="size-5" />
              ) : (
                <WandSparkles className="size-5" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {actionState?.type === "hold"
                ? "卓を admin hold にする"
                : actionState?.type === "release-hold"
                  ? "卓の hold を解除する"
                  : "卓の強制解放を確認"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-muted-foreground">
              対象卓と副作用を確認し、最後の確認ボタンを押した時だけ操作が実行されます。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedTable ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      卓 {selectedTable.tableNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedTable.tableId}</p>
                  </div>
                  <TableStatusBadge status={selectedTable.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Current match
                    </p>
                    <p className="mt-1">{selectedTable.currentMatchId ?? "なし"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Occupants</p>
                    <p className="mt-1">
                      {selectedTable.occupantNicknames.length > 0
                        ? selectedTable.occupantNicknames.join(" / ")
                        : "なし"}
                    </p>
                  </div>
                </div>
              </div>

              {actionState?.type === "force-release" ? (
                <Alert className="border-secondary/30 bg-secondary/20 text-secondary-foreground">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    この操作は卓を available に戻し、紐づく active match があれば無効化して参加者を
                    registered に戻します。
                  </AlertDescription>
                </Alert>
              ) : actionState?.type === "hold" ? (
                <Alert className="border-accent/30 bg-accent/20 text-accent-foreground">
                  <Lock className="size-4" />
                  <AlertDescription>
                    admin hold にした卓は新規マッチング対象から外れます。空き卓でのみ実行できます。
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-primary/20 bg-primary/10 text-primary">
                  <Unlock className="size-4" />
                  <AlertDescription>
                    hold 解除後は available に戻り、再びマッチング対象になります。
                  </AlertDescription>
                </Alert>
              )}

              {actionError ? (
                <Alert className="border-destructive/20 bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter className="border-border bg-card">
            <AlertDialogCancel
              variant="outline"
              disabled={Boolean(submittingTableId)}
              onClick={closeDialog}
            >
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              variant={actionState?.type === "force-release" ? "destructive" : "default"}
              disabled={!selectedTable || Boolean(submittingTableId)}
              onClick={runAction}
            >
              {submittingTableId ? "実行中..." : "確認して実行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
