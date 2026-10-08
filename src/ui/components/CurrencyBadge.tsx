import {format} from '../../utils/format';
export function CurrencyBadge({icon,value,label}:{icon:string;value:number;label:string}){return <span className="currency" aria-label={`${label}: ${format(value)}`}><span>{icon}</span><b>{format(value)}</b></span>;}
