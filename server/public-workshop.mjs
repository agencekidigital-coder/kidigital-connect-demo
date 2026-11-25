import publicConfig from './public-config.cjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const styles=['public-workshop-base.css','naitea.css','workspace.css','refinements.css','interface.css','workspace-v10.css','workspace-v11.css','editor-refinements.css','professional-profile.css','berceau.css','berceau-features.css','social-statistics.css','site-import.css','public-workshop.css'];
const page=(title,body,meta='')=>'< !doctype html>'.replace(' ','')+'<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+' | Naïtéa</title>'+meta+styles.map(s=>'<link rel="stylesheet" href="/assets/'+s+'">').join('')+'</head><body class="v8-shared naitea-public-workshop"><header class="naitea-public-header"><a href="/decouvrir" aria-label="Découvrir Naïtéa"><img src="/assets/berceau/transparent/naitea-logo.png" alt="Naïtéa"></a></header><main class="main naitea-public-main">'+body+'</main><footer class="naitea-public-footer"><a href="/decouvrir">Naïtéa · Grandir, bien entourés.</a></footer></body></html>';
const html=(status,title,body,meta='')=>new Response(page(title,body,meta),{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
const absent=(photo=false,status=404)=>photo?new Response(null,{status,headers}):html(status,'Atelier indisponible','<div class="card empty"><h1>Atelier indisponible</h1><p>Ce lien ne correspond pas à un atelier actuellement publié.</p><a href="/decouvrir" class="btn">Découvrir Naïtéa</a></div>');
async function bytes(response,max){
 if(!response.body)throw Error('Missing body');const reader=response.body.getReader(),chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max)throw Error('Too large');chunks.push(value);}}
 catch(error){reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const out=new Uint8Array(total);let i=0;for(const chunk of chunks){out.set(chunk,i);i+=chunk.byteLength;}return out;
}
function valid(w,id){
 return w&&w.id===id&&typeof w.title==='string'&&w.title.length<=160&&Number.isFinite(Date.parse(w.starts_at))&&Number.isInteger(w.capacity)&&w.capacity>0&&Number.isInteger(w.price_cents)&&w.price_cents>=0&&['venue','video'].includes(w.modality);
}
function format(w){
 const timeZone=w.timezone_name||'Europe/Paris';
 let date;
 try{date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone}).format(new Date(w.starts_at));}
 catch{date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(w.starts_at));}
 const location=w.modality==='video'?'À distance · '+(w.video_platform||'Visioconférence'):[w.venue_name,w.venue_street,[w.venue_postal_code,w.venue_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
 const age=w.child_age_unit&&w.child_age_min!=null&&w.child_age_max!=null?'De '+w.child_age_min+' à '+w.child_age_max+' '+(w.child_age_unit==='years'?'ans':'mois'):'';
 const price=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(w.price_cents/100);
 return {date,location,age,price};
}
export function createPublicWorkshopHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,id,photo=false)=>{
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if(env.NAITEA_PUBLICATION_ENABLED!=='true'||env.NAITEA_WORKSHOPS_ENABLED!=='true'||env.NAITEA_AUTH_ENABLED!=='true'||!UUID.test(id))return absent(photo);
  const config=publicConfig.readPublicConfig(env);if(!config)return absent(photo,503);
  id=id.toLowerCase();
  const providerHeaders={apikey:config.publishableKey,...(config.publishableKey.startsWith('eyJ')?{Authorization:'Bearer '+config.publishableKey}:{})};
  const fetchProvider=(path,opts={})=>fetchImpl(config.url+path,{redirect:'manual',signal:AbortSignal.timeout(10000),...opts});
  try{
   const response=await fetchProvider('/rest/v1/rpc/naitea_public_workshop',{method:'POST',headers:{...providerHeaders,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_id:id})});
   if(!response.ok){response.body?.cancel().catch(()=>{});return absent(photo,503);}
   const w=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(response,65536)));
   if(!valid(w,id))return absent(photo);
   const cover=typeof w.cover_path==='string'&&w.cover_path.split('/').length===2&&UUID.test(w.cover_path.split('/')[0])&&w.cover_path.split('/')[1]===id+'.jpg';
   if(photo){
    if(!cover)return absent(true);
    const r=await fetchProvider('/storage/v1/object/authenticated/naitea-workshop-covers/'+w.cover_path,{headers:providerHeaders});
    if(!r.ok){r.body?.cancel().catch(()=>{});return absent(true);}
    if(r.headers.get('content-type')?.split(';')[0]!=='image/jpeg'){r.body?.cancel().catch(()=>{});return absent(true);}
    const b=await bytes(r,2097152);
    if(b.length<4||b[0]!==255||b[1]!==216||b[2]!==255)return absent(true);
    return new Response(request.method==='HEAD'?null:b,{headers:{...headers,'Content-Type':'image/jpeg'}});
   }
   const {date,location,age,price}=format(w);
   const photoPath='/atelier/'+id+'/photo';
   const meta='<meta property="og:title" content="'+esc(w.title)+'"><meta property="og:description" content="'+esc(String(w.description||'Découvrez cet atelier Naïtéa.').slice(0,220))+'">'+(cover?'<meta property="og:image" content="'+esc(new URL(photoPath,request.url).href)+'">':'');
   const body='<div class="v8-public-event">'+(cover?'<img class="naitea-public-cover" src="'+photoPath+'" alt="Photo de couverture de '+esc(w.title)+'">':'')+'<div class="card"><span class="tag">'+esc(w.category)+'</span><h1>'+esc(w.title)+'</h1>'+(w.business_name?'<p class="naitea-public-provider">Proposé par '+esc(w.business_name)+'</p>':'')+'<p class="naitea-public-description">'+esc(w.description)+'</p><div class="v8-toolbar"><span>'+esc(date)+'</span><span>'+esc(w.duration_label)+'</span></div><p>'+esc(location)+'</p>'+(Array.isArray(w.target_audiences)?'<p><strong>Pour qui ?</strong> '+esc(w.target_audiences.join(', '))+(age?' · '+esc(age):'')+'</p>':'')+'<p><strong>'+esc(price)+' / duo</strong> · '+esc(w.capacity)+' places au total</p><button type="button" class="btn" disabled>Réservation bientôt disponible</button><p class="fine">Les réservations en ligne ne sont pas encore ouvertes sur Naïtéa.</p></div></div>';
   return html(200,w.title,body,meta);
  }catch{return absent(photo,503);}
 };
}
