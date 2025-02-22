-- Add file format enum
create type document_format as enum (
    'txt', 'md', 'markdown', 'html', 'htm',
    'doc', 'docx', 'pdf', 'epub', 'odt',
    'rtf', 'url'
);

-- Add columns to documents table
alter table documents
    add column if not exists format document_format,
    add column if not exists file_size bigint,
    add column if not exists word_count integer,
    add column if not exists last_position integer default 0,
    add column if not exists last_accessed timestamptz;

-- Create bookmarks table
create table if not exists bookmarks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    position integer not null,
    name text,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create reading_statistics table
create table if not exists reading_statistics (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    session_id uuid references reading_sessions(id) on delete cascade,
    start_time timestamptz not null,
    end_time timestamptz,
    words_read integer default 0,
    average_wpm integer,
    pauses integer default 0,
    created_at timestamptz default now()
);

-- Add indexes
create index if not exists bookmarks_user_doc_idx on bookmarks(user_id, document_id);
create index if not exists reading_statistics_user_doc_idx on reading_statistics(user_id, document_id);
create index if not exists reading_statistics_session_idx on reading_statistics(session_id);

-- Enable RLS
alter table bookmarks enable row level security;
alter table reading_statistics enable row level security;

-- Add RLS policies
create policy "Users can manage own bookmarks"
    on bookmarks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can manage own reading statistics"
    on reading_statistics for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Add realtime
alter publication supabase_realtime add table bookmarks;

-- Update user preferences
alter table user_preferences
    add column if not exists default_wpm integer default 300,
    add column if not exists keyboard_shortcuts jsonb default '{
        "play_pause": "Space",
        "speed_up": "ArrowUp",
        "speed_down": "ArrowDown",
        "next_word": "ArrowRight",
        "prev_word": "ArrowLeft",
        "fullscreen": "KeyF",
        "save_position": "KeyS"
    }'::jsonb,
    add column if not exists reading_preferences jsonb default '{
        "pause_after_paragraph": true,
        "pause_after_sentence": true,
        "highlight_proper_nouns": true,
        "auto_adjust_wpm": true
    }'::jsonb; 