'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Mexico',
  'France', 'Germany', 'Spain', 'Italy', 'Japan', 'Brazil', 'India',
  'China', 'Other',
];

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

const inputStyle = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.5rem',
  border: '1px solid #27272a',
  background: '#18181b',
  color: '#ffffff',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23a1a1aa' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.875rem center',
  paddingRight: '2.5rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.875rem',
  color: '#a1a1aa',
  marginBottom: '0.375rem',
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: '#f87171', marginLeft: '0.25rem' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewConcertPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Alabama');
  const [country, setCountry] = useState('United States');
  const [startHour, setStartHour] = useState('8');
  const [startMinute, setStartMinute] = useState('00');
  const [startAmPm, setStartAmPm] = useState('PM');
  const [lengthHours, setLengthHours] = useState('1');
  const [comments, setComments] = useState('');

  const isUS = country === 'United States';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login');
      } else {
        setUserId(user.id);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !venueName.trim() || !city.trim() || !country.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setSubmitting(true);

    const estimatedStart = `${startHour}:${startMinute} ${startAmPm}`;
    const estimatedLength = `${lengthHours} ${lengthHours === '1' ? 'hour' : 'hours'}`;

    const { data, error: insertError } = await supabase
      .from('concerts')
      .insert({
        performer_id: userId,
        name: name.trim(),
        venue_name: venueName.trim(),
        city: city.trim(),
        state: isUS ? state : null,
        country: country.trim(),
        estimated_start: estimatedStart,
        estimated_length: estimatedLength,
        comments: comments.trim() || null,
        status: 'building',
      })
      .select('id')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to save concert. Please try again.');
      setSubmitting(false);
      return;
    }

    router.push(`/concerts/${data.id}`);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #27272a', padding: '1rem 2rem' }}>
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create Concert</h1>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #27272a',
              background: 'transparent',
              color: '#a1a1aa',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Form */}
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <Field label="Concert Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Venue Name" required>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Country" required>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={selectStyle}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: isUS ? '1fr 1fr' : '1fr', gap: '1rem' }}>
            <Field label="City" required>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
            </Field>
            {isUS && (
              <Field label="State" required>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={selectStyle}
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {/* Estimated Start Time */}
          <div>
            <label style={labelStyle}>Estimated Start Time</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                style={{ ...selectStyle, width: 'auto', flex: '1' }}
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span style={{ color: '#a1a1aa', fontWeight: 700, flexShrink: 0 }}>:</span>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                style={{ ...selectStyle, width: 'auto', flex: '1' }}
              >
                {['00', '15', '30', '45'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={startAmPm}
                onChange={(e) => setStartAmPm(e.target.value)}
                style={{ ...selectStyle, width: 'auto', flex: '1' }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          {/* Estimated Length */}
          <Field label="Estimated Length">
            <select
              value={lengthHours}
              onChange={(e) => setLengthHours(e.target.value)}
              style={selectStyle}
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                <option key={h} value={h}>{h === '1' ? '1 hour' : `${h} hours`}</option>
              ))}
            </select>
          </Field>

          <Field label="Comments">
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: submitting ? '#3f3f46' : '#ffffff',
              color: submitting ? '#a1a1aa' : '#09090b',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Save & Add Songs'}
          </button>
        </form>
      </main>
    </div>
  );
}
