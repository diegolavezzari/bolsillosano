  // ===== Conexión con Supabase =====
const enLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';
let SUPABASE_URL = 'https://mxxawlvsslldklauffcg.supabase.co';
let SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14eGF3bHZzc2xsZGtsYXVmZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTA1NjQsImV4cCI6MjEwOTc2NjU2NH0.fsVjSypAMTZL8FxDafPOItzomwVw6rqcrayXH7u0BqY';   // ← la key real que ya tenés, sin cambiar
if (enLocal) {
    SUPABASE_URL = 'http://127.0.0.1:54321';
    SUPABASE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
}
const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);