export default function IntakeKpiBar({ form = {}, verified = false }) {
  const hasAddress = Boolean(form.serviceAddress && form.city && form.state && form.zip);
  const hasCoords = Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude));

  const items = [
    {
      label: 'Lead Status',
      value: 'New Lead',
      tone: 'lead',
    },
    {
      label: 'Address Status',
      value: verified ? 'Verified' : hasCoords ? 'Address Captured' : hasAddress ? 'Ready for Validation' : 'Pending Verification',
      tone: verified ? 'ready' : hasCoords || hasAddress ? 'progress' : 'pending',
    },
    {
      label: 'Service Type',
      value: form.serviceType || 'Not Selected',
      tone: form.serviceType ? 'ready' : 'pending',
    },
    {
      label: 'Property Confidence',
      value: form.propertyConfidence
        ? String(form.propertyConfidence)
        : verified
          ? 'High'
          : form.propertyUseConfidence
            ? String(form.propertyUseConfidence)
            : hasCoords
              ? 'Preliminary'
              : 'Pending',
      tone: form.propertyConfidence || verified || hasCoords ? 'ready' : 'pending',
    },
  ];

  return (
    <div className="intake-kpi-bar">
      {items.map((item) => (
        <div key={item.label} className={`intake-kpi-card intake-kpi-card--${item.tone}`}>
          <p className="intake-kpi-card__label">{item.label}</p>
          <p className="intake-kpi-card__value">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
