import publicConfig from './public-config.cjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTRA = ['category','duration_label','timezone_name','modality','venue_name','venue_street','venue_postal_code','venue_city','video_platform','target_audiences','child_age_min','child_age_max','child_age_unit'];
const FIELDS = ['id','professional_id','title','description','starts_at','capacity','price_cents','status','created_at','public_slug','pricing_unit','payment_mode','deposit_cents','cancellation_reason','cancelled_at','reminder_hours','reminder_instructions',...EXTRA].join(',');
const AUDIENCES = new Set(['Future maman','Futurs parents','Jeune maman','Jeunes parents','Co-parent','Bébés','Enfants','Adolescents','Toute la famille']);
function extraFields(input) {
  if(!EXTRA.some(k=>Object.hasOwn(input,k)))return {};
  if(!EXTRA.every(k=>Object.hasOwn(input,k)))throw Error('Incomplete extended form');
  const required=(k,n)=>cleanText(input[k],n,true);
  const optional=(k,n)=>input[k]===null?null:cleanText(input[k],n);
  const category=required('category',100),duration_label=optional('duration_label',80),timezone_name=required('timezone_name',100);
  new Intl.DateTimeFormat('fr-FR',{timeZone:timezone_name}).format();
  const modality=input.modality;
  if(!['venue','video'].includes(modality))throw Error('modality');
  const venueKeys=['venue_name','venue_street','venue_postal_code','venue_city'];
  const location=modality==='venue'?{venue_name:required('venue_name',150),venue_street:required('venue_street',200),venue_postal_code:required('venue_postal_code',20),venue_city:required('venue_city',100),video_platform:null}:{venue_name:null,venue_street:null,venue_postal_code:null,venue_city:null,video_platform:required('video_platform',100)};
  if(modality==='video'&&venueKeys.some(k=>input[k]!==null)||modality==='venue'&&input.video_platform!==null)throw Error('mixed modality');
  const audiences=input.target_audiences;
  if(!Array.isArray(audiences)||!audiences.length||audiences.length>AUDIENCES.size||audiences.some(a=>!AUDIENCES.has(a))||new Set(audiences).size!==audiences.length)throw Error('audiences');
  const {child_age_min:min,child_age_max:max,child_age_unit:unit}=input;
  if(!(min===null&&max===null&&unit===null)&&(!Number.isFinite(min)||!Number.isFinite(max)||!['months','years'].includes(unit)||min<0||max<min||max>(unit==='years'?18:216)))throw Error('age');
  return {category,duration_label,timezone_name,modality,...location,target_audiences:audiences,child_age_min:min,child_age_max:max,child_age_unit:unit};
}
const EDIT = ['title','description','starts_at','capacity','price_cents'];
export function paymentFields(input){
 const mode=input.payment_mode,deposit=input.deposit_cents;
 if(!Object.hasOwn(input,'payment_mode')&&!Object.hasOwn(input,'deposit_cents'))return {};
 if(!Object.hasOwn(input,'payment_mode')||!Object.hasOwn(input,'deposit_cents')||!['free','onsite','online','choice','deposit'].includes(mode))throw Error('payment mode');
 if(mode==='free'&&input.price_cents!==0||['online','choice','deposit'].includes(mode)&&input.price_cents<=0)throw Error('payment price');
 if(mode==='deposit'?(!Number.isInteger(deposit)||deposit<=0||deposit>=input.price_cents):deposit!==null)throw Error('deposit');
 return {payment_mode:mode,deposit_cents:deposit};
}
const reply = (status, body, headers={}) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail = (status, code) => reply(status,{code});
async function bounded(stream, max) {
  if (!stream) throw Error('Missing body');
  const reader=stream.getReader(); const chunks=[]; let n=0;
  try {
    while(true) {
      const {done,value}=await reader.read(); if(done) break;
      n+=value.byteLength;
      if(n>max) throw Error('Body exceeds limit');
      chunks.push(value);
    }
  } catch(e) {reader.cancel().catch(()=>{});throw e;} finally {reader.releaseLock();}
  const bytes=new Uint8Array(n);let i=0;
  for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function cleanText(x,max,required=false) {
  if(typeof x!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(x)) throw Error('text');
  x=x.normalize('NFC').trim();
  if(x.length>max||(required&&!x))throw Error('text length');
  return x||null;
}
function reminderFields(input){
  const hasHours=Object.hasOwn(input,'reminder_hours'),hasNotes=Object.hasOwn(input,'reminder_instructions');
  if(!hasHours&&!hasNotes)return {};
  if(!hasHours||!hasNotes||!Array.isArray(input.reminder_hours)||input.reminder_hours.length>3||new Set(input.reminder_hours).size!==input.reminder_hours.length||input.reminder_hours.some(h=>![2,24,48].includes(h)))throw Error('reminder_hours');
  const notes=input.reminder_instructions===null?null:cleanText(input.reminder_instructions,1000)?.replace(/[\r\n\t]+/g,' ')||null;
  return {reminder_hours:input.reminder_hours.slice().sort((a,b)=>b-a),reminder_instructions:notes};
}
function validate(input, method) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('body');
  const keys=Object.keys(input), allowed=method==='PATCH'?[...EDIT,...EXTRA,'pricing_unit','payment_mode','deposit_cents','reminder_hours','reminder_instructions','id']:[...EDIT,...EXTRA,'pricing_unit','payment_mode','deposit_cents','reminder_hours','reminder_instructions'];
  if(keys.some(k=>!allowed.includes(k))||!EDIT.every(k=>Object.hasOwn(input,k)))throw Error('fields');
  if(method==='PATCH'&&(typeof input.id!=='string'||!UUID.test(input.id)))throw Error('id');
  if(Object.hasOwn(input,'pricing_unit')&&!['person','duo'].includes(input.pricing_unit))throw Error('pricing_unit');
  const {capacity,price_cents,starts_at}=input;
  if(!Number.isInteger(capacity)||capacity<1||capacity>1000||!Number.isInteger(price_cents)||price_cents<0||price_cents>10000000)throw Error('numbers');
  if(starts_at!==null&&(typeof starts_at!=='string'||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(starts_at)||!Number.isFinite(Date.parse(starts_at))||new Date(starts_at).toISOString()!==starts_at))throw Error('date');
  return {title:cleanText(input.title,160,true),description:input.description===null?null:cleanText(input.description,5000),starts_at,capacity,price_cents,...(Object.hasOwn(input,'pricing_unit')?{pricing_unit:input.pricing_unit}:{}),...extraFields(input),...reminderFields(input),...paymentFields(input)};
}
export function createWorkshopsHandler({fetchImpl=globalThis.fetch}={}) {
  return async(request,env={})=>{
    if(env.NAITEA_AUTH_ENABLED!=='true'||env.NAITEA_WORKSHOPS_ENABLED!=='true')return fail(423,'WORKSHOPS_DISABLED');
    const config=publicConfig.readPublicConfig(env);
    if(!config)return fail(503,'WORKSHOPS_UNAVAILABLE');
    const method=request.method;
    if(!['GET','POST','PATCH'].includes(method))return reply(405,{code:'METHOD_NOT_ALLOWED'},{Allow:'GET, POST, PATCH'});
    const url=new URL(request.url);
    if(url.search)return fail(400,'INVALID_REQUEST');
    const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')||'');
    if(!token||token[1].length>8192)return fail(401,'AUTH_REQUIRED');
    let payload,input,transition=false,reminderOnly=false;
    if(method!=='GET'){
      if(request.headers.get('origin')!==url.origin)return fail(403,'ORIGIN_FORBIDDEN');
      if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return fail(415,'JSON_REQUIRED');
      try {
        input=await bounded(request.body,32768);
        if(method==='PATCH'&&input&&Object.hasOwn(input,'status')){
          if(env.NAITEA_PUBLICATION_ENABLED!=='true')return fail(423,'PUBLICATION_DISABLED');
          if(Object.keys(input).length!==2||typeof input.id!=='string'||!UUID.test(input.id)||!['draft','published'].includes(input.status))throw Error('transition');
          transition=true;payload={status:input.status};
        }else if(method==='PATCH'&&input&&Object.hasOwn(input,'reminder_hours')&&Object.keys(input).every(k=>['id','reminder_hours','reminder_instructions'].includes(k))){
          if(typeof input.id!=='string'||!UUID.test(input.id)||Object.keys(input).length!==3)throw Error('reminders');
          reminderOnly=true;payload=reminderFields(input);
        }else payload=validate(input,method);
      }catch{return fail(400,'INVALID_WORKSHOP');}
    }
    const headers={apikey:config.publishableKey,Authorization:'Bearer '+token[1],Accept:'application/json'};
    const requestProvider=(url,options={})=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(10000),...options});
    try {
      const auth=await requestProvider(config.url+'/auth/v1/user',{headers});
      if(!auth.ok){auth.body?.cancel().catch(()=>{});return fail([401,403].includes(auth.status)?401:503,'AUTH_REQUIRED');}
      const user=await bounded(auth.body,65536);
      if(typeof user.id!=='string'||!UUID.test(user.id)||user.is_anonymous===true)return fail(401,'AUTH_REQUIRED');
      const owner=user.id.toLowerCase(), endpoint=new URL('/rest/v1/naitea_workshops',config.url);
      endpoint.searchParams.set('select',FIELDS);
      if(method==='GET'){
        endpoint.searchParams.set('professional_id','eq.'+owner);
        endpoint.searchParams.set('order','created_at.desc,id.asc');
        endpoint.searchParams.set('limit','101');
      }
      if(method==='POST')payload={...payload,professional_id:owner,status:'draft'};
      if(method==='PATCH'){
        endpoint.searchParams.set('professional_id','eq.'+owner);
        endpoint.searchParams.set('id','eq.'+input.id);
        endpoint.searchParams.set('status',reminderOnly?'in.(draft,published)':transition&&input.status==='draft'?'eq.published':'eq.draft');
      }
      const response=await requestProvider(endpoint.href,{method,headers:method==='GET'?headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},...(payload?{body:JSON.stringify(payload)}:{})});
      if(!response.ok){response.body?.cancel().catch(()=>{});if(transition&&[400,409].includes(response.status))return fail(400,'WORKSHOP_NOT_PUBLISHABLE');return fail(response.status===401?401:response.status===403?403:503,'WORKSHOPS_UNAVAILABLE');}
      const rows=await bounded(response.body,3*1024*1024);
      if(!Array.isArray(rows)||rows.some(r=>typeof r.id!=='string'||!UUID.test(r.id)||r.professional_id!==owner))return fail(503,'INVALID_RESPONSE');
      if(method!=='GET'&&rows.length!==1)return fail(rows.length===0?404:503,'WORKSHOP_NOT_SAVED');
      if(method==='PATCH'&&(rows[0].id.toLowerCase()!==input.id.toLowerCase()||transition&&rows[0].status!==input.status))return fail(503,'INVALID_RESPONSE');
      const safe=rows.slice(0,100).map(row=>Object.fromEntries(FIELDS.split(',').filter(key=>key!=='professional_id').map(key=>[key,row[key]??null])));
      return reply(method==='POST'?201:200,{workshops:safe,truncated:rows.length>100});
    }catch{return fail(503,'WORKSHOPS_UNAVAILABLE');}
  };
}
