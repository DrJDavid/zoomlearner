-- Documents table
create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    description text,
    source_type text not null check (source_type in ('file', 'url', 'text')),
    source_url text,
    storage_path text,  -- For files stored in bucket
    content_hash text,  -- To prevent duplicate processing
    total_chunks integer,
    estimated_reading_time integer,  -- in minutes
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Reading Sessions table
create table if not exists reading_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    current_word_index integer not null,
    text_content text not null,
    wpm integer not null,
    timestamp timestamptz default now(),
    created_at timestamptz default now()
);

-- User Preferences table
create table if not exists user_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique,
    wpm integer default 300,
    font_size integer default 16,
    dark_mode boolean default false,
    quizzes_enabled boolean default true,
    autopause_enabled boolean default true,
    updated_at timestamptz default now(),
    created_at timestamptz default now()
);

-- Text Chunks table (for RAG)
create table if not exists text_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    chunk_index integer not null,
    content text not null,
    embedding vector(1536),
    embedding_compressed bytea,  -- Compressed version for storage efficiency
    tokens integer,  -- Track token usage
    created_at timestamptz default now(),
    unique(document_id, chunk_index)
);

-- Summaries table
create table if not exists summaries (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    chunk_start integer,
    chunk_end integer,
    summary_type text not null check (summary_type in ('quick', 'detailed', 'key_points')),
    content text not null,
    created_at timestamptz default now(),
    unique(document_id, chunk_start, chunk_end, summary_type)
);

-- Quiz Results table
create table if not exists quiz_results (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    reading_session_id uuid references reading_sessions(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    score integer not null,
    total_questions integer not null,
    answers jsonb,  -- Store user's answers for review
    timestamp timestamptz default now(),
    created_at timestamptz default now()
);

-- User Notes
create table if not exists user_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    chunk_index integer,
    content text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
); 