"use client";

import { AlertTriangle, Activity, RefreshCw, ShieldAlert, Table2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { StaffMatchForm } from "@/components/admin/staff-match-form";
import { useAdminDashboardRealtime } from "@/hooks/useAdminDashboardRealtime";
import type { AdminDashboardData } from "@/lib/contracts/admin-dashboard";
import { cn } from "@/lib/utils";

type DashboardResponse = {
  data?: AdminDashboardData;
  error?: {
    message?: string;
  };
};

type DashboardSummaryProps = {
  eventId: string;
  initialData: AdminDashboardData;
};

type DashboardPanelProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: JSX.Element;
  accent?: "cyan" | "amber" | "rose";
};

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  icon: typeof Table2;
  tone?: "neutral" | "warning" | "critical";
};

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string | null): string {
  if (!value) {
    return "時刻未記録";
  }

  return timeFormatter.format(new Date(value));
}

function formatElapsedMinutes(value: string | null): string {
  if (!value) {
    return "経過時間なし";
  }

  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));

  return `${elapsedMinutes}分経過`;
}

function getTableStatusLabel(status: AdminDashboardData["tables"][number]["status"]): string {
  switch (status) {
    case "available":
      return "空席";
    case "reserved":
      return "案内済み";
    case "in_use":
      return "対戦中";
    case "admin_hold":
      return "運営 hold";
    default:
      return status;
  }
}

function getMatchStatusLabel(
  status: AdminDashboardData["inProgressMatches"][number]["displayStatus"],
): string {
  switch (status) {
    case "reserved":
      return "卓案内済み";
    case "awaiting_ready":
      return "開始待ち";
    case "in_progress":
      return "対戦中";
    case "winner_claimed":
      return "勝利申告中";
    default:
      return status;
  }
}

