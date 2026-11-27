/* Import preview and mapping. Original files stay in the browser. */
(function(root){
'use strict';
const fields=[['first_name','Prénom',120,['prenom','first name','firstname']],['last_name','Nom',120,['nom','nom de famille','last name','lastname','surname']],['email','Email *',254,['email','e-mail','mail','adresse email','adresse e-mail','courriel']],['phone','Téléphone',30,['telephone','tel','portable','mobile','phone','numero de telephone']],['coparent','Co-parent',200,[]],['children','Enfant(s)',1000,[]],['notes','Notes organisationnelles',2000,[]]];
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function mappingFor(headers){const map={};for(const [key,, ,aliases] of fields){const i=headers.findIndex(h=>aliases.includes(normalize(h)));map[key]=i<0?null:i;}return map;}
function prepareRows(data,map,phoneValue,existing=[]){
 const seen=new Set(),known=new Set(existing),result=[];
 for(let i=1;i<data.length;i++){
  const row=data[i];let contact={},reason='';
  try{
   for(const [key,,max] of fields){
    const cell=map[key]==null?null:row[map[key]];
    if(cell?.formula||cell?.truncated)throw Error('Formule ou cellule trop longue');
    const value=String(cell?.value||'').trim().replace(/[\r\n\t]+/g,' ');
    if(value.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(value))throw Error('Champ invalide ou trop long');
    contact[key]=value||null;
   }
   contact.email=String(contact.email||'').toLowerCase();
   if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email))throw Error('Email manquant ou invalide');
   if(!contact.first_name&&!contact.last_name)throw Error('Prénom ou nom manquant');
   if(contact.email!=='contact@naitea.fr'&&!contact.email.endsWith('@example.invalid'))throw Error('Adresse réelle non autorisée en bêta');
   contact.phone=phoneValue(contact.phone);
   if(known.has(contact.email))reason='Doublon dans le CRM';
   else if(seen.has(contact.email))reason='Doublon dans le fichier';
   seen.add(contact.email);
  }catch(e){reason=e.message||'Coordonnées invalides';}
  result.push({line:i+1,contact,reason,duplicate:reason.startsWith('Doublon')});
 }
 return result;
}
function create(d){
 const node=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const text=(tag,v)=>{const n=node(tag);n.textContent=v;return n;};
 const button=(label,fn,primary=false)=>{const b=text('button',label);b.type='button';b.className=primary?'btn':'btn secondary';b.addEventListener('click',fn);return b;};
 const element=node('section','naitea-family-import');let worker=null,timer=null,disposed=false,data=null,serial=0,map={},prepared=[],busy=false;
 const alive=()=>!disposed&&d.isCurrent();
 const stop=()=>{worker?.terminate();worker=null;clearTimeout(timer);timer=null;};
 function dispose(){disposed=true;serial++;stop();data=null;prepared=[];element.replaceChildren();}
 const info=text('p','Le fichier est lu sur ton appareil. Seuls les contacts validés sont enregistrés dans ton compte. Formats XLS, XLSX et CSV (5 Mo, 500 contacts maximum, première feuille).');info.className='naitea-import-status';
 const warning=text('p','Bêta : uniquement des contacts fictifs @example.invalid ou contact@naitea.fr. N’importe aucune donnée de santé. Aucun consentement newsletter ni envoi d’email ne sera importé.');
 const choose=node('input');choose.type='file';choose.accept='.csv,.xls,.xlsx';choose.setAttribute('aria-label','Fichier clients Excel ou CSV');
 const status=text('p','');status.setAttribute('role','status');status.className='naitea-import-status';
 const body=node('div','naitea-family-import');
 const back=button('← Mes familles',()=>{if(!busy)d.close();});
 element.append(back,text('h2','Importer un fichier clients'),info,warning,choose,status,body);
 function sampleTable(rows){
  const box=node('div','naitea-import-preview'),table=node('table'),thead=node('thead'),tr=node('tr');
  for(const h of ['Ligne','Prénom / nom','Email','Téléphone','État'])tr.append(text('th',h));thead.append(tr);table.append(thead);
  const tbody=node('tbody');for(const row of rows.slice(0,20)){const r=node('tr'),c=row.contact;for(const val of [String(row.line),[c.first_name,c.last_name].filter(Boolean).join(' '),c.email||'—',c.phone||'—',row.reason||'Prêt à importer'])r.append(text('td',val));tbody.append(r);}table.append(tbody);box.append(table);return box;
 }
 function renderMapping(sheetName,sheetCount){
  body.replaceChildren();body.append(text('h3','1. Associer les colonnes'),text('p',data.length-1+' ligne(s) détectée(s) dans « '+sheetName+' ».'+(sheetCount>1?' Seul le premier onglet est importé.':'')+' La première ligne sert de titres.'));
  const headers=data[0].map((c,i)=>c.value.trim().slice(0,160)||'Colonne '+(i+1));map=mappingFor(headers);
  const grid=node('div','naitea-import-mapping'),preview=node('div','naitea-family-import');
  const check=button('Vérifier les contacts et doublons',async()=>{
    if(!alive()||busy)return;
    if(map.email==null||(map.first_name==null&&map.last_name==null)){status.textContent='Associe l’email et au moins le prénom ou le nom.';return;}
    const used=Object.values(map).filter(v=>v!==null);if(new Set(used).size!==used.length){status.textContent='Associe chaque colonne à un seul champ.';return;}
    const v=++serial;busy=true;check.disabled=true;choose.disabled=true;back.disabled=true;status.textContent='Vérification…';preview.replaceChildren();
    try{
      const candidates=prepareRows(data,map,d.phoneValue),emails=[...new Set(candidates.filter(r=>!r.reason).map(r=>r.contact.email))];
      const existing=emails.length?await d.existing(emails):[];
      if(!alive()||v!==serial)return;
      prepared=prepareRows(data,map,d.phoneValue,existing);
      const valid=prepared.filter(r=>!r.reason),dupes=prepared.filter(r=>r.duplicate).length,invalid=prepared.length-valid.length-dupes;
      status.textContent='Vérification terminée.';
      preview.append(text('h3','2. Vérifier puis importer'),text('p',valid.length+' nouveau(x) contact(s) · '+dupes+' doublon(s) ignoré(s) · '+invalid+' ligne(s) invalide(s). Les fiches existantes restent inchangées.'),sampleTable(prepared),text('p','Aperçu des 20 premières lignes. Les lignes invalides ne seront pas importées.'));
      if(invalid){const errors=node('details');errors.append(text('summary','Voir les lignes invalides'));for(const row of prepared.filter(x=>x.reason&&!x.duplicate))errors.append(text('p','Ligne '+row.line+' : '+row.reason));preview.append(errors);}
      const confirm=button('Importer '+valid.length+' contact(s)',async()=>{
        if(!alive()||busy||v!==serial||!valid.length)return;
        busy=true;confirm.disabled=check.disabled=choose.disabled=back.disabled=true;for(const s of grid.querySelectorAll('select'))s.disabled=true;
        status.textContent='Import en cours…';
        try{const result=await d.commit(valid.map(r=>r.contact));if(alive()&&v===serial)await d.done({inserted:Number(result.inserted),skipped:Number(result.skipped)+dupes});}
        catch(e){if(alive()&&v===serial){status.textContent=e.message||'Import non confirmé. Actualise avant de réessayer.';confirm.disabled=true;}}
        finally{if(alive()&&v===serial){busy=false;check.disabled=choose.disabled=back.disabled=false;for(const s of grid.querySelectorAll('select'))s.disabled=false;}}
      },true);confirm.disabled=!valid.length;preview.append(confirm);
    }catch(e){if(alive()&&v===serial)status.textContent=e.message||'Vérification impossible.';}
    finally{if(alive()&&v===serial){busy=false;check.disabled=choose.disabled=back.disabled=false;for(const s of grid.querySelectorAll('select'))s.disabled=false;}}
  },true);
  for(const [key,label] of fields){
   const wrap=node('label','field');wrap.append(text('span',label));const select=node('select');select.append(text('option','Ne pas importer'));select.options[0].value='';
   for(const [i,h] of headers.entries()){const option=text('option',h);option.value=String(i);select.append(option);}
   select.value=map[key]===null?'':String(map[key]);select.addEventListener('change',()=>{map[key]=select.value===''?null:Number(select.value);serial++;prepared=[];preview.replaceChildren();status.textContent='Vérifie les nouvelles associations.';});wrap.append(select);grid.append(wrap);
  }
  // Disable mapping during the asynchronous lookup so that the result cannot refer to stale mappings.
  check.addEventListener('click',()=>{if(busy)for(const s of grid.querySelectorAll('select'))s.disabled=true;});
  body.append(grid,check,preview);
 }
 choose.addEventListener('change',async()=>{
  if(!alive()||busy)return;
  const v=++serial;stop();data=null;prepared=[];body.replaceChildren();const file=choose.files[0];if(!file)return;
  const extension=file.name.split('.').pop().toLowerCase();
  if(!['csv','xls','xlsx'].includes(extension)||!file.size||file.size>5*1024*1024){status.textContent='Choisis un fichier XLS, XLSX ou CSV de 5 Mo maximum.';return;}
  status.textContent='Lecture du fichier…';
  try{
   const buffer=await file.arrayBuffer();if(!alive()||v!==serial)return;
   worker=new Worker('/assets/family-import-worker.js');timer=setTimeout(()=>{if(alive()&&v===serial){stop();status.textContent='Lecture trop longue. Essaie un fichier plus petit ou un CSV.';}},15000);
   worker.onmessage=e=>{if(!alive()||v!==serial)return;stop();if(e.data.error){status.textContent=e.data.error;return;}data=e.data.data;status.textContent='Fichier lu. Associe les colonnes.';renderMapping(e.data.sheetName,e.data.sheetCount);};
   worker.onerror=()=>{if(alive()&&v===serial){stop();status.textContent='Impossible de lire le fichier. Vérifie son format.';}};
   worker.postMessage({buffer,extension},[buffer]);
  }catch{if(alive()&&v===serial){stop();status.textContent='Lecture du fichier impossible.';}}
 });
 return {element,dispose};
}
const api={create,mappingFor,prepareRows};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaFamilyImport=api;
})(globalThis);
