'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bandName, setBandName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
        return;
      }
      setChecking(false);
    }
    checkSession();
  }, []);

  function switchMode(newMode: 'login' | 'signup') {
    setMode(newMode);
    setError('');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setBandName('');
  }

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Invalid email or password. Please try again.');
      return;
    }
    router.replace('/dashboard');
  }

  async function handleSignUp() {
    setError('');
    if (!firstName || !lastName || !email || !password || !bandName) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError || !authData.user) {
        setError('Sign up failed. Please try again.');
        setLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('users').insert({
        id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        email,
        username: bandName,
        role: 'performer',
      });
      setLoading(false);
      if (insertError) {
        await supabase.auth.signOut();
        setError('Account creation failed. Please try again.');
        return;
      }
      router.replace('/dashboard');
    } catch {
      setLoading(false);
      setError('Account creation failed. Please try again.');
    }
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#555', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <h1 style={{
        fontSize: '36px',
        fontWeight: '700',
        color: '#ffffff',
        margin: '0 0 4px',
        letterSpacing: '-0.5px',
      }}>
        SetList
      </h1>
      <p style={{
        fontSize: '11px',
        color: '#555',
        margin: '0 0 16px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
      }}>
        Performer Portal
      </p>

      <div style={{
        width: '30px',
        height: '2px',
        backgroundColor: '#2255ff',
        borderRadius: '1px',
        marginBottom: '24px',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#111111',
        border: '1px solid #2255ff',
        borderRadius: '16px',
        padding: '28px 24px',
        boxSizing: 'border-box',
      }}>

        {/* Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: '#1a1a1a',
          borderRadius: '10px',
          padding: '3px',
          marginBottom: '24px',
          gap: '3px',
        }}>
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: mode === m ? '#2255ff' : 'transparent',
                color: mode === m ? '#ffffff' : '#555555',
                transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Sign Up extra fields */}
        {mode === 'signup' && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Band Name</label>
              <input
                type="text"
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
                placeholder="Your band or stage name"
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Password'}
            style={inputStyle}
            onKeyDown={(e) => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleSignUp(); }}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{
            color: '#ff4444',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={mode === 'login' ? handleLogin : handleSignUp}
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px 0',
            backgroundColor: loading ? '#1a3acc' : '#2255ff',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </div>
    </div>
  );
}

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
