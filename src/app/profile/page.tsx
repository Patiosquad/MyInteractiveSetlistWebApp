'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';
import '../../../tokens/tokens.css';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-faint)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: '600',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-tile-deep)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
  outline: 'none',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-faint)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: '600',
  marginBottom: '12px',
};

const saveButtonStyle = (saving: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '14px 24px',
  backgroundColor: saving ? 'var(--border)' : 'var(--accent)',
  color: saving ? 'var(--text-faint)' : 'var(--text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  fontSize: '15px',
  fontWeight: '700',
  cursor: saving ? 'not-allowed' : 'pointer',
});

type PayoutsState = 'not_connected' | 'setup_in_progress' | 'active';

export default function ProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d' }} />}>
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [bandName, setBandName] = useState('');

  // Concert Code
  const [concertCode, setConcertCode] = useState('');
  const [previewConcerts, setPreviewConcerts] = useState<{ id: string; name: string; taking_requests_code: string | null }[]>([]);

  // Payouts
  const [payoutsState, setPayoutsState] = useState<PayoutsState>('not_connected');

  // UI state
  const [loading, setLoading] = useState(true);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [codeSaving, setCodeSaving] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState('');
  const [codeError, setCodeError] = useState('');

  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState(false);

  const [earningsHistory, setEarningsHistory] = useState<any[]>([]);
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [expandedEarningsMonths, setExpandedEarningsMonths] = useState<Set<string>>(new Set());
  const [selectedEarningsConcert, setSelectedEarningsConcert] = useState<any | null>(null);

  useEffect(() => {
    if (!userId) return;
    QRCode.toDataURL(userId, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url: string) => setQrDataUrl(url));
  }, [userId]);

  useEffect(() => {
    loadPreviewConcerts();
    window.addEventListener('focus', loadPreviewConcerts);
    return () => window.removeEventListener('focus', loadPreviewConcerts);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setUserId(session.user.id);
      setAccessToken(session.access_token);

      const { data } = await supabase
        .from('users')
        .select('first_name, last_name, email, username, concert_code, preview_code, stripe_connect_account_id, has_payment_method')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setEmail(data.email ?? '');
        setBandName(data.username ?? '');
        setConcertCode(data.concert_code ?? '');

        if (data.stripe_connect_account_id) {
          try {
            const statusRes = await fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: session.user.id }),
              }
            );
            const statusResult = await statusRes.json();
            if (statusRes.ok && statusResult.success && statusResult.chargesEnabled && statusResult.payoutsEnabled) {
              setPayoutsState('active');
            } else {
              setPayoutsState('setup_in_progress');
            }
          } catch {
            setPayoutsState('setup_in_progress');
          }
        } else {
          setPayoutsState('not_connected');
        }
      }

      await loadEarningsHistory();
      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const userChannel = supabase
      .channel(`performer_profile_user_${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, async () => {
        const { data } = await supabase
          .from('users')
          .select('concert_code')
          .eq('id', userId)
          .single();
        if (data) setConcertCode(data.concert_code ?? '');
      })
      .subscribe();

    const concertsChannel = supabase
      .channel(`performer_profile_concerts_${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'concerts', filter: `performer_id=eq.${userId}` }, () => {
        loadPreviewConcerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(concertsChannel);
    };
  }, [userId]);

  async function handleSaveProfile() {
    if (!userId) return;
    setProfileError('');
    setProfileSuccess('');
    if (!firstName.trim() || !lastName.trim() || !bandName.trim()) {
      setProfileError('All fields are required.');
      return;
    }
    setProfileSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: bandName.trim(),
      })
      .eq('id', userId);
    setProfileSaving(false);
    if (error) {
      setProfileError('Failed to save. Please try again.');
    } else {
      setProfileSuccess('Profile saved.');
      setTimeout(() => setProfileSuccess(''), 3000);
    }
  }

  async function handleSaveCode() {
    if (!userId) return;
    setCodeError('');
    setCodeSuccess('');

    if (!concertCode) {
      setCodeError('Concert code cannot be empty.');
      return;
    }
    if (concertCode.length > 15) {
      setCodeError('Concert code must be 15 characters or fewer.');
      return;
    }
    if (/\s/.test(concertCode)) {
      setCodeError('Concert code cannot contain spaces.');
      return;
    }

    setCodeSaving(true);

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('concert_code', concertCode)
      .neq('id', userId)
      .maybeSingle();

    if (existing) {
      setCodeError('This code is already in use. Please choose a different one.');
      setCodeSaving(false);
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ concert_code: concertCode })
      .eq('id', userId);

    setCodeSaving(false);
    if (error) {
      setCodeError('Failed to save code. Please try again.');
    } else {
      setCodeSuccess('Concert code saved.');
      setTimeout(() => setCodeSuccess(''), 3000);
    }
  }

  async function handleConnectBank() {
    if (!accessToken) return;
    setConnectError('');
    setConnectLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, returnUrl: `${window.location.origin}/profile` }),
        }
      );
      if (!res.ok) {
        throw new Error('Failed to start onboarding.');
      }
      const { onboardingUrl } = await res.json();
      window.location.href = onboardingUrl;
    } catch {
      setConnectLoading(false);
      setConnectError('Failed to connect. Please try again.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function loadPreviewConcerts() {
    const { data: { session } } = await supabase.auth.getSession();
    const id = session?.user?.id;
    if (!id) return;
    const { data } = await supabase
      .from('concerts')
      .select('id, name, taking_requests_code')
      .eq('performer_id', id)
      .eq('status', 'preview');
    setPreviewConcerts(data ?? []);
  }

  async function loadEarningsHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: concerts } = await supabase
      .from('concerts')
      .select('id, name, venue_name, city, created_at')
      .eq('performer_id', user.id);
    if (!concerts || concerts.length === 0) { setEarningsHistory([]); return; }
    const concertIds = concerts.map((c: any) => c.id);
    const concertMeta: Record<string, any> = {};
    concerts.forEach((c: any) => { concertMeta[c.id] = c; });

    const { data: cycles } = await supabase
      .from('concert_cycles')
      .select('id, concert_id, started_at, ended_at, total_earned')
      .in('concert_id', concertIds)
      .order('ended_at', { ascending: true });
    if (!cycles || cycles.length === 0) { setEarningsHistory([]); return; }

    const { data: contributions } = await supabase
      .from('contributions')
      .select('total_amount, status, song_id, concert_id, created_at')
      .in('concert_id', concertIds)
      .in('status', ['accepted', 'released']);

    const { data: songs } = await supabase
      .from('songs')
      .select('id, name, artist')
      .in('concert_id', concertIds);
    const songMap: Record<string, any> = {};
    if (songs) songs.forEach((s: any) => { songMap[s.id] = s; });

    const cyclesByConcert: Record<string, any[]> = {};
    cycles.forEach((cy: any) => {
      if (!cyclesByConcert[cy.concert_id]) cyclesByConcert[cy.concert_id] = [];
      cyclesByConcert[cy.concert_id].push(cy);
    });

    const history: any[] = [];

    Object.keys(cyclesByConcert).forEach((concertId) => {
      const concertCycles = cyclesByConcert[concertId];
      let previousEndedAt: string | null = null;

      concertCycles.forEach((cycle: any) => {
        const lower = previousEndedAt;
        const upper = cycle.ended_at;

        if (cycle.started_at) {
          const windowedContribs = (contributions ?? []).filter((c: any) => {
            if (c.concert_id !== concertId) return false;
            if (lower && c.created_at <= lower) return false;
            if (c.created_at > upper) return false;
            return true;
          });

          const captured = windowedContribs.filter((c: any) => c.status === 'accepted');
          const released = windowedContribs.filter((c: any) => c.status === 'released');
          const totalReleased = released.reduce((sum: number, c: any) => sum + Number(c.total_amount), 0);
          const capturedSorted = [...captured].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const releasedSorted = [...released].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const acceptedSongs = [...new Map(capturedSorted.map((c: any) => [c.song_id, { songName: songMap[c.song_id]?.name ?? 'Unknown', artist: songMap[c.song_id]?.artist ?? '', amount: Number(c.total_amount), status: 'accepted', timestamp: c.created_at }])).values()];
          const declinedSongs = [...new Map(releasedSorted.map((c: any) => [c.song_id, { songName: songMap[c.song_id]?.name ?? 'Unknown', artist: songMap[c.song_id]?.artist ?? '', amount: Number(c.total_amount), status: 'released', timestamp: c.created_at }])).values()];

          const meta = concertMeta[concertId] ?? {};
          history.push({
            concertId,
            concertName: meta.name,
            venue: meta.venue_name ?? '',
            city: meta.city ?? '',
            endedAt: cycle.ended_at,
            createdAt: meta.created_at,
            totalEarned: Number(cycle.total_earned) || 0,
            totalReleased,
            capturedCount: captured.length,
            releasedCount: released.length,
            acceptedSongs,
            declinedSongs,
          });
        }

        previousEndedAt = cycle.ended_at;
      });
    });

    const recent = history
      .filter((h: any) => h.endedAt > oneYearAgo)
      .sort((a: any, b: any) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());

    setEarningsHistory(recent);
  }

  function generatePerformerStatementHtml(concert: any) {
    const accepted = concert.acceptedSongs ?? [];
    const declined = concert.declinedSongs ?? [];

    const totalEarned = Math.round(Number(concert.totalEarned ?? 0));
    const totalReleased = Math.round(Number(concert.totalReleased ?? 0));

    const dateSource = concert.endedAt ?? concert.createdAt;
    const dateLabel = dateSource
      ? new Date(dateSource).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : 'Unknown date';

    const renderSongRows = (songs: any[], earned: boolean) =>
      songs.length === 0
        ? '<p class="empty">None</p>'
        : `<div class="song-list">${songs.map((s: any) => `
            <div class="song-row song-row-${earned ? 'accepted' : 'declined'}">
              <div class="song-info">
                <div class="song-name-${earned ? 'accepted' : 'declined'}">${s.songName}</div>
                <div class="song-artist-${earned ? 'accepted' : 'declined'}">${s.artist}</div>
              </div>
              <div class="song-time">${formatSongTime(s.timestamp)}</div>
              <div class="song-amount song-amount-${earned ? 'accepted' : 'declined'}">${earned ? '+' : ''}$${Math.round(Number(s.amount))}</div>
            </div>
          `).join('')}</div>`;

    const venueLine = `${concert.venue ?? ''}${concert.city ? ` — ${concert.city}` : ''}`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>SetTuner Earnings Statement</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0806; color: #fff6ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; }
  .container { max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 22px; }
  .wordmark { color: #ff5a1f; font-size: 22px; font-weight: 900; }
  .doc-label { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b5c50; font-weight: 700; }
  .concert-name { font-size: 26px; font-weight: 900; color: #fff6ea; margin-bottom: 5px; }
  .venue-date { font-size: 14px; color: #b8a699; margin-bottom: 26px; }
  .contrib-count { color: #ffb703; font-weight: 700; }
  .summary-bar { display: flex; gap: 14px; margin-bottom: 28px; }
  .tile { border-radius: 14px; padding: 18px 22px; }
  .tile-earned { flex: 1.4; background: rgba(22,163,74,0.07); border: 1px solid rgba(22,163,74,0.28); }
  .tile-released { flex: 1; background: #1c1310; border: 1px solid #2e211a; }
  .tile-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b5c50; font-weight: 800; margin-bottom: 8px; }
  .tile-figure-earned { font-size: 34px; font-weight: 900; color: #16a34a; font-variant-numeric: tabular-nums; }
  .tile-figure-released { font-size: 26px; font-weight: 800; color: #ffb703; font-variant-numeric: tabular-nums; }
  .panel { border-radius: 12px; padding: 18px 20px; }
  .panel-accepted { background: rgba(22,163,74,0.055); border: 1px solid rgba(22,163,74,0.22); border-left: 3px solid #16a34a; margin-bottom: 14px; }
  .panel-declined { background: #1c1310; border: 1px solid #2e211a; border-left: 3px solid #2e211a; }
  .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; break-after: avoid; page-break-after: avoid; }
  .panel-title-accepted { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #16a34a; font-weight: 800; }
  .panel-title-declined { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6b5c50; font-weight: 800; }
  .panel-count { font-size: 11px; color: #6b5c50; }
  .panel-count-declined { font-size: 11px; color: #6b5c50; }
  .song-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
  .song-row-accepted { background: #1c1310; border: 1px solid #2e211a; }
  .song-row-declined { background: #0a0806; opacity: 0.8; border: 1px solid #1f1713; }
  .song-info { flex: 1; min-width: 0; }
  .song-name-accepted { font-size: 14px; font-weight: 700; color: #fff6ea; }
  .song-name-declined { font-size: 14px; font-weight: 600; color: #b8a699; }
  .song-artist-accepted { font-size: 12px; color: #b8a699; margin-top: 2px; }
  .song-artist-declined { font-size: 12px; color: #6b5c50; margin-top: 2px; }
  .song-time { font-family: monospace; font-size: 11px; color: #6b5c50; }
  .song-amount { width: 56px; text-align: right; font-variant-numeric: tabular-nums; }
  .song-amount-accepted { font-size: 15px; font-weight: 800; color: #16a34a; }
  .song-amount-declined { font-size: 14px; font-weight: 700; color: #6b5c50; }
  .empty { color: #6b5c50; font-size: 13px; font-style: italic; }
  .footer-note { margin-top: 20px; font-size: 11px; font-style: italic; color: #6b5c50; }
  @page {
    margin: 0.75in;
  }
  @media print {
    body { background: #fbf8f2; color: #1c1310; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .doc-label { color: #8a7a6c; }
    .concert-name { color: #1c1310; }
    .venue-date { color: #6b5c50; }
    .contrib-count { color: #a9760a; }
    .tile-earned { background: rgba(21,128,61,0.09); border: 1px solid rgba(21,128,61,0.3); }
    .tile-released { background: #f1ebe1; border: 1px solid #e4dacc; }
    .tile-label { color: #8a7a6c; }
    .tile-figure-earned { color: #15803d; }
    .tile-figure-released { color: #a9760a; }
    .panel-accepted { background: rgba(21,128,61,0.07); border: 1px solid rgba(21,128,61,0.24); border-left: 3px solid #15803d; }
    .panel-declined { background: #f4efe7; border: 1px solid #e4dacc; border-left: 3px solid #cdbfae; }
    .panel-title-accepted { color: #15803d; }
    .panel-title-declined { color: #8a7a6c; }
    .panel-count { color: #8a7a6c; }
    .panel-count-declined { color: #9c8d7f; }
    .song-row-accepted { background: #ffffff; border: 1px solid #ede4d6; }
    .song-row-declined { background: #faf6ef; border: 1px solid #ece3d5; opacity: 1; }
    .song-name-accepted { color: #1c1310; }
    .song-name-declined { color: #6b5c50; }
    .song-artist-accepted { color: #6b5c50; }
    .song-artist-declined { color: #9c8d7f; }
    .song-time { color: #9c8d7f; }
    .song-amount-accepted { color: #15803d; }
    .song-amount-declined { color: #9c8d7f; }
    .footer-note { color: #9c8d7f; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <div class="wordmark">SetTuner</div>
      <div class="doc-label">Earnings Statement</div>
    </div>
    <div class="concert-name">${concert.concertName}</div>
    <div class="venue-date">${venueLine ? `${venueLine} · ` : ''}${dateLabel}<span class="contrib-count"> · ${concert.capturedCount + concert.releasedCount} contributions</span></div>

    <div class="summary-bar">
      <div class="tile tile-earned">
        <div class="tile-label">Total Earned</div>
        <div class="tile-figure-earned">+$${totalEarned}</div>
      </div>
      <div class="tile tile-released">
        <div class="tile-label">Released</div>
        <div class="tile-figure-released">$${totalReleased}</div>
      </div>
    </div>

    ${accepted.length > 0 ? `
    <div class="panel panel-accepted">
      <div class="panel-header">
        <div class="panel-title-accepted">Accepted &amp; Earned</div>
        <div class="panel-count">${accepted.length} song${accepted.length !== 1 ? 's' : ''}</div>
      </div>
      ${renderSongRows(accepted, true)}
    </div>` : ''}

    ${declined.length > 0 ? `
    <div class="panel panel-declined">
      <div class="panel-header">
        <div class="panel-title-declined">Declined / Not Played</div>
        <div class="panel-count-declined">${declined.length} song${declined.length !== 1 ? 's' : ''}</div>
      </div>
      ${renderSongRows(declined, false)}
    </div>` : ''}

    <div class="footer-note">Figures are raw totals. Platform fees are not yet reflected and will be deducted before payout.</div>
  </div>
</body>
</html>`;
  }

  function exportPerformerStatement(concert: any) {
    const html = generatePerformerStatementHtml(concert);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export the statement.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  function toggleEarningsMonth(monthKey: string) {
    setExpandedEarningsMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) { next.delete(monthKey); } else { next.add(monthKey); }
      return next;
    });
  }

  function formatSongTime(ts: string) {
    return new Date(ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: '#444', fontSize: '14px' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* Top glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 55% at 50% -8%, rgba(255,90,31,0.14), rgba(10,8,6,0) 62%)' }} />
        {/* Edge vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 45%, rgba(10,8,6,0) 46%, rgba(5,4,3,0.62) 100%)' }} />
      </div>
      <style>{`
        .profile-input::placeholder { color: var(--text-faint); }
        .profile-input:focus { border-color: var(--accent); outline: none; }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '16px 24px',
        background: 'radial-gradient(ellipse at top right, rgba(255,90,31,0.06) 0%, transparent 60%), var(--bg-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
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
              Profile
            </h1>
          </div>

          {/* FAR RIGHT — Log Out + Back link */}
          <div style={{ flexShrink: 0, marginLeft: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleLogout}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tile)'; e.currentTarget.style.color = 'var(--danger)'; }}
              style={{
                background: 'var(--bg-tile)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Log Out
            </button>
            <button
              onClick={() => router.push(returnTo ?? '/dashboard')}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Back to My Concerts
            </button>
          </div>
        </div>

        {/* Ember baseline */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '3px', background: 'linear-gradient(to right, var(--accent), var(--gold))' }} />
      </header>

      <div style={{ width: '100%', padding: '32px 24px', display: 'flex', gap: '56px', alignItems: 'flex-start', boxSizing: 'border-box' }}>

        {/* LEFT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Account Info */}
        <section>
          <p style={sectionLabelStyle}>
            Account Info
          </p>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="profile-input"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="profile-input"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Email</label>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '10px 0', margin: 0 }}>{email}</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Band Name</label>
            <input
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              className="profile-input"
              style={inputStyle}
            />
          </div>

          {profileError && (
            <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{profileError}</p>
          )}
          {profileSuccess && (
            <p style={{ color: 'var(--success)', fontSize: '13px', marginBottom: '12px' }}>{profileSuccess}</p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            style={saveButtonStyle(profileSaving)}
          >
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </section>

        {/* Concert Code */}
        <section>
          <p style={sectionLabelStyle}>
            Concert Code
          </p>

          <label style={labelStyle}>Concert Code</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <input
              type="text"
              value={concertCode}
              onChange={(e) => setConcertCode(e.target.value.slice(0, 15))}
              placeholder="e.g. BandName2024"
              maxLength={15}
              className="profile-input"
              style={inputStyle}
            />
            <span style={{
              flexShrink: 0,
              fontSize: '12px',
              color: 'var(--text-faint)',
              minWidth: '34px',
              textAlign: 'right',
            }}>
              {concertCode.length}/15
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: '20px' }}>
            Fans enter this code in the Join Concert tab to go straight into your live show. No spaces. Max 15 characters. Case sensitive.
          </p>

          {codeError && (
            <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{codeError}</p>
          )}
          {codeSuccess && (
            <p style={{ color: 'var(--success)', fontSize: '13px', marginBottom: '12px' }}>{codeSuccess}</p>
          )}

          <button
            onClick={handleSaveCode}
            disabled={codeSaving}
            style={saveButtonStyle(codeSaving)}
          >
            {codeSaving ? 'Saving...' : 'Save Code'}
          </button>
        </section>

        <section>
          <p style={sectionLabelStyle}>
            Taking Requests Codes
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: '12px' }}>
            Each concert currently Taking Requests gets its own code. Set or change a
            code from that concert's page.
          </p>
          {previewConcerts.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-faint)', fontStyle: 'italic' }}>
              No concerts are currently Taking Requests.
            </p>
          ) : (
            previewConcerts.map((c) => (
              <div key={c.id} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{c.name}</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {c.taking_requests_code ?? '(no code set)'}
                </p>
                <button
                  onClick={() => router.push(`/concerts/${c.id}?editTakingRequestsCode=true`)}
                  style={{ marginTop: '8px', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tile)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Edit Code
                </button>
              </div>
            ))
          )}
        </section>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* QR Code */}
        <section>
          <p style={sectionLabelStyle}>
            Your QR Code
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.5 }}>
            This QR code is linked to your Concert Code only. It does not work for Taking Requests concerts.
          </p>

          {qrDataUrl && (
            <>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '-48px', zIndex: 0, background: 'radial-gradient(circle, rgba(255,90,31,0.28), rgba(10,8,6,0) 65%)', pointerEvents: 'none' }} />
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  style={{ width: '100%', maxWidth: '280px', margin: '0 auto 12px', display: 'block', background: 'white', borderRadius: 'var(--radius-lg)', padding: '16px', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowQRModal(true)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  style={{ flex: 1, background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  ⛶ View Full Screen
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = 'setlist-qr-code.png';
                    link.href = qrDataUrl;
                    link.click();
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  style={{ flex: 1, background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  ↓ Download PNG
                </button>
              </div>
            </>
          )}
        </section>

        {/* Payouts */}
        <section>
          <p style={sectionLabelStyle}>
            Payouts
          </p>

          {payoutsState === 'not_connected' && (
            <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                Connect a bank account to receive payouts from fan song requests.
              </p>
              {connectError && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  backgroundColor: connectLoading ? 'var(--border)' : 'var(--accent)',
                  color: connectLoading ? 'var(--text-faint)' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: connectLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {connectLoading ? 'Redirecting...' : 'Connect Bank Account'}
              </button>
            </div>
          )}

          {payoutsState === 'setup_in_progress' && (
            <div style={{
              background: 'var(--bg-tile)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--gold)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gold)' }}>
                  Setup In Progress
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Your Stripe account is connected but setup is not complete. Finish adding your bank account to start receiving payouts.
              </p>
              {connectError && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  backgroundColor: connectLoading ? 'var(--border)' : 'var(--accent)',
                  color: connectLoading ? 'var(--text-faint)' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: connectLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {connectLoading ? 'Redirecting...' : 'Continue Setup'}
              </button>
            </div>
          )}

          {payoutsState === 'active' && (
            <div style={{
              background: 'var(--bg-tile)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: 'var(--success)', fontSize: '10px', marginRight: '6px' }}>●</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--success)' }}>
                  Payouts Active
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Your bank account is connected and ready to receive payouts from fan song requests.
              </p>
              {connectError && (
                <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'var(--bg-tile-deep)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: connectLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {connectLoading ? 'Redirecting...' : 'Manage Payout Account Settings'}
              </button>
            </div>
          )}
        </section>
        <section>
          <div
            onClick={() => {
              setEarningsExpanded(prev => {
                if (prev) setExpandedEarningsMonths(new Set());
                return !prev;
              });
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}
          >
            <p style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: '600', margin: 0 }}>Concert & Earnings History</p>
            <span style={{ color: earningsExpanded ? 'var(--accent)' : 'var(--text-faint)', fontSize: '14px' }}>{earningsExpanded ? '▾' : '▸'}</span>
          </div>
          {earningsExpanded && (
            earningsHistory.length === 0 ? (
              <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginTop: '12px' }}>No recent concert history.</p>
            ) : (() => {
              const grouped = earningsHistory.reduce((acc: Record<string, any[]>, concert: any) => {
                const date = new Date(concert.endedAt ?? concert.createdAt ?? 0);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                if (!acc[monthKey]) acc[monthKey] = [];
                acc[monthKey].push({ ...concert, monthLabel });
                return acc;
              }, {});
              const monthKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {monthKeys.map((monthKey) => {
                    const monthConcerts = grouped[monthKey];
                    const monthLabel = monthConcerts[0].monthLabel;
                    const monthTotalEarned = monthConcerts.reduce((sum: number, c: any) => sum + c.totalEarned, 0);
                    const isMonthExpanded = expandedEarningsMonths.has(monthKey);
                    return (
                      <div key={monthKey}>
                        <div
                          onClick={() => toggleEarningsMonth(monthKey)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tile-deep)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 16px', cursor: 'pointer' }}
                        >
                          <div>
                            <p style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', margin: 0 }}>{monthLabel}</p>
                            <p style={{ color: 'var(--text-faint)', fontSize: '12px', margin: '2px 0 0' }}>
                              {monthConcerts.length} {monthConcerts.length === 1 ? 'concert' : 'concerts'}{monthTotalEarned > 0 ? ` · $${Math.round(monthTotalEarned)} earned` : ''}
                            </p>
                          </div>
                          <span style={{ color: isMonthExpanded ? 'var(--accent)' : 'var(--text-faint)', fontSize: '14px' }}>{isMonthExpanded ? '▾' : '▸'}</span>
                        </div>
                        {isMonthExpanded && (
                          <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {monthConcerts.map((concert: any) => {
                              const dateLabel = new Date(concert.endedAt ?? concert.createdAt ?? 0).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
                              const venueLabel = [concert.venue, concert.city].filter(Boolean).join(' — ');
                              return (
                                <div key={concert.concertId} style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', margin: '4px 8px' }}>
                                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>{concert.concertName}</p>
                                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 8px' }}>{venueLabel}{venueLabel ? ' · ' : ''}{dateLabel}</p>
                                  <p style={{ fontSize: '13px', margin: '0 0 2px' }}><span style={{ color: 'var(--text-muted)' }}>Earned </span><span style={{ color: 'var(--gold)', fontWeight: '700' }}>${Math.round(concert.totalEarned)}</span></p>
                                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 2px' }}>Released ${Math.round(concert.totalReleased)}</p>
                                  <p style={{ color: 'var(--text-faint)', fontSize: '12px', margin: '0 0 10px' }}>{concert.capturedCount} contribution{concert.capturedCount !== 1 ? 's' : ''} accepted · {concert.releasedCount} released</p>
                                  <button
                                    onClick={() => setSelectedEarningsConcert(concert)}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-tile-deep)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    View Details
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </section>

        </div>
      </div>

      {/* QR Full Screen Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--bg-overlay-heavy)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <button
            onClick={() => setShowQRModal(false)}
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#555', fontSize: '28px', cursor: 'pointer' }}
          >
            ✕
          </button>

          <p style={{ color: 'var(--text-primary)', fontSize: '36px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            SetTuner
          </p>
          <div style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '4px', margin: '0 auto 24px' }} />

          <img
            src={qrDataUrl}
            width={280}
            height={280}
            alt="QR Code"
            style={{ background: 'white', padding: '16px', borderRadius: '12px' }}
          />

          <p style={{ color: '#666', fontSize: '16px', marginTop: '24px' }}>
            Scan to join the show
          </p>

          <button
            onClick={() => {
              const link = document.createElement('a');
              link.download = 'setlist-qr-code.png';
              link.href = qrDataUrl;
              link.click();
            }}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '16px' }}
          >
            ↓ Download PNG
          </button>
        </div>
      )}

      {selectedEarningsConcert && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay-heavy)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '32px', maxWidth: '800px', width: '100%', margin: 'auto', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '800', margin: 0 }}>{selectedEarningsConcert.concertName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <button
                  onClick={() => exportPerformerStatement(selectedEarningsConcert)}
                  style={{ background: 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '6px 14px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Export
                </button>
                <button
                  onClick={() => setSelectedEarningsConcert(null)}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 2px' }}>{[selectedEarningsConcert.venue, selectedEarningsConcert.city].filter(Boolean).join(' — ')}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 20px' }}>
              {new Date(selectedEarningsConcert.endedAt ?? selectedEarningsConcert.createdAt ?? 0).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}> · {selectedEarningsConcert.capturedCount + selectedEarningsConcert.releasedCount} contributions</span>
            </p>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '24px' }}>
              <div style={{ flex: '1.4', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.28)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-faint)', margin: '0 0 6px' }}>Total Earned</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)', margin: 0 }}>${Math.round(selectedEarningsConcert.totalEarned)}</p>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-faint)', margin: '0 0 6px' }}>Released</p>
                <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gold)', margin: 0 }}>${Math.round(selectedEarningsConcert.totalReleased)}</p>
              </div>
            </div>
            {selectedEarningsConcert.acceptedSongs.length > 0 && (
              <div style={{ background: 'rgba(22,163,74,0.055)', border: '1px solid rgba(22,163,74,0.22)', borderLeft: '3px solid var(--success)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--success)', margin: 0 }}>Accepted &amp; Earned</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0 }}>{selectedEarningsConcert.acceptedSongs.length} {selectedEarningsConcert.acceptedSongs.length === 1 ? 'song' : 'songs'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedEarningsConcert.acceptedSongs.map((song: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-tile)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.songName}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist} · {formatSongTime(song.timestamp)}</p>
                      </div>
                      <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--success)', margin: 0, flexShrink: 0 }}>${Math.round(song.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedEarningsConcert.declinedSongs.length > 0 && (
              <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-faint)', margin: 0 }}>Declined / Not Played</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0 }}>{selectedEarningsConcert.declinedSongs.length} {selectedEarningsConcert.declinedSongs.length === 1 ? 'song' : 'songs'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedEarningsConcert.declinedSongs.map((song: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-primary)', opacity: 0.8, borderRadius: 'var(--radius-md)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.songName}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist} · {formatSongTime(song.timestamp)}</p>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-faint)', margin: 0, flexShrink: 0 }}>${Math.round(song.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--text-faint)', marginTop: '18px' }}>Raw totals — platform fees are deducted before payout.</p>
          </div>
        </div>
      )}
    </div>
  );
}
