/* Account fields never enter the shared browser-only demonstration state. */
(function () {
  'use strict';
  if (document.body?.dataset.page !== 'account-profile') return;
  const $ = id => document.getElementById(id);
  let client, version = 0, controller, currentUser = '', pending = false, signingOut = false;
  function reset() {
    version += 1;
    controller?.abort(); controller = null; currentUser = ''; pending = false;
    $('accountForm').reset(); $('accountEmail').textContent = ''; $('accountSaveStatus').textContent = '';
    $('accountDetails').hidden = true;
    $('stripeTestPanel').hidden=true;$('stripeTestConnect').hidden=true;$('stripeTestStatus').textContent='';
    $('accountLogout').hidden = true;
    return version;
  }
  function notice(title, message, { login = false, retry = false } = {}) {
    $('accountNotice').hidden = false;
    $('accountNoticeTitle').textContent = title; $('accountMessage').textContent = message;
    $('accountLogin').hidden = !login; $('accountRetry').hidden = !retry;
  }
  function busy(value) {
    pending = value;
    for (const element of $('accountForm').elements) element.disabled = value;
    $('accountSave').textContent = value ? 'Enregistrement…' : 'Enregistrer';
  }
  function profile(value) {
    const data = value?.profile;
    return data && Object.keys(data).length === 2
      && ['full_name', 'business_name'].every(key => Object.hasOwn(data, key)
        && (data[key] === null || typeof data[key] === 'string' && data[key].length <= (key === 'full_name' ? 120 : 160))) ? data : null;
  }
  async function request(token, options, snapshot) {
    const active = new AbortController(); controller = active;
    const timer = setTimeout(() => active.abort(), 12000);
    try {
      const response = await fetch('/api/account', {
        ...options, credentials: 'omit', cache: 'no-store', signal: active.signal,
        headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) },
      });
      if (snapshot !== version) return null;
      if (!response.ok) {
        const code = response.status;
        if (code === 401) { reset(); notice('Connectez-vous à votre compte.', 'Votre session a expiré ou n’a pas pu être vérifiée.', { login: true }); return null; }
        const error = new Error(code === 404 ? 'Votre profil n’a pas encore été créé. Contactez Naïtea avant de continuer.'
          : code === 423 ? 'L’enregistrement des profils n’est pas encore ouvert.'
          : code === 409 ? 'Votre profil nécessite une vérification avant de pouvoir être modifié.'
          : code === 400 ? 'Vérifiez les informations du formulaire.'
          : 'Impossible d’accéder à votre profil pour le moment. Réessayez.');
        throw error;
      }
      const result = profile(await response.json());
      if (snapshot !== version) return null;
      if (!result) throw Error('La réponse du service est incomplète. Aucun enregistrement n’est confirmé.');
      return result;
    } finally { clearTimeout(timer); if (controller === active) controller = null; }
  }
  function scheduleLoad() {
    const snapshot = reset(); busy(false);
    notice('Vérification de votre connexion…', '');
    // Supabase auth callbacks must finish before another auth operation starts.
    setTimeout(() => load(snapshot), 0);
  }
  async function load(snapshot) {
    try {
      if (snapshot !== version) return;
      const sessionResult = await client.auth.getSession();
      if (snapshot !== version) return;
      const session = sessionResult.data?.session;
      if (sessionResult.error || !session?.access_token) return notice('Connectez-vous à votre compte.', 'La démonstration publique reste accessible sans compte.', { login: true });
      const verified = await client.auth.getUser();
      if (snapshot !== version) return;
      const user = verified.data?.user;
      if (verified.error || !user?.id || session.user?.id !== user.id) return notice('Connexion à vérifier.', 'Reconnectez-vous pour retrouver vos informations.', { login: true });
      const data = await request(session.access_token, { method: 'GET' }, snapshot);
      if (snapshot !== version || !data) return;
      currentUser = user.id;
      $('accountEmail').textContent = user.email || 'Compte connecté';
      $('accountFullName').value = data.full_name || ''; $('accountBusinessName').value = data.business_name || '';
      $('accountNotice').hidden = true; $('accountDetails').hidden = false; $('accountLogout').hidden = false;
      $('stripeTestPanel').hidden=false;stripeStatus(false);
    } catch (error) {
      if (snapshot === version) notice('Votre profil est indisponible.', error.name === 'AbortError' ? 'Le service met trop de temps à répondre. Réessayez.' : error.message, { retry: true });
    }
  }
  let stripeBusyVersion=null;
  async function stripeStatus(connect){
    const snapshot=version;if(!client||!currentUser||stripeBusyVersion===snapshot)return;stripeBusyVersion=snapshot;
    const label=$('stripeTestStatus'),action=$('stripeTestConnect'),refresh=$('stripeTestRefresh');
    action.disabled=true;refresh.disabled=true;label.textContent=connect?'Ouverture sécurisée de Stripe…':'Vérification de Stripe…';
    try{
      const result=await client.auth.getSession();if(snapshot!==version)return;
      const session=result.data?.session;if(result.error||!session?.access_token||session.user?.id!==currentUser)throw Error();
      const r=await fetch('/api/stripe-test-connect',{method:connect?'POST':'GET',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+session.access_token,...(connect?{'Content-Type':'application/json'}:{})},...(connect?{body:'{}'}:{})});
      const data=await r.json();if(snapshot!==version)return;
      if(r.status===423){action.hidden=true;label.textContent='Configuration Stripe de test non activée par Naïtea.';return;}
      if(!r.ok){const stages={AUTH:'Vérification de la session',DATABASE_READ:'Lecture du compte dans Supabase',DATABASE_SAVE:'Enregistrement du compte dans Supabase',STRIPE_CREATE:'Création du compte Stripe',STRIPE_STATUS:'Vérification du compte Stripe',STRIPE_ONBOARDING:'Ouverture du formulaire Stripe'};label.textContent='Impossible de vérifier Stripe. '+(Object.hasOwn(stages,data.stage)?stages[data.stage]+' ('+data.stage+(Number.isInteger(data.stripe_status)?', HTTP '+data.stripe_status:'')+').'+(/^req_[A-Za-z0-9]{1,100}$/.test(data.stripe_request_id||'')?' Référence Stripe : '+data.stripe_request_id+'.':''):r.status===401?'Reconnecte-toi à Naïtéa.':'Code HTTP '+r.status+'.');action.hidden=true;return;}
      if(connect&&data.url){const target=new URL(data.url);if(target.origin!=='https://connect.stripe.com')throw Error();location.assign(target.href);return;}
      const states={not_connected:'Aucun compte Stripe de test connecté.',incomplete:'Configuration Stripe de test à terminer.',ready:'Compte de test connecté et autorisé à accepter les paiements de test.'};
      if(!Object.hasOwn(states,data.status))throw Error();label.textContent=states[data.status];action.hidden=data.status==='ready';action.textContent=data.status==='incomplete'?'Terminer ma configuration Stripe':'Configurer Stripe en mode test';
    }catch{if(snapshot===version){label.textContent='Impossible de vérifier Stripe. Actualise avant de réessayer.';action.hidden=true;}}
    finally{if(stripeBusyVersion===snapshot)stripeBusyVersion=null;if(snapshot===version){action.disabled=false;refresh.disabled=false;}}
  }
  $('stripeTestConnect').addEventListener('click',()=>stripeStatus(true));
  $('stripeTestRefresh').addEventListener('click',()=>stripeStatus(false));
  $('accountRetry').addEventListener('click', () => { if (client) scheduleLoad(); });
  $('accountForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!client || !currentUser || pending || $('accountDetails').hidden) return;
    const data = { full_name: $('accountFullName').value.normalize('NFC').trim(), business_name: $('accountBusinessName').value.normalize('NFC').trim() || null };
    if (!data.full_name || data.full_name.length > 120 || data.business_name?.length > 160 || /[\u0000-\u001f\u007f]/.test(data.full_name + (data.business_name || ''))) {
      $('accountSaveStatus').dataset.error = 'true'; $('accountSaveStatus').textContent = 'Indiquez un nom et prénom valides, puis vérifiez la longueur des champs.'; return;
    }
    const snapshot = version; busy(true);
    $('accountSaveStatus').dataset.error = 'false'; $('accountSaveStatus').textContent = '';
    try {
      const result = await client.auth.getSession();
      if (snapshot !== version) return;
      if (result.error || !result.data?.session?.access_token || result.data.session.user?.id !== currentUser) { scheduleLoad(); return; }
      const saved = await request(result.data.session.access_token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }, snapshot);
      if (snapshot !== version || !saved) return;
      $('accountFullName').value = saved.full_name || ''; $('accountBusinessName').value = saved.business_name || '';
      $('accountSaveStatus').textContent = 'Vos informations de compte sont enregistrées.';
    } catch {
      if (snapshot === version) { $('accountSaveStatus').dataset.error = 'true'; $('accountSaveStatus').textContent = 'L’enregistrement n’a pas pu être confirmé. Rechargez le profil pour vérifier vos informations avant de réessayer.'; }
    } finally { if (snapshot === version) busy(false); }
  });
  $('accountLogout').addEventListener('click', async () => {
    if (!client || signingOut) return;
    signingOut = true;
    reset(); notice('Déconnexion en cours…', '');
    $('accountLogout').disabled = true;
    try {
      const result = await client.auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      reset(); notice('Vous êtes déconnectée.', 'Vous pouvez fermer cette page ou retrouver la démonstration.', { login: true });
    } catch {
      reset(); notice('La déconnexion n’a pas abouti.', 'Vos informations ont été masquées. Réessayez de vous déconnecter.');
      $('accountLogout').hidden = false;
    } finally { signingOut = false; $('accountLogout').disabled = false; }
  });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => { if (event.persisted && client) scheduleLoad(); });
  async function start() {
    try {
      const policy = await fetch('/api/deployment', { cache: 'no-store', credentials: 'omit' });
      if (!policy.ok || (await policy.json()).accountProfile !== true) return notice('L’espace compte ouvrira bientôt.', 'La connexion et la sauvegarde seront ouvertes après validation de leur configuration. Vous pouvez déjà explorer la démonstration.');
      const response = await fetch('/api/public-config', { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw Error('Configuration indisponible');
      const config = await response.json();
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) || typeof config.publishableKey !== 'string') throw Error('Configuration invalide');
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm');
      client = sdk.createClient(config.url, config.publishableKey);
      client.auth.onAuthStateChange((event, session) => {
        if (signingOut) return;
        // Token renewal for the same account must preserve unsaved edits.
        if (currentUser && session?.user?.id === currentUser && ['TOKEN_REFRESHED', 'SIGNED_IN', 'USER_UPDATED'].includes(event)) return;
        scheduleLoad();
      });
      scheduleLoad();
    } catch { notice('Connexion indisponible.', 'Réessayez un peu plus tard. La démonstration reste accessible.'); }
  }
  start();
})();
