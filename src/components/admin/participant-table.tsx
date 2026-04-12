"use client";

import {
  AlertTriangle,
  Coins,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminParticipantsRealtime } from "@/hooks/useAdminParticipantsRealtime";
import type { AdminParticipantListItem } from "@/lib/contracts/admin-participants";
import { cn } from "@/lib/utils";

type ParticipantResponse = {
  data?: AdminParticipantListItem[];
  error?: {
    message?: string;
  };
};

type MutationResponse = {
  error?: {
    message?: string;
  };
};

type ParticipantTableProps = {
  eventId: string;
  initialData: AdminParticipantListItem[];
};

type ActionState =
  | { type: "chip-adjust"; participantId: string }
  | { type: "pause"; participantId: string }
  | { type: "unpause"; participantId: string }
  | { type: "disqualify"; participantId: string }
  | null;

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string): string {
  return timeFormatter.format(new Date(value));
}

function formatChipBalance(value: number): string {
  return value.toLocaleString("ja-JP");
}

function getRowTone(status: AdminParticipantListItem["status"]): string {
  switch (status) {
    case "paused":
      return "bg-amber-300/[0.08]";
    case "disqualified":
      return "bg-rose-300/[0.08]";
    case "disconnected":
      return "bg-slate-300/[0.08]";
    default:
      return "";
  }
}

