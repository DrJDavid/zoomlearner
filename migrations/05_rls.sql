-- Enable Row Level Security
alter table documents enable row level security;
alter table reading_sessions enable row level security;
alter table user_preferences enable row level security;
alter table text_chunks enable row level security;
alter table summaries enable row level security;
alter table quiz_results enable row level security;
alter table user_notes enable row level security;

-- Documents policies
create policy "Users can read own documents"
    on documents for select using (auth.uid() = user_id);
create policy "Users can insert own documents"
    on documents for insert with check (auth.uid() = user_id);
create policy "Users can update own documents"
    on documents for update using (auth.uid() = user_id);
create policy "Users can delete own documents"
    on documents for delete using (auth.uid() = user_id);

-- Reading Sessions policies
create policy "Users can read own reading sessions"
    on reading_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own reading sessions"
    on reading_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own reading sessions"
    on reading_sessions for update using (auth.uid() = user_id);

-- User Preferences policies
create policy "Users can read own preferences"
    on user_preferences for select using (auth.uid() = user_id);
create policy "Users can update own preferences"
    on user_preferences for update using (auth.uid() = user_id);
create policy "Users can insert own preferences"
    on user_preferences for insert with check (auth.uid() = user_id);

-- Text Chunks policies
create policy "Users can read chunks of own documents"
    on text_chunks for select
    using (exists (
        select 1 from documents
        where documents.id = text_chunks.document_id
        and documents.user_id = auth.uid()
    ));
create policy "Users can insert chunks for own documents"
    on text_chunks for insert
    with check (exists (
        select 1 from documents
        where documents.id = text_chunks.document_id
        and documents.user_id = auth.uid()
    ));

-- Summaries policies
create policy "Users can read summaries of own documents"
    on summaries for select
    using (exists (
        select 1 from documents
        where documents.id = summaries.document_id
        and documents.user_id = auth.uid()
    ));
create policy "Users can create summaries for own documents"
    on summaries for insert
    with check (exists (
        select 1 from documents
        where documents.id = summaries.document_id
        and documents.user_id = auth.uid()
    ));

-- Quiz Results policies
create policy "Users can read own quiz results"
    on quiz_results for select using (auth.uid() = user_id);
create policy "Users can insert own quiz results"
    on quiz_results for insert with check (auth.uid() = user_id);

-- User Notes policies
create policy "Users can read own notes"
    on user_notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
    on user_notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes"
    on user_notes for update using (auth.uid() = user_id);
create policy "Users can delete own notes"
    on user_notes for delete using (auth.uid() = user_id);

-- Storage policies
create policy "Users can read own documents in storage"
    on storage.objects for select
    using (bucket_id = 'user_documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload to own folder"
    on storage.objects for insert
    with check (
        bucket_id in ('user_documents', 'user_uploads')
        and auth.uid()::text = (storage.foldername(name))[1]
        and (storage.foldername(name))[1] != ''
    );

create policy "Users can delete own documents in storage"
    on storage.objects for delete
    using (
        bucket_id in ('user_documents', 'user_uploads')
        and auth.uid()::text = (storage.foldername(name))[1]
    ); 