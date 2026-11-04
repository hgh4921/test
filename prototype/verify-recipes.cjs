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
const data = vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1] + `
JSON.stringify({meals,dinners,photos:meals.map((m,i)=>photo(i)),plans:Array.from({length:100},()=>suggestPlan()),types:meals.map(m=>m.type)})`, {document, Date, Intl, Map, Set});
const { meals, dinners, photos, plans } = JSON.parse(data);
assert.equal(meals.length, 125);
assert.equal(new Set(meals.map(m=>m.name)).size, 125);
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
for (const plan of plans) {
 assert.equal(plan.length,7); assert.equal(new Set(plan).size,7);
 const mainRecipes = plan.map(id=>dinners[id].dishes.find(i=>['한 그릇','메인메뉴'].includes(meals[i].type)));
 assert.equal(new Set(mainRecipes).size,7);
}
assert.equal(photos.length,125);
for (let id=0;id<photos.length;id++) assert(photos[id].includes(`data-recipe-photo="${id}"`));
const imagePaths=[...html.matchAll(/url\("(assets\/[^"]+\.png)"\)/g)].map(m=>m[1]);
assert.equal(new Set(imagePaths).size,11);
for (const imagePath of imagePaths) {
 const buffer = fs.readFileSync(path.join(__dirname,imagePath));
 assert.equal(buffer.subarray(1,4).toString(),'PNG');
 const width=buffer.readUInt32BE(16), height=buffer.readUInt32BE(20);
 assert(width>0 && height>0);
 // All new bulk atlases are a grid of three columns by four rows.
 if(imagePath.includes('batch-')) assert(Math.abs(width/height-3/4)<0.01, imagePath);
}
fs.writeFileSync(path.join(__dirname,'recipes.json'),JSON.stringify(meals,null,2)+'\n');
console.log('PASS: 125 unique recipes; 2/4-person ingredients; complete dinners; 100 weekly plans; 125 photo mappings; 11 existing image atlases.');
console.log('Categories:',Object.fromEntries(['국/찌개','메인메뉴','밑반찬','한 그릇'].map(type=>[type,meals.filter(m=>m.type===type).length])));
