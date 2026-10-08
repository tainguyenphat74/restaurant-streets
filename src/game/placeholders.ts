import Phaser from 'phaser';
export function placeholders(scene:Phaser.Scene){
 const g=scene.make.graphics({x:0,y:0});
 const make=(key:string,w:number,h:number,draw:()=>void)=>{if(scene.textures.exists(key))return;g.clear();draw();g.generateTexture(key,w,h);};
 const poly=(pts:number[],c:number)=>{g.fillStyle(c);g.fillPoints(pts.reduce<Phaser.Geom.Point[]>((a,_,i)=>i%2?a:[...a,new Phaser.Geom.Point(pts[i],pts[i+1])],[]),true);};
 for(const [key,color] of Object.entries({grass:0xb7dca0,road:0xe9d5b5,sidewalk:0xf6e7cf,water:0x7bcbd3}))make(key,128,64,()=>{poly([64,0,128,32,64,64,0,32],color);g.lineStyle(1,0xffffff,.15);g.strokePoints([new Phaser.Geom.Point(64,0),new Phaser.Geom.Point(128,32),new Phaser.Geom.Point(64,64),new Phaser.Geom.Point(0,32)],true);});
 const colors=[0xe87350,0x65a8aa,0xeebc55,0x76ac72,0xd66b74,0x8f87bd];
 ['noodle_nook','coffee_corner','sunny_bakery','taco_tuesday','tomato_basil','sushi_station'].forEach((id,i)=>make('building_'+id,200,230,()=>{poly([12,105,100,150,100,222,12,178],0xc99874);poly([100,150,188,105,188,178,100,222],0xf1d7a7);poly([8,102,100,55,192,102,100,150],colors[i]);poly([8,92,100,45,192,92,100,140],colors[i]);g.fillStyle(0xffefc8);g.fillRoundedRect(35,125,29,35,3);g.fillStyle(0x65878b);g.fillRoundedRect(129,142,26,48,3);for(let j=0;j<5;j++){g.fillStyle(j%2?0xfff7df:colors[i]);g.fillRect(111+j*13,130-j*6,13,15);}g.fillStyle(0xfff2ce);g.fillCircle(163,151,10);g.fillStyle(0x785844);g.fillRect(77,161,17,43);}));
 make('tree',100,150,()=>{g.fillStyle(0x98724e);g.fillRect(45,80,12,64);[ [30,62],[69,64],[48,33],[49,82]].forEach(([x,y],i)=>{g.fillStyle([0x6cad65,0x80bc6e,0x97cc7b,0x78b76b][i]);g.fillCircle(x,y,29);});});
 make('lamp',36,110,()=>{g.fillStyle(0x647b72);g.fillRect(16,23,5,85);g.fillStyle(0xffe7a2);g.fillRoundedRect(7,5,24,27,5);});
 make('bench',70,45,()=>{g.fillStyle(0x916e54);g.fillRoundedRect(3,5,64,13,3);g.fillRoundedRect(3,22,64,11,3);g.fillRect(10,32,5,12);g.fillRect(55,32,5,12);});
 make('walker',24,42,()=>{g.fillStyle(0xe78870);g.fillRoundedRect(4,16,16,22,7);g.fillStyle(0xffd6ac);g.fillCircle(12,9,8);});
 make('coin',22,22,()=>{g.fillStyle(0xf5b301);g.fillCircle(11,11,10);g.lineStyle(2,0xffe6a1);g.strokeCircle(11,11,6);});g.destroy();
}
