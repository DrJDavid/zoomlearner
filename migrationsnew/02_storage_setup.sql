-- Set up storage buckets
begin;
    -- Create buckets if they don't exist
    insert into storage.buckets (id, name, public)
    values 
        ('documents', 'documents', false),        -- For processed documents
        ('uploads', 'uploads', false)            -- For temporary uploads
    on conflict do nothing;

    -- Add storage-related columns to documents table
    alter table public.documents
        add column file_type text check (file_type in ('pdf', 'txt', 'md', 'docx', 'html')),
        add column storage_path text,
        add column file_size bigint,
        add column original_file_name text;

    -- Storage policies for documents bucket
    create policy "Users can read own documents in storage"
        on storage.objects for select
        using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

    create policy "Users can write own documents in storage"
        on storage.objects for insert
        with check (
            bucket_id = 'documents' 
            and auth.uid()::text = (storage.foldername(name))[1]
            and (storage.foldername(name))[1] != ''
        );

    create policy "Users can delete own documents in storage"
        on storage.objects for delete
        using (
            bucket_id = 'documents'
            and auth.uid()::text = (storage.foldername(name))[1]
        );

    -- Storage policies for uploads bucket (temporary storage)
    create policy "Users can read own uploads"
        on storage.objects for select
        using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);

    create policy "Users can write own uploads"
        on storage.objects for insert
        with check (
            bucket_id = 'uploads'
            and auth.uid()::text = (storage.foldername(name))[1]
            and (storage.foldername(name))[1] != ''
        );

    create policy "Users can delete own uploads"
        on storage.objects for delete
        using (
            bucket_id = 'uploads'
            and auth.uid()::text = (storage.foldername(name))[1]
        );
commit;