export type Decoration = {
  key: 'tree' | 'lamp' | 'bench';
  x: number;
  y: number;
  scale: number;
};
// screenY = (gx + gy) * 32, so moving entities sort with buildings.
export const depthAt = (screenY: number): number => screenY / 32;
export function decorationLayout(seed: number): Decoration[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const decorations: Decoration[] = [];
  for (let i = 0; i < 26; i++) {
    decorations.push({
      key: 'tree',
      x: 0.5 + (i % 13) + random() * 0.45,
      y: (i < 13 ? 1 : 13) + (random() - 0.5) * 1.2,
      scale: 0.65 + random() * 0.25,
    });
  }
  for (let x = 2; x < 13; x += 3) {
    decorations.push({ key: 'lamp', x: x + random() * 0.3, y: 6, scale: 0.65 });
    decorations.push({ key: 'bench', x: x + random() * 0.3, y: 9, scale: 0.7 });
  }
  return decorations;
}
