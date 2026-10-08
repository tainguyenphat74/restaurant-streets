import Phaser from 'phaser';
export type Presentation = {file:string;anchorX:number;anchorY:number;scale:number};
export const presentation:Record<string,Presentation> = {};
export const previews:Record<string,string> = {};
export async function loadAssets(scene:Phaser.Scene) {
 try { const res=await fetch('/assets/manifest.json'); const raw=await res.json(); for(const [key,value] of Object.entries(raw)){const v=value as Presentation;if(v && typeof v.file==='string' && [v.anchorX,v.anchorY,v.scale].every(Number.isFinite)&&v.scale>0){presentation[key]=v;scene.load.image(key,'/assets/'+v.file);}} } catch { /* procedural fallback */ }
 await new Promise<void>(resolve=>{if(!scene.load.list.size){resolve();return;}scene.load.once('complete',resolve);scene.load.start();});
}
export function metadata(key:string){return presentation[key]??{file:'',anchorX:.5,anchorY:1,scale:1};}
