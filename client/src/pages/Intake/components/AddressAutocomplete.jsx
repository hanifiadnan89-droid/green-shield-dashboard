import { useEffect, useRef } from 'react';
import { useIntakeGoogleMapsLoader } from '../../../hooks/useIntakeGoogleMapsLoader.js';
import { toLegacyAutocompletePlace } from './placeAutocompleteLegacy.js';

const PLACE_FIELDS = [
  'addressComponents',
  'formattedAddress',
  'location',
  'id',
  'types',
  'primaryType',
];

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Start typing service address…',
  disabled = false,
}) {
  const hostRef = useRef(null);
  const elementRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const { status } = useIntakeGoogleMapsLoader();

  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onChange, onPlaceSelected]);

  useEffect(() => {
    if (status !== 'ready' || !hostRef.current || disabled) return undefined;

    let cancelled = false;
    let element = null;

    const handleInput = () => {
      onChangeRef.current?.(element?.value || '');
    };

    const handleSelect = async (event) => {
      const placePrediction = event.placePrediction;
      if (!placePrediction) return;

      try {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: PLACE_FIELDS });
        onPlaceSelectedRef.current?.(toLegacyAutocompletePlace(place));
      } catch (err) {
        console.error('[Intake Autocomplete] place fetch failed:', err);
      }
    };

    (async () => {
      const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
      if (cancelled || !hostRef.current) return;

      element = new PlaceAutocompleteElement({
        includedRegionCodes: ['us'],
      });
      element.placeholder = placeholder;
      element.value = value || '';
      element.className = 'intake-place-autocomplete';

      element.addEventListener('gmp-select', handleSelect);
      element.addEventListener('input', handleInput);

      hostRef.current.replaceChildren(element);
      elementRef.current = element;
    })();

    return () => {
      cancelled = true;
      if (element) {
        element.removeEventListener('gmp-select', handleSelect);
        element.removeEventListener('input', handleInput);
      }
      elementRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [status, disabled, placeholder]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    element.disabled = disabled;
  }, [disabled]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || element.value === (value || '')) return;
    element.value = value || '';
  }, [value]);

  return (
    <div
      ref={hostRef}
      className={[
        'intake-address-autocomplete-host',
        (disabled || status === 'loading') ? 'intake-address-autocomplete-host--disabled' : '',
      ].filter(Boolean).join(' ')}
      aria-busy={status === 'loading'}
    />
  );
}
