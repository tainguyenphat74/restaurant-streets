import Phaser from 'phaser';
import {StreetScene,type MapHooks} from './scenes/StreetScene';
export function createGame(parent:HTMLElement,hooks:MapHooks){const scene=new StreetScene(hooks);const game=new Phaser.Game({type:Phaser.AUTO,parent,backgroundColor:'#cee5b7',scale:{mode:Phaser.Scale.RESIZE,width:parent.clientWidth,height:parent.clientHeight},scene:[scene],render:{antialias:true},input:{activePointers:3}});return {game,scene};}
