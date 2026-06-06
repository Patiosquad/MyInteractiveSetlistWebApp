'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SongWithTotal = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string | null;
  total: number;
  status: 'active' | 'played' | 'accepted' | 'declined' | 'deactivated';
};

type SpotifyTrack = {
  spotify_track_id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string;
  decade: string | null;
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

const eaInputStyle: React.CSSProperties = {
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
  const [bandName, setBandName] = useState('');
  const [selectedLayout, setSelectedLayout] = useState<'top10' | 'top5' | 'ambient'>('top10');
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showEmergencyAddModal, setShowEmergencyAddModal] = useState(false);
  const [emergencyAddMode, setEmergencyAddMode] = useState<'spotify' | 'manual'>('spotify');
  const [emergencyQuery, setEmergencyQuery] = useState('');
  const [emergencyResults, setEmergencyResults] = useState<SpotifyTrack[]>([]);
  const [emergencySearching, setEmergencySearching] = useState(false);
  const [emergencyPendingTrack, setEmergencyPendingTrack] = useState<SpotifyTrack | null>(null);
  const [emergencyPendingName, setEmergencyPendingName] = useState('');
  const [emergencyPendingArtist, setEmergencyPendingArtist] = useState('');
  const [emergencyPendingAlbum, setEmergencyPendingAlbum] = useState('');
  const [emergencyManualName, setEmergencyManualName] = useState('');
  const [emergencyManualArtist, setEmergencyManualArtist] = useState('');
  const [emergencyManualAlbum, setEmergencyManualAlbum] = useState('');
  const [emergencyManualError, setEmergencyManualError] = useState('');
  const [emergencyManualSubmitting, setEmergencyManualSubmitting] = useState(false);

  const layoutDropdownRef = useRef<HTMLDivElement>(null);
  const emergencyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          .eq('status', 'pending');

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

      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      setBandName(userData?.username ?? '');

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

    const concertChannel = supabase
      .channel(`live-concert-${concertId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'concerts', filter: `id=eq.${concertId}` },
        (payload) => {
          if ((payload.new as { status: string }).status === 'closed') {
            router.push('/dashboard');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(contribChannel);
      supabase.removeChannel(concertChannel);
    };
  }, [concertId, fetchLeaderboard, router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(e.target as Node)) {
        setShowLayoutDropdown(false);
      }
    }
    if (showLayoutDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayoutDropdown]);

  useEffect(() => {
    if (!emergencyQuery.trim()) { setEmergencyResults([]); return; }
    if (emergencyDebounceRef.current) clearTimeout(emergencyDebounceRef.current);
    emergencyDebounceRef.current = setTimeout(async () => {
      if (!accessToken) return;
      setEmergencySearching(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/spotify-search`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: emergencyQuery.trim() }) }
        );
        if (res.ok) setEmergencyResults(await res.json());
      } finally {
        setEmergencySearching(false);
      }
    }, 300);
    return () => { if (emergencyDebounceRef.current) clearTimeout(emergencyDebounceRef.current); };
  }, [emergencyQuery, accessToken]);

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
    if (!confirm(`Accept "${song.name}" by ${song.artist} and charge all contributors?`)) return;
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
        body: JSON.stringify({ mode: 'decline', songId: song.id, concertId }),
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
    const ok = await callEdgeFunction('cancel-payments', { mode: 'decline', songId: song.id, concertId });
    if (!ok) { setReactivatingId(null); return; }
    await supabase.from('contributions').delete().eq('song_id', song.id);
    await supabase.from('songs').update({ status: 'active' }).eq('id', song.id);
    await fetchLeaderboard();
    setReactivatingId(null);
  }

  async function handlePlay(song: SongWithTotal) {
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'played' }).eq('id', song.id);
    await supabase.from('concerts').update({ last_activity_at: new Date().toISOString() }).eq('id', concertId);
    setSongs(prev => prev.filter(s => s.id !== song.id));
    setCatalog(prev => prev.map(s => s.id === song.id ? { ...s, status: 'played' as const } : s));
    setProcessingId(null);
  }

  async function handleDeactivate(song: SongWithTotal) {
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'deactivated' }).eq('id', song.id);
    setCatalog(prev => prev.map(s => s.id === song.id ? { ...s, status: 'deactivated' as const } : s));
    setProcessingId(null);
  }

  function closeEmergencyModal() {
    setShowEmergencyAddModal(false);
    setEmergencyQuery('');
    setEmergencyResults([]);
    setEmergencyPendingTrack(null);
    setEmergencyAddMode('spotify');
  }

  function openEmergencyTrack(track: SpotifyTrack) {
    setEmergencyPendingTrack(track);
    setEmergencyPendingName(track.name);
    setEmergencyPendingArtist(track.artist);
    setEmergencyPendingAlbum(track.album);
  }

  async function handleEmergencyAddSong() {
    if (!emergencyPendingTrack) return;
    const nameTrimmed = emergencyPendingName.trim();
    const { error } = await supabase.from('songs').insert({
      concert_id: concertId,
      name: nameTrimmed,
      artist: emergencyPendingArtist.trim(),
      album: emergencyPendingAlbum.trim() || null,
      album_art_url: emergencyPendingTrack.album_art_url,
      spotify_track_id: emergencyPendingTrack.spotify_track_id,
      decade: emergencyPendingTrack.decade,
      status: 'active',
    });
    if (error) { alert('Insert failed: ' + error.message); return; }
    await fetchLeaderboard();
    closeEmergencyModal();
    setActionMessage(`✓ Added "${nameTrimmed}"`);
    setTimeout(() => setActionMessage(''), 3000);
  }

  async function handleEmergencyManualAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emergencyManualName.trim() || !emergencyManualArtist.trim()) {
      setEmergencyManualError('Song Name and Artist are required.');
      return;
    }
    setEmergencyManualError('');
    setEmergencyManualSubmitting(true);
    const nameTrimmed = emergencyManualName.trim();
    const { error } = await supabase.from('songs').insert({
      concert_id: concertId,
      name: nameTrimmed,
      artist: emergencyManualArtist.trim(),
      album: emergencyManualAlbum.trim() || null,
      album_art_url: null,
      spotify_track_id: null,
      status: 'active',
    });
    setEmergencyManualSubmitting(false);
    if (error) { setEmergencyManualError('Failed to add song: ' + error.message); return; }
    await fetchLeaderboard();
    setEmergencyManualName('');
    setEmergencyManualArtist('');
    setEmergencyManualAlbum('');
    closeEmergencyModal();
    setActionMessage(`✓ Added "${nameTrimmed}"`);
    setTimeout(() => setActionMessage(''), 3000);
  }

  async function handleEndConcertConfirmed() {
    setShowEndConfirm(false);
    setEndingConcert(true);

    const ok = await callEdgeFunction('cancel-payments', { mode: 'end_concert', concertId });
    if (ok) {
      await supabase
        .from('concerts')
        .update({ status: 'closed', ended_at: new Date().toISOString() })
        .eq('id', concertId);

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

  const filteredCatalogSongs = catalog.filter(s =>
    s.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    s.artist.toLowerCase().includes(catalogSearch.toLowerCase())
  );

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
            {bandName && (
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
                {bandName}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <div ref={layoutDropdownRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', borderRadius: '0.5rem', border: '1px solid #3f3f46', overflow: 'hidden' }}>
                <button
                  onClick={() => window.open(`/display/${concertId}?layout=${selectedLayout}`, '_blank')}
                  style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#e4e4e7', fontSize: '0.875rem', cursor: 'pointer', border: 'none', borderRight: '1px solid #3f3f46' }}
                >
                  Open Display
                </button>
                <button
                  onClick={() => setShowLayoutDropdown(prev => !prev)}
                  style={{ padding: '0.5rem 0.625rem', background: 'transparent', color: '#e4e4e7', fontSize: '0.875rem', cursor: 'pointer', border: 'none', lineHeight: 1 }}
                >
                  ▾
                </button>
              </div>
              {showLayoutDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.5rem', minWidth: '220px', zIndex: 100, overflow: 'hidden' }}>
                  {([
                    { value: 'top10',   label: 'Top 10 Leaderboard' },
                    { value: 'top5',    label: 'Top 5 Leaderboard' },
                    { value: 'ambient', label: "Ambient — Tonight's Requests" },
                  ] as const).map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setSelectedLayout(option.value); setShowLayoutDropdown(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem 1rem', background: 'transparent', border: 'none', color: '#e4e4e7', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ width: '1rem', color: '#86efac' }}>{selectedLayout === option.value ? '✓' : ''}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.01em', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #3f3f46', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎵 Song Leaderboard
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
                            ? <img src={song.album_art_url} alt={song.album} width={56} height={56} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 56, height: 56, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: '#ffffff', fontSize: '1.15rem', opacity: 0.55, marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '3.5rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e4e4e7' }}>${Math.round(song.total)}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexShrink: 0 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
                  Catalog <span style={{ color: '#52525b', fontWeight: 400 }}>({catalog.length})</span>
                </h2>
                <button
                  onClick={() => setShowEmergencyAddModal(true)}
                  style={{ backgroundColor: '#14532d', color: '#86efac', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer' }}
                >
                  + Add Song
                </button>
              </div>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search songs and/or artists..."
                style={{ width: '100%', padding: '0.4rem 0.6rem', backgroundColor: '#1c1c1e', border: '1px solid #3f3f46', borderRadius: 6, color: '#ffffff', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', marginBottom: 8, flexShrink: 0 }}
              />
              {catalogSearch && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 8px', flexShrink: 0 }}>
                  Showing {filteredCatalogSongs.length} of {catalog.length}
                </p>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {catalog.length === 0 ? (
                  <p style={{ color: '#52525b', textAlign: 'center', padding: '4rem 0', margin: 0 }}>
                    No songs in the catalog.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
                    {filteredCatalogSongs.map((song) => {
                      const onLeaderboard = song.status === 'active' && song.total > 0;
                      const activeNoContrib = song.status === 'active' && song.total === 0;
                      const isInactive = ['played', 'accepted', 'declined', 'deactivated'].includes(song.status);
                      const isReactivating = reactivatingId === song.id;
                      const isProcessing = processingId === song.id;
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
                            ? <img src={song.album_art_url} alt={song.album} width={52} height={52} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 52, height: 52, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ fontWeight: 700, fontSize: '1.35rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: '#ffffff', fontSize: '1.1rem', opacity: 0.55, marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            {onLeaderboard && (
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#818cf8' }}>
                                ${Math.round(song.total)}
                              </span>
                            )}
                            {activeNoContrib && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                                <button
                                  onClick={() => handlePlay(song)}
                                  disabled={isProcessing}
                                  style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: 'none', background: isProcessing ? '#27272a' : '#16a34a', color: isProcessing ? '#52525b' : '#ffffff', fontSize: '0.75rem', fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
                                >
                                  Play
                                </button>
                                <button
                                  onClick={() => handleDeactivate(song)}
                                  disabled={isProcessing}
                                  style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #3f3f46', background: 'transparent', color: isProcessing ? '#52525b' : '#a1a1aa', fontSize: '0.75rem', fontWeight: 500, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
                                >
                                  Deactivate
                                </button>
                              </div>
                            )}
                            {song.status === 'played' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#86efac', background: '#14532d', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Played
                              </span>
                            )}
                            {song.status === 'accepted' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#86efac', background: '#14532d', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Accepted
                              </span>
                            )}
                            {song.status === 'declined' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#f87171', background: '#7f1d1d', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Declined
                              </span>
                            )}
                            {song.status === 'deactivated' && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#a1a1aa', background: '#27272a', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                                Deactivated
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

      {showEmergencyAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '520px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
            {emergencyPendingTrack ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => setEmergencyPendingTrack(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1rem', cursor: 'pointer', padding: '0.25rem' }}>←</button>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Add to Catalog</h2>
                  </div>
                  <button onClick={closeEmergencyModal} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem' }}>×</button>
                </div>
                {emergencyPendingTrack.album_art_url && (
                  <img src={emergencyPendingTrack.album_art_url} alt={emergencyPendingAlbum} width={80} height={80} style={{ borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', overflowY: 'auto', flex: 1 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Song Name</label>
                    <input type="text" value={emergencyPendingName} onChange={(e) => setEmergencyPendingName(e.target.value)} style={eaInputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Artist</label>
                    <input type="text" value={emergencyPendingArtist} onChange={(e) => setEmergencyPendingArtist(e.target.value)} style={eaInputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Album</label>
                    <input type="text" value={emergencyPendingAlbum} onChange={(e) => setEmergencyPendingAlbum(e.target.value)} style={eaInputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button onClick={() => setEmergencyPendingTrack(null)} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #3f3f46', background: 'transparent', color: '#a1a1aa', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleEmergencyAddSong} disabled={!emergencyPendingName.trim() || !emergencyPendingArtist.trim()} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: !emergencyPendingName.trim() || !emergencyPendingArtist.trim() ? '#3f3f46' : '#ffffff', color: !emergencyPendingName.trim() || !emergencyPendingArtist.trim() ? '#71717a' : '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: !emergencyPendingName.trim() || !emergencyPendingArtist.trim() ? 'not-allowed' : 'pointer' }}>Add to Catalog</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Add a Song</h2>
                  <button onClick={closeEmergencyModal} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem' }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => { setEmergencyAddMode('spotify'); setEmergencyManualError(''); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: emergencyAddMode === 'spotify' ? '#ffffff' : '#333333', color: emergencyAddMode === 'spotify' ? '#000000' : '#aaaaaa', fontWeight: 600 }}>Search Spotify</button>
                  <button onClick={() => { setEmergencyAddMode('manual'); setEmergencyManualError(''); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: emergencyAddMode === 'manual' ? '#ffffff' : '#333333', color: emergencyAddMode === 'manual' ? '#000000' : '#aaaaaa', fontWeight: 600 }}>Add Manually</button>
                </div>
                {emergencyAddMode === 'spotify' && (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input type="text" value={emergencyQuery} onChange={(e) => setEmergencyQuery(e.target.value)} placeholder="Search Spotify — song title, artist…" style={eaInputStyle} />
                    {emergencySearching && <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Searching…</p>}
                    {emergencyResults.length > 0 && (
                      <div style={{ borderRadius: '0.75rem', border: '1px solid #27272a', overflowY: 'auto', flex: 1 }}>
                        {emergencyResults.map((track, idx) => (
                          <button key={track.spotify_track_id} onClick={() => openEmergencyTrack(track)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem', borderTop: idx === 0 ? 'none' : '1px solid #27272a', background: 'transparent', color: '#ffffff', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#27272a'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                            {track.album_art_url ? <img src={track.album_art_url} alt={track.album} width={48} height={48} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{track.name}</p>
                              <p style={{ color: '#ffffff', fontSize: '0.8125rem', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>{track.artist} · {track.album}</p>
                            </div>
                            <span style={{ fontSize: '0.8125rem', color: '#3f3f46', flexShrink: 0 }}>+ Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {emergencyAddMode === 'manual' && (
                  <form onSubmit={handleEmergencyManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Song Name <span style={{ color: '#f87171' }}>*</span></label>
                      <input type="text" value={emergencyManualName} onChange={(e) => setEmergencyManualName(e.target.value)} style={eaInputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Artist <span style={{ color: '#f87171' }}>*</span></label>
                      <input type="text" value={emergencyManualArtist} onChange={(e) => setEmergencyManualArtist(e.target.value)} style={eaInputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Album</label>
                      <input type="text" value={emergencyManualAlbum} onChange={(e) => setEmergencyManualAlbum(e.target.value)} style={eaInputStyle} />
                    </div>
                    {emergencyManualError && <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>{emergencyManualError}</p>}
                    <button type="submit" disabled={emergencyManualSubmitting} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: emergencyManualSubmitting ? '#3f3f46' : '#ffffff', color: emergencyManualSubmitting ? '#a1a1aa' : '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: emergencyManualSubmitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
                      {emergencyManualSubmitting ? 'Adding…' : 'Add Song'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

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
              This will decline &ldquo;{pendingDecline.name}&rdquo; by {pendingDecline.artist} and release all contributions back to fans.
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
