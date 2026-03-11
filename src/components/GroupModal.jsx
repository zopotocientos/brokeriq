// src/components/GroupModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { detectRegion, CA_COUNTIES } from '../lib/regionUtils';

const INITIAL_FORM = {
  name: '',
  zip: '',
  county: '',
  effective_date: '',
  sic_code: '',
  contact_name: '',
  contact_email: '',
};

export default function GroupModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [region, setRegion] = useState(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name || '',
        zip: group.zip || '',
        county: group.county || '',
        effective_date: group.effective_date || '',
        sic_code: group.sic_code || '',
        contact_name: group.contact_name || '',
        contact_email: group.contact_email || '',
      });
      if (group.regions) setRegion(group.regions);
    }
  }, [group]);

  const resolveRegion = useCallback(async (county, zip) => {
    if (!county) { setRegion(null); return; }
    setRegionLoading(true);
    const r = await detectRegion(county, zip);
    setRegion(r);
    setRegionLoading(false);
  }, []);

  useEffect(() => {
    resolveRegion(form.county, form.zip);
  }, [form.county, form.zip, resolveRegion]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Group name is required.';
    if (!form.zip.trim() || !/^\d{5}$/.test(form.zip.trim())) e.zip = 'Enter a valid 5-digit ZIP.';
    if (!form.county) e.county = 'County is required.';
    if (!form.effective_date) e.effective_date = 'Effective date is required.';
    if (!region) e.region = 'Region could not be determined. Check county and ZIP.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      e.contact_email = 'Enter a valid email address.';
    }
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      name: form.name.trim(),
      zip: form.zip.trim(),
      county: form.county,
      region_id: region.id,
      effective_date: form.effective_date,
      sic_code: form.sic_code.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      user_id: user.id,
    };

    let result;
    if (group?.id) {
      result = await supabase.from('groups').update(payload).eq('id', group.id).select().single();
    } else {
      result = await supabase.from('groups').insert(payload).select().single();
    }

    setSaving(false);

    if (result.error) {
      setErrors({ submit: result.error.message });
    } else {
      onSaved(result.data);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const isEditing = !!group?.id;

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(10, 15, 30, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        animation: 'modalIn 0.2s ease-out',
      }}>
        <div style={{
          padding: '1.5rem 1.75rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isEditing ? 'Edit Group' : 'New Employer Group'}
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {isEditing ? 'Editing ' + group.name : 'Enter employer details to get started'}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1,
            padding: '0.25rem', borderRadius: '6px',
          }}>?</button>
        </div>

        <div style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'grid', gap: '1.125rem' }}>

            <Field label="Group Name" error={errors.name} required>
              <input name="name" value={form.name} onChange={handleChange}
                placeholder="e.g. Acme Corporation" style={inputStyle(errors.name)} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.875rem' }}>
              <Field label="ZIP Code" error={errors.zip} required>
                <input name="zip" value={form.zip} onChange={handleChange}
                  placeholder="90210" maxLength={5} style={inputStyle(errors.zip)} />
              </Field>
              <Field label="County" error={errors.county} required>
                <select name="county" value={form.county} onChange={handleChange} style={inputStyle(errors.county)}>
                  <option value="">Select county…</option>
                  {CA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Rating Region (auto-detected)" error={errors.region}>
              <div style={{
                ...inputStyle(errors.region),
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--surface-subtle)', cursor: 'default',
                color: region ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {regionLoading ? (
                  <span style={{ fontSize: '0.875rem' }}>Detecting…</span>
                ) : region ? (
                  <>
                    <span style={{
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: '5px', padding: '1px 7px',
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>R{region.region_number}</span>
                    <span style={{ fontSize: '0.875rem' }}>{region.region_name}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.875rem' }}>
                    {form.county === 'Los Angeles' && form.zip.length < 5
                      ? 'Enter ZIP to resolve Los Angeles region'
                      : 'Auto-detected from county and ZIP'}
                  </span>
                )}
              </div>
            </Field>

            <Field label="Effective Date" error={errors.effective_date} required>
              <input type="date" name="effective_date" value={form.effective_date}
                onChange={handleChange} style={inputStyle(errors.effective_date)} />
            </Field>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Optional Details
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <Field label="Contact Name">
                  <input name="contact_name" value={form.contact_name} onChange={handleChange}
                    placeholder="HR Manager" style={inputStyle()} />
                </Field>
                <Field label="Contact Email" error={errors.contact_email}>
                  <input name="contact_email" value={form.contact_email} onChange={handleChange}
                    placeholder="hr@company.com" style={inputStyle(errors.contact_email)} />
                </Field>
              </div>
              <Field label="SIC Code">
                <input name="sic_code" value={form.sic_code} onChange={handleChange}
                  placeholder="e.g. 7372" maxLength={4}
                  style={{ ...inputStyle(), maxWidth: '140px' }} />
              </Field>
            </div>

            {errors.submit && (
              <div style={{
                background: '#fee2e2', border: '1px solid #fca5a5',
                borderRadius: '8px', padding: '0.75rem 1rem',
                color: '#991b1b', fontSize: '0.875rem',
              }}>{errors.submit}</div>
            )}
          </div>
        </div>

        <div style={{
          padding: '1.125rem 1.75rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
          background: 'var(--surface-subtle)',
        }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtnStyle(saving)}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        input:focus, select:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--accent-subtle);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, error, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--accent)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>}
    </div>
  );
}

function inputStyle(error) {
  return {
    width: '100%', padding: '0.5625rem 0.75rem',
    borderRadius: '8px',
    border: '1.5px solid ' + (error ? '#ef4444' : 'var(--border)'),
    background: 'var(--surface)', color: 'var(--text-primary)',
    fontSize: '0.9375rem', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
}

const secondaryBtnStyle = {
  padding: '0.5625rem 1.25rem', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: '0.9375rem',
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

function primaryBtnStyle(disabled) {
  return {
    padding: '0.5625rem 1.5rem', borderRadius: '8px', border: 'none',
    background: disabled ? 'var(--accent-muted)' : 'var(--accent)',
    color: '#fff', fontSize: '0.9375rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  };
}
