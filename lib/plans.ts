export const PLANS = {
  week: {
    name: "Weekly pass",
    pesewas: 990,
    days: 7,
    uploads: 15,
  },
  month: {
    name: "Monthly pass",
    pesewas: 2990,
    days: 30,
    uploads: 50,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function cedis(pesewas: number) {
  return (pesewas / 100).toFixed(2);
}