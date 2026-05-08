import { supabase } from '@/lib/supabase';

export default async function Home() {
  const { error } = await supabase.from('users').select('id').limit(1);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SetList Web</h1>
      {error ? (
        <p style={{ color: 'red' }}>Supabase error: {error.message}</p>
      ) : (
        <p style={{ color: 'green' }}>Supabase connected successfully!</p>
      )}
    </main>
  );
}
