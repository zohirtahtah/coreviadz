const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://yuuqxprqvlqvoyoltwiw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc2MDAxOSwiZXhwIjoyMDk2MzM2MDE5fQ.F6nS2MZtoI6vSd7LAMWZA1wky2nsKqIi1gRfdZTnTHU'
);
// Try to sign in with Google - if we get "provider not enabled", we know for sure
supabase.auth.signInWithOAuth({ provider: 'google' }).then(({ data, error }) => {
  if (error) {
    console.log('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success:', JSON.stringify(data, null, 2));
  }
}).catch(e => console.log('Exception:', e.message));
