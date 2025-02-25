begin;
    -- Add missing columns to documents table
    alter table public.documents 
        add column if not exists storage_key text,
        add column if not exists content_type text default 'text/plain',
        add column if not exists file_size bigint;

    -- Migrate existing document content to storage
    with docs_to_migrate as (
        select 
            id,
            user_id,
            content,
            user_id::text || '/' || id::text as new_storage_key,
            length(content) as content_length
        from documents
        where content is not null
        and storage_key is null  -- Only migrate documents not yet in storage
    )
    update documents d
    set 
        storage_key = m.new_storage_key,
        file_size = m.content_length
    from docs_to_migrate m
    where d.id = m.id
    returning d.id, d.storage_key, d.content;

    -- Upload content to storage buckets
    do $$
    declare
        doc record;
    begin
        for doc in (
            select d.id, d.storage_key, d.content
            from documents d
            where d.storage_key is not null
            and d.content is not null
        ) loop
            perform storage.upload(
                doc.storage_key,
                doc.content,
                'text/plain'
            );
        end loop;
    end $$;

    -- Make storage_key not null after migration
    alter table public.documents 
        alter column storage_key set not null;

    -- Drop content column from documents (since we now use storage)
    -- Only do this after verifying data migration
    -- alter table documents drop column content;

commit; 