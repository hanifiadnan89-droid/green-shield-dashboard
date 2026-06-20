import { CheckCircle2, CloudSun, Database, MapPin } from 'lucide-react';

function StatusCard({ icon: Icon, title, value, tone = 'pending' }) {
  return (
    <div className={`intake-status-card intake-status-card--${tone}`}>
      <div className="intake-status-card__icon">
        <Icon size={16} />
      </div>
      <div>
        <p className="intake-status-card__title">{title}</p>
        <p className="intake-status-card__value">{value}</p>
      </div>
    </div>
  );
}

export default function IntakeStatusCards({ form = {}, verified = false }) {
  const hasAddress = Boolean(form.serviceAddress && form.city && form.state && form.zip);
  const hasService = Boolean(form.serviceType);

  return (
    <div className="intake-status-grid">
      <StatusCard
        icon={MapPin}
        title="Address Verified"
        value={verified || hasAddress ? 'Ready for validation' : 'Enter service address'}
        tone={verified || hasAddress ? 'ready' : 'pending'}
      />
      <StatusCard
        icon={CheckCircle2}
        title="Service Available"
        value={hasService ? form.serviceType : 'Select a service type'}
        tone={hasService ? 'ready' : 'pending'}
      />
      <StatusCard
        icon={CloudSun}
        title="Weather Suitable"
        value="Checked on Property Intelligence"
        tone="pending"
      />
      <StatusCard
        icon={Database}
        title="Property Data"
        value={hasAddress ? 'Address captured' : 'Awaiting address'}
        tone={hasAddress ? 'ready' : 'pending'}
      />
    </div>
  );
}
