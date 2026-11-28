import {bookingConfig} from './booking-config.mjs';
import {bytes} from './public-workshop.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,ACCOUNT=/^acct_[A-Za-z0-9]+$/;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export function createStripeTestHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env={})=>{
  const c=bookingConfig(env),key=env.NAITEA_STRIPE_TEST_SECRET_KEY,url=new URL(request.url);
  if(!c||url.origin!==c.origin||env.NAITEA_STRIPE_TEST_ENABLED!=='true'||typeof key!=='string'||!/^sk_test_[A-Za-z0-9]{16,250}$/.test(key))return json(423,{error:'STRIPE_TEST_DISABLED'});
  if(url.search||!['GET','POST'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'});
  const token=request.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>8200)return json(401,{error:'AUTH_REQUIRED'});
  if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Content-Type')!=='application/json'))return json(403,{error:'ORIGIN_FORBIDDEN'});
  const call=(u,opts={})=>fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(10000),...opts});
  const read=async(r,max=262144)=>{if(!r.ok){r.body?.cancel().catch(()=>{});throw Error('provider');}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,max)));};
  try{
   const auth=await call(c.url+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:token}});
   if(!auth.ok){auth.body?.cancel().catch(()=>{});return json(401,{error:'AUTH_REQUIRED'});}
   const user=await read(auth);if(!UUID.test(user?.id||'')||user.is_anonymous===true)return json(401,{error:'AUTH_REQUIRED'});
   if(request.method==='POST'){const body=JSON.parse(new TextDecoder().decode(await bytes(request,128)));if(!body||Array.isArray(body)||Object.keys(body).length)return json(400,{error:'INVALID_REQUEST'});}
   const uid=user.id.toLowerCase(),table=c.url+'/rest/v1/naitea_stripe_test_accounts',dbHeaders={apikey:c.service,Accept:'application/json'};
   const get=async()=>{const u=new URL(table);u.searchParams.set('professional_id','eq.'+uid);u.searchParams.set('select','stripe_account_id');const rows=await read(await call(u.href,{headers:dbHeaders}),8192);if(!Array.isArray(rows)||rows.length>1||rows.length&& !ACCOUNT.test(rows[0]?.stripe_account_id||''))throw Error('account');return rows[0]?.stripe_account_id||null;};
   let id=await get();
   const stripe=async(path,params,idem)=>read(await call('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+key,...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(params?{body:new URLSearchParams(params)}:{})}));
   if(!id&&request.method==='GET')return json(200,{status:'not_connected'});
   if(!id){
    const a=await stripe('accounts',{type:'standard',country:'FR'},'naitea-test-connect-'+uid);
    if(!ACCOUNT.test(a?.id||'')||a.type!=='standard')throw Error('account');
    const inserted=await call(table,{method:'POST',headers:{...dbHeaders,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({professional_id:uid,stripe_account_id:a.id})});if(!inserted.ok){inserted.body?.cancel().catch(()=>{});throw Error('database');}inserted.body?.cancel().catch(()=>{});
    id=await get();if(!id)throw Error('account');
   }
   const account=await stripe('accounts/'+id);
   if(account.id!==id||account.type!=='standard')throw Error('account');
   const ready=account.details_submitted===true&&account.charges_enabled===true&&account.payouts_enabled===true;
   if(request.method==='GET'||ready)return json(200,{status:ready?'ready':'incomplete'});
   const back=c.origin+'/compte#stripeTestPanel';
   const link=await stripe('account_links',{account:id,refresh_url:back,return_url:back,type:'account_onboarding'});
   const target=new URL(link.url);if(target.origin!=='https://connect.stripe.com'||target.username||target.password)throw Error('link');
   return json(200,{status:'incomplete',url:target.href});
  }catch{return json(503,{error:'STRIPE_TEST_UNAVAILABLE'});}
 };
}
