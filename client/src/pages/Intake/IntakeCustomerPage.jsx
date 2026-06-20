import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, Mail, MapPin, Phone, User, FileText, Users,
} from 'lucide-react';
import AddressAutocomplete from './components/AddressAutocomplete.jsx';
import IntakePageHeader from './components/IntakePageHeader.jsx';
import IntakeKpiBar from './components/IntakeKpiBar.jsx';
import IntakeProgressTracker from './components/IntakeProgressTracker.jsx';
import IntakeInputField from './components/IntakeInputField.jsx';
import IntakeStatusCards from './components/IntakeStatusCards.jsx';
import IntakeWorkflowNextCard from './components/IntakeWorkflowNextCard.jsx';
import IntakePropertyPreviewPanel from './components/IntakePropertyPreviewPanel.jsx';
import { api } from '../../api/client.js';
import { updateIntakeCustomer } from '../../utils/intake/intakeSession.js';
import { estimatePropertyUse } from '../../utils/intake/propertyUseEstimate.js';
import { resolveAutoBoundary } from '../../utils/intake/propertyBoundary.js';
import IntakePageShell from './components/IntakePageShell.jsx';
import IntakeSatellitePreview from './components/IntakeSatellitePreview.jsx';
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
    propertyViewport: place.geometry?.viewport || null,
  };
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
    const propertyUse = estimatePropertyUse(parsed.placeTypes || []);
    const autoBoundary = resolveAutoBoundary({
      viewport: parsed.propertyViewport,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      propertyUseEstimate: propertyUse.estimate,
    });

    setForm((prev) => ({
      ...prev,
      serviceAddress: parsed.serviceAddress || prev.serviceAddress,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      zip: parsed.zip || prev.zip,
      formattedAddress: parsed.formattedAddress || prev.formattedAddress,
      latitude: parsed.latitude ?? prev.latitude,
      longitude: parsed.longitude ?? prev.longitude,
      placeId: parsed.placeId ?? prev.placeId,
      placeTypes: parsed.placeTypes?.length ? parsed.placeTypes : prev.placeTypes,
      propertyUseEstimate: propertyUse.estimate,
      propertyUseConfidence: propertyUse.confidence,
      propertyViewport: parsed.propertyViewport ?? prev.propertyViewport,
      suggestedTreatmentPolygon: autoBoundary?.polygon || prev.suggestedTreatmentPolygon,
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

      const propertyUse = estimatePropertyUse(result.placeTypes || form.placeTypes || []);
      const autoBoundary = resolveAutoBoundary({
        viewport: form.propertyViewport,
        latitude: result.latitude ?? form.latitude,
        longitude: result.longitude ?? form.longitude,
        propertyUseEstimate: propertyUse.estimate,
      });

      const customer = {
        ...form,
        verifiedAddress: result.verifiedAddress || result.formattedAddress,
        formattedAddress: result.formattedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        placeId: result.placeId,
        placeTypes: result.placeTypes || form.placeTypes || [],
        propertyUseEstimate: propertyUse.estimate,
        propertyUseConfidence: propertyUse.confidence,
        propertyConfidence: result.propertyConfidence,
        validationVerdict: result.verdict,
        suggestedTreatmentPolygon: autoBoundary?.polygon || form.suggestedTreatmentPolygon || [],
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

  const previewAddress = form.formattedAddress
    || [form.serviceAddress, form.city, form.state, form.zip].filter(Boolean).join(', ');

  const previewMap = (
    <IntakeSatellitePreview
      latitude={form.latitude}
      longitude={form.longitude}
      address={previewAddress}
      polygonPath={form.suggestedTreatmentPolygon || []}
    />
  );

  return (
    <IntakePageShell>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <IntakePageHeader
            title="Customer Intake"
            subtitle="Capture customer details, verify service address, and prepare property intelligence for quoting."
            continueFormId="intake-customer-form"
            continueDisabled={submitting}
            continueLabel={submitting ? 'Validating address…' : 'Continue'}
          />

          <IntakeKpiBar form={form} />

          <IntakeProgressTracker currentStep={1} />

          <div className="intake-workspace__columns">
            <form id="intake-customer-form" onSubmit={handleContinue} className="intake-card intake-card--primary space-y-3">
              <div className="intake-card__heading">
                <div className="intake-card__heading-icon" aria-hidden>
                  <User size={18} />
                </div>
                <div>
                  <h2 className="intake-card__title">Customer Information</h2>
                  <p className="intake-card__subtitle">Service address uses Google Places Autocomplete and validation.</p>
                </div>
              </div>

                <div className="intake-form-grid">
                  <IntakeInputField id="firstName" label="First Name" icon={User}>
                    <input id="firstName" className="intake-input" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="lastName" label="Last Name" icon={User}>
                    <input id="lastName" className="intake-input" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="phone" label="Phone Number" icon={Phone}>
                    <input id="phone" className="intake-input" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="email" label="Email Address" icon={Mail}>
                    <input id="email" className="intake-input" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                  </IntakeInputField>
                  <IntakeInputField id="serviceAddress" label="Service Address" icon={MapPin} className="intake-form-grid--full">
                    <AddressAutocomplete
                      value={form.serviceAddress}
                      onChange={(v) => updateField('serviceAddress', v)}
                      onPlaceSelected={handlePlaceSelected}
                    />
                  </IntakeInputField>
                  <IntakeInputField id="city" label="City" icon={MapPin}>
                    <input id="city" className="intake-input" value={form.city} onChange={(e) => updateField('city', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="state" label="State" icon={MapPin}>
                    <input id="state" className="intake-input" value={form.state} onChange={(e) => updateField('state', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="zip" label="Zip Code" icon={MapPin}>
                    <input id="zip" className="intake-input" value={form.zip} onChange={(e) => updateField('zip', e.target.value)} required />
                  </IntakeInputField>
                  <IntakeInputField id="serviceType" label="Service Type" icon={FileText}>
                    <select id="serviceType" className="intake-input" value={form.serviceType} onChange={(e) => updateField('serviceType', e.target.value)} required>
                      <option value="">Select service…</option>
                      {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </IntakeInputField>
                  <IntakeInputField id="additionalContacts" label="Additional Contacts" icon={Users} className="intake-form-grid--full" multiline>
                    <textarea id="additionalContacts" className="intake-input resize-none" rows={2} value={form.additionalContacts} onChange={(e) => updateField('additionalContacts', e.target.value)} />
                  </IntakeInputField>
                  <IntakeInputField id="notes" label="Notes" icon={FileText} className="intake-form-grid--full" multiline>
                    <textarea id="notes" className="intake-input resize-none" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
                  </IntakeInputField>
                </div>

                {error && <div className="intake-error">{error}</div>}

                <IntakeStatusCards form={form} />
                <IntakeWorkflowNextCard />

                <div className="intake-actions lg:hidden">
                  <button type="submit" className="intake-primary-btn" disabled={submitting}>
                    {submitting ? 'Validating address…' : <>Continue <ArrowRight size={14} /></>}
                  </button>
                </div>
              </form>

              <IntakePropertyPreviewPanel form={form} mapSlot={previewMap} />
          </div>
        </motion.div>
    </IntakePageShell>
  );
}
