import { useEffect, useRef } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Start typing service address…',
  disabled = false,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const { status } = useIntakeGoogleMapsLoader();

  useEffect(() => {
    if (status !== 'ready' || !inputRef.current || disabled) return undefined;

    const maps = window.google.maps;
    const autocomplete = new maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'geometry', 'place_id', 'types'],
      types: ['address'],
    });

    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place) return;
      onPlaceSelected?.(place);
    });

    return () => {
      if (listener) maps.event.removeListener(listener);
      autocompleteRef.current = null;
    };
  }, [status, disabled, onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      className="intake-input"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled || status === 'loading'}
      autoComplete="off"
    />
  );
}
