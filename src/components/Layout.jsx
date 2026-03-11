// src/components/Layout.jsx
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", fontFamily: "Arial, sans-serif" }}>
      <nav style={{
        background: "white",
        borderBottom: "1px solid #E5E7EB",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <h1
          onClick={() => navigate("/dashboard")}
          style={{
            fontSize: "24px", fontWeight: "bold",
            color: "#1B4F8A", margin: 0,
            letterSpacing: "-0.5px", cursor: "pointer",
          }}
        >
          BrokerIQ
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: "#6B7280" }}>{user?.email}</span>
          <button
            onClick={handleSignOut}
            style={{
              padding: "8px 16px", background: "transparent",
              border: "1px solid #D1D5DB", borderRadius: "6px",
              fontSize: "14px", color: "#374151", cursor: "pointer",
            }}
            onMouseEnter={e => { e.target.style.background = "#F3F4F6"; e.target.style.borderColor = "#9CA3AF"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.borderColor = "#D1D5DB"; }}
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main>
        {children}
      </main>
    </div>
  );
}
