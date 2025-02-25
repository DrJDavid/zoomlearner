begin;
    -- Make content nullable since it will come from storage
    alter table public.documents 
        alter column content drop not null;

    -- Add index for storage path lookups
    create index documents_storage_path_idx on public.documents(storage_path);

    -- Create function to clean up storage when document is deleted
    create or replace function public.handle_document_deletion()
    returns trigger
    language plpgsql
    security definer
    as $$
    begin
        -- Delete the file from storage if it exists
        delete from storage.objects
        where bucket_id = 'documents'
        and name = old.storage_path;
        
        return old;
    end;
    $$;

    -- Create trigger to clean up storage on document deletion
    create trigger cleanup_document_storage
        before delete on public.documents
        for each row
        execute function public.handle_document_deletion();

    -- Add constraint to ensure either content or storage_path is present
    alter table public.documents
        add constraint document_content_check 
        check (
            (content is not null) or 
            (storage_path is not null and file_type is not null)
        );
commit;
