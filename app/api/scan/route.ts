import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://srhruxvcwuuxbivqxemo.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || ""
);

function categorize(subject: string, from: string): { category: string; priority: string; reason: string } {
  const subj = subject.toLowerCase();
  const sender = from.toLowerCase();

  if (sender.includes("fidelity") || sender.includes("schwab") || sender.includes("vanguard") ||
      sender.includes("jpmorgan") || sender.includes("goldman") || sender.includes("morgan stanley") ||
      subj.includes("investment") || subj.includes("portfolio") || subj.includes("dividend") ||
      subj.includes("wire") || subj.includes("transfer")) {
    return { category: "Finance", priority: "red", reason: "Financial communication" };
  }
  if (sender.includes("law") || sender.includes("legal") || sender.includes("attorney") ||
      subj.includes("contract") || subj.includes("agreement") || subj.includes("legal") ||
      subj.includes("filing") || subj.includes("compliance")) {
    return { category: "Legal", priority: "red", reason: "Legal/compliance" };
  }
  if (sender.includes("givewell") || sender.includes("givecf") || sender.includes("united way") ||
      sender.includes("foundation") || sender.includes("charity") || sender.includes("nonprofit") ||
      subj.includes("grant") || subj.includes("donation") || subj.includes("philanthrop") ||
      subj.includes("campaign") || subj.includes("endowment")) {
    return { category: "Philanthropy", priority: "red", reason: "Philanthropic / giving related" };
  }
  if (subj.includes("property") || subj.includes("lease") || subj.includes("tenant") ||
      subj.includes("real estate") || subj.includes("closing") || subj.includes("mortgage") ||
      subj.includes("mayfair") || subj.includes("hospitality")) {
    return { category: "Real Estate", priority: "yellow", reason: "Property/real estate" };
  }
  if (sender.includes("flpoly") || sender.includes("florida poly") || sender.includes("polk state") ||
      sender.includes(".edu") || subj.includes("university") || subj.includes("college") ||
      subj.includes("scholarship") || subj.includes("campus")) {
    return { category: "Education", priority: "yellow", reason: "Education institution" };
  }
  if (sender.includes("lakeland regional") || sender.includes("moffitt") || sender.includes("health") ||
      subj.includes("hospital") || subj.includes("health") || subj.includes("medical")) {
    return { category: "Healthcare", priority: "yellow", reason: "Healthcare related" };
  }
  if (sender.includes("bonnet springs") || sender.includes("lakeland") || sender.includes("polk county") ||
      sender.includes("chamber") || sender.includes("cfdc") ||
      subj.includes("community") || subj.includes("civic") || subj.includes("park")) {
    return { category: "Community", priority: "yellow", reason: "Community/civic" };
  }
  if (subj.includes("family") || subj.includes("personal") || subj.includes("barnett")) {
    return { category: "Personal", priority: "green", reason: "Personal/family" };
  }
  return { category: "General", priority: "green", reason: "General correspondence" };
}

export async function POST() {
  try {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER || "",
        pass: process.env.GMAIL_APP_PASSWORD || "",
      },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    interface EmailRow {
      gmail_id: string;
      subject: string;
      sender: string;
      sender_email: string;
      sender_domain: string;
      from_email: string;
      from_name: string;
      category: string;
      priority: string;
      reason: string;
      agents: Array<{ agent: string; reason: string }>;
      flagged_at: string;
      status: string;
    }

    const messages: EmailRow[] = [];

    try {
      const totalMessages = client.mailbox?.exists || 0;
      const startSeq = Math.max(1, totalMessages - 49);

      for await (const msg of client.fetch(`${startSeq}:*`, {
        envelope: true,
        uid: true,
        bodyStructure: true,
      })) {
        const subject = msg.envelope.subject || "(no subject)";
        const fromAddr = msg.envelope.from?.[0];
        const fromEmail = fromAddr?.address || "unknown";
        const fromName = fromAddr?.name || fromEmail;
        const fromDomain = fromEmail.split("@")[1] || "";
        const { category, priority, reason } = categorize(subject, `${fromName} ${fromEmail}`);
        const date = msg.envelope.date
          ? new Date(msg.envelope.date).toISOString()
          : new Date().toISOString();

        let agent = "Ace";
        if (category === "Legal") agent = "Astra";
        else if (category === "Education") agent = "Charles";
        else if (category === "Community") agent = "Rybo";

        messages.push({
          gmail_id: String(msg.uid),
          subject,
          sender: fromName,
          sender_email: fromEmail,
          sender_domain: fromDomain,
          from_email: fromEmail,
          from_name: fromName,
          category,
          priority,
          reason,
          agents: [{ agent, reason }],
          flagged_at: date,
          status: "active",
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    if (messages.length > 0) {
      const { error } = await supabase
        .from("flagged_emails")
        .upsert(messages, { onConflict: "gmail_id", ignoreDuplicates: true });

      if (error) {
        return NextResponse.json({ error: error.message, count: 0 }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: messages.length,
      message: `Scanned ${messages.length} emails`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
