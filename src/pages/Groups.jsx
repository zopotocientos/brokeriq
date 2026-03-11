// src/pages/Groups.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import GroupModal from "../components/GroupModal";
import Layout from "../components/Layout";

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sortField, setSortField] = useState("employer_name");
  const [sortDir, setSortDir] = useState("asc");

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("groups")
      .select("id, employer_name, zip_code, county, region_number, effective_date, sic_code, created_at")
      .order("employer_name", { ascending: true });
    if (!error) setGroups(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const filtered = groups
    .filter(g => {
      const q = search.toLowerCase();
      return (
        g.employer_name?.toLowerCase().includes(q) ||
        g.county?.toLowerCase().includes(q) ||
        g.zip_code?.includes(q)
      );
    })
    .sort((a, b) => {
      let av, bv;
      if (sortField === "region_number") {
        av = a.region_number ?? 99;
        bv = b.region_number ?? 99;
      } else {
        av = (a[sortField] || "").toLowerCase();
        bv = (b[sortField] || "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  function handleSaved() { setShowModal(false); setEditingGroup(null); fetchGroups(); }
  function openCreate() { setEditingGroup(null); setShowModal(true); }
  function openEdit(g) { setEditingGroup(g); setShowModal(true); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("groups").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchGroups();
  }

  function formatDate(str) {
    if (!str) return "-";
    const [y, m, d] = str.split("-");
    return m + "/" + d + "/" + y;
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: "4px", fontSize: "10px" }}>v</span>;
    return <span style={{ marginLeft: "4px", fontSize: "10px", color: "#1B4F8A" }}>{sortDir === "asc" ? "^" : "v"}</span>;
  }

  return (
    <Layout>
      <div style={{ padding: "32px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "13px", padding: 0, fontFamily: "inherit" }}>
                Dashboard
              </button>
              <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
              <span style={{ fontSize: "13px", color: "#374151" }}>Groups</span>
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: "bold", color: "#111827", margin: "0 0 4px 0" }}>
              Employer Groups
            </h2>
            <p style={{ color: "#6B7280", margin: 0, fontSize: "15px" }}>
              {groups.length} {groups.length === 1 ? "group" : "groups"} total
            </p>
          </div>
          <button
            onClick={openCreate}
            style={{
              padding: "10px 20px",
              background: "#1B4F8A", color: "white",
              border: "none", borderRadius: "8px",
              fontSize: "15px", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#163d6e"}
            onMouseLeave={e => e.currentTarget.style.background = "#1B4F8A"}
          >
            + New Group
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: "16px", maxWidth: "360px" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, county, or ZIP..."
            style={{
              width: "100%", padding: "9px 12px",
              border: "1px solid #D1D5DB", borderRadius: "8px",
              background: "white", color: "#111827",
              fontSize: "14px", outline: "none",
              boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px", color: "#6B7280" }}>Loading groups...</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: "white", border: "1px solid #E5E7EB",
            borderRadius: "12px", padding: "64px 32px", textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              {search ? "No groups match your search" : "No groups yet"}
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6B7280", fontSize: "14px" }}>
              {search ? "Try a different name, county, or ZIP." : "Create your first employer group to start building quotes."}
            </p>
            {!search && (
              <button onClick={openCreate} style={{
                padding: "10px 24px", background: "#1B4F8A", color: "white",
                border: "none", borderRadius: "8px", fontSize: "15px",
                fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
              }}>+ New Group</button>
            )}
          </div>
        ) : (
          <div style={{
            background: "white", border: "1px solid #E5E7EB",
            borderRadius: "12px", overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                  {[
                    { label: "Group Name", field: "employer_name" },
                    { label: "ZIP", field: "zip_code" },
                    { label: "County", field: "county" },
                    { label: "Region", field: "region_number" },
                    { label: "Eff. Date", field: "effective_date" },
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
                {filtered.map((g, i) => (
                  <tr key={g.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => navigate("/groups/" + g.id + "/census")}
                  >
                    <td style={{ padding: "14px 16px", fontWeight: "600", fontSize: "15px", color: "#111827" }}>{g.employer_name}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#6B7280", fontFamily: "monospace" }}>{g.zip_code}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{g.county}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {g.region_number ? (
                        <span style={{
                          background: "#EFF6FF", color: "#1B4F8A",
                          borderRadius: "6px", padding: "2px 10px",
                          fontSize: "13px", fontWeight: "600",
                        }}>
                          R{g.region_number}
                        </span>
                      ) : "-"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{formatDate(g.effective_date)}</td>
                    <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <ActionBtn label="Edit" onClick={() => openEdit(g)} />
                        <ActionBtn label="Delete" onClick={() => setDeleteTarget(g)} danger />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <GroupModal
          group={editingGroup}
          onClose={() => { setShowModal(false); setEditingGroup(null); }}
          onSaved={handleSaved}
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
            maxWidth: "400px", width: "100%",
            boxShadow: "0 20px 48px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              Delete "{deleteTarget.employer_name}"?
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6B7280", fontSize: "14px", lineHeight: 1.6 }}>
              This will permanently delete the group and all associated data. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                padding: "9px 20px", borderRadius: "8px",
                border: "1px solid #D1D5DB", background: "transparent",
                color: "#374151", fontSize: "14px", fontWeight: "500",
                cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: deleting ? "#FCA5A5" : "#EF4444", color: "white",
                fontSize: "14px", fontWeight: "600",
                cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {deleting ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ActionBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "1px solid #E5E7EB",
      borderRadius: "6px", padding: "4px 10px",
      cursor: "pointer", fontSize: "12px", fontWeight: "500",
      color: danger ? "#EF4444" : "#374151",
      fontFamily: "inherit",
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#FEE2E2" : "#F3F4F6"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >{label}</button>
  );
}
