-- Migration 005: Add FCM token to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
