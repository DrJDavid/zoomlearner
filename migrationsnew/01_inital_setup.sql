-- Enable required extensions
create extension if not exists "vector";      -- For embeddings
create extension if not exists "pg_trgm";     -- For text search
create extension if not exists "pgcrypto";    -- For encryption functions

-- Create core tables
create table public.documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    content text not null,
    word_count integer,
    estimated_reading_time integer,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.reading_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    current_word_index integer not null default 0,
    wpm integer not null default 300,
    font_size integer not null default 16,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    -- Ensure valid values
    constraint valid_word_index check (current_word_index >= 0),
    constraint valid_wpm check (wpm > 0),
    constraint valid_font_size check (font_size > 0)
);

create table public.user_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    default_wpm integer not null default 300,
    font_size integer not null default 16,
    dark_mode boolean not null default false,
    quizzes_enabled boolean not null default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint valid_default_wpm check (default_wpm > 0),
    constraint valid_font_size check (font_size > 0)
);

-- Create indexes
create index documents_user_id_idx on documents(user_id);
create index reading_sessions_user_id_idx on reading_sessions(user_id);
create index reading_sessions_document_id_idx on reading_sessions(document_id);

-- Add RLS policies
alter table documents enable row level security;
alter table reading_sessions enable row level security;
alter table user_preferences enable row level security;

-- Documents policies
create policy "Users can read own documents"
    on documents for select
    using (auth.uid() = user_id);

create policy "Users can insert own documents"
    on documents for insert
    with check (auth.uid() = user_id);

create policy "Users can update own documents"
    on documents for update
    using (auth.uid() = user_id);

create policy "Users can delete own documents"
    on documents for delete
    using (auth.uid() = user_id);

-- Reading sessions policies
create policy "Users can read own reading sessions"
    on reading_sessions for select
    using (auth.uid() = user_id);

create policy "Users can insert own reading sessions"
    on reading_sessions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own reading sessions"
    on reading_sessions for update
    using (auth.uid() = user_id);

create policy "Users can delete own reading sessions"  -- Added this policy
    on reading_sessions for delete
    using (auth.uid() = user_id);

-- User preferences policies
create policy "Users can read own preferences"
    on user_preferences for select
    using (auth.uid() = user_id);

create policy "Users can update own preferences"
    on user_preferences for update
    using (auth.uid() = user_id);

create policy "Users can insert own preferences"
    on user_preferences for insert
    with check (auth.uid() = user_id);

-- Add updated_at triggers
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger documents_updated_at
    before update on documents
    for each row
    execute function handle_updated_at();

create trigger reading_sessions_updated_at
    before update on reading_sessions
    for each row
    execute function handle_updated_at();

create trigger user_preferences_updated_at
    before update on user_preferences
    for each row
    execute function handle_updated_at();

-- Enable realtime
begin;
    alter publication supabase_realtime add table documents;
    alter publication supabase_realtime add table reading_sessions;
    alter publication supabase_realtime add table user_preferences;
commit;