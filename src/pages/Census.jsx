// src/pages/Census.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from "../lib/supabase";
import EmployeeModal from "../components/EmployeeModal";
import CensusImport from "../components/CensusImport";
import Layout from "../components/Layout";

const TIER_LABELS = { "EE": "EE Only", "EE+SP": "EE + Spouse", "EE+CH": "EE + Child(ren)", "EE+FAM": "EE + Family" };
const TIER_ORDER = ["EE", "EE+SP", "EE+CH", "EE+FAM"];
const TIER_COLORS = {
  "EE":     { bg: "#EFF6FF", color: "#1D4ED8" },
  "EE+SP":  { bg: "#F0FDF4", color: "#16A34A" },
  "EE+CH":  { bg: "#FEFCE8", color: "#A16207" },
  "EE+FAM": { bg: "#FDF4FF", color: "#9333EA" },
};

const REL_COLORS = {
  "Employee":              { bg: "#EFF6FF", color: "#1D4ED8" },
  "Spouse":                { bg: "#F0FDF4", color: "#16A34A" },
  "Spouse-Ex":             { bg: "#FEF3C7", color: "#92400E" },
  "Domestic Partner":      { bg: "#F0FDF4", color: "#16A34A" },
  "Child":                 { bg: "#FDF4FF", color: "#9333EA" },
  "Child-Legal Guardian":  { bg: "#FDF4FF", color: "#9333EA" },
  "Child-Adopted":         { bg: "#FDF4FF", color: "#9333EA" },
  "Child-Step":            { bg: "#FDF4FF", color: "#9333EA" },
  "Child-Domestic Partner":{ bg: "#FDF4FF", color: "#9333EA" },
};

function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return m + "/" + d + "/" + y;
}

