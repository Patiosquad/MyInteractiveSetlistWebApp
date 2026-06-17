'use client';

export default function PayoutsCompletePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#0a0a0a',
    }}>
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
        You&apos;re all set
      </h1>
      <p style={{ color: '#a1a1aa', fontSize: '0.9375rem', maxWidth: '380px', margin: 0 }}>
        Your payout account settings have been updated. You can close this tab and return to the SetTuner app.
      </p>
    </div>
  );
}
