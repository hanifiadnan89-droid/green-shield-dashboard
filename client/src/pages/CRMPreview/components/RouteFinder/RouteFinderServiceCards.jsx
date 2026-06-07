import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import {
  ROUTE_FINDER_SERVICE_CARDS,
  COMMERCIAL_DURATION_OPTIONS,
} from './routeServiceTypes.js';

export default function RouteFinderServiceCards({
  isPage,
  selectedId,
  commercialDurationMinutes = 60,
  onSelect,
  onCommercialDurationChange,
  validationErrors = [],
}) {
  const labelClass = isPage
    ? 'rf-section-label'
    : 'type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1.5';

  return (
    <div className="rf-service-cards">
      <label className={labelClass}>Select Service</label>
      <p className="rf-service-cards__helper">
        Choose the service so Route Finder can estimate how much time this adds to the technician&apos;s route.
      </p>

      <div className="rf-service-cards__grid" role="radiogroup" aria-label="Select service type">
        {ROUTE_FINDER_SERVICE_CARDS.map(card => {
          const selected = selectedId === card.id;
          const durationLabel = card.isCommercial
            ? (selected ? `${commercialDurationMinutes} min route time` : card.durationRangeLabel)
            : `${card.durationMinutes} min route time`;

          return (
            <motion.button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[
                'rf-service-card',
                selected ? 'rf-service-card--selected' : '',
                card.isCommercial ? 'rf-service-card--commercial' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelect(card.id)}
              whileHover={{ y: -4, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <span className="rf-service-card__shine" aria-hidden />
              {selected && (
                <span className="rf-service-card__check" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <span className="rf-service-card__code">{card.code}</span>
              <span className="rf-service-card__title">{card.title}</span>
              <span className="rf-service-card__duration">{durationLabel}</span>
              <span className="rf-service-card__desc">{card.description}</span>

              {card.isCommercial && selected && (
                <div
                  className="rf-commercial-durations"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  role="group"
                  aria-label="Commercial duration"
                >
                  {COMMERCIAL_DURATION_OPTIONS.map(mins => (
                    <button
                      key={mins}
                      type="button"
                      className={[
                        'rf-commercial-durations__btn',
                        commercialDurationMinutes === mins ? 'rf-commercial-durations__btn--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => onCommercialDurationChange(mins)}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {validationErrors.length > 0 && (
        <p className="rf-service-cards__error" role="alert">
          {validationErrors.find(e => e.toLowerCase().includes('service')) || validationErrors[0]}
        </p>
      )}
    </div>
  );
}
