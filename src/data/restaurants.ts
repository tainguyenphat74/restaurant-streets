export const restaurants = [
 {id:'noodle_nook',name:'Noodle Nook',emoji:'🍜',color:'#E87350',baseCost:0,baseIncome:1,tagline:'A little bowl of happiness.',dishes:[{name:'Miso ramen',emoji:'🍜'},{name:'Dumplings',emoji:'🥟'},{name:'Green tea',emoji:'🍵'}]},
 {id:'coffee_corner',name:'Coffee Corner',emoji:'☕',color:'#65A8AA',baseCost:100,baseIncome:5,tagline:'Good days start with a great cup.',dishes:[{name:'Flat white',emoji:'☕'},{name:'Croissant',emoji:'🥐'},{name:'Cold brew',emoji:'🧋'}]},
 {id:'sunny_bakery',name:'Sunny Bakery',emoji:'🥐',color:'#EEBC55',baseCost:1200,baseIncome:40,tagline:'Fresh from the oven, made with love.',dishes:[{name:'Sourdough',emoji:'🍞'},{name:'Berry tart',emoji:'🥧'},{name:'Cupcake',emoji:'🧁'}]},
 {id:'taco_tuesday',name:'Taco Tuesday',emoji:'🌮',color:'#76AC72',baseCost:15000,baseIncome:300,tagline:'Every day deserves a little fiesta.',dishes:[{name:'Street taco',emoji:'🌮'},{name:'Burrito',emoji:'🌯'},{name:'Guacamole',emoji:'🥑'}]},
 {id:'tomato_basil',name:'Tomato & Basil',emoji:'🍝',color:'#D66B74',baseCost:200000,baseIncome:2500,tagline:'From our family table to yours.',dishes:[{name:'Pasta fresca',emoji:'🍝'},{name:'Margherita',emoji:'🍕'},{name:'Garden salad',emoji:'🥗'}]},
 {id:'sushi_station',name:'Sushi Station',emoji:'🍣',color:'#8F87BD',baseCost:3000000,baseIncome:25000,tagline:'Small bites. Beautiful moments.',dishes:[{name:'Salmon nigiri',emoji:'🍣'},{name:'Onigiri',emoji:'🍙'},{name:'Tempura',emoji:'🍤'}]}
] as const;
export type RestaurantId=typeof restaurants[number]['id'];
export const config=(id:string)=>restaurants.find(r=>r.id===id)!;
