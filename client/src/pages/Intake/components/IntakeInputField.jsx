export default function IntakeInputField({
  id,
  label,
  icon: Icon,
  children,
  className = '',
  multiline = false,
}) {
  return (
    <div className={`intake-field ${multiline ? 'intake-field--multiline' : ''} ${className}`.trim()}>
      <label className="intake-label" htmlFor={id}>{label}</label>
      <div className="intake-field__control">
        {Icon ? <Icon size={16} className="intake-field__icon" aria-hidden /> : null}
        {children}
      </div>
    </div>
  );
}
