'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '../../../../tokens/tokens.css';

type VenueSuggestion = {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
};

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
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tile-deep)',
  color: 'var(--text-primary)',
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
  fontSize: '12px',
  color: 'var(--text-faint)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 600,
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
        {required && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
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
  const [showDate, setShowDate] = useState('');

  const [venueSuggestions, setVenueSuggestions] = useState<VenueSuggestion[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);

  const venueWrapperRef = useRef<HTMLDivElement>(null);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const venueJustSelectedRef = useRef(false);

  const isUS = country === 'United States';

  // Debounced venue autocomplete
  useEffect(() => {
    if (venueJustSelectedRef.current) {
      venueJustSelectedRef.current = false;
      return;
    }
    if (venueName.trim().length < 2) {
      setVenueSuggestions([]);
      setShowVenueSuggestions(false);
      return;
    }
    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
    venueDebounceRef.current = setTimeout(async () => {
      console.log('[venue autocomplete] debounce fired, venueName:', venueName.trim());
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(venueName.trim())}`);
        const data = await res.json();
        console.log('[venue autocomplete] response:', data);
        const suggestions: VenueSuggestion[] = data.suggestions ?? [];
        setVenueSuggestions(suggestions);
        setShowVenueSuggestions(suggestions.length > 0);
      } catch (err) {
        console.log('[venue autocomplete] fetch error:', err);
        setVenueSuggestions([]);
        setShowVenueSuggestions(false);
      }
    }, 300);
    return () => { if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current); };
  }, [venueName]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (venueWrapperRef.current && !venueWrapperRef.current.contains(e.target as Node)) {
        setShowVenueSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSelectVenue(suggestion: VenueSuggestion) {
    const pred = suggestion.placePrediction;
    const mainText = pred.structuredFormat.mainText.text;

    venueJustSelectedRef.current = true;
    setVenueName(mainText);
    setShowVenueSuggestions(false);
    setVenueSuggestions([]);

    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(pred.placeId)}`);
      const data = await res.json();

      // New Places API: top-level displayName and addressComponents
      const components: Array<{ types: string[]; longText: string; shortText: string }> = data.addressComponents ?? [];
      const placeName: string | undefined = data.displayName?.text;

      if (placeName && placeName !== mainText) {
        venueJustSelectedRef.current = true;
        setVenueName(placeName);
      }

      const get = (type: string, key: 'longText' | 'shortText' = 'longText') =>
        components.find((c) => c.types.includes(type))?.[key] ?? '';

      const cityValue = get('locality') || get('postal_town') || get('sublocality_level_1');
      if (cityValue) setCity(cityValue);

      const countryLong = get('country', 'longText');
      if (countryLong) {
        setCountry(COUNTRIES.find((c) => c === countryLong) ?? 'Other');
      }

      const stateLong = get('administrative_area_level_1', 'longText');
      if (stateLong && countryLong === 'United States') {
        setState(US_STATES.find((s) => s === stateLong) ?? 'Alabama');
      }
    } catch (err) {
      console.log('[venue details] fetch error:', err);
    }
  }

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
        show_date: showDate || null,
        estimated_length: estimatedLength,
        comments: comments.trim() || null,
        status: 'new',
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <style>{`
        .new-concert-input::placeholder { color: var(--text-faint); }
        .new-concert-input:focus { border-color: var(--accent); outline: none; }
      `}</style>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '16px 24px',
        background: 'radial-gradient(ellipse at top right, rgba(255,90,31,0.06) 0%, transparent 60%), var(--bg-primary)',
      }}>
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
        }}>
          {/* LEFT ZONE — Brand lockup */}
          <div style={{
            flexShrink: 0,
            width: 'clamp(200px, 18vw, 240px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingRight: '24px',
            borderRight: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 'clamp(24px, 2.5vw, 36px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
              <span style={{ color: 'var(--text-primary)' }}>Set</span><span style={{ color: 'var(--accent)' }}>Tuner</span>
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginTop: '4px' }}>
              Live Music &middot; Fan Powered
            </span>
          </div>

          {/* RIGHT ZONE — Page identity */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
            <h1 style={{ fontSize: 'clamp(18px, 2vw, 28px)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Create Concert
            </h1>
          </div>

          {/* FAR RIGHT — Cancel */}
          <div style={{ flexShrink: 0, marginLeft: '24px' }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Ember baseline */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '3px',
          background: 'linear-gradient(to right, var(--accent), var(--gold))',
        }} />
      </header>

      {/* Form */}
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', background: 'var(--bg-primary)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <Field label="Concert Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="new-concert-input" style={inputStyle}
            />
          </Field>

          <Field label="Venue Name" required>
            <div ref={venueWrapperRef} style={{ position: 'relative' }}>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                onFocus={() => { if (venueSuggestions.length > 0) setShowVenueSuggestions(true); }}
                className="new-concert-input" style={inputStyle}
                autoComplete="off"
              />
              {showVenueSuggestions && venueSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, backgroundColor: '#1c1c1e', border: '1px solid #3f3f46', borderRadius: 8, zIndex: 50, overflow: 'hidden' }}>
                  {venueSuggestions.map((suggestion, idx) => (
                    <button
                      key={suggestion.placePrediction.placeId}
                      type="button"
                      onClick={() => handleSelectVenue(suggestion)}
                      style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', cursor: 'pointer', background: 'transparent', border: 'none', borderTop: idx === 0 ? 'none' : '1px solid #3f3f46', color: '#ffffff', textAlign: 'left' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#27272a'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.placePrediction.structuredFormat.mainText.text}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.placePrediction.structuredFormat.secondaryText.text}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                className="new-concert-input" style={inputStyle}
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

          <div>
            <label style={labelStyle}>Show Date</label>
            <input
              type="date"
              value={showDate}
              onChange={(e) => setShowDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="new-concert-input"
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
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
              <span style={{ color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>:</span>
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
              className="new-concert-input"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = 'none'; }}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '16px 24px',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: submitting ? 'var(--border)' : 'var(--accent)',
              color: submitting ? 'var(--text-faint)' : 'var(--text-primary)',
              fontSize: '16px',
              fontWeight: 700,
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
