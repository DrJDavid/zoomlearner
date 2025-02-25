begin;
    -- Standardize column names between migrations
    -- Make sure all necessary columns exist with consistent names
    alter table public.documents
        add column if not exists storage_path text,
        add column if not exists file_type text,
        add column if not exists file_size bigint,
        add column if not exists original_file_name text;
    
    -- If storage_key exists and storage_path doesn't have values,
    -- copy values from storage_key to storage_path
    do $$
    begin
        if exists (select 1 from information_schema.columns 
                  where table_schema = 'public' 
                  and table_name = 'documents' 
                  and column_name = 'storage_key') then
            
            update public.documents
            set storage_path = storage_key
            where storage_key is not null 
            and (storage_path is null or storage_path = '');
            
            -- Drop the storage_key column after migration
            alter table public.documents drop column if exists storage_key;
        end if;
    end $$;
    
    -- Ensure reading_sessions has both document_id and storage_url
    alter table public.reading_sessions
        add column if not exists document_id uuid references public.documents(id) on delete cascade,
        add column if not exists storage_url text,
        add column if not exists text_content text;
    
    -- Add constraint to ensure each reading_session has at least one document reference method
    do $$
    begin
        if not exists (
            select 1 from information_schema.constraint_column_usage
            where table_schema = 'public'
            and table_name = 'reading_sessions'
            and constraint_name = 'has_document_reference'
        ) then
            alter table public.reading_sessions
                add constraint has_document_reference 
                check (
                    (document_id is not null) or 
                    (storage_url is not null) or
                    (text_content is not null)
                );
        end if;
    end $$;

    -- Drop the existing function before recreating it with a different parameter name
    drop function if exists public.get_document_content(text);

    -- Update or create the get_document_content function to handle both UUID and storage_url
    create or replace function public.get_document_content(
        doc_identifier text
    ) returns text as $$
    declare
        storage_path text;
        bucket_id text;
        content text;
        is_uuid boolean;
        doc_id uuid;
    begin
        -- Check if input is UUID or storage URL
        begin
            doc_id := doc_identifier::uuid;
            is_uuid := true;
        exception when others then
            is_uuid := false;
        end;
        
        if is_uuid then
            -- Get storage path from documents table by UUID
            select d.storage_path into storage_path
            from public.documents d
            where d.id = doc_id and d.user_id = auth.uid();
            
            bucket_id := 'documents';
        else
            -- Input is a storage URL
            -- Extract bucket and path from storage URL
            bucket_id := split_part(doc_identifier, '/', 8);
            storage_path := substring(doc_identifier from '/[^/]+/[^/]+/[^/]+/[^/]+/[^/]+/[^/]+/([^?]+)');
        end if;
        
        if storage_path is null then
            raise exception 'Document not found or access denied';
        end if;
        
        -- Get content from storage
        select convert_from(storage.download(bucket_id, storage_path), 'UTF8')
        into content;
        
        return content;
    end;
    $$ language plpgsql security definer;
    
    -- Grant execute permissions
    grant execute on function public.get_document_content(text) to authenticated;
commit; 