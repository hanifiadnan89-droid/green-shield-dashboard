/**
 * A single module card on the Sales Coach home dashboard.
 *
 * Props:
 *   mod     — module definition object (id, icon, iconBg, iconColor, title, desc, active)
 *   onClick — called when an active card is clicked; undefined for coming-soon cards
 */
export function SalesCoachModuleCard({ mod, onClick }) {
  const Icon = mod.icon;
  return (
    <div
      className={`sc-module-card ${mod.active ? 'sc-module-card--active' : 'sc-module-card--soon'}`}
      onClick={onClick}
    >
      <div className="sc-module-card__icon-wrap" style={{ background: mod.iconBg }}>
        <Icon size={20} color={mod.iconColor} />
      </div>
      <div className="sc-module-card__title">{mod.title}</div>
      <div className="sc-module-card__desc">{mod.desc}</div>
      <span className={`sc-module-card__badge ${mod.active ? 'sc-module-card__badge--active' : 'sc-module-card__badge--soon'}`}>
        {mod.active ? 'Available' : 'Coming Soon'}
      </span>
    </div>
  );
}
