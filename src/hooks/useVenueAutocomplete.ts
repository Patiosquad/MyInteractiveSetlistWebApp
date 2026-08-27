'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type VenuePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
};

export type VenueDetailsResult = {
  city: string;
  country: string;
  state: string;
};

const VENUE_LOOKUP_UNAVAILABLE =
  'Venue lookup is unavailable right now. You can type the venue name manually.';

async function callPlacesProxy(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/places-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

interface UseVenueAutocompleteOptions {
  venueName: string;
  onVenueNameChange: (name: string) => void;
  onDetailsSelected: (details: VenueDetailsResult) => void;
}

export function useVenueAutocomplete({ venueName, onVenueNameChange, onDetailsSelected }: UseVenueAutocompleteOptions) {
  const [venuePredictions, setVenuePredictions] = useState<VenuePrediction[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);

  const venueWrapperRef = useRef<HTMLDivElement>(null);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const venueJustSelectedRef = useRef(false);

  useEffect(() => {
    if (venueJustSelectedRef.current) {
      venueJustSelectedRef.current = false;
      return;
    }
    if (venueName.trim().length < 3) {
      setVenuePredictions([]);
      setShowVenueSuggestions(false);
      setVenueError(null);
      return;
    }
    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
    venueDebounceRef.current = setTimeout(async () => {
      try {
        const { ok, status, json } = await callPlacesProxy({ operation: 'autocomplete', input: venueName.trim() });
        if (!ok) {
          console.error(`[venue-autocomplete] proxy returned non-ok | http=${status} | error=${json?.error ?? 'none'} | googleStatus=${json?.status ?? 'none'} | detail=${json?.detail ?? 'none'}`);
          setVenuePredictions([]);
          setShowVenueSuggestions(false);
          setVenueError(VENUE_LOOKUP_UNAVAILABLE);
          return;
        }
        const predictions: VenuePrediction[] = json?.predictions ?? [];
        setVenuePredictions(predictions);
        setShowVenueSuggestions(predictions.length > 0);
        setVenueError(null);
      } catch (err) {
        console.error('[venue-autocomplete] proxy call threw:', err);
        setVenuePredictions([]);
        setShowVenueSuggestions(false);
        setVenueError(VENUE_LOOKUP_UNAVAILABLE);
      }
    }, 300);
    return () => { if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current); };
  }, [venueName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (venueWrapperRef.current && !venueWrapperRef.current.contains(e.target as Node)) {
        setShowVenueSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSelectVenue(prediction: VenuePrediction) {
    const mainText = prediction.structured_formatting?.main_text ?? prediction.description;

    venueJustSelectedRef.current = true;
    onVenueNameChange(mainText);
    setShowVenueSuggestions(false);
    setVenuePredictions([]);
    setVenueError(null);

    try {
      const { ok, status, json } = await callPlacesProxy({ operation: 'details', place_id: prediction.place_id });
      if (!ok) {
        console.error(`[venue-details] proxy returned non-ok | http=${status} | error=${json?.error ?? 'none'} | googleStatus=${json?.status ?? 'none'} | detail=${json?.detail ?? 'none'}`);
        setVenueError(VENUE_LOOKUP_UNAVAILABLE);
        return;
      }

      const placeName: string | undefined = json?.result?.name;
      if (placeName && placeName !== mainText) {
        venueJustSelectedRef.current = true;
        onVenueNameChange(placeName);
      }

      const components: Array<{ types?: string[]; long_name?: string; short_name?: string }> = json?.result?.address_components ?? [];

      const get = (type: string, key: 'long_name' | 'short_name' = 'long_name') =>
        components.find((c) => (c.types ?? []).includes(type))?.[key] ?? '';

      const cityValue = get('locality') || get('postal_town') || get('sublocality_level_1');
      const countryLong = get('country', 'long_name');
      const stateLong = get('administrative_area_level_1', 'long_name');

      onDetailsSelected({ city: cityValue, country: countryLong, state: stateLong });
    } catch (err) {
      console.error('[venue-details] threw while parsing response:', err);
      setVenueError(VENUE_LOOKUP_UNAVAILABLE);
    }
  }

  return {
    venuePredictions,
    showVenueSuggestions,
    venueError,
    venueWrapperRef,
    handleSelectVenue,
    onVenueFocus: () => { if (venuePredictions.length > 0) setShowVenueSuggestions(true); },
  };
}
