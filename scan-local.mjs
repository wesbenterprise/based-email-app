#!/usr/bin/env node
/**
 * Local email scanner — runs on Wesley's machine, pushes to Supabase.
 * Usage: node scan-local.mjs
 * The Email Intelligence app reads from the same Supabase table.
 */
import { ImapFlow } from "imapflow";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

function getPassword(service, account) {
  return execSync(`security find-generic-password -a "${account}" -s "${service}" -w`, { encoding: "utf8" }).trim();
}

const GMAIL_USER = "wesbenterprise@gmail.com";
const GMAIL_PASS = getPassword("himalaya-imap", GMAIL_USER);
const SUPABASE_URL = "https://srhruxvcwuuxbivqxemo.supabase.co";
const SUPABASE_KEY = getPassword("supabase-service-role", "dezayas");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function categorize(subject, from) {
  const subj = subject.toLowerCase();
  const sender = from.toLowerCase();

  if (sender.includes("fidelity") || sender.includes("schwab") || sender.includes("vanguard") ||
      sender.includes("jpmorgan") || sender.includes("goldman") || sender.includes("morgan") ||
      subj.includes("investment") || subj.includes("portfolio") || subj.includes("dividend") ||
      subj.includes("wire") || subj.includes("transfer") || subj.includes("statement")) {
    return { category: "Finance", priority: "red", reason: "Financial communication" };
  }
  if (sender.includes("law") || sender.includes("legal") || sender.includes("attorney") ||
      subj.includes("contract") || subj.includes("agreement") || subj.includes("legal")) {
    return { category: "Legal", priority: "red", reason: "Legal/compliance" };
  }
  if (sender.includes("givewell") || sender.includes("givecf") || sender.includes("united way") ||
      sender.includes("foundation") || sender.includes("charity") ||
      subj.includes("grant") || subj.includes("donation") || subj.includes("philanthrop")) {
    return { category: "Philanthropy", priority: "red", reason: "Philanthropic / giving" };
  }
  if (subj.includes("property") || subj.includes("lease") || subj.includes("tenant") ||
      subj.includes("real estate") || subj.includes("closing") || subj.includes("mayfair")) {
    return { category: "Real Estate", priority: "yellow", reason: "Property/real estate" };
  }
  if (sender.includes("flpoly") || sender.includes("florida poly") || sender.includes("polk state") ||
      sender.includes(".edu") || subj.includes("university") || subj.includes("college")) {
    return { category: "Education", priority: "yellow", reason: "Education institution" };
  }
  if (sender.includes("lakeland regional") || sender.includes("moffitt") ||
      subj.includes("hospital") || subj.includes("health") || subj.includes("medical")) {
    return { category: "Healthcare", priority: "yellow", reason: "Healthcare related" };
  }
  if (sender.includes("bonnet springs") || sender.includes("lakeland") || sender.includes("polk county") ||
      sender.includes("chamber") || subj.includes("community") || subj.includes("civic")) {
    return { category: "Community", priority: "yellow", reason: "Community/civic" };
  }
  if (subj.includes("family") || subj.includes("personal") || subj.includes("barnett")) {
    return { category: "Personal", priority: "green", reason: "Personal/family" };
  }
  return { category: "General", priority: "green", reason: "General correspondence" };
}

async function scan() {
  console.log("Connecting to Gmail...");
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const messages = [];

  try {
    const total = client.mailbox?.exists || 0;
    const start = Math.max(1, total - 49);
    console.log(`Scanning messages ${start} to ${total}...`);

    for await (const msg of client.fetch(`${start}:*`, { envelope: true, uid: true })) {
      if (!msg.envelope) continue;
      const subject = msg.envelope.subject || "(no subject)";
      const fromAddr = msg.envelope.from?.[0];
      const fromEmail = fromAddr?.address || "unknown";
      const fromName = fromAddr?.name || fromEmail;
      const fromDomain = fromEmail.split("@")[1] || "";
      const { category, priority, reason } = categorize(subject, `${fromName} ${fromEmail}`);
      const date = msg.envelope.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString();

      let agent = "Ace";
      if (category === "Legal") agent = "Astra";
      else if (category === "Education") agent = "Charles";
      else if (category === "Community") agent = "Rybo";

      messages.push({
        gmail_id: String(msg.uid),
        subject,
        sender: `${fromName} <${fromEmail}>`,
        sender_domain: fromDomain,
        priority,
        agents: [{ agent, reason, category }],
        received_at: date,
        status: "active",
      });
    }
  } finally {
    lock.release();
  }

  await client.logout();
  console.log(`Scanned ${messages.length} emails. Pushing to Supabase...`);

  if (messages.length > 0) {
    const { error } = await supabase
      .from("flagged_emails")
      .upsert(messages, { onConflict: "gmail_id", ignoreDuplicates: true });

    if (error) {
      console.error("Supabase error:", error.message);
    } else {
      console.log(`✅ ${messages.length} emails synced to Supabase.`);
    }
  }
}

scan().catch(console.error);
