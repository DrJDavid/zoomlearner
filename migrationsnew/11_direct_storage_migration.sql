begin;
    -- Drop previous functions if needed
    drop function if exists public.migrate_reading_session_content();
    drop function if exists public.store_document_content(text, uuid, text);
    
    -- Create new version of store_document_content that uses direct table insertion
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
        
        -- Insert directly into storage.objects instead of using storage.upload
        insert into storage.objects (
            bucket_id,
            name,
            owner,
            metadata,
            created_at
        ) values (
            'documents', 
            storage_path, 
            user_id,
            jsonb_build_object(
                'mimetype', 'text/plain',
                'size', length(content)
            ),
            now()
        );

        -- TODO: Note that this direct insertion doesn't store the actual content
        -- We still need to use the actual content once we figure out the correct storage approach
        
        -- Manually construct the storage URL instead of using storage.get_public_url
        -- Format: /storage/bucket/path
        storage_url := '/storage/documents/' || storage_path;

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

    -- Create migration function to process all eligible sessions
    create or replace function public.migrate_reading_session_content()
    returns void as $$
    declare
        session record;
        new_storage_url text;
    begin
        for session in (
            select id, user_id, title, text_content
            from public.reading_sessions
            where text_content is not null 
            and coalesce(text_content, '') != ''
            and (storage_url is null or storage_url = '')
        ) loop
            -- Store metadata in storage using our direct insertion function
            -- This creates the object record but doesn't store the content yet
            new_storage_url := public.store_document_content(
                session.text_content,
                session.user_id,
                coalesce(session.title, 'Migrated Reading Session')
            );
            
            -- Update reading session with storage URL
            update public.reading_sessions
            set storage_url = new_storage_url
            where id = session.id;
            
            -- Log migration (optional)
            raise notice 'Created storage object for session %: length=%', 
                session.id, 
                length(session.text_content);
        end loop;
        
        -- Log important message
        raise notice '---------------------------------------------------------';
        raise notice 'IMPORTANT: Content metadata has been migrated, but actual content';
        raise notice 'has not been stored. The application will continue to use the text_content';
        raise notice 'field until we resolve the storage.upload issue.';
        raise notice '---------------------------------------------------------';
    end;
    $$ language plpgsql security definer;

    -- Run the migration function
    select public.migrate_reading_session_content();
    
    -- Drop existing function before recreating
    drop function if exists public.create_reading_session(text, text, integer, integer);
    
    -- Update the create_reading_session function to keep text_content
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
        -- Try to store document metadata and get storage URL
        -- This doesn't actually store the content yet
        storage_url := public.store_document_content(
            content,
            auth.uid(),
            title
        );

        -- Create reading session with both storage_url and text_content
        insert into public.reading_sessions (
            id,
            user_id,
            title,
            storage_url,
            text_content, -- Keep text_content until storage issues resolved
            wpm,
            font_size,
            current_word_index
        ) values (
            gen_random_uuid(),
            auth.uid(),
            coalesce(title, 'Untitled Reading'),
            storage_url,
            content,
            wpm,
            font_size,
            0
        )
        returning id into new_session_id;

        return new_session_id;
    end;
    $$ language plpgsql security definer;

    -- Drop existing function before recreating
    drop function if exists public.get_session_content(uuid);
    
    -- Update the function to rely on text_content
    create or replace function public.get_session_content(
        session_id uuid
    ) returns text as $$
    declare
        storage_url text;
        content text;
    begin
        -- Get the session data
        select rs.storage_url, rs.text_content into storage_url, content
        from public.reading_sessions rs
        where rs.id = session_id 
        and rs.user_id = auth.uid();
        
        -- Check if we have permission
        if storage_url is null and content is null then
            raise exception 'Reading session not found or access denied';
        end if;
        
        -- For now, just return the content directly from text_content
        return content;
    end;
    $$ language plpgsql security definer;
    
    -- Grant execute permissions
    grant execute on function public.store_document_content(text, uuid, text) to authenticated;
    grant execute on function public.create_reading_session(text, text, integer, integer) to authenticated;
    grant execute on function public.get_session_content(uuid) to authenticated;
commit; 