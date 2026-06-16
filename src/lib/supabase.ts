import { createClient } from '@supabase/supabase-js';


// Initialize database client.
// Reads from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) so the
// project can be re-pointed at a different backend without code changes.
// Falls back to the original databasepad.com project so the app keeps
// working out of the box if no .env file is provided.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://dmldlxuetpjwpgnwvtgw.databasepad.com';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijc1YTNhMTllLTM0ODgtNDA1ZC05NGJmLWJkMzk2ZjE0Zjg5NSJ9.eyJwcm9qZWN0SWQiOiJkbWxkbHh1ZXRwandwZ253dnRndyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc5NDQ2NzExLCJleHAiOjIwOTQ4MDY3MTEsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.ze_jaDNut-yixYgc4c051B2YJr1Ql3rZ91ApagsvG54';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };