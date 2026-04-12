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

interface AdminLoginSuccess {
  data: {
    adminUserId: string;
  };
}

interface AdminLoginFailure {
  error: {
    code: string;
    message: string;
  };
}

function getErrorMessage(error: AdminLoginFailure["error"]): string {
  switch (error.code) {
    case "admin_passcode_invalid":
      return "パスコードが違います。もう一度入力してください。";
    case "admin_user_not_found":
      return "運営ユーザーが見つかりません。設定を確認してください。";
    default:
      return error.message;
  }
}

export function AdminLoginForm(): JSX.Element {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
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
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passcode,
        }),
      });

      const payload = (await response.json()) as AdminLoginSuccess | AdminLoginFailure;

      if (!response.ok) {
        if ("error" in payload) {
          setErrorMessage(getErrorMessage(payload.error));
          return;
        }

        setErrorMessage("ログインに失敗しました。もう一度お試しください。");
        return;
      }

      router.push("/admin/dashboard");
    } catch {
      setErrorMessage("通信に失敗しました。接続を確認してもう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="passcode">
            <FieldTitle>運営パスコード</FieldTitle>
            <FieldDescription>
              会場運営用に配布されたパスコードを入力すると、現在のブラウザだけに管理セッションを発行します。
            </FieldDescription>
          </FieldLabel>
          <FieldContent>
            <Input
              id="passcode"
              name="passcode"
              aria-label="運営パスコード"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Passcode"
              type="password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              disabled={isSubmitting}
              className="h-12 rounded-2xl border-slate-300 bg-slate-50 px-4 text-base text-slate-950 placeholder:text-slate-400"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError>{errorMessage}</FieldError>

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 w-full rounded-2xl bg-slate-950 text-base font-semibold text-white hover:bg-slate-800"
      >
        {isSubmitting ? "ログインしています..." : "ログイン"}
      </Button>
    </form>
  );
}
