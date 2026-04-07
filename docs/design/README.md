# 1対1カードゲーム用マッチングWebアプリ設計書

このディレクトリには、新入生歓迎会向けの「1対1カードゲーム用マッチングWebアプリ」のMVP設計を要点ごとに分割して記載する。

## ドキュメント一覧

1. [00-requirements-and-mvp.md](/Users/kitamurareiki/develop/match/docs/design/00-requirements-and-mvp.md)
   - 要件の要約
   - 補完した前提
   - MVP範囲
   - 画面一覧
   - 主要ユーザーフロー
2. [01-state-and-realtime.md](/Users/kitamurareiki/develop/match/docs/design/01-state-and-realtime.md)
   - 参加者の状態一覧
   - 卓の状態一覧
   - 試合状態
   - 状態遷移設計
   - リアルタイム通信の設計方針
3. [02-data-model-and-api.md](/Users/kitamurareiki/develop/match/docs/design/02-data-model-and-api.md)
   - データモデル / DBテーブル案
   - 各テーブルの主要カラム
   - API設計案
4. [03-admin-ops-and-failures.md](/Users/kitamurareiki/develop/match/docs/design/03-admin-ops-and-failures.md)
   - 管理画面の設計
   - 例外処理・障害時挙動
   - 危険な点・注意点
5. [04-implementation-plan.md](/Users/kitamurareiki/develop/match/docs/design/04-implementation-plan.md)
   - 推奨技術スタック
   - 1週間で実装するための開発順序
   - ディレクトリ構成案
   - Codex / AI駆動開発向けの実装分割方針
   - 最初に作るべきタスク一覧

## 読み方

- 実装着手時は `00` → `01` → `02` の順に読む。
- AIに段階的に実装させる場合は `04` を実装チケットの元にする。
- 状態不整合や運営介入時の扱いは `01` と `03` を基準に固定する。
