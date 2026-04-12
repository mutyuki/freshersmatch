"use client";

import { AlertTriangle, Crown, RefreshCw, Undo2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminMatchesRealtime } from "@/hooks/useAdminMatchesRealtime";
import type { AdminMatchListItem } from "@/lib/contracts/admin-matches";
import type { MatchStatus } from "@/lib/domain/match-status";
import { cn } from "@/lib/utils";

type MatchResponse = {
  data?: AdminMatchListItem[];
  error?: {
    message?: string;
  };
};

type MutationResponse = {
  error?: {
    message?: string;
  };
};

type MatchTableProps = {
  eventId: string;
  initialData: AdminMatchListItem[];
};

type ActionState = { type: "void"; matchId: string } | { type: "winner"; matchId: string } | null;

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const matchStatusConfig: Record<MatchStatus, { label: string; className: string }> = {
  reserved: {
    label: "案内中",
    className: "border-lime-300/40 bg-lime-300/12 text-lime-50",
  },
  awaiting_ready: {
    label: "開始待ち",
    className: "border-amber-300/40 bg-amber-300/12 text-amber-50",
  },
  in_progress: {
    label: "対戦中",
    className: "border-sky-300/40 bg-sky-300/12 text-sky-50",
  },
  winner_claimed: {
    label: "勝利申告中",
    className: "border-fuchsia-300/40 bg-fuchsia-300/12 text-fuchsia-50",
  },
  completed: {
    label: "完了",
    className: "border-emerald-300/40 bg-emerald-300/12 text-emerald-50",
  },
  cancelled_before_start: {
    label: "開始前取消",
    className: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  },
  voided_by_admin: {
    label: "運営無効化",
    className: "border-rose-300/40 bg-rose-300/12 text-rose-50",
  },
  force_finished_by_admin: {
    label: "運営確定",
    className: "border-cyan-300/40 bg-cyan-300/12 text-cyan-50",
  },
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "未開始";
  }

  return timeFormatter.format(new Date(value));
}

