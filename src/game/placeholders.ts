import Phaser from 'phaser';
export function placeholders(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const make = (key: string, w: number, h: number, draw: () => void) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };
  const poly = (pts: number[], c: number) => {
    g.fillStyle(c);
    g.fillPoints(
      pts.reduce<Phaser.Geom.Point[]>(
        (a, _, i) =>
          i % 2 ? a : [...a, new Phaser.Geom.Point(pts[i], pts[i + 1])],
        [],
      ),
      true,
    );
  };
  for (const [key, color] of Object.entries({
    grass: 0xb7dca0,
    road: 0xbfc6c8,
    sidewalk: 0xf6e7cf,
    water: 0x7bcbd3,
  }))
    make(key, 128, 64, () => {
      poly([64, 0, 128, 32, 64, 64, 0, 32], color);
      g.lineStyle(1, 0xffffff, 0.15);
      g.strokePoints(
        [
          new Phaser.Geom.Point(64, 0),
          new Phaser.Geom.Point(128, 32),
          new Phaser.Geom.Point(64, 64),
          new Phaser.Geom.Point(0, 32),
        ],
        true,
      );
    });
  const colors = [0xe87350, 0x65a8aa, 0xeebc55, 0x76ac72, 0xd66b74, 0x8f87bd];
  [
    'noodle_nook',
    'coffee_corner',
    'sunny_bakery',
    'taco_tuesday',
    'tomato_basil',
    'sushi_station',
  ].forEach((id, i) =>
    make('building_' + id, 200, 230, () => {
      const cream = 0xffefd0,
        wood = 0x795744,
        glass = 0x79b5b6;
      g.fillStyle(0x54684d, 0.18);
      g.fillEllipse(104, 207, 180, 34);
      poly([12, 105, 100, 149, 100, 222, 12, 178], 0xc99874);
      poly([100, 149, 188, 105, 188, 178, 100, 222], 0xf1d7a7);
      // Masonry plinth and roof fascia follow the 2:1 wall planes.
      poly([12, 170, 100, 214, 100, 222, 12, 178], wood);
      poly([100, 214, 188, 170, 188, 178, 100, 222], 0xb18a64);
      poly([8, 99, 100, 145, 192, 99, 192, 110, 100, 156, 8, 110], wood);
      poly([8, 99, 100, 53, 192, 99, 100, 145], colors[i]);
      poly([23, 97, 100, 59, 177, 97, 100, 135], colors[i]);
      g.lineStyle(2, cream, 0.3);
      for (let r = 0; r < 5; r++) {
        g.lineBetween(25 + r * 15, 91 - r * 7.5, 102 + r * 15, 129 - r * 7.5);
      }
      // Glazed display windows, inset frames and warm interior shelves.
      poly([113, 160, 176, 128, 176, 169, 113, 201], wood);
      poly([117, 162, 172, 134, 172, 166, 117, 194], glass);
      poly([120, 165, 131, 159, 153, 162, 141, 168], 0xcbe6d5);
      g.lineStyle(3, cream);
      g.lineBetween(144, 148, 144, 181);
      g.lineBetween(117, 183, 172, 155);
      for (let n = 0; n < 4; n++) {
        const x = 123 + n * 13,
          y = 182 - n * 6.5;
        g.fillStyle(i === 2 ? 0xe6a64d : 0xf3d99b);
        g.fillEllipse(x, y, i === 2 ? 12 : 7, i === 2 ? 8 : 5);
        g.lineStyle(1, cream);
        g.lineBetween(x - 2, y - 3, x, y);
      }
      // Upper row front door; lower row side porch opens at the left corner.
      const dx = i < 3 ? 78 : 16,
        dy = i < 3 ? 211 : 180;
      poly(
        [dx - 8, dy - 43, dx + 8, dy - 35, dx + 8, dy + 4, dx - 8, dy - 4],
        wood,
      );
      poly(
        [dx - 5, dy - 38, dx + 5, dy - 33, dx + 5, dy - 12, dx - 5, dy - 17],
        glass,
      );
      g.fillStyle(cream);
      g.fillCircle(dx + 4, dy - 9, 2);
      poly(
        [dx - 12, dy - 4, dx + 12, dy + 8, dx + 4, dy + 12, dx - 20, dy],
        0xe4c9a1,
      );
      // Striped canopy with a scalloped edge.
      for (let n = 0; n < 6; n++) {
        const x = 106 + n * 14,
          y = 151 - n * 7;
        poly(
          [x, y, x + 14, y - 7, x + 19, y + 4, x + 5, y + 11],
          n % 2 ? cream : colors[i],
        );
        g.fillStyle(n % 2 ? cream : colors[i]);
        g.fillCircle(x + 11, y + 7, 6);
      }
      // Cuisine badges are drawn shapes, never font/emoji glyphs.
      g.fillStyle(wood);
      g.fillRoundedRect(26, 109, 39, 39, 7);
      g.fillStyle(cream);
      g.fillRoundedRect(29, 112, 33, 33, 5);
      const cx = 45,
        cy = 130;
      g.fillStyle(colors[i]);
      if (i === 0) {
        g.fillEllipse(cx, cy + 3, 25, 16);
        g.fillStyle(cream);
        g.fillEllipse(cx, cy - 1, 25, 7);
        g.lineStyle(2, wood);
        g.lineBetween(34, 126, 56, 122);
        g.lineStyle(2, 0xc99874);
        g.lineBetween(40, 120, 42, 115);
        g.lineBetween(48, 119, 50, 114);
      } else if (i === 1) {
        g.lineStyle(3, colors[i]);
        g.strokeCircle(55, 129, 5);
        g.fillRoundedRect(35, 120, 17, 19, 4);
        g.fillStyle(wood);
        g.fillEllipse(43, 121, 15, 4);
        g.lineStyle(2, colors[i]);
        g.lineBetween(33, 141, 56, 141);
      } else if (i === 2) {
        g.fillStyle(0xd99947);
        g.fillEllipse(cx, cy, 27, 17);
        g.lineStyle(2, cream);
        for (let n = 0; n < 3; n++)
          g.lineBetween(37 + n * 7, 125, 40 + n * 7, 132);
      } else if (i === 3) {
        g.fillStyle(0x65965b);
        g.fillEllipse(cx, cy - 1, 28, 14);
        g.fillStyle(0xeebc55);
        g.fillEllipse(cx, cy + 4, 29, 15);
        g.fillStyle(0xd66b54);
        for (let n = 0; n < 3; n++) g.fillCircle(37 + n * 8, 127, 3);
      } else if (i === 4) {
        g.fillStyle(0xd75f4b);
        g.fillCircle(cx, cy + 2, 11);
        poly([45, 124, 35, 118, 44, 120, 49, 115, 49, 122, 56, 124], 0x64915a);
      } else {
        g.fillStyle(0x456e63);
        g.fillRoundedRect(33, 123, 25, 16, 5);
        g.fillStyle(cream);
        g.fillEllipse(cx, 125, 23, 12);
        g.fillStyle(0xe78870);
        g.fillEllipse(cx, 125, 12, 6);
        g.lineStyle(2, wood);
        g.lineBetween(34, 118, 57, 114);
      }
      if (i === 5) {
        g.fillStyle(0x795744);
        g.fillRect(104, 153, 5, 55);
        g.fillRect(179, 117, 5, 55);
        for (let n = 0; n < 3; n++)
          poly(
            [
              116 + n * 20,
              157 - n * 10,
              133 + n * 20,
              148 - n * 10,
              133 + n * 20,
              164 - n * 10,
              116 + n * 20,
              173 - n * 10,
            ],
            0x8f87bd,
          );
      }
      // Small architectural silhouettes make the cuisine readable at map scale.
      if (i === 0 || i === 2) {
        const x = i === 0 ? 128 : 70;
        poly([x, 73, x + 14, 80, x + 14, 51, x, 44], 0xb98468);
        poly([x + 14, 80, x + 25, 74, x + 25, 45, x + 14, 51], cream);
        poly([x - 2, 44, x + 11, 37, x + 27, 45, x + 14, 52], wood);
        if (i === 0) {
          g.lineStyle(3, cream, 0.85);
          g.lineBetween(x + 9, 31, x + 13, 24);
          g.lineBetween(x + 13, 24, x + 10, 16);
          g.lineBetween(x + 21, 35, x + 24, 27);
        }
      }
      if (i === 1) {
        // Cafe rooflight and broad coffeehouse window.
        poly([67, 91, 100, 74, 130, 89, 97, 106], wood);
        poly([72, 91, 100, 77, 124, 89, 97, 102], glass);
        g.lineStyle(2, cream);
        g.lineBetween(86, 84, 111, 96);
        poly([24, 151, 58, 168, 58, 189, 24, 172], wood);
        poly([27, 154, 55, 168, 55, 184, 27, 170], glass);
      }
      if (i === 2) {
        // Oven-brick wall and an extra rack of golden loaves.
        g.lineStyle(1, 0xa77a59, 0.6);
        for (let n = 0; n < 3; n++)
          g.lineBetween(26, 155 + n * 9, 61, 172 + n * 9);
        g.fillStyle(0xeebc55);
        g.fillEllipse(137, 165, 16, 9);
        g.fillStyle(cream);
        g.fillEllipse(153, 158, 12, 7);
      }
      if (i === 3) {
        // Open service counter and pennants distinguish the taco stand.
        poly([32, 151, 88, 179, 88, 205, 32, 177], 0x526e60);
        poly([29, 176, 88, 205, 96, 201, 37, 172], 0xeebc55);
        g.lineStyle(2, cream);
        g.lineBetween(29, 150, 90, 180);
        for (let n = 0; n < 4; n++)
          poly(
            [
              32 + n * 14,
              152 + n * 7,
              43 + n * 14,
              157 + n * 7,
              37 + n * 14,
              166 + n * 7,
            ],
            n % 2 ? 0xe87350 : 0xeebc55,
          );
      }
      if (i === 4) {
        // Italian shutters and a climbing herb trellis.
        poly([38, 151, 66, 165, 66, 194, 38, 180], wood);
        poly([42, 156, 62, 166, 62, 187, 42, 177], glass);
        poly([29, 147, 37, 151, 37, 180, 29, 176], 0x64915a);
        poly([67, 166, 75, 170, 75, 199, 67, 195], 0x64915a);
        g.lineStyle(2, 0x64915a);
        g.lineBetween(88, 167, 88, 210);
        g.fillStyle(0x78a66a);
        for (let n = 0; n < 5; n++)
          g.fillEllipse(86 + (n % 2) * 6, 172 + n * 8, 10, 5);
      }
      if (i === 5) {
        // Dark tiled eaves, raised tips and timber lattice frontage.
        poly([8, 92, 100, 138, 192, 92, 192, 102, 100, 148, 8, 102], 0x52556b);
        poly([8, 92, 8, 84, 27, 101], 0x52556b);
        poly([192, 92, 192, 84, 173, 101], 0x52556b);
        g.lineStyle(3, wood);
        for (let n = 0; n < 4; n++)
          g.lineBetween(34 + n * 13, 153 + n * 6.5, 34 + n * 13, 184 + n * 6.5);
      }
      for (const [x, y] of [
        [106, 214],
        [181, 176],
      ]) {
        g.fillStyle(0xb87958);
        g.fillRoundedRect(x - 7, y - 12, 14, 14, 3);
        g.fillStyle(0x679b61);
        g.fillCircle(x, y - 15, 9);
        g.fillStyle(0x93bd73);
        g.fillCircle(x - 4, y - 19, 5);
      }
    }),
  );
  make('tree', 100, 150, () => {
    g.fillStyle(0x98724e);
    g.fillRect(45, 80, 12, 64);
    [
      [30, 62],
      [69, 64],
      [48, 33],
      [49, 82],
    ].forEach(([x, y], i) => {
      g.fillStyle([0x6cad65, 0x80bc6e, 0x97cc7b, 0x78b76b][i]);
      g.fillCircle(x, y, 29);
    });
  });
  make('lamp', 36, 110, () => {
    g.fillStyle(0x647b72);
    g.fillRect(16, 23, 5, 85);
    g.fillStyle(0xffe7a2);
    g.fillRoundedRect(7, 5, 24, 27, 5);
  });
  make('bench', 70, 45, () => {
    g.fillStyle(0x916e54);
    g.fillRoundedRect(3, 5, 64, 13, 3);
    g.fillRoundedRect(3, 22, 64, 11, 3);
    g.fillRect(10, 32, 5, 12);
    g.fillRect(55, 32, 5, 12);
  });
  make('walker', 24, 42, () => {
    g.fillStyle(0xe78870);
    g.fillRoundedRect(4, 16, 16, 22, 7);
    g.fillStyle(0xffd6ac);
    g.fillCircle(12, 9, 8);
  });
  make('coin', 22, 22, () => {
    g.fillStyle(0xf5b301);
    g.fillCircle(11, 11, 10);
    g.lineStyle(2, 0xffe6a1);
    g.strokeCircle(11, 11, 6);
  });
  g.destroy();
}
