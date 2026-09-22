export const RISK_CONFIG: Record<string, { ltv: number }> = {
  OPENAI: { ltv: 0.60 },
  ANTHROPIC: { ltv: 0.60 },
  FIGUREAI: { ltv: 0.55 },
  ANDURIL: { ltv: 0.55 },
  NEURALINK: { ltv: 0.50 },
  KALSHI: { ltv: 0.50 },
  POLYMARKET: { ltv: 0.50 },
};

export function getLtvForSymbol(symbol: string): number {
  const config = RISK_CONFIG[symbol.toUpperCase()];
  return config ? config.ltv : 0.50; // Default to 50%
}
