// src/pages/Census.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import EmployeeModal from "../components/EmployeeModal";
import CensusImport from "../components/CensusImport";

const TIER_LABELS = {
  "EE": "EE Only",
  "EE+SP": "EE + Spouse",
  "EE+CH": "EE + Child(ren)",
  "EE+FAM": "EE + Family",
};

const TIER_ORDER = ["EE", "EE+SP", "EE+CH", "EE+FAM"];

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Census() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [groupRes, empRes] = await Promise.all([
      supabase.from("groups").select("id, name, zip, county, effective_date, regions(region_number, region_name)").eq("id", id).single(),
      supabase.from("employees").select("*").eq("group_id", id).order("last_name", { ascending: true }),
    ]);
    if (groupRes.data) setGroup(groupRes.data);
    if (!empRes.error) setEmployees(empRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Census summary
  const summary = TIER_ORDER.map(tier => ({
    tier,
    label: TIER_LABELS[tier],
    count: employees.filter(e => e.coverage_tier === tier).length,
  }));
  const totalEmployees = employees.length;
  const avgAge = employees.length
    ? Math.round(employees.reduce((sum, e) => sum + (calcAge(e.date_of_birth) || 0), 0) / employees.length)
    : null;

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const filtered = employees
    .filter(e => {
      const q = search.toLowerCase();
      return (
        e.first_name?.toLowerCase().includes(q) ||
        e.last_name?.toLowerCase().includes(q) ||
        TIER_LABELS[e.coverage_tier]?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av, bv;
      if (sortField === "age") {
        av = calcAge(a.date_of_birth) ?? -1;
        bv = calcAge(b.date_of_birth) ?? -1;
      } else if (sortField === "tier") {
        av = TIER_ORDER.indexOf(a.coverage_tier);
        bv = TIER_ORDER.indexOf(b.coverage_tier);
      } else {
        av = (a[sortField] || "").toLowerCase();
        bv = (b[sortField] || "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("employees").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchData();
  }

  function formatDate(str) {
    if (!str) return "—";
    const [y, m, d] = str.split("-");
    return m + "/" + d + "/" + y;
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: "4px" }}>updown</span>;
    return <span style={{ marginLeft: "4px", color: "var(--accent)" }}>{sortDir === "asc" ? "up" : "down"}</span>;
  }

  const tierColors = {
    "EE": { bg: "#eff6ff", color: "#1d4ed8" },
    "EE+SP": { bg: "#f0fdf4", color: "#16a34a" },
    "EE+CH": { bg: "#fefce8", color: "#a16207" },
    "EE+FAM": { bg: "#fdf4ff", color: "#9333ea" },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading census...
    </div>
  );

  if (!group) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Group not found.
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* Page header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <button onClick={() => navigate("/dashboard")} style={crumbBtnStyle}>Dashboard</button>
                <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>/</span>
                <button onClick={() => navigate("/groups")} style={crumbBtnStyle}>Groups</button>
                <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>/</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{group.name}</span>
              </div>
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                {group.name}
              </h1>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {group.county} County
                </span>
                {group.regions && (
                  <span style={{
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-subtle)",
                    borderRadius: "5px", padding: "1px 7px",
                  }}>
                    Region {group.regions.region_number}
                  </span>
                )}
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Effective {formatDate(group.effective_date)}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={() => setShowImport(true)} style={secondaryBtnStyle}>
                Import CSV
              </button>
              <button onClick={() => { setEditingEmployee(null); setShowAddModal(true); }} style={primaryBtnStyleObj}>
                + Add Employee
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
          <SummaryCard label="Total Employees" value={totalEmployees} bold />
          {summary.map(s => (
            <SummaryCard key={s.tier} label={s.label} value={s.count}
              color={tierColors[s.tier]?.color} bg={tierColors[s.tier]?.bg} />
          ))}
          {avgAge && <SummaryCard label="Average Age" value={avgAge} suffix=" yrs" />}
        </div>

        {/* Search */}
        <div style={{ marginBottom: "1.25rem", maxWidth: "360px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
            style={{
              width: "100%", padding: "0.5625rem 0.75rem",
              border: "1.5px solid var(--border)", borderRadius: "10px",
              background: "var(--surface)", color: "var(--text-primary)",
              fontSize: "0.9375rem", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }} />
        </div>

        {/* Employee table */}
        {filtered.length === 0 ? (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "12px", padding: "4rem 2rem", textAlign: "center",
          }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
              {search ? "No employees match your search" : "No employees yet"}
            </h3>
            <p style={{ margin: "0 0 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {search ? "Try a different name or tier." : "Add employees individually or import a CSV census file."}
            </p>
            {!search && (
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button onClick={() => setShowImport(true)} style={secondaryBtnStyle}>Import CSV</button>
                <button onClick={() => setShowAddModal(true)} style={primaryBtnStyleObj}>+ Add Employee</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                  {[
                    { label: "Last Name", field: "last_name" },
                    { label: "First Name", field: "first_name" },
                    { label: "DOB", field: "date_of_birth" },
                    { label: "Age", field: "age" },
                    { label: "Gender", field: "gender" },
                    { label: "Tier", field: "tier" },
                    { label: "ZIP", field: "zip" },
                  ].map(col => (
                    <th key={col.field} onClick={() => handleSort(col.field)} style={{
                      padding: "0.75rem 1rem", textAlign: "left",
                      fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      {col.label}<SortIcon field={col.field} />
                    </th>
                  ))}
                  <th style={{ padding: "0.75rem 1rem", width: "80px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const tc = tierColors[e.coverage_tier] || {};
                  return (
                    <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = "var(--surface-hover)"}
                      onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, fontSize: "0.9375rem" }}>{e.last_name}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{e.first_name}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>{formatDate(e.date_of_birth)}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{calcAge(e.date_of_birth) ?? "—"}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{e.gender || "—"}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{
                          background: tc.bg, color: tc.color,
                          borderRadius: "6px", padding: "2px 8px",
                          fontSize: "0.8125rem", fontWeight: 600,
                        }}>{TIER_LABELS[e.coverage_tier] || e.coverage_tier}</span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        {e.zip || group.zip}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          <ActionBtn icon="Edit" title="Edit" onClick={() => { setEditingEmployee(e); setShowAddModal(true); }} />
                          <ActionBtn icon="Del" title="Delete" onClick={() => setDeleteTarget(e)} danger />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit employee modal */}
      {showAddModal && (
        <EmployeeModal
          employee={editingEmployee}
          groupId={id}
          groupZip={group.zip}
          onClose={() => { setShowAddModal(false); setEditingEmployee(null); }}
          onSaved={() => { setShowAddModal(false); setEditingEmployee(null); fetchData(); }}
        />
      )}

      {/* CSV Import */}
      {showImport && (
        <CensusImport
          groupId={id}
          groupZip={group.zip}
          onClose={() => setShowImport(false)}
          onImported={fetchData}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "rgba(10, 15, 30, 0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "14px", padding: "1.75rem", maxWidth: "400px", width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
              Remove {deleteTarget.first_name} {deleteTarget.last_name}?
            </h3>
            <p style={{ margin: "0 0 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              This employee will be removed from the census. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={secondaryBtnStyle}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                padding: "0.5625rem 1.25rem", borderRadius: "8px", border: "none",
                background: deleting ? "#fca5a5" : "#ef4444", color: "#fff",
                fontSize: "0.9375rem", fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, bold, color, bg, suffix }) {
  return (
    <div style={{
      background: bg || "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "10px", padding: "0.875rem 1rem",
    }}>
      <div style={{
        fontSize: "1.5rem", fontWeight: 700,
        color: color || "var(--text-primary)",
        lineHeight: 1,
      }}>
        {value}{suffix || ""}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{label}</div>
    </div>
  );
}

function ActionBtn({ icon, title, onClick, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      background: "none", border: "1px solid var(--border)", borderRadius: "6px",
      padding: "3px 7px", cursor: "pointer", fontSize: "0.75rem",
      color: danger ? "#ef4444" : "var(--text-muted)", fontFamily: "inherit",
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#fee2e2" : "var(--surface-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >{icon}</button>
  );
}

const crumbBtnStyle = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-muted)", fontSize: "0.8125rem", padding: 0, fontFamily: "inherit",
};

const secondaryBtnStyle = {
  padding: "0.5625rem 1.125rem", borderRadius: "8px",
  border: "1.5px solid var(--border)", background: "transparent",
  color: "var(--text-secondary)", fontSize: "0.9rem",
  fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

const primaryBtnStyleObj = {
  display: "flex", alignItems: "center", gap: "0.375rem",
  padding: "0.5625rem 1.125rem",
  background: "var(--accent)", color: "#fff",
  border: "none", borderRadius: "8px",
  fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
