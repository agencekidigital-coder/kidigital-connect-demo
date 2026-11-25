(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let sdk,owner=null,version=0,edit=null,busy=false,controller=null,uncertain=false;
  const status=t=>{$('workshopStatus').textContent=t;};
  function clearForm(){edit=null;$('workshopForm').reset();$('workshopHeading').textContent='Créer un atelier';}
  function setBusy(v){busy=v;for(const e of $('workshopForm').elements)e.disabled=v;$('wReload').disabled=v;}
  function reset(){version++;controller?.abort();owner=null;uncertain=false;clearForm();$('workshopList').replaceChildren();$('workshopPanel').hidden=true;$('workshopListPanel').hidden=true;$('workshopLogin').hidden=true;setBusy(false);}
  function localDate(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  async function api(method,data,snapshot){
    const {data:sessionData,error}=await sdk.auth.getSession();
    if(snapshot!==version)return null;
    const session=sessionData?.session;
    if(error||!session?.access_token||session.user.id!==owner)throw Error('Session expirée. Reconnectez-vous.');
    const c=new AbortController();controller=c;const timer=setTimeout(()=>c.abort(),18000);
    try{
      const res=await fetch('/api/workshops',{method,credentials:'omit',cache:'no-store',signal:c.signal,headers:{Authorization:'Bearer '+session.access_token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
      if(!res.ok)throw Error(res.status===401?'Session expirée. Reconnectez-vous.':res.status===423?'La sauvegarde des ateliers n’est pas encore ouverte.':'L’opération n’a pas pu être confirmée.');
      const result=await res.json();
      if(!Array.isArray(result.workshops))throw Error('Réponse non confirmée.');
      return snapshot===version?result:null;
    }finally{clearTimeout(timer);if(controller===c)controller=null;}
  }
  function render(result){
    const list=$('workshopList');list.replaceChildren();
    if(!result.workshops.length){const li=document.createElement('li');li.textContent='Aucun atelier enregistré.';list.append(li);}
    for(const w of result.workshops){
      const li=document.createElement('li'),title=document.createElement('strong'),desc=document.createElement('p');
      title.textContent=w.title;desc.textContent=[w.starts_at?new Date(w.starts_at).toLocaleString('fr-FR'):'Sans date',w.capacity+' places',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),w.status==='draft'?'Brouillon':w.status].join(' · ');
      li.append(title,desc);
      if(w.status==='draft'&&!w.category){const b=document.createElement('button');b.type='button';b.className='tester-button secondary';b.textContent='Modifier';b.addEventListener('click',()=>{if(busy||uncertain)return;edit=w.id;$('workshopHeading').textContent='Modifier le brouillon';$('wTitle').value=w.title;$('wDescription').value=w.description||'';$('wDate').value=localDate(w.starts_at);$('wCapacity').value=w.capacity;$('wPrice').value=(w.price_cents/100).toFixed(2);$('wTitle').focus();});li.append(b);}
      list.append(li);
    }
    $('wMore').hidden=!result.truncated;
  }
  async function load(){
    reset();const snapshot=version;status('Vérification de votre connexion…');
    try{
      const {data,error}=await sdk.auth.getUser();if(snapshot!==version)return;
      if(error||!data?.user){status('Connectez-vous pour retrouver vos ateliers.');$('workshopLogin').hidden=false;return;}
      owner=data.user.id;const result=await api('GET',null,snapshot);if(!result)return;
      render(result);$('workshopPanel').hidden=false;$('workshopListPanel').hidden=false;status('Vos ateliers sont privés.');
    }catch(e){if(snapshot===version){status(e.message||'Service indisponible.');$('workshopLogin').hidden=false;}}
  }
  $('wReset').addEventListener('click',()=>{if(!busy&&!uncertain)clearForm();});
  $('wReload').addEventListener('click',()=>{if(!busy)load();});
  $('workshopForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!owner||busy||uncertain)return;const snapshot=version;
    const date=$('wDate').value;
    const payload={title:$('wTitle').value,description:$('wDescription').value||null,starts_at:date?new Date(date).toISOString():null,capacity:Number($('wCapacity').value),price_cents:Math.round(Number($('wPrice').value)*100),...(edit?{id:edit}:{})};
    setBusy(true);status('Enregistrement…');
    try{
      const saved=await api(edit?'PATCH':'POST',payload,snapshot);if(!saved)return;
      clearForm();
      const result=await api('GET',null,snapshot);if(!result)return;
      render(result);status('Brouillon enregistré dans votre compte.');
    }catch{if(snapshot===version){uncertain=true;status('Enregistrement non confirmé. Actualisez la liste avant de réessayer pour éviter un doublon.');}}
    finally{if(snapshot===version){setBusy(false);if(uncertain)for(const field of $('workshopForm').elements)field.disabled=true;}}
  });
  window.addEventListener('pagehide',reset);
  window.addEventListener('pageshow',e=>{if(e.persisted&&sdk)load();});
  (async()=>{
    try{
      const policy=await fetch('/api/deployment',{cache:'no-store'});if(!policy.ok||!(await policy.json()).workshopPersistence){status('La sauvegarde des ateliers ouvrira après validation technique.');return;}
      const response=await fetch('/api/public-config',{cache:'no-store'});if(!response.ok)throw Error('config');
      const config=await response.json();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||typeof config.publishableKey!=='string')throw Error('config');
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm');sdk=createClient(config.url,config.publishableKey);
      sdk.auth.onAuthStateChange((event,session)=>{if(owner&&session?.user?.id===owner&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;reset();setTimeout(load,0);});
      await load();
    }catch{status('La connexion est momentanément indisponible.');}
  })();
})();
