-- Add quiz-related tables and enhancements

-- Quiz Questions table
create table if not exists quiz_questions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    chunk_start integer,
    chunk_end integer,
    question_text text not null,
    correct_answer text not null,
    incorrect_answers text[] not null,
    explanation text,
    difficulty text check (difficulty in ('easy', 'medium', 'hard')),
    question_type text check (question_type in ('multiple_choice', 'true_false', 'short_answer')),
    created_at timestamptz default now(),
    metadata jsonb default '{}'::jsonb
);

-- Quiz Sessions table
create table if not exists quiz_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    document_id uuid references documents(id) on delete cascade,
    reading_session_id uuid references reading_sessions(id) on delete cascade,
    start_time timestamptz default now(),
    end_time timestamptz,
    status text check (status in ('in_progress', 'completed', 'abandoned')) default 'in_progress',
    total_questions integer not null,
    correct_answers integer default 0,
    created_at timestamptz default now()
);

-- Quiz Responses table
create table if not exists quiz_responses (
    id uuid primary key default gen_random_uuid(),
    quiz_session_id uuid references quiz_sessions(id) on delete cascade,
    question_id uuid references quiz_questions(id) on delete cascade,
    user_answer text not null,
    is_correct boolean not null,
    response_time interval,
    created_at timestamptz default now()
);

-- Add indexes
create index if not exists quiz_questions_document_id_idx on quiz_questions(document_id);
create index if not exists quiz_sessions_user_id_idx on quiz_sessions(user_id);
create index if not exists quiz_sessions_document_id_idx on quiz_sessions(document_id);
create index if not exists quiz_responses_session_id_idx on quiz_responses(quiz_session_id);

-- Enable RLS
alter table quiz_questions enable row level security;
alter table quiz_sessions enable row level security;
alter table quiz_responses enable row level security;

-- Add RLS policies
create policy "Users can read questions for their documents"
    on quiz_questions for select
    using (exists (
        select 1 from documents
        where documents.id = quiz_questions.document_id
        and documents.user_id = auth.uid()
    ));

create policy "Users can manage their quiz sessions"
    on quiz_sessions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can manage their quiz responses"
    on quiz_responses for all
    using (exists (
        select 1 from quiz_sessions
        where quiz_sessions.id = quiz_responses.quiz_session_id
        and quiz_sessions.user_id = auth.uid()
    ));

-- Add to realtime publication
alter publication supabase_realtime add table quiz_sessions;
alter publication supabase_realtime add table quiz_responses;

-- Add quiz preferences to user_preferences
alter table user_preferences
    add column if not exists quiz_preferences jsonb default '{
        "frequency": "end_of_document",
        "questions_per_quiz": 5,
        "preferred_difficulty": "adaptive",
        "show_explanations": true,
        "notification_type": "modal"
    }'::jsonb; 