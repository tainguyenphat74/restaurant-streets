// Derived recognition: no claim, persisted reward, or effect on other restaurants.
export const masterIncomeMultiplier = (owned: boolean, level: number) =>
  owned && level >= 100 ? 1.1 : 1;
