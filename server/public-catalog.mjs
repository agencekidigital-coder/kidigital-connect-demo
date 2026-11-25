import publicConfig from './public-config.cjs';
import {esc,headers,html,bytes,format,safeURL,SLUG} from './public-workshop.mjs';
const unavailable=(status=404)=>html(status,'Ateliers indisponibles','<div class="card empty"><h1>Ateliers indisponibles</h1><p>Ce lien ne correspond pas à un espace ateliers actif.</p><a href="/decouvrir" class="btn">Découvrir Naïtéa</a></div>');
const safeSlug=s=>typeof s==='string'&&s.length<=180&&SLUG.test(s);
export function createPublicCatalogHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,slug)=>{
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  if(env.NAITEA_AUTH_ENABLED!=='true'||env.NAITEA_WORKSHOPS_ENABLED!=='true'||env.NAITEA_PUBLICATION_ENABLED!=='true'||!safeSlug(slug))return unavailable();
  const config=publicConfig.readPublicConfig(env);if(!config)return unavailable(503);
  const url=new URL(request.url), embed=url.searchParams.get('embed')==='1';
  const mode=['all','venue','video'].includes(url.searchParams.get('modalite'))?url.searchParams.get('modalite'):'all';
  const period=url.searchParams.get('periode')==='past'?'past':'upcoming';
  const p=Number(url.searchParams.get('page')||1), index=Number.isInteger(p)&&p>=1&&p<=100?p:1;
  const path='/ateliers/'+slug;
  const href=(modality=mode,per=period,page=1)=>{
    const params=new URLSearchParams();
    if(embed)params.set('embed','1');
    if(modality!=='all')params.set('modalite',modality);
    if(per!=='upcoming')params.set('periode',per);
    if(page!==1)params.set('page',String(page));
    return path+(params.size?'?'+params:'');
  };
  try{
    const res=await fetchImpl(config.url+'/rest/v1/rpc/naitea_public_workshop_catalog',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{apikey:config.publishableKey,...(config.publishableKey.startsWith('eyJ')?{Authorization:'Bearer '+config.publishableKey}:{}),'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_slug:slug,p_page:index,p_modality:mode,p_period:period})});
    if(!res.ok){res.body?.cancel().catch(()=>{});return unavailable(503);}
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(res,262144)));
    if(!data||data.slug!==slug||!Array.isArray(data.workshops)||data.workshops.length>25)return unavailable();
    const name=typeof data.business_name==='string'&&data.business_name.trim()?data.business_name:'cette professionnelle';
    const filter=(label,link,selected)=>'<a class="btn '+(selected?'':'secondary')+'" href="'+esc(link)+'"'+(selected?' aria-current="page"':'')+'>'+esc(label)+'</a>';
    const google=safeURL(data.public_google_url);
    const cards=data.workshops.slice(0,24).map(w=>{
      if(!safeSlug(w.slug)||typeof w.title!=='string'||!Number.isFinite(Date.parse(w.starts_at))||!Number.isInteger(w.price_cents)||w.price_cents<0||!Number.isInteger(w.capacity)||w.capacity<1||!['venue','video'].includes(w.modality))return '';
      const {date,price}=format(w), detail='/atelier/'+w.slug;
      return '<article class="card eventcard naitea-catalog-card">'+(w.has_cover===true?'<img src="'+detail+'/photo" alt="" loading="lazy">':'<div class="naitea-catalog-placeholder" aria-hidden="true">✿</div>')+'<div class="eventcontent"><span class="tag">'+esc(w.category||'Atelier')+'</span><p class="naitea-catalog-date">'+esc(date)+(w.duration_label?' · '+esc(w.duration_label):'')+'</p><h2>'+esc(w.title)+'</h2><p>'+esc(w.modality==='video'?'À distance':w.venue_city||'En présentiel')+'</p><p class="naitea-catalog-price">'+esc(price)+' / duo</p><a class="btn" href="'+detail+(embed?'?embed=1':'')+'">Découvrir l’atelier</a></div></article>';
    }).join('');
    const nav='<nav class="naitea-catalog-filters" aria-label="Filtrer les ateliers">'+[['Tous les ateliers','all'],['En présentiel','venue'],['À distance','video']].map(([label,m])=>filter(label,href(m,period),m===mode)).join('')+'</nav><nav class="naitea-catalog-filters" aria-label="Période">'+filter('À venir',href(mode,'upcoming'),period==='upcoming')+filter('Déjà passés',href(mode,'past'),period==='past')+'</nav>';
    const paging='<nav class="naitea-catalog-filters" aria-label="Pagination">'+(index>1?filter('Précédent',href(mode,period,index-1),false):'')+(data.workshops.length===25&&index<100?filter('Suivant',href(mode,period,index+1),false):'')+'</nav>';
    const body='<section class="naitea-catalog"><header><h1>Les ateliers de '+esc(name)+'</h1><p>Découvrez les ateliers et les moments de partage proposés aux familles.</p>'+(google?'<a href="'+esc(google)+'" target="_blank" rel="noopener noreferrer">Consulter les avis Google</a>':'')+'</header>'+nav+(cards?'<div class="naitea-catalog-grid">'+cards+'</div>':'<div class="card empty"><p>Aucun atelier '+(period==='upcoming'?'à venir':'passé')+' pour le moment.</p></div>')+paging+'</section>';
    const meta='<link rel="canonical" href="'+esc(new URL(path,request.url).href)+'"><meta property="og:title" content="'+esc('Les ateliers de '+name)+'">';
    return html(200,'Les ateliers de '+name,body,meta,embed);
  }catch{return unavailable(503);}
 };
}
