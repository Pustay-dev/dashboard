(function(){
  // remote-sync.js — simple Supabase-backed sync for per-user per-day progress
  // Requires: supabase-config.js (window.SUPABASE_CONFIG) and supabase client library
  const client = () => window.supabaseClient || (window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey ? supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey) : null);

  // simple user resolution: prefer authenticated user; otherwise generate an anon id stored in localStorage
  async function getUser(){
    const c = client();
    if(c && c.auth && typeof c.auth.getUser === 'function'){
      try{
        const r = await c.auth.getUser();
        if(r && r.data && r.data.user) return r.data.user;
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
    if(!c) return null;
    const user = await getUser();
    if(!user) return null;
    const payload = { user_id: user.id, date: date, log: log || {}, config: config || {}, history: history || {}, updated_at: new Date().toISOString() };
    // upsert on (user_id,date)
    const { data, error } = await c.from('progress').upsert(payload, { onConflict: ['user_id','date'] }).select().single();
    if(error) throw error;
    return data;
  }

  async function loadAll({date}){
    const c = client();
    if(!c) return null;
    const user = await getUser();
    if(!user) return null;
    const { data, error } = await c.from('progress').select().eq('user_id', user.id).eq('date', date).single();
    if(error) return null;
    if(!data) return null;
    return { log: data.log || {}, config: data.config || null, history: data.history || {} };
  }

  window.remoteSync = { saveAll, loadAll, getUser };
})();
