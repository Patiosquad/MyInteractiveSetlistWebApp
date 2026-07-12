'use client';

import '../../../tokens/tokens.css';

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
  const [showPassword, setShowPassword] = useState(false);

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
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading...</div>
      </div>
    );
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

      <div style={{position:'absolute',left:'14%',bottom:'16%',width:'5px',height:'5px',borderRadius:'50%',background:'#ff8a3f',filter:'blur(0.5px)',animation:'emberDrift1 7s linear infinite'}} />
      <div style={{position:'absolute',left:'26%',bottom:'8%',width:'3px',height:'3px',borderRadius:'50%',background:'#ffb703',filter:'blur(0.5px)',animation:'emberDrift2 9s linear infinite',animationDelay:'1.4s'}} />
      <div style={{position:'absolute',left:'72%',bottom:'12%',width:'4px',height:'4px',borderRadius:'50%',background:'#ff5a1f',filter:'blur(0.5px)',animation:'emberDrift3 8s linear infinite',animationDelay:'0.6s'}} />
      <div style={{position:'absolute',left:'84%',bottom:'20%',width:'3px',height:'3px',borderRadius:'50%',background:'#ffcf6b',filter:'blur(0.5px)',animation:'emberDrift1 10s linear infinite',animationDelay:'3s'}} />
      <div style={{position:'absolute',left:'58%',bottom:'6%',width:'3px',height:'3px',borderRadius:'50%',background:'#ff8a3f',filter:'blur(0.5px)',animation:'emberDrift2 8.5s linear infinite',animationDelay:'4.2s'}} />
      <div style={{position:'absolute',left:'40%',bottom:'10%',width:'2px',height:'2px',borderRadius:'50%',background:'#ffb703',filter:'blur(0.5px)',animation:'emberDrift3 11s linear infinite',animationDelay:'2.2s'}} />

      <div style={{textAlign:'center',marginBottom:'8px'}}>
        <span style={{fontWeight:900,fontSize:'clamp(52px,7vw,96px)',letterSpacing:'-0.02em',color:'var(--text-primary)',lineHeight:1}}>Set</span>
        <span style={{fontWeight:900,fontSize:'clamp(52px,7vw,96px)',letterSpacing:'-0.02em',color:'var(--accent)',lineHeight:1}}>Tuner</span>
      </div>
      <div style={{color:'var(--text-secondary)',fontSize:'clamp(11px,1.2vw,14px)',fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',textAlign:'center',marginBottom:'4px'}}>Live Music · Fan Powered</div>
      <div style={{color:'var(--text-faint)',fontSize:'11px',fontWeight:500,letterSpacing:'0.14em',textTransform:'uppercase',textAlign:'center',marginBottom:'32px'}}>Performer Portal</div>

      <div style={{background:'var(--bg-tile)',border:'1px solid var(--border)',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'420px',position:'relative',zIndex:1}}>

        {/* Toggle */}
        <div style={{display:'flex',background:'var(--bg-tile-deep)',borderRadius:'30px',padding:'4px',marginBottom:'24px'}}>
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '26px',
                border: 'none',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === m ? 700 : 500,
                fontSize: '15px',
                cursor: 'pointer',
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
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Password'}
              style={{ ...inputStyle, paddingRight: '44px' }}
              onKeyDown={(e) => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleSignUp(); }}
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

        {/* Error */}
        {error && (
          <p style={{
            color: 'var(--danger)',
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
          style={{width:'100%',background:'var(--accent)',color:'var(--text-primary)',border:'none',borderRadius:'30px',padding:'14px 0',fontWeight:700,fontSize:'16px',cursor:'pointer',marginTop:'8px'}}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </div>

      <div className="ember-baseline" />
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
      @media (max-width: 480px) {
        .login-atmosphere {
          background:
            radial-gradient(90% 45% at 20% -6%, rgba(255,90,31,0.26), rgba(10,8,6,0) 62%),
            radial-gradient(90% 45% at 80% -6%, rgba(255,183,3,0.14), rgba(10,8,6,0) 62%),
            radial-gradient(110% 40% at 50% 108%, rgba(255,90,31,0.14), rgba(10,8,6,0) 68%),
            var(--bg-primary);
        }
      }
      .login-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(95% 85% at 50% 45%, rgba(10,8,6,0) 52%, rgba(5,4,3,0.55) 100%);
      }
      .ember-baseline {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: linear-gradient(to right, var(--accent), var(--gold));
      }
      @keyframes emberDrift1 {
        0%   { transform: translate(0,0);          opacity: 0; }
        12%  { opacity: 0.8; }
        88%  { opacity: 0.5; }
        100% { transform: translate(24px,-190px);  opacity: 0; }
      }
      @keyframes emberDrift2 {
        0%   { transform: translate(0,0);          opacity: 0; }
        15%  { opacity: 0.6; }
        85%  { opacity: 0.35; }
        100% { transform: translate(-30px,-230px); opacity: 0; }
      }
      @keyframes emberDrift3 {
        0%   { transform: translate(0,0);          opacity: 0; }
        10%  { opacity: 0.7; }
        90%  { opacity: 0.4; }
        100% { transform: translate(14px,-160px);  opacity: 0; }
      }
      .login-atmosphere input:-webkit-autofill,
      .login-atmosphere input:-webkit-autofill:hover,
      .login-atmosphere input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px var(--bg-tile-deep) inset !important;
        -webkit-text-fill-color: var(--text-primary) !important;
        caret-color: var(--text-primary);
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
