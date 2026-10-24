import Phaser from 'phaser';
import { iso, plotsForStreet } from '../iso';
import { buildingDepth, decorationLayout, depthAt } from '../world';
import { loadAssets, metadata, previews } from '../assets';
import { placeholders } from '../placeholders';
import { useGame } from '../../state/store';
import {
  advanceCustomer,
  createCustomer,
  entrance,
  population,
  type Customer,
} from '../customers';
import { totalIncome } from '../../state/economy';
export type MapHooks = {
  select: (id: string) => void;
  project: (positions: Record<string, { x: number; y: number }>) => void;
};
export class StreetScene extends Phaser.Scene {
  private plots = plotsForStreet(useGame.getState().data.neighborhood.currentStreet);
  buildings = new Map<string, Phaser.GameObjects.Image>();
  private lots = new Map<string, Phaser.GameObjects.Graphics>();
  private walkers: Phaser.GameObjects.Container[] = [];
  private customers: Customer[] = [];
  private walkerLegs = new WeakMap<Phaser.GameObjects.Container, Phaser.GameObjects.Rectangle[]>();
  private coins: Phaser.GameObjects.Image[] = [];
  private outline!: Phaser.GameObjects.Graphics;
  private ready = false;
  private disposed = false;
  private dragged = false;
  private gesture: { x: number; y: number; distance: number } | null = null;
  private origin = { x: 0, y: 0 };
  private projection = '';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private hooks: MapHooks) {
    super('street');
  }
  async create() {
    const dispose = () => {
      this.disposed = true;
      this.ready = false;
    };
    this.events.once('shutdown', dispose);
    this.events.once('destroy', dispose);
    await loadAssets(this);
    if (this.disposed || !this.sys?.isActive()) return;
    placeholders(this);
    // Keep the existing opaque backdrop while the pooled display context retains alpha.
    this.cameras.main.setBackgroundColor('#cee5b7');
    this.cameras.main.setBounds(-1100, -350, 2200, 1650);
    this.recenter();
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        const p = iso(x, y);
        this.add
          .image(
            p.x,
            p.y,
            x > 13
              ? 'water'
              : y === 7 || y === 8
                ? 'road'
                : y === 6 || y === 9
                  ? 'sidewalk'
                  : 'grass',
          )
          .setDepth(x + y - 50);
      }
    for (let i = 0; i < 15; i++) {
      const p = iso(13.5, i);
      this.add.rectangle(p.x, p.y - 12, 4, 30, 0x76978a).setDepth(35);
      if (i < 14) {
        const q = iso(13.5, i + 1);
        this.add
          .line(0, 0, p.x, p.y - 22, q.x, q.y - 22, 0x76978a)
          .setOrigin(0)
          .setDepth(35);
      }
    }
    for (const decoration of decorationLayout(74)) {
      this.decor(decoration.key, decoration.x, decoration.y, decoration.scale);
    }
    this.outline = this.add.graphics().setDepth(0);
    for (const plot of this.plots) {
      const p = iso(plot.x, plot.y),
        key = 'building_' + plot.id,
        m = metadata(key);
      const lot = this.add.graphics().setDepth(plot.x + plot.y - 1);
      lot.fillStyle(0xd5bb91).fillPoints(
        [
          { x: p.x - 90, y: p.y - 45 },
          { x: p.x, y: p.y - 90 },
          { x: p.x + 90, y: p.y - 45 },
          { x: p.x, y: p.y },
        ],
        true,
      );
      lot.lineStyle(3, 0xfff4d8).strokePoints(
        [
          { x: p.x - 90, y: p.y - 45 },
          { x: p.x, y: p.y - 90 },
          { x: p.x + 90, y: p.y - 45 },
          { x: p.x, y: p.y },
        ],
        true,
      );
      this.lots.set(plot.id, lot);
      const b = this.add
        .image(p.x, p.y, key)
        .setOrigin(m.anchorX, m.anchorY)
        .setScale(m.scale);
      this.buildings.set(plot.id, b);
      b.setDepth(buildingDepth(p.y, this.entrance(plot.id).door.y));
      previews[plot.id] = this.textures.getBase64(key);
    }
    for (let i = 0; i < 12; i++)
      this.coins.push(
        this.add
          .image(0, 0, 'coin')
          .setOrigin(metadata('coin').anchorX, metadata('coin').anchorY)
          .setScale(metadata('coin').scale)
          .setDepth(100)
          .setVisible(false),
      );
    const unsubscribe = useGame.subscribe((state, previous) => {
      this.refresh();
      for (const p of this.plots) {
        const a = state.data.restaurants[p.id],
          b = previous.data.restaurants[p.id];
        if (a.register < b.register && state.data.coins > previous.data.coins)
          this.floatCoins(p.id);
        if (
          a.level > b.level ||
          (state.selected === p.id && previous.selected !== p.id)
        ) {
          const image = this.buildings.get(p.id)!;
          if (!this.reduced.matches) {
            this.tweens.killTweensOf(image);
            image.y = iso(p.x, p.y).y;
            this.tweens.add({
              targets: image,
              y: image.y - 10,
              duration: 140,
              yoyo: true,
            });
          }
        }
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointers().length === 1) {
        this.dragged = false;
        this.origin = { x: p.x, y: p.y };
      } else this.dragged = true;
      this.gesture = this.measure();
    });
    this.input.on('pointermove', () => {
      const next = this.measure(),
        prev = this.gesture;
      if (!next || !prev) return;
      if (
        next.distance > 0 ||
        Math.hypot(next.x - this.origin.x, next.y - this.origin.y) > 7
      )
        this.dragged = true;
      if (this.dragged) {
        const c = this.cameras.main;
        c.scrollX -= (next.x - prev.x) / c.zoom;
        c.scrollY -= (next.y - prev.y) / c.zoom;
        if (next.distance > 0 && prev.distance > 0)
          this.zoom(next.distance / prev.distance);
      }
      this.gesture = next;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.dragged && !this.pointers().length) {
        const w = this.cameras.main.getWorldPoint(p.x, p.y);
        const hit = [...this.plots].reverse().find((plot) => {
          const q = iso(plot.x, plot.y);
          return (
            Math.abs(w.x - q.x) < 95 &&
            w.y < q.y &&
            w.y >
              q.y -
                (useGame.getState().data.restaurants[plot.id].owned ? 190 : 90)
          );
        });
        if (hit) this.hooks.select(hit.id);
      }
      this.gesture = this.measure();
    });
    this.input.on('pointerupoutside', () => {
      this.dragged = true;
      this.gesture = this.measure();
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _x: number, dy: number) =>
      this.zoom(dy > 0 ? 0.92 : 1.08),
    );
    this.scale.on('resize', this.recenter, this);
    const motion = () => {
      this.tweens.killAll();
      for (const p of this.plots) this.buildings.get(p.id)?.setY(iso(p.x, p.y).y);
      for (const c of this.coins) c.setVisible(false);
      this.refresh();
    };
    this.reduced.addEventListener('change', motion);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unsubscribe();
      this.reduced.removeEventListener('change', motion);
      this.scale?.off('resize', this.recenter, this);
      this.input?.removeAllListeners();
      this.tweens?.killAll();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.ready = true;
    this.refresh();
  }
  private entrance = (id: string) => {
    const building = this.buildings.get(id);
    return entrance(id, { ...metadata('building_' + id), width: building?.width, height: building?.height });
  };
  private pointers() {
    return this.input.manager.pointers.filter((p) => p.isDown);
  }
  private measure() {
    const p = this.pointers();
    if (!p.length) return null;
    return {
      x: p.reduce((n, a) => n + a.x, 0) / p.length,
      y: p.reduce((n, a) => n + a.y, 0) / p.length,
      distance:
        p.length > 1
          ? Phaser.Math.Distance.Between(p[0].x, p[0].y, p[1].x, p[1].y)
          : 0,
    };
  }
  refresh() {
    if (!this.ready) return;
    const state = useGame.getState();
    this.outline.clear();
    for (const p of this.plots) {
      const r = state.data.restaurants[p.id];
      this.buildings.get(p.id)!.setVisible(r.owned);
      this.lots.get(p.id)!.setVisible(!r.owned);
      if (state.selected === p.id) {
        const q = iso(p.x, p.y);
        this.outline.lineStyle(5, 0xe8553a).strokePoints(
          [
            { x: q.x - 102, y: q.y - 48 },
            { x: q.x, y: q.y - 100 },
            { x: q.x + 102, y: q.y - 48 },
            { x: q.x, y: q.y + 5 },
          ],
          true,
        );
      }
    }
    const count = population(totalIncome(state.data, state.now));
    while (this.walkers.length > count) {
      this.walkers.pop()!.destroy();
      this.customers.pop();
    }
    while (this.walkers.length < count) {
      const i = this.walkers.length,
        customer = createCustomer(i);
      const shadow = this.add.ellipse(0, -1, 17, 7, 0x435d45, 0.22);
      const m = metadata('walker');
      const walker = this.add.container(customer.x, customer.y, [shadow]);
      if (m.file) {
        walker.add(
          this.add.image(0, 0, 'walker')
            .setOrigin(m.anchorX, m.anchorY)
            .setScale(m.scale),
        );
      } else {
        const legs = [
          this.add.rectangle(-3, -5, 4, 10, 0x526576),
          this.add.rectangle(3, -5, 4, 10, 0x526576),
        ];
        const shirt = this.add.rectangle(
          0,
          -17,
          13,
          16,
          [0xe78870, 0x65a8aa, 0x8f87bd, 0xeebc55][i % 4],
        );
        const head = this.add.circle(
          0,
          -30,
          7,
          [0xffd6ac, 0xc98d65, 0x956447][i % 3],
        );
        const hair = this.add.ellipse(
          -1,
          -35,
          14,
          7,
          [0x644c3e, 0x393c40, 0xc49858][i % 3],
        );
        const nose = this.add.circle(
          6,
          -29,
          2,
          [0xffd6ac, 0xc98d65, 0x956447][i % 3],
        );
        walker.add([...legs, shirt, head, hair, nose]);
        this.walkerLegs.set(walker, legs);
      }
      this.walkers.push(walker);
      this.customers.push(customer);
    }
  }

  private floatCoins(id: string) {
    if (this.reduced.matches) return;
    const plot = this.plots.find((p) => p.id === id)!,
      p = iso(plot.x, plot.y);
    for (let i = 0; i < 3; i++) {
      const c = this.coins.find((c) => !c.visible);
      if (!c) break;
      c.setPosition(p.x + (i - 1) * 18, p.y - 120)
        .setAlpha(1)
        .setVisible(true);
      this.tweens.add({
        targets: c,
        y: c.y - 70,
        alpha: 0,
        duration: 700,
        delay: i * 70,
        onComplete: () => c.setVisible(false),
      });
    }
  }
  decor(key: string, x: number, y: number, scale: number) {
    const p = iso(x, y),
      m = metadata(key);
    this.add
      .image(p.x, p.y, key)
      .setOrigin(m.anchorX, m.anchorY)
      .setScale(scale * m.scale)
      .setDepth(x + y);
  }
  panByScreen(x: number, y: number) {
    if (!this.ready || this.disposed) return;
    const c = this.cameras.main;
    c.setScroll(c.clampX(c.scrollX + x / c.zoom), c.clampY(c.scrollY + y / c.zoom));
  }
  zoom(factor: number) {
    if (!this.ready || this.disposed) return;
    this.cameras.main.setZoom(
      Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.5, 2),
    );
  }
  recenter() {
    if (this.disposed || !this.cameras?.main) return;
    const c = this.cameras.main,
      w = this.scale.width,
      h = this.scale.height;
    c.setZoom(Math.max(0.5, Math.min(1.25, (w - 100) / 850, (h - 240) / 580)));
    c.centerOn(0, 365);
  }
  snapshot() {
    const c = this.cameras?.main;
    if (this.disposed || !this.ready || !c) return { ready: false };
    return {
      ready: true,
      zoom: c.zoom,
      scrollX: c.scrollX,
      scrollY: c.scrollY,
      walkers: this.walkers.length,
      reducedMotion: this.reduced.matches,
      customers: this.customers.map((c) => ({
        ...c,
        route: c.route.map((p) => ({ ...p })),
      })),
    };
  }
  update(time: number, delta: number) {
    if (!this.ready) return;
    const owned = this.plots
      .filter((p) => useGame.getState().data.restaurants[p.id].owned)
      .map((p) => p.id);
    this.walkers.forEach((walker, i) => {
      const customer = this.customers[i],
        oldX = customer.x;
      if (!this.reduced.matches) advanceCustomer(customer, delta / 1000, owned, this.entrance);
      walker
        .setPosition(customer.x, customer.y)
        .setDepth(depthAt(customer.y))
        .setVisible(customer.phase !== 'dine');
      const moving = !this.reduced.matches && customer.route.length > 0;
      if (customer.x !== oldX) walker.setScale(customer.x < oldX ? -1 : 1, 1);
      this.walkerLegs.get(walker)?.forEach((leg, n) => {
        leg.y = -5 + (moving ? Math.sin(time / 110 + i + (n + 1) * Math.PI) * 2 : 0);
      });
    });
    const c = this.cameras.main,
      key = [c.scrollX, c.scrollY, c.zoom, c.width, c.height].join(':');
    if (key === this.projection) return;
    this.projection = key;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const p of this.plots) {
      const w = iso(p.x, p.y);
      positions[p.id] = {
        x: (w.x - c.scrollX - c.width / 2) * c.zoom + c.width / 2,
        y: (w.y - c.scrollY - c.height / 2) * c.zoom + c.height / 2,
      };
    }
    this.hooks.project(positions);
  }
}
