-- Migration 011: Add buyer_summary_pdf_enabled to firm_pdf_config

ALTER TABLE firm_pdf_config
  ADD COLUMN IF NOT EXISTS buyer_summary_pdf_enabled BOOLEAN NOT NULL DEFAULT false;
