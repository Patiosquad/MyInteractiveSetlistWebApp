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
  status: 'building' | 'live' | 'closed';
  performer_id: string;
};

type Song = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string | null;
  status: 'active' | 'declined' | 'played';
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
  building: { background: '#1e3a5f', color: '#93c5fd' },
  closed:   { background: '#27272a', color: '#a1a1aa' },
};

const SONG_STATUS_COLOR: Record<Song['status'], string> = {
  active:   '#a1a1aa',
  played:   '#86efac',
  declined: '#f87171',
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

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedMessage, setAddedMessage] = useState('');

  const [goingLive, setGoingLive] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth + initial data load
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Authenticated user:', user);
      if (!user) { router.replace('/login'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      setAccessToken(session?.access_token ?? null);

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

    return () => { supabase.removeChannel(channel); };
  }, [concertId]);

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

  async function handleAddSong(track: SpotifyTrack) {
    const { data, error } = await supabase.from('songs').insert({
      concert_id: concertId,
      name: track.name,
      artist: track.artist,
      album: track.album,
      album_art_url: track.album_art_url,
      spotify_track_id: track.spotify_track_id,
      decade: track.decade,
      status: 'active',
    }).select();
    console.log('Insert result:', { data, error });
    if (error) {
      alert('Insert failed: ' + error.message);
      return;
    }

    if (data?.[0]) setSongs((prev) => [data[0], ...prev]);
    setQuery('');
    setSearchResults([]);
    setAddedMessage(`Added "${track.name}"`);
    setTimeout(() => setAddedMessage(''), 2500);
  }

  async function handleRemoveSong(songId: string, songName: string) {
    if (!confirm(`Remove "${songName}" from the catalog?`)) return;
    const { data, error } = await supabase.from('songs').delete().eq('id', songId).select();
    console.log('Delete result:', { data, error });
    if (error) {
      alert('Delete failed: ' + error.message);
      return;
    }

    setSongs((prev) => prev.filter((s) => s.id !== songId));
  }

  async function handleGoLive() {
    if (!concert) return;
    setGoingLive(true);

    await supabase
      .from('songs')
      .update({ status: 'active' })
      .eq('concert_id', concertId)
      .in('status', ['declined', 'played']);

    const { data } = await supabase
      .from('concerts')
      .update({ status: 'live' })
      .eq('id', concertId)
      .select('*')
      .single();

    if (data) setConcert(data);
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
  const isBuilding = c.status === 'building';

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
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Spotify — song title, artist…"
              style={inputStyle}
            />
            {addedMessage && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#86efac' }}>
                ✓ {addedMessage}
              </p>
            )}
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
                    onClick={() => handleAddSong(track)}
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
                      <p style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {track.name}
                      </p>
                      <p style={{ color: '#a1a1aa', fontSize: '0.8125rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {track.artist} · {track.album}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: '#3f3f46', flexShrink: 0 }}>+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Song list */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e4e4e7' }}>
            {isBuilding ? 'Catalog' : 'Songs'} {songs.length > 0 && <span style={{ color: '#52525b', fontWeight: 400 }}>({songs.length})</span>}
          </h2>

          {songs.length === 0 ? (
            <p style={{ color: '#52525b', textAlign: 'center', padding: '3rem 0' }}>
              No songs in the catalog yet.{isBuilding ? ' Search above to add your first song.' : ''}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {songs.map((song) => (
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
                    ? <img src={song.album_art_url} alt={song.album} width={60} height={60} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                    : <div style={{ width: 60, height: 60, borderRadius: '0.375rem', background: '#27272a', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {song.name}
                    </p>
                    <p style={{ color: '#a1a1aa', fontSize: '0.8125rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  ) : (
                    <span style={{
                      flexShrink: 0,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      color: SONG_STATUS_COLOR[song.status] ?? '#a1a1aa',
                    }}>
                      {song.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Go Live button */}
        {isBuilding && songs.length > 0 && (
          <div style={{ paddingBottom: '2rem' }}>
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
    </div>
  );
}
