// src/components/EmployeeModal.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const TIERS = [
  { value: "EE", label: "EE Only" },
  { value: "EE+SP", label: "EE + Spouse" },
  { value: "EE+CH", label: "EE + Child(ren)" },
  { value: "EE+FAM", label: "EE + Family" },
];

const GENDERS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "X", label: "Non-binary / Other" },
  { value: "", label: "Prefer not to say" },
];

const RELATIONSHIPS = [
  "Employee", "Spouse", "Domestic Partner",
  "Child", "Child-Legal Guardian", "Child-Adopted",
  "Child-Step", "Child-Domestic Partner",
];

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  coverage_tier: "EE",
  relationship: "Employee",
  zip_code: "",
};

export default function EmployeeModal({ employee, groupZip, groupId, onClose, onSaved }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (employee) {
      setForm({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        date_of_birth: employee.date_of_birth || "",
        gender: employee.gender || "",
        coverage_tier: employee.coverage_tier || "EE",
        relationship: employee.relationship || "Employee",
        zip_code: employee.zip_code || "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [employee]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  }

  function validate() {
    const e = {};
    if (!form.first_name.trim()) e.first_name = "First name is required.";
    if (!form.last_name.trim()) e.last_name = "Last name is required.";
    if (!form.date_of_birth) e.date_of_birth = "Date of birth is required.";
    if (form.date_of_birth) {
      const dob = new Date(form.date_of_birth);
      const today = new Date();
      if (dob > today) e.date_of_birth = "Date of birth cannot be in the future.";
      const age = (today - dob) / (1000 * 60 * 60 * 24 * 365.25);
      if (age > 120) e.date_of_birth = "Please enter a valid date of birth.";
    }
    if (!form.coverage_tier) e.coverage_tier = "Coverage tier is required.";
    if (!form.relationship) e.relationship = "Relationship is required.";
    if (form.zip_code && !/^\d{5}$/.test(form.zip_code.trim())) e.zip_code = "Enter a valid 5-digit ZIP.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);

    const payload = {
      group_id: groupId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: form.date_of_birth,
      gender: form.gender || null,
      coverage_tier: form.coverage_tier,
      relationship: form.relationship,
      zip_code: form.zip_code.trim() || null,
    };

    let result;
    if (employee?.id) {
      result = await supabase.from("census").update(payload).eq("id", employee.id).select().single();
    } else {
      result = await supabase.from("census").insert(payload).select().single();
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

  const isEditing = !!employee?.id;

  const inputStyle = (hasError) => ({
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid " + (hasError ? "#EF4444" : "#D1D5DB"),
    background: "white", color: "#111827", fontSize: "14px",
    outline: "none", boxSizing: "border-box", fontFamily: "Arial, sans-serif",
  });

  return (
    <div onClick={handleBackdrop} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: "12px",
        width: "100%", maxWidth: "480px",
        boxShadow: "0 20px 48px rgba(0,0,0,0.2)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              {isEditing ? "Edit Member" : "Add Member"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
              {isEditing ? employee.first_name + " " + employee.last_name : "Enter member details"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#9CA3AF", fontSize: "20px", padding: "4px", borderRadius: "6px",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#374151"}
            onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
          >X</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gap: "14px" }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="First Name" error={errors.first_name} required>
                <input name="first_name" value={form.first_name} onChange={handleChange}
                  placeholder="Jane" style={inputStyle(errors.first_name)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = errors.first_name ? "#EF4444" : "#D1D5DB"} />
              </Field>
              <Field label="Last Name" error={errors.last_name} required>
                <input name="last_name" value={form.last_name} onChange={handleChange}
                  placeholder="Smith" style={inputStyle(errors.last_name)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = errors.last_name ? "#EF4444" : "#D1D5DB"} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Date of Birth" error={errors.date_of_birth} required>
                <input type="date" name="date_of_birth" value={form.date_of_birth}
                  onChange={handleChange} style={inputStyle(errors.date_of_birth)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = errors.date_of_birth ? "#EF4444" : "#D1D5DB"} />
              </Field>
              <Field label="Gender">
                <select name="gender" value={form.gender} onChange={handleChange}
                  style={inputStyle(false)}
                  onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                  onBlur={e => e.target.style.borderColor = "#D1D5DB"}>
                  {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Relationship" error={errors.relationship} required>
              <div style={{ display: "flex", gap: "8px" }}>
                {RELATIONSHIPS.map(r => (
                  <button key={r} type="button" onClick={() => {
                    setForm(prev => ({ ...prev, relationship: r }));
                    if (errors.relationship) setErrors(prev => ({ ...prev, relationship: null }));
                  }} style={{
                    flex: 1, padding: "8px", borderRadius: "8px",
                    border: "1px solid " + (form.relationship === r ? "#1B4F8A" : "#D1D5DB"),
                    background: form.relationship === r ? "#EFF6FF" : "white",
                    color: form.relationship === r ? "#1B4F8A" : "#374151",
                    fontSize: "13px", fontWeight: form.relationship === r ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}>{r}</button>
                ))}
              </div>
            </Field>

            <Field label="Coverage Tier" error={errors.coverage_tier} required>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {TIERS.map(t => (
                  <button key={t.value} type="button" onClick={() => {
                    setForm(prev => ({ ...prev, coverage_tier: t.value }));
                    if (errors.coverage_tier) setErrors(prev => ({ ...prev, coverage_tier: null }));
                  }} style={{
                    padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid " + (form.coverage_tier === t.value ? "#1B4F8A" : "#D1D5DB"),
                    background: form.coverage_tier === t.value ? "#EFF6FF" : "white",
                    color: form.coverage_tier === t.value ? "#1B4F8A" : "#374151",
                    fontSize: "13px", fontWeight: form.coverage_tier === t.value ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                  }}>{t.label}</button>
                ))}
              </div>
            </Field>

            <Field label="ZIP Code (optional — any state accepted)" error={errors.zip_code}>
              <input name="zip_code" value={form.zip_code} onChange={handleChange}
                placeholder={"Leave blank to use group ZIP (" + (groupZip || "") + ")"}
                maxLength={5} style={{ ...inputStyle(errors.zip_code), maxWidth: "200px" }}
                onFocus={e => e.target.style.borderColor = "#1B4F8A"}
                onBlur={e => e.target.style.borderColor = errors.zip_code ? "#EF4444" : "#D1D5DB"} />
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
          padding: "16px 24px", borderTop: "1px solid #E5E7EB",
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
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Member"}
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

