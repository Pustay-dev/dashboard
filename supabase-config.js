// Configure these values with your Supabase project credentials.
// DO NOT commit real secrets to public repos if this repo is public.
window.SUPABASE_CONFIG = {
  url: 'https://dipchrxyyfzuwucstsuc.supabase.co', // e.g. 'https://xyzabc.supabase.co'
  anonKey: 'sb_publishable_uFcqbB9TKyGtYdLywsfd5w_6fyzOECc' // e.g. 'public-anon-key'
};

// If the Supabase lib is loaded, initialize a client for convenience.
if(window.supabase && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey){
  try{
    window.supabaseClient = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  }catch(e){ console.warn('Supabase init failed', e); }
}
