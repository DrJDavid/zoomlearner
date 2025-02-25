begin;
    -- Add storage URL column to reading_sessions
    alter table public.reading_sessions
        add column if not exists storage_url text;

    -- Create function to store document content and return storage URL
    create or replace function public.store_document_content(
        content text,
        user_id uuid,
        title text default null
    ) returns text as $$
    declare
        doc_id text;
        storage_path text;
        storage_url text;
    begin
        -- Generate unique ID for document
        doc_id := gen_random_uuid()::text;
        
        -- Create storage path (user_id/doc_id.txt)
        storage_path := user_id::text || '/' || doc_id || '.txt';
        
        -- Upload content to storage bucket
        perform storage.upload(
            'documents',           -- bucket_id
            storage_path,         -- path in bucket
            content,              -- file content
            'text/plain'          -- content type
        );

        -- Get public URL for the document
        storage_url := storage.get_public_url('documents', storage_path);

        -- Insert document metadata
        insert into public.documents (
            id,
            user_id,
            title,
            storage_path,
            file_type,
            file_size,
            original_file_name
        ) values (
            doc_id::uuid,
            user_id,
            coalesce(title, 'Untitled Document'),
            storage_path,
            'txt',
            length(content),
            coalesce(title, 'document.txt')
        );

        return storage_url;
    end;
    $$ language plpgsql security definer;

    -- Create function to create reading session with stored document
    create or replace function public.create_reading_session(
        content text,
        title text default null,
        wpm integer default 300,
        font_size integer default 16
    ) returns uuid as $$
    declare
        new_session_id uuid;
        storage_url text;
    begin
        -- Store document and get storage URL
        storage_url := public.store_document_content(
            content,
            auth.uid(),
            title
        );

        -- Create reading session
        insert into public.reading_sessions (
            id,
            user_id,
            title,
            storage_url,
            wpm,
            font_size
        ) values (
            gen_random_uuid(),
            auth.uid(),
            coalesce(title, 'Untitled Reading'),
            storage_url,
            wpm,
            font_size
        )
        returning id into new_session_id;

        return new_session_id;
    end;
    $$ language plpgsql security definer;

    -- Create function to get document content from storage
    create or replace function public.get_document_content(
        storage_url text
    ) returns text as $$
    declare
        bucket_id text;
        storage_path text;
        content text;
    begin
        -- Extract bucket and path from storage URL
        -- URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
        bucket_id := split_part(storage_url, '/', 8);
        storage_path := substring(storage_url from '/[^/]+/[^/]+/[^/]+/[^/]+/[^/]+/[^/]+/([^?]+)');

        -- Get content from storage
        select convert_from(storage.download(bucket_id, storage_path), 'UTF8')
        into content;

        return content;
    end;
    $$ language plpgsql security definer;

    -- Grant execute permissions on functions
    grant execute on function public.store_document_content(text, uuid, text) to authenticated;
    grant execute on function public.create_reading_session(text, text, integer, integer) to authenticated;
    grant execute on function public.get_document_content(text) to authenticated;

commit; 