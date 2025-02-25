begin;
    -- Create summaries table
    create table if not exists public.summaries (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        reading_session_id uuid references public.reading_sessions(id) on delete cascade,
        content text not null,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
    );

    -- Add trigger for updated_at
    create trigger summaries_updated_at
        before update on summaries
        for each row
        execute function handle_updated_at();

    -- Enable RLS
    alter table public.summaries enable row level security;

    -- RLS policies
    create policy "Users can view their own summaries"
        on summaries for select
        using (auth.uid() = user_id);

    create policy "Users can create their own summaries"
        on summaries for insert
        with check (auth.uid() = user_id);

    create policy "Users can update their own summaries"
        on summaries for update
        using (auth.uid() = user_id);

    create policy "Users can delete their own summaries"
        on summaries for delete
        using (auth.uid() = user_id);

    -- Enable realtime for summaries
    alter publication supabase_realtime add table summaries;

    -- Function to generate a summary for a reading session
    create or replace function public.generate_summary(
        p_reading_session_id uuid,
        p_length text default 'medium'  -- 'short', 'medium', or 'long'
    ) returns uuid as $$
    declare
        v_user_id uuid;
        v_content text;
        v_system_prompt text;
        v_user_prompt text;
        v_summary text;
        v_summary_id uuid;
        v_length_desc text;
        v_existing_summary_id uuid;
    begin
        -- Check if reading session belongs to user
        select user_id into v_user_id
        from public.reading_sessions
        where id = p_reading_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Reading session not found or you do not have permission';
        end if;
        
        -- Check if summary already exists
        select id into v_existing_summary_id
        from public.summaries
        where reading_session_id = p_reading_session_id;
        
        -- Get content from reading session
        v_content := public.get_reading_context(
            p_reading_session_id := p_reading_session_id,
            p_window_size := 8000  -- Use a larger window for summaries
        );
        
        if v_content is null or v_content = '' then
            raise exception 'No content available for summarization';
        end if;
        
        -- Set length description
        case p_length
            when 'short' then v_length_desc := 'a concise 2-3 sentence summary';
            when 'long' then v_length_desc := 'a detailed summary covering all key points (about 500-700 words)';
            else v_length_desc := 'a balanced summary of about 250-350 words';
        end case;
        
        -- Set prompts
        v_system_prompt := 'You are a skilled summarizer. Given a document or text, create ' || 
                           v_length_desc || ' that captures the main ideas and important details.';
        
        v_user_prompt := 'Please summarize the following text: 

"""
' || v_content || '
"""';
        
        -- Generate summary
        v_summary := public.call_ai_service(
            prompt := v_user_prompt,
            system_prompt := v_system_prompt,
            max_tokens := 1500  -- Allow longer responses for summaries
        );
        
        -- Create or update summary
        if v_existing_summary_id is null then
            -- Insert new summary
            insert into public.summaries (
                user_id,
                reading_session_id,
                content
            ) values (
                auth.uid(),
                p_reading_session_id,
                v_summary
            ) returning id into v_summary_id;
        else
            -- Update existing summary
            update public.summaries
            set 
                content = v_summary,
                updated_at = now()
            where id = v_existing_summary_id
            returning id into v_summary_id;
        end if;
        
        return v_summary_id;
    end;
    $$ language plpgsql security definer;

    -- Function to get existing summary for a reading session
    create or replace function public.get_summary(
        p_reading_session_id uuid
    ) returns text as $$
    declare
        v_user_id uuid;
        v_summary text;
    begin
        -- Check if reading session belongs to user
        select user_id into v_user_id
        from public.reading_sessions
        where id = p_reading_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Reading session not found or you do not have permission';
        end if;
        
        -- Get summary content
        select content into v_summary
        from public.summaries
        where reading_session_id = p_reading_session_id;
        
        return v_summary;
    end;
    $$ language plpgsql security definer;

    -- Grant execute permissions
    grant execute on function public.generate_summary(uuid, text) to authenticated;
    grant execute on function public.get_summary(uuid) to authenticated;
    
commit; 