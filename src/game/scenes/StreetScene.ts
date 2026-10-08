import Phaser from 'phaser';
import {iso,plots} from '../iso';
import {loadAssets,metadata,previews} from '../assets';
import {placeholders} from '../placeholders';
export type MapHooks={select:(id:string)=>void;project:(positions:Record<string,{x:number;y:number}>)=>void;owned:(id:string)=>boolean};
export class StreetScene extends Phaser.Scene {
 hooks:MapHooks; buildings=new Map<string,Phaser.GameObjects.Image>(); private down={x:0,y:0,cx:0,cy:0};private dragged=false;private ready=false; private pinch=0;
 constructor(hooks:MapHooks){super('street');this.hooks=hooks;}
 async create(){await loadAssets(this);if(!this.sys.isActive())return;placeholders(this); const camera=this.cameras.main;camera.setBounds(-1300,-400,2600,1900);this.recenter();
 for(let x=0;x<16;x++)for(let y=0;y<16;y++){const p=iso(x,y);this.add.image(p.x,p.y,x>13?'water':y===7||y===8?'road':y===6||y===9?'sidewalk':'grass').setDepth(x+y-50);}
 for(let i=0;i<15;i++){const p=iso(13.5,i);this.add.rectangle(p.x,p.y-12,4,30,0x76978a).setDepth(35);if(i<14){const q=iso(13.5,i+1);this.add.line(0,0,p.x,p.y-22,q.x,q.y-22,0x76978a).setOrigin(0).setDepth(35);}}
 for(let i=0;i<26;i++){const x=(i*7%13)+.2,y=i%2?1:13;this.decor('tree',x,y,.7+(i%3)*.1);}for(let i=2;i<13;i+=3){this.decor('lamp',i,6,.65);this.decor('bench',i,9,.7);}
 for(const plot of plots){const p=iso(plot.x,plot.y),key='building_'+plot.id,m=metadata(key);const b=this.add.image(p.x,p.y,key).setOrigin(m.anchorX,m.anchorY).setScale(m.scale).setDepth(plot.x+plot.y).setInteractive({useHandCursor:true});b.on('pointerup',()=>{if(!this.dragged){this.hooks.select(plot.id);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)this.tweens.add({targets:b,y:p.y-10,duration:130,yoyo:true});}});this.buildings.set(plot.id,b);previews[plot.id]=this.textures.getBase64(key);}
 for(let i=0;i<14;i++){const p=iso(i%12+2,i%2?6:9);const w=this.add.image(p.x,p.y,'walker').setOrigin(.5,1).setDepth(40).setTint([0xffffff,0xa4c8df,0xc4b1d9,0xffd482][i%4]);const q=iso(i%2?2:12,i%2?6:9);this.tweens.add({targets:w,x:q.x,y:q.y,duration:15000+i*730,yoyo:true,repeat:-1});}
 this.input.addPointer(1);this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{this.down={x:p.x,y:p.y,cx:camera.scrollX,cy:camera.scrollY};this.dragged=false;});this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(!p.isDown)return;const a=this.input.pointer1,b=this.input.pointer2;if(a.isDown&&b.isDown){const d=Phaser.Math.Distance.Between(a.x,a.y,b.x,b.y);if(this.pinch)this.zoom(d/this.pinch);this.pinch=d;this.dragged=true;return;}this.pinch=0;if(Math.hypot(p.x-this.down.x,p.y-this.down.y)>7)this.dragged=true;if(this.dragged){camera.scrollX=this.down.cx-(p.x-this.down.x)/camera.zoom;camera.scrollY=this.down.cy-(p.y-this.down.y)/camera.zoom;}});this.input.on('pointerup',()=>{this.pinch=0;});this.input.on('wheel',(_p:unknown,_o:unknown,_x:number,dy:number)=>this.zoom(dy>0?.92:1.08));this.scale.on('resize',this.recenter,this);this.events.once('shutdown',()=>{this.scale.off('resize',this.recenter,this);this.input.removeAllListeners();});this.ready=true;this.refresh(); }
 decor(key:string,x:number,y:number,scale:number){const p=iso(x,y),m=metadata(key);this.add.image(p.x,p.y,key).setOrigin(m.anchorX,m.anchorY).setScale(scale*m.scale).setDepth(x+y);}
 refresh(){for(const [id,b]of this.buildings)b.setAlpha(this.hooks.owned(id)?1:.42);}
 zoom(factor:number){this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom*factor,.5,2));}
 recenter(){const c=this.cameras.main;c.setZoom(Math.max(.5,Math.min(.85,this.scale.width/1450)));c.centerOn(0,460);}
 update(){if(!this.ready)return;const c=this.cameras.main;const positions:Record<string,{x:number;y:number}>={};for(const p of plots){const w=iso(p.x,p.y);positions[p.id]={x:(w.x-c.scrollX)*c.zoom,y:(w.y-c.scrollY)*c.zoom};}this.hooks.project(positions);}
}
