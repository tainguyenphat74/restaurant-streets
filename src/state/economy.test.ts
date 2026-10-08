import {describe,it,expect} from 'vitest';
import {fresh,upgradeCost,income,rating,offlineIncome,accrue,collect,levelUp,globalMultiplier} from './economy';
import {format} from '../utils/format';
describe('economy',()=>{
 it('uses precise costs',()=>{expect(upgradeCost('noodle_nook',1)).toBe(11.5);expect(upgradeCost('coffee_corner',2)).toBeCloseTo(132.25);});
 it('applies every milestone and rating',()=>{for(const [level,mult]of [[1,1],[10,2],[25,4],[50,8],[100,16]]){const g=fresh();g.restaurants.noodle_nook.level=level;expect(income(g,'noodle_nook',0)).toBe(level*mult*rating(level)/4);}});
 it('multiplies global upgrades and boost',()=>{const g=fresh();g.upgrades=['ingredients','service'];g.boostUntil=100;expect(globalMultiplier(g)).toBe(3);expect(income(g,'noodle_nook',0)).toBeCloseTo(.8875*6);});
 it('only pays managers, caps eight hours, integrates partial boosts',()=>{const g=fresh();expect(offlineIncome(g,0,1000)).toBe(0);g.restaurants.noodle_nook.hasManager=true;g.boostUntil=1000;expect(offlineIncome(g,0,2000)).toBeCloseTo(.8875*1.5);expect(offlineIncome(g,2000,2000+9*3600000)).toBeCloseTo(.8875*8*3600*.5);});
 it('caps registers and collects manually or automatically',()=>{let g=accrue(fresh(),0,100000).data;expect(g.restaurants.noodle_nook.register).toBeCloseTo(.8875*60);g=collect(g,'noodle_nook');expect(g.coins).toBeCloseTo(.8875*60);expect(g.restaurants.noodle_nook.register).toBe(0);g.restaurants.noodle_nook.hasManager=true;expect(accrue(g,0,1000).data.coins).toBeCloseTo(g.coins+.8875);});
 it('awards each milestone once',()=>{let g=fresh();g.coins=1e9;g.restaurants.noodle_nook.level=9;g=levelUp(g,'noodle_nook');expect(g.gems).toBe(5);g=levelUp(g,'noodle_nook');expect(g.gems).toBe(5);});
 it('formats numbers',()=>{expect([1200,1200000,1200000000].map(format)).toEqual(['1.2K','1.2M','1.2B']);});
});
