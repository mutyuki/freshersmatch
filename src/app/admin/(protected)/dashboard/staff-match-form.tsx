"use client";

import { useEffect, useMemo, useState, type JSX } from "react";

import type { AdminDashboardData } from "@/lib/contracts/admin-dashboard";

type MutationResponse = {
  data?: {
    ok?: boolean;
  };
  error?: {
    message?: string;
  };
};

type StaffMatchFormProps = {
  data: AdminDashboardData;
  refresh: () => Promise<void>;
};

function getErrorMessage(payload: MutationResponse | null, fallback: string): string {
  return payload?.error?.message ?? fallback;
}

export function StaffMatchForm(props: StaffMatchFormProps): JSX.Element {
  const availableTables = useMemo(
    () => props.data.tables.filter((table) => table.status === "available"),
    [props.data.tables],
  );
  const staffMatches = useMemo(
    () => props.data.inProgressMatches.filter((match) => match.isStaffMatch),
    [props.data.inProgressMatches],
  );

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    props.data.queueingParticipants[0]?.participantId ?? "",
  );
  const [selectedTableId, setSelectedTableId] = useState("auto");
  const [isSubmittingStart, setIsSubmittingStart] = useState(false);
  const [isResolvingMatchId, setIsResolvingMatchId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedParticipantId &&
      props.data.queueingParticipants.some(
        (participant) => participant.participantId === selectedParticipantId,
      )
    ) {
      return;
    }

    setSelectedParticipantId(props.data.queueingParticipants[0]?.participantId ?? "");
  }, [props.data.queueingParticipants, selectedParticipantId]);

  useEffect(() => {
    if (
      selectedTableId === "auto" ||
      availableTables.some((table) => table.tableId === selectedTableId)
    ) {
      return;
    }

    setSelectedTableId("auto");
  }, [availableTables, selectedTableId]);

  const selectedParticipant =
    props.data.queueingParticipants.find(
      (participant) => participant.participantId === selectedParticipantId,
    ) ?? null;

  async function handleStartStaffMatch(): Promise<void> {
    if (!selectedParticipant) {
      setErrorMessage("待機中の参加者を選んでください。");
      return;
    }

    const selectedTable =
      selectedTableId === "auto"
        ? null
        : (availableTables.find((table) => table.tableId === selectedTableId) ?? null);
    const confirmMessage = [
      `待機者: ${selectedParticipant.nickname}`,
      `待機開始: ${selectedParticipant.queuedAt}`,
      `卓: ${selectedTable ? `${selectedTable.tableNumber} 卓 / ${selectedTable.gameTitle}` : "自動選択"}`,
      "この内容で運営戦を開始しますか？",
    ].join("\n");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSubmittingStart(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/staff-match/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: selectedParticipant.participantId,
          tableId: selectedTableId === "auto" ? undefined : selectedTableId,
          confirm: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as MutationResponse | null;

      if (!response.ok || !payload?.data?.ok) {
        throw new Error(
          getErrorMessage(payload, "運営戦の開始に失敗しました。時間をおいて再度お試しください。"),
        );
      }

      await props.refresh();
      setSuccessMessage(`${selectedParticipant.nickname} を運営戦へ案内しました。`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "運営戦の開始に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsSubmittingStart(false);
    }
  }

  async function handleResolveStaffMatch(params: {
    matchId: string;
    participantNickname: string;
    tableNumber: number | null;
    participantWon: boolean;
  }): Promise<void> {
    const outcomeLabel = params.participantWon ? "参加者勝利" : "参加者敗北";
    const confirmMessage = [
      `対象: ${params.participantNickname}`,
      `卓: ${params.tableNumber ? `${params.tableNumber} 卓` : "卓未割当"}`,
      `確定結果: ${outcomeLabel}`,
      "この内容で運営戦の結果を確定しますか？",
    ].join("\n");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsResolvingMatchId(params.matchId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/staff-match/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: params.matchId,
          participantWon: params.participantWon,
          confirm: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as MutationResponse | null;

      if (!response.ok || !payload?.data?.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            "運営戦結果の確定に失敗しました。時間をおいて再度お試しください。",
          ),
        );
      }

      await props.refresh();
      setSuccessMessage(`${params.participantNickname} の結果を ${outcomeLabel} で確定しました。`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "運営戦結果の確定に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsResolvingMatchId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-border bg-card px-4 py-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">待機者から運営戦を開始</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            待機中 participant と空き卓を使って、差し替え不可の運営戦を確定します。
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              対象参加者
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground"
              disabled={props.data.queueingParticipants.length === 0 || isSubmittingStart}
              onChange={(event) => setSelectedParticipantId(event.target.value)}
              value={selectedParticipantId}
            >
              {props.data.queueingParticipants.length === 0 ? (
                <option value="">待機中の参加者はいません</option>
              ) : (
                props.data.queueingParticipants.map((participant) => (
                  <option key={participant.participantId} value={participant.participantId}>
                    {participant.nickname}
                    {participant.isStaffMatchCandidate ? " / staff候補" : ""}
                    {` / ${participant.chipBalance} chips`}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              使用卓
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground"
              disabled={availableTables.length === 0 || isSubmittingStart}
              onChange={(event) => setSelectedTableId(event.target.value)}
              value={selectedTableId}
            >
              <option value="auto">自動選択</option>
              {availableTables.map((table) => (
                <option key={table.tableId} value={table.tableId}>
                  {table.tableNumber} 卓 / {table.gameTitle}
                </option>
              ))}
            </select>
          </label>

          {selectedParticipant ? (
            <div className="rounded-2xl border border-secondary/30 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              <p className="font-medium">{selectedParticipant.nickname}</p>
              <p className="mt-1">
                {selectedParticipant.isStaffMatchCandidate
                  ? "待機閾値を超えているため、通常戦より優先して運営戦へ案内できます。"
                  : "待機閾値前でも、運営判断で手動開始できます。"}
              </p>
            </div>
          ) : null}

          <button
            className="inline-flex w-full items-center justify-center rounded-2xl border border-accent/30 bg-accent/20 px-4 py-3 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selectedParticipant || isSubmittingStart}
            onClick={() => {
              void handleStartStaffMatch();
            }}
            type="button"
          >
            {isSubmittingStart ? "開始中..." : "運営戦を開始する"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">進行中の運営戦を結果確定</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            運営戦は参加者の勝利申告を使わず、ここから直接結果を確定します。
          </p>
        </div>

        {staffMatches.length === 0 ? (
          <div className="rounded-[1.35rem] border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            現在、結果確定待ちの運営戦はありません。
          </div>
        ) : (
          staffMatches.map((match) => (
            <article
              key={match.matchId}
              className="rounded-[1.35rem] border border-border bg-card px-4 py-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {match.participant1Nickname}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {match.tableNumber ? `${match.tableNumber} 卓` : "卓未割当"} /{" "}
                    {match.displayStatus === "winner_claimed" ? "運営確定待ち" : "対戦中"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isResolvingMatchId === match.matchId}
                    onClick={() => {
                      void handleResolveStaffMatch({
                        matchId: match.matchId,
                        participantNickname: match.participant1Nickname,
                        tableNumber: match.tableNumber,
                        participantWon: true,
                      });
                    }}
                    type="button"
                  >
                    参加者勝利で確定
                  </button>
                  <button
                    className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isResolvingMatchId === match.matchId}
                    onClick={() => {
                      void handleResolveStaffMatch({
                        matchId: match.matchId,
                        participantNickname: match.participant1Nickname,
                        tableNumber: match.tableNumber,
                        participantWon: false,
                      });
                    }}
                    type="button"
                  >
                    参加者敗北で確定
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-primary/20 bg-emerald-300/[0.08] px-4 py-3 text-sm text-primary">
          {successMessage}
        </div>
      ) : null}
    </div>
  );
}
