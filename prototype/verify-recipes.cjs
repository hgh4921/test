// Run: node verify-recipes.cjs (no dependencies required).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, 'weekly.html'), 'utf8');
const elements = {};
const document = {
 querySelector(selector) { return elements[selector] ??= {value:'', innerHTML:'', textContent:'', addEventListener(){}}; },
 querySelectorAll(){return [];}, addEventListener(){}
};
// A deterministic stream makes failures reproducible across local and CI runs.
let seed = 4921;
const testMath = Object.create(Math);
testMath.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
const data = vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
const testPlans=Array.from({length:1000},()=>suggestPlan());
const replacedPlans=[];
for(const original of testPlans.slice(0,200)){
 const changed=[...original];
 for(let day=0;day<7;day++){
  const replacement=replacementForDay(changed,day);
  if(replacement!==undefined){changed[day]=replacement;replacedPlans.push([...changed]);}
 }
}
// These checks use concrete names to guard the requested grouping behavior.
if(soupFamily({name:'배추된장국'})!==soupFamily({name:'두부된장찌개'}))throw Error('Doenjang group');
if(soupFamily({name:'콩나물국'})!==soupFamily({name:'황태콩나물국'}))throw Error('Sprout group');
const monday=dinners.findIndex(d=>d.dishes.some(id=>meals[id].name==='애호박된장국'));
const otherDoenjang=dinners.findIndex((d,index)=>d.dishes.some(id=>meals[id].name==='배추된장국')&&dinnerParts[index].main!==dinnerParts[monday].main);
if(monday<0||otherDoenjang<0)throw Error('Missing example dinners');
if(isDinnerCompatible(otherDoenjang,2,[monday]))throw Error('Monday to Wednesday must be blocked');
if(!isDinnerCompatible(otherDoenjang,3,[monday]))throw Error('Monday to Thursday must be allowed');
if(!isDinnerCompatible(otherDoenjang,4,[monday]))throw Error('Monday to Friday must be allowed');
if(isDinnerCompatible(monday,6,[monday]))throw Error('Same soup must not recur within week');
if(isDinnerCompatible(otherDoenjang,0,[null,null,monday]))throw Error('Replacement must check following days');
JSON.stringify({meals,dinners,photos:meals.map((m,i)=>photo(i)),plans:testPlans,replacedPlans,families:meals.map(m=>m.type==='국/찌개'?soupFamily(m):null)})`, {document, Date, Intl, Map, Set, Math:testMath});
const { meals, dinners, photos, plans, replacedPlans, families } = JSON.parse(data);
assert.equal(meals.length, 149);
assert.equal(new Set(meals.map(m=>m.name)).size, 149);
for (const recipe of meals) {
 assert(recipe.time > 0 && recipe.tip && recipe.steps.length >= 3 && recipe.items.length >= 3, recipe.name);
 const ingredients = new Set();
 for (const ingredient of recipe.items) {
  assert(!ingredients.has(ingredient.name), `Duplicate ingredient in ${recipe.name}`);
  ingredients.add(ingredient.name);
  assert.equal(ingredient.amount.length, 2);
  assert(ingredient.amount.every(n=>Number.isFinite(n) && n>0), recipe.name);
  assert(ingredient.unit && ingredient.name);
 }
}
for (const dinner of dinners) {
 assert(dinner.dishes.every(id=>meals[id]));
 if (dinner.kind==='한 그릇') {assert.equal(dinner.dishes.length,1);assert.equal(meals[dinner.dishes[0]].type,'한 그릇');}
 else for (const type of ['국/찌개','메인메뉴','밑반찬']) assert(dinner.dishes.some(id=>meals[id].type===type));
}
for (const plan of [...plans,...replacedPlans]) {
 assert.equal(plan.length,7); assert.equal(new Set(plan).size,7);
 const mainRecipes = plan.map(id=>dinners[id].dishes.find(i=>['한 그릇','메인메뉴'].includes(meals[i].type)));
 assert.equal(new Set(mainRecipes).size,7);
 const soups = plan.map(id=>dinners[id].dishes.find(i=>meals[i].type==='국/찌개'));
 const soupIds = soups.filter(id=>id!==undefined);
 assert.equal(new Set(soupIds).size,soupIds.length,'Same soup repeats within a week');
 for(let day=0;day<soups.length;day++)for(let next=day+1;next<soups.length;next++){
  if(soups[day]===undefined||soups[next]===undefined)continue;
  if(families[soups[day]]===families[soups[next]])assert(next-day>=3,'Similar soups need a three-day gap');
 }
}
assert.equal(photos.length,149);
for (let id=0;id<photos.length;id++) assert(photos[id].includes(`data-recipe-photo="${id}"`));
const imagePaths=[...html.matchAll(/url\("(assets\/[^"]+\.png)"\)/g)].map(m=>m[1]);
assert.equal(new Set(imagePaths).size,13);
for (const imagePath of imagePaths) {
 const buffer = fs.readFileSync(path.join(__dirname,imagePath));
 assert.equal(buffer.subarray(1,4).toString(),'PNG');
 const width=buffer.readUInt32BE(16), height=buffer.readUInt32BE(20);
 assert(width>0 && height>0);
 // All new bulk atlases are a grid of three columns by four rows.
 if(imagePath.includes('batch-')) assert(Math.abs(width/height-3/4)<0.01, imagePath);
}
fs.writeFileSync(path.join(__dirname,'recipes.json'),JSON.stringify(meals,null,2)+'\n');
console.log(`PASS: 149 recipes; 1000 weekly plans; ${replacedPlans.length} day replacements; unique soups and mains; similar soups at least 3 days apart; portions and photos.`);
console.log('Categories:',Object.fromEntries(['국/찌개','메인메뉴','밑반찬','한 그릇'].map(type=>[type,meals.filter(m=>m.type===type).length])));
