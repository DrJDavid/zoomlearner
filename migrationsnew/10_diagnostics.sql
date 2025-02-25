begin;
    -- This migration is for diagnostic purposes only
    -- It attempts to find the correct way to call storage.upload in this environment

    -- First, let's check what functions exist in the storage schema
    do $$
    declare
        func_record record;
    begin
        raise notice 'Available storage functions:';
        for func_record in 
            select p.proname, pg_get_function_arguments(p.oid) as args
            from pg_proc p
            join pg_namespace n on p.pronamespace = n.oid
            where n.nspname = 'storage'
            order by p.proname
        loop
            raise notice '  %(%)', func_record.proname, func_record.args;
        end loop;
    end $$;

    -- Try different ways to upload content to storage

    -- Function to test storage uploads
    create or replace function public.test_storage_upload()
    returns text as $$
    declare
        test_id text;
        test_path text;
        test_result text := 'Unknown';
    begin
        -- Generate a unique test ID
        test_id := gen_random_uuid()::text;
        test_path := 'test/' || test_id || '.txt';
        
        begin
            -- Attempt 1: Try with text, text, text
            perform storage.upload(
                test_path::text, 
                'Test content'::text, 
                'text/plain'::text
            );
            test_result := 'Success with (text, text, text)';
            return test_result;
        exception when others then
            test_result := 'Failed with (text, text, text): ' || sqlerrm;
        end;

        begin
            -- Attempt 2: Try with specific casts and bucket prefix
            perform storage.upload(
                ('documents/' || test_path)::text, 
                'Test content'::text, 
                'text/plain'::text
            );
            test_result := 'Success with (documents/path as text, text, text)';
            return test_result;
        exception when others then
            test_result := 'Failed with (documents/path as text, text, text): ' || sqlerrm;
        end;

        begin
            -- Attempt 3: Try with bucket and path as separate params
            perform storage.upload(
                'documents'::text,
                test_path::text, 
                'Test content'::text
            );
            test_result := 'Success with (bucket, path, content)';
            return test_result;
        exception when others then
            test_result := 'Failed with (bucket, path, content): ' || sqlerrm;
        end;

        begin
            -- Attempt 4: Try with bytea explicit cast
            perform storage.upload(
                test_path::text, 
                'Test content'::bytea, 
                'text/plain'::text
            );
            test_result := 'Success with (text, bytea, text)';
            return test_result;
        exception when others then
            test_result := 'Failed with (text, bytea, text): ' || sqlerrm;
        end;

        begin
            -- Attempt 5: Try with convert_to for bytea
            perform storage.upload(
                test_path::text, 
                convert_to('Test content', 'UTF8'), 
                'text/plain'::text
            );
            test_result := 'Success with (text, convert_to(text, UTF8), text)';
            return test_result;
        exception when others then
            test_result := 'Failed with (text, convert_to(text, UTF8), text): ' || sqlerrm;
        end;

        begin
            -- Attempt 6: Check signature from migration 6 and 7
            -- This was supposedly working in earlier migrations
            perform storage.upload(
                'test_key'::text,
                'Test content'::text,
                'text/plain'::text
            );
            test_result := 'Success with migration 06/07 style';
            return test_result;
        exception when others then
            test_result := 'Failed with migration 06/07 style: ' || sqlerrm;
        end;

        return test_result;
    end;
    $$ language plpgsql security definer;

    -- Test the function and output results
    do $$
    declare
        result text;
    begin
        select public.test_storage_upload() into result;
        raise notice 'Storage upload test result: %', result;
    end $$;

    -- Clean up
    drop function if exists public.test_storage_upload();

    -- Provide the correct way to call storage functions once discovered
    raise notice 'Update migrations 10 and 11 based on the diagnostic results';
commit; 