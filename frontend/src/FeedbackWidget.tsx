import React, { useState } from "react";

const resolveApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      let url = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      if (url.includes("make-my-trip-production.up.railway.app")) {
        url = "http://localhost:8000/api";
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (url.endsWith("/v1")) {
        url = url.slice(0, -3);
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (!url.endsWith("/api")) {
        url = `${url}/api`;
      }
      return url;
    } else {
      return `${window.location.origin}/api`;
    }
  }
  return "http://localhost:8000/api";
};

const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/v1`;

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackState {
  feedback_type: FeedbackType;
  message: string;
  screenshot_url: string;
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FeedbackState>({
    feedback_type: "bug",
    message: "",
    screenshot_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) {
      setError("Please describe the issue or request.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const token = localStorage.getItem("access_token");
      const resp = await fetch(`${API_URL}/v1/feedback/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          feedback_type: form.feedback_type,
          message: form.message,
          screenshot_url: form.screenshot_url || undefined,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || "Submission failed");
      }

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setForm({ feedback_type: "bug", message: "", screenshot_url: "" });
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        id="beta-feedback-trigger"
        onClick={() => setOpen(true)}
        title="Send Beta Feedback"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "24px",
          zIndex: 9999,
          background: "linear-gradient(135deg, #6c63ff 0%, #4f46e5 100%)",
          color: "#fff",
          border: "none",
          borderRadius: "50px",
          padding: "12px 20px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(108,99,255,0.4)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          letterSpacing: "0.02em",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.transform = "translateY(-2px)";
          (e.target as HTMLElement).style.boxShadow = "0 8px 32px rgba(108,99,255,0.55)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.transform = "translateY(0)";
          (e.target as HTMLElement).style.boxShadow = "0 4px 24px rgba(108,99,255,0.4)";
        }}
      >
        <span style={{ fontSize: "16px" }}>💬</span>
        Beta Feedback
      </button>

      {/* Modal Backdrop */}
      {open && (
        <div
          id="beta-feedback-modal-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "24px",
          }}
        >
          {/* Modal Card */}
          <div
            id="beta-feedback-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, #1a1d2e 0%, #12141f 100%)",
              border: "1px solid rgba(108,99,255,0.2)",
              borderRadius: "20px",
              padding: "28px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
              color: "#e8e8f0",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {submitted ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ margin: 0, color: "#6c63ff", fontSize: "20px" }}>
                  Thank you!
                </h3>
                <p style={{ margin: "8px 0 0", color: "#8b8ea8", fontSize: "14px" }}>
                  Your feedback helps us build a better Travel OS.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#e8e8f0" }}>
                      Beta Feedback
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#5e6080" }}>
                      Help us improve Travel OS
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#8b8ea8",
                      cursor: "pointer",
                      padding: "6px 10px",
                      fontSize: "16px",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Type Selector */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  {(["bug", "feature", "general"] as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, feedback_type: t }))}
                      style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: "10px",
                        border: "1.5px solid",
                        borderColor: form.feedback_type === t ? "#6c63ff" : "rgba(255,255,255,0.08)",
                        background: form.feedback_type === t ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.03)",
                        color: form.feedback_type === t ? "#a5a0ff" : "#5e6080",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        transition: "all 0.15s",
                      }}
                    >
                      {t === "bug" ? "🐛 Bug" : t === "feature" ? "✨ Feature" : "💬 General"}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  id="feedback-message"
                  placeholder={
                    form.feedback_type === "bug"
                      ? "Describe the bug — what happened, what you expected…"
                      : form.feedback_type === "feature"
                      ? "Describe the feature you'd like to see…"
                      : "Any thoughts, ideas or praise?"
                  }
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    color: "#e8e8f0",
                    fontSize: "13px",
                    padding: "12px 14px",
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "12px",
                  }}
                />

                {/* Optional screenshot URL */}
                <input
                  id="feedback-screenshot"
                  type="url"
                  placeholder="Screenshot URL (optional)"
                  value={form.screenshot_url}
                  onChange={(e) => setForm((f) => ({ ...f, screenshot_url: e.target.value }))}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "rgba(255,255,255,0.04)",
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    color: "#8b8ea8",
                    fontSize: "12px",
                    padding: "10px 14px",
                    outline: "none",
                    fontFamily: "inherit",
                    marginBottom: "16px",
                  }}
                />

                {error && (
                  <p style={{ color: "#ff6b6b", fontSize: "12px", marginBottom: "12px", margin: "0 0 12px" }}>
                    ⚠️ {error}
                  </p>
                )}

                <button
                  id="feedback-submit-btn"
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: submitting
                      ? "rgba(108,99,255,0.4)"
                      : "linear-gradient(135deg, #6c63ff 0%, #4f46e5 100%)",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                    letterSpacing: "0.02em",
                    transition: "opacity 0.15s",
                  }}
                >
                  {submitting ? "Submitting…" : "Submit Feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
