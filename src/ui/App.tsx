import {useEffect,useState} from 'react';
import {useGame} from '../state/store';
import {TopBar} from './TopBar';
import {RestaurantPanel} from './RestaurantPanel';
import {StreetTab} from './tabs/StreetTab';
import {KitchenTab} from './tabs/KitchenTab';
import {UpgradesTab} from './tabs/UpgradesTab';
import {RankingsTab} from './tabs/RankingsTab';
export function App(){const {tab,select}=useGame();const [settings,setSettings]=useState(false);useEffect(()=>{let last=Date.now();const timer=setInterval(()=>{const now=Date.now();useGame.getState().tick(last,now);last=now;},100);return()=>clearInterval(timer);},[]);useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'){select(null);setSettings(false);}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[select]);return <><TopBar settings={()=>setSettings(true)}/><main>{tab==='Street'?<StreetTab/>:tab==='Kitchen'?<KitchenTab/>:tab==='Upgrades'?<UpgradesTab/>:<RankingsTab/>}</main><RestaurantPanel/>{settings&&<div className="modal-backdrop"><div className="card" role="dialog" aria-modal="true" aria-label="Settings"><h2>Your neighborhood</h2><p>Your progress lives in this browser.</p><button onClick={()=>setSettings(false)}>Close</button></div></div>}</>;}