export function ParticipantTable(props: ParticipantTableProps): JSX.Element {
  const [data, setData] = useState(props.initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingParticipantId, setSubmittingParticipantId] = useState<string | null>(null);
  const [chipDelta, setChipDelta] = useState("0");
  const [chipReason, setChipReason] = useState("");
  const [disqualifyReason, setDisqualifyReason] = useState("");
  const [disqualifyMode, setDisqualifyMode] = useState<"void_current_match" | "lose_current_match">(
    "void_current_match",
  );
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
      const response = await fetch(`/api/admin/participants?eventId=${props.eventId}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as ParticipantResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "参加者一覧の更新に失敗しました。少し待ってから再度お試しください。",
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
            : "参加者一覧の更新に失敗しました。少し待ってから再度お試しください。",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [props.eventId]);

  useAdminParticipantsRealtime({
    enabled: true,
    eventId: props.eventId,
    refresh,
  });

  const selectedParticipant = useMemo(
    () =>
      actionState
        ? (data.find((item) => item.participantId === actionState.participantId) ?? null)
        : null,
    [actionState, data],
  );

  useEffect(() => {
    if (!selectedParticipant) {
      setChipDelta("0");
      setChipReason("");
      setDisqualifyReason("");
      setDisqualifyMode("void_current_match");
      setActionError(null);
      return;
    }

    if (actionState?.type === "disqualify" && !selectedParticipant.currentMatchId) {
      setDisqualifyMode("void_current_match");
    }
  }, [actionState, selectedParticipant]);

  const closeDialog = useCallback(() => {
    if (submittingParticipantId) {
      return;
    }

    setActionState(null);
    setActionError(null);
  }, [submittingParticipantId]);

  const runAction = useCallback(async (): Promise<void> => {
    if (!actionState || !selectedParticipant) {
      return;
    }

    setActionError(null);
    setSubmittingParticipantId(selectedParticipant.participantId);

    try {
      let response: Response;

      switch (actionState.type) {
        case "chip-adjust": {
          const delta = Number(chipDelta);

          if (!Number.isInteger(delta) || delta === 0) {
            throw new Error("チップ修正量は 0 以外の整数で入力してください。");
          }

          if (chipReason.trim().length === 0) {
            throw new Error("チップ修正理由を入力してください。");
          }

          response = await fetch("/api/admin/participant/chip-adjust", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              participantId: selectedParticipant.participantId,
              delta,
              reason: chipReason,
              confirm: true,
            }),
          });
          break;
        }
        case "pause":
          response = await fetch("/api/admin/participant/pause", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              participantId: selectedParticipant.participantId,
              confirm: true,
            }),
          });
          break;
        case "unpause":
          response = await fetch("/api/admin/participant/unpause", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              participantId: selectedParticipant.participantId,
              confirm: true,
            }),
          });
          break;
        case "disqualify":
          if (disqualifyReason.trim().length === 0) {
            throw new Error("失格理由を入力してください。");
          }

          response = await fetch("/api/admin/participant/disqualify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              participantId: selectedParticipant.participantId,
              mode: disqualifyMode,
              reason: disqualifyReason,
              confirm: true,
            }),
          });
          break;
      }

      const payload = (await response.json().catch(() => null)) as MutationResponse | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "運営操作に失敗しました。少し待ってから再度お試しください。",
        );
      }

      await refresh();
      setActionState(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "運営操作に失敗しました。少し待ってから再度お試しください。",
      );
    } finally {
      setSubmittingParticipantId(null);
    }
  }, [
    actionState,
    chipDelta,
    chipReason,
    disqualifyMode,
    disqualifyReason,
    refresh,
    selectedParticipant,
  ]);

  return (
    <>
      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.95)] backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-slate-400 uppercase">
              Participant Operations
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Participants</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              現在状態を見ながら、チップ修正・一時停止・一時停止解除・失格を安全に実行できます。
              破壊的な変更は確認ダイアログで対象者と副作用を必ず確認してください。
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
                <TableHead className="px-4 text-slate-300">参加者</TableHead>
                <TableHead className="px-4 text-slate-300">状態</TableHead>
                <TableHead className="px-4 text-slate-300">残高</TableHead>
                <TableHead className="px-4 text-slate-300">現在試合</TableHead>
                <TableHead className="px-4 text-slate-300">最終通信</TableHead>
                <TableHead className="px-4 text-slate-300">失格理由</TableHead>
                <TableHead className="px-4 text-right text-slate-300">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((participant) => {
                const isSubmitting = submittingParticipantId === participant.participantId;
                const canPause =
                  participant.status !== "paused" && participant.status !== "disqualified";
                const canUnpause = participant.status === "paused";

                return (
                  <TableRow
                    key={participant.participantId}
                    className={cn(
                      "border-white/10 hover:bg-white/[0.03]",
                      getRowTone(participant.status),
                    )}
                  >
                    <TableCell className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-semibold text-white">{participant.nickname}</p>
                        <p className="text-xs text-slate-400">{participant.participantId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      <StatusBadge status={participant.status} />
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-50">
                        <Coins className="size-3.5" />
                        {formatChipBalance(participant.chipBalance)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-200">
                      {participant.currentMatchId ? (
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-slate-100"
                        >
                          {participant.currentMatchId}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">なし</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-300">
                      {formatDateTime(participant.lastSeenAt)}
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top text-slate-300">
                      {participant.disqualifiedReason ?? (
                        <span className="text-slate-500">なし</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "chip-adjust",
                              participantId: participant.participantId,
                            })
                          }
                        >
                          チップ修正
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canPause || isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "pause",
                              participantId: participant.participantId,
                            })
                          }
                        >
                          一時停止
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canUnpause || isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "unpause",
                              participantId: participant.participantId,
                            })
                          }
                        >
                          一時停止解除
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={participant.status === "disqualified" || isSubmitting}
                          onClick={() =>
                            setActionState({
                              type: "disqualify",
                              participantId: participant.participantId,
                            })
                          }
                        >
                          失格
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
              {actionState?.type === "chip-adjust" ? (
                <Coins className="size-5" />
              ) : actionState?.type === "unpause" ? (
                <PlayCircle className="size-5" />
              ) : actionState?.type === "pause" ? (
                <PauseCircle className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {actionState?.type === "chip-adjust"
                ? "チップ修正を確認"
                : actionState?.type === "pause"
                  ? "一時停止を確認"
                  : actionState?.type === "unpause"
                    ? "一時停止解除を確認"
                    : "失格処理を確認"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-slate-300">
              対象者と現在状態を確認し、最後の確認ボタンを押した時だけ操作が実行されます。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedParticipant ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {selectedParticipant.nickname}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {selectedParticipant.participantId}
                    </p>
                  </div>
                  <StatusBadge status={selectedParticipant.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Current match
                    </p>
                    <p className="mt-1">{selectedParticipant.currentMatchId ?? "なし"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Chip balance
                    </p>
                    <p className="mt-1">{formatChipBalance(selectedParticipant.chipBalance)}</p>
                  </div>
                </div>
              </div>

              {actionState?.type === "chip-adjust" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">増減値</span>
                    <Input
                      aria-label="チップ修正量"
                      type="number"
                      step="1"
                      value={chipDelta}
                      onChange={(event) => setChipDelta(event.currentTarget.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">理由</span>
                    <Textarea
                      aria-label="チップ修正理由"
                      placeholder="例: 現物チップとの差分調整"
                      value={chipReason}
                      onChange={(event) => setChipReason(event.currentTarget.value)}
                    />
                  </div>
                </div>
              ) : null}

              {actionState?.type === "pause" ? (
                <Alert className="border-amber-300/25 bg-amber-300/10 text-amber-50">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    queueing 中なら待機列から外れます。対戦中なら現在試合が無効化され、相手は
                    registered に戻ります。
                  </AlertDescription>
                </Alert>
              ) : null}

              {actionState?.type === "unpause" ? (
                <Alert className="border-emerald-300/25 bg-emerald-300/10 text-emerald-50">
                  <PlayCircle className="size-4" />
                  <AlertDescription>
                    一時停止解除後は registered に戻ります。自動で queueing には戻りません。
                  </AlertDescription>
                </Alert>
              ) : null}

              {actionState?.type === "disqualify" ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-200">対戦中失格モード</p>
                    <RadioGroup
                      aria-label="失格モード"
                      value={disqualifyMode}
                      onValueChange={(value) =>
                        setDisqualifyMode(value as "void_current_match" | "lose_current_match")
                      }
                    >
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <RadioGroupItem aria-label="試合を無効化する" value="void_current_match" />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-white">
                            試合を無効化する
                          </span>
                          <span className="block text-sm text-slate-300">
                            現在試合を無効にして、相手を registered に戻します。
                          </span>
                        </span>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <RadioGroupItem
                          aria-label="敗北扱いで結果確定する"
                          value="lose_current_match"
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-white">
                            敗北扱いで結果確定する
                          </span>
                          <span className="block text-sm text-slate-300">
                            対象を敗北扱いにし、相手を勝者確定します。
                          </span>
                        </span>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">失格理由</span>
                    <Textarea
                      aria-label="失格理由"
                      placeholder="例: ルール違反のため"
                      value={disqualifyReason}
                      onChange={(event) => setDisqualifyReason(event.currentTarget.value)}
                    />
                  </div>
                </div>
              ) : null}

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
              disabled={Boolean(submittingParticipantId)}
              onClick={closeDialog}
            >
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              variant={actionState?.type === "disqualify" ? "destructive" : "default"}
              disabled={!selectedParticipant || Boolean(submittingParticipantId)}
              onClick={runAction}
            >
              {submittingParticipantId ? "実行中..." : "確認して実行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
