import Link from 'next/link';
import '../../tokens/tokens.css';

export default function Home() {
  return (
    <>
      <div className="landing-hero" style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px 64px' }}>
        <div className="landing-vignette" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontWeight: 900, fontSize: 'clamp(52px,7vw,96px)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>Set</span>
            <span style={{ fontWeight: 900, fontSize: 'clamp(52px,7vw,96px)', letterSpacing: '-0.02em', color: 'var(--accent)', lineHeight: 1 }}>Tuner</span>
          </div>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(32px,5vw,56px)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '20px' }}>
            You help tune the set.
          </h1>
          <p style={{ color: 'var(--text-primary)', opacity: 0.75, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.6, marginBottom: '28px' }}>
            SetTuner is a live-music request platform. At an in-person show, fans contribute toward the songs they most want to hear from the performer&apos;s repertoire for the night. Requests climb a real-time leaderboard the whole room can see, and the performer decides what to play.
          </p>
          <div style={{ background: 'var(--bg-tile)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', textAlign: 'left', marginBottom: '36px' }}>
            <h2 style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 'clamp(20px,2.6vw,26px)', marginBottom: '16px' }}>
              Only pay for what you actually hear.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
              Your contribution is authorized, not charged. You&apos;re billed only if the performer accepts and plays your song live — if it isn&apos;t played, the authorization is released and no money ever leaves your account.
            </p>
          </div>
          <Link
            href="/login"
            style={{ display: 'inline-block', background: 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '30px', padding: '14px 28px', fontWeight: 700, fontSize: '16px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Performer Login / Sign Up
          </Link>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '14px' }}>
            Fan iOS app coming soon.
          </div>
        </div>
      </div>

      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 64px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'clamp(20px,2.6vw,26px)', marginBottom: '16px' }}>
          What is SetTuner?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
          SetTuner turns song requests into a live, transparent experience. Instead of pushing your way to the front to shout a request or hand the performer cash, you back the songs you want to hear right from your seat during a live, in-person performance. The performer watches the leaderboard update in real time and chooses which requests to accept and play.
        </p>
      </section>

      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 64px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'clamp(20px,2.6vw,26px)', marginBottom: '24px' }}>
          How it works
        </h2>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>1</div>
          <div>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>See tonight&apos;s repertoire.</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
              At a live performance, fans open SetTuner and see the catalog of songs the performer has personally chosen to make available for requests that night. Back the ones you most want to hear.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>2</div>
          <div>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>Contributions combine to power the leaderboard.</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
              Back a song once, or contribute again and again — contributions to the same song can add up to $999 per show. Every contribution combines with other fans backing the same song, raising it on the real-time leaderboard. Every fan sees the leaderboard in the app, and performers can broadcast it on the venue&apos;s screens for the whole audience.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>3</div>
          <div>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>The performer decides — and that&apos;s when you&apos;re charged.</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
              The performer chooses which songs to accept and play. A higher-ranked song has better odds of being chosen, but nothing is guaranteed. You&apos;re charged only when your requested song is accepted and performed live. If it isn&apos;t played, you&apos;re never charged.
            </p>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 64px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 'clamp(20px,2.6vw,26px)', marginBottom: '16px' }}>
          For performers
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7 }}>
          Performers curate the night&apos;s repertoire, review incoming requests during the concert, and get paid for the songs they play. Sign in to the Performer Portal to set up a concert.
        </p>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
          SetTuner is operated by CL Music Ventures LLC · Georgia, USA
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
          <a href="mailto:business@settuner.com" style={{ color: 'var(--text-muted)' }}>business@settuner.com</a>
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
          <Link href="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy Policy</Link>
          {' · '}
          <Link href="/terms" style={{ color: 'var(--text-muted)' }}>Terms of Service</Link>
        </p>
        <p style={{ color: 'var(--text-faint)', fontSize: '12px' }}>
          © 2026 CL Music Ventures LLC. All rights reserved.
        </p>
      </footer>

      <style>{`
        .landing-hero {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(50% 70% at 18% -8%, rgba(255,90,31,0.26), rgba(10,8,6,0) 60%),
            radial-gradient(50% 70% at 82% -8%, rgba(255,183,3,0.14), rgba(10,8,6,0) 60%),
            radial-gradient(70% 55% at 50% 112%, rgba(255,90,31,0.14), rgba(10,8,6,0) 65%),
            var(--bg-primary);
        }
        @media (max-width: 480px) {
          .landing-hero {
            background:
              radial-gradient(90% 45% at 20% -6%, rgba(255,90,31,0.26), rgba(10,8,6,0) 62%),
              radial-gradient(90% 45% at 80% -6%, rgba(255,183,3,0.14), rgba(10,8,6,0) 62%),
              radial-gradient(110% 40% at 50% 108%, rgba(255,90,31,0.14), rgba(10,8,6,0) 68%),
              var(--bg-primary);
          }
        }
        .landing-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(95% 85% at 50% 45%, rgba(10,8,6,0) 52%, rgba(5,4,3,0.55) 100%);
        }
      `}</style>
    </>
  );
}
