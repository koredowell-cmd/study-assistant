export const PLANS = {
  week: { name: "Weekly pass", pesewas: 1190, days: 7, uploads: 20 },
  month: { name: "Monthly pass", pesewas: 3990, days: 30, uploads: 60 },
} as const;

export type PlanId = keyof typeof PLANS;

export function cedis(pesewas: number) {
  return (pesewas / 100).toFixed(2);
}