export default function Census() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedEIDs, setExpandedEIDs] = useState({});
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [groupRes, memberRes] = await Promise.all([
      supabase.from("groups").select("id, employer_name, zip_code, county, region_number, effective_date").eq("id", id).single(),
      supabase.from("census").select("*").eq("group_id", id).order("last_name", { ascending: true }),
    ]);
    if (groupRes.data) setGroup(groupRes.data);
    if (!memberRes.error) setAllMembers(memberRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Split employees and dependents
  const employees = allMembers.filter(m => m.relationship === "Employee");
  const dependents = allMembers.filter(m => m.relationship !== "Employee");

  // Group dependents by EID
  const dependentsByEID = dependents.reduce((acc, d) => {
    const key = d.eid || "__no_eid__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const summary = TIER_ORDER.map(tier => ({
    tier, label: TIER_LABELS[tier],
    count: employees.filter(e => e.coverage_tier === tier).length,
  }));

  const avgAge = employees.length
    ? Math.round(employees.reduce((sum, e) => sum + (calcAge(e.date_of_birth) || 0), 0) / employees.length)
    : null;

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function toggleExpand(eid) {
    setExpandedEIDs(prev => ({ ...prev, [eid]: !prev[eid] }));
  }

  const filteredEmployees = employees
    .filter(e => {
      const q = search.toLowerCase();
      return (
        e.first_name?.toLowerCase().includes(q) ||
        e.last_name?.toLowerCase().includes(q) ||
        e.eid?.toLowerCase().includes(q) ||
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
    // If deleting an employee, also delete all dependents with same EID
    if (deleteTarget.relationship === "Employee" && deleteTarget.eid) {
      await supabase.from("census").delete().eq("group_id", id).eq("eid", deleteTarget.eid);
    } else {
      await supabase.from("census").delete().eq("id", deleteTarget.id);
    }
    setDeleting(false);
    setDeleteTarget(null);
    fetchData();
  }

  async function confirmClear() {
    setClearing(true);
    await supabase.from("census").delete().eq("group_id", id);
    setClearing(false);
    setClearConfirm(false);
    fetchData();
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: "4px", fontSize: "10px" }}>v</span>;
    return <span style={{ marginLeft: "4px", fontSize: "10px", color: "#1B4F8A" }}>{sortDir === "asc" ? "^" : "v"}</span>;
  }

  if (loading) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px", color: "#6B7280" }}>
        Loading census...
      </div>
    </Layout>
  );

  if (!group) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px", color: "#6B7280" }}>
        Group not found.
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ padding: "32px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <button onClick={() => navigate("/dashboard")} style={crumbBtn}>Dashboard</button>
              <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
              <button onClick={() => navigate("/groups")} style={crumbBtn}>Groups</button>
              <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
              <span style={{ fontSize: "13px", color: "#374151" }}>{group.employer_name}</span>
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: "bold", color: "#111827", margin: "0 0 6px 0" }}>
              {group.employer_name}
            </h2>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "14px", color: "#6B7280" }}>{group.county} County</span>
              {group.region_number && (
                <span style={{ background: "#EFF6FF", color: "#1B4F8A", borderRadius: "5px", padding: "2px 8px", fontSize: "13px", fontWeight: "600" }}>
                  Region {group.region_number}
                </span>
              )}
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Effective {formatDate(group.effective_date)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setClearConfirm(true)} style={{ ...secondaryBtn, color: "#EF4444", borderColor: "#FCA5A5" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>
              Clear Census
            </button>
            <button onClick={() => setShowImport(true)} style={secondaryBtn}>Import CSV</button>
            <button onClick={() => { setEditingMember(null); setShowAddModal(true); }}
              style={primaryBtn}
              onMouseEnter={e => e.currentTarget.style.background = "#163d6e"}
              onMouseLeave={e => e.currentTarget.style.background = "#1B4F8A"}>
              + Add Member
            </button>
            <Link to={`/groups/${id}/quotes`}>
  <button style={{ background: '#1B4F8A', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Arial, sans-serif' }}>
    Create Quote →
  </button>
</Link>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          <SummaryCard label="Total Employees" value={employees.length} />
          <SummaryCard label="Total Members" value={allMembers.length} />
          {summary.map(s => (
            <SummaryCard key={s.tier} label={s.label} value={s.count}
              color={TIER_COLORS[s.tier]?.color} bg={TIER_COLORS[s.tier]?.bg} />
          ))}
          {avgAge && <SummaryCard label="Avg. Employee Age" value={avgAge} suffix=" yrs" />}
        </div>

        {/* Search */}
        <div style={{ marginBottom: "16px", maxWidth: "360px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, EID, or tier..."
            style={{
              width: "100%", padding: "9px 12px",
              border: "1px solid #D1D5DB", borderRadius: "8px",
              background: "white", color: "#111827", fontSize: "14px",
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }} />
        </div>

        {/* Employee table */}
        {filteredEmployees.length === 0 ? (
          <div style={{
            background: "white", border: "1px solid #E5E7EB",
            borderRadius: "12px", padding: "64px 32px", textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              {search ? "No employees match your search" : "No employees yet"}
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6B7280", fontSize: "14px" }}>
              {search ? "Try a different name, EID, or tier." : "Add members individually or import a CSV census file."}
            </p>
            {!search && (
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button onClick={() => setClearConfirm(true)} style={{ ...secondaryBtn, color: "#EF4444", borderColor: "#FCA5A5" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}>
              Clear Census
            </button>
            <button onClick={() => setShowImport(true)} style={secondaryBtn}>Import CSV</button>
                <button onClick={() => setShowAddModal(true)} style={primaryBtn}
                  onMouseEnter={e => e.currentTarget.style.background = "#163d6e"}
                  onMouseLeave={e => e.currentTarget.style.background = "#1B4F8A"}>
                  + Add Member
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                  {/* Expand toggle column */}
                  <th style={{ padding: "12px 8px 12px 16px", width: "32px" }} />
                  {[
                    { label: "EID", field: "eid" },
                    { label: "Last Name", field: "last_name" },
                    { label: "First Name", field: "first_name" },
                    { label: "DOB", field: "date_of_birth" },
                    { label: "Age", field: "age" },
                    { label: "Gender", field: "gender" },
                    { label: "Tier", field: "tier" },
                    { label: "ZIP", field: "zip_code" },
                  ].map(col => (
                    <th key={col.field} onClick={() => handleSort(col.field)} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontSize: "12px", fontWeight: "600", color: "#6B7280",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      {col.label}<SortIcon field={col.field} />
                    </th>
                  ))}
                  <th style={{ padding: "12px 16px", width: "90px" }} />
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, i) => {
                  const tc = TIER_COLORS[emp.coverage_tier] || {};
                  const deps = emp.eid ? (dependentsByEID[emp.eid] || []) : [];
                  const isExpanded = expandedEIDs[emp.eid || emp.id];
                  const isLast = i === filteredEmployees.length - 1;

                  return (
                    <>
                      {/* Employee row */}
                      <tr key={emp.id}
                        style={{ borderBottom: (!isExpanded || deps.length === 0) && !isLast ? "1px solid #F3F4F6" : "none", background: isExpanded ? "#F9FAFB" : "white" }}
                        onMouseEnter={ev => { if (!isExpanded) ev.currentTarget.style.background = "#F9FAFB"; }}
                        onMouseLeave={ev => { if (!isExpanded) ev.currentTarget.style.background = "white"; }}
                      >
                        {/* Expand toggle */}
                        <td style={{ padding: "12px 4px 12px 16px" }}>
                          {deps.length > 0 ? (
                            <button
                              onClick={() => toggleExpand(emp.eid || emp.id)}
                              title={isExpanded ? "Hide dependents" : "Show " + deps.length + " dependent(s)"}
                              style={{
                                width: "20px", height: "20px", borderRadius: "4px",
                                border: "1px solid #D1D5DB", background: isExpanded ? "#1B4F8A" : "white",
                                color: isExpanded ? "white" : "#6B7280",
                                fontSize: "11px", fontWeight: "700",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                fontFamily: "inherit", flexShrink: 0,
                              }}
                            >
                              {isExpanded ? "-" : "+"}
                            </button>
                          ) : (
                            <div style={{ width: "20px" }} />
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "11px", fontFamily: "monospace", color: "#9CA3AF" }}>{emp.eid || "-"}</td>
                        <td style={{ padding: "12px 16px", fontWeight: "600", fontSize: "14px", color: "#111827" }}>{emp.last_name}</td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{emp.first_name}</td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6B7280", fontFamily: "monospace" }}>{formatDate(emp.date_of_birth)}</td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6B7280" }}>{calcAge(emp.date_of_birth) ?? "-"}</td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6B7280" }}>{emp.gender || "-"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ background: tc.bg, color: tc.color, borderRadius: "6px", padding: "2px 10px", fontSize: "13px", fontWeight: "600" }}>
                            {TIER_LABELS[emp.coverage_tier] || emp.coverage_tier}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6B7280", fontFamily: "monospace" }}>{emp.zip_code || group.zip_code}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <ActionBtn label="Edit" onClick={() => { setEditingMember(emp); setShowAddModal(true); }} />
                            <ActionBtn label="Delete" onClick={() => setDeleteTarget(emp)} danger />
                          </div>
                        </td>
                      </tr>

                      {/* Dependent rows */}
                      {isExpanded && deps.map((dep, di) => {
                        const rc = REL_COLORS[dep.relationship] || { bg: "#F3F4F6", color: "#374151" };
                        return (
                          <tr key={dep.id} style={{
                            borderBottom: di < deps.length - 1 || !isLast ? "1px solid #F3F4F6" : "none",
                            background: "#F0F7FF",
                          }}>
                            <td style={{ padding: "10px 4px 10px 16px" }} />
                            <td style={{ padding: "10px 16px", fontSize: "11px", fontFamily: "monospace", color: "#9CA3AF" }}>{dep.eid || "-"}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#374151", paddingLeft: "28px" }}>{dep.last_name}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#374151" }}>{dep.first_name}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#6B7280", fontFamily: "monospace" }}>{formatDate(dep.date_of_birth)}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#6B7280" }}>{calcAge(dep.date_of_birth) ?? "-"}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#6B7280" }}>{dep.gender || "-"}</td>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ background: rc.bg, color: rc.color, borderRadius: "6px", padding: "2px 8px", fontSize: "12px", fontWeight: "600" }}>
                                {dep.relationship}
                              </span>
                            </td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#6B7280", fontFamily: "monospace" }}>{dep.zip_code || group.zip_code}</td>
                            <td style={{ padding: "10px 16px" }}>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <ActionBtn label="Edit" onClick={() => { setEditingMember(dep); setShowAddModal(true); }} />
                                <ActionBtn label="Delete" onClick={() => setDeleteTarget(dep)} danger />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <EmployeeModal
          employee={editingMember}
          groupId={id}
          groupZip={group.zip_code}
          onClose={() => { setShowAddModal(false); setEditingMember(null); }}
          onSaved={() => { setShowAddModal(false); setEditingMember(null); fetchData(); }}
          onAddDependent={(eid) => {
            setShowAddModal(false);
            setEditingMember({ eid, relationship: "Child", coverage_tier: "EE" });
            setShowAddModal(true);
          }}
        />
      )}

      {showImport && (
        <CensusImport
          groupId={id}
          groupZip={group.zip_code}
          onClose={() => setShowImport(false)}
          onImported={fetchData}
        />
      )}

      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "white", borderRadius: "12px", padding: "28px",
            maxWidth: "400px", width: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              Remove {deleteTarget.first_name} {deleteTarget.last_name}?
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6B7280", fontSize: "14px", lineHeight: 1.6 }}>
              {deleteTarget.relationship === "Employee" && deleteTarget.eid
                ? "This will also remove all dependents linked to this employee. This cannot be undone."
                : "This dependent will be removed from the census. This cannot be undone."}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={secondaryBtn}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: deleting ? "#FCA5A5" : "#EF4444", color: "white",
                fontSize: "14px", fontWeight: "600",
                cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
          {clearConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "white", borderRadius: "12px", padding: "28px",
            maxWidth: "400px", width: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              Clear entire census?
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6B7280", fontSize: "14px", lineHeight: 1.6 }}>
              This will permanently remove all {allMembers.length} members from {group.employer_name}. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setClearConfirm(false)} style={secondaryBtn}>Cancel</button>
              <button onClick={confirmClear} disabled={clearing} style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: clearing ? "#FCA5A5" : "#EF4444", color: "white",
                fontSize: "14px", fontWeight: "600",
                cursor: clearing ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {clearing ? "Clearing..." : "Clear All " + allMembers.length + " Members"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function SummaryCard({ label, value, color, bg, suffix }) {
  return (
    <div style={{ background: bg || "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: "24px", fontWeight: "700", color: color || "#111827", lineHeight: 1 }}>{value}{suffix || ""}</div>
      <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

function ActionBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "1px solid #E5E7EB", borderRadius: "6px",
      padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "500",
      color: danger ? "#EF4444" : "#374151", fontFamily: "inherit",
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#FEE2E2" : "#F3F4F6"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >{label}</button>
  );
}

const crumbBtn = { background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "13px", padding: 0, fontFamily: "inherit" };
const secondaryBtn = { padding: "9px 18px", borderRadius: "8px", border: "1px solid #D1D5DB", background: "white", color: "#374151", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
const primaryBtn = { padding: "9px 18px", borderRadius: "8px", border: "none", background: "#1B4F8A", color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };





