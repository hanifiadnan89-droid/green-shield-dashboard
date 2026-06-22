import LeadsAmbientBackground from '../../Leads/LeadsAmbientBackground.jsx';

export default function IntakePageShell({ children }) {
  return (
    <div className="intake-page">
      <div className="intake-page__ambient" aria-hidden>
        <LeadsAmbientBackground />
      </div>
      <div className="intake-page__inner">
        {children}
      </div>
    </div>
  );
}
