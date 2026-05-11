-- Migration 010: Firm PDF Config — SA-controlled KC PDF generation settings

CREATE TABLE IF NOT EXISTS firm_pdf_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  pdf_enabled BOOLEAN NOT NULL DEFAULT false,
  pdf_format TEXT NOT NULL DEFAULT 'STANDARD'
    CHECK (pdf_format IN ('STANDARD')),
  firm_short_name TEXT,
  footer_text TEXT DEFAULT 'RATES INCLUSIVE OF ALL TAXES',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (firm_id)
);

-- RLS: SA bypasses RLS entirely; firm users can only read their own config
ALTER TABLE firm_pdf_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_pdf_config_isolation ON firm_pdf_config
  USING (
    current_setting('app.current_firm_id', true) = ''
    OR firm_id = current_setting('app.current_firm_id', true)::UUID
  );
