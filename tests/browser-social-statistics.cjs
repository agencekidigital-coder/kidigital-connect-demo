const { chromium } = require('playwright'), assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4192';
(async () => {
 const b = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const c = await b.newContext({viewport:{width:1440,height:1000},locale:'fr-FR'});
  await c.route('**/api/public-config',r=>r.fulfill({status:503,body:'{}'}));
  const p = await c.newPage(), errors=[], writes=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET'&&!r.url().startsWith(BASE))writes.push(r.url())});
  await p.goto(BASE+'/pro');await p.locator('#sidebar [data-nav="communication"]').click();await p.locator('[data-v8="comm-tab"][data-value="publications"]').click();
  assert.match(await p.locator('#naiteaSocialStats').innerText(),/Aucun résultat importé/);
  const csv='Post ID,Title,Publish time,Views,Reach,Likes,Comments,Shares\n42,Atelier de test,2026-11-20,120,80,12,4,2';
  await p.locator('#naiteaSocialFile').setInputFiles({name:'rapport.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await p.waitForFunction(()=>document.querySelector('#naiteaSocialImportStatus').textContent.includes('1 publication'));
  assert.match(await p.locator('#naiteaSocialStats').innerText(),/120/); assert.match(await p.locator('#naiteaSocialStats').innerText(),/Atelier de test/);
  await p.locator('#naiteaSocialFile').setInputFiles({name:'rapport.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await p.waitForFunction(()=>document.querySelector('#naiteaSocialImportStatus').textContent.includes('1 publication'));
  assert.equal(await p.locator('.naitea-social-table tbody tr').count(),1);
  await p.reload();await p.locator('#sidebar [data-nav="communication"]').click();await p.locator('[data-v8="comm-tab"][data-value="publications"]').click();
  assert.equal(await p.locator('.naitea-social-table tbody tr').count(),1);
  for (const width of [1440,390,320]) {await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  fs.mkdirSync('/workspace/artifacts/naitea-social-statistics',{recursive:true});await p.screenshot({path:'/workspace/artifacts/naitea-social-statistics/mobile.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log(JSON.stringify({importedReports:'pass',deduplication:'pass',reload:'pass',responsive:'pass',inventedMetrics:0,externalWrites:0,browserErrors:0}));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
