import {workshopEmail} from './workshop-email.mjs';
import {bytes} from './public-workshop.mjs';
const PROJECT='https://eedbpqawsrkopoonqpbx.supabase.co',TEST_EMAIL='contact@naitea.fr';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function reminderConfig(env={}){
 if(env.NAITEA_REMINDERS_ENABLED!=='true'||env.SUPABASE_URL!==PROJECT||env.NAITEA_BOOKING_TEST_EMAIL!==TEST_EMAIL||env.NAITEA_BOOKING_SENDER!==TEST_EMAIL||typeof env.NAITEA_BOOKING_SUPABASE_SECRET!=='string'||!/^sb_secret_[A-Za-z0-9_-]{20,200}$/.test(env.NAITEA_BOOKING_SUPABASE_SECRET)||typeof env.NAITEA_BOOKING_BREVO_KEY!=='string'||env.NAITEA_BOOKING_BREVO_KEY.length<10)return null;
 return {url:PROJECT,service:env.NAITEA_BOOKING_SUPABASE_SECRET,brevo:env.NAITEA_BOOKING_BREVO_KEY,email:TEST_EMAIL};
}
export async function runReminders(env,{fetchImpl=globalThis.fetch}={}){
 const c=reminderConfig(env);if(!c)return {disabled:true,accepted:0,failed:0,skipped:0};
 const result={disabled:false,accepted:0,failed:0,skipped:0,unrecorded:0};
 const call=(url,options)=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
 const rpc=async(name,body)=>{
  const r=await call(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  if(!r.ok){r.body?.cancel().catch(()=>{});throw Error('REMINDER_RPC');}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,65536)));
 };
 for(let i=0;i<3;i++){
  const job=await rpc('naitea_claim_workshop_reminder',{p_test_email:c.email});
  if(job===null)break;
  if(!UUID.test(job?.booking_id||'')||![2,24,48].includes(job?.hours_before)||!Number.isFinite(Date.parse(job?.starts_at))||job.email!==c.email||!job.workshop)throw Error('INVALID_REMINDER_JOB');
  const key={p_booking_id:job.booking_id,p_hours:job.hours_before,p_starts_at:job.starts_at};
  let state='failed';
  try{
   // Recheck immediately before dispatch; no retry after ambiguous delivery.
   if(await rpc('naitea_check_workshop_reminder',{...key,p_email:c.email})!==true)state='skipped';
   else{
    const r=await call('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.email},to:[{email:c.email}],...workshopEmail('reminder',job.workshop,job.first_name,job.seats)})});
    state=r.ok?'accepted':'failed';r.body?.cancel().catch(()=>{});
   }
  }catch{}
  result[state]++;
  try{if(await rpc('naitea_finish_workshop_reminder',{...key,p_status:state})!==true)result.unrecorded++;}catch{result.unrecorded++;}
 }
 return result;
}
export default {
 async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});},
 async scheduled(_event,env){const result=await runReminders(env);console.log('Naitea reminder run',JSON.stringify(result));if(result.disabled||result.failed||result.unrecorded)throw Error('REMINDER_RUN_NEEDS_REVIEW');}
};