function MatchStatusBadge(props: { status: MatchStatus }): JSX.Element {
  const config = matchStatusConfig[props.status];

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

export function MatchTable(props: MatchTableProps): JSX.Element {
  const [data, setData] = useState(props.initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const [winnerParticipantId, setWinnerParticipantId] = useState<string | null>(null);
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
      const response = await fetch(`/api/admin/matches?eventId=${props.eventId}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as MatchResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "試合一覧の更新に失敗しました。少し待ってから再度お試しください。",
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
            : "試合一覧の更新に失敗しました。少し待ってから再度お試しください。",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [props.eventId]);

  useAdminMatchesRealtime({
    enabled: true,
    eventId: props.eventId,
    refresh,
  });

  const selectedMatch = useMemo(
    () =>
      actionState ? (data.find((item) => item.matchId === actionState.matchId) ?? null) : null,
    [actionState, data],
  );

  useEffect(() => {
    if (!selectedMatch) {
      setWinnerParticipantId(null);
      setActionError(null);
      return;
    }

    if (actionState?.type === "winner") {
      setWinnerParticipantId(selectedMatch.participant1Id);
    } else {
      setWinnerParticipantId(null);
    }
  }, [actionState, selectedMatch]);

  const closeDialog = useCallback(() => {
    if (submittingMatchId) {
      return;
    }

    setActionState(null);
    setActionError(null);
  }, [submittingMatchId]);

  const runAction = useCallback(async (): Promise<void> => {
    if (!selectedMatch || !actionState) {
      return;
    }

    setActionError(null);
    setSubmittingMatchId(selectedMatch.matchId);

    try {
      let body: Record<string, string | boolean> = {
        matchId: selectedMatch.matchId,
        confirm: true,
      };

      if (actionState.type === "void") {
        body = {
          ...body,
          resolutionType: "void",
        };
      } else {
        if (!winnerParticipantId) {
          throw new Error("勝者を選択してください。");
        }

        body = {
          ...body,
          resolutionType: "winner",
          winnerParticipantId,
        };
      }

      const response = await fetch("/api/admin/match/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as MutationResponse | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            "運営による試合解決に失敗しました。少し待ってから再度お試しください。",
        );
      }

      await refresh();
      setActionState(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "運営による試合解決に失敗しました。少し待ってから再度お試しください。",
      );
    } finally {
      setSubmittingMatchId(null);
    }
  }, [actionState, refresh, selectedMatch, winnerParticipantId]);

  return (
    <>
      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.95)] backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-slate-400 uppercase">
              Match Recovery
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Matches</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              試合の無効化と運営勝敗確定を一覧から直接実行できます。トラブル時は対象卓、
              現在状態、対戦者を確認してから復旧してください。
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-[1.2rem] border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
            <RefreshCw className={cn("size-4", isRefreshing ? "animate-spin" : "")} />
            <span>{isRefreshing ? "同期中" : "Realtime 監視中"}</span>
          </div>
        </div>

        {refreshError ? (
          <Alert className="mt-4 border-rose-300/30 bg-rose-300/10 text-rose-50">
            <AlertTriangle className="size-4" />
            <AlertDescription>{refreshError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/35">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="px-4 text-slate-300">卓</TableHead>
                <TableHead className="px-4 text-slate-300">状態</TableHead>
                <TableHead className="px-4 text-slate-300">対戦者</TableHead>
                <TableHead className="px-4 text-slate-300">開始時刻</TableHead>
                <TableHead className="px-4 text-slate-300">Dispute</TableHead>
                <TableHead className="px-4 text-right text-slate-300">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((match) => {
                const isSubmitting = submittingMatchId === match.matchId;
                const canResolveWinner =
                  match.status === "in_progress" || match.status === "winner_claimed";
                const canVoid =
                  match.status === "reserved" ||
                  match.status === "awaiting_ready" ||
                  match.status === "in_progress" ||
                  match.status === "winner_claimed";

                return (
                  <TableRow key={match.matchId} className="border-white/10 hover:bg-white/[0.03]">
                    <TableCell className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-white">
                          {match.tableNumber ? `卓 ${match.tableNumber}` : "卓未割当"}
                        </p>
                        <p className="text-xs text-slate-400">{match.matchId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      <MatchStatusBadge status={match.status} />
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-200">
                      <div className="space-y-1">
                        <p>{match.participant1Nickname}</p>
                        <p className="text-sm text-slate-400">
                          vs {match.participant2Nickname ?? "運営スタッフ"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-300">
                      {formatDateTime(match.startedAt)}
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-300">
                      <Badge
                        variant="outline"
                        className="border-white/15 bg-white/5 text-slate-100"
                      >
                        {match.disputeCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canVoid || isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "void",
                              matchId: match.matchId,
                            })
                          }
                        >
                          試合無効
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canResolveWinner || isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "winner",
                              matchId: match.matchId,
                            })
                          }
                        >
                          勝敗確定
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <AlertDialog open={actionState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent className="border-white/10 bg-slate-950 text-white" size="default">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogMedia className="bg-white/10 text-white">
              {actionState?.type === "winner" ? (
                <Crown className="size-5" />
              ) : (
                <Undo2 className="size-5" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {actionState?.type === "winner" ? "運営で勝敗確定" : "試合無効を確認"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-slate-300">
              現在状態と復旧対象を確認し、最後の確認ボタンを押した時だけ操作が実行されます。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedMatch ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedMatch.tableNumber ? `卓 ${selectedMatch.tableNumber}` : "卓未割当"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{selectedMatch.matchId}</p>
                  </div>
                  <MatchStatusBadge status={selectedMatch.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Players</p>
                    <p className="mt-1">
                      {selectedMatch.participant1Nickname} /{" "}
                      {selectedMatch.participant2Nickname ?? "運営スタッフ"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recovery</p>
                    <p className="mt-1">
                      {actionState?.type === "winner"
                        ? "勝者を確定し、結果確定状態へ進めます。"
                        : "試合を無効化し、参加者と卓を復旧します。"}
                    </p>
                  </div>
                </div>
              </div>

              {actionState?.type === "winner" ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-200">勝者を選択</p>
                  <RadioGroup
                    aria-label="勝者選択"
                    value={winnerParticipantId ?? ""}
                    onValueChange={(value) => setWinnerParticipantId(value)}
                  >
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <RadioGroupItem
                        aria-label={selectedMatch.participant1Nickname}
                        value={selectedMatch.participant1Id}
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-white">
                          {selectedMatch.participant1Nickname}
                        </span>
                        <span className="block text-sm text-slate-300">
                          この参加者を勝者として運営確定します。
                        </span>
                      </span>
                    </div>
                    {selectedMatch.participant2Id ? (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <RadioGroupItem
                          aria-label={selectedMatch.participant2Nickname ?? "参加者2"}
                          value={selectedMatch.participant2Id}
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-white">
                            {selectedMatch.participant2Nickname ?? "参加者2"}
                          </span>
                          <span className="block text-sm text-slate-300">
                            この参加者を勝者として運営確定します。
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </RadioGroup>
                </div>
              ) : (
                <Alert className="border-amber-300/25 bg-amber-300/10 text-amber-50">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    試合を無効化すると、関連参加者は registered に戻り、卓も available
                    に復旧します。
                  </AlertDescription>
                </Alert>
              )}

              {actionError ? (
                <Alert className="border-rose-300/25 bg-rose-300/10 text-rose-50">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter className="border-white/10 bg-white/[0.02]">
            <AlertDialogCancel
              variant="outline"
              disabled={Boolean(submittingMatchId)}
              onClick={closeDialog}
            >
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              variant={actionState?.type === "winner" ? "destructive" : "default"}
              disabled={!selectedMatch || Boolean(submittingMatchId)}
              onClick={runAction}
            >
              {submittingMatchId ? "実行中..." : "確認して実行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
