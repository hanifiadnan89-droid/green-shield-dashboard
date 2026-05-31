import { TEMPLATE_META } from '../../mockData.js';

export default function LeadTemplateBadge({ notes, className = 'px-2 py-0.5 rounded-full' }) {
  const key = (notes || '').toLowerCase();
  const meta = key === 't/m' ? TEMPLATE_META.tm : TEMPLATE_META[key];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center type-label-sm uppercase ${className}`}
      style={{ background: meta.bg, color: meta.textColor }}
    >
      {meta.label}
    </span>
  );
}
