"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveParticipantSessionToken } from "@/lib/session/participant-client-session";

interface RegisterParticipantSuccess {
  data: {
    participant: {
      id: string;
    };
    sessionToken: string;
  };
}

interface RegisterParticipantFailure {
  error: {
    code: string;
    message: string;
  };
}

function getErrorMessage(error: RegisterParticipantFailure["error"]): string {
  switch (error.code) {
    case "participant_nickname_conflict":
      return "そのニックネームはすでに使われています。別の名前で登録してください。";
    case "event_not_found":
      return "会場コードが見つかりません。表示されたコードをもう一度確認してください。";
    case "venueCode_required":
      return "会場コードを入力してください。";
    case "nickname_required":
      return "ニックネームを入力してください。";
    default:
      return error.message;
  }
}

export default function JoinPage(): JSX.Element {
  const router = useRouter();
  const [venueCode, setVenueCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/participant/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueCode,
          nickname,
        }),
      });

      const payload = (await response.json()) as
        | RegisterParticipantSuccess
        | RegisterParticipantFailure;

      if (!response.ok) {
        if ("error" in payload) {
          setErrorMessage(getErrorMessage(payload.error));
          return;
        }

        setErrorMessage("参加登録に失敗しました。もう一度お試しください。");
        return;
      }

      if (!("data" in payload) || !payload.data.sessionToken) {
        setErrorMessage("セッション情報の保存に失敗しました。もう一度お試しください。");
        return;
      }

      saveParticipantSessionToken(payload.data.sessionToken);
      router.push("/home");
    } catch {
      setErrorMessage("通信に失敗しました。電波状況を確認してもう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-col gap-4">
      <header className="space-y-2 px-1 pb-2 pt-1">
        <div className="space-y-2">
          <p className="text-sm leading-6 text-muted-foreground">
            はじめての対戦前に、会場コードとニックネームを登録します。入力後すぐにホームへ進みます。
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            会場コードを入れて参加する
          </h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>参加登録</CardTitle>
          <CardDescription>
            QR から開いたら、会場コードと呼ばれたい名前を入れるだけで参加できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="venueCode">会場コード</Label>
              <p className="text-sm text-muted-foreground">
                会場に表示されているコードをそのまま入力してください。
              </p>
              <Input
                id="venueCode"
                name="venueCode"
                aria-label="会場コード"
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="next"
                inputMode="text"
                placeholder="例: VENUE-1"
                value={venueCode}
                onChange={(event) => setVenueCode(event.target.value)}
                disabled={isSubmitting}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">ニックネーム</Label>
              <p className="text-sm text-muted-foreground">
                対戦相手やランキングに表示される名前です。読みやすい名前がおすすめです。
              </p>
              <Input
                id="nickname"
                name="nickname"
                aria-label="ニックネーム"
                autoComplete="nickname"
                enterKeyHint="send"
                inputMode="text"
                maxLength={24}
                placeholder="例: りく"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                disabled={isSubmitting}
                className="h-12"
              />
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" disabled={isSubmitting} className="h-12 w-full">
              {isSubmitting ? "参加登録しています..." : "この名前で参加する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
