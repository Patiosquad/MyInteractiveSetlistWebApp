'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Concert = {
  id: string;
  name: string;
  venue_name: string;
  city: string;
  state: string | null;
  country: string;
  estimated_start: string | null;
  estimated_length: string | null;
  status: 'new' | 'live' | 'closed';
  performer_id: string;
};

type Song = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string | null;
  status: 'active' | 'declined' | 'played' | 'accepted' | 'deactivated';
  created_at: string;
};

type SpotifyTrack = {
  spotify_track_id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string;
  decade: string | null;
};

const STATUS_BADGE: Record<Concert['status'], { background: string; color: string }> = {
  live:     { background: '#14532d', color: '#86efac' },
  new: { background: '#1e3a5f', color: '#93c5fd' },
  closed:   { background: '#27272a', color: '#a1a1aa' },
};

const SONG_STATUS_COLOR: Record<Song['status'], string> = {
  active:      '#a1a1aa',
  played:      '#86efac',
  accepted:    '#86efac',
  declined:    '#f87171',
  deactivated: '#52525b',
};

function concertSubtitle(c: Concert): string {
  const parts: string[] = [c.venue_name];
  const location = [c.city, c.state].filter(Boolean).join(', ');
  if (location) parts.push(location);
  if (c.estimated_start) parts.push(c.estimated_start);
  if (c.estimated_length) parts.push(c.estimated_length);
  return parts.join(' · ');
}

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

