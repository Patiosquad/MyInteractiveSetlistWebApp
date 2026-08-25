'use client';

import '../../../tokens/tokens.css';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const LINK_DEAD_MESSAGE =
  'This password reset link is no longer valid. It may have expired or already been used. Request a new one from the login screen.';

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<'loading' | 'form' | 'dead' | 'done'>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function establish() {
      const hash = typeof window === 'undefined' ? '' : window.location.hash;
      if (!hash || hash.length < 2) {
        setPhase('dead');
        return;
      }
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) {
        setPhase('dead');
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        setPhase('dead');
        return;
      }
      setSessionReady(true);
      setPhase('form');
    }
    establish();
  }, []);

  async function handleSave() {
    setError('');
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password.length > 72) {
      setError('Password must be 72 characters or fewer.');
      return;
    }
    if (!sessionReady) {
      setError(LINK_DEAD_MESSAGE);
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut();
    setSaving(false);
    setPhase('done');
  }

  return (
    <>
    <div
      className="login-atmosphere"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: '40px',
      }}
    >
      <div className="login-vignette" />

      <div style={{textAlign:'center',marginBottom:'8px'}}>
        <span style={{fontWeight:900,fontSize:'clamp(52px,7vw,96px)',letterSpacing:'-0.02em',color:'var(--text-primary)',lineHeight:1}}>Set</span>
        <span style={{fontWeight:900,fontSize:'clamp(52px,7vw,96px)',letterSpacing:'-0.02em',color:'var(--accent)',lineHeight:1}}>Tuner</span>
      </div>
      <div style={{color:'var(--text-faint)',fontSize:'11px',fontWeight:500,letterSpacing:'0.14em',textTransform:'uppercase',textAlign:'center',marginBottom:'32px'}}>Reset Password</div>

      <div style={{background:'var(--bg-tile)',border:'1px solid var(--border)',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'420px',position:'relative',zIndex:1}}>

        {phase === 'loading' && (
          <p style={{color:'var(--text-muted)',fontSize:'14px',textAlign:'center',margin:0}}>Loading...</p>
        )}

        {phase === 'dead' && (
          <>
            <p style={{color:'var(--danger)',fontSize:'14px',textAlign:'center',marginTop:0,marginBottom:'20px',lineHeight:1.5}}>
              {LINK_DEAD_MESSAGE}
            </p>
            <Link href="/login" style={{display:'block',textAlign:'center',color:'var(--accent)',fontSize:'14px',fontWeight:600,textDecoration:'none'}}>
              Back to login
            </Link>
          </>
        )}

        {phase === 'done' && (
          <>
            <p style={{color:'var(--text-primary)',fontSize:'15px',textAlign:'center',marginTop:0,marginBottom:'8px',fontWeight:600}}>
              Your password has been changed.
            </p>
            <p style={{color:'var(--text-secondary)',fontSize:'14px',textAlign:'center',marginTop:0,marginBottom:'20px',lineHeight:1.5}}>
              Sign in with your new password - performers at settuner.com, fans in the SetTuner app.
            </p>
            <Link href="/login" style={{display:'block',textAlign:'center',color:'var(--accent)',fontSize:'14px',fontWeight:600,textDecoration:'none'}}>
              Go to login
            </Link>
          </>
        )}

        {phase === 'form' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  style={{ ...inputStyle, paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0}}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>

            {error && (
              <p style={{color:'var(--danger)',fontSize:'13px',marginBottom:'16px',textAlign:'center',lineHeight:1.5}}>
                {error}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{width:'100%',background:'var(--accent)',color:'var(--text-primary)',border:'none',borderRadius:'30px',padding:'14px 0',fontWeight:700,fontSize:'16px',cursor:'pointer',marginTop:'8px'}}
            >
              {saving ? 'Please wait...' : 'Change Password'}
            </button>

            <Link href="/login" style={{display:'block',textAlign:'center',color:'var(--text-muted)',fontSize:'13px',marginTop:'16px',textDecoration:'none'}}>
              Cancel
            </Link>
          </>
        )}

      </div>
    </div>
    <style>{`
      .login-atmosphere {
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(50% 70% at 18% -8%, rgba(255,90,31,0.26), rgba(10,8,6,0) 60%),
          radial-gradient(50% 70% at 82% -8%, rgba(255,183,3,0.14), rgba(10,8,6,0) 60%),
          radial-gradient(70% 55% at 50% 112%, rgba(255,90,31,0.14), rgba(10,8,6,0) 65%),
          var(--bg-primary);
      }
      .login-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(95% 85% at 50% 45%, rgba(10,8,6,0) 52%, rgba(5,4,3,0.55) 100%);
      }
      .login-atmosphere input::placeholder {
        color: var(--text-muted);
      }
    `}</style>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-faint)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-tile-deep)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  boxSizing: 'border-box',
};
