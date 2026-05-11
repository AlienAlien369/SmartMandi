-- Migration 012: Add daybook_pdf_enabled to firm_pdf_config

ALTER TABLE firm_pdf_config
  ADD COLUMN IF NOT EXISTS daybook_pdf_enabled BOOLEAN NOT NULL DEFAULT false;
