-- Storage bucket setup
begin;
    -- Create buckets if they don't exist
    insert into storage.buckets (id, name, public)
    values 
        ('user_documents', 'user_documents', false),
        ('user_uploads', 'user_uploads', false)
    on conflict do nothing;

    -- Create storage folders function
    create or replace function storage.create_user_folder()
    returns trigger
    language plpgsql
    security definer
    as $$
    begin
        -- Create user-specific folder in documents bucket
        insert into storage.objects (bucket_id, name, owner, metadata)
        values 
            ('user_documents', new.id || '/', new.id, '{"created_by": "system"}'),
            ('user_uploads', new.id || '/', new.id, '{"created_by": "system"}')
        on conflict do nothing;
        return new;
    end;
    $$;

    -- Create trigger to create user folders on signup
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
        after insert on auth.users
        for each row
        execute function storage.create_user_folder();
commit; 