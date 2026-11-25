import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicWorkshopHandler} from '../server/public-workshop.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',owner='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const env={NAITEA_AUTH_ENABLED:'true',NAITEA_WORKSHOPS_ENABLED:'true',NAITEA_PUBLICATION_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
const request=new Request('https://beta.example/atelier/'+id);
const workshop={id,title:'<script>alert(1)</script>',description:'<img onerror=x>',category:'Éveil',starts_at:'2026-12-15T13:00:00Z',timezone_name:'Europe/Paris',capacity:8,price_cents:3500,modality:'video',video_platform:'Zoom',business_name:'Test',cover_path:owner+'/'+id+'.jpg',professional_id:owner};
const setup=(row,photo=null)=>{const calls=[];const handler=createPublicWorkshopHandler({fetchImpl:async(url,opts)=>{calls.push([url,opts]);return url.includes('/storage/')?photo:new Response(JSON.stringify(row));}});return {handler,calls};};
test('disabled flag and missing/draft projection produce no public page',async()=>{const s=setup(null);assert.equal((await s.handler(request,{},id)).status,404);assert.equal(s.calls.length,0);assert.equal((await s.handler(request,env,id)).status,404);assert.equal((await s.handler(request,env,id,true)).status,404);});
test('public page escapes database values and never exposes private owner, uses original stylesheet and no reservation',async()=>{
 const s=setup(workshop);const res=await s.handler(request,env,id);const html=await res.text();
 assert.equal(res.status,200);assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(!html.includes(owner));assert(html.includes('public-workshop-base.css'));assert(html.includes('v8-public-event'));assert(html.includes('Réservation bientôt disponible'));assert(html.includes('/atelier/'+id+'/photo'));assert.equal(res.headers.get('Cache-Control'),'no-store');assert.deepEqual(JSON.parse(s.calls[0][1].body),{p_id:id});
});
test('photo is proxied only for published projection and exact validated JPEG',async()=>{
 const s=setup(workshop,new Response(Uint8Array.from([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
 const res=await s.handler(request,env,id,true);assert.equal(res.status,200);assert.equal(res.headers.get('Content-Type'),'image/jpeg');assert.equal(s.calls.length,2);
 const invalid=setup({...workshop,cover_path:'https://evil.test/a.jpg'});assert.equal((await invalid.handler(request,env,id,true)).status,404);assert.equal(invalid.calls.length,1);
});

test('published readable slug resolves and UUID redirects without changing photo endpoint',async()=>{
 const slug='atelier-eveil-kidigital-lille',row={...workshop,slug};
 const s=setup(row);const r=await s.handler(request,env,id);assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/atelier/'+slug);
 const s2=setup(row);const page=await s2.handler(new Request('https://beta.example/atelier/'+slug+'?embed=1'),env,slug);
 assert.equal(page.status,200);const html=await page.text();assert(html.includes('naitea-public-embedded'));assert(html.includes('naitea-public-date'));assert(html.includes('naitea-public-price'));assert.deepEqual(JSON.parse(s2.calls[0][1].body),{p_slug:slug});
});
