'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Concert = {
  id: string;
  name: string;
  venue_name: string;
  city: string;
  state: string;
  status: 'building' | 'live' | 'closed';
  created_at: string;
};

const STATUS_STYLES: Record<Concert['status'], { background: string; color: string }> = {
  live:     { background: '#14532d', color: '#86efac' },
  building: { background: '#1e3a5f', color: '#93c5fd' },
  closed:   { background: '#27272a', color: '#a1a1aa' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data } = await supabase
        .from('concerts')
        .select('id, name, venue_name, city, state, status, created_at')
        .eq('performer_id', user.id)
        .order('created_at', { ascending: false });

      setConcerts(data ?? []);
      setLoading(false);
    }

    init();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #27272a',
        padding: '1rem 2rem',
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Concerts</h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #27272a',
              background: 'transparent',
              color: '#a1a1aa',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        {/* Create Concert button */}
        <button
          style={{
            width: '100%',
            padding: '1rem',
            marginBottom: '2rem',
            borderRadius: '0.75rem',
            border: '2px dashed #3f3f46',
            background: 'transparent',
            color: '#a1a1aa',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
          Create Concert
        </button>

        {/* Concert list */}
        {loading ? null : concerts.length === 0 ? (
          <p style={{ color: '#71717a', textAlign: 'center', marginTop: '4rem' }}>
            No concerts yet. Create your first concert to get started!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {concerts.map((concert) => {
              const badge = STATUS_STYLES[concert.status] ?? STATUS_STYLES.closed;
              return (
                <div
                  key={concert.id}
                  style={{
                    position: 'relative',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #27272a',
                    background: '#18181b',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a';
                  }}
                >
                  {/* Status badge */}
                  <span style={{
                    position: 'absolute',
                    top: '1.25rem',
                    right: '1.5rem',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    ...badge,
                  }}>
                    {concert.status}
                  </span>

                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem', paddingRight: '6rem' }}>
                    {concert.name}
                  </h2>
                  <p style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
                    {concert.venue_name}
                    {concert.city || concert.state ? ` · ${[concert.city, concert.state].filter(Boolean).join(', ')}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
