import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, MapPin, UserPlus } from 'lucide-react';
import LeadsAmbientBackground from '../Leads/LeadsAmbientBackground.jsx';
import AddressAutocomplete from './components/AddressAutocomplete.jsx';
import { api } from '../../api/client.js';
import { updateIntakeCustomer } from '../../utils/intake/intakeSession.js';
import { estimatePropertyUse } from '../../utils/intake/propertyUseEstimate.js';
import './intake.css';

const SERVICE_TYPES = [
  'Tick & Mosquito',
  'Insect Quarterly',
  'Rodent & Insect Triannual',
  'Bed Bug',
  'General Inquiry',
];

function parsePlace(place) {
  const components = place.address_components || [];
  const get = (type) => components.find((c) => c.types.includes(type));
  const streetNumber = get('street_number')?.long_name || '';
  const route = get('route')?.long_name || '';
  const city = get('locality')?.long_name || get('sublocality')?.long_name || '';
  const state = get('administrative_area_level_1')?.short_name || '';
  const zip = get('postal_code')?.long_name || '';
  const street = [streetNumber, route].filter(Boolean).join(' ');

  return {
    serviceAddress: street || place.formatted_address?.split(',')[0] || '',
    city,
    state,
    zip,
    formattedAddress: place.formatted_address || '',
    latitude: place.geometry?.location?.lat?.() ?? null,
    longitude: place.geometry?.location?.lng?.() ?? null,
    placeId: place.place_id || null,
    placeTypes: place.types || [],
  };
}

function IntakeStepper({ step }) {
  const steps = [
    { n: 1, label: 'Customer Intake' },
    { n: 2, label: 'Property Intelligence' },
  ];

  return (
    <div className="intake-stepper">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="intake-stepper__step">
            <span className={`intake-stepper__dot ${active ? 'intake-stepper__dot--active' : done ? 'intake-stepper__dot--done' : 'intake-stepper__dot--pending'}`}>
              {s.n}
            </span>
            <span className={active ? 'text-gs-text font-medium' : 'text-gs-muted'}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-gs-muted mx-1">→</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function IntakeCustomerPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    serviceAddress: '',
    city: '',
    state: '',
    zip: '',
    serviceType: '',
    additionalContacts: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePlaceSelected(place) {
    const parsed = parsePlace(place);
    setForm((prev) => ({
      ...prev,
      serviceAddress: parsed.serviceAddress || prev.serviceAddress,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      zip: parsed.zip || prev.zip,
    }));
  }

  async function handleContinue(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { result } = await api.intake.validateAddress({
        street: form.serviceAddress,
        city: form.city,
        state: form.state,
        zip: form.zip,
      });

      const propertyUse = estimatePropertyUse(result.placeTypes || []);
      const customer = {
        ...form,
        verifiedAddress: result.verifiedAddress || result.formattedAddress,
        formattedAddress: result.formattedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        placeId: result.placeId,
        placeTypes: result.placeTypes || [],
        propertyUseEstimate: propertyUse.estimate,
        propertyUseConfidence: propertyUse.confidence,
        propertyConfidence: result.propertyConfidence,
        validationVerdict: result.verdict,
      };

      try {
        const leadPayload = {
          name: [form.firstName, form.lastName].filter(Boolean).join(' '),
          phone: form.phone,
          email: form.email,
          reason: form.serviceType,
          notes: form.serviceType?.toLowerCase().includes('tick') ? 't/m' : '',
          status: 'new',
        };
        const created = await api.leads.create(leadPayload);
        if (created?.row_number) customer.leadRowNumber = created.row_number;
      } catch {
        /* lead sheet optional */
      }

      updateIntakeCustomer(customer);
      navigate('/intake/property');
    } catch (err) {
      setError(err.message || 'Unable to validate address');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="intake-page">
      <LeadsAmbientBackground />
      <div className="intake-page__inner">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <UserPlus size={20} className="text-gs-accent" />
            <h1 className="text-xl font-bold text-white">Intake</h1>
          </div>
          <p className="text-sm text-gs-muted mb-4">Capture customer details and verify the service address with Google.</p>

          <IntakeStepper step={1} />

          <form onSubmit={handleContinue} className="intake-card space-y-4">
            <div>
              <h2 className="intake-card__title">Customer Intake</h2>
              <p className="intake-card__subtitle">Service address uses Google Places Autocomplete and validation.</p>
            </div>

            <div className="intake-form-grid">
              <div>
                <label className="intake-label" htmlFor="firstName">First Name</label>
                <input id="firstName" className="intake-input" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="lastName">Last Name</label>
                <input id="lastName" className="intake-input" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="phone">Phone Number</label>
                <input id="phone" className="intake-input" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="email">Email Address</label>
                <input id="email" className="intake-input" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
              </div>
              <div className="intake-form-grid--full">
                <label className="intake-label" htmlFor="serviceAddress">Service Address</label>
                <AddressAutocomplete
                  value={form.serviceAddress}
                  onChange={(v) => updateField('serviceAddress', v)}
                  onPlaceSelected={handlePlaceSelected}
                />
              </div>
              <div>
                <label className="intake-label" htmlFor="city">City</label>
                <input id="city" className="intake-input" value={form.city} onChange={(e) => updateField('city', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="state">State</label>
                <input id="state" className="intake-input" value={form.state} onChange={(e) => updateField('state', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="zip">Zip Code</label>
                <input id="zip" className="intake-input" value={form.zip} onChange={(e) => updateField('zip', e.target.value)} required />
              </div>
              <div>
                <label className="intake-label" htmlFor="serviceType">Service Type</label>
                <select id="serviceType" className="intake-input" value={form.serviceType} onChange={(e) => updateField('serviceType', e.target.value)} required>
                  <option value="">Select service…</option>
                  {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="intake-form-grid--full">
                <label className="intake-label" htmlFor="additionalContacts">Additional Contacts</label>
                <textarea id="additionalContacts" className="intake-input resize-none" rows={2} value={form.additionalContacts} onChange={(e) => updateField('additionalContacts', e.target.value)} />
              </div>
              <div className="intake-form-grid--full">
                <label className="intake-label" htmlFor="notes">Notes</label>
                <textarea id="notes" className="intake-input resize-none" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
              </div>
            </div>

            {error && <div className="intake-error">{error}</div>}

            <div className="intake-actions">
              <button type="submit" className="intake-primary-btn" disabled={submitting}>
                {submitting ? 'Validating address…' : <>Continue <ArrowRight size={14} className="inline ml-1" /></>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
