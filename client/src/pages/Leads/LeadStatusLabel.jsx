import LeadFieldText from './LeadFieldText.jsx';

/** @deprecated Use LeadFieldText — kept for imports; renders plain text only. */
export default function LeadStatusLabel({ value, kind = 'status', className = '' }) {
  return <LeadFieldText value={value} kind={kind} className={className} />;
}
