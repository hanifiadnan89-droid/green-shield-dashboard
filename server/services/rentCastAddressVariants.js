const STREET_TYPE_TO_ABBREV = {
  alley: 'Aly',
  avenue: 'Ave',
  boulevard: 'Blvd',
  circle: 'Cir',
  court: 'Ct',
  drive: 'Dr',
  highway: 'Hwy',
  lane: 'Ln',
  parkway: 'Pkwy',
  place: 'Pl',
  road: 'Rd',
  street: 'St',
  terrace: 'Ter',
  trail: 'Trl',
  way: 'Way',
};

const STREET_ABBREV_TO_TYPE = Object.fromEntries(
  Object.entries(STREET_TYPE_TO_ABBREV).map(([full, abbrev]) => [abbrev.toLowerCase(), full]),
);

function zip5(zip) {
  return String(zip || '').replace(/\D/g, '').slice(0, 5);
}

function cleanAddressString(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*(USA|United States|U\.S\.A\.|US)\s*$/i, '')
    .replace(/(\d{5})-\d{4}/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/, '')
    .trim();
}

export function formatRentCastAddress(street, city, state, zip) {
  const streetPart = String(street || '').trim();
  const cityPart = String(city || '').trim();
  const statePart = String(state || '').trim().toUpperCase();
  const zipPart = zip5(zip);

  if (!streetPart || !cityPart || !statePart || !zipPart) return null;
  return `${streetPart}, ${cityPart}, ${statePart}, ${zipPart}`;
}

export function stripUnitFromStreet(street) {
  return String(street || '')
    .replace(/\s+(?:#|apt\.?|apartment|unit|ste\.?|suite|bldg\.?|building|fl\.?|floor|rm\.?|room)\s*[#-]?\s*[\w-]+/gi, '')
    .replace(/\s+#\s*[\w-]+/g, '')
    .trim();
}

export function stripTrailingHouseLetter(street) {
  return String(street || '').replace(/^(\d+)[A-Za-z](?=\s)/, '$1').trim();
}

function titleCaseWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function expandStreetAbbreviations(street) {
  return String(street || '').replace(
    /\b(Aly|Ave|Blvd|Cir|Ct|Dr|Hwy|Ln|Pkwy|Pl|Rd|St|Ter|Trl|Way)\b/gi,
    (match) => {
      const full = STREET_ABBREV_TO_TYPE[match.toLowerCase()];
      return full ? titleCaseWord(full) : match;
    },
  );
}

export function contractStreetAbbreviations(street) {
  return String(street || '').replace(
    /\b(alley|avenue|boulevard|circle|court|drive|highway|lane|parkway|place|road|street|terrace|trail|way)\b/gi,
    (match) => {
      const abbrev = STREET_TYPE_TO_ABBREV[match.toLowerCase()];
      return abbrev || match;
    },
  );
}

function pushVariant(variants, seen, value) {
  const cleaned = cleanAddressString(value);
  if (!cleaned) return;
  const key = cleaned.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  variants.push(cleaned);
}

export function buildRentCastAddressVariants({
  street,
  city,
  state,
  zip,
  address,
  verifiedAddress,
}) {
  const variants = [];
  const seen = new Set();
  const streetPart = String(street || '').trim();
  const cityPart = String(city || '').trim();
  const statePart = String(state || '').trim().toUpperCase();
  const zipPart = zip5(zip);

  const componentVariants = [
    streetPart,
    expandStreetAbbreviations(streetPart),
    contractStreetAbbreviations(streetPart),
    stripUnitFromStreet(streetPart),
    stripTrailingHouseLetter(streetPart),
    stripTrailingHouseLetter(stripUnitFromStreet(streetPart)),
    stripUnitFromStreet(expandStreetAbbreviations(streetPart)),
    stripTrailingHouseLetter(expandStreetAbbreviations(streetPart)),
  ];

  if (cityPart && statePart && zipPart) {
    for (const candidateStreet of componentVariants) {
      if (!candidateStreet) continue;
      pushVariant(variants, seen, formatRentCastAddress(candidateStreet, cityPart, statePart, zipPart));
    }
  }

  pushVariant(variants, seen, verifiedAddress);
  pushVariant(variants, seen, address);

  if (verifiedAddress) {
    const withoutUnit = stripTrailingHouseLetter(stripUnitFromStreet(verifiedAddress));
    pushVariant(variants, seen, withoutUnit);
    pushVariant(variants, seen, expandStreetAbbreviations(withoutUnit));
    pushVariant(variants, seen, contractStreetAbbreviations(withoutUnit));
  }

  return variants;
}
