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

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  coverage_tier: "EE",
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

  return (
    <div onClick={handleBackdrop} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(10, 15, 30, 0.6)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        width: "100%", maxWidth: "480px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        overflow: "hidden",
        animation: "modalIn 0.2s ease-out",
      }}>
        <div style={{
          padding: "1.5rem 1.75rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {isEditing ? "Edit Employee" : "Add Employee"}
            </h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              {isEditing ? employee.first_name + " " + employee.last_name : "Enter employee details"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "1.25rem",
            padding: "0.25rem", borderRadius: "6px",
          }}>X</button>
        </div>

        <div style={{ padding: "1.5rem 1.75rem" }}>
          <div style={{ display: "grid", gap: "1rem" }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <Field label="First Name" error={errors.first_name} required>
                <input name="first_name" value={form.first_name} onChange={handleChange}
                  placeholder="Jane" style={inputStyle(errors.first_name)} />
              </Field>
              <Field label="Last Name" error={errors.last_name} required>
                <input name="last_name" value={form.last_name} onChange={handleChange}
                  placeholder="Smith" style={inputStyle(errors.last_name)} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <Field label="Date of Birth" error={errors.date_of_birth} required>
                <input type="date" name="date_of_birth" value={form.date_of_birth}
                  onChange={handleChange} style={inputStyle(errors.date_of_birth)} />
              </Field>
              <Field label="Gender">
                <select name="gender" value={form.gender} onChange={handleChange} style={inputStyle()}>
                  {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Coverage Tier" error={errors.coverage_tier} required>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {TIERS.map(t => (
                  <button key={t.value} type="button" onClick={() => {
                    setForm(prev => ({ ...prev, coverage_tier: t.value }));
                    if (errors.coverage_tier) setErrors(prev => ({ ...prev, coverage_tier: null }));
                  }} style={{
                    padding: "0.5rem 0.75rem", borderRadius: "8px",
                    border: "1.5px solid " + (form.coverage_tier === t.value ? "var(--accent)" : "var(--border)"),
                    background: form.coverage_tier === t.value ? "var(--accent-subtle)" : "transparent",
                    color: form.coverage_tier === t.value ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "0.875rem", fontWeight: form.coverage_tier === t.value ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    transition: "all 0.15s",
                  }}>{t.label}</button>
                ))}
              </div>
            </Field>

            <Field label="ZIP Code (if different from group)" error={errors.zip_code}>
              <input name="zip_code" value={form.zip_code} onChange={handleChange}
                placeholder={"Leave blank to use group ZIP (" + (groupZip || "") + ")"}
                maxLength={5} style={{ ...inputStyle(errors.zip_code), maxWidth: "200px" }} />
            </Field>

            {errors.submit && (
              <div style={{
                background: "#fee2e2", border: "1px solid #fca5a5",
                borderRadius: "8px", padding: "0.75rem 1rem",
                color: "#991b1b", fontSize: "0.875rem",
              }}>{errors.submit}</div>
            )}
          </div>
        </div>

        <div style={{
          padding: "1.125rem 1.75rem",
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "flex-end", gap: "0.75rem",
          background: "var(--surface-subtle)",
        }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtnStyle(saving)}>
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Employee"}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "var(--accent)", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

function inputStyle(error) {
  return {
    width: "100%", padding: "0.5625rem 0.75rem",
    borderRadius: "8px",
    border: "1.5px solid " + (error ? "#ef4444" : "var(--border)"),
    background: "var(--surface)", color: "var(--text-primary)",
    fontSize: "0.9375rem", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };
}

const secondaryBtnStyle = {
  padding: "0.5625rem 1.25rem", borderRadius: "8px",
  border: "1.5px solid var(--border)", background: "transparent",
  color: "var(--text-secondary)", fontSize: "0.9375rem",
  fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

function primaryBtnStyle(disabled) {
  return {
    padding: "0.5625rem 1.5rem", borderRadius: "8px", border: "none",
    background: disabled ? "var(--accent-muted)" : "var(--accent)",
    color: "#fff", fontSize: "0.9375rem", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
  };
}
