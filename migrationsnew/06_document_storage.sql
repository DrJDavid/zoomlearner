begin;
    -- Create documents table for metadata if it doesn't exist
    create table if not exists public.documents (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        title text,
        storage_key text not null,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        content_type text default 'text/plain',
        file_size bigint
    );

    -- Drop existing policies if they exist
    drop policy if exists "Users can read own documents" on documents;
    drop policy if exists "Users can insert own documents" on documents;
    drop policy if exists "Users can update own documents" on documents;
    drop policy if exists "Users can delete own documents" on documents;

    -- Add RLS policies for documents
    alter table public.documents enable row level security;

    create policy "Users can read own documents"
        on documents for select
        using (auth.uid() = user_id);

    create policy "Users can insert own documents"
        on documents for insert
        with check (auth.uid() = user_id);

    create policy "Users can update own documents"
        on documents for update
        using (auth.uid() = user_id);

    create policy "Users can delete own documents"
        on documents for delete
        using (auth.uid() = user_id);

    -- Add document_id to reading_sessions if it doesn't exist
    alter table public.reading_sessions 
        add column if not exists document_id uuid references public.documents(id) on delete cascade;

    -- Drop existing functions if they exist
    drop function if exists public.create_document(text, text, text);
    drop function if exists public.get_document_content(uuid);

    -- Create function to handle document creation
    create or replace function public.create_document(
        title text,
        content text,
        content_type text default 'text/plain'
    ) returns uuid as $$
    declare
        new_id uuid;
        storage_key text;
    begin
        -- Generate new UUID for document
        new_id := gen_random_uuid();
        -- Create storage key (user_id/document_id)
        storage_key := auth.uid()::text || '/' || new_id::text;
        
        -- Insert document metadata
        insert into public.documents (
            id,
            user_id,
            title,
            storage_key,
            content_type,
            file_size
        ) values (
            new_id,
            auth.uid(),
            title,
            storage_key,
            content_type,
            length(content)
        );

        -- Upload content to storage bucket
        perform storage.upload(
            storage_key,
            content,
            content_type
        );

        return new_id;
    end;
    $$ language plpgsql security definer;

    -- Create function to read document content
    create or replace function public.get_document_content(
        doc_id uuid
    ) returns text as $$
    declare
        storage_key text;
        content text;
    begin
        -- Get storage key for document
        select d.storage_key into storage_key
        from public.documents d
        where d.id = doc_id and d.user_id = auth.uid();

        if storage_key is null then
            raise exception 'Document not found or access denied';
        end if;

        -- Get content from storage bucket
        select convert_from(storage.download(storage_key), 'UTF8') into content;

        return content;
    end;
    $$ language plpgsql security definer;

    -- Enable realtime for documents if not already enabled
    do $$
    begin
        if not exists (
            select 1 from pg_publication_tables 
            where tablename = 'documents' 
            and pubname = 'supabase_realtime'
        ) then
            alter publication supabase_realtime add table documents;
        end if;
    end $$;

    -- Drop existing trigger if it exists
    drop trigger if exists handle_updated_at on documents;

    -- Add updated_at trigger for documents using our existing function
    create trigger handle_updated_at
        before update on documents
        for each row
        execute function public.handle_updated_at();

commit; 