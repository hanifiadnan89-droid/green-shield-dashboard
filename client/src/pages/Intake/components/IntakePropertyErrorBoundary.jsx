import { Component } from 'react';
import { Link } from 'react-router-dom';
import IntakePageShell from './IntakePageShell.jsx';

export default class IntakePropertyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Intake Property Intelligence]', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <IntakePageShell>
          <div className="intake-card space-y-4 max-w-3xl">
                <h1 className="intake-card__title">Property Intelligence unavailable</h1>
                <p className="intake-card__subtitle">
                  The map could not be loaded, but your customer intake data is still saved.
                </p>
                <div className="intake-error">
                  {error?.message || 'An unexpected error occurred while loading the property map.'}
                </div>
                <div className="intake-actions">
                  <Link to="/intake" className="intake-secondary-btn no-underline inline-flex items-center">
                    Back to Customer Intake
                  </Link>
                  <button
                    type="button"
                    className="intake-primary-btn"
                    onClick={() => this.setState({ error: null })}
                  >
                    Try again
                  </button>
                </div>
          </div>
      </IntakePageShell>
    );
  }
}
