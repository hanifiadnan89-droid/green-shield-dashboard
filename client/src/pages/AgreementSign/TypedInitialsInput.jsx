import { useEffect, useRef, useState } from 'react';
import { normalizeInitialsInput } from './initialsToPng.js';

export default function TypedInitialsInput({
  label = 'Type your initials',
  hint = 'Use your keyboard, then tap Done.',
  initialValue = '',
  onDone,
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(() => normalizeInitialsInput(initialValue));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(event) {
    setValue(normalizeInitialsInput(event.target.value));
  }

  function handleDone() {
    const normalized = normalizeInitialsInput(value);
    if (!normalized) return;
    onDone?.(normalized);
  }

  return (
    <div className="typed-initials-input">
      <div className="typed-initials-input__header">
        <p className="typed-initials-input__title">{label}</p>
        {hint ? <p className="typed-initials-input__hint">{hint}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="text"
        className="typed-initials-input__field"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={6}
        placeholder="e.g. JD"
        value={value}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleDone();
          }
        }}
      />

      <p className="typed-initials-input__preview-label">Preview</p>
      <div className="typed-initials-input__preview" aria-live="polite">
        {value || <span className="typed-initials-input__preview-placeholder">Your initials</span>}
      </div>

      <div className="typed-initials-input__actions">
        <button
          type="button"
          className="typed-initials-input__primary"
          onClick={handleDone}
          disabled={!value.trim()}
        >
          Done
        </button>
      </div>
    </div>
  );
}