function DashboardPanel(props: DashboardPanelProps): JSX.Element {
  const toneClasses =
    props.accent === "amber"
      ? "border-amber-300/20 bg-amber-300/[0.07]"
      : props.accent === "rose"
        ? "border-rose-300/20 bg-rose-300/[0.07]"
        : "border-white/10 bg-white/[0.04]";

  return (
    <section
      className={cn(
        "rounded-[1.8rem] border px-5 py-5 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.95)] backdrop-blur-md",
        toneClasses,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {props.eyebrow ? (
            <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-slate-400 uppercase">
              {props.eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
            {props.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{props.description}</p>
        </div>
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  );
}

function SummaryCard(props: SummaryCardProps): JSX.Element {
  const Icon = props.icon;
  const toneClasses =
    props.tone === "critical"
      ? "border-rose-300/25 bg-rose-300/[0.08]"
      : props.tone === "warning"
        ? "border-amber-300/25 bg-amber-300/[0.08]"
        : "border-white/10 bg-white/[0.045]";
  const iconClasses =
    props.tone === "critical"
      ? "border-rose-200/30 bg-rose-200/15 text-rose-50"
      : props.tone === "warning"
        ? "border-amber-200/30 bg-amber-200/15 text-amber-50"
        : "border-cyan-200/20 bg-cyan-200/10 text-cyan-50";

  return (
    <article
      className={cn(
        "rounded-[1.6rem] border px-5 py-5 shadow-[0_18px_60px_-44px_rgba(15,23,42,0.9)]",
        toneClasses,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-300">{props.title}</p>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">{props.value}</p>
        </div>
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-2xl border",
            iconClasses,
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{props.description}</p>
    </article>
  );
}

export function DashboardSummary(props: DashboardSummaryProps): JSX.Element {
  const [data, setData] = useState(props.initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
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
      const response = await fetch(`/api/admin/dashboard?eventId=${props.eventId}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as DashboardResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "ダッシュボードの更新に失敗しました。少し待ってから再度お試しください。",
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
            : "ダッシュボードの更新に失敗しました。少し待ってから再度お試しください。",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [props.eventId]);

  useAdminDashboardRealtime({
    enabled: true,
    eventId: props.eventId,
    refresh,
  });

  const summary = useMemo(() => {
    const occupiedTables = data.tables.filter((table) =>
      ["reserved", "in_use", "admin_hold"].includes(table.status),
    ).length;
    const heldTables = data.tables.filter((table) => table.status === "admin_hold").length;
    const interventionCount =
      data.disputedMatches.length +
      data.stalledMatches.length +
      data.disconnectedParticipants.length;

    return {
      occupiedTables,
      heldTables,
      interventionCount,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-5">
        <SummaryCard
          title="卓使用状況"
          value={`${summary.occupiedTables}/${data.tables.length}`}
          description={
            summary.heldTables > 0
              ? `運営 hold ${summary.heldTables} 卓を含みます。`
              : "現在使用中または案内済みの卓数です。"
          }
          icon={Table2}
        />
        <SummaryCard
          title="待機者"
          value={`${data.queueingParticipants.length}人`}
          description="次の卓案内待ち。長く待っている参加者から確認できます。"
          icon={Users}
        />
        <SummaryCard
          title="対戦進行中"
          value={`${data.inProgressMatches.length}件`}
          description="開始待ち、対戦中、勝利申告中をまとめて表示します。"
          icon={Activity}
        />
        <SummaryCard
          title="切断者"
          value={`${data.disconnectedParticipants.length}人`}
          description="再接続待ち。切断前の状態と最終 heartbeat を確認できます。"
          icon={ShieldAlert}
          tone={data.disconnectedParticipants.length > 0 ? "critical" : "neutral"}
        />
        <SummaryCard
          title="要介入"
          value={`${summary.interventionCount}件`}
          description="dispute、停滞試合、切断者を合算した件数です。"
          icon={AlertTriangle}
          tone={summary.interventionCount > 0 ? "warning" : "neutral"}
        />
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] px-5 py-4 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.95)] backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-slate-400 uppercase">
              Room Snapshot
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
              1画面で会場の詰まりを見つける
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              卓、待機、進行中、切断、dispute、停滞試合を同時に見比べて、復旧優先度を即断できる状態を保ちます。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
                isRefreshing
                  ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-slate-950/35",
              )}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "同期中" : "Realtime 監視中"}
            </span>
          </div>
        </div>

        {refreshError ? (
          <div className="mt-4 rounded-[1.25rem] border border-rose-300/30 bg-rose-300/[0.08] px-4 py-3 text-sm leading-6 text-rose-100">
            {refreshError}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr_1fr]">
        <div className="space-y-6">
          <DashboardPanel
            title="卓一覧"
            description="卓番号ごとに現在状態、対戦者、運営 hold を把握します。"
            eyebrow="Tables"
          >
            <div className="overflow-hidden rounded-[1.35rem] border border-white/10">
              {data.tables.length === 0 ? (
                <div className="bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  卓データがまだ作成されていません。
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {data.tables.map((table) => (
                    <div
                      key={table.tableId}
                      className="grid gap-3 bg-slate-950/25 px-4 py-4 lg:grid-cols-[auto_1fr_auto]"
                    >
                      <div>
                        <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
                          Table
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                          {table.tableNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{table.gameTitle}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {table.occupantNicknames.length > 0
                            ? table.occupantNicknames.join(" vs ")
                            : "着席者なし"}
                        </p>
                        {table.heldByAdminDisplayName ? (
                          <p className="mt-1 text-xs text-amber-100">
                            hold: {table.heldByAdminDisplayName}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-start justify-start lg:justify-end">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                          {getTableStatusLabel(table.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="進行中の試合"
            description="開始待ちから勝利申告中までを一覧し、滞留している卓を見つけます。"
            eyebrow="Matches"
          >
            <div className="space-y-3">
              {data.inProgressMatches.length === 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  現在進行中の試合はありません。
                </div>
              ) : (
                data.inProgressMatches.map((match) => (
                  <article
                    key={match.matchId}
                    className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {match.participant1Nickname}
                          {match.participant2Nickname ? ` vs ${match.participant2Nickname}` : ""}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {match.tableNumber ? `${match.tableNumber} 卓` : "卓未割当"} /{" "}
                          {getMatchStatusLabel(match.displayStatus)}
                          {match.isStaffMatch ? " / スタッフ戦" : ""}
                        </p>
                      </div>
                      <div className="text-xs text-slate-400">
                        {match.startedAt ? formatDateTime(match.startedAt) : "開始前"}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </DashboardPanel>
        </div>

        <div className="space-y-6">
          <DashboardPanel
            title="待機者"
            description="待機列の順番とチップ量を見て、詰まりや偏りを把握します。"
            eyebrow="Queue"
          >
            <div className="space-y-3">
              {data.queueingParticipants.length === 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  待機中の参加者はいません。
                </div>
              ) : (
                data.queueingParticipants.map((participant, index) => (
                  <article
                    key={participant.participantId}
                    className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {index + 1}. {participant.nickname}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {formatDateTime(participant.queuedAt)} から待機 /{" "}
                          {participant.chipBalance} chips
                        </p>
                      </div>
                      {participant.isStaffMatchCandidate ? (
                        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
                          staff候補
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="運営戦"
            description="待機者を手動で運営戦へ進め、結果確定までこの画面で完了します。"
            eyebrow="Staff Match"
            accent="amber"
          >
            <StaffMatchForm data={data} refresh={refresh} />
          </DashboardPanel>

          <DashboardPanel
            title="切断者"
            description="再接続待ちの参加者。切断前の状態を見て介入の優先度を判断します。"
            eyebrow="Disconnected"
            accent="rose"
          >
            <div className="space-y-3">
              {data.disconnectedParticipants.length === 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  切断中の参加者はいません。
                </div>
              ) : (
                data.disconnectedParticipants.map((participant) => (
                  <article
                    key={participant.participantId}
                    className="rounded-[1.35rem] border border-rose-300/20 bg-rose-300/[0.08] px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-white">{participant.nickname}</p>
                    <p className="mt-2 text-sm text-slate-200">
                      直前状態: {participant.lastNonDisconnectStatus ?? "不明"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      最終 heartbeat: {formatDateTime(participant.lastSeenAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </DashboardPanel>
        </div>

        <div className="space-y-6">
          <DashboardPanel
            title="Dispute 発生試合"
            description="揉めている試合から優先的に介入できるよう、件数と最終発生時刻をまとめます。"
            eyebrow="Disputes"
            accent="amber"
          >
            <div className="space-y-3">
              {data.disputedMatches.length === 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  dispute 発生中の試合はありません。
                </div>
              ) : (
                data.disputedMatches.map((match) => (
                  <article
                    key={match.matchId}
                    className="rounded-[1.35rem] border border-amber-300/20 bg-amber-300/[0.08] px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {match.tableNumber ? `${match.tableNumber} 卓` : "卓未割当"}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">dispute {match.disputeCount} 回</p>
                    <p className="mt-1 text-xs text-slate-300">
                      最終発生: {formatDateTime(match.lastDisputedAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="停滞試合"
            description="勝利申告から 120 秒以上経過した試合を強調し、運営介入漏れを防ぎます。"
            eyebrow="Stalled"
            accent="amber"
          >
            <div className="space-y-3">
              {data.stalledMatches.length === 0 ? (
                <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-300">
                  停滞試合はありません。
                </div>
              ) : (
                data.stalledMatches.map((match) => (
                  <article
                    key={match.matchId}
                    className="rounded-[1.35rem] border border-amber-300/20 bg-amber-300/[0.08] px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {match.participant1Nickname}
                      {match.participant2Nickname ? ` vs ${match.participant2Nickname}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      {match.tableNumber ? `${match.tableNumber} 卓` : "卓未割当"} /{" "}
                      {formatElapsedMinutes(match.winnerClaimedAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      勝利申告: {formatDateTime(match.winnerClaimedAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </DashboardPanel>
        </div>
      </section>
    </div>
  );
}
