import AnimatedNumber from '../../../components/AnimatedNumber.jsx';

const COLOR_MAP = {
  green:  { iconBg: '#dcfce7', iconColor: '#16A34A', cardBg: '#f0fdf4', cardBorder: 'rgba(22,163,74,0.15)' },
  blue:   { iconBg: '#dbeafe', iconColor: '#2563EB', cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)' },
  purple: { iconBg: '#f3e8ff', iconColor: '#9333EA', cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)' },
  amber:  { iconBg: '#fef3c7', iconColor: '#D97706', cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)' },
  red:    { iconBg: '#fee2e2', iconColor: '#DC2626', cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)' },
  slate:  { iconBg: '#f1f5f9', iconColor: '#64748B', cardBg: '#ffffff', cardBorder: 'rgba(0,0,0,0.07)' },
};

export default function MetricCard({ label, value, icon: Icon, color = 'slate', hero, urgent, loading, subtitle, link, filterKey, onFilterChange, isActive }) {
  const c = COLOR_MAP[color] || COLOR_MAP.slate;
  const isUrgent = urgent && value > 0;
  const clickable = !!onFilterChange;

  function handleClick() {
    if (!onFilterChange) return;
    onFilterChange(isActive && filterKey !== 'all' ? 'all' : filterKey);
  }

  const inner = (
    <div
      className={`bento-card p-card p-card-lift flex flex-col justify-between ${hero ? 'p-6' : 'p-5'} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        background: isActive ? c.cardBg : c.cardBg,
        borderColor: isActive ? c.iconColor : isUrgent ? 'rgba(220,38,38,0.25)' : c.cardBorder,
        boxShadow: isActive
          ? `0 0 0 3px ${c.iconColor}22, 0 1px 3px rgba(0,0,0,0.05)`
          : undefined,
        minHeight: hero ? '148px' : '136px',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
      }}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div
          style={{ background: c.iconBg, borderRadius: '12px', padding: hero ? '10px' : '9px', display: 'inline-flex' }}
        >
          <Icon size={hero ? 20 : 18} style={{ color: c.iconColor }} />
        </div>
        {isUrgent && (
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mt-1" />
        )}
      </div>

      <div>
        {loading ? (
          <>
            <div className="skeleton mb-2" style={{ height: hero ? '40px' : '32px', width: '56px' }} />
            <div className="skeleton h-2.5 w-20" />
          </>
        ) : (
          <>
            <p
              className="font-heading font-bold tracking-tight text-[#0F172A] leading-none mb-1.5"
              style={{ fontSize: hero ? '40px' : '30px' }}
            >
              <AnimatedNumber value={value ?? 0} />
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8] flex items-center gap-1.5">
              {label}
              {isActive && (
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.iconColor, display: 'inline-block', flexShrink: 0 }} />
              )}
            </p>
            {subtitle && (
              <p className="text-[11px] text-[#64748B] mt-1">{subtitle}</p>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (link) {
    return (
      <a href={link} style={{ display: 'block', textDecoration: 'none' }}>
        {inner}
      </a>
    );
  }
  return inner;
}
