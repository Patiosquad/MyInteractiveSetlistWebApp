'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../../../tokens/tokens.css';

type Concert = {
  id: string;
  name: string;
  venue_name: string;
  city: string;
  state: string;
  status: 'new' | 'preview' | 'live' | 'closed';
  created_at: string;
  last_activity_at: string | null;
  show_date: string | null;
  preview_started_at: string | null;
  auto_close_reason: string | null;
  auto_close_notification_seen: boolean | null;
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
  show_date: string | null;
  performer_id: string;
};

const STATUS_STYLES: Record<Concert['status'], { background: string; color: string }> = {
  live:     { background: '#3a120c', color: '#ff3b2e' },
  preview:  { background: '#2a150a', color: '#ffcf6b' },
  new:      { background: '#3a2408', color: '#ffb703' },
  closed:   { background: '#221a16', color: '#8a7566' },
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tile-deep)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.375rem',
};

const navBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tile)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  cursor: 'pointer',
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
  const [urgentPreviewCountdowns, setUrgentPreviewCountdowns] = useState<Record<string, string>>({});
  const [pendingAutoCloseNotification, setPendingAutoCloseNotification] = useState<{ id: string; name: string; reason: string } | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  async function fetchConcerts(uid: string) {
    const { data } = await supabase
      .from('concerts')
      .select('id, name, venue_name, city, state, status, created_at, last_activity_at, show_date, preview_started_at, auto_close_reason, auto_close_notification_seen')
      .eq('performer_id', uid);

    const STATUS_ORDER: Record<string, number> = { live: 0, preview: 1, new: 2, closed: 3 };
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
    showPendingAutoCloseNotifications(sorted);
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

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dashboard-concerts-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'concerts', filter: `performer_id=eq.${userId}` },
        () => fetchConcerts(userId)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    function updateUrgentCountdowns() {
      const next: Record<string, string> = {};
      concerts.forEach((c: any) => {
        if (c.status !== 'preview' || !c.preview_started_at) return;
        const startedAt = new Date(c.preview_started_at).getTime();
        const deadline = startedAt + 5 * 24 * 60 * 60 * 1000;
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          next[c.id] = 'Auto-closing soon';
          return;
        }
        const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
        if (totalHours < 24) {
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          next[c.id] = `${totalHours} hrs : ${minutes} min`;
        }
      });
      setUrgentPreviewCountdowns(next);
    }

    updateUrgentCountdowns();
    const interval = setInterval(updateUrgentCountdowns, 60 * 1000);
    return () => clearInterval(interval);
  }, [concerts]);

  function showPendingAutoCloseNotifications(allConcerts: any[]) {
    const pending = allConcerts.filter((c: any) => c.auto_close_reason && !c.auto_close_notification_seen);
    if (pending.length === 0) return;
    setPendingAutoCloseNotification({ id: pending[0].id, name: pending[0].name, reason: pending[0].auto_close_reason });
  }

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
        status: 'new',
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
          0%, 100% { box-shadow: 0 0 0px color-mix(in srgb, var(--accent) 0%, transparent); }
          50%       { box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 80%, transparent); }
        }
        .dash-input::placeholder { color: var(--text-faint); }
      `}</style>

      <div style={{ minHeight: '100vh' }}>
        {/* Header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '16px 24px',
          background: 'radial-gradient(ellipse at top right, rgba(255,90,31,0.06) 0%, transparent 60%), var(--bg-primary)',
        }}>
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
          }}>
            {/* LEFT ZONE — Brand lockup */}
            <div style={{
              flexShrink: 0,
              width: 'clamp(200px, 18vw, 240px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingRight: '24px',
              borderRight: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 'clamp(24px, 2.5vw, 36px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
                <span style={{ color: 'var(--text-primary)' }}>Set</span><span style={{ color: 'var(--accent)' }}>Tuner</span>
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginTop: '4px' }}>
                Live Music &middot; Fan Powered
              </span>
            </div>

            {/* RIGHT ZONE — Page identity */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <h1 style={{ fontSize: 'clamp(18px, 2vw, 28px)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                My Concerts
              </h1>
              {bandName && (
                <p style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  @{bandName}
                </p>
              )}
            </div>

            {/* FAR RIGHT — nav buttons */}
            <div style={{ flexShrink: 0, display: 'flex', gap: '8px', marginLeft: '24px' }}>
              <button
                onClick={() => router.push('/profile')}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                style={navBtnStyle}
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                style={navBtnStyle}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Ember baseline */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '3px',
            background: 'linear-gradient(to right, var(--accent), var(--gold))',
          }} />
        </header>

        {/* Main content */}
        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>

          {/* Action buttons */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => router.push('/concerts/new')}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--border)',
                  background: 'var(--bg-tile)',
                  color: 'var(--text-primary)',
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
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tile)',
                    color: 'var(--text-primary)',
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
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tile)',
                    color: 'var(--text-muted)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {duplicateMode && (
              <p style={{ textAlign: 'center', color: 'var(--accent)', fontSize: '13px', margin: '0.625rem 0 0' }}>
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
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-lg)',
                      border: duplicateMode ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: 'var(--bg-tile)',
                      transition: duplicateMode ? 'none' : 'border-color 0.15s, background-color 0.15s',
                      cursor: 'pointer',
                      animation: duplicateMode ? 'glowPulse 1.5s ease-in-out infinite' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!duplicateMode) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-tile-deep)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!duplicateMode) {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-tile)';
                      }
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      right: '1.5rem',
                      padding: '0.25rem 0.625rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      ...badge,
                    }}>
                      {concert.status === 'preview' ? 'Taking Requests!' : concert.status.toUpperCase()}
                    </span>
                      {concert.status === 'preview' && urgentPreviewCountdowns[concert.id] && (
                        <span style={{
                          position: 'absolute',
                          top: 'calc(50% + 1.5rem)',
                          right: '1.5rem',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: '#f87171',
                        }}>
                          {urgentPreviewCountdowns[concert.id]}
                        </span>
                      )}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.375rem', paddingRight: '6rem' }}>
                      {concert.name}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {concert.venue_name}
                      {concert.city || concert.state ? ` · ${[concert.city, concert.state].filter(Boolean).join(', ')}` : ''}
                      {concert.show_date ? ` · ${new Date(concert.show_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
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
          background: 'var(--bg-overlay-heavy)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: 'var(--bg-tile)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '440px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Duplicate Concert?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              Are you sure you want to duplicate &ldquo;{selectedConcertToDuplicate.name}&rdquo;? The full song catalog will be copied.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
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
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
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
          background: 'var(--bg-overlay-heavy)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
          overflowY: 'auto',
          padding: '2rem',
        }}>
          <div style={{
            background: 'var(--bg-tile)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                New Concert Details
              </h2>
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem', margin: 0 }}>
                Duplicating from &ldquo;{duplicateFormData.name}&rdquo;
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={labelStyle}>
                  Concert Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newConcertName}
                  onChange={(e) => { setNewConcertName(e.target.value); setDuplicateNameError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDuplicateSubmit(); }}
                  placeholder="Enter a new concert name…"
                  className="dash-input"
                  style={inputStyle}
                />
                {duplicateNameError && (
                  <p style={{ color: '#f87171', fontSize: '0.8125rem', margin: '0.375rem 0 0' }}>
                    {duplicateNameError}
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Venue Name</label>
                <input
                  type="text"
                  value={duplicateFormData.venue_name ?? ''}
                  onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, venue_name: e.target.value } : prev)}
                  className="dash-input"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>City</label>
                  <input
                    type="text"
                    value={duplicateFormData.city ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, city: e.target.value } : prev)}
                    className="dash-input"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>State</label>
                  <input
                    type="text"
                    value={duplicateFormData.state ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, state: e.target.value } : prev)}
                    className="dash-input"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <input
                  type="text"
                  value={duplicateFormData.country ?? ''}
                  onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, country: e.target.value } : prev)}
                  className="dash-input"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Date / Start</label>
                  <input
                    type="text"
                    value={duplicateFormData.estimated_start ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, estimated_start: e.target.value } : prev)}
                    className="dash-input"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Est. Length</label>
                  <input
                    type="text"
                    value={duplicateFormData.estimated_length ?? ''}
                    onChange={(e) => setDuplicateFormData(prev => prev ? { ...prev, estimated_length: e.target.value } : prev)}
                    className="dash-input"
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
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
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
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: duplicating ? 'var(--border)' : 'var(--accent)',
                  color: duplicating ? 'var(--text-faint)' : 'var(--text-primary)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: duplicating ? 'not-allowed' : 'pointer',
                }}
              >
                {duplicating ? 'Creating…' : 'Create Concert'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingAutoCloseNotification && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>&quot;{pendingAutoCloseNotification.name}&quot; Auto-Closed</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              {pendingAutoCloseNotification.reason === 'taking_requests_expired'
                ? 'Taking Requests was automatically ended after 5 days with no activity.'
                : pendingAutoCloseNotification.reason === 'live_max_duration'
                ? 'This concert was automatically ended after reaching the 12-hour live limit.'
                : pendingAutoCloseNotification.reason === 'live_inactivity'
                ? 'This concert was automatically ended after 3 hours with no activity.'
                : 'This concert was automatically ended.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  await supabase
                    .from('concerts')
                    .update({ auto_close_notification_seen: true })
                    .eq('id', pendingAutoCloseNotification.id);
                  const remaining = concerts.filter(
                    (c: any) => c.auto_close_reason && !c.auto_close_notification_seen && c.id !== pendingAutoCloseNotification.id
                  );
                  if (remaining.length > 0) {
                    setPendingAutoCloseNotification({ id: remaining[0].id, name: remaining[0].name, reason: remaining[0].auto_close_reason! });
                  } else {
                    setPendingAutoCloseNotification(null);
                  }
                }}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#ffffff', color: '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
