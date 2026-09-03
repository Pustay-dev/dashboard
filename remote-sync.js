(function(){
  // remote-sync.js — Supabase-backed sync with auth support and debug logging
  // Requires: supabase-config.js (window.SUPABASE_CONFIG) and supabase client library

  // Initialize client (reuse window.supabaseClient if available)
  function makeClient(){
    if(window.supabaseClient) return window.supabaseClient;
    if(window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey){
      try{
        window.supabaseClient = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
        return window.supabaseClient;
      }catch(e){ console.error('supabase.createClient failed', e); return null; }
    }
    return null;
  }

  const client = () => makeClient();
  let currentUser = null;
  // listen for auth changes (if client supports it)
  (async ()=>{
    const c = client();
    if(!c || !c.auth) return;
    try{
      // try to get current user on load
      const r = await c.auth.getUser();
      if(r && r.data && r.data.user){ currentUser = r.data.user; }
    }catch(e){ /* ignore */ }

    // subscribe to auth changes
    if(typeof c.auth.onAuthStateChange === 'function'){
      c.auth.onAuthStateChange((event, session)=>{
        try{
          // session?.user is new API sometimes
          if(session && session.user) currentUser = session.user;
          else if(session && session.access_token) {
            // try to extract user via getUser
            c.auth.getUser().then(res=>{ if(res && res.data && res.data.user) currentUser = res.data.user; });
          } else if(event === 'SIGNED_OUT'){
            currentUser = null;
          }
        }catch(e){ console.warn('auth state change handling failed', e); }
        // notify app code if present
        if(window.remoteSync && typeof window.remoteSync.onAuthChange === 'function'){
          try{ window.remoteSync.onAuthChange(currentUser); }catch(e){}
        }
      });
    }
  })();

  // simple user resolution: prefer authenticated user; otherwise generate an anon id stored in localStorage
  async function getUser(){
    const c = client();
    if(c && currentUser) return currentUser;
    if(c && c.auth && typeof c.auth.getUser === 'function'){
      try{
        const r = await c.auth.getUser();
        if(r && r.data && r.data.user) { currentUser = r.data.user; return currentUser; }
      }catch(e){ /* ignore */ }
    }
    let anon = null;
    try{ anon = localStorage.getItem('anon_user_id'); }catch(e){}
    if(!anon){
      anon = 'anon-' + (crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
      try{ localStorage.setItem('anon_user_id', anon); }catch(e){}
    }
    return { id: anon, anon: true };
  }

  async function saveAll({date, log, config, history}){
    const c = client();
    if(!c) { console.warn('Supabase client not available for saveAll'); return null; }
    const user = await getUser();
    if(!user) { console.warn('No user available for saveAll'); return null; }
    const payload = { user_id: user.id, date: date, log: log || {}, config: config || {}, history: history || {}, updated_at: new Date().toISOString() };
    try{
      const { data, error } = await c.from('progress').upsert(payload, { onConflict: ['user_id','date'] }).select().single();
      if(error){ console.error('Supabase upsert error', error); throw error; }
      console.log('remoteSync.saveAll succeeded', data);
      return data;
    }catch(err){
      console.error('remoteSync.saveAll threw', err);
      throw err;
    }
  }

  async function loadAll({date}){
    const c = client();
    if(!c) { console.warn('Supabase client not available for loadAll'); return null; }
    const user = await getUser();
    if(!user) { console.warn('No user available for loadAll'); return null; }
    try{
      const { data, error } = await c.from('progress').select().eq('user_id', user.id).eq('date', date).single();
      if(error){
        // if 406 (no rows) or other, return null but log
        console.warn('Supabase select error', error);
        return null;
      }
      if(!data) return null;
      console.log('remoteSync.loadAll loaded', data);
      return { log: data.log || {}, config: data.config || null, history: data.history || {} };
    }catch(err){ console.error('remoteSync.loadAll threw', err); return null; }
  }

  // helper to sign in with magic link
  async function signInWithEmail(email){
    const c = client();
    if(!c) throw new Error('Supabase client not configured');
    try{
      const res = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
      console.log('signInWithEmail result', res);
      return res;
    }catch(err){ console.error('signInWithEmail failed', err); throw err; }
  }

  async function signOut(){
    const c = client();
    if(!c) return;
    try{ await c.auth.signOut(); currentUser = null; }catch(e){ console.warn('signOut failed', e); }
  }

  window.remoteSync = { saveAll, loadAll, getUser, client: client, signInWithEmail, signOut, onAuthChange: null };
})();
