import ServiceStatusCard from '../components/ServiceStatusCard.jsx';

const DEMO_CARDS = [
  {
    customerName: 'Mike Johnson',
    serviceType: 'general',
    status: 'active',
    lastContact: '2 days ago',
    nextAction: 'Follow-up due May 14',
    actionLabel: 'Send Follow-up',
    actionVariant: 'primary',
  },
  {
    customerName: 'Sarah Williams',
    serviceType: 'rodent',
    status: 'replied',
    lastContact: 'Today',
    nextAction: 'Schedule inspection',
    actionLabel: 'View Lead',
    actionVariant: 'primary',
  },
  {
    customerName: 'Carlos Rivera',
    serviceType: 'termite',
    status: 'na',
    lastContact: '5 days ago',
    nextAction: 'Quote pending',
    actionLabel: 'Send Quote',
    actionVariant: 'primary',
  },
  {
    customerName: 'Linda Park',
    serviceType: 'mosquito',
    status: 'rit',
    lastContact: '1 week ago',
    nextAction: 'Check back in June',
    actionLabel: 'Schedule Call',
    actionVariant: 'ghost',
  },
  {
    customerName: 'Tom Baker',
    serviceType: 'wasp',
    status: 'stopped',
    lastContact: '3 weeks ago',
    nextAction: null,
    actionLabel: 'Reactivate',
    actionVariant: 'ghost',
  },
  {
    customerName: 'Dana Cruz',
    serviceType: 'bed_bug',
    status: 'error',
    lastContact: 'Yesterday',
    nextAction: 'Email bounce — retry',
    actionLabel: 'Retry Send',
    actionVariant: 'danger',
  },
];

export default function ComponentPreview() {
  return (
    <div className="flex-1 overflow-y-auto">

      {/* Header */}
      <div className="px-6 py-5 border-b border-gs-border">
        <h1 className="text-lg font-bold text-gs-text tracking-tight">Component Preview</h1>
        <p className="text-gs-muted text-xs mt-0.5">
          ServiceStatusCard — demo data only. Not connected to live leads.
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">

        {/* All status variants */}
        <section>
          <p className="text-gs-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Status Variants
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_CARDS.map((card, i) => (
              <ServiceStatusCard
                key={i}
                {...card}
                onAction={() => alert(`Action: ${card.actionLabel} for ${card.customerName}`)}
              />
            ))}
          </div>
        </section>

        {/* Action button variants */}
        <section>
          <p className="text-gs-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Action Button Variants
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ServiceStatusCard
              customerName="Primary Action"
              serviceType="general"
              serviceLabel="General Service"
              status="active"
              lastContact="Today"
              nextAction="Follow-up due"
              actionLabel="Primary Button"
              actionVariant="primary"
              onAction={() => {}}
            />
            <ServiceStatusCard
              customerName="Ghost Action"
              serviceType="rodent"
              serviceLabel="Rodent Control"
              status="rit"
              lastContact="Yesterday"
              nextAction="Soft follow-up"
              actionLabel="Ghost Button"
              actionVariant="ghost"
              onAction={() => {}}
            />
            <ServiceStatusCard
              customerName="Danger Action"
              serviceType="wasp"
              serviceLabel="Wasp Removal"
              status="error"
              lastContact="3 days ago"
              nextAction="Retry required"
              actionLabel="Danger Button"
              actionVariant="danger"
              onAction={() => {}}
            />
          </div>
        </section>

        {/* Minimal (no meta) */}
        <section>
          <p className="text-gs-muted text-xs font-semibold uppercase tracking-widest mb-3">
            Minimal — No Meta Fields
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ServiceStatusCard
              customerName="James Miller"
              serviceType="termite"
              status="ag"
              actionLabel="Send Template"
              onAction={() => {}}
            />
            <ServiceStatusCard
              customerName="Amy Chen"
              serviceType="mosquito"
              status="imported"
              actionLabel="Start Sequence"
              actionVariant="primary"
              onAction={() => {}}
            />
          </div>
        </section>

      </div>
    </div>
  );
}
