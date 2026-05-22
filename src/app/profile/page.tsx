'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [bandName, setBandName] = useState('');

  // Concert Code
  const [concertCode, setConcertCode] = useState('');

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
        .select('first_name, last_name, email, username, concert_code, stripe_connect_account_id, has_payment_method')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setEmail(data.email ?? '');
        setBandName(data.username ?? '');
        setConcertCode(data.concert_code ?? '');

        if (data.stripe_connect_account_id && data.has_payment_method) {
          setPayoutsState('active');
        } else if (data.stripe_connect_account_id) {
          setPayoutsState('setup_in_progress');
        } else {
          setPayoutsState('not_connected');
        }
      }

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
          body: JSON.stringify({ returnUrl: `${window.location.origin}/profile` }),
        }
      );
      if (!res.ok) {
        throw new Error('Failed to start onboarding.');
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setConnectLoading(false);
      setConnectError('Failed to connect. Please try again.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
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
          onClick={() => router.push('/dashboard')}
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
              <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6 }}>
                Your Stripe account is connected but setup is not complete. Log in to your Stripe dashboard to finish adding your bank account.
              </p>
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
              <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.6 }}>
                Your bank account is connected and ready to receive payouts from fan song requests.
              </p>
            </div>
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
    </div>
  );
}
