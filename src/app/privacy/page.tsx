import '../../../tokens/tokens.css';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,183,3,0.12)',
            border: '1px solid var(--gold)',
            borderRadius: '10px',
            padding: '14px 18px',
            color: 'var(--gold)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '32px',
          }}
        >
          This policy is currently pending final attorney review.
        </div>

        <h1 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 'clamp(24px,3vw,32px)', marginBottom: '8px' }}>
          PRIVACY POLICY
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '36px' }}>
          Last updated: August 6, 2026
        </p>

        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          SetTuner is operated by CL Music Ventures LLC (&quot;SetTuner,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a Georgia limited liability company. This Privacy Policy explains what information we collect, how we use it, and the choices you have.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          This policy applies to the SetTuner Fan app (iOS), the SetTuner Performer app (iOS), and the SetTuner Performer web portal (settuner.com).
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          1. INFORMATION WE COLLECT
        </h2>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Account Information</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          When you create a SetTuner account, we collect your email address and a securely hashed password. We do not store your password in plain text.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Payment Information</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          When you make a contribution or receive a payout, payment processing is handled entirely by Stripe, our payment processor. SetTuner does not collect or store your full card number, and does not have access to it. Stripe&apos;s own privacy policy governs the information it collects directly from you.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Device Identifiers</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          We collect limited device information (such as device type and a device identifier) to support app functionality, security, and fraud prevention.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Concert and Venue Information</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          When a Performer creates a concert, they may search for and select the concert venue using Google Maps. If selected, the venue&apos;s address is attached to the concert record. Fan participants are associated with the concert they join, along with their song requests and contribution activity for that concert.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          2. HOW WE USE YOUR INFORMATION
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '8px' }}>
          We use the information we collect to:
        </p>
        <ul style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px', paddingLeft: '22px' }}>
          <li>Create and maintain your SetTuner account</li>
          <li>Match Fans to the correct concert and performer</li>
          <li>Process contributions, including authorizing and, where a song is accepted and played, capturing payment</li>
          <li>Display the real-time leaderboard during a concert</li>
          <li>Process payouts to Performers</li>
          <li>Identify and attach venue location information when a Performer creates a concert</li>
          <li>Maintain the security and integrity of the SetTuner platform</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          3. THIRD-PARTY SERVICE PROVIDERS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          We share information with the following third-party service providers, solely to operate SetTuner:
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Stripe — payment processing, including authorization holds and capture of contributions, and payouts to Performers. Stripe maintains its own privacy policy governing payment data.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Supabase — our backend infrastructure provider, hosting our database, authentication system, and real-time leaderboard functionality.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Spotify API — used to retrieve song and artist metadata (such as song titles and album art) displayed within the app. We do not share your account information with Spotify through this integration.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Google Maps — used by Performers to search for and select a concert venue when creating a concert, so that an accurate venue address can be attached to the concert record. Google&apos;s own privacy policy governs this lookup.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We do not sell your personal information to third parties.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          4. DATA RETENTION
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We retain account information for as long as your account remains active. When you delete your account, your profile information and sign-in credentials are permanently removed. Concert and contribution records are retained in anonymized form, no longer linked to your name or contact information, because these records are also part of the financial history of the performers and fans you interacted with, and are needed for accurate financial, tax, and payment dispute purposes.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          5. YOUR RIGHTS AND CHOICES
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          You can delete your account at any time from the Profile screen in the SetTuner mobile app, or from your Profile page at settuner.com. Deleting your account permanently removes your profile and sign-in credentials, and you will no longer be able to sign in. Concert and contribution records are retained in anonymized form as described in Section 4.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          If you have contributions or payments that are still settling, account deletion is temporarily unavailable until they finish processing, and the app will tell you what needs to resolve first. Performers who have connected a Stripe account should note that deleting a SetTuner account does not close or delete that Stripe account, which remains subject to Stripe&apos;s own terms and processes. You may also request access to or correction of your personal information by contacting us at business@settuner.com.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          If you are a resident of a jurisdiction that grants additional data rights (such as the right to data portability or to opt out of certain processing), contact us and we will respond consistent with applicable law.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          6. CHILDREN&apos;S PRIVACY
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          SetTuner is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us at business@settuner.com and we will take appropriate steps to remove it.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          7. DATA SECURITY
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We use reasonable technical and organizational measures to protect your information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          8. CHANGES TO THIS POLICY
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We may update this Privacy Policy from time to time. Material changes will be reflected by an updated &quot;Last updated&quot; date at the top of this page.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          9. CONTACT US
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8 }}>
          CL Music Ventures LLC<br />
          Georgia, USA<br />
          business@settuner.com
        </p>
      </div>
    </div>
  );
}
