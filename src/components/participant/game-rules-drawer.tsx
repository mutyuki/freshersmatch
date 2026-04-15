"use client";

import { useEffect, useMemo, useState, type JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  CurrentTableGameRule,
  GameRuleSummary,
  TableGameRuleDetail,
} from "@/lib/contracts/game-rules";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

type Props = {
  mode: "current" | "list";
  triggerLabel: string;
  disabled?: boolean;
  className?: string;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

function getSessionToken(): string {
  const token = getParticipantSessionToken();

  if (!token) {
    throw new Error("参加セッションが見つかりません。参加登録をやり直してください。");
  }

  return token;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getSessionToken()}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as { data?: T } | ApiErrorPayload | null;

  if (!response.ok || !payload || !("data" in payload) || payload.data === undefined) {
    throw new Error(
      payload && "error" in payload
        ? (payload.error?.message ?? "ルールの取得に失敗しました。")
        : "ルールの取得に失敗しました。",
    );
  }

  return payload.data;
}

function formatUpdatedAt(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "更新日時不明";
  }

  return `${parsed.toLocaleDateString("ja-JP")} ${parsed.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function GameRulesDrawer(props: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<GameRuleSummary[]>([]);
  const [detail, setDetail] = useState<CurrentTableGameRule | TableGameRuleDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setErrorMessage(null);

    if (props.mode === "current") {
      setDetail(null);
      setIsLoadingDetail(true);
      void fetchJson<CurrentTableGameRule>("/api/participant/current-rule")
        .then((payload) => {
          setDetail(payload);
        })
        .catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : "ルールの取得に失敗しました。");
        })
        .finally(() => {
          setIsLoadingDetail(false);
        });
      return;
    }

    setDetail(null);
    setIsLoadingList(true);
    void fetchJson<GameRuleSummary[]>("/api/participant/rules")
      .then((payload) => {
        setList(Array.isArray(payload) ? payload : []);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "ルール一覧の取得に失敗しました。");
      })
      .finally(() => {
        setIsLoadingList(false);
      });
  }, [open, props.mode]);

  async function openRuleDetail(tableId: string): Promise<void> {
    setIsLoadingDetail(true);
    setErrorMessage(null);

    try {
      const payload = await fetchJson<TableGameRuleDetail>(
        `/api/participant/rules?tableId=${encodeURIComponent(tableId)}`,
      );
      setDetail(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ルールの取得に失敗しました。");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  const title = props.mode === "current" ? "この卓のルール" : detail ? `卓 ${detail.tableNumber} のルール` : "ゲームルール一覧";
  const description = useMemo(() => {
    if (props.mode === "current") {
      return "対戦を止めずに、この卓で使うルールだけ確認できます。";
    }

    if (detail) {
      return `${detail.gameTitle} のルール詳細です。`;
    }

    return "卓ごとのルールを一覧から選んで確認できます。";
  }, [detail, props.mode]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={props.className}
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        {props.triggerLabel}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto w-full max-w-xl">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <ScrollArea className="max-h-[58vh] px-4 pb-4">
            {props.mode === "list" && !detail ? (
              <div className="space-y-3">
                {isLoadingList ? (
                  <p className="text-sm text-muted-foreground">ルール一覧を読み込み中です...</p>
                ) : null}
                {!isLoadingList && list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">公開中の卓ルールはまだありません。</p>
                ) : null}
                {(Array.isArray(list) ? list : []).map((item) => (
                  <button
                    key={item.tableId}
                    type="button"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    onClick={() => void openRuleDetail(item.tableId)}
                    disabled={isLoadingDetail}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      卓 {item.tableNumber} / {item.gameTitle}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.ruleTitle}</p>
                  </button>
                ))}
              </div>
            ) : null}

            {(props.mode === "current" || detail) && (
              <div className="space-y-4">
                {isLoadingDetail ? (
                  <p className="text-sm text-muted-foreground">ルール本文を読み込み中です...</p>
                ) : null}
                {!isLoadingDetail && detail ? (
                  <>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold text-foreground">
                        卓 {detail.tableNumber} / {detail.gameTitle}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{detail.rule.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        最終更新: {formatUpdatedAt(detail.rule.updatedAt)}
                      </p>
                    </div>
                    <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 text-sm leading-7 text-foreground">
                      {detail.rule.body}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </ScrollArea>

          <DrawerFooter>
            {props.mode === "list" && detail ? (
              <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                一覧に戻る
              </Button>
            ) : null}
            <Button type="button" onClick={() => setOpen(false)}>
              閉じる
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
