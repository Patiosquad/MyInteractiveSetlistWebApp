'use client';

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';
import '../../../../tokens/tokens.css';

type SongWithTotal = {
  id: string;
  name: string;
  artist: string;
  album_art_url: string | null;
  total: number;
  earliest: string | null;
};

const ART_FALLBACK_GRADIENT = 'linear-gradient(135deg, var(--bg-tile-deep), var(--accent), var(--bg-tile))';

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
  const [concert, setConcert] = useState<{ performer_id: string } | null>(null);
  const [songs, setSongs] = useState<SongWithTotal[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<string, number>>(new Map());

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
          .select('total_amount, created_at')
          .eq('song_id', song.id)
          .eq('status', 'active');

        const total = (contribData ?? []).reduce((sum, c) => sum + (c.total_amount ?? 0), 0);
        const earliest = (contribData ?? []).reduce((min, c) => {
          if (!min) return c.created_at;
          return c.created_at < min ? c.created_at : min;
        }, null as string | null);
        return { ...song, total, earliest } as SongWithTotal;
      })
    );

    const ranked = withTotals
      .filter((s) => s.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        const aTime = a.earliest ? new Date(a.earliest).getTime() : Infinity;
        const bTime = b.earliest ? new Date(b.earliest).getTime() : Infinity;
        return aTime - bTime;
      })
      .slice(0, 10);

    setSongs(ranked);
  }, [concertId]);

  useEffect(() => {
    async function init() {
      const { data: concertData } = await supabase
        .from('concerts')
        .select('name, performer_id')
        .eq('id', concertId)
        .single();

      if (concertData) {
        setConcertName(concertData.name);
        setConcert(concertData);
      }
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

  useLayoutEffect(() => {
    const prev = prevPositions.current;
    const tiles = tileRefs.current;
    const newPositions = new Map<string, number>();
    tiles.forEach((el, id) => { newPositions.set(id, el.getBoundingClientRect().top); });
    tiles.forEach((el, id) => {
      const prevTop = prev.get(id);
      const newTop = newPositions.get(id);
      if (prevTop === undefined || newTop === undefined) return;
      const delta = prevTop - newTop;
      if (Math.abs(delta) < 1) return;
      const movingUp = delta > 0;
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      if (movingUp) {
        el.style.position = 'relative';
        el.style.zIndex = '10';
        el.style.boxShadow = '0 0 24px color-mix(in srgb, var(--gold) 35%, transparent)';
        el.style.backgroundColor = 'color-mix(in srgb, var(--gold) 15%, transparent)';
      } else {
        el.style.opacity = '0.5';
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = movingUp
            ? 'transform 650ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 650ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 650ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 650ms cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateY(0)';
          if (movingUp) {
            el.style.backgroundColor = 'transparent';
            setTimeout(() => {
              el.style.position = '';
              el.style.zIndex = '';
              el.style.boxShadow = '';
              el.style.backgroundColor = '';
            }, 700);
          } else {
            el.style.opacity = '1';
            setTimeout(() => { el.style.opacity = ''; }, 700);
          }
        });
      });
    });
    prevPositions.current = newPositions;
  }, [songs]);

  useEffect(() => {
    if (!concert?.performer_id) return;
    QRCode.toDataURL(concert.performer_id, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url: string) => setQrDataUrl(url));
  }, [concert?.performer_id]);

  const top = songs[0] ?? null;
  const rest = songs.slice(1); // ranks 2–9

  // ── Shared render helpers ──────────────────────────────────────────────────

  function renderEmptyState() {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)', color: 'var(--text-faint)', fontWeight: 600, animation: 'shimmer 3s ease-in-out infinite' }}>
          Waiting for fans to contribute...
        </p>
      </div>
    );
  }

  function renderSingleSongState() {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2vh 6vw', gap: '2vh' }}>
        <HeroSong song={top!} centered />
      </div>
    );
  }

  // Zone 1 — left hero panel, shared by top5 / top10 / top10grid
  function renderZone1(topSong: SongWithTotal) {
    return (
      <div style={{
        flex: '0 0 40%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '3vh 3vw 2vh',
        overflow: 'visible',
        borderRight: '1px solid var(--border)',
        position: 'relative',
      }}>
        {qrDataUrl && (
          <div style={{
            background: 'var(--bg-tile)',
            border: '1px solid color-mix(in srgb, var(--accent) 27%, transparent)',
            boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 15%, transparent)',
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '14px',
            width: '100%',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}>
            <img
              src={qrDataUrl}
              alt="QR Code"
              style={{
                width: 'clamp(70px, 8vw, 110px)',
                height: 'clamp(70px, 8vw, 110px)',
                background: 'white',
                borderRadius: '8px',
                padding: '4px',
                display: 'block',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: 'clamp(0.8rem, 1.1vw, 1.2rem)' }}>🎵</span>
                <p style={{ color: 'var(--text-primary)', fontSize: 'clamp(0.85rem, 1.2vw, 1.4rem)', fontWeight: 700, margin: 0 }}>SetTuner</p>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.7rem, 0.95vw, 1.1rem)', lineHeight: 1.5, margin: 0 }}>
                Is there a song you want to hear? Browse the full catalog and contribute to move it up the rankings! Scan to join the show.
              </p>
            </div>
          </div>
        )}

        <HeroSong song={topSong} centered={false} />
      </div>
    );
  }

  // Zone 2 tile — vertical ranked list, shared by top5 / top10
  function renderRankedTile(song: SongWithTotal, i: number) {
    const isTopRight = i < 2; // ranks 2–3
    const accentColorVar = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--accent)' : 'var(--border-subtle)';
    const rankColorVar = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--accent)' : 'var(--text-muted)';
    const borderWidth = isTopRight ? 4 : 1;
    const weight = isTopRight ? 2 : 1;

    const artSz  = isTopRight ? 'clamp(36px, 4.5vw, 68px)' : 'clamp(24px, 2.8vw, 46px)';
    const rankSz = isTopRight ? 'clamp(1.5rem, 2.8vw, 3.2rem)' : 'clamp(0.85rem, 1.4vw, 1.8rem)';
    const nameSz = isTopRight ? 'clamp(1.4rem, 2.5vw, 3rem)'   : 'clamp(0.9rem, 1.8vw, 2.2rem)';
    const artSz2 = isTopRight ? 'clamp(0.85rem, 1.35vw, 1.7rem)' : 'clamp(0.67rem, 1.0vw, 1.25rem)';
    const bg     = i % 2 === 0 ? 'color-mix(in srgb, var(--text-primary) 2%, transparent)' : 'transparent';

    return (
      <div
        key={`${song.id}-rank-${i}`}
        ref={(el) => { if (el) tileRefs.current.set(song.id, el); else tileRefs.current.delete(song.id); }}
        style={{
          flex: weight,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(0.6rem, 1.2vw, 1.5rem)',
          padding: '0 2vw',
          borderLeft: `${borderWidth}px solid ${accentColorVar}`,
          background: bg,
          overflow: 'hidden',
          animation: 'fade-in 0.35s ease both',
        }}
      >
        {/* Rank number */}
        <div style={{ flexShrink: 0, minWidth: isTopRight ? 'clamp(3.2rem, 5.5vw, 7rem)' : 'clamp(2rem, 3.2vw, 4.5rem)', textAlign: 'center' }}>
          <span style={{ fontSize: rankSz, fontWeight: 900, color: rankColorVar, lineHeight: 1 }}>
            {ordinal(i + 2)}
          </span>
        </div>

        {/* Album art */}
        {song.album_art_url
          ? <img src={song.album_art_url} alt="" style={{ width: artSz, height: artSz, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
          : <div style={{ width: artSz, height: artSz, borderRadius: 6, background: ART_FALLBACK_GRADIENT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>♫</span>
            </div>
        }

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: nameSz,
            fontWeight: isTopRight ? 800 : 600,
            color: 'var(--text-primary)',
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
            color: 'var(--text-secondary)',
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
  }

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--status-live-text); }
          50%       { opacity: 0.7; box-shadow: 0 0 24px var(--status-live-text); }
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
          background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
          color: 'var(--text-primary)',
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
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '1.8vh 4vw 1.2vh', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.3vh' }}>
            <h1 style={{ fontSize: 'clamp(1.1rem, 2.2vh, 2rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
              {concertName}
            </h1>
            <span style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'var(--status-live-bg)',
              color: 'var(--status-live-text)',
              fontSize: 'clamp(0.55rem, 0.9vh, 0.8rem)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              animation: 'pulse-live 2s ease-in-out infinite',
            }}>
              LIVE
            </span>
          </div>
          <p style={{ fontSize: 'clamp(0.65rem, 1vh, 0.95rem)', fontWeight: 700, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.06em' }}>
            SetTuner &nbsp;·&nbsp; Live music. Fan powered.
          </p>
        </div>

        {/* ── Main area ───────────────────────────────────────────────────── */}
        {layout === 'ambient' ? (

          /* ── AMBIENT LAYOUT ── */
          <div data-ambient="true" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row', padding: '3vh 5vw', gap: '3vw', alignItems: 'stretch', background: 'var(--bg-primary)' }}>

            {/* LEFT — QR Code (~30%), centered vertically */}
            <div style={{ flex: '0 0 28%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qrDataUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    style={{
                      width: 'clamp(120px, 14vw, 200px)',
                      height: 'clamp(120px, 14vw, 200px)',
                      background: 'white',
                      borderRadius: '8px',
                      padding: '4px',
                      display: 'block',
                    }}
                  />
                  <p style={{ color: 'var(--text-primary)', fontSize: 'clamp(0.9rem, 1.3vw, 1.2rem)', fontWeight: 700, margin: 0 }}>SetTuner</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.7rem, 1vw, 0.9rem)', margin: 0 }}>Scan to request a song</p>
                </div>
              )}
            </div>

            {/* RIGHT — Title + Song list (~70%) */}
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '1.5vh', overflow: 'hidden' }}>
              <p style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.05em', margin: 0, flexShrink: 0 }}>
                Tonight&apos;s Requests By You
              </p>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                {songs.slice(0, 10).map((song, i) => (
                  <div key={song.id} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem', background: 'color-mix(in srgb, var(--bg-tile) 50%, transparent)', borderRadius: 12, gap: '1rem', overflow: 'hidden' }}>
                    <span style={{ flexShrink: 0, minWidth: 'clamp(1.6rem, 2.2vw, 2.4rem)', textAlign: 'center', fontSize: 'clamp(0.8rem, 1.1vw, 1.1rem)', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {ordinal(i + 1)}
                    </span>
                    {song.album_art_url
                      ? <img src={song.album_art_url} alt="" style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 6, background: ART_FALLBACK_GRADIENT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>♫</span>
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'clamp(1rem, 2vw, 2.25rem)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.name}
                      </p>
                      <p style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.5rem)', color: 'var(--text-secondary)', margin: '0.25em 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        ) : layout === 'top5' ? (

          /* ── TOP 5 LAYOUT ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'clip', display: 'flex' }}>
            {songs.length === 0 ? (
              renderEmptyState()
            ) : songs.length === 1 ? (
              renderSingleSongState()
            ) : (
              <>
                {renderZone1(top!)}
                {/* RIGHT ZONE — ranks 2–5 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1vh 0' }}>
                  {rest.slice(0, 4).map((song, i) => renderRankedTile(song, i))}
                </div>
              </>
            )}
          </div>

        ) : layout === 'top10grid' ? (

          /* ── TOP 10 GRID LAYOUT (three-zone) ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'clip', display: 'flex' }}>
            {songs.length === 0 ? (
              renderEmptyState()
            ) : songs.length === 1 ? (
              renderSingleSongState()
            ) : (
              <>
                {renderZone1(top!)}

                {/* ZONE 2 — 2x2 quadrant grid, ranks 2–5 */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  gap: '1.2vh 1vw',
                  padding: '1.2vh 1vw',
                }}>
                  {rest.slice(0, 4).map((song, i) => {
                    const rankNum = i + 2;
                    const rankColorVar = i === 0 ? 'var(--gold)' : 'var(--text-primary)';
                    return (
                      <div
                        key={`${song.id}-quad-${i}`}
                        ref={(el) => { if (el) tileRefs.current.set(song.id, el); else tileRefs.current.delete(song.id); }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: 0,
                          minWidth: 0,
                          background: 'var(--bg-tile)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '12px',
                          padding: '0.6vh 0.7vw',
                          overflow: 'hidden',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: 'clamp(1.2rem, 2vw, 2.5rem)', fontWeight: 900, color: rankColorVar, padding: '0.5vh 0.75vw', lineHeight: 1 }}>
                          {ordinal(rankNum)}
                        </span>
                        {song.album_art_url
                          ? <img src={song.album_art_url} alt="" style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'cover', borderRadius: '8px' }} />
                          : <div style={{ width: '100%', flex: 1, minHeight: 0, borderRadius: '8px', background: ART_FALLBACK_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>♫</span>
                            </div>
                        }
                        <div style={{ marginTop: '0.6vh', minHeight: 0, overflow: 'hidden' }}>
                          <p style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.4rem)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                            {song.name}
                          </p>
                          <p style={{ fontSize: 'clamp(0.65rem, 1.05vw, 0.95rem)', color: 'var(--text-secondary)', margin: '0.2em 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {song.artist}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ZONE 3 — ranks 6–10 */}
                <div style={{ flex: '0 0 22%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1vh 0.5vw', borderLeft: '1px solid var(--border-subtle)', justifyContent: 'space-evenly' }}>
                  {rest.slice(4, 9).map((song, i) => {
                    const rankNum = i + 6;
                    const rankColorVar = rankNum === 2 ? 'var(--gold)' : 'var(--text-primary)';
                    return (
                      <div
                        key={`${song.id}-zone3-${i}`}
                        ref={(el) => { if (el) tileRefs.current.set(song.id, el); else tileRefs.current.delete(song.id); }}
                        style={{ display: 'flex', flexDirection: 'column', height: 'clamp(120px, 16vh, 200px)', padding: '0.4vh 0.5vw', gap: '0.3vh', flexShrink: 0 }}
                      >
                        <span style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.1rem)', fontWeight: 900, color: rankColorVar, lineHeight: 1 }}>
                          {ordinal(rankNum)}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, gap: '0.5vw', alignItems: 'center' }}>
                          {song.album_art_url
                            ? <img src={song.album_art_url} alt="" style={{ height: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                            : <div style={{ height: '100%', aspectRatio: '1', borderRadius: '6px', background: ART_FALLBACK_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>♫</span>
                              </div>
                          }
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2vh' }}>
                            <p style={{ fontSize: 'clamp(0.7rem, 1.1vw, 1rem)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                              {song.name}
                            </p>
                            <p style={{ fontSize: 'clamp(0.55rem, 0.85vw, 0.8rem)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {song.artist}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        ) : (

          /* ── TOP 10 LAYOUT (default) ── */
          <div style={{ flex: 1, minHeight: 0, overflow: 'clip', display: 'flex' }}>

            {songs.length === 0 ? (
              renderEmptyState()
            ) : songs.length === 1 ? (
              renderSingleSongState()
            ) : (
              <>
                {renderZone1(top!)}
                {/* RIGHT ZONE — ranks 2–9 (60%) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: '1vh 0',
                }}>
                  {rest.map((song, i) => renderRankedTile(song, i))}
                </div>
              </>
            )}
          </div>

        )}


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
      flex: 1,
      gap: '2vh',
      textAlign: 'center',
      width: '100%',
      overflow: 'visible',
      animation: 'fade-in 0.4s ease both',
    }}>

      {/* Label — above album art */}
      <span style={{
        fontSize: centered ? 'clamp(0.9rem, 1.4vw, 1.3rem)' : 'clamp(0.8rem, 1.1vw, 1.1rem)',
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}>
        Most Requested
      </span>

      {/* Album art with gold glow */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <div style={{
          position: 'absolute',
          inset: '-50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--gold) 20%, transparent) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        {song.album_art_url
          ? <img src={song.album_art_url} alt="" style={{
              width: centered ? artSize : 'min(100%, 28vh)',
              height: centered ? artSize : 'min(100%, 28vh)',
              borderRadius: 14,
              objectFit: 'cover',
              position: 'relative',
              boxShadow: '0 8px 40px color-mix(in srgb, var(--gold) 30%, transparent)',
            }} />
          : <div style={{ width: centered ? artSize : 'min(100%, 28vh)', height: centered ? artSize : 'min(100%, 28vh)', borderRadius: 14, background: ART_FALLBACK_GRADIENT, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>♫</span>
            </div>
        }
      </div>

      {/* Song name */}
      <p style={{
        fontSize: centered ? 'clamp(2rem, 4vw, 5rem)' : 'clamp(2.5rem, 5vw, 6.5rem)',
        fontWeight: 900,
        color: 'var(--text-primary)',
        margin: 0,
        paddingBottom: centered ? 0 : '0.15em',
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
        color: 'var(--text-secondary)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {song.artist}
      </p>

    </div>
  );
}
