"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export function JoinForm(): JSX.Element {
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <p className="text-sm leading-6 text-stone-600">
          QR から開いたら、会場コードと呼ばれたい名前を入れるだけで参加できます。
        </p>
      </div>

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="venueCode">
            <FieldTitle>会場コード</FieldTitle>
            <FieldDescription>
              会場に表示されているコードをそのまま入力してください。
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
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
              className="h-12 rounded-2xl border-stone-300 bg-stone-50 px-4 text-base text-stone-950 placeholder:text-stone-400"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="nickname">
            <FieldTitle>ニックネーム</FieldTitle>
            <FieldDescription>
              対戦相手やランキングに表示される名前です。読みやすい名前がおすすめです。
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
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
              className="h-12 rounded-2xl border-stone-300 bg-stone-50 px-4 text-base text-stone-950 placeholder:text-stone-400"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError>{errorMessage}</FieldError>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
      >
        {isSubmitting ? "参加登録しています..." : "この名前で参加する"}
      </Button>
    </form>
  );
}
