'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../../../../../tokens/tokens.css';

type SongWithTotal = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art_url: string | null;
  total: number;
  earliest: string | null;
  comments: string | null;
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
  started_at: string | null;
  preview_started_at: string | null;
  last_activity_at: string | null;
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

const rankAccent = (idx: number) => (idx === 0 ? 'var(--gold)' : 'var(--text-muted)');

const backBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #27272a',
  background: 'transparent',
  color: '#a1a1aa',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const navBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tile)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const quietLinkStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
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
  const [trackerAccepted, setTrackerAccepted] = useState(0);
  const [trackerPending, setTrackerPending] = useState(0);
  const [trackerTotal, setTrackerTotal] = useState(0);
  const [endConcertStep, setEndConcertStep] = useState<'none' | 'summary' | 'confirm' | 'processing' | 'outcome'>('none');
  const endConcertStepRef = useRef<'none' | 'summary' | 'confirm' | 'processing' | 'outcome'>('none');
  useEffect(() => { endConcertStepRef.current = endConcertStep; }, [endConcertStep]);
  const [endConcertOutcome, setEndConcertOutcome] = useState<{ kind: 'success' | 'partial' | 'error'; message: string } | null>(null);
  const [pendingDecline, setPendingDecline] = useState<SongWithTotal | null>(null);
  const [pendingAccept, setPendingAccept] = useState<SongWithTotal | null>(null);
  const [manageStep, setManageStep] = useState<'none' | 'choice' | 'confirmPlayed'>('none');
  const [managingSong, setManagingSong] = useState<SongWithTotal | null>(null);
  const [bandName, setBandName] = useState('');
  const [selectedLayout, setSelectedLayout] = useState<'top10' | 'top10grid' | 'top5' | 'ambient'>('top10');
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showConcertOptionsDropdown, setShowConcertOptionsDropdown] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSortMode, setCatalogSortMode] = useState<'default' | 'song' | 'artist'>('default');
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
  const [shownMaxDurationWarning, setShownMaxDurationWarning] = useState(false);
  const [shownInactivityWarning, setShownInactivityWarning] = useState(false);
  const [showMaxDurationWarningModal, setShowMaxDurationWarningModal] = useState(false);
  const [showInactivityWarningModal, setShowInactivityWarningModal] = useState(false);

  const layoutDropdownRef = useRef<HTMLDivElement>(null);
  const concertOptionsDropdownRef = useRef<HTMLDivElement>(null);
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

    setCatalog([...withTotals]);
    const activeSongs = withTotals.filter((s) => s.status === 'active');
    activeSongs.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const aTime = a.earliest ? new Date(a.earliest).getTime() : Infinity;
      const bTime = b.earliest ? new Date(b.earliest).getTime() : Infinity;
      return aTime - bTime;
    });
    setSongs(activeSongs.filter((s) => s.total > 0));
  }, [concertId]);

  const fetchContributionTracker = useCallback(async () => {
    const cycleBoundary = concert?.preview_started_at ?? concert?.started_at;

    let query = supabase
      .from('contributions')
      .select('total_amount, status')
      .eq('concert_id', concertId)
      .in('status', ['active', 'accepted']);

    if (cycleBoundary) {
      query = query.gte('created_at', cycleBoundary);
    } else {
      console.warn('[fetchContributionTracker] No cycle boundary on concert state for', concertId, '- showing unscoped totals as fallback.');
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[fetchContributionTracker] query error for', concertId, error.message);
      return;
    }
    if (!data) return;
    const pending = data.filter((c: any) => c.status === 'active').reduce((sum: number, c: any) => sum + Number(c.total_amount), 0);
    const accepted = data.filter((c: any) => c.status === 'accepted').reduce((sum: number, c: any) => sum + Number(c.total_amount), 0);
    setTrackerPending(pending);
    setTrackerAccepted(accepted);
    setTrackerTotal(pending + accepted);
  }, [concertId, concert?.started_at, concert?.preview_started_at]);

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
        .select('id, name, status, performer_id, started_at, preview_started_at, last_activity_at')
        .eq('id', concertId)
        .eq('performer_id', user.id)
        .single();

      if (!concertData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setConcert(concertData as Concert);

      if (concertData.status !== 'live' && concertData.status !== 'preview') {
        setNotLive(true);
        setLoading(false);
        return;
      }

      await fetchLeaderboard();
      await fetchContributionTracker();
      setLoading(false);
    }

    init();
  }, [concertId, router, fetchLeaderboard, fetchContributionTracker]);

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
        () => { fetchLeaderboard(); fetchContributionTracker(); }
      )
      .subscribe();

    const concertChannel = supabase
      .channel(`live-concert-${concertId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'concerts', filter: `id=eq.${concertId}` },
        (payload) => {
          setConcert(payload.new as Concert);
          // If we are the one who just closed this concert via the End Concert flow,
          // our own outcome modal and dismissEndConcertOutcome() handle navigation once
          // the performer dismisses it. Don't let this listener race ahead and yank them
          // away before they've seen the result.
          if (
            (payload.new as { status: string }).status === 'closed' &&
            endConcertStepRef.current === 'none'
          ) {
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
  }, [concertId, fetchLeaderboard, fetchContributionTracker, router]);

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
    function handleClickOutsideConcertOptions(e: MouseEvent) {
      if (concertOptionsDropdownRef.current && !concertOptionsDropdownRef.current.contains(e.target as Node)) {
        setShowConcertOptionsDropdown(false);
      }
    }
    if (showConcertOptionsDropdown) document.addEventListener('mousedown', handleClickOutsideConcertOptions);
    return () => document.removeEventListener('mousedown', handleClickOutsideConcertOptions);
  }, [showConcertOptionsDropdown]);

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

  useEffect(() => {
    if (!concert?.started_at || concert.status !== 'live') return;

    function checkWarnings() {
      const now = Date.now();
      const startedAt = new Date(concert!.started_at!).getTime();
      const lastActivity = new Date(concert!.last_activity_at ?? concert!.started_at!).getTime();

      const maxDurationExpiresAt = startedAt + 12 * 60 * 60 * 1000;
      const inactivityExpiresAt = lastActivity + 3 * 60 * 60 * 1000;
      const thirtyMinutes = 30 * 60 * 1000;

      if (!shownMaxDurationWarning && maxDurationExpiresAt - now <= thirtyMinutes && maxDurationExpiresAt - now > 0) {
        setShownMaxDurationWarning(true);
        setShowMaxDurationWarningModal(true);
      }

      if (!shownInactivityWarning && inactivityExpiresAt - now <= thirtyMinutes && inactivityExpiresAt - now > 0) {
        setShownInactivityWarning(true);
        setShowInactivityWarningModal(true);
      }
    }

    checkWarnings();
    const interval = setInterval(checkWarnings, 60 * 1000);
    return () => clearInterval(interval);
  }, [concert?.started_at, concert?.last_activity_at, concert?.status, shownMaxDurationWarning, shownInactivityWarning]);

  useEffect(() => {
    setShownInactivityWarning(false);
  }, [concert?.last_activity_at]);

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
    setPendingAccept(song);
    return;
  }

  async function handleAcceptConfirmed() {
    if (!pendingAccept) return;
    const song = pendingAccept;
    setPendingAccept(null);
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
        body: JSON.stringify({ songId: song.id, concertId }),
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
    const ok = await callEdgeFunction('cancel-payments', { songId: song.id, concertId });
    if (!ok) { setReactivatingId(null); return; }
    await supabase.from('contributions').delete().eq('song_id', song.id);
    await supabase.from('songs').update({ status: 'active' }).eq('id', song.id);
    await fetchLeaderboard();
    setReactivatingId(null);
  }

  async function handleSetNotAvailable() {
    if (!managingSong) return;
    const song = managingSong;
    setManageStep('none');
    setManagingSong(null);
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'deactivated' }).eq('id', song.id);
    setCatalog(prev => prev.map(s => s.id === song.id ? { ...s, status: 'deactivated' as const } : s));
    setProcessingId(null);
  }

  async function handleMarkAsPlayed() {
    if (!managingSong) return;
    const song = managingSong;
    setManageStep('none');
    setManagingSong(null);
    setProcessingId(song.id);
    await supabase.from('songs').update({ status: 'played' }).eq('id', song.id);
    setSongs(prev => prev.filter(s => s.id !== song.id));
    setCatalog(prev => prev.map(s => s.id === song.id ? { ...s, status: 'played' as const } : s));
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
    setEndConcertStep('processing');
    setEndingConcert(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/end-concert`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ concertId }),
        }
      );
      const result = await res.json().catch(() => ({}));
      setEndingConcert(false);

      if (!res.ok || result.error) {
        setEndConcertOutcome({
          kind: 'error',
          message: (result.message || result.error || 'Failed to end concert.') + ' Please check the concert status, and try again or contact support if it persists.',
        });
        setEndConcertStep('outcome');
        return;
      }

      const failedCaptures = result.failedCaptures ?? 0;
      if (failedCaptures > 0) {
        setEndConcertOutcome({
          kind: 'partial',
          message: `${failedCaptures} fan payment(s) could not be processed and will need manual follow-up. View the full breakdown anytime in your Concert Earnings & History.`,
        });
      } else {
        setEndConcertOutcome({
          kind: 'success',
          message: 'Payments have been processed. View the full breakdown anytime in your Concert Earnings & History.',
        });
      }
      setEndConcertStep('outcome');
    } catch (err: unknown) {
      setEndingConcert(false);
      setEndConcertOutcome({
        kind: 'error',
        message: (err instanceof Error ? err.message : 'Something went wrong.') + ' Please check the concert status, and try again or contact support if it persists.',
      });
      setEndConcertStep('outcome');
    }
  }

  function dismissEndConcertOutcome() {
    setEndConcertStep('none');
    router.push(`/concerts/${concertId}`);
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

  const sortedCatalogSongs = [...filteredCatalogSongs].sort((a, b) => {
    if (catalogSortMode === 'song') return a.name.localeCompare(b.name);
    if (catalogSortMode === 'artist') return a.artist.localeCompare(b.artist);
    return 0;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  const isPreview = concert?.status === 'preview';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <style>{`
        .live-catalog-search::placeholder { color: var(--text-faint); }
        .live-catalog-scroll::-webkit-scrollbar { width: 8px; }
        .live-catalog-scroll::-webkit-scrollbar-track { background: var(--bg-tile); }
        .live-catalog-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: var(--radius-pill); }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border-subtle)', padding: '1rem 2rem', flexShrink: 0 }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{concert?.name}</h1>
            {isPreview ? (
              <span style={{ padding: '0.2rem 0.625rem', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--status-preview-bg)', color: 'var(--status-preview-text)' }}>
                Taking Requests!
              </span>
            ) : (
              <span style={{ padding: '0.2rem 0.625rem', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--status-live-bg)', color: 'var(--status-live-text)' }}>
                LIVE
              </span>
            )}
            {bandName && (
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                {bandName}
              </span>
            )}
            {trackerTotal > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fan Contributions</div>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'baseline', background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accepted <strong style={{ display: 'block', color: 'var(--gold)', fontSize: '30px', fontWeight: 700 }}>${Math.round(trackerAccepted)}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending <strong style={{ display: 'block', color: 'var(--accent)', fontSize: '30px', fontWeight: 700 }}>${Math.round(trackerPending)}</strong></span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '34px', fontWeight: 700 }}>${Math.round(trackerTotal)}</strong></span>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <div ref={layoutDropdownRef} style={{ position: 'relative' }}>
              {!isPreview && (
                <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => window.open(`/display/${concertId}?layout=${selectedLayout}`, '_blank')}
                    onMouseEnter={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-tile)', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer', border: 'none', borderRight: '1px solid var(--border-subtle)' }}
                  >
                    Open Display
                  </button>
                  <button
                    onClick={() => setShowLayoutDropdown(prev => !prev)}
                    onMouseEnter={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                    style={{ padding: '0.5rem 0.625rem', background: 'var(--bg-tile)', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer', border: 'none', lineHeight: 1 }}
                  >
                    ▾
                  </button>
                </div>
              )}
              {showLayoutDropdown && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.5rem', minWidth: '220px', zIndex: 100, overflow: 'hidden' }}>
                  {([
                    { value: 'top10',     label: 'Top 10 Leaderboard' },
                    { value: 'top10grid', label: 'Top 10 Grid' },
                    { value: 'top5',      label: 'Top 5 Leaderboard' },
                    { value: 'ambient',   label: "Ambient — Tonight's Requests" },
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
              <div ref={concertOptionsDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowConcertOptionsDropdown(prev => !prev)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  style={navBtnStyle}
                >
                  Concert Options ▾
                </button>
                {showConcertOptionsDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.5rem', minWidth: '180px', zIndex: 100, overflow: 'hidden' }}>
                    <button
                      onClick={() => { setShowConcertOptionsDropdown(false); setEndConcertStep('summary'); }}
                      style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.625rem 1rem', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left' }}
                    >
                      End Concert
                    </button>
                  </div>
                )}
              </div>
            <button
              onClick={() => router.push(`/profile?returnTo=/concerts/${concertId}/live`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              style={navBtnStyle}
            >
              Profile
            </button>
            <button
              onClick={() => router.push(`/concerts/${concertId}`)}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              style={quietLinkStyle}
            >
              Back to Catalog
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, overflow: 'hidden',
          width: '100%',
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
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.01em', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎵 Song Leaderboard
              </h2>
              {isPreview && (
                <p style={{ color: 'var(--gold)', fontSize: '0.8125rem', fontStyle: 'italic', textAlign: 'center', margin: '0 0 0.75rem', padding: '0.5rem', background: 'var(--bg-tile-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  Songs cannot be accepted until the show goes live
                </p>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
                {songs.length === 0 ? (
                  <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '4rem 0', margin: 0, fontStyle: 'italic' }}>
                    Waiting for fans to contribute...
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' }}>
                    {songs.map((song, idx) => {
                      const isProcessing = processingId === song.id;
                      const accent = rankAccent(idx);
                      const isTopRank = idx === 0;
                      return (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '12px 16px 12px 20px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border)',
                            borderLeft: isTopRank ? '3px solid var(--gold)' : '3px solid var(--border)',
                            background: 'var(--bg-tile)',
                            boxShadow: isTopRank ? '0 0 0 2px var(--gold)' : 'none',
                          }}
                        >
                          <div style={{ width: '2.25rem', flexShrink: 0, textAlign: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: accent }}>{ordinal(idx + 1)}</span>
                          </div>
                          {song.album_art_url
                            ? <img src={song.album_art_url} alt={song.album} width={56} height={56} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 56, height: 56, borderRadius: '0.375rem', background: 'linear-gradient(135deg, #1a0a0a, #2e1065, #1e1b4b, #1e3a5f, #134e4a, #052e16, #0a0a0a)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.25rem', color: '#71717a' }}>♫</span>
                              </div>
                          }
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ fontWeight: 600, fontSize: '1.5rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                            {song.comments && (
                              <span style={{ fontSize: '0.875rem' }}>📝</span>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '3.5rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>${Math.round(song.total)}</span>
                          </div>
                          {!isPreview && (
                          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                            <button
                              onClick={() => handleAccept(song)}
                              disabled={isProcessing}
                              style={{
                                padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: 'none',
                                background: isProcessing ? 'var(--border)' : 'var(--success)',
                                color: isProcessing ? 'var(--text-faint)' : 'var(--text-primary)',
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
                                padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
                                border: isProcessing ? '1px solid var(--border)' : '1px solid var(--danger)',
                                background: 'transparent',
                                color: isProcessing ? 'var(--text-faint)' : 'var(--danger)',
                                fontSize: '0.8125rem', fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Decline
                            </button>
                          </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Catalog (45%) */}
            <div style={{ flex: 45, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexShrink: 0 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Catalog <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({catalog.length})</span>
                </h2>
                <button
                  onClick={() => setShowEmergencyAddModal(true)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
                  style={{ background: 'transparent', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', cursor: 'pointer' }}
                >
                  + Add Song
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexShrink: 0 }}>
                {(['default', 'song', 'artist'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCatalogSortMode(mode)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      border: catalogSortMode === mode ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      background: catalogSortMode === mode ? 'var(--accent)' : 'var(--bg-tile)',
                      color: catalogSortMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    {mode === 'default' ? 'Default' : mode === 'song' ? 'Song A-Z' : 'Artist A-Z'}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search songs and/or artists..."
                className="live-catalog-search"
                style={{ width: '100%', padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', marginBottom: 8, flexShrink: 0 }}
              />
              {catalogSearch && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 8px', flexShrink: 0 }}>
                  Showing {filteredCatalogSongs.length} of {catalog.length}
                </p>
              )}
              <div className="live-catalog-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {catalog.length === 0 ? (
                  <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '4rem 0', margin: 0 }}>
                    No songs in the catalog.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
                    {sortedCatalogSongs.map((song) => {
                      const onLeaderboard = song.status === 'active' && song.total > 0;
                      const activeNoContrib = song.status === 'active' && song.total === 0;
                      const isInactive = ['declined', 'deactivated'].includes(song.status);
                      const isPlayed = song.status === 'played';
                      const isReactivating = reactivatingId === song.id;
                      const isProcessing = processingId === song.id;
                      return (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '12px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border)',
                            borderLeft: onLeaderboard ? '3px solid var(--accent)' : isInactive ? '4px solid var(--border)' : '1px solid var(--border)',
                            background: 'var(--bg-tile)',
                            opacity: isPlayed ? 0.5 : isInactive ? 0.7 : 1,
                          }}
                        >
                          {song.album_art_url
                            ? <img src={song.album_art_url} alt={song.album} width={52} height={52} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} />
                            : <div style={{ width: 52, height: 52, borderRadius: '0.375rem', background: 'linear-gradient(135deg, #1a0a0a, #2e1065, #1e1b4b, #1e3a5f, #134e4a, #052e16, #0a0a0a)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.25rem', color: '#71717a' }}>♫</span>
                              </div>
                          }
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <p style={{ fontWeight: 600, fontSize: '1.35rem', color: isPlayed ? 'var(--text-muted)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {song.name}
                            </p>
                            <p style={{ color: isPlayed ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 0 }}>
                              {song.artist}
                            </p>
                            {song.comments && (
                              <span style={{ fontSize: '0.875rem' }}>📝</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            {onLeaderboard && (
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>
                                ${Math.round(song.total)}
                              </span>
                            )}
                            {activeNoContrib && (
                              <button
                                onClick={() => { setManagingSong(song); setManageStep('choice'); }}
                                disabled={isProcessing}
                                onMouseEnter={(e) => { if (!isProcessing) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent)'; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = isProcessing ? 'var(--text-faint)' : 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                style={{ padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tile-deep)', color: isProcessing ? 'var(--text-faint)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
                              >
                                Manage
                              </button>
                            )}
                            {song.status === 'played' && (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-closed-text)', background: 'var(--status-closed-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-pill)' }}>
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
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#a1a1aa', textAlign: 'center', lineHeight: 1.3 }}>
                                Song<br />Deactivated
                              </span>
                            )}
                            {isInactive && (
                              <button
                                onClick={() => handleReactivate(song)}
                                disabled={isReactivating}
                                style={{
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: '0.5rem',
                                  border: 'none',
                                  background: isReactivating ? '#27272a' : '#9333ea',
                                  color: isReactivating ? '#52525b' : '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
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


        </div>
      </div>

      {showMaxDurationWarningModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>⚠️ Concert Ending Soon</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>This concert will automatically end in 30 minutes — it has been live for nearly 12 hours. To keep it going, there is no action available: the 12-hour limit cannot be extended.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMaxDurationWarningModal(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#ffffff', color: '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}
      {showInactivityWarningModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7', margin: 0 }}>⚠️ Concert Ending Soon</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>This concert will automatically end in 30 minutes due to inactivity. To reset the timer, accept or decline a song, or a fan needs to make a contribution.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInactivityWarningModal(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#ffffff', color: '#09090b', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        </div>
      )}
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
                            {track.album_art_url ? <img src={track.album_art_url} alt={track.album} width={48} height={48} style={{ borderRadius: '0.375rem', flexShrink: 0, objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: '0.375rem', background: 'linear-gradient(135deg, #1a0a0a, #2e1065, #1e1b4b, #1e3a5f, #134e4a, #052e16, #0a0a0a)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '1rem', color: '#71717a' }}>♫</span></div>}
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

      {pendingAccept && (
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
              Accept Song?
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Accept &ldquo;{pendingAccept.name}&rdquo; by {pendingAccept.artist} and charge all contributors?
            </p>
            {pendingAccept.comments && (
              <div style={{ background: '#27272a', borderRadius: '0.5rem', padding: '0.75rem 1rem', borderLeft: '3px solid #a78bfa' }}>
                <p style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 600, margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performer Notes</p>
                <p style={{ fontSize: '0.9375rem', color: '#e4e4e7', margin: 0, lineHeight: 1.5 }}>{pendingAccept.comments}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setPendingAccept(null)}
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
                onClick={handleAcceptConfirmed}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#15803d',
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Song: Choice */}
      {manageStep === 'choice' && managingSong && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>What would you like to do with &quot;{managingSong.name}&quot;?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => { setManageStep('none'); setManagingSong(null); }} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #3f3f46', background: 'transparent', color: '#a1a1aa', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSetNotAvailable} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#3f3f46', color: '#ffffff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>
                Set as Not Available
              </button>
              <button onClick={() => setManageStep('confirmPlayed')} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#991b1b', color: '#ffffff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>
                Mark as Played
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Song: Confirm Mark as Played */}
      {manageStep === 'confirmPlayed' && managingSong && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>Confirm: Mark as Played</h2>
            <p style={{ color: '#f87171', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>This cannot be undone — &quot;{managingSong.name}&quot; will be marked played and cannot be reactivated for the remainder of this concert.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setManageStep('choice')} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #3f3f46', background: 'transparent', color: '#a1a1aa', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleMarkAsPlayed} style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#991b1b', color: '#ffffff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>
                Mark as Played
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 1: Concert Summary */}
      {endConcertStep === 'summary' && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay-heavy)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>End concert?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>
                Total accepted: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>${Math.round(trackerAccepted)}</span>
              </p>
              <p style={{ color: '#71717a', fontSize: '0.8125rem', margin: 0 }}>This is what you&apos;ll be paid out, minus the platform fee.</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: '0.5rem 0 0 0' }}>
                Total pending: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>${Math.round(trackerPending)}</span>
              </p>
              <p style={{ color: '#71717a', fontSize: '0.8125rem', margin: 0 }}>These contributions will be released back to fans, not charged.</p>
            </div>
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setEndConcertStep('none')} style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => setEndConcertStep('confirm')} style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}>
                End Concert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 2: Final Confirmation */}
      {endConcertStep === 'confirm' && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay-heavy)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>Are you certain you are ready to end the concert?</h2>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setEndConcertStep('none')} style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleEndConcertConfirmed} style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger)', color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}>
                I am certain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {endConcertStep === 'processing' && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay-heavy)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <p style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Processing payments…</p>
            <p style={{ color: '#71717a', fontSize: '0.8125rem', margin: 0 }}>Please don&apos;t close this tab.</p>
          </div>
        </div>
      )}

      {/* Outcome */}
      {endConcertStep === 'outcome' && endConcertOutcome && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay-heavy)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem', maxWidth: '420px', width: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e4e4e7' }}>
              {endConcertOutcome.kind === 'error' ? 'Something Went Wrong' : endConcertOutcome.kind === 'partial' ? 'Concert Ended — Some Payments Failed' : 'Concert Ended'}
            </h2>
            <p style={{ color: endConcertOutcome.kind === 'error' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              {endConcertOutcome.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={dismissEndConcertOutcome} style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tile-deep)', color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
