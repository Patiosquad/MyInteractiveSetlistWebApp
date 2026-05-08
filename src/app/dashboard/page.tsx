'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Welcome to SetList Web</h1>
        <p style={{ color: '#a1a1aa' }}>Dashboard coming soon.</p>
        <button
          onClick={handleLogout}
          style={{
            marginTop: '1rem',
            padding: '0.625rem 1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #27272a',
            background: 'transparent',
            color: '#ffffff',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </main>
  );
}
