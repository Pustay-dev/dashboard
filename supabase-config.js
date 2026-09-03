// Configure these values with your Supabase project credentials.
// DO NOT commit real secrets to public repos if this repo is public.
window.SUPABASE_CONFIG = {
  url: 'https://dipchrxyyfzuwucstsuc.supabase.co', // e.g. 'https://xyzabc.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcGNocnh5eWZ6dXd1Y3N0c3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjM3MjgsImV4cCI6MjEwMzk5OTcyOH0.4Pn-NjIlKTc02-kMBoYz90wtGjgdMUp9GnrtzgflPqs' // e.g. 'public-anon-key'
};

// If the Supabase lib is loaded, initialize a client for convenience.
if(window.supabase && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey){
  try{
    window.supabaseClient = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  }catch(e){ console.warn('Supabase init failed', e); }
}
