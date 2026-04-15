export interface GameRuleSummary {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  ruleTitle: string;
}

export interface GameRuleDetail {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

export interface CurrentTableGameRule {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  rule: GameRuleDetail;
}

export interface TableGameRuleDetail {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  rule: GameRuleDetail;
}
