const STEPS = [
  { title: 'Property Intelligence', detail: 'Verify map, acreage, and conditions' },
  { title: 'Quote & Proposal', detail: 'Build pricing in Send Template' },
  { title: 'Agreement', detail: 'Select and send customer agreement' },
  { title: 'Scheduling', detail: 'Coordinate service date with customer' },
  { title: 'Confirmation', detail: 'Finalize intake and follow-up' },
];

export default function IntakeWorkflowNextCard() {
  return (
    <section className="intake-next-card">
      <h3 className="intake-next-card__title">What happens next</h3>
      <ol className="intake-next-card__list">
        {STEPS.map((step, index) => (
          <li key={step.title} className="intake-next-card__item">
            <span className="intake-next-card__index">{index + 1}</span>
            <div>
              <p className="intake-next-card__item-title">{step.title}</p>
              <p className="intake-next-card__item-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
