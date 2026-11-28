import test from 'node:test';import assert from 'node:assert/strict';import {createStripeTestHandler} from '../server/stripe-test-connect.mjs';
const origin='https://beta.example.com',env={NAITEA_AUTH_ENABLED:'true',NAITEA_WORKSHOPS_ENABLED:'true',NAITEA_PUBLICATION_ENABLED:'true',NAITEA_BOOKINGS_ENABLED:'true',NAITEA_BOOKING_SUPABASE_SECRET:'sb_secret_'+ 'a'.repeat(32),SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+ 'a'.repeat(32),NAITEA_TURNSTILE_SITE_KEY:'site_key_12345',NAITEA_TURNSTILE_SECRET_KEY:'fake_secret_123',NAITEA_BOOKING_BREVO_KEY:'fake_brevo_123',NAITEA_BOOKING_SENDER:'contact@naitea.fr',NAITEA_BOOKING_ORIGIN:origin,NAITEA_BOOKING_TEST_EMAIL:'contact@naitea.fr',NAITEA_STRIPE_TEST_ENABLED:'true',NAITEA_STRIPE_TEST_SECRET_KEY:'sk_test_'+ 'a'.repeat(32)};
const req=(method='GET',headers={})=>new Request(origin+'/api/stripe-test-connect',{method,headers,...(method==='POST'?{body:'{}'}:{})});
test('Stripe refuses live keys and requests without authentication',async()=>{let calls=0;const h=createStripeTestHandler({fetchImpl:async()=>{calls++;throw Error();}});assert.equal((await h(req(),{...env,NAITEA_STRIPE_TEST_SECRET_KEY:'sk_live_'+ 'a'.repeat(32)})).status,423);assert.equal((await h(req(),env)).status,401);assert.equal(calls,0);});
test('Stripe status checks only authenticated owner without creating an account',async()=>{let calls=[];const uid='12345678-1234-4234-8234-123456789012';const h=createStripeTestHandler({fetchImpl:async(u)=>{calls.push(u);return Response.json(calls.length===1?{id:uid}:[]);}});const r=await h(req('GET',{Authorization:'Bearer aa.bb.cc'}),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'not_connected'});assert(calls[1].includes(uid));assert.equal(calls.length,2);});
test('Stripe requires same origin for POST',async()=>{const h=createStripeTestHandler({fetchImpl:async()=>{throw Error();}});assert.equal((await h(req('POST',{Authorization:'Bearer aa.bb.cc','Content-Type':'application/json',Origin:'https://other.example.com'}),env)).status,403);});

test('Stripe exposes a fixed diagnostic stage without provider secrets',async()=>{let calls=0;const uid='12345678-1234-4234-8234-123456789012';const h=createStripeTestHandler({fetchImpl:async()=>++calls===1?Response.json({id:uid}):new Response('private provider error',{status:403})});const r=await h(req('GET',{Authorization:'Bearer aa.bb.cc'}),env);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'STRIPE_TEST_UNAVAILABLE',stage:'DATABASE_READ'});});

