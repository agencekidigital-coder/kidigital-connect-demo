import {workshopEmail} from './workshop-email.mjs';
import {bookingConfig} from './booking-config.mjs';
import {bytes} from './public-workshop.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(status,code,extra={})=>new Response(JSON.stringify({code,...extra}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const decode=async(r,max)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,max)));
export function createCancellationHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env)=>{
  const c=bookingConfig(env),u=new URL(request.url);
  if(!c||u.origin!==c.origin)return reply(423,'DISABLED');
  if(request.method!=='POST')return reply(405,'METHOD');
  if(u.search||request.headers.get('origin')!==u.origin)return reply(403,'ORIGIN');
  const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')||'');
  if(!match||match[1].length>8192)return reply(401,'AUTH_REQUIRED');
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return reply(415,'FORMAT');
  let id,scope,reason;
  try{
   const f=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,4096)));
   id=f.get('id');scope=f.get('scope');reason=(f.get('reason')||'').normalize('NFC').trim();
   if(!UUID.test(id||'')||!['booking','workshop'].includes(scope)||!reason||reason.length>250||/[\u0000-\u001f\u007f-\u009f]/.test(reason))throw Error();
  }catch{return reply(400,'INVALID_REQUEST');}
  const call=(url,options)=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
  let result,user;
  const rpc=async(name,body)=>{
   const r=await call(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
   if(!r.ok){r.body?.cancel().catch(()=>{});throw Error('RPC');}
   return decode(r,65536);
  };
  try{
   const auth=await call(c.url+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+match[1],Accept:'application/json'}});
   if(!auth.ok){auth.body?.cancel().catch(()=>{});return reply([401,403].includes(auth.status)?401:503,'AUTH_REQUIRED');}
   user=await decode(auth,65536);
   if(!UUID.test(user?.id||'')||user.is_anonymous===true)return reply(401,'AUTH_REQUIRED');
   result=await rpc('naitea_cancel_with_notifications',{p_owner:user.id,p_id:id,p_scope:scope,p_reason:reason,p_test_email:c.testEmail});
   if(result?.code!=='CANCELLED')return reply(409,['INVALID_REQUEST','UNAVAILABLE'].includes(result?.code)?result.code:'NOT_CONFIRMED');
  }catch{return reply(503,'NOT_CONFIRMED');}
  // Database cancellation is committed; a delivery failure must never undo it or suggest re-cancelling.
  let accepted=0,failed=0,unrecorded=0;
  const recipients=Array.isArray(result.recipients)?result.recipients:[];
  // Current preview allows at most one confirmed recipient and one waiting recipient with the test address.
  for(const person of recipients.slice(0,2)){
   if(person?.email!==c.testEmail||!UUID.test(person.id||'')||!['booking','waiting'].includes(person.kind)){failed++;continue;}
   let state='failed';
   try{
    const kind=person.kind==='waiting'?'cancel_waiting':scope==='workshop'?'cancel_workshop':'cancel_booking';
    const r=await call('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email:person.email}],...workshopEmail(kind,result.workshop,person.first_name,person.seats,result.reason)})});
    state=r.ok?'accepted':'failed';r.body?.cancel().catch(()=>{});
   }catch{}
   if(state==='accepted')accepted++;else failed++;
   try{if(await rpc('naitea_record_cancellation_email',{p_owner:user.id,p_id:person.id,p_kind:person.kind,p_status:state})!==true)unrecorded++;}catch{unrecorded++;}
  }
  failed+=Math.max(0,recipients.length-2);
  return reply(200,'CANCELLED',{bookings:result.bookings,waiting:result.waiting,pending:result.pending,skipped:result.skipped,accepted,failed,unrecorded});
 };
}
