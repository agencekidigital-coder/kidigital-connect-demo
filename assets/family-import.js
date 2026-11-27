/* Import preview and mapping. Original files stay in the browser. */
(function(root){
'use strict';
const fields=[['first_name','Prénom',120,['prenom','first name','firstname']],['last_name','Nom',120,['nom','nom de famille','last name','lastname','surname']],['email','Email *',254,['email','e-mail','mail','adresse email','adresse e-mail','courriel']],['phone','Téléphone',30,['telephone','tel','portable','mobile','phone','numero de telephone']],['coparent','Co-parent',200,[]],['children','Enfant(s)',1000,[]],['notes','Notes organisationnelles',2000,[]],['amount_cents','Chiffre d’affaires (€)',50,['chiffre d’affaires','chiffre d\'affaires','chiffre d affaires','ca','ca (€)','chiffre d’affaires (€)','chiffre d\'affaires (€)']],['workshop_label','Atelier',500,['atelier','ateliers','nom de l’atelier','nom de l\'atelier']],['accompaniment_label','Accompagnement',500,['accompagnement','accompagnements','nom de l’accompagnement','nom de l\'accompagnement']],['activity_date','Date (facultative)',40,['date','date de prestation','date de l’atelier','date de l\'atelier']]];
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function mappingFor(headers){const map={};for(const [key,, ,aliases] of fields){const i=headers.findIndex(h=>aliases.includes(normalize(h)));map[key]=i<0?null:i;}return map;}
function amountCents(value,rawNumber){
 if(rawNumber!==undefined&&rawNumber!==null){const n=Number(rawNumber);const cents=Math.round(n*100);if(!Number.isFinite(n)||n<0||cents>100000000000||Math.abs(n*100-cents)>0.00001)throw Error('Chiffre d’affaires invalide');return cents;}
 let s=String(value??'').trim();if(!s)return null;
 s=s.replace(/[\s\u00a0\u202f]/g,'').replace(/(?:€|EUR)$/i,'');
 if(s.includes(',')&&s.includes('.')){if(!/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s))throw Error('Chiffre d’affaires invalide');s=s.replace(/\./g,'');}
 s=s.replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Chiffre d’affaires invalide');
 const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>100000000000)throw Error('Chiffre d’affaires invalide');return n;
}
function activityDate(value){
 let s=String(value??'').trim();if(!s)return null;
 const fr=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);if(fr)s=fr[3]+'-'+fr[2].padStart(2,'0')+'-'+fr[1].padStart(2,'0');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01')throw Error('Date invalide : JJ/MM/AAAA ou AAAA-MM-JJ');
 const date=new Date(s+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==s)throw Error('Date invalide');
 const today=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(today.map(v=>[v.type,v.value]));if(s>p.year+'-'+p.month+'-'+p.day)throw Error('La date historique ne peut pas être future');
 return s;
}
const hasActivity=c=>c.amount_cents!==null||!!c.workshop_label||!!c.accompaniment_label;
function prepareRows(data,map,phoneValue,existing=[]){
 const seen=new Set(),known=new Map(existing.map(v=>typeof v==='string'?[v,true]:[v.email,!!v.has_history])),result=[];
 for(let i=1;i<data.length;i++){
  const row=data[i];let contact={},reason='',enrich=false;
  try{
   for(const [key,,max] of fields){
    const cell=map[key]==null?null:row[map[key]];
    if(cell?.formula||cell?.truncated)throw Error('Formule ou cellule trop longue');
    const value=String(cell?.value||'').trim().replace(/[\r\n\t]+/g,' ');
    if(value.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(value))throw Error('Champ invalide ou trop long');
    contact[key]=key==='amount_cents'?amountCents(value,cell?.rawNumber):key==='activity_date'?activityDate(value):value||null;
   }
   contact.email=String(contact.email||'').toLowerCase();
   if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email))throw Error('Email manquant ou invalide');
   if(!contact.first_name&&!contact.last_name)throw Error('Prénom ou nom manquant');
   if(contact.email!=='contact@naitea.fr'&&!contact.email.endsWith('@example.invalid'))throw Error('Adresse réelle non autorisée en bêta');
   contact.phone=phoneValue(contact.phone);
   if(seen.has(contact.email))reason='Doublon dans le fichier';
   else if(known.has(contact.email)){if(hasActivity(contact)&&!known.get(contact.email))enrich=true;else reason='Doublon dans le CRM';}
   seen.add(contact.email);
  }catch(e){reason=e.message||'Coordonnées invalides';}
  result.push({line:i+1,contact,reason,enrich,duplicate:reason.startsWith('Doublon')});
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
 const model=button('Télécharger un modèle CSV',()=>{
  if(!alive())return;
  const csv='\ufeffPrénom;Nom;Email;Téléphone;Chiffre d’affaires;Atelier;Accompagnement;Date\r\nCamille;Martin;camille-import@example.invalid;0600000001;75,00;Massage bébé;;\r\nÉlodie;Dupont;elodie-import@example.invalid;0600000002;120,50;;Soutien post-partum;01/11/2026\r\n';
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=node('a');a.href=url;a.download='modele-import-familles-naitea.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 element.append(back,text('h2','Importer un fichier clients'),info,warning,text('p','Une ligne par famille : indique son CA historique total et le ou les noms des prestations, hors réservations déjà enregistrées dans Naïtéa. La date facultative sert à rattacher le montant à une période ; sans date, il est inclus dans Tout l’historique. Un seul historique par famille, jamais ajouté deux fois. Aucun atelier ni rendez-vous réel n’est créé.'),model,choose,status,body);
 function sampleTable(rows){
  const box=node('div','naitea-import-preview'),table=node('table'),thead=node('thead'),tr=node('tr');
  for(const h of ['Ligne','Prénom / nom','Email','Téléphone','CA (€)','Atelier','Accompagnement','Date','État'])tr.append(text('th',h));thead.append(tr);table.append(thead);
  const tbody=node('tbody');for(const row of rows.slice(0,20)){const r=node('tr'),c=row.contact;for(const val of [String(row.line),[c.first_name,c.last_name].filter(Boolean).join(' '),c.email||'—',c.phone||'—',c.amount_cents==null?'—':(c.amount_cents/100).toFixed(2).replace('.',','),c.workshop_label||'—',c.accompaniment_label||'—',c.activity_date||'—',row.reason||(row.enrich?'Historique à ajouter':'Prêt à importer')])r.append(text('td',val));tbody.append(r);}table.append(tbody);box.append(table);return box;
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
      preview.append(text('h3','2. Vérifier puis importer'),text('p',valid.filter(r=>!r.enrich).length+' nouveau(x) contact(s) · '+valid.filter(r=>r.enrich).length+' fiche(s) existante(s) à enrichir · '+dupes+' doublon(s) ignoré(s) · '+invalid+' ligne(s) invalide(s). Les coordonnées existantes ne sont pas écrasées.'),sampleTable(prepared),text('p','Aperçu des 20 premières lignes. Les lignes invalides ne seront pas importées.'));
      if(invalid){const errors=node('details');errors.append(text('summary','Voir les lignes invalides'));for(const row of prepared.filter(x=>x.reason&&!x.duplicate))errors.append(text('p','Ligne '+row.line+' : '+row.reason));preview.append(errors);}
      const confirm=button('Importer '+valid.length+' contact(s)',async()=>{
        if(!alive()||busy||v!==serial||!valid.length)return;
        busy=true;confirm.disabled=check.disabled=choose.disabled=back.disabled=true;for(const s of grid.querySelectorAll('select'))s.disabled=true;
        status.textContent='Import en cours…';
        try{const result=await d.commit(valid.map(r=>r.contact));if(alive()&&v===serial)await d.done({inserted:Number(result.inserted),enriched:Number(result.enriched),histories:Number(result.histories),skipped:Number(result.skipped)+dupes});}
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
const api={create,mappingFor,prepareRows,amountCents,activityDate};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaFamilyImport=api;
})(globalThis);
