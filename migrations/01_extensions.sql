-- Enable required extensions
create extension if not exists "vector";      -- For embeddings
create extension if not exists "pg_trgm";     -- For text search
create extension if not exists "pgjwt";       -- For JWT handling
create extension if not exists "pgcrypto";    -- For encryption functions
create extension if not exists "pg_cron";     -- For scheduled jobs

-- Create cron schema if it doesn't exist
create schema if not exists cron;

-- Grant usage to postgres user
grant usage on schema cron to postgres; 