begin;
    -- Add title column to reading_sessions
    alter table public.reading_sessions
        add column title text;

    -- Add comment for documentation
    comment on column reading_sessions.title is 'Title of the reading session, optional';

    -- Update RLS policies to include new column
    drop policy if exists "Users can read own reading sessions" on reading_sessions;
    drop policy if exists "Users can insert own reading sessions" on reading_sessions;
    drop policy if exists "Users can update own reading sessions" on reading_sessions;
    drop policy if exists "Users can delete own reading sessions" on reading_sessions;

    create policy "Users can read own reading sessions"
        on reading_sessions for select
        using (auth.uid() = user_id);

    create policy "Users can insert own reading sessions"
        on reading_sessions for insert
        with check (auth.uid() = user_id);

    create policy "Users can update own reading sessions"
        on reading_sessions for update
        using (auth.uid() = user_id);

    create policy "Users can delete own reading sessions"
        on reading_sessions for delete
        using (auth.uid() = user_id);

commit;