begin;
    -- Ensure HTTP extension is available
    create extension if not exists http with schema extensions;

    -- Create Settings table for AI configuration
    create table if not exists public.settings (
        key text primary key,
        value jsonb not null,
        description text,
        updated_at timestamptz default now()
    );

    -- Add trigger for settings updated_at
    create trigger settings_updated_at
        before update on settings
        for each row
        execute function handle_updated_at();

    -- Insert default AI settings
    insert into public.settings (key, value, description)
    values (
        'ai_settings',
        jsonb_build_object(
            'model', 'gpt-3.5-turbo',
            'temperature', 0.7,
            'max_tokens', 1024,
            'top_p', 1,
            'api_base_url', 'https://api.openai.com/v1'
        ),
        'Settings for AI service calls'
    )
    on conflict (key) do update
    set 
        description = excluded.description,
        updated_at = now();

    -- RLS for settings - Simplified approach
    alter table public.settings enable row level security;
    
    -- All authenticated users can read settings, but not modify them directly
    create policy "Authenticated users can read settings"
        on settings for select
        to authenticated
        using (true);
    
    -- No direct insert/update/delete policies - will use functions instead
    
    -- Function to get AI settings
    create or replace function public.get_ai_settings()
    returns jsonb as $$
    declare
        settings_value jsonb;
    begin
        select value into settings_value
        from public.settings
        where key = 'ai_settings';
        
        return settings_value;
    end;
    $$ language plpgsql security definer;

    -- Function to update AI settings (if needed in the future)
    create or replace function public.update_ai_settings(
        p_settings jsonb
    ) returns void as $$
    begin
        -- In a real production app, you might want to add additional
        -- validation logic here to ensure only authorized users can update settings
        
        update public.settings
        set 
            value = p_settings,
            updated_at = now()
        where key = 'ai_settings';
        
        if not found then
            insert into public.settings (key, value, description)
            values ('ai_settings', p_settings, 'Settings for AI service calls');
        end if;
    end;
    $$ language plpgsql security definer;

    -- Basic HTTP call function to AI service
    create or replace function public.call_ai_service(
        prompt text,
        system_prompt text default 'You are a helpful assistant.',
        model text default null,
        temperature float default null,
        max_tokens integer default null
    ) returns text as $$
    declare
        settings jsonb;
        api_url text;
        api_key text;
        request_body jsonb;
        response jsonb;
        result text;
    begin
        -- Get current settings
        settings := public.get_ai_settings();
        
        -- Get environment variables
        api_key := current_setting('app.settings.openai_key', true);
        
        -- Use settings with fallbacks to parameters
        api_url := (settings->>'api_base_url') || '/chat/completions';
        
        -- Construct request body
        request_body := jsonb_build_object(
            'model', coalesce(model, settings->>'model'),
            'messages', jsonb_build_array(
                jsonb_build_object('role', 'system', 'content', system_prompt),
                jsonb_build_object('role', 'user', 'content', prompt)
            ),
            'temperature', coalesce(temperature, (settings->>'temperature')::float),
            'max_tokens', coalesce(max_tokens, (settings->>'max_tokens')::integer),
            'top_p', (settings->>'top_p')::float
        );
        
        -- Make HTTP request to API
        select
            content::jsonb into response
        from
            http.post(
                url := api_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || api_key
                ),
                body := request_body
            );
        
        -- Extract response text
        result := response->'choices'->0->'message'->>'content';
        
        -- Handle null result
        if result is null then
            raise exception 'Failed to get response from AI service: %', response;
        end if;
        
        return result;
    exception
        when others then
            -- Log error and return error message
            raise notice 'Error calling AI service: %', sqlerrm;
            return 'Error: ' || sqlerrm;
    end;
    $$ language plpgsql security definer;

    -- Function to create a simple chat response
    create or replace function public.get_ai_chat_response(
        p_session_id uuid,
        p_user_message text,
        p_system_prompt text default 'You are a helpful assistant.'
    ) returns uuid as $$
    declare
        v_user_message_id uuid;
        v_assistant_message_id uuid;
        v_reading_session_id uuid;
        v_content text;
        v_response text;
    begin
        -- Get reading session ID
        select reading_session_id into v_reading_session_id
        from public.chat_sessions
        where id = p_session_id and user_id = auth.uid();
        
        if v_reading_session_id is null then
            raise exception 'Chat session not found or you do not have permission';
        end if;
        
        -- Add user message
        v_user_message_id := public.add_chat_message(
            p_session_id := p_session_id,
            p_role := 'user',
            p_content := p_user_message
        );
        
        -- Get reading content if available
        if v_reading_session_id is not null then
            select text_content into v_content
            from public.reading_sessions
            where id = v_reading_session_id;
            
            -- If we have content, adjust system prompt
            if v_content is not null and v_content != '' then
                p_system_prompt := p_system_prompt || ' The following is the document content to reference in your responses: ' || v_content;
            end if;
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
    grant execute on function public.get_ai_settings() to authenticated;
    grant execute on function public.update_ai_settings(jsonb) to authenticated;
    grant execute on function public.call_ai_service(text, text, text, float, integer) to authenticated;
    grant execute on function public.get_ai_chat_response(uuid, text, text) to authenticated;
    
commit; 