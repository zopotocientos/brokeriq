// src/components/CensusImport.jsx
import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const OUR_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "date_of_birth", label: "Date of Birth", required: true },
  { key: "coverage_tier", label: "Coverage Tier", required: true },
  { key: "gender", label: "Gender", required: false },
  { key: "zip", label: "ZIP Code", required: false },
];

// Tier normalization — maps common variants to our internal codes
const TIER_MAP = {
  "ee": "EE", "employee": "EE", "employee only": "EE", "ee only": "EE", "single": "EE",
  "ee+sp": "EE+SP", "ee + sp": "EE+SP", "ee+spouse": "EE+SP", "ee + spouse": "EE+SP",
  "employee + spouse": "EE+SP", "employee+spouse": "EE+SP", "two party": "EE+SP",
  "2-party": "EE+SP", "2 party": "EE+SP", "couple": "EE+SP",
  "ee+ch": "EE+CH", "ee + ch": "EE+CH", "ee+child": "EE+CH", "ee + child": "EE+CH",
  "ee+children": "EE+CH", "ee + children": "EE+CH", "employee + child": "EE+CH",
  "employee+child": "EE+CH", "employee + children": "EE+CH", "parent+child": "EE+CH",
  "ee+fam": "EE+FAM", "ee + fam": "EE+FAM", "ee+family": "EE+FAM", "ee + family": "EE+FAM",
  "employee + family": "EE+FAM", "employee+family": "EE+FAM", "family": "EE+FAM",
};

const TIER_LABELS = { "EE": "EE Only", "EE+SP": "EE + Spouse", "EE+CH": "EE + Child(ren)", "EE+FAM": "EE + Family" };

function normalizeTier(val) {
  if (!val) return null;
  const key = val.trim().toLowerCase();
  return TIER_MAP[key] || null;
}

function parseDOB(val) {
  if (!val) return null;
  const s = val.trim();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return mdy[3] + "-" + mdy[1].padStart(2, "0") + "-" + mdy[2].padStart(2, "0");
  // Try MM-DD-YYYY
  const mdy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy2) return mdy2[3] + "-" + mdy2[1].padStart(2, "0") + "-" + mdy2[2].padStart(2, "0");
  return null;
}

function autoSuggestMapping(headers) {
  const mapping = {};
  const hints = {
    first_name: ["first", "firstname", "first name", "fname", "given name"],
    last_name: ["last", "lastname", "last name", "lname", "surname", "family name"],
    date_of_birth: ["dob", "date of birth", "birth date", "birthdate", "birthday", "birth_date"],
    coverage_tier: ["tier", "coverage", "coverage tier", "plan", "election", "coverage type", "dependent tier"],
    gender: ["gender", "sex"],
    zip: ["zip", "zipcode", "zip code", "postal", "postal code"],
  };
  headers.forEach((h, i) => {
    const lower = h.trim().toLowerCase();
    for (const [field, keywords] of Object.entries(hints)) {
      if (!mapping[field] && keywords.some(k => lower === k || lower.includes(k))) {
        mapping[field] = i;
      }
    }
  });
  return mapping;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }).filter(r => r.some(c => c));
  return { headers, rows };
}

const STEPS = ["Upload", "Map Columns", "Preview & Import"];

