import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://srhruxvcwuuxbivqxemo.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyaHJ1eHZjd3V1eGJpdnF4ZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODMyMTMsImV4cCI6MjA4NzU1OTIxM30.9JyCfNQ-ie1eUzr6yEtFINhZPoiTvRzwE9DRLM3U754';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
CREATE TABLE IF NOT EXISTS email_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flagged_email_id uuid REFERENCES flagged_emails(id),
  gmail_id text,
  agent text,
  rating text CHECK (rating IN ('great', 'ok', 'bad')),
  subject text,
  sender text,
  sender_domain text,
  category text,
  created_at timestamptz DEFAULT now()
);
*/
