import {workshopEmail} from './workshop-email.mjs';
import {bookingConfig} from './booking-config.mjs';
import {familyDetails} from './bookings.mjs';
import {bytes,esc,format} from './public-workshop.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const reply=(status,code,extra={})=>new Response(JSON.stringify({code,...extra}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
const decode=async(r,max)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,max)));
export function createManualBookingHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env)=>{
  const c=bookingConfig(env),u=new URL(request.url);
  if(!c||u.origin!==c.origin)return reply(423,'DISABLED');
  if(request.method!=='POST')return reply(405,'METHOD');
  if(u.search||request.headers.get('origin')!==u.origin)return reply(403,'ORIGIN');
  const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')||'');
  if(!match||match[1].length>8192)return reply(401,'AUTH_REQUIRED');
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return reply(415,'FORMAT');
  let f,details,email,seats,id,key,send,editing;
  try{
   f=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,8192)));
   editing=f.get('action')==='edit';details=familyDetails(f);details.newsletter=false;
   email=(f.get('parent_email')||'').trim().toLowerCase();seats=Number(f.get('seats'));id=f.get(editing?'booking_id':'workshop_id')||'';key=f.get('request_key')||'';send=f.get('send_email')==='yes';
   if(!EMAIL.test(email)||email.length>254||!UUID.test(id)||(!editing&&(!UUID.test(key)||!Number.isInteger(seats)||seats<1||seats>10)))throw Error();
  }catch{return reply(400,'INVALID_REQUEST');}
  const call=(url,options)=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
  try{
   const auth=await call(c.url+'/auth/v1/user',{headers:{apikey:c.publishableKey,Authorization:'Bearer '+match[1],Accept:'application/json'}});
   if(!auth.ok){auth.body?.cancel().catch(()=>{});return reply([401,403].includes(auth.status)?401:503,'AUTH_REQUIRED');}
   const user=await decode(auth,65536);
   if(!UUID.test(user?.id||'')||user.is_anonymous===true)return reply(401,'AUTH_REQUIRED');
   // Controlled beta: synthetic addresses may be stored but can never receive email.
   if(email!==c.testEmail&&!email.endsWith('@example.invalid'))return reply(400,'TEST_EMAIL_ONLY');
   if(editing){
    const response=await call(c.url+'/rest/v1/rpc/naitea_edit_manual_booking_contact',{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_owner:user.id,p_id:id,p_email:email,p_details:details})});
    if(!response.ok){response.body?.cancel().catch(()=>{});return reply(503,'NOT_CONFIRMED');}
    const result=await decode(response,65536);return result?.code==='UPDATED'?reply(200,'UPDATED'):reply(409,['DUPLICATE','UNAVAILABLE','INVALID_REQUEST'].includes(result?.code)?result.code:'NOT_CONFIRMED');
   }
   if(send&&email!==c.testEmail)return reply(400,'TEST_MAIL_ONLY');
   const hash=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   const resultResponse=await call(c.url+'/rest/v1/rpc/naitea_manual_workshop_booking',{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_owner:user.id,p_workshop_id:id,p_parent_email:email,p_seats:seats,p_request_key:key,p_hash:hash,p_details:details})});
   if(!resultResponse.ok){resultResponse.body?.cancel().catch(()=>{});return reply(503,'NOT_CONFIRMED');}
   const result=await decode(resultResponse,65536);
   if(result?.code!=='CONFIRMED'){
    const known=['ALREADY_REQUESTED','FULL','WORKSHOP_UNAVAILABLE','RATE_LIMIT','INVALID_REQUEST'];
    return reply(result?.code==='RATE_LIMIT'?429:409,known.includes(result?.code)?result.code:'NOT_CONFIRMED');
   }
   // The place is already committed. Email failure must not make the user retry creation.
   let mail='not_requested';
   if(send){
    mail='failed';
    try{
     const w=result.workshop;
     const response=await call('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email}],...workshopEmail('confirmed',w,details.first_name,seats)})});
     mail=response.ok?'accepted':'failed';response.body?.cancel().catch(()=>{});
    }catch{}
   }
   return reply(200,'CONFIRMED',{mail});
  }catch{return reply(503,'NOT_CONFIRMED');}
 };
}