const owner='12345678-1234-4234-8234-123456789012',accountId='acct_Test123',postHeaders={Authorization:'Bearer aa.bb.cc','Content-Type':'application/json',Origin:origin};
function v2Account(status='pending'){return {id:accountId,livemode:false,dashboard:'full',defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},configuration:{merchant:{capabilities:{card_payments:{status}}}}};}
test('Creates merchant account with v2 JSON, preserves owner mapping and opens v2 onboarding',async()=>{
 let calls=[],mapped=false;
 const h=createStripeTestHandler({fetchImpl:async(u,o)=>{
  calls.push([u,o]);const url=new URL(u);
  if(url.pathname==='/auth/v1/user')return Response.json({id:owner});
  if(url.pathname==='/rest/v1/naitea_stripe_test_accounts'){
   if(o.method==='POST'){assert.deepEqual(JSON.parse(o.body),{professional_id:owner,stripe_account_id:accountId});mapped=true;return new Response(null,{status:201});}
   return Response.json(mapped?[{stripe_account_id:accountId}]:[]);
  }
  assert.equal(o.headers['Stripe-Version'],'2026-11-18.endive');
  if(url.pathname==='/v2/core/accounts'){
   assert.equal(o.headers['Content-Type'],'application/json');assert.equal(o.headers['Idempotency-Key'],'naitea-test-connect-v2-'+owner);
   const p=JSON.parse(o.body);assert.equal(p.identity.country,'FR');assert.equal(p.dashboard,'full');assert.deepEqual(p.defaults.responsibilities,{fees_collector:'stripe',losses_collector:'stripe'});assert.equal(p.configuration.merchant.capabilities.card_payments.requested,true);assert.equal(p.defaults.currency,'eur');assert(!('type' in p));return Response.json(v2Account());
  }
  if(url.pathname==='/v2/core/accounts/'+accountId){assert.deepEqual([...url.searchParams],[['include[0]','configuration.merchant'],['include[1]','defaults'],['include[2]','requirements']]);return Response.json(v2Account());}
  if(url.pathname==='/v2/core/account_links'){
   const p=JSON.parse(o.body);assert.equal(p.account,accountId);assert.equal(p.use_case.type,'account_onboarding');assert.deepEqual(p.use_case.account_onboarding,{collection_options:{fields:'eventually_due'},refresh_url:origin+'/compte#stripeTestPanel',return_url:origin+'/compte#stripeTestPanel'});assert.equal(p.use_case.account_onboarding.return_url,origin+'/compte#stripeTestPanel');return Response.json({url:'https://accounts.stripe.com/r/acct_Test123#alu_test_example'});
  }
  throw Error('Unexpected request');
 }});
 const r=await h(req('POST',postHeaders),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'incomplete',url:'https://accounts.stripe.com/r/acct_Test123#alu_test_example'});assert.equal(calls.length,7);
});
test('Existing v2 account must have active merchant card capability to be ready',async()=>{
 for(const status of ['active','pending']){
  const h=createStripeTestHandler({fetchImpl:async(u)=>{const path=new URL(u).pathname;return Response.json(path==='/auth/v1/user'?{id:owner}:path.startsWith('/rest/')?[{stripe_account_id:accountId}]:v2Account(status));}});
  const r=await h(req('GET',{Authorization:'Bearer aa.bb.cc'}),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:status==='active'?'ready':'incomplete'});
 }
});
test('Stripe error exposes HTTP status but not secret response content',async()=>{
 const h=createStripeTestHandler({fetchImpl:async(u)=>{const path=new URL(u).pathname;return path==='/auth/v1/user'?Response.json({id:owner}):path.startsWith('/rest/')?Response.json([]):new Response('private Stripe details',{status:400});}});
 const r=await h(req('POST',postHeaders),env);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'STRIPE_TEST_UNAVAILABLE',stage:'STRIPE_CREATE',stripe_status:400});
});

test('A mapped account is retrieved with indexed v2 includes without creating a new account',async()=>{
 const h=createStripeTestHandler({fetchImpl:async(u,o)=>{const url=new URL(u);if(url.pathname==='/auth/v1/user')return Response.json({id:owner});if(url.pathname.startsWith('/rest/'))return Response.json([{stripe_account_id:accountId}]);assert.equal(o.method,'GET');assert.equal(url.pathname,'/v2/core/accounts/'+accountId);assert.deepEqual([...url.searchParams],[['include[0]','configuration.merchant'],['include[1]','defaults'],['include[2]','requirements']]);return new Response('provider private error',{status:400,headers:{'Request-Id':'req_Test123'}});}});
 const r=await h(req('GET',{Authorization:'Bearer aa.bb.cc'}),env);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'STRIPE_TEST_UNAVAILABLE',stage:'STRIPE_STATUS',stripe_status:400,stripe_request_id:'req_Test123'});
});

test('Endive onboarding resumes an existing merchant account without the removed configurations field',async()=>{
 let links=0;
 const h=createStripeTestHandler({fetchImpl:async(u,o)=>{const url=new URL(u);if(url.pathname==='/auth/v1/user')return Response.json({id:owner});if(url.pathname.startsWith('/rest/')){assert.notEqual(o.method,'POST');return Response.json([{stripe_account_id:accountId}]);}if(url.pathname==='/v2/core/accounts/'+accountId)return Response.json(v2Account());if(url.pathname==='/v2/core/account_links'){links++;const p=JSON.parse(o.body);assert.deepEqual(p,{account:accountId,use_case:{type:'account_onboarding',account_onboarding:{collection_options:{fields:'eventually_due'},refresh_url:origin+'/compte#stripeTestPanel',return_url:origin+'/compte#stripeTestPanel'}}});return Response.json({url:'https://accounts.stripe.com/r/acct_Test123#alu_test_example'});}throw Error('Must not recreate account');}});
 const r=await h(req('POST',postHeaders),env);assert.equal(r.status,200);assert.equal(links,1);assert.equal((await r.json()).status,'incomplete');
});
