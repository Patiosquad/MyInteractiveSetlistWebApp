import '../../../tokens/tokens.css';

export default function TermsPage() {
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
          These terms are currently pending final attorney review.
        </div>

        <h1 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: 'clamp(24px,3vw,32px)', marginBottom: '8px' }}>
          TERMS OF SERVICE
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '36px' }}>
          Last updated: [DATE TO BE SET AT PUBLICATION]
        </p>

        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of SetTuner, operated by CL Music Ventures LLC (&quot;SetTuner,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a Georgia limited liability company. By creating an account or using SetTuner, you agree to these Terms.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          1. WHAT SETTUNER IS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          SetTuner is a platform that connects Fans and Performers at live, in-person musical performances. Fans may contribute toward songs, from a Performer&apos;s chosen repertoire, that they would like the Performer to play during a live concert. Performers review requests and decide, at their sole discretion, which songs to accept and play.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          SetTuner is not the Performer, does not control what any Performer chooses to play, and does not guarantee that any specific song will be played. A higher-ranked request may have better odds of being selected, but selection is never guaranteed.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          2. ACCOUNTS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          You must create an account to use SetTuner as a Fan or a Performer. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate information and keep it up to date.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          You must be at least 18 years old, or the age of majority in your jurisdiction, to create a SetTuner account.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          3. CONTRIBUTIONS AND PAYMENTS
        </h2>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Authorization, Not Immediate Charge</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          When you contribute toward a song request, your payment method is authorized for the contribution amount. You are not charged at this time.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Capture Only If Played</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          You are charged the authorized amount only if the Performer accepts and plays your requested song during the live concert. If the song is not played by the end of the concert, the authorization is released and you are never charged.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Contribution Limits</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Each individual contribution is subject to a minimum of $1 and a maximum of $99. This cap applies per contribution, not per song or per concert: you may make multiple contributions, including multiple contributions toward the same song request, each subject to the $1–$99 range.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Platform Fee</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          SetTuner retains a 15% platform fee on captured contributions. The remaining amount is paid out to the Performer.
        </p>

        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Payment Processing</h3>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          All payments are processed by Stripe. By using SetTuner, you also agree to Stripe&apos;s applicable terms governing payment processing.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          4. PERFORMER OBLIGATIONS AND DISCRETION
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Performers determine, in advance, which songs are eligible for requests during a concert. During the concert, Performers may accept or decline any request at their sole discretion, regardless of its position on the leaderboard. SetTuner does not require any Performer to play any specific song.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          Performers are responsible for receiving payouts through their connected Stripe account and for complying with applicable tax obligations related to payouts they receive.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          5. PROHIBITED CONDUCT
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '8px' }}>
          You agree not to:
        </p>
        <ul style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px', paddingLeft: '22px' }}>
          <li>Use SetTuner for any unlawful purpose</li>
          <li>Attempt to manipulate the leaderboard or contribution system outside of its intended use</li>
          <li>Interfere with or disrupt the operation of the platform or its underlying infrastructure</li>
          <li>Impersonate any person or misrepresent your affiliation with any person or entity</li>
          <li>Attempt to circumvent SetTuner&apos;s payment or fee structure</li>
        </ul>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We reserve the right to suspend or terminate accounts that violate these Terms.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          6. DISPUTES AND REFUND REQUESTS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '20px' }}>
          Because you are only charged when a song is accepted and played, most disputes should not involve a captured charge for an unplayed song. If you believe a charge is incorrect, contact us at business@settuner.com within 30 days of the charge and we will investigate.
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          If SetTuner determines that a technical or processing error on our part resulted in an incorrect charge, we will refund the affected amount in full. This refund commitment applies to errors in SetTuner&apos;s own systems or processing; it does not extend to disputes about a Performer&apos;s decision to accept or decline a request, which is at the Performer&apos;s sole discretion under Section 4. Requests made more than 30 days after the charge date may not be eligible for a refund under this section.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          7. DISCLAIMERS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          SetTuner is provided &quot;as is&quot; and &quot;as available.&quot; We do not guarantee that the platform will be uninterrupted, error-free, or available at all times. We do not guarantee the conduct of any Performer or Fan, or that any particular song will be played at any concert.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          8. LIMITATION OF LIABILITY
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          To the fullest extent permitted by law, CL Music Ventures LLC and its officers, employees, and agents will not be liable for any indirect, incidental, special, or consequential damages arising out of your use of SetTuner. Our total liability for any claim arising out of these Terms will not exceed the total amount of fees paid by you to SetTuner in the twelve months preceding the claim.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          9. GOVERNING LAW
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          These Terms are governed by the laws of the State of Georgia, without regard to its conflict-of-laws principles.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          10. CHANGES TO THESE TERMS
        </h2>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, marginBottom: '36px' }}>
          We may update these Terms from time to time. Material changes will be reflected by an updated &quot;Last updated&quot; date at the top of this page. Continued use of SetTuner after changes take effect constitutes acceptance of the revised Terms.
        </p>

        <h2 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '19px', marginTop: '32px', marginBottom: '14px' }}>
          11. CONTACT US
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
