import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

/**
 * PremiumSelect — accessible custom dropdown used across Sales Coach.
 *
 * Props:
 *   value        current selected option id (string | '')
 *   onChange     fn(id) — receives '' when cleared
 *   options      [{ id, label }]
 *   icons        { [id]: LucideIcon }  optional
 *   placeholder  shown when no value
 *   icon         fallback icon when no value (LucideIcon)
 *   searchable   show search input inside menu
 *   align        'start' (default) | 'end'  — menu alignment vs trigger
 */
export default function PremiumSelect({
  value,
  onChange,
  options = [],
  icons = null,
  placeholder = 'Select…',
  icon: FallbackIcon = null,
  searchable = false,
  align = 'start',
}) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [activeIdx, setActive]  = useState(-1);

  const triggerRef = useRef(null);
  const menuRef    = useRef(null);
  const searchRef  = useRef(null);
  const listboxId  = useId();

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [searchable, query, options]);

  const current = options.find(o => o.id === value);
  const CurrentIcon = (icons && icons[value]) || (current ? FallbackIcon : FallbackIcon);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(-1);
    } else if (searchable && searchRef.current) {
      // small delay so the input mounts before focusing
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(i => Math.min(filtered.length - 1, i < 0 ? 0 : i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const pick = filtered[activeIdx];
        if (pick) {
          onChange(pick.id);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, activeIdx, filtered, onChange]);

  // Sync activeIdx to current value on open
  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex(o => o.id === value);
    setActive(idx >= 0 ? idx : 0);
  }, [open, value, filtered]);

  const handlePick = (id) => {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    triggerRef.current?.focus();
  };

  return (
    <div className={`pds${open ? ' pds--open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`pds__trigger${value ? ' pds__trigger--filled' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        {CurrentIcon && <CurrentIcon size={14} className="pds__trigger-icon" aria-hidden="true" />}
        <span className="pds__trigger-text">
          {current ? current.label : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear selection"
            className="pds__clear"
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e);
              }
            }}
          >
            <X size={11} aria-hidden="true" />
          </span>
        )}
        <ChevronDown size={13} className="pds__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={listboxId}
          className={`pds__menu pds__menu--${align}`}
          role="listbox"
        >
          {searchable && (
            <div className="pds__search">
              <Search size={12} aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search…"
                aria-label="Search options"
              />
            </div>
          )}

          <div className="pds__list">
            {filtered.length === 0 ? (
              <div className="pds__empty">No matches</div>
            ) : (
              filtered.map((opt, i) => {
                const ItemIcon = icons?.[opt.id];
                const isSelected = value === opt.id;
                const isActive   = activeIdx === i;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={
                      'pds__option' +
                      (isSelected ? ' pds__option--selected' : '') +
                      (isActive   ? ' pds__option--active'   : '')
                    }
                    onClick={() => handlePick(opt.id)}
                    onMouseEnter={() => setActive(i)}
                    style={{ '--pds-i': i }}
                  >
                    {ItemIcon && <ItemIcon size={13} className="pds__option-icon" />}
                    <span className="pds__option-label">{opt.label}</span>
                    {isSelected && <Check size={13} className="pds__option-check" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
