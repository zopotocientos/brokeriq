// src/pages/Groups.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import GroupModal from "../components/GroupModal";

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

  function handleSaved() {
    setShowModal(false);
    setEditingGroup(null);
    fetchGroups();
  }

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
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: "4px" }}>updown</span>;
    return <span style={{ marginLeft: "4px", color: "var(--accent)" }}>{sortDir === "asc" ? "up" : "dn"}</span>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <button onClick={() => navigate("/dashboard")} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: "0.8125rem", padding: 0, fontFamily: "inherit",
                }}>Dashboard</button>
                <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>/</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>Groups</span>
              </div>
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Employer Groups
              </h1>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                {groups.length} {groups.length === 1 ? "group" : "groups"} total
              </p>
            </div>
            <button onClick={openCreate} style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.625rem 1.25rem",
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: "10px",
              fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              + New Group
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        <div style={{ marginBottom: "1.25rem", maxWidth: "360px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, county, or ZIP..."
            style={{
              width: "100%", padding: "0.5625rem 0.75rem",
              border: "1.5px solid var(--border)", borderRadius: "10px",
              background: "var(--surface)", color: "var(--text-primary)",
              fontSize: "0.9375rem", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }} />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
            Loading groups...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} onNew={openCreate} />
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
                  {[
                    { label: "Group Name", field: "employer_name" },
                    { label: "ZIP", field: "zip_code" },
                    { label: "County", field: "county" },
                    { label: "Region", field: "region_number" },
                    { label: "Eff. Date", field: "effective_date" },
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
                {filtered.map((g, i) => (
                  <tr key={g.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => navigate("/groups/" + g.id + "/census")}
                  >
                    <td style={{ padding: "0.875rem 1rem", fontWeight: 600, fontSize: "0.9375rem" }}>{g.employer_name}</td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.9rem", fontFamily: "monospace", color: "var(--text-secondary)" }}>{g.zip_code}</td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{g.county}</td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      {g.region_number ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          background: "var(--accent-subtle)", color: "var(--accent)",
                          borderRadius: "6px", padding: "2px 8px",
                          fontSize: "0.8125rem", fontWeight: 600,
                        }}>
                          R{g.region_number}
                        </span>
                      ) : "-"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{formatDate(g.effective_date)}</td>
                    <td style={{ padding: "0.875rem 1rem" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <ActionBtn title="Edit" onClick={() => openEdit(g)} icon="Edit" />
                        <ActionBtn title="Delete" onClick={() => setDeleteTarget(g)} icon="Del" danger />
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
              Delete "{deleteTarget.employer_name}"?
            </h3>
            <p style={{ margin: "0 0 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              This will permanently delete the group and all associated data. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                padding: "0.5625rem 1.25rem", borderRadius: "8px",
                border: "1.5px solid var(--border)", background: "transparent",
                color: "var(--text-secondary)", fontSize: "0.9375rem",
                fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                padding: "0.5625rem 1.25rem", borderRadius: "8px", border: "none",
                background: deleting ? "#fca5a5" : "#ef4444", color: "#fff",
                fontSize: "0.9375rem", fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
                {deleting ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, title, onClick, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      background: "none", border: "1px solid var(--border)",
      borderRadius: "6px", padding: "4px 8px",
      cursor: "pointer", fontSize: "0.8125rem",
      color: danger ? "#ef4444" : "var(--text-muted)",
    }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#fee2e2" : "var(--surface-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >{icon}</button>
  );
}

function EmptyState({ search, onNew }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "4rem 2rem", textAlign: "center",
    }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
        {search ? "No groups match your search" : "No groups yet"}
      </h3>
      <p style={{ margin: "0 0 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {search ? "Try a different name, county, or ZIP." : "Create your first employer group to start building quotes."}
      </p>
      {!search && (
        <button onClick={onNew} style={{
          padding: "0.625rem 1.5rem", background: "var(--accent)", color: "#fff",
          border: "none", borderRadius: "10px", fontSize: "0.9375rem",
          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>+ New Group</button>
      )}
    </div>
  );
}
