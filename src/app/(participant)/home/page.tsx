import type { JSX } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";

export default function HomePage(): JSX.Element {
  return (
    <ParticipantShell title="参加登録が完了しました">
      <div className="space-y-4 text-sm leading-6 text-stone-700">
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          登録が完了しました。次のタスクで、現在の状態やチップ数を確認できるホーム画面をここに追加します。
        </div>
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
          セッショントークンはこの端末に保存されています。以後は復元処理からこの画面へ戻れる前提で進めます。
        </div>
      </div>
    </ParticipantShell>
  );
}