export default function CensusImport({ groupId, groupZip, onClose, onImported }) {
  const [step, setStep] = useState(0);
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file || !file.name.endsWith(".csv")) {
      alert("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSV(e.target.result);
      if (parsed.headers.length === 0) {
        alert("Could not parse this file. Make sure it is a valid CSV.");
        return;
      }
      setCsvData(parsed);
      setMapping(autoSuggestMapping(parsed.headers));
      setStep(1);
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function buildPreview(mappingToUse) {
    const { headers, rows } = csvData;
    const results = [];
    rows.forEach((row, idx) => {
      const entry = { _row: idx + 2, _errors: [] };
      OUR_FIELDS.forEach(f => {
        const colIdx = mappingToUse[f.key];
        const raw = colIdx !== undefined ? (row[colIdx] || "").trim() : "";
        if (f.key === "date_of_birth") {
          entry[f.key] = parseDOB(raw);
          if (f.required && !entry[f.key]) entry._errors.push("Invalid or missing Date of Birth");
        } else if (f.key === "coverage_tier") {
          entry[f.key] = normalizeTier(raw);
          if (f.required && !entry[f.key]) entry._errors.push("Unrecognized Coverage Tier: \"" + raw + "\"");
        } else if (f.key === "gender") {
          const g = raw.toUpperCase();
          entry[f.key] = ["M", "F", "X"].includes(g) ? g : (raw.toLowerCase().startsWith("m") ? "M" : raw.toLowerCase().startsWith("f") ? "F" : null);
        } else {
          entry[f.key] = raw || null;
          if (f.required && !raw) entry._errors.push("Missing " + f.label);
        }
      });
      results.push(entry);
    });
    return results;
  }

  function handleProceedToPreview() {
    const missing = OUR_FIELDS.filter(f => f.required && mapping[f.key] === undefined);
    if (missing.length) {
      alert("Please map required fields: " + missing.map(f => f.label).join(", "));
      return;
    }
    setPreview(buildPreview(mapping));
    setStep(2);
  }

  async function handleImport() {
    const valid = preview.filter(r => r._errors.length === 0);
    if (valid.length === 0) {
      alert("No valid rows to import.");
      return;
    }
    setImporting(true);
    const payload = valid.map(r => ({
      group_id: groupId,
      first_name: r.first_name,
      last_name: r.last_name,
      date_of_birth: r.date_of_birth,
      coverage_tier: r.coverage_tier,
      gender: r.gender || null,
      zip_code: r.zip || null,
    }));

    const { error } = await supabase.from("census").insert(payload);
    setImporting(false);
    if (error) {
      setResult({ success: false, message: error.message });
    } else {
      setResult({ success: true, imported: valid.length, skipped: preview.length - valid.length });
    }
  }

  const validCount = preview.filter(r => r._errors.length === 0).length;
  const errorCount = preview.filter(r => r._errors.length > 0).length;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(10, 15, 30, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "16px", width: "100%", maxWidth: "680px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        animation: "modalIn 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Import Census</h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Upload any CSV — no template required
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "1.25rem", padding: "0.25rem", borderRadius: "6px",
          }}>X</button>
        </div>

        {/* Step indicators */}
        <div style={{
          display: "flex", padding: "1rem 1.75rem", gap: "0.5rem",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
                background: i === step ? "var(--accent)" : i < step ? "var(--accent-subtle)" : "var(--surface-subtle)",
                color: i === step ? "#fff" : i < step ? "var(--accent)" : "var(--text-muted)",
                border: i < step ? "1.5px solid var(--accent)" : "none",
              }}>{i < step ? "+" : i + 1}</div>
              <span style={{
                fontSize: "0.8125rem", fontWeight: i === step ? 600 : 400,
                color: i === step ? "var(--text-primary)" : "var(--text-muted)",
              }}>{s}</span>
              {i < STEPS.length - 1 && (
                <span style={{ color: "var(--border)", marginLeft: "0.25rem" }}>-</span>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1 }}>

          {/* Step 0: Upload */}
          {step === 0 && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: "2px dashed " + (dragOver ? "var(--accent)" : "var(--border)"),
                borderRadius: "12px",
                padding: "3rem 2rem",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "var(--accent-subtle)" : "var(--surface-subtle)",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Drop your CSV file here, or click to browse
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Any CSV format accepted — Employee Navigator, spreadsheet exports, anything
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Step 1: Map columns */}
          {step === 1 && csvData && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
                We found {csvData.headers.length} columns in your file. Match each of our fields to the right column.
                Fields marked <span style={{ color: "var(--accent)" }}>*</span> are required.
              </p>
              <div style={{
                background: "var(--surface-subtle)", borderRadius: "10px",
                overflow: "hidden", border: "1px solid var(--border)",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Our Field
                      </th>
                      <th style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Your Column
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {OUR_FIELDS.map((f, i) => (
                      <tr key={f.key} style={{ borderBottom: i < OUR_FIELDS.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>
                          {f.label}
                          {f.required && <span style={{ color: "var(--accent)", marginLeft: "2px" }}>*</span>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <select
                            value={mapping[f.key] !== undefined ? mapping[f.key] : ""}
                            onChange={e => {
                              const val = e.target.value;
                              setMapping(prev => {
                                const next = { ...prev };
                                if (val === "") { delete next[f.key]; }
                                else { next[f.key] = parseInt(val); }
                                return next;
                              });
                            }}
                            style={{
                              padding: "0.4375rem 0.625rem", borderRadius: "7px",
                              border: "1.5px solid " + (f.required && mapping[f.key] === undefined ? "#fca5a5" : "var(--border)"),
                              background: "var(--surface)", color: "var(--text-primary)",
                              fontSize: "0.875rem", outline: "none", fontFamily: "inherit",
                              minWidth: "200px",
                            }}
                          >
                            <option value="">-- Skip this field --</option>
                            {csvData.headers.map((h, idx) => (
                              <option key={idx} value={idx}>{h}</option>
                            ))}
                          </select>
                          {mapping[f.key] !== undefined && (
                            <span style={{
                              marginLeft: "0.5rem", fontSize: "0.75rem",
                              color: "var(--accent)", fontStyle: "italic",
                            }}>
                              Auto-matched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample preview */}
              <div>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  First 3 rows from your file
                </p>
                <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "100%" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border)" }}>
                        {csvData.headers.map((h, i) => (
                          <th key={i} style={{ padding: "0.5rem 0.75rem", textAlign: "left", whiteSpace: "nowrap", color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                          {csvData.headers.map((_, j) => (
                            <td key={j} style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                              {row[j] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && !result && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <StatChip label="Total rows" value={preview.length} />
                <StatChip label="Ready to import" value={validCount} accent />
                {errorCount > 0 && <StatChip label="Will be skipped" value={errorCount} danger />}
              </div>

              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border)" }}>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>DOB</th>
                      <th style={thStyle}>Tier</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>ZIP</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{
                        borderBottom: i < preview.length - 1 ? "1px solid var(--border)" : "none",
                        background: r._errors.length ? "#fff5f5" : "transparent",
                      }}>
                        <td style={tdStyle}>{(r.first_name || "") + " " + (r.last_name || "")}</td>
                        <td style={tdStyle}>{r.date_of_birth || "—"}</td>
                        <td style={tdStyle}>{r.coverage_tier ? TIER_LABELS[r.coverage_tier] : "—"}</td>
                        <td style={tdStyle}>{r.gender || "—"}</td>
                        <td style={tdStyle}>{r.zip || "—"}</td>
                        <td style={tdStyle}>
                          {r._errors.length === 0 ? (
                            <span style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 600 }}>Ready</span>
                          ) : (
                            <span title={r._errors.join(", ")} style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 600, cursor: "help" }}>
                              Error ({r._errors.length})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errorCount > 0 && (
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Hover over "Error" in the Status column to see what went wrong. Those rows will be skipped — you can add them manually after import.
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              {result.success ? (
                <>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>+</div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 700 }}>Import Complete</h3>
                  <p style={{ margin: "0 0 0.25rem", color: "var(--text-muted)" }}>
                    {result.imported} {result.imported === 1 ? "employee" : "employees"} imported successfully.
                  </p>
                  {result.skipped > 0 && (
                    <p style={{ margin: 0, color: "#dc2626", fontSize: "0.875rem" }}>
                      {result.skipped} {result.skipped === 1 ? "row was" : "rows were"} skipped due to errors.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>!</div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>Import Failed</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{result.message}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "1.125rem 1.75rem", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--surface-subtle)", flexShrink: 0,
        }}>
          <div>
            {step > 0 && !result && (
              <button onClick={() => setStep(s => s - 1)} style={secondaryBtnStyle}>
                Back
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={onClose} style={secondaryBtnStyle}>
              {result ? "Close" : "Cancel"}
            </button>
            {step === 1 && (
              <button onClick={handleProceedToPreview} style={primaryBtnStyle(false)}>
                Preview Import
              </button>
            )}
            {step === 2 && !result && (
              <button onClick={handleImport} disabled={importing || validCount === 0} style={primaryBtnStyle(importing || validCount === 0)}>
                {importing ? "Importing..." : "Import " + validCount + " " + (validCount === 1 ? "Employee" : "Employees")}
              </button>
            )}
            {result && result.success && (
              <button onClick={() => { onImported(); onClose(); }} style={primaryBtnStyle(false)}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        select:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-subtle); }
      `}</style>
    </div>
  );
}

function StatChip({ label, value, accent, danger }) {
  return (
    <div style={{
      padding: "0.625rem 1rem", borderRadius: "8px",
      border: "1px solid " + (accent ? "var(--accent)" : danger ? "#fca5a5" : "var(--border)"),
      background: accent ? "var(--accent-subtle)" : danger ? "#fff5f5" : "var(--surface-subtle)",
    }}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: accent ? "var(--accent)" : danger ? "#dc2626" : "var(--text-primary)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

const thStyle = {
  padding: "0.625rem 0.875rem", textAlign: "left",
  fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "0.625rem 0.875rem", color: "var(--text-secondary)", whiteSpace: "nowrap",
};

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

