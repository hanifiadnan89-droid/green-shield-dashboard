export default function WorkflowTypeBadge({ meta }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}
