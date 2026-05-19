'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type SongWithTotal = {
  id: string;
  name: string;
  artist: string;
  album_art_url: string | null;
  total: number;
};

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function rankColor(idx: number): string {
  return RANK_COLORS[idx] ?? '#ffffff';
}

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

export default function DisplayPage() {
  const { id: concertId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const layout = searchParams.get('layout') ?? 'top10';

  const [concertName, setConcertName] = useState('');
  const [songs, setSongs] = useState<SongWithTotal[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  const fetchLeaderboard = useCallback(async () => {
    const { data: songsData } = await supabase
      .from('songs')
      .select('id, name, artist, album_art_url')
      .eq('concert_id', concertId)
      .eq('status', 'active');

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

    const ranked = withTotals
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    setSongs(ranked);
  }, [concertId]);

  useEffect(() => {
    async function init() {
      const { data: concertData } = await supabase
        .from('concerts')
        .select('name')
        .eq('id', concertId)
        .single();

      if (concertData) setConcertName(concertData.name);
      await fetchLeaderboard();
    }

    init();
  }, [concertId, fetchLeaderboard]);

  // Real-time subscriptions
  useEffect(() => {
    if (!concertId) return;

    const songsChannel = supabase
      .channel(`display-songs-${concertId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'songs', filter: `concert_id=eq.${concertId}` },
        () => fetchLeaderboard()
      )
      .subscribe();

    const contribChannel = supabase
      .channel(`display-contributions-${concertId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(contribChannel);
    };
  }, [concertId, fetchLeaderboard]);

  const top = songs[0] ?? null;
  const rest = songs.slice(1); // ranks 2–9

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #16a34a; }
          50%       { opacity: 0.7; box-shadow: 0 0 24px #16a34a; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.75; }
        }
      `}</style>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 50,
          padding: '8px 12px',
          borderRadius: '6px',
          border: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: '#ffffff',
          fontSize: '1.1rem',
          lineHeight: 1,
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}
      >
        {isFullscreen ? '⤡' : '⤢'}
      </button>

      <div style={{
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '1.8vh 4vw 1.2vh', textAlign: 'center', borderBottom: '1px solid #111' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.3vh' }}>
            <h1 style={{ fontSize: 'clamp(1.1rem, 2.2vh, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {concertName}
            </h1>
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: '#14532d',
              color: '#86efac',
              fontSize: 'clamp(0.55rem, 0.9vh, 0.8rem)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              animation: 'pulse-live 2s ease-in-out infinite',
            }}>
              LIVE
            </span>
          </div>
          <p style={{ fontSize: 'clamp(0.65rem, 1vh, 0.95rem)', fontWeight: 700, color: '#71717a', margin: 0, letterSpacing: '0.06em' }}>
            SetList &nbsp;·&nbsp; Live music. Fan powered.
          </p>
        </div>

        {/* ── Main area ───────────────────────────────────────────────────── */}
        {layout === 'ambient' ? (

          /* ── AMBIENT LAYOUT ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row', padding: '3vh 5vw', gap: '3vw', alignItems: 'stretch' }}>

            {/* LEFT — QR Code (~30%) */}
            <div style={{ flex: '0 0 28%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 150, height: 150, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
                QR Code
              </div>
            </div>

            {/* RIGHT — Title + Song list (~70%) */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1.5vh', overflow: 'hidden' }}>
              <p style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)', fontWeight: 300, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em', margin: 0, flexShrink: 0 }}>
                Tonight&apos;s Requests By You
              </p>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                {songs.slice(0, 10).map((song) => (
                  <div key={song.id} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, gap: '1rem', overflow: 'hidden' }}>
                    {song.album_art_url
                      ? <img src={song.album_art_url} alt="" style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 6, background: '#1e1e1e', flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'clamp(1rem, 2vw, 2.25rem)', fontWeight: 400, color: '#f4f4f5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.name}
                      </p>
                      <p style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.5rem)', color: '#71717a', margin: '0.25em 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.artist}
                      </p>
                    </div>
                    <span style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1.25rem)', color: '#a78bfa', fontWeight: 500, flexShrink: 0 }}>
                      ${song.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        ) : layout === 'top5' ? (

          /* ── TOP 5 LAYOUT ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'clip', display: 'flex' }}>
            {songs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: '#3f3f46', fontWeight: 600, animation: 'shimmer 3s ease-in-out infinite' }}>
                  Waiting for fans to contribute...
                </p>
              </div>
            ) : songs.length === 1 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2vh 6vw', gap: '2vh' }}>
                <HeroSong song={top!} centered />
              </div>
            ) : (
              <>
                {/* LEFT ZONE — rank 1 hero */}
                <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3vh 3vw 2vh', overflow: 'visible', borderRight: '1px solid #161616', position: 'relative' }}>
                  <HeroSong song={top!} centered={false} />
                </div>
                {/* RIGHT ZONE — ranks 2–5 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1vh 0' }}>
                  {rest.slice(0, 4).map((song, i) => {
                    const isTopRight = i < 2;
                    const borderColor = i === 0 ? '#FFD700' : i === 1 ? '#CD7F32' : '#2a2a2a';
                    const nameColor   = i === 0 ? '#FFD700' : i === 1 ? '#CD7F32' : '#e4e4e7';
                    const artistColor = i < 2 ? 'rgba(255,255,255,1.0)' : 'rgba(255,255,255,0.85)';
                    const weight      = isTopRight ? 2 : 1;
                    const artSz  = isTopRight ? 'clamp(42px, 5.2vw, 78px)'    : 'clamp(28px, 3.2vw, 53px)';
                    const rankSz = isTopRight ? 'clamp(1.75rem, 3.2vw, 3.7rem)' : 'clamp(1.0rem, 1.6vw, 2.1rem)';
                    const nameSz = isTopRight ? 'clamp(1.6rem, 2.9vw, 3.5rem)'  : 'clamp(1.0rem, 2.1vw, 2.5rem)';
                    const artSz2 = isTopRight ? 'clamp(1.0rem, 1.55vw, 1.95rem)' : 'clamp(0.77rem, 1.15vw, 1.44rem)';
                    const bg     = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent';
                    return (
                      <div
                        key={`${song.id}-top5-${i}`}
                        style={{ flex: weight, minHeight: 0, display: 'flex', alignItems: 'center', gap: 'clamp(0.6rem, 1.2vw, 1.5rem)', padding: '0 2vw', borderLeft: `4px solid ${borderColor}`, background: bg, overflow: 'hidden', animation: 'fade-in 0.35s ease both' }}
                      >
                        <div style={{ flexShrink: 0, minWidth: isTopRight ? 'clamp(3.2rem, 5.5vw, 7rem)' : 'clamp(2rem, 3.2vw, 4.5rem)', textAlign: 'center' }}>
                          <span style={{ fontSize: rankSz, fontWeight: 900, color: borderColor, lineHeight: 1 }}>{ordinal(i + 2)}</span>
                        </div>
                        {song.album_art_url
                          ? <img src={song.album_art_url} alt="" style={{ width: artSz, height: artSz, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                          : <div style={{ width: artSz, height: artSz, borderRadius: 6, background: '#1e1e1e', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: nameSz, fontWeight: isTopRight ? 800 : 600, color: nameColor, margin: 0, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: isTopRight ? '-0.01em' : 0 }}>
                            {song.name}
                          </p>
                          <p style={{ fontSize: artSz2, color: artistColor, margin: '0.15em 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {song.artist}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        ) : (

          /* ── TOP 10 LAYOUT (default) — unchanged ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'clip', display: 'flex' }}>

            {songs.length === 0 ? (
              /* ── Empty state ── */
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{
                  fontSize: 'clamp(1rem, 2.5vw, 2rem)',
                  color: '#3f3f46',
                  fontWeight: 600,
                  animation: 'shimmer 3s ease-in-out infinite',
                }}>
                  Waiting for fans to contribute...
                </p>
              </div>

            ) : songs.length === 1 ? (
              /* ── Single song — centered full width ── */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2vh 6vw', gap: '2vh' }}>
                <HeroSong song={top!} centered />
              </div>

            ) : (
              /* ── Two-zone split layout ── */
              <>
                {/* LEFT ZONE — rank 1 hero (40%) */}
                <div style={{
                  flex: '0 0 40%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3vh 3vw 2vh',
                  overflow: 'visible',
                  borderRight: '1px solid #161616',
                  position: 'relative',
                }}>
                  <HeroSong song={top!} centered={false} />
                </div>

                {/* RIGHT ZONE — ranks 2–9 (60%) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: '1vh 0',
                }}>
                  {rest.map((song, i) => {
                    const isTopRight = i < 2; // ranks 2–3
                    const borderColor = i === 0 ? '#FFD700' : i === 1 ? '#CD7F32' : '#2a2a2a';
                    const nameColor   = i === 0 ? '#FFD700' : i === 1 ? '#CD7F32' : '#e4e4e7';
                    const artistColor = i < 2 ? 'rgba(255,255,255,1.0)' : 'rgba(255,255,255,0.85)';
                    const weight      = isTopRight ? 2 : 1;

                    const artSz  = isTopRight ? 'clamp(36px, 4.5vw, 68px)' : 'clamp(24px, 2.8vw, 46px)';
                    const rankSz = isTopRight ? 'clamp(1.5rem, 2.8vw, 3.2rem)' : 'clamp(0.85rem, 1.4vw, 1.8rem)';
                    const nameSz = isTopRight ? 'clamp(1.4rem, 2.5vw, 3rem)'   : 'clamp(0.9rem, 1.8vw, 2.2rem)';
                    const artSz2 = isTopRight ? 'clamp(0.85rem, 1.35vw, 1.7rem)' : 'clamp(0.67rem, 1.0vw, 1.25rem)';
                    const bg     = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent';

                    return (
                      <div
                        key={`${song.id}-right-${i}`}
                        style={{
                          flex: weight,
                          minHeight: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'clamp(0.6rem, 1.2vw, 1.5rem)',
                          padding: `0 2vw`,
                          borderLeft: `4px solid ${borderColor}`,
                          background: bg,
                          overflow: 'hidden',
                          animation: 'fade-in 0.35s ease both',
                        }}
                      >
                        {/* Rank number */}
                        <div style={{ flexShrink: 0, minWidth: isTopRight ? 'clamp(3.2rem, 5.5vw, 7rem)' : 'clamp(2rem, 3.2vw, 4.5rem)', textAlign: 'center' }}>
                          <span style={{ fontSize: rankSz, fontWeight: 900, color: borderColor, lineHeight: 1 }}>
                            {ordinal(i + 2)}
                          </span>
                        </div>

                        {/* Album art */}
                        {song.album_art_url
                          ? <img src={song.album_art_url} alt="" style={{ width: artSz, height: artSz, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                          : <div style={{ width: artSz, height: artSz, borderRadius: 6, background: '#1e1e1e', flexShrink: 0 }} />
                        }

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: nameSz,
                            fontWeight: isTopRight ? 800 : 600,
                            color: nameColor,
                            margin: 0,
                            lineHeight: 1.1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            letterSpacing: isTopRight ? '-0.01em' : 0,
                          }}>
                            {song.name}
                          </p>
                          <p style={{
                            fontSize: artSz2,
                            color: artistColor,
                            margin: '0.15em 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {song.artist}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: '1.2vh 4vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #111',
        }}>
          <p style={{ color: '#2e2e2e', fontSize: 'clamp(0.55rem, 1vh, 0.9rem)', margin: 0 }}>
            Open SetList on your phone to contribute and influence the setlist!
          </p>
          <div style={{
            width: 'clamp(44px, 6vh, 64px)',
            height: 'clamp(44px, 6vh, 64px)',
            borderRadius: '0.4rem',
            border: '1px solid #1e1e1e',
            background: '#111',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 'clamp(0.4rem, 0.65vh, 0.6rem)', color: '#3f3f46', textAlign: 'center', lineHeight: 1.3 }}>Scan<br />to join</span>
          </div>
        </div>

      </div>
    </>
  );
}

// ── Hero component for rank 1 ────────────────────────────────────────────────

function HeroSong({ song, centered }: { song: SongWithTotal; centered: boolean }) {
  const artSize = centered ? 'clamp(140px, 18vw, 240px)' : 'clamp(110px, 13vw, 200px)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2vh',
      textAlign: 'center',
      width: '100%',
      overflow: 'visible',
      animation: 'fade-in 0.4s ease both',
    }}>

      {/* Rank ordinal — above album art */}
      <span style={{
        fontSize: centered ? 'clamp(3.5rem, 7vw, 9rem)' : 'clamp(3rem, 6vw, 8rem)',
        fontWeight: 900,
        color: '#FFD700',
        lineHeight: 1,
        letterSpacing: '-0.03em',
        userSelect: 'none',
        paddingBottom: '0.5vh',
      }}>
        1st
      </span>

      {/* Album art with gold glow */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <div style={{
          position: 'absolute',
          inset: '-50%',
          background: 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        {song.album_art_url
          ? <img src={song.album_art_url} alt="" style={{
              width: artSize,
              height: artSize,
              borderRadius: 14,
              objectFit: 'cover',
              position: 'relative',
              boxShadow: '0 8px 40px rgba(255,215,0,0.3)',
            }} />
          : <div style={{ width: artSize, height: artSize, borderRadius: 14, background: '#1a1a1a', position: 'relative' }} />
        }
      </div>

      {/* Song name */}
      <p style={{
        fontSize: centered ? 'clamp(2rem, 4vw, 5rem)' : 'clamp(2rem, 4.5vw, 5.5rem)',
        fontWeight: 900,
        color: '#FFD700',
        margin: 0,
        lineHeight: 1.05,
        letterSpacing: '-0.02em',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        maxWidth: '100%',
      } as React.CSSProperties}>
        {song.name}
      </p>

      {/* Artist */}
      <p style={{
        fontSize: centered ? 'clamp(1rem, 2vw, 2.5rem)' : 'clamp(1rem, 2.2vw, 2.75rem)',
        color: 'rgba(255,215,0,1.0)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {song.artist}
      </p>

      {/* Call to action */}
      <div style={{
        padding: 'clamp(0.4rem, 0.8vh, 0.75rem) clamp(0.75rem, 1.5vw, 1.5rem)',
        borderRadius: '9999px',
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(4px)',
        maxWidth: '92%',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 'clamp(0.7rem, 1.2vw, 1.3rem)',
          color: '#ffffff',
          margin: 0,
          lineHeight: 1.4,
          fontWeight: 500,
        }}>
          🎵 Open <strong style={{ color: '#FFD700' }}>SetList</strong> on your phone — request your song or contribute to an existing one to move it up the rankings!
        </p>
      </div>
    </div>
  );
}
