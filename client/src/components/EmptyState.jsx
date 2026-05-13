export default function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-gs-border/50 border border-gs-border flex items-center justify-center mb-4">
          <Icon size={24} className="text-gs-muted" />
        </div>
      )}
      <p className="text-gs-text font-semibold mb-1.5">{title}</p>
      {desc && <p className="text-gs-muted text-sm max-w-xs leading-relaxed">{desc}</p>}
    </div>
  );
}
