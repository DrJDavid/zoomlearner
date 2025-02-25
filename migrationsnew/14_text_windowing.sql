begin;
    -- Function to get a window of text around a specific position
    create or replace function public.get_text_window(
        p_text text,
        p_position integer,
        p_window_size integer default 3000,
        p_overlap_size integer default 200
    ) returns text as $$
    declare
        v_text_length integer;
        v_start integer;
        v_end integer;
        v_result text;
    begin
        -- Validate inputs
        if p_text is null then
            return null;
        end if;
        
        v_text_length := length(p_text);
        
        -- Adjust position to be within text bounds
        p_position := greatest(1, least(p_position, v_text_length));
        
        -- Calculate window boundaries
        v_start := greatest(1, p_position - (p_window_size / 2)::integer);
        v_end := least(v_text_length, v_start + p_window_size);
        
        -- Adjust start if end is at text boundary
        if v_end = v_text_length then
            v_start := greatest(1, v_end - p_window_size);
        end if;
        
        -- Extract window
        v_result := substring(p_text from v_start for (v_end - v_start));
        
        return v_result;
    end;
    $$ language plpgsql immutable;

    -- Function to get relevant context from a reading session
    create or replace function public.get_reading_context(
        p_reading_session_id uuid,
        p_current_position integer default null,
        p_window_size integer default 3000
    ) returns text as $$
    declare
        v_content text;
        v_position integer;
        v_user_id uuid;
        v_storage_url text;
    begin
        -- Check if reading session belongs to user
        select user_id, current_word_index, text_content, storage_url
        into v_user_id, v_position, v_content, v_storage_url
        from public.reading_sessions
        where id = p_reading_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Reading session not found or you do not have permission';
        end if;
        
        -- Use provided position or fall back to current_word_index
        v_position := coalesce(p_current_position, v_position, 0);
        
        -- Try to get content from text_content first
        if v_content is not null and v_content != '' then
            return public.get_text_window(v_content, v_position, p_window_size);
        end if;
        
        -- If no text_content, try to get from storage
        if v_storage_url is not null and v_storage_url != '' then
            -- Use get_session_content if it exists
            if exists (
                select 1 
                from pg_proc 
                where proname = 'get_session_content' 
                and pronamespace = (select oid from pg_namespace where nspname = 'public')
            ) then
                v_content := public.get_session_content(p_reading_session_id);
                return public.get_text_window(v_content, v_position, p_window_size);
            end if;
        end if;
        
        return null;
    end;
    $$ language plpgsql security definer;

    -- Enhanced chat response function with text windowing
    create or replace function public.get_ai_chat_response_with_context(
        p_session_id uuid,
        p_user_message text,
        p_system_prompt text default 'You are a helpful assistant.'
    ) returns uuid as $$
    declare
        v_user_message_id uuid;
        v_assistant_message_id uuid;
        v_reading_session_id uuid;
        v_context text;
        v_response text;
        v_position integer;
    begin
        -- Get reading session ID and current position
        select 
            cs.reading_session_id, rs.current_word_index into v_reading_session_id, v_position
        from 
            public.chat_sessions cs
            left join public.reading_sessions rs on cs.reading_session_id = rs.id
        where 
            cs.id = p_session_id and cs.user_id = auth.uid();
        
        if v_reading_session_id is null then
            raise exception 'Chat session not found or you do not have permission';
        end if;
        
        -- Add user message
        v_user_message_id := public.add_chat_message(
            p_session_id := p_session_id,
            p_role := 'user',
            p_content := p_user_message
        );
        
        -- Get context window for the document
        v_context := public.get_reading_context(
            p_reading_session_id := v_reading_session_id,
            p_current_position := v_position
        );
        
        -- If we have context, add it to system prompt
        if v_context is not null and v_context != '' then
            p_system_prompt := p_system_prompt || ' The following is relevant content from the document to reference in your responses: 

"""
' || v_context || '
"""

Based on ONLY the information provided above, answer the user''s question. If you cannot answer based on the provided content, say so clearly.';
        end if;
        
        -- Get AI response
        v_response := public.call_ai_service(
            prompt := p_user_message,
            system_prompt := p_system_prompt
        );
        
        -- Add assistant message
        v_assistant_message_id := public.add_chat_message(
            p_session_id := p_session_id,
            p_role := 'assistant',
            p_content := v_response
        );
        
        return v_assistant_message_id;
    end;
    $$ language plpgsql security definer;
    
    -- Grant execute permissions
    grant execute on function public.get_text_window(text, integer, integer, integer) to authenticated;
    grant execute on function public.get_reading_context(uuid, integer, integer) to authenticated;
    grant execute on function public.get_ai_chat_response_with_context(uuid, text, text) to authenticated;
    
commit; 