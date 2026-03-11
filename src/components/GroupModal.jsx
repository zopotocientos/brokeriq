// src/components/GroupModal.jsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { detectRegion, CA_COUNTIES } from "../lib/regionUtils";

const INITIAL_FORM = {
  employer_name: "",
  zip_code: "",
  county: "",
  effective_date: "",
  sic_code: "",
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
        employer_name: group.employer_name || "",
        zip_code: group.zip_code || "",
        county: group.county || "",
        effective_date: group.effective_date || "",
        sic_code: group.sic_code || "",
      });
      if (group.region_number) {
        setRegion({ region_number: group.region_number, region_name: group.region_name });
      }
    } else {
      setForm(INITIAL_FORM);
      setRegion(null);
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
    resolveRegion(form.county, form.zip_code);
  }, [form.county, form.zip_code, resolveRegion]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  }

  function validate() {
    const e = {};
    if (!form.employer_name.trim()) e.employer_name = "Group name is required.";
    if (!form.zip_code.trim() || !/^\d{5}$/.test(form.zip_code.trim())) e.zip_code = "Enter a valid 5-digit ZIP.";
    if (!form.county) e.county = "County is required.";
    if (!form.effective_date) e.effective_date = "Effective date is required.";
    if (!region) e.region = "Region could not be determined. Check county and ZIP.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      employer_name: form.employer_name.trim(),
      zip_code: form.zip_code.trim(),
      county: form.county,
      region_number: region.region_number,
      effective_date: form.effective_date,
      sic_code: form.sic_code.trim() || null,
      broker_id: user.id,
    };

    let result;
    if (group?.id) {
      result = await supabase.from("groups").update(payload).eq("id", group.id).select().single();
    } else {
      result = await supabase.from("groups").insert(payload).select().single();
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

  const inputStyle = (hasError) => ({
    width: "100%", padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid " + (hasError ? "#EF4444" : "#D1D5DB"),
    background: "white", color: "#111827",
    fontSize: "14px", outline: "none",
    boxSizing: "border-box", fontFamily: "Arial, sans-serif",
    transition: "border-color 0.15s",
  });

  return (
    <div onClick={handleBackdrop} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.4)",
      backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        width: "100%", maxWidth: "520px",
        boxShadow: "0 20px 48px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              {isEditing ? "Edit Group" : "New Employer Group"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
              {isEditing ? "Editing " + group.employer_name : "Enter employer details to get started"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#9CA3AF", fontSize: "20px", lineHeight: 1,
            padding: "4px", borderRadius: "6px", fontFamily: "inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#374151"}
            onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
          >X</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gap: "16px" }}>

            {/* Group Name */}
            <Field label="Group Name" error={errors.employer_name} required>
              <input name="employer_name" value={form.employer_name} onChange={handleChange}
                placeholder="e.g. Acme Corporation" style={inputStyle(errors.employer_name)}
                onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                onBlur={e => e.target.style.borderColor = errors.employer_name ? "#EF4444" : "#D1D5DB"}
              />
            </Field>

            {/* ZIP + County */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "12px" }}>
              <Field label="ZIP Code" error={errors.zip_code} required>
                <input name="zip_code" value={form.zip_code} onChange={handleChange}
                  placeholder="90210" maxLength={5} style={inputStyle(errors.zip_code)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = errors.zip_code ? "#EF4444" : "#D1D5DB"}
                />
              </Field>
              <Field label="County" error={errors.county} required>
                <select name="county" value={form.county} onChange={handleChange}
                  style={inputStyle(errors.county)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = errors.county ? "#EF4444" : "#D1D5DB"}
                >
                  <option value="">Select county...</option>
                  {CA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* Region */}
            <Field label="Rating Region (auto-detected)" error={errors.region}>
              <div style={{
                ...inputStyle(errors.region),
                display: "flex", alignItems: "center", gap: "8px",
                background: "#F9FAFB", cursor: "default",
                minHeight: "40px",
              }}>
                {regionLoading ? (
                  <span style={{ fontSize: "14px", color: "#9CA3AF" }}>Detecting...</span>
                ) : region ? (
                  <>
                    <span style={{
                      background: "#1B4F8A", color: "white",
                      borderRadius: "5px", padding: "2px 8px",
                      fontSize: "12px", fontWeight: "700",
                    }}>R{region.region_number}</span>
                    <span style={{ fontSize: "14px", color: "#374151" }}>{region.region_name}</span>
                  </>
                ) : (
                  <span style={{ fontSize: "14px", color: "#9CA3AF" }}>
                    {form.county === "Los Angeles" && form.zip_code.length < 5
                      ? "Enter ZIP to resolve Los Angeles region"
                      : "Auto-detected from county and ZIP"}
                  </span>
                )}
              </div>
            </Field>

            {/* Effective Date */}
            <Field label="Effective Date" error={errors.effective_date} required>
              <input type="date" name="effective_date" value={form.effective_date}
                onChange={handleChange} style={inputStyle(errors.effective_date)}
                onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                onBlur={e => e.target.style.borderColor = errors.effective_date ? "#EF4444" : "#D1D5DB"}
              />
            </Field>

            {/* SIC Code */}
            <Field label="SIC Code (optional)">
              <input name="sic_code" value={form.sic_code} onChange={handleChange}
                placeholder="e.g. 7372" maxLength={4}
                style={{ ...inputStyle(false), maxWidth: "140px" }}
                onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                onBlur={e => e.target.style.borderColor = "#D1D5DB"}
              />
            </Field>

            {errors.submit && (
              <div style={{
                background: "#FEE2E2", border: "1px solid #FCA5A5",
                borderRadius: "8px", padding: "12px 16px",
                color: "#991B1B", fontSize: "14px",
              }}>{errors.submit}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #E5E7EB",
          display: "flex", justifyContent: "flex-end", gap: "12px",
          background: "#F9FAFB",
        }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: "8px",
            border: "1px solid #D1D5DB", background: "transparent",
            color: "#374151", fontSize: "14px", fontWeight: "500",
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: "9px 20px", borderRadius: "8px", border: "none",
            background: saving ? "#93C5FD" : "#1B4F8A",
            color: "white", fontSize: "14px", fontWeight: "600",
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, error, required }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: "12px", color: "#EF4444" }}>{error}</span>}
    </div>
  );
}
