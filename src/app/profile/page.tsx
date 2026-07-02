'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#555555',
  letterSpacing: '1px',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: '600',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0d0d0d',
  border: '1px solid #2a2a2a',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#cccccc',
  boxSizing: 'border-box',
  outline: 'none',
};

const dividerStyle: React.CSSProperties = {
  borderTop: '1px solid #1e1e1e',
  margin: '28px 0',
};

type PayoutsState = 'not_connected' | 'setup_in_progress' | 'active';

export default function ProfilePage() {
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
  const [previewCode, setPreviewCode] = useState('');
  const [previewCodeError, setPreviewCodeError] = useState('');
  const [previewCodeSuccess, setPreviewCodeSuccess] = useState('');
  const [previewCodeSaving, setPreviewCodeSaving] = useState(false);

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
        setPreviewCode(data.preview_code ?? '');

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

  async function handleSavePreviewCode() {
    if (!userId) return;
    setPreviewCodeError('');
    setPreviewCodeSuccess('');
    if (!previewCode) {
      setPreviewCodeError('Taking Requests code cannot be empty.');
      return;
    }
    if (previewCode.length > 15) {
      setPreviewCodeError('Taking Requests code must be 15 characters or fewer.');
      return;
    }
    if (/\s/.test(previewCode)) {
      setPreviewCodeError('Taking Requests code cannot contain spaces.');
      return;
    }
    if (previewCode === concertCode) {
      setPreviewCodeError('Taking Requests code must be different from your Concert Code.');
      return;
    }
    setPreviewCodeSaving(true);
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('preview_code', previewCode)
      .neq('id', userId)
      .maybeSingle();
    if (existing) {
      setPreviewCodeError('This code is already in use. Please choose a different one.');
      setPreviewCodeSaving(false);
      return;
    }
    const { error } = await supabase
      .from('users')
      .update({ preview_code: previewCode })
      .eq('id', userId);
    setPreviewCodeSaving(false);
    if (error) {
      setPreviewCodeError('Failed to save code. Please try again.');
    } else {
      setPreviewCodeSuccess('Taking Requests code saved.');
      setTimeout(() => setPreviewCodeSuccess(''), 3000);
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

  async function loadEarningsHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: concerts } = await supabase
      .from('concerts')
      .select('id, name, venue_name, city, ended_at, created_at')
      .eq('performer_id', user.id)
      .eq('status', 'closed')
      .gt('ended_at', oneYearAgo)
      .order('ended_at', { ascending: false });
    if (!concerts || concerts.length === 0) { setEarningsHistory([]); return; }
    const concertIds = concerts.map((c: any) => c.id);
    const { data: contributions } = await supabase
      .from('contributions')
      .select('amount, status, song_id, concert_id')
      .in('concert_id', concertIds)
      .in('status', ['accepted', 'released']);
    const { data: songs } = await supabase
      .from('songs')
      .select('id, name, artist')
      .in('concert_id', concertIds);
    const songMap: Record<string, any> = {};
    if (songs) songs.forEach((s: any) => { songMap[s.id] = s; });
    const history = concerts.map((concert: any) => {
      const concertContribs = (contributions ?? []).filter((c: any) => c.concert_id === concert.id);
      const captured = concertContribs.filter((c: any) => c.status === 'accepted');
      const released = concertContribs.filter((c: any) => c.status === 'released');
      const totalEarned = captured.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const totalReleased = released.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const acceptedSongs = [...new Map(captured.map((c: any) => [c.song_id, { songName: songMap[c.song_id]?.name ?? 'Unknown', artist: songMap[c.song_id]?.artist ?? '', amount: Number(c.amount), status: 'accepted' }])).values()];
      const declinedSongs = [...new Map(released.map((c: any) => [c.song_id, { songName: songMap[c.song_id]?.name ?? 'Unknown', artist: songMap[c.song_id]?.artist ?? '', amount: Number(c.amount), status: 'released' }])).values()];
      return {
        concertId: concert.id,
        concertName: concert.name,
        venue: concert.venue_name ?? '',
        city: concert.city ?? '',
        endedAt: concert.ended_at,
        createdAt: concert.created_at,
        totalEarned,
        totalReleased,
        capturedCount: captured.length,
        releasedCount: released.length,
        acceptedSongs,
        declinedSongs,
      };
    });
    setEarningsHistory(history);
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
        : songs.map((s: any) => `
            <div class="song">
              <div class="song-name">${s.songName}</div>
              <div class="song-artist">${s.artist}</div>
              <div class="contrib-row">
                <span class="${earned ? 'amount-earned' : 'amount-released'}">${earned ? '+' : ''}$${Math.round(Number(s.amount))}</span>
              </div>
            </div>
          `).join('');

    const venueLine = `${concert.venue ?? ''}${concert.city ? ` — ${concert.city}` : ''}`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>SetTuner Earnings Statement</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #ffffff; color: #111111; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; }
  .container { max-width: 600px; margin: 0 auto; }
  .logo { color: #1a7a3c; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .title { font-size: 28px; font-weight: 800; margin-top: 8px; }
  .concert-name { font-size: 18px; font-weight: 700; margin-top: 20px; }
  .venue { color: #555555; font-size: 14px; margin-top: 4px; }
  .date { color: #777777; font-size: 13px; margin-top: 2px; }
  .section { margin-top: 32px; }
  .section-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #dddddd; padding-bottom: 8px; margin-bottom: 12px; }
  .song { padding: 10px 0; border-bottom: 1px solid #eeeeee; }
  .song-name { font-weight: 700; font-size: 15px; }
  .song-artist { color: #555555; font-size: 13px; margin-top: 2px; }
  .contrib-row { display: flex; justify-content: flex-end; align-items: center; margin-top: 6px; }
  .amount-earned { color: #1a7a3c; font-weight: 700; font-size: 14px; }
  .amount-released { color: #777777; font-weight: 700; font-size: 14px; }
  .empty { color: #777777; font-size: 13px; font-style: italic; }
  .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #dddddd; }
  .total-earned { color: #1a7a3c; font-size: 18px; font-weight: 800; }
  .total-released { color: #777777; font-size: 16px; font-weight: 700; margin-top: 4px; }
  .note { color: #777777; font-size: 13px; margin-top: 16px; line-height: 1.5; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="logo">SetTuner</div>
    <div class="title">Earnings Statement</div>
    <div class="concert-name">${concert.concertName}</div>
    <div class="venue">${venueLine}</div>
    <div class="date">${dateLabel}</div>

    <div class="section">
      <div class="section-title">Accepted &amp; Earned</div>
      ${renderSongRows(accepted, true)}
    </div>

    <div class="section">
      <div class="section-title">Declined / Not Played</div>
      ${renderSongRows(declined, false)}
    </div>

    <div class="footer">
      <div class="total-earned">Total earned: +$${totalEarned}</div>
      <div class="total-released">Total released: $${totalReleased}</div>
      <div class="note">This statement reflects raw contribution totals. Platform fees are not yet reflected in this export.</div>
    </div>
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
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', padding: '24px 16px 60px' }}>

      {/* Top bar */}
      <div style={{ maxWidth: '500px', margin: '0 auto 28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.push(returnTo ?? '/dashboard')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#555',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
          Profile
        </h1>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: '#2255ff22',
            border: '1px solid #2255ff',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#2255ff',
          }}>
            Performer Account
          </span>
        </div>

        {/* Account Info */}
        <section>
          <p style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px' }}>
            Account Info
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Email</label>
            <p style={{ fontSize: '14px', color: '#555', padding: '10px 12px' }}>{email}</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Band Name</label>
            <input
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {profileError && (
            <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{profileError}</p>
          )}
          {profileSuccess && (
            <p style={{ color: '#4caf50', fontSize: '13px', marginBottom: '12px' }}>{profileSuccess}</p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            style={{
              width: '100%',
              padding: '13px 0',
              backgroundColor: profileSaving ? '#1a3acc' : '#2255ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: profileSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </section>

        <div style={dividerStyle} />

        {/* Concert Code */}
        <section>
          <p style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px' }}>
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
              style={inputStyle}
            />
            <span style={{
              flexShrink: 0,
              fontSize: '12px',
              color: '#555',
              minWidth: '34px',
              textAlign: 'right',
            }}>
              {concertCode.length}/15
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6, marginBottom: '20px' }}>
            Fans enter this code in the Join Concert tab to go straight into your live show. No spaces. Max 15 characters. Case sensitive.
          </p>

          {codeError && (
            <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{codeError}</p>
          )}
          {codeSuccess && (
            <p style={{ color: '#4caf50', fontSize: '13px', marginBottom: '12px' }}>{codeSuccess}</p>
          )}

          <button
            onClick={handleSaveCode}
            disabled={codeSaving}
            style={{
              width: '100%',
              padding: '13px 0',
              backgroundColor: codeSaving ? '#1a3acc' : '#2255ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: codeSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {codeSaving ? 'Saving...' : 'Save Code'}
          </button>
        </section>

        <div style={{ height: '1px', background: '#1a1a1a', margin: '24px 0' }} />
        <section>
          <p style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px' }}>
            Taking Requests Code
          </p>
          <label style={labelStyle}>Taking Requests Code</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <input
              type="text"
              value={previewCode}
              onChange={(e) => setPreviewCode(e.target.value.slice(0, 15))}
              placeholder="e.g. BandNameFriday"
              maxLength={15}
              style={inputStyle}
            />
            <span style={{ flexShrink: 0, fontSize: '12px', color: '#555', minWidth: '34px', textAlign: 'right' }}>
              {previewCode.length}/15
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6, marginBottom: '20px' }}>
            Share this code so Fans can find your Taking Requests concerts. No spaces. Max 15 characters. Case sensitive. Must be different from your Concert Code.
          </p>
          {previewCodeError && (
            <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{previewCodeError}</p>
          )}
          {previewCodeSuccess && (
            <p style={{ color: '#4caf50', fontSize: '13px', marginBottom: '12px' }}>{previewCodeSuccess}</p>
          )}
          <button
            onClick={handleSavePreviewCode}
            disabled={previewCodeSaving}
            style={{
              width: '100%',
              padding: '13px 0',
              backgroundColor: previewCodeSaving ? '#1a3acc' : '#2255ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: previewCodeSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {previewCodeSaving ? 'Saving...' : 'Save Taking Requests Code'}
          </button>
        </section>

        {/* QR Code */}
        <div style={{ height: '1px', background: '#1a1a1a', margin: '24px 0' }} />

        <section>
          <p style={{ fontSize: '10px', color: '#555', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '600', marginBottom: '12px', textAlign: 'center' }}>
            Your QR Code
          </p>
          <p style={{ fontSize: '12px', color: '#555', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.5 }}>
            This QR code is linked to your Concert Code only. It does not work for Taking Requests concerts.
          </p>

          {qrDataUrl && (
            <>
              <img
                src={qrDataUrl}
                width={100}
                height={100}
                alt="QR Code"
                style={{ borderRadius: '8px', display: 'block', margin: '0 auto 12px', background: 'white', padding: '6px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  onClick={() => setShowQRModal(true)}
                  style={{ background: '#141414', border: '1px solid #333', borderRadius: '8px', padding: '8px 16px', color: '#888', fontSize: '13px', cursor: 'pointer' }}
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
                  style={{ background: '#141414', border: '1px solid #2255ff44', borderRadius: '8px', padding: '8px 16px', color: '#2255ff', fontSize: '13px', cursor: 'pointer' }}
                >
                  ↓ Download PNG
                </button>
              </div>
            </>
          )}
        </section>

        <div style={dividerStyle} />

        {/* Payouts */}
        <section>
          <p style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', marginBottom: '16px' }}>
            Payouts
          </p>

          {payoutsState === 'not_connected' && (
            <div>
              <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '20px' }}>
                Connect a bank account to receive payouts from fan song requests.
              </p>
              {connectError && (
                <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  backgroundColor: connectLoading ? '#1a3acc' : '#2255ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
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
              backgroundColor: '#111111',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b' }}>
                  Setup In Progress
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6, marginBottom: '16px' }}>
                Your Stripe account is connected but setup is not complete. Finish adding your bank account to start receiving payouts.
              </p>
              {connectError && (
                <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  backgroundColor: connectLoading ? '#1a3acc' : '#2255ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
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
              backgroundColor: '#111111',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#4caf50',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#4caf50' }}>
                  Payouts Active
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6, marginBottom: '16px' }}>
                Your bank account is connected and ready to receive payouts from fan song requests.
              </p>
              {connectError && (
                <p style={{ color: '#ff4444', fontSize: '13px', marginBottom: '12px' }}>{connectError}</p>
              )}
              <button
                onClick={handleConnectBank}
                disabled={connectLoading}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  backgroundColor: 'transparent',
                  color: '#a1a1aa',
                  border: '1px solid #2a2a2a',
                  borderRadius: '10px',
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

        <div style={{ height: '1px', background: '#1a1a1a', margin: '24px 0' }} />
        <section>
          <div
            onClick={() => {
              setEarningsExpanded(prev => {
                if (prev) setExpandedEarningsMonths(new Set());
                return !prev;
              });
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '8px' }}
          >
            <p style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', margin: 0 }}>Concert & Earnings History</p>
            <span style={{ color: '#555', fontSize: '14px' }}>{earningsExpanded ? '▾' : '▸'}</span>
          </div>
          {earningsExpanded && (
            earningsHistory.length === 0 ? (
              <p style={{ color: '#555', fontSize: '13px' }}>No recent concert history.</p>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {monthKeys.map((monthKey) => {
                    const monthConcerts = grouped[monthKey];
                    const monthLabel = monthConcerts[0].monthLabel;
                    const monthTotalEarned = monthConcerts.reduce((sum: number, c: any) => sum + c.totalEarned, 0);
                    const isMonthExpanded = expandedEarningsMonths.has(monthKey);
                    return (
                      <div key={monthKey}>
                        <div
                          onClick={() => toggleEarningsMonth(monthKey)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
                        >
                          <div>
                            <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', margin: 0 }}>{monthLabel}</p>
                            <p style={{ color: '#555', fontSize: '11px', margin: '2px 0 0' }}>
                              {monthConcerts.length} {monthConcerts.length === 1 ? 'concert' : 'concerts'}{monthTotalEarned > 0 ? ` · $${Math.round(monthTotalEarned)} earned` : ''}
                            </p>
                          </div>
                          <span style={{ color: '#555', fontSize: '14px' }}>{isMonthExpanded ? '▾' : '▸'}</span>
                        </div>
                        {isMonthExpanded && (
                          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {monthConcerts.map((concert: any, cIdx: number) => {
                              const dateLabel = new Date(concert.endedAt ?? concert.createdAt ?? 0).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
                              const venueLabel = [concert.venue, concert.city].filter(Boolean).join(' — ');
                              return (
                                <div key={concert.concertId} style={{ paddingBottom: cIdx < monthConcerts.length - 1 ? '16px' : 0, borderBottom: cIdx < monthConcerts.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                                  <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', margin: '0 0 2px' }}>{concert.concertName}</p>
                                  <p style={{ color: '#555', fontSize: '11px', margin: '0 0 2px' }}>{dateLabel}</p>
                                  <p style={{ color: '#555', fontSize: '11px', margin: '0 0 8px' }}>{venueLabel}</p>
                                  <p style={{ color: '#4caf50', fontSize: '13px', fontWeight: '600', margin: '0 0 2px' }}>Earned: ${Math.round(concert.totalEarned)}</p>
                                  <p style={{ color: '#555', fontSize: '13px', margin: '0 0 2px' }}>Released: ${Math.round(concert.totalReleased)}</p>
                                  <p style={{ color: '#555', fontSize: '11px', margin: '0 0 10px' }}>{concert.capturedCount} contribution{concert.capturedCount !== 1 ? 's' : ''} accepted · {concert.releasedCount} released</p>
                                  <button
                                    onClick={() => setSelectedEarningsConcert(concert)}
                                    style={{ padding: '6px 16px', borderRadius: '20px', border: '1px solid #333', background: 'transparent', color: '#ffffff', fontSize: '12px', cursor: 'pointer' }}
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

        <div style={dividerStyle} />

        {/* Log Out */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '13px 0',
            backgroundColor: 'transparent',
            color: '#ff4444',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Log Out
        </button>

      </div>

      {/* QR Full Screen Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
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

          <p style={{ color: '#ffffff', fontSize: '36px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            SetList
          </p>
          <div style={{ width: '8px', height: '8px', background: '#2255ff', borderRadius: '4px', margin: '0 auto 24px' }} />

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
            style={{ background: '#2255ff', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '16px' }}
          >
            ↓ Download PNG
          </button>
        </div>
      )}

      {selectedEarningsConcert && (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
            <p style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0 }}>{selectedEarningsConcert.concertName}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => exportPerformerStatement(selectedEarningsConcert)} style={{ background: 'transparent', border: 'none', color: '#4caf50', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Export</button>
              <button onClick={() => setSelectedEarningsConcert(null)} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '24px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <p style={{ color: '#888', fontSize: '13px', margin: '0 0 2px' }}>{[selectedEarningsConcert.venue, selectedEarningsConcert.city].filter(Boolean).join(' — ')}</p>
            <p style={{ color: '#555', fontSize: '11px', margin: '0 0 20px' }}>{new Date(selectedEarningsConcert.endedAt ?? selectedEarningsConcert.createdAt ?? 0).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1, background: '#111', borderRadius: '10px', padding: '16px' }}>
                <p style={{ color: '#4caf50', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>${Math.round(selectedEarningsConcert.totalEarned)}</p>
                <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>Total Earned</p>
              </div>
              <div style={{ flex: 1, background: '#111', borderRadius: '10px', padding: '16px' }}>
                <p style={{ color: '#888', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>${Math.round(selectedEarningsConcert.totalReleased)}</p>
                <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>Total Released</p>
              </div>
            </div>
            {selectedEarningsConcert.acceptedSongs.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: '0 0 12px' }}>✓ Accepted Songs</p>
                {selectedEarningsConcert.acceptedSongs.map((song: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #1a1a1a' }}>
                    <div>
                      <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>{song.songName}</p>
                      <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>{song.artist}</p>
                    </div>
                    <p style={{ color: '#4caf50', fontSize: '14px', fontWeight: '600', margin: 0 }}>${Math.round(song.amount)}</p>
                  </div>
                ))}
              </div>
            )}
            {selectedEarningsConcert.declinedSongs.length > 0 && (
              <div>
                <p style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: '0 0 12px' }}>✕ Declined Songs</p>
                {selectedEarningsConcert.declinedSongs.map((song: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #1a1a1a' }}>
                    <div>
                      <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>{song.songName}</p>
                      <p style={{ color: '#555', fontSize: '12px', margin: 0 }}>{song.artist}</p>
                    </div>
                    <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>${Math.round(song.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
