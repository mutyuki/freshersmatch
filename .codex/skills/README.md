# Codex Skills For This Project

このディレクトリは、そのまま `~/.codex/skills/` に移しやすい構成で作ってある。

## 含まれるスキル

- `freshers-match-overview`
- `freshers-match-db-api`
- `freshers-match-participant-ui`
- `freshers-match-match-flow`
- `freshers-match-admin-ui`
- `freshers-match-testing`

各スキルは以下を持つ。

- `SKILL.md`
- `agents/openai.yaml`
- `references/`

## 配置方法

例:

```bash
cp -R /Users/kitamurareiki/develop/match/codex-skills/freshers-match-* ~/.codex/skills/
```

## 使い分け

- 全体方針の確認: `$freshers-match-overview`
- DB / API / service 実装: `$freshers-match-db-api`
- 参加者向けスマホUI: `$freshers-match-participant-ui`
- マッチング / 状態遷移 / Realtime: `$freshers-match-match-flow`
- admin / monitor UI: `$freshers-match-admin-ui`
- TDD / 回帰テスト: `$freshers-match-testing`
