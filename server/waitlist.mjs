import {workshopEmail} from './workshop-email.mjs';
import {bookingConfig} from './booking-config.mjs';
import {bytes,esc,format} from './public-workshop.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(status,code,extra={})=>new Response(JSON.stringify({code,...extra}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const decode=async(r,max)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,max)));
export function createWaitlistHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env)=>{
  const c=bookingConfig(env),u=new URL(request.url);
  if(!c||u.origin!==c.origin)return reply(423,'DISABLED');
  if(request.method!=='POST')return reply(405,'METHOD');
  if(u.search||request.headers.get('origin')!==u.origin)return reply(403,'ORIGIN');
  const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')||'');
  if(!match||match[1].length>8192)return reply(401,'AUTH_REQUIRED');
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return reply(415,'FORMAT');
  let id,action;
  try{
   const f=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,2048)));id=f.get('id');action=f.get('action');
   if(!UUID.test(id||'')||!['promote','withdraw'].includes(action))throw Error();
  }catch{return reply(400,'INVALID_REQUEST');}
  const call=(url,options)=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
  try{
   const auth=await call(c.url+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+match[1],Accept:'application/json'}});
   if(!auth.ok){auth.body?.cancel().catch(()=>{});return reply([401,403].includes(auth.status)?401:503,'AUTH_REQUIRED');}
   const user=await decode(auth,65536);if(!UUID.test(user?.id||'')||user.is_anonymous===true)return reply(401,'AUTH_REQUIRED');
   const hash=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   const response=await call(c.url+'/rest/v1/rpc/naitea_resolve_waitlist',{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_owner:user.id,p_id:id,p_action:action,p_hash:hash})});
   if(!response.ok){response.body?.cancel().catch(()=>{});return reply(503,'NOT_CONFIRMED');}
   const result=await decode(response,65536);
   if(result?.code==='WITHDRAWN')return reply(200,'WITHDRAWN');
   if(result?.code!=='CONFIRMED'){const known=['FULL','ALREADY_REQUESTED','ALREADY_RESOLVED','WORKSHOP_UNAVAILABLE','UNAVAILABLE','RATE_LIMIT','INVALID_REQUEST'];return reply(result?.code==='RATE_LIMIT'?429:409,known.includes(result?.code)?result.code:'NOT_CONFIRMED');}
   let mail='not_sent';
   if(result.email===c.testEmail){
    mail='failed';
    try{
     const w=result.workshop;
     const r=await call('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email:result.email}],...workshopEmail('promoted',w,result.first_name,result.seats)})});
     mail=r.ok?'accepted':'failed';r.body?.cancel().catch(()=>{});
    }catch{}
   }
   return reply(200,'CONFIRMED',{mail});
  }catch{return reply(503,'NOT_CONFIRMED');}
 };
}
