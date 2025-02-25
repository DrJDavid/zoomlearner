-- Migration to ensure HTTP extension is properly installed

-- First, create the extensions schema if it doesn't exist
create schema if not exists extensions;

-- Make sure the extension is available to all users
grant usage on schema extensions to public;

-- Enable the HTTP extension in the extensions schema
create extension if not exists http with schema extensions;

-- Make sure functions from the extension are executable by authenticated users
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

-- Add the extension schema to the search path for easier usage
alter database postgres set search_path to "$user", public, extensions; 