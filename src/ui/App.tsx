import {useEffect,useState,useCallback} from 'react';
import {useGame} from '../state/store';
import {startClock,claimOffline} from '../state/tick';
import {format} from '../utils/format';
import {TopBar} from './TopBar';
import {RestaurantPanel} from './RestaurantPanel';
import {StreetTab} from './tabs/StreetTab';
import {KitchenTab} from './tabs/KitchenTab';
import {UpgradesTab} from './tabs/UpgradesTab';
import {RankingsTab} from './tabs/RankingsTab';
import {Settings} from './Settings';
import {Modal} from './components/Modal';
import {Button} from './components/Button';
export function App(){const {tab,select,pending,storageError}=useGame();const [settings,setSettings]=useState(false);const close=useCallback(()=>setSettings(false),[]);useEffect(()=>startClock(),[]);useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'){select(null);setSettings(false);}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[select]);return <><TopBar settings={()=>setSettings(true)}/><main>{tab==='Street'?<StreetTab/>:tab==='Kitchen'?<KitchenTab/>:tab==='Upgrades'?<UpgradesTab/>:<RankingsTab/>}</main><RestaurantPanel/>{storageError&&<div className="storage-warning" role="status">Saving unavailable · Export a backup in Settings</div>}{settings&&<Settings close={close}/>} {pending>0&&!settings&&<Modal title="Welcome back, neighbor!"><span className="welcome-emoji">🌤️</span><p>Your managers kept the kitchens cozy. They earned 50% income while you were away, for up to 8 hours.</p><div className="offline-award">🪙 {format(pending)}</div><Button className="w-full" onClick={claimOffline}>Collect earnings</Button></Modal>}</>;}