export default function ConcertPage() {
  const router = useRouter();
  const { id: concertId } = useParams<{ id: string }>();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [addMode, setAddMode] = useState<'spotify' | 'manual'>('spotify');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');

  const [pendingTrack, setPendingTrack] = useState<SpotifyTrack | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingArtist, setPendingArtist] = useState('');
  const [pendingAlbum, setPendingAlbum] = useState('');
  const [pendingComments, setPendingComments] = useState('');

  const [manualName, setManualName] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualAlbum, setManualAlbum] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [showEmergencyAddModal, setShowEmergencyAddModal] = useState(false);

  const [goingLive, setGoingLive] = useState(false);
  const [goLiveError, setGoLiveError] = useState('');
  const [bandName, setBandName] = useState('');
  const [pendingRemoveSong, setPendingRemoveSong] = useState<{ id: string, name: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth + initial data load
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Authenticated user:', user);
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
        .select('*')
        .eq('id', concertId)
        .eq('performer_id', user.id)
        .single();

      if (!concertData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setConcert(concertData);

      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .eq('concert_id', concertId)
        .order('created_at', { ascending: false });

      setSongs(songsData ?? []);
      setLoading(false);
    }

    init();
  }, [concertId, router]);

  // Real-time subscription
  useEffect(() => {
    if (!concertId) return;

    const channel = supabase
      .channel(`songs-${concertId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs', filter: `concert_id=eq.${concertId}` },
        async () => {
          const { data } = await supabase
            .from('songs')
            .select('*')
            .eq('concert_id', concertId)
            .order('created_at', { ascending: false });
          setSongs(data ?? []);
        }
      )
      .subscribe();

    const concertStatusChannel = supabase
      .channel(`concert-status-${concertId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'concerts', filter: `id=eq.${concertId}` },
        (payload) => {
          if ((payload.new as { status: string }).status === 'closed') {
            router.push('/dashboard');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(concertStatusChannel);
    };
  }, [concertId, router]);

  // Debounced Spotify search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!accessToken) return;
      setSearching(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/spotify-search`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query.trim() }),
          }
        );
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, accessToken]);

  function openAddModal(track: SpotifyTrack) {
    setPendingTrack(track);
    setPendingName(track.name);
    setPendingArtist(track.artist);
    setPendingAlbum(track.album);
    setPendingComments('');
  }

  function closeAddModal() {
    setPendingTrack(null);
  }

  function closeEmergencyModal() {
    setShowEmergencyAddModal(false);
    setQuery('');
    setSearchResults([]);
    setAddMode('spotify');
  }

  async function handleAddSong() {
    if (!pendingTrack) return;
    const { data, error } = await supabase.from('songs').insert({
      concert_id: concertId,
      name: pendingName.trim(),
      artist: pendingArtist.trim(),
      album: pendingAlbum.trim() || null,
      album_art_url: pendingTrack.album_art_url,
      spotify_track_id: pendingTrack.spotify_track_id,
      decade: pendingTrack.decade,
      comments: pendingComments.trim() || null,
      status: 'active',
    }).select();
    if (error) {
      alert('Insert failed: ' + error.message);
      return;
    }

    if (data?.[0]) setSongs((prev) => [data[0], ...prev]);
    closeAddModal();
    setShowEmergencyAddModal(false);
    setQuery('');
    setSearchResults([]);
    setAddedMessage(`Added "${pendingName.trim()}"`);
    setTimeout(() => setAddedMessage(''), 2500);
  }

  async function handleRemoveSong(songId: string, songName: string) {
    setPendingRemoveSong({ id: songId, name: songName });
    return;
  }

  async function handleRemoveSongConfirmed() {
    if (!pendingRemoveSong) return;
    const { id: songId, name: songName } = pendingRemoveSong;
    setPendingRemoveSong(null);
    const { data, error } = await supabase.from('songs').delete().eq('id', songId).select();
    console.log('Delete result:', { data, error });
    if (error) {
      alert('Delete failed: ' + error.message);
      return;
    }

    setSongs((prev) => prev.filter((s) => s.id !== songId));
  }

  async function handleManualAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manualName.trim() || !manualArtist.trim()) {
      setManualError('Song Name and Artist are required.');
      return;
    }
    setManualError('');
    setManualSubmitting(true);

    const { data, error } = await supabase.from('songs').insert({
      concert_id: concertId,
      name: manualName.trim(),
      artist: manualArtist.trim(),
      album: manualAlbum.trim() || null,
      album_art_url: null,
      spotify_track_id: null,
      status: 'active',
    }).select();

    setManualSubmitting(false);

    if (error) {
      setManualError('Failed to add song: ' + error.message);
      return;
    }

    if (data?.[0]) setSongs((prev) => [data[0], ...prev]);
    setManualName('');
    setManualArtist('');
    setManualAlbum('');
    setShowEmergencyAddModal(false);
    setAddedMessage(`Added "${manualName.trim()}"`);
    setTimeout(() => setAddedMessage(''), 2500);
  }

  async function handlePlay(song: Song) {
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'played' }).eq('id', song.id);
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, status: 'played' as const } : s));
    setProcessingId(null);
  }

  async function handleDeactivate(song: Song) {
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'deactivated' }).eq('id', song.id);
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, status: 'deactivated' as const } : s));
    setProcessingId(null);
  }

  async function handleReactivate(song: Song) {
    setReactivatingId(song.id);
    await supabase.from('songs').update({ status: 'active' }).eq('id', song.id);
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, status: 'active' as const } : s));
    setReactivatingId(null);
  }

  async function handleGoLive() {
    if (!concert) return;
    setGoLiveError('');
    setGoingLive(true);

    const { data: liveCheck } = await supabase
      .from('concerts')
      .select('id')
      .eq('performer_id', concert.performer_id)
      .eq('status', 'live')
      .neq('id', concertId)
      .limit(1);

    if (liveCheck && liveCheck.length > 0) {
      setGoLiveError('You already have a concert in progress. Please end your current live concert before starting a new one.');
      setGoingLive(false);
      return;
    }

    await supabase
      .from('contributions')
      .delete()
      .eq('concert_id', concertId)
      .eq('status', 'pending');

    await supabase
      .from('songs')
      .update({ status: 'active' })
      .eq('concert_id', concertId)
      .in('status', ['declined', 'played', 'accepted', 'deactivated']);

    const { data } = await supabase
      .from('concerts')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', concertId)
      .select('*')
      .single();

    if (data) {
      await supabase.from('concerts').update({ last_activity_at: new Date().toISOString() }).eq('id', concertId);
      setConcert(data);
    }
    setGoingLive(false);
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) return null;

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: '#a1a1aa' }}>Concert not found or you don&apos;t have access.</p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #27272a', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}
        >
          Back to My Concerts
        </button>
      </div>
    );
  }

  const c = concert!;
  const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.closed;
  const isBuilding = c.status === 'new' || c.status === 'closed';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #27272a', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{c.name}</h1>
                <span style={{
                  padding: '0.2rem 0.625rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  ...badge,
                }}>
                  {c.status}
                </span>
                {bandName && (
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
                    {bandName}
                  </span>
                )}
              </div>
              <p style={{ color: '#71717a', fontSize: '0.875rem' }}>{concertSubtitle(c)}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              {c.status === 'live' && (
                <button
                  onClick={() => router.push(`/concerts/${concertId}/live`)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#14532d',
                    color: '#86efac',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Go to Live View
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard')}
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
                Back to My Concerts
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Add Song panel — building only */}
        {isBuilding && (
          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e4e4e7' }}>
              Add a Song
            </h2>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => { setAddMode('spotify'); setManualError(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: addMode === 'spotify' ? '#ffffff' : '#333333',
                  color: addMode === 'spotify' ? '#000000' : '#aaaaaa',
                  fontWeight: 600,
                }}
              >
                Search Spotify
              </button>
              <button
                onClick={() => { setAddMode('manual'); setManualError(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: addMode === 'manual' ? '#ffffff' : '#333333',
                  color: addMode === 'manual' ? '#000000' : '#aaaaaa',
                  fontWeight: 600,
                }}
              >
                Add Manually
              </button>
            </div>

            {addedMessage && (
              <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#86efac' }}>
                ✓ {addedMessage}
              </p>
            )}

            {/* Spotify search */}
            {addMode === 'spotify' && (
              <>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Spotify — song title, artist…"
                  style={inputStyle}
                />
                {searching && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#71717a' }}>Searching…</p>
                )}
                {searchResults.length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #27272a',
                    overflow: 'hidden',
                  }}>
                    {searchResults.map((track, idx) => (
                      <button
                        key={track.spotify_track_id}
                        onClick={() => openAddModal(track)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.875rem',
                          padding: '0.75rem 1rem',
                          borderTop: idx === 0 ? 'none' : '1px solid #27272a',
                          background: 'transparent',
                          color: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#18181b'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        {track.album_art_url
                          ? <img src={track.album_art_url} alt={track.album} width={60} height={60} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                          : <div style={{ width: 60, height: 60, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '1.0rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {track.name}
                          </p>
                          <p style={{ color: '#ffffff', fontSize: '0.8rem', opacity: 0.6, marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {track.artist} · {track.album}
                          </p>
                        </div>
                        <span style={{ fontSize: '0.8125rem', color: '#3f3f46', flexShrink: 0 }}>+ Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Manual entry */}
            {addMode === 'manual' && (
              <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                    Song Name <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                    Artist <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={manualArtist}
                    onChange={(e) => setManualArtist(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                    Album
                  </label>
                  <input
                    type="text"
                    value={manualAlbum}
                    onChange={(e) => setManualAlbum(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                {manualError && (
                  <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>{manualError}</p>
                )}
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: manualSubmitting ? '#3f3f46' : '#ffffff',
                    color: manualSubmitting ? '#a1a1aa' : '#09090b',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: manualSubmitting ? 'not-allowed' : 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  {manualSubmitting ? 'Adding…' : 'Add Song'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* Song list */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
              {isBuilding ? 'Catalog' : 'Songs'} {songs.length > 0 && <span style={{ color: '#52525b', fontWeight: 400 }}>({songs.length})</span>}
            </h2>
            {c.status === 'live' && (
              <button
                onClick={() => setShowEmergencyAddModal(true)}
                style={{ backgroundColor: '#14532d', color: '#86efac', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer' }}
              >
                + Add Song
              </button>
            )}
          </div>

          {songs.length > 0 && (() => {
            const filteredSongs = songs.filter(s =>
              s.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
              s.artist.toLowerCase().includes(catalogSearch.toLowerCase())
            );
            return (
              <>
                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search songs and/or artists..."
                    style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: '#1c1c1e', border: '1px solid #3f3f46', borderRadius: 8, color: '#ffffff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {catalogSearch && (
                    <p style={{ fontSize: '0.8rem', color: '#52525b', marginTop: '0.375rem', marginBottom: 0 }}>
                      Showing {filteredSongs.length} of {songs.length}
                    </p>
                  )}
                </div>
                {filteredSongs.length === 0 ? (
                  <p style={{ color: '#52525b', textAlign: 'center', padding: '3rem 0' }}>
                    No songs match &ldquo;{catalogSearch}&rdquo;.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    padding: '0.875rem 1rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #27272a',
                    background: '#18181b',
                  }}
                >
                  {song.album_art_url
                    ? <img src={song.album_art_url} alt={song.album} width={68} height={68} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                    : <div style={{ width: 68, height: 68, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {song.name}
                    </p>
                    <p style={{ color: '#ffffff', fontSize: '1.15rem', opacity: 0.55, marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {song.artist} · {song.album}
                    </p>
                  </div>
                  {isBuilding ? (
                    <button
                      onClick={() => handleRemoveSong(song.id, song.name)}
                      title="Remove song"
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '1px solid #3f3f46',
                        background: 'transparent',
                        color: '#71717a',
                        fontSize: '1rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  ) : (() => {
                    const isProcessing = processingId === song.id;
                    const isReactivating = reactivatingId === song.id;
                    const isInactive = ['played', 'accepted', 'declined', 'deactivated'].includes(song.status);
                    if (song.status === 'active') {
                      return (
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
                      );
                    }
                    if (isInactive) {
                      return (
                        <button
                          onClick={() => handleReactivate(song)}
                          disabled={isReactivating}
                          style={{ flexShrink: 0, padding: '0.25rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #3f3f46', background: 'transparent', color: isReactivating ? '#52525b' : '#a1a1aa', fontSize: '0.75rem', fontWeight: 500, cursor: isReactivating ? 'not-allowed' : 'pointer' }}
                        >
                          {isReactivating ? '…' : 'Reactivate'}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {songs.length === 0 && (
            <p style={{ color: '#52525b', textAlign: 'center', padding: '3rem 0' }}>
              No songs in the catalog yet.{isBuilding ? ' Search above to add your first song.' : ''}
            </p>
          )}
        </section>

        {/* Go Live button */}
        {isBuilding && songs.length > 0 && (
          <div style={{ paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {goLiveError && (
              <p style={{ color: '#f87171', fontSize: '0.9375rem', margin: 0 }}>{goLiveError}</p>
            )}
            <button
              onClick={handleGoLive}
              disabled={goingLive}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: goingLive ? '#14532d80' : '#16a34a',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: goingLive ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {goingLive ? 'Going Live…' : '🎤 Go Live'}
            </button>
          </div>
        )}
      </main>

      {showEmergencyAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '520px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>Add a Song</h2>
              <button onClick={closeEmergencyModal} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem' }}>×</button>
            </div>
            {addedMessage && (
              <p style={{ fontSize: '0.875rem', color: '#86efac', margin: 0, flexShrink: 0 }}>✓ {addedMessage}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => { setAddMode('spotify'); setManualError(''); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: addMode === 'spotify' ? '#ffffff' : '#333333', color: addMode === 'spotify' ? '#000000' : '#aaaaaa', fontWeight: 600 }}>Search Spotify</button>
              <button onClick={() => { setAddMode('manual'); setManualError(''); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: addMode === 'manual' ? '#ffffff' : '#333333', color: addMode === 'manual' ? '#000000' : '#aaaaaa', fontWeight: 600 }}>Add Manually</button>
            </div>
            {addMode === 'spotify' && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotify — song title, artist…" style={inputStyle} />
                {searching && <p style={{ fontSize: '0.875rem', color: '#71717a', margin: 0 }}>Searching…</p>}
                {searchResults.length > 0 && (
                  <div style={{ borderRadius: '0.75rem', border: '1px solid #27272a', overflowY: 'auto', flex: 1 }}>
                    {searchResults.map((track, idx) => (
                      <button key={track.spotify_track_id} onClick={() => openAddModal(track)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem', borderTop: idx === 0 ? 'none' : '1px solid #27272a', background: 'transparent', color: '#ffffff', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#27272a'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
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
            {addMode === 'manual' && (
              <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Song Name <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Artist <span style={{ color: '#f87171' }}>*</span></label>
                  <input type="text" value={manualArtist} onChange={(e) => setManualArtist(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>Album</label>
                  <input type="text" value={manualAlbum} onChange={(e) => setManualAlbum(e.target.value)} style={inputStyle} />
                </div>
                {manualError && <p style={{ fontSize: '0.875rem', color: '#f87171', margin: 0 }}>{manualError}</p>}
                <button type="submit" disabled={manualSubmitting} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: manualSubmitting ? '#3f3f46' : '#ffffff', color: manualSubmitting ? '#a1a1aa' : '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: manualSubmitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
                  {manualSubmitting ? 'Adding…' : 'Add Song'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {pendingTrack && (
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
            maxWidth: '480px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>
                Add to Catalog
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', maxWidth: '200px', lineHeight: 1.4, margin: 0, textAlign: 'right', flexShrink: 0 }}>
                💡 Tip: Feel free to edit the fields above to remove unwanted tags like &lsquo;Live&rsquo;, &lsquo;Anniversary Edition&rsquo;, &lsquo;Collection&rsquo;, etc. before adding to your catalog.
              </p>
            </div>

            {/* Album art preview */}
            {pendingTrack.album_art_url && (
              <img
                src={pendingTrack.album_art_url}
                alt={pendingAlbum}
                width={80}
                height={80}
                style={{ borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }}
              />
            )}

            {/* Editable fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                  Song Name
                </label>
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                  Artist
                </label>
                <input
                  type="text"
                  value={pendingArtist}
                  onChange={(e) => setPendingArtist(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                  Album
                </label>
                <input
                  type="text"
                  value={pendingAlbum}
                  onChange={(e) => setPendingAlbum(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.375rem' }}>
                  Comments
                </label>
                <input
                  type="text"
                  value={pendingComments}
                  onChange={(e) => setPendingComments(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeAddModal}
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
                onClick={handleAddSong}
                disabled={!pendingName.trim() || !pendingArtist.trim()}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: !pendingName.trim() || !pendingArtist.trim() ? '#3f3f46' : '#ffffff',
                  color: !pendingName.trim() || !pendingArtist.trim() ? '#71717a' : '#09090b',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: !pendingName.trim() || !pendingArtist.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Add to Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRemoveSong && (
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
              Remove Song?
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Remove &ldquo;{pendingRemoveSong.name}&rdquo; from the catalog? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setPendingRemoveSong(null)}
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
                onClick={handleRemoveSongConfirmed}
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
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
