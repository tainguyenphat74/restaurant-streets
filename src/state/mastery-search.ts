// Filter only names, retaining the supplied order and catalog objects.
export function masterySearch<T extends { name: string }>(
  catalog: readonly T[],
  query: string,
): T[] {
  const search = query.trim().toLowerCase();
  return catalog.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(search),
  );
}
