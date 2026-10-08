import {useGame} from '../../state/store';
import {upgrades} from '../../data/upgrades';
import {format} from '../../utils/format';
import {Card} from '../components/Card';
import {Button} from '../components/Button';
export function UpgradesTab(){const {data,act,now}=useGame();return <div className="page"><span className="eyebrow">SMALL CHANGES, BIG POSSIBILITIES</span><h1>A little extra magic</h1><p>Give every restaurant on your street a helping hand.</p><div className="card-grid">{upgrades.map(u=><Card key={u.id}><span className="big-emoji">{u.emoji}</span><h2>{u.name}</h2><p>{u.description}</p><Button disabled={data.upgrades.includes(u.id)||data.coins<u.cost} onClick={()=>act('global',u.id)}>{data.upgrades.includes(u.id)?'✓ Purchased':`Buy upgrade · 🪙 ${format(u.cost)}`}</Button></Card>)}<Card className="boost-card"><span className="big-emoji">⚡</span><h2>A delicious rush hour</h2><p>Double all income for 10 minutes. Earn 5 gems at restaurant levels 10, 25, 50 and 100.</p><Button disabled={data.gems<10||data.boostUntil>now} onClick={()=>act('boost','')}>{data.boostUntil>now?'⚡ Boost active':'Start rush hour · 💎 10'}</Button></Card></div></div>;}
