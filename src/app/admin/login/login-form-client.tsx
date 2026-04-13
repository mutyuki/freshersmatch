"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function LoginFormClient(): JSX.Element {
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
        body: JSON.stringify({ passcode }),
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
      <div className="block space-y-2">
        <Label htmlFor="passcode">運営パスコード</Label>
        <Input
          id="passcode"
          aria-label="運営パスコード"
          className="h-12"
          name="passcode"
          placeholder="Passcode"
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
        />
      </div>
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="h-12 w-full">
        {isSubmitting ? "ログインしています..." : "ログイン"}
      </Button>
    </form>
  );
}
