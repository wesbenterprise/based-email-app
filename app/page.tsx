"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────
interface AgentTag {
  agent: string;
  reason: string;
}

interface FlaggedEmail {
  id: string;
  gmail_id: string;
  subject: string;
  sender: string;
  sender_email: string;
  sender_domain: string;
  category: string;
  priority: string; // high, medium, low
  agents: AgentTag[];
  flagged_at: string;
  status: string;
}

interface Rating {
  flagged_email_id: string;
  rating: "great" | "ok" | "bad";
}

const AGENT_EMOJI: Record<string, string> = {
  Ace: "♠️",
  Astra: "🌟",
  Rybo: "🎭",
  Charles: "📜",
  Dezayas: "🔧",
  Anderson: "📊",
  Pressy: "📢",
  Oracle: "👁️",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_BADGE: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };

function timeAgo(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) {
    const hrs = Math.floor(ms / 3600000);
    return hrs === 0 ? "just now" : `${hrs}h ago`;
  }
  return `${days}d ago`;
}

function ageColor(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days >= 7) return "text-red";
  if (days >= 3) return "text-amber";
  return "text-text-muted";
}

// ── Component ──────────────────────────────────────────
export default function Home() {
  const [emails, setEmails] = useState<FlaggedEmail[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating["rating"]>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [reviewedOpen, setReviewedOpen] = useState(false);

  // Filters
  const [agentFilter, setAgentFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"priority" | "newest" | "oldest">("priority");

  useEffect(() => {
    fetchEmails();
  }, []);

  async function fetchEmails() {
    setLoading(true);
    const { data, error } = await supabase
      .from("flagged_emails")
      .select("*")
      .eq("status", "active")
      .order("flagged_at", { ascending: false });

    if (!error && data) {
      setEmails(data as FlaggedEmail[]);
      setLastScan(new Date().toLocaleTimeString());
    }

    // Fetch existing ratings
    const { data: rData } = await supabase
      .from("email_ratings")
      .select("flagged_email_id, rating");

    if (rData) {
      const map: Record<string, Rating["rating"]> = {};
      rData.forEach((r: Rating) => { map[r.flagged_email_id] = r.rating as Rating["rating"]; });
      setRatings(map);
    }
    setLoading(false);
  }

  async function rateEmail(email: FlaggedEmail, rating: Rating["rating"]) {
    setRatings((prev) => ({ ...prev, [email.id]: rating }));
    const mainAgent = email.agents?.[0]?.agent || "unknown";
    await supabase.from("email_ratings").upsert({
      flagged_email_id: email.id,
      gmail_id: email.gmail_id,
      agent: mainAgent,
      rating,
      subject: email.subject,
      sender: email.sender,
      sender_domain: email.sender_domain,
      category: email.category,
      created_at: new Date().toISOString(),
    }, { onConflict: "flagged_email_id" });
  }

  function handleSurfaceMore() {
    setScanning(true);
    setTimeout(() => setScanning(false), 3000);
  }

  // ── Filtering & Sorting ──
  const filtered = useMemo(() => {
    let list = [...emails];
    if (agentFilter !== "All") {
      list = list.filter((e) => e.agents?.some((a) => a.agent === agentFilter));
    }
    if (ratingFilter === "Unreviewed") {
      list = list.filter((e) => !ratings[e.id]);
    } else if (ratingFilter === "great" || ratingFilter === "ok" || ratingFilter === "bad") {
      list = list.filter((e) => ratings[e.id] === ratingFilter);
    }
    list.sort((a, b) => {
      if (sortBy === "priority") {
        const pd = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pd !== 0) return pd;
        return new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime();
      }
      if (sortBy === "newest") return new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime();
      return new Date(a.flagged_at).getTime() - new Date(b.flagged_at).getTime();
    });
    return list;
  }, [emails, agentFilter, ratingFilter, sortBy, ratings]);

  const unreviewed = filtered.filter((e) => !ratings[e.id]);
  const reviewed = filtered.filter((e) => ratings[e.id]);
  const greatCount = Object.values(ratings).filter((r) => r === "great").length;
  const okCount = Object.values(ratings).filter((r) => r === "ok").length;
  const badCount = Object.values(ratings).filter((r) => r === "bad").length;
  const unreviewedCount = emails.length - Object.keys(ratings).length;

  // ── Render ──
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <header className="text-center mb-8">
        <h1
          className="text-4xl md:text-5xl font-bold tracking-wider neon-text"
          style={{ fontFamily: "Orbitron, sans-serif" }}
        >
          EMAIL INTELLIGENCE
        </h1>
        <p className="text-text-muted mt-2 text-lg">
          Surfaced by your agents · Last scan:{" "}
          <span className="cyan-text text-cyan">{lastScan || "—"}</span>
        </p>
      </header>

      {/* Stats Bar */}
      <div className="glass p-4 mb-6 flex flex-wrap justify-center gap-6 text-lg">
        <span>📧 {emails.length} surfaced</span>
        <span>⭐ {greatCount} Great</span>
        <span>👍 {okCount} OK</span>
        <span>👎 {badCount} Bad</span>
        <span className="text-cyan">{unreviewedCount} Unreviewed</span>
      </div>

      {/* Filter Bar */}
      <div className="glass p-3 mb-6 flex flex-wrap gap-3 items-center text-base">
        <span className="text-text-muted mr-1">Agent:</span>
        {["All", "Ace", "Astra", "Rybo", "Charles"].map((a) => (
          <button
            key={a}
            onClick={() => setAgentFilter(a)}
            className={`px-3 py-1 rounded-lg transition-colors ${
              agentFilter === a
                ? "bg-magenta/30 text-magenta border border-magenta/50"
                : "hover:bg-surface-hover text-text-muted"
            }`}
          >
            {a !== "All" ? `${AGENT_EMOJI[a] || ""} ` : ""}{a}
          </button>
        ))}
        <span className="text-text-muted ml-4 mr-1">Rating:</span>
        {[
          { key: "All", label: "All" },
          { key: "Unreviewed", label: "Unreviewed" },
          { key: "great", label: "⭐" },
          { key: "ok", label: "👍" },
          { key: "bad", label: "👎" },
        ].map((r) => (
          <button
            key={r.key}
            onClick={() => setRatingFilter(r.key)}
            className={`px-3 py-1 rounded-lg transition-colors ${
              ratingFilter === r.key
                ? "bg-cyan/30 text-cyan border border-cyan/50"
                : "hover:bg-surface-hover text-text-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-text-muted ml-4 mr-1">Sort:</span>
        {(["priority", "newest", "oldest"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1 rounded-lg transition-colors capitalize ${
              sortBy === s
                ? "bg-magenta/30 text-magenta border border-magenta/50"
                : "hover:bg-surface-hover text-text-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-2xl pulse-scan text-magenta">
          LOADING INTELLIGENCE...
        </div>
      )}

      {/* Unreviewed Emails */}
      {!loading && (
        <>
          <h2 className="text-xl mb-4 text-cyan cyan-text">
            UNREVIEWED ({unreviewed.length})
          </h2>
          {unreviewed.length === 0 && (
            <div className="glass p-8 text-center text-text-muted text-lg mb-6">
              {emails.length === 0 ? "No emails surfaced yet. Your agents are scanning..." : "All caught up! Every email has been reviewed."}
            </div>
          )}
          <div className="space-y-3 mb-6">
            {unreviewed.map((email) => (
              <EmailCard key={email.id} email={email} rating={ratings[email.id]} onRate={rateEmail} />
            ))}
          </div>

          {/* Surface More Button */}
          <div className="text-center mb-8">
            <button
              onClick={handleSurfaceMore}
              disabled={scanning}
              className={`px-8 py-3 rounded-xl text-xl font-bold transition-all neon-border ${
                scanning
                  ? "pulse-scan text-magenta bg-magenta/10"
                  : "bg-magenta/20 text-magenta hover:bg-magenta/30 hover:scale-105"
              }`}
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              {scanning ? "🔄 SCANNING..." : "🔄 SURFACE MORE"}
            </button>
          </div>

          {/* Reviewed Section */}
          {reviewed.length > 0 && (
            <div className="mb-8">
              <button
                onClick={() => setReviewedOpen(!reviewedOpen)}
                className="text-xl mb-4 text-text-muted hover:text-cyan transition-colors w-full text-left"
              >
                {reviewedOpen ? "▼" : "▶"} REVIEWED ({reviewed.length})
                <span className="ml-4 text-base">
                  ⭐ Great Finds ({reviewed.filter((e) => ratings[e.id] === "great").length}) ·
                  👍 OK ({reviewed.filter((e) => ratings[e.id] === "ok").length}) ·
                  👎 Bad ({reviewed.filter((e) => ratings[e.id] === "bad").length})
                </span>
              </button>
              {reviewedOpen && (
                <div className="space-y-3">
                  {reviewed.map((email) => (
                    <EmailCard key={email.id} email={email} rating={ratings[email.id]} onRate={rateEmail} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Email Card ─────────────────────────────────────────
function EmailCard({
  email,
  rating,
  onRate,
}: {
  email: FlaggedEmail;
  rating?: "great" | "ok" | "bad";
  onRate: (e: FlaggedEmail, r: "great" | "ok" | "bad") => void;
}) {
  const ratingClass = rating === "great" ? "shimmer-great" : rating === "ok" ? "rated-ok" : rating === "bad" ? "rated-bad" : "";

  return (
    <div
      className={`glass p-4 cursor-pointer hover:bg-surface-hover transition-all ${ratingClass}`}
      onClick={() =>
        window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`, "_blank")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{PRIORITY_BADGE[email.priority] || "🟢"}</span>
            <span className="font-bold text-lg truncate">{email.subject}</span>
          </div>
          <div className="text-text-muted text-base">
            {email.sender} · <span className="text-sm">{email.sender_email}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(email.agents || []).map((a, i) => (
              <span key={i} className="text-sm bg-magenta/15 text-magenta px-2 py-0.5 rounded-md">
                {AGENT_EMOJI[a.agent] || "🤖"} {a.agent}: {a.reason}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm ${ageColor(email.flagged_at)}`}>{timeAgo(email.flagged_at)}</div>
        </div>
      </div>

      {/* Rating Buttons */}
      <div className="flex gap-2 mt-3 justify-end">
        {(["great", "ok", "bad"] as const).map((r) => {
          const label = r === "great" ? "⭐ Great" : r === "ok" ? "👍 OK" : "👎 Bad";
          const isActive = rating === r;
          return (
            <button
              key={r}
              onClick={(e) => {
                e.stopPropagation();
                onRate(email, r);
              }}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                isActive
                  ? r === "great"
                    ? "bg-gold/30 text-gold border border-gold/50"
                    : r === "ok"
                    ? "bg-neon-green/30 text-neon-green border border-neon-green/50"
                    : "bg-red/30 text-red border border-red/50"
                  : "bg-surface hover:bg-surface-hover text-text-muted border border-border"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
