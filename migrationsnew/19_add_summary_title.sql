begin;
    -- Add title column to summaries table
    alter table public.summaries add column if not exists title text;

    -- Update existing summaries to use the title from their associated documents
    update public.summaries s
    set title = d.title
    from public.reading_sessions rs
    join public.documents d on rs.document_id = d.id
    where s.reading_session_id = rs.id
    and s.title is null;

    -- Add a trigger to automatically set the title when a new summary is created
    create or replace function public.set_summary_title()
    returns trigger as $$
    declare
        v_title text;
    begin
        -- Get the title from the document associated with the reading session
        select d.title into v_title
        from public.reading_sessions rs
        join public.documents d on rs.document_id = d.id
        where rs.id = NEW.reading_session_id;
        
        -- Only set the title if it wasn't provided and we found one
        if NEW.title is null and v_title is not null then
            NEW.title := v_title;
        end if;
        
        return NEW;
    end;
    $$ language plpgsql security definer;

    -- Create the trigger
    drop trigger if exists set_summary_title_trigger on public.summaries;
    create trigger set_summary_title_trigger
        before insert on public.summaries
        for each row
        execute function public.set_summary_title();

    -- Update any functions that insert into summaries to include the title parameter
    -- (none found in the current migrations)

commit; 