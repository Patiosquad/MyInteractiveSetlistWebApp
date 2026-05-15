'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SongWithTotal = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string | null;
  total: number;
  status: 'active' | 'played' | 'declined';
};

type Concert = {
  id: string;
  name: string;
  status: string;
  performer_id: string;
};

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

const rankAccent = (idx: number) => {
  if (idx === 0) return '#FFD700';
  if (idx === 1) return '#C0C0C0';
  if (idx === 2) return '#CD7F32';
  return '#3f3f46';
};

const backBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #27272a',
  background: 'transparent',
  color: '#a1a1aa',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

export default function LivePage() {
  const router = useRouter();
  const { id: concertId } = useParams<{ id: string }>();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [songs, setSongs] = useState<SongWithTotal[]>([]);
  const [catalog, setCatalog] = useState<SongWithTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notLive, setNotLive] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [endingConcert, setEndingConcert] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingDecline, setPendingDecline] = useState<SongWithTotal | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('concert_id', concertId)
      .order('created_at', { ascending: false });

    if (!songsData) return;

    const withTotals = await Promise.all(
      songsData.map(async (song) => {
        const { data: contribData } = await supabase
          .from('contributions')
          .select('amount')
          .eq('song_id', song.id)
          .in('status', ['pending', 'captured']);

        const total = (contribData ?? []).reduce((sum, c) => sum + (c.amount ?? 0), 0);
        return { ...song, total } as SongWithTotal;
      })
    );

    setCatalog([...withTotals]);
    const activeSongs = withTotals.filter((s) => s.status === 'active');
    activeSongs.sort((a, b) => b.total - a.total);
    setSongs(activeSongs.filter((s) => s.total > 0));
  }, [concertId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      setAccessToken(session?.access_token ?? null);

      const { data: concertData } = await supabase
        .from('concerts')
        .select('id, name, status, performer_id')
        .eq('id', concertId)
        .eq('performer_id', user.id)
        .single();

      if (!concertData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setConcert(concertData as Concert);

      if (concertData.status !== 'live') {
        setNotLive(true);
        setLoading(false);
        return;
      }

      await fetchLeaderboard();
      setLoading(false);
    }

    init();
  }, [concertId, router, fetchLeaderboard]);

  // Real-time subscriptions
  useEffect(() => {
    if (!concertId) return;

    const songsChannel = supabase
      .channel(`live-songs-${concertId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'songs', filter: `concert_id=eq.${concertId}` },
        () => fetchLeaderboard()
      )
      .subscribe();

    const contribChannel = supabase
      .channel(`live-contributions-${concertId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `concert_id=eq.${concertId}` },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(contribChannel);
    };
  }, [concertId, fetchLeaderboard]);

  async function callEdgeFunction(path: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed: ${(err as { message?: string }).message ?? res.statusText}`);
      return false;
    }
    return true;
  }

  async function handleAccept(song: SongWithTotal) {
    if (!confirm(`Accept "${song.name}" and charge all contributors?`)) return;
    setProcessingId(song.id);

    const ok = await callEdgeFunction('capture-payments', { songId: song.id, concertId });
    if (ok) {
      await supabase.from('concerts').update({ last_activity_at: new Date().toISOString() }).eq('id', concertId);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      setCatalog((prev) => prev.map((s) => s.id === song.id ? { ...s, status: 'played' } : s));
      setActionMessage(`✓ "${song.name}" accepted!`);
      setTimeout(() => setActionMessage(''), 3000);
    }
    setProcessingId(null);
  }

  async function handleDeclineConfirmed() {
    if (!pendingDecline) return;
    const song = pendingDecline;
    setPendingDecline(null);
    setProcessingId(song.id);

    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-payments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'decline', songId: song.id }),
      }
    ).catch(() => {});
    await supabase.from('songs').update({ status: 'declined' }).eq('id', song.id);
    await supabase.from('concerts').update({ last_activity_at: new Date().toISOString() }).eq('id', concertId);
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
    setCatalog((prev) => prev.map((s) => s.id === song.id ? { ...s, status: 'declined' } : s));
    setActionMessage(`"${song.name}" declined.`);
    setTimeout(() => setActionMessage(''), 3000);
    setProcessingId(null);
  }

  async function handleReactivate(song: SongWithTotal) {
    setReactivatingId(song.id);
    await supabase.from('contributions').delete().eq('song_id', song.id);
    await supabase.from('songs').update({ status: 'active' }).eq('id', song.id);
    await fetchLeaderboard();
    setReactivatingId(null);
  }

  async function handleEndConcertConfirmed() {
    setShowEndConfirm(false);
    setEndingConcert(true);

    const ok = await callEdgeFunction('cancel-payments', { mode: 'end_concert', concertId });
    if (ok) {
      await supabase
        .from('contributions')
        .delete()
        .eq('concert_id', concertId);

      router.push(`/concerts/${concertId}`);
    } else {
      setEndingConcert(false);
    }
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) return null;

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: '#a1a1aa' }}>Concert not found or you don&apos;t have access.</p>
        <button onClick={() => router.push('/dashboard')} style={backBtnStyle}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (notLive) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: '#a1a1aa' }}>This concert is not live.</p>
        <button onClick={() => router.push(`/concerts/${concertId}`)} style={backBtnStyle}>
          Back to Catalog
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #27272a', padding: '1rem 2rem', flexShrink: 0 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{concert?.name}</h1>
            <span style={{ padding: '0.2rem 0.625rem', borderRadius: '9999px', background: '#14532d', color: '#86efac', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              LIVE
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <button
              onClick={() => window.open(`/display/${concertId}`, '_blank')}
              style={{ ...backBtnStyle, color: '#e4e4e7', borderColor: '#3f3f46' }}
            >
              Open Display
            </button>
            <button onClick={() => router.push(`/concerts/${concertId}`)} style={backBtnStyle}>
              Back to Catalog
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, overflow: 'hidden',
          maxWidth: '1400px', width: '100%', margin: '0 auto',
          display: 'flex', flexDirection: 'column',
          padding: '0 2rem', boxSizing: 'border-box',
        }}>

          {actionMessage && (
            <p style={{ color: '#86efac', fontSize: '0.9375rem', fontWeight: 500, paddingTop: '1rem', flexShrink: 0, margin: 0 }}>
              {actionMessage}
            </p>
          )}

          {/* Two-column area */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '0', paddingTop: '1.5rem' }}>

            {/* LEFT: Leaderboard (55%) */}
            <div style={{ flex: 55, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingRight: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '1rem', flexShrink: 0 }}>
                Leaderboard
              </h2>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {songs.length === 0 ? (
                  <p style={{ color: '#52525b', textAlign: 'center', padding: '4rem 0', margin: 0 }}>
                    Waiting for fans to contribute...
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
                    {songs.map((song, idx) => {
                      const isProcessing = processingId === song.id;
                      const accent = rankAccent(idx);
                      return (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.875rem 1rem',
                            borderRadius: '0.75rem',
                            border: '1px solid #27272a',
                            borderLeft: `4px solid ${accent}`,
                            background: '#18181b',
                          }}
                        >
                          <div style={{ width: '2.25rem', flexShrink: 0, textAlign: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: accent }}>{ordinal(idx + 1)}</span>
                          </div>
                          {song.album_art_url
                            ? <img src={song.album_art_url} alt={song.album} width={48} height={48} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 48, height: 48, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: '#a1a1aa', fontSize: '0.8125rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '3.5rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e4e4e7' }}>${song.total.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                            <button
                              onClick={() => handleAccept(song)}
                              disabled={isProcessing}
                              style={{
                                padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                                background: isProcessing ? '#27272a' : '#16a34a',
                                color: isProcessing ? '#52525b' : '#ffffff',
                                fontSize: '0.8125rem', fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => setPendingDecline(song)}
                              disabled={isProcessing}
                              style={{
                                padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                                background: isProcessing ? '#27272a' : '#991b1b',
                                color: isProcessing ? '#52525b' : '#ffffff',
                                fontSize: '0.8125rem', fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Catalog (45%) */}
            <div style={{ flex: 45, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #27272a', paddingLeft: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '1rem', flexShrink: 0 }}>
                Catalog <span style={{ color: '#52525b', fontWeight: 400 }}>({catalog.length})</span>
              </h2>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {catalog.length === 0 ? (
                  <p style={{ color: '#52525b', textAlign: 'center', padding: '4rem 0', margin: 0 }}>
                    No songs in the catalog.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
                    {catalog.map((song) => {
                      const onLeaderboard = song.status === 'active' && song.total > 0;
                      const isInactive = song.status === 'played' || song.status === 'declined';
                      const isReactivating = reactivatingId === song.id;
                      return (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: '0.75rem',
                            border: '1px solid #27272a',
                            borderLeft: onLeaderboard ? '4px solid #6366f1' : isInactive ? '4px solid #3f3f46' : '1px solid #27272a',
                            background: '#18181b',
                            opacity: isInactive ? 0.7 : 1,
                          }}
                        >
                          {song.album_art_url
                            ? <img src={song.album_art_url} alt={song.album} width={44} height={44} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 44, height: 44, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: '#a1a1aa', fontSize: '0.75rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            {onLeaderboard && (
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#818cf8' }}>
                                ${song.total.toFixed(2)}
                              </span>
                            )}
                            {song.status === 'played' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#86efac', background: '#14532d', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Played
                              </span>
                            )}
                            {song.status === 'declined' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#f87171', background: '#7f1d1d', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Declined
                              </span>
                            )}
                            {isInactive && (
                              <button
                                onClick={() => handleReactivate(song)}
                                disabled={isReactivating}
                                style={{
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: '0.375rem',
                                  border: '1px solid #3f3f46',
                                  background: 'transparent',
                                  color: isReactivating ? '#52525b' : '#a1a1aa',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  cursor: isReactivating ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {isReactivating ? '…' : 'Reactivate'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* End Concert */}
          <div style={{ paddingTop: '1rem', paddingBottom: '1.5rem', flexShrink: 0 }}>
            <button
              onClick={() => setShowEndConfirm(true)}
              disabled={endingConcert}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: '1px solid #7f1d1d',
                background: 'transparent',
                color: endingConcert ? '#52525b' : '#f87171',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: endingConcert ? 'not-allowed' : 'pointer',
              }}
            >
              {endingConcert ? 'Ending Concert…' : 'End Concert'}
            </button>
          </div>

        </div>
      </div>

      {pendingDecline && (
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
            maxWidth: '420px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>
              Decline Song?
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              This will decline &ldquo;{pendingDecline.name}&rdquo; and release all contributions back to fans.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setPendingDecline(null)}
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
                onClick={handleDeclineConfirmed}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#991b1b',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndConfirm && (
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
            maxWidth: '420px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>
              End Concert?
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              This will end the concert and release all pending contributions for songs that were not played. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
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
                onClick={handleEndConcertConfirmed}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#991b1b',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                End Concert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
