import Phaser from 'phaser';
export type Presentation = {
  file: string;
  anchorX: number;
  anchorY: number;
  scale: number;
};
export const presentation: Record<string, Presentation> = {};
export const previews: Record<string, string> = {};
export async function loadAssets(scene: Phaser.Scene) {
  const abort = new AbortController();
  let stopped = false;
  const stop = () => {
    stopped = true;
    abort.abort();
  };
  scene.events.once('shutdown', stop);
  scene.events.once('destroy', stop);
  try {
    const res = await fetch('/assets/manifest.json', { signal: abort.signal });
    const raw: unknown = await res.json();
    if (
      stopped ||
      !scene.sys?.isActive() ||
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    )
      return;
    for (const [key, value] of Object.entries(raw)) {
      const v = value as Presentation;
      if (
        v &&
        typeof v.file === 'string' &&
        [v.anchorX, v.anchorY, v.scale].every(Number.isFinite) &&
        v.scale > 0
      ) {
        presentation[key] = v;
        scene.load.image(key, '/assets/' + v.file);
      }
    }
    if (!scene.load.list.size) return;
    await new Promise<void>((resolve) => {
      const failed = (file: Phaser.Loader.File) => {
        delete presentation[file.key];
      };
      const done = () => {
        scene.events.off('shutdown', done);
        scene.events.off('destroy', done);
        scene.load?.off('complete', done);
        scene.load?.off('loaderror', failed);
        resolve();
      };
      scene.events.once('shutdown', done);
      scene.events.once('destroy', done);
      scene.load.once('complete', done);
      scene.load.on('loaderror', failed);
      scene.load.start();
    });
  } catch {
    /* Missing or unavailable artwork uses procedural textures. */
  } finally {
    scene.events?.off('shutdown', stop);
    scene.events?.off('destroy', stop);
  }
}
export function metadata(key: string) {
  return presentation[key] ?? { file: '', anchorX: 0.5, anchorY: 1, scale: 1 };
}
