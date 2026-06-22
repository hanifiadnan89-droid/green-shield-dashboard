import { CheckCircle2, CloudSun, Database, MapPin } from 'lucide-react';

function StatusCard({ icon: Icon, title, value, variant = 'pending' }) {
  return (
    <div className={`intake-status-card intake-status-card--${variant}`}>
      <div className="intake-status-card__icon-wrap">
        <Icon size={16} className="intake-status-card__icon" />
      </div>
      <div>
        <p className="intake-status-card__title">{title}</p>
        <p className="intake-status-card__value">{value}</p>
      </div>
    </div>
  );
}

export default function IntakeStatusCards({ form = {}, verified = false, propertyRecordsStatus = 'idle' }) {
  const hasAddress = Boolean(form.serviceAddress && form.city && form.state && form.zip);
  const hasService = Boolean(form.serviceType);
  const propertyDataValue = propertyRecordsStatus === 'loaded'
    ? 'Records loaded'
    : propertyRecordsStatus === 'unavailable'
      ? 'Records unavailable'
      : hasAddress
        ? 'Optional lookup available'
        : 'Awaiting address';
  const propertyDataVariant = propertyRecordsStatus === 'loaded'
    ? 'teal'
    : propertyRecordsStatus === 'unavailable'
      ? 'pending'
      : hasAddress
        ? 'teal'
        : 'pending';

  return (
    <div className="intake-status-grid">
      <StatusCard
        icon={MapPin}
        title="Address Verified"
        value={verified ? 'Verified' : hasAddress ? 'Ready for validation' : 'Enter service address'}
        variant={verified || hasAddress ? 'green' : 'pending'}
      />
      <StatusCard
        icon={CheckCircle2}
        title="Service Available"
        value={hasService ? form.serviceType : 'Select a service type'}
        variant={hasService ? 'emerald' : 'pending'}
      />
      <StatusCard
        icon={CloudSun}
        title="Weather Suitable"
        value="Checked on Property Intelligence"
        variant="blue"
      />
      <StatusCard
        icon={Database}
        title="Property Data"
        value={propertyDataValue}
        variant={propertyDataVariant}
      />
    </div>
  );
}
