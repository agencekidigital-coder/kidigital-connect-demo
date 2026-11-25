import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkshopsHandler} from '../server/workshops.mjs';
const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',w='cccccccc-cccc-cccc-cccc-cccccccccccc';
const env={NAITEA_AUTH_ENABLED:'true',NAITEA_WORKSHOPS_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
const origin='https://beta.example',url=origin+'/api/workshops';
const request=(method='GET',body,extra={})=>new Request(url,{method,headers:{Authorization:'Bearer a.b.c',Origin:origin,'Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
const valid={title:'Massage bébé',description:null,starts_at:null,capacity:6,price_cents:2500};
const row={id:w,professional_id:a,...valid,status:'draft',created_at:'2026-11-25T00:00:00Z'};
const json=x=>new Response(JSON.stringify(x));
function setup(rows=[row]){
  const calls=[];
  return {calls,handler:createWorkshopsHandler({fetchImpl:async(u,o)=>{calls.push([u,o]);return json(calls.length===1?{id:a}:rows);}})};
}
test('flag disabled without provider call',async()=>{const {handler,calls}=setup();assert.equal((await handler(request(),{...env,NAITEA_WORKSHOPS_ENABLED:'false'})).status,423);assert.equal(calls.length,0);});
test('authenticated owner filter and response',async()=>{const {handler,calls}=setup();const res=await handler(request(),env);assert.equal(res.status,200);assert.equal(new URL(calls[1][0]).searchParams.get('professional_id'),'eq.'+a);assert.equal((await res.json()).workshops[0].title,valid.title);});
test('create sets verified owner and draft',async()=>{const {handler,calls}=setup();assert.equal((await handler(request('POST',valid),env)).status,201);const p=JSON.parse(calls[1][1].body);assert.equal(p.professional_id,a);assert.equal(p.status,'draft');});
test('forged owner, status, or invalid capacity rejected',async()=>{for(const payload of [{...valid,professional_id:b},{...valid,status:'published'},{...valid,capacity:0}]){const {handler,calls}=setup();assert.equal((await handler(request('POST',payload),env)).status,400);assert.equal(calls.length,0);}});
test('cross-origin write rejected',async()=>{const {handler,calls}=setup();assert.equal((await handler(request('POST',valid,{Origin:'https://other.example'}),env)).status,403);assert.equal(calls.length,0);});
test('foreign provider row rejected',async()=>{const {handler}=setup([{...row,professional_id:b}]);assert.equal((await handler(request(),env)).status,503);});
test('edit is scoped to owner and draft and ID',async()=>{const {handler,calls}=setup();assert.equal((await handler(request('PATCH',{...valid,id:w}),env)).status,200);const params=new URL(calls[1][0]).searchParams;assert.equal(params.get('id'),'eq.'+w);assert.equal(params.get('status'),'eq.draft');assert.equal(params.get('professional_id'),'eq.'+a);});
test('empty mutation result not confirmed',async()=>{const {handler}=setup([]);assert.equal((await handler(request('PATCH',{...valid,id:w}),env)).status,404);});
test('missing bearer blocked',async()=>{const {handler,calls}=setup();assert.equal((await handler(request('GET',undefined,{Authorization:''}),env)).status,401);assert.equal(calls.length,0);});

const full={...valid,category:'Massage bébé',duration_label:'1h30',timezone_name:'Europe/Paris',modality:'venue',venue_name:'Cabinet fictif',venue_street:'1 rue de test',venue_postal_code:'59000',venue_city:'Lille',video_platform:null,target_audiences:['Jeunes parents','Bébés'],child_age_min:0,child_age_max:12,child_age_unit:'months'};
test('extended form fields persist and are returned without owner',async()=>{const {handler,calls}=setup([{...row,...full}]);const res=await handler(request('POST',full),env);assert.equal(res.status,201);assert.equal(JSON.parse(calls[1][1].body).venue_city,'Lille');const saved=(await res.json()).workshops[0];assert.equal(saved.child_age_max,12);assert.equal(saved.professional_id,undefined);});
test('reject partial extended form, invalid age, mixed modality and audience',async()=>{for(const body of [{...valid,category:'x'},{...full,child_age_max:-1},{...full,video_platform:'Zoom'},{...full,target_audiences:['invalid']},{...full,timezone_name:'invalid'}]){const {handler,calls}=setup();assert.equal((await handler(request('POST',body),env)).status,400);assert.equal(calls.length,0);}});
test('legacy patch does not clear extended data',async()=>{const {handler,calls}=setup([{...row,...full}]);assert.equal((await handler(request('PATCH',{...valid,id:w}),env)).status,200);assert.equal(Object.hasOwn(JSON.parse(calls[1][1].body),'category'),false);});
