export interface SeasonMoneySettings {
  fee_amount: number
  draft_food_cost: number
  weekly_prize_amount: number
  prize_structure: Record<string, number>
}

export function validateSeasonMoney(input: unknown): SeasonMoneySettings | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  const validAmount = (amount: unknown): amount is number => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001
  if (!validAmount(value.fee_amount) || !validAmount(value.draft_food_cost) || !validAmount(value.weekly_prize_amount)) return null
  if (!value.prize_structure || typeof value.prize_structure !== 'object' || Array.isArray(value.prize_structure)) return null
  const prizes = Object.entries(value.prize_structure)
  if (prizes.length > 32 || prizes.some(([key, amount]) => !/^[a-z0-9_]{1,64}$/.test(key) || !validAmount(amount))) return null
  return { fee_amount: value.fee_amount, draft_food_cost: value.draft_food_cost, weekly_prize_amount: value.weekly_prize_amount, prize_structure: Object.fromEntries(prizes) }
}
