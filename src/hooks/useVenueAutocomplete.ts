'use client';

import { useState, useRef, useEffect } from 'react';

export type VenueSuggestion = {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
};

export type VenueDetailsResult = {
  city: string;
  country: string;
  state: string;
};

interface UseVenueAutocompleteOptions {
  venueName: string;
  onVenueNameChange: (name: string) => void;
  onDetailsSelected: (details: VenueDetailsResult) => void;
}

export function useVenueAutocomplete({ venueName, onVenueNameChange, onDetailsSelected }: UseVenueAutocompleteOptions) {
  const [venueSuggestions, setVenueSuggestions] = useState<VenueSuggestion[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);

  const venueWrapperRef = useRef<HTMLDivElement>(null);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const venueJustSelectedRef = useRef(false);

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
    onVenueNameChange(mainText);
    setShowVenueSuggestions(false);
    setVenueSuggestions([]);

    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(pred.placeId)}`);
      const data = await res.json();

      const components: Array<{ types: string[]; longText: string; shortText: string }> = data.addressComponents ?? [];
      const placeName: string | undefined = data.displayName?.text;

      if (placeName && placeName !== mainText) {
        venueJustSelectedRef.current = true;
        onVenueNameChange(placeName);
      }

      const get = (type: string, key: 'longText' | 'shortText' = 'longText') =>
        components.find((c) => c.types.includes(type))?.[key] ?? '';

      const cityValue = get('locality') || get('postal_town') || get('sublocality_level_1');
      const countryLong = get('country', 'longText');
      const stateLong = get('administrative_area_level_1', 'longText');

      onDetailsSelected({ city: cityValue, country: countryLong, state: stateLong });
    } catch (err) {
      console.log('[venue details] fetch error:', err);
    }
  }

  return {
    venueSuggestions,
    showVenueSuggestions,
    venueWrapperRef,
    handleSelectVenue,
    onVenueFocus: () => { if (venueSuggestions.length > 0) setShowVenueSuggestions(true); },
  };
}
