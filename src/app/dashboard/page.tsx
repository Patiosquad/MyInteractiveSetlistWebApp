'use client';

import { useEffect, useRef, useState } from 'react';
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
  last_activity_at: string | null;
};

type FullConcert = {
  id: string;
  name: string;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  estimated_start: string | null;
  estimated_length: string | null;
  performer_id: string;
};

const STATUS_STYLES: Record<Concert['status'], { background: string; color: string; border?: string }> = {
  live:     { background: '#14532d', color: '#86efac' },
  building: { background: '#1e3a5f', color: '#93c5fd' },
  closed:   { background: '#3d0f0f', color: '#fca5a5', border: '1px solid #7f1d1d' },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.5rem',
  border: '1px solid #27272a',
  background: '#18181b',
  color: '#ffffff',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function DashboardPage() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [bandName, setBandName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Duplicate state
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [selectedConcertToDuplicate, setSelectedConcertToDuplicate] = useState<Concert | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [duplicateFormData, setDuplicateFormData] = useState<FullConcert | null>(null);
  const [newConcertName, setNewConcertName] = useState('');
  const [duplicateNameError, setDuplicateNameError] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  async function fetchConcerts(uid: string) {
    const { data } = await supabase
      .from('concerts')
      .select('id, name, venue_name, city, state, status, created_at, last_activity_at')
      .eq('performer_id', uid);

    const STATUS_ORDER: Record<string, number> = { live: 0, building: 1, closed: 2 };
    const sorted = (data ?? []).sort((a, b) => {
      const aRank = STATUS_ORDER[a.status] ?? 2;
      const bRank = STATUS_ORDER[b.status] ?? 2;
      if (aRank !== bRank) return aRank - bRank;
      if (a.status === 'closed') {
        const aTime = a.last_activity_at ?? a.created_at;
        const bTime = b.last_activity_at ?? b.created_at;
        return bTime.localeCompare(aTime);
      }
      return b.created_at.localeCompare(a.created_at);
    });
    setConcerts(sorted);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setUserId(user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      setBandName(userData?.username ?? '');

      await fetchConcerts(user.id);
      setLoading(false);
    }

    init();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleDuplicateConfirmed() {
    if (!selectedConcertToDuplicate) return;
    const { data } = await supabase
      .from('concerts')
      .select('*')
      .eq('id', selectedConcertToDuplicate.id)
      .single();

    setShowDuplicateConfirm(false);
    setDuplicateFormData(data as FullConcert);
    setNewConcertName('');
    setDuplicateNameError('');
    setShowDuplicateForm(true);
    setDuplicateMode(false);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  async function handleDuplicateSubmit() {
    if (!duplicateFormData || !userId) return;
    const trimmedName = newConcertName.trim();

    if (!trimmedName) {
      setDuplicateNameError('Concert name is required.');
      return;
    }
    if (concerts.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setDuplicateNameError('You already have a concert with this name.');
      return;
    }

    setDuplicating(true);
    setDuplicateNameError('');

    const { data: newConcert, error: concertError } = await supabase
      .from('concerts')
      .insert({
        name: trimmedName,
        venue_name: duplicateFormData.venue_name,
        city: duplicateFormData.city,
        state: duplicateFormData.state,
        country: duplicateFormData.country,
        estimated_start: duplicateFormData.estimated_start,
        estimated_length: duplicateFormData.estimated_length,
        status: 'building',
        performer_id: userId,
      })
      .select()
      .single();

    if (concertError || !newConcert) {
      setDuplicateNameError('Failed to create concert: ' + (concertError?.message ?? 'unknown error'));
      setDuplicating(false);
      return;
    }

    const { data: originalSongs } = await supabase
      .from('songs')
      .select('name, artist, album, album_art_url, spotify_track_id, decade, comments')
      .eq('concert_id', duplicateFormData.id);

    if (originalSongs && originalSongs.length > 0) {
      await supabase.from('songs').insert(
        originalSongs.map(s => ({ ...s, concert_id: newConcert.id, status: 'active' }))
      );
    }

    setDuplicating(false);
    setShowDuplicateForm(false);
    setDuplicateFormData(null);
    setNewConcertName('');
    await fetchConcerts(userId);
    setSuccessMessage(`"${trimmedName}" created with ${originalSongs?.length ?? 0} song${originalSongs?.length === 1 ? '' : 's'}.`);
    setTimeout(() => setSuccessMessage(''), 4000);
  }

  return (
    <>
      <style>{`
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0px rgba(167,139,250,0); }
          50%       { box-shadow: 0 0 12px rgba(167,139,250,0.8); }
        }
      `}</style>

      <div style={{ minHeight: '100vh' }}>
        {/* Header */}
        <header style={{
          borderBottom: '1px solid #27272a',
          padding: '1rem 2rem',
          position: 'relative',
        }}>
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Concerts</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => router.push('/profile')}
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
                Profile
              </button>
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
          </div>
          {bandName && (
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: '1rem', fontWeight: 600, color: '#ffffff', pointerEvents: 'none' }}>
              {bandName}
            </span>
          )}
        </header>

        {/* Main content */}
        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>

          {/* Action buttons */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => router.push('/concerts/new')}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  borderRadius: '0.75rem',
                  border: '2px dashed #3f3f46',
                  background: 'transparent',
                  color: '#a1a1aa',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.125rem', lineHeight: 1 }}>+</span>
                Create Concert
              </button>

              {!duplicateMode ? (
                <button
                  onClick={() => setDuplicateMode(true)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #3f3f46',
                    background: 'transparent',
                    color: '#a78bfa',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  ⧉ Duplicate a Concert
                </button>
              ) : (
                <button
                  onClick={() => setDuplicateMode(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #52525b',
                    background: 'transparent',
                    color: '#a1a1aa',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {duplicateMode && (
              <p style={{ textAlign: 'center', color: '#a78bfa', fontSize: '0.875rem', margin: '0.625rem 0 0' }}>
                Select a concert below to duplicate it
              </p>
            )}
          </div>

          {successMessage && (
            <p style={{ color: '#86efac', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '1.5rem', textAlign: 'center', margin: '0 0 1.5rem' }}>
              ✓ {successMessage}
            </p>
          )}

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
                    onClick={() => {
                      if (duplicateMode) {
                        setSelectedConcertToDuplicate(concert);
                        setShowDuplicateConfirm(true);
                      } else {
                        router.push(`/concerts/${concert.id}`);
                      }
                    }}
                    style={{
                      position: 'relative',
                      padding: '1.25rem 1.5rem',
                      borderRadius: '0.75rem',
                      border: duplicateMode ? '1px solid #a78bfa' : '1px solid #27272a',
                      background: '#18181b',
                      transition: duplicateMode ? 'none' : 'border-color 0.15s',
                      cursor: 'pointer',
                      animation: duplicateMode ? 'glowPulse 1.5s ease-in-out infinite' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!duplicateMode) (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46';
                    }}
                    onMouseLeave={(e) => {
                      if (!duplicateMode) (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a';
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
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

      {/* Duplicate confirmation dialog */}
      {showDuplicateConfirm && selectedConcertToDuplicate && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '440px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
              Duplicate Concert?
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              Are you sure you want to duplicate &ldquo;{selectedConcertToDuplicate.name}&rdquo;? The full song catalog will be copied.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #3f3f46',
                  background: 'transparent',
                  color: '#a1a1aa',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateConfirmed}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#a78bfa',
                  color: '#09090b',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate form modal */}
      {showDuplicateForm && duplicateFormData && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
          overflowY: 'auto',
          padding: '2rem',
        }}>
          <div style={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#e4e4e7', margin: '0 0 0.375rem' }}>
                New Concert Details
              </h2>
              <p style={{ color: '#71717a', fontSize: '0.875rem', margin: 0 }}>
                Duplicating from &ldquo;{duplicateFormData.name}&rdquo;
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                  Concert Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newConcertName}
                  onChange={(e) => { setNewConcertName(e.target.value); setDuplicateNameError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDuplicateSubmit(); }}
                  placeholder="Enter a new concert name…"
                  style={inputStyle}
                />
                {duplicateNameError && (
                  <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: '0.375rem 0 0' }}>
                    {duplicateNameError}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Venue Name</label>
                <input
                  type="text"
                  value={duplicateFormData.venue_name ?? ''}
                  onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, venue_name: e.target.value } : prev)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>City</label>
                  <input
                    type="text"
                    value={duplicateFormData.city ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, city: e.target.value } : prev)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>State</label>
                  <input
                    type="text"
                    value={duplicateFormData.state ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, state: e.target.value } : prev)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Country</label>
                <input
                  type="text"
                  value={duplicateFormData.country ?? ''}
                  onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, country: e.target.value } : prev)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Date / Start</label>
                  <input
                    type="text"
                    value={duplicateFormData.estimated_start ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, estimated_start: e.target.value } : prev)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Est. Length</label>
                  <input
                    type="text"
                    value={duplicateFormData.estimated_length ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, estimated_length: e.target.value } : prev)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => { setShowDuplicateForm(false); setDuplicateFormData(null); setNewConcertName(''); setDuplicateNameError(''); }}
                disabled={duplicating}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #3f3f46',
                  background: 'transparent',
                  color: '#a1a1aa',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  cursor: duplicating ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicateSubmit}
                disabled={duplicating}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: duplicating ? '#3f3f46' : '#a78bfa',
                  color: duplicating ? '#71717a' : '#09090b',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: duplicating ? 'not-allowed' : 'pointer',
                }}
              >
                {duplicating ? 'Creating…' : 'Create Concert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
