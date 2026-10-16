import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { StreetScene } from './StreetScene';
import { presentation } from '../assets';

function setup(sprite = false) {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const scene = new StreetScene({ select() {}, project() {} });
  // Minimal display objects exercise the actual refresh/update paths without a DOM.
  const object = (x = 0, y = 0) => {
    const o: any = { x, y, list: [], visible: true };
    for (const method of ['clear', 'lineStyle', 'strokePoints', 'setDepth'])
      o[method] = () => o;
    o.setVisible = (v: boolean) => { o.visible = v; return o; };
    o.setPosition = (x: number, y: number) => { Object.assign(o, { x, y }); return o; };
    o.setScale = (x: number, y = x) => { Object.assign(o, { scaleX: x, scaleY: y }); return o; };
    o.setOrigin = (x: number, y: number) => { Object.assign(o, { originX: x, originY: y }); return o; };
    o.add = (parts: any[]) => { o.list.push(...(Array.isArray(parts) ? parts : [parts])); return o; };
    return o;
  };
  const s = scene as any;
  s.ready = true;
  s.outline = object();
  s.buildings = { get: () => object() };
  s.lots = { get: () => object() };
  s.add = Object.fromEntries(['ellipse', 'rectangle', 'circle', 'image'].map(k => [k, object]));
  s.add.container = (x: number, y: number, parts: any[]) => object(x, y).add(parts);
  s.cameras = { main: { zoom: 1, scrollX: 0, scrollY: 0, width: 800, height: 600 } };
  if (sprite) presentation.walker = { file: 'test.svg', anchorX: 0.2, anchorY: 0.8, scale: 1.7 };
  scene.refresh();
  return { scene, s };
}
afterEach(() => { delete presentation.walker; vi.unstubAllGlobals(); });
describe('customer presentation and read-only QA', () => {
  it('preserves external walker metadata and never animates its image as a leg', () => {
    const { scene, s } = setup(true);
    const image = s.walkers[0].list[1];
    expect(s.walkers[0].list).toHaveLength(2);
    expect(image).toMatchObject({ originX: 0.2, originY: 0.8, scaleX: 1.7, scaleY: 1.7, y: 0 });
    scene.update(100, 100);
    expect(image.y).toBe(0);
    expect(image.scaleX).toBe(1.7);
  });
  it('freezes and resumes primitive customers when reduced motion switches', () => {
    const { scene, s } = setup();
    scene.update(100, 100);
    s.reduced.matches = true;
    const frozen = scene.snapshot();
    scene.update(200, 100);
    expect(scene.snapshot()).toEqual(frozen);
    expect(s.walkers[0].list[1].y).toBe(-5);
    expect(s.walkers[0].list[2].y).toBe(-5);
    s.reduced.matches = false;
    scene.update(300, 100);
    expect(scene.snapshot()).not.toEqual(frozen);
  });
  it('returns not ready throughout camera teardown and disposal', () => {
    const { scene, s } = setup();
    s.cameras.main = undefined;
    expect(scene.snapshot()).toEqual({ ready: false });
    s.cameras = undefined;
    expect(scene.snapshot()).toEqual({ ready: false });
    s.disposed = true;
    expect(scene.snapshot()).toEqual({ ready: false });
  });
  it('copies routes so QA consumers cannot mutate the simulation', () => {
    const { scene } = setup();
    const snapshot = scene.snapshot();
    snapshot.customers![0].route[0].x = 99999;
    expect(scene.snapshot().customers![0].route[0].x).not.toBe(99999);
  });
});
