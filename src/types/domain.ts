export type QuoteState = 'candidate' | 'approved' | 'review' | 'rejected';
export type SourceType = 'static_url' | 'transcript' | 'local_text' | 'manual';
export type FetchMode = 'direct' | 'browser' | 'auto';
export type TargetType = 'user' | 'group';
export type SendStatus = 'success' | 'failed' | 'skipped';

export interface Source {
  id: string;
  name: string;
  author: string;
  source_type: SourceType;
  url_or_path: string;
  fetch_mode: FetchMode;
  priority: number;
  allowed_themes_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  enabled: number;
  schedule_cron: string;
  timezone: string;
  target_type: TargetType;
  target_ref: string;
  allowed_authors_json: string;
  allowed_themes_json: string;
  cooldown_days: number;
  quiet_hours_json: string;
  allow_same_quote_global_same_day: number;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  source_id: string;
  author: string;
  text: string;
  normalized_text: string;
  quote_hash: string;
  confidence: number;
  state: QuoteState;
  theme_json: string;
  tone: string;
  first_seen_at: string;
  last_reviewed_at: string | null;
  last_sent_at: string | null;
}

export interface QuoteCandidate {
  text: string;
  author: string;
  themes: string[];
}
