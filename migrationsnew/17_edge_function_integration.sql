begin;
    -- Create a function to call the gemini-chat Edge Function
    create or replace function public.call_gemini_chat_function(
        prompt text,
        system_prompt text default null,
        document_context text default null
    ) returns text as $$
    declare
        result jsonb;
        response text;
        project_ref text;
        anon_key text;
    begin
        -- Get project reference from current request
        project_ref := current_setting('request.headers', true)::json->>'x-forwarded-host';
        if project_ref is null or not (project_ref like '%.supabase.co') then
            project_ref := 'boqmfzznhbdmapqrersm'; -- Fallback to hardcoded project ref
        else
            project_ref := split_part(project_ref, '.', 1);
        end if;
        
        -- Get anon key - in production this should be set securely
        -- This is just a temporary solution for testing
        anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcW1menpuaGJkbWFwcXJlcnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODIzNjksImV4cCI6MjA1NTk1ODM2OX0.5ZNBizop3cAi70mMnOVBdMyOpwnLSx66hPng3knWxfE';
        
        -- Call Edge Function
        select content::jsonb into result
        from http.post(
            url := 'https://' || project_ref || '.supabase.co/functions/v1/gemini-chat',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
                'prompt', prompt,
                'systemPrompt', system_prompt,
                'documentContext', document_context
            )
        );
        
        response := result->>'text';
        
        if response is null then
            raise exception 'Failed to get response from gemini-chat function: %', result;
        end if;
        
        return response;
    exception
        when others then
            raise notice 'Error calling gemini-chat function: %', sqlerrm;
            return 'Error: ' || sqlerrm;
    end;
    $$ language plpgsql security definer;
    
    -- Create a function to call the gemini-summary Edge Function
    create or replace function public.call_gemini_summary_function(
        content text,
        length text default 'medium'
    ) returns text as $$
    declare
        result jsonb;
        summary text;
        project_ref text;
        anon_key text;
    begin
        -- Get project reference from current request
        project_ref := current_setting('request.headers', true)::json->>'x-forwarded-host';
        if project_ref is null or not (project_ref like '%.supabase.co') then
            project_ref := 'boqmfzznhbdmapqrersm'; -- Fallback to hardcoded project ref
        else
            project_ref := split_part(project_ref, '.', 1);
        end if;
        
        -- Get anon key - in production this should be set securely
        anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcW1menpuaGJkbWFwcXJlcnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODIzNjksImV4cCI6MjA1NTk1ODM2OX0.5ZNBizop3cAi70mMnOVBdMyOpwnLSx66hPng3knWxfE';
        
        -- Call Edge Function
        select content::jsonb into result
        from http.post(
            url := 'https://' || project_ref || '.supabase.co/functions/v1/gemini-summary',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
                'content', content,
                'length', length
            )
        );
        
        summary := result->>'summary';
        
        if summary is null then
            raise exception 'Failed to get summary from gemini-summary function: %', result;
        end if;
        
        return summary;
    exception
        when others then
            raise notice 'Error calling gemini-summary function: %', sqlerrm;
            return 'Error: ' || sqlerrm;
    end;
    $$ language plpgsql security definer;
    
    -- Create a function to call the gemini-quiz-generator Edge Function
    create or replace function public.call_gemini_quiz_function(
        content text,
        num_questions integer default 5,
        difficulty text default 'medium'
    ) returns jsonb as $$
    declare
        result jsonb;
        questions jsonb;
        project_ref text;
        anon_key text;
    begin
        -- Get project reference from current request
        project_ref := current_setting('request.headers', true)::json->>'x-forwarded-host';
        if project_ref is null or not (project_ref like '%.supabase.co') then
            project_ref := 'boqmfzznhbdmapqrersm'; -- Fallback to hardcoded project ref
        else
            project_ref := split_part(project_ref, '.', 1);
        end if;
        
        -- Get anon key - in production this should be set securely
        anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcW1menpuaGJkbWFwcXJlcnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODIzNjksImV4cCI6MjA1NTk1ODM2OX0.5ZNBizop3cAi70mMnOVBdMyOpwnLSx66hPng3knWxfE';
        
        -- Call Edge Function
        select content::jsonb into result
        from http.post(
            url := 'https://' || project_ref || '.supabase.co/functions/v1/gemini-quiz-generator',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
                'content', content,
                'numQuestions', num_questions,
                'difficulty', difficulty
            )
        );
        
        questions := result->'questions';
        
        if questions is null then
            raise exception 'Failed to get questions from gemini-quiz-generator function: %', result;
        end if;
        
        return questions;
    exception
        when others then
            raise notice 'Error calling gemini-quiz-generator function: %', sqlerrm;
            return '[]'::jsonb;
    end;
    $$ language plpgsql security definer;
    
    -- Override call_ai_service to use Edge Functions
    create or replace function public.call_ai_service(
        prompt text,
        system_prompt text default 'You are a helpful assistant.',
        model text default null,
        temperature float default null,
        max_tokens integer default null
    ) returns text as $$
    begin
        -- Use Edge Function instead of direct API call
        return public.call_gemini_chat_function(
            prompt := prompt,
            system_prompt := system_prompt
        );
    end;
    $$ language plpgsql security definer;

    -- Update the chat response function with text windowing to use Edge Functions
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
        
        -- Get AI response using Edge Function
        v_response := public.call_gemini_chat_function(
            prompt := p_user_message,
            system_prompt := p_system_prompt,
            document_context := v_context
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
    
    -- Update generate_summary function to use Edge Function
    create or replace function public.generate_summary(
        p_reading_session_id uuid,
        p_length text default 'medium'
    ) returns uuid as $$
    declare
        v_user_id uuid;
        v_content text;
        v_summary text;
        v_summary_id uuid;
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
        
        -- Generate summary using Edge Function
        v_summary := public.call_gemini_summary_function(
            content := v_content,
            length := p_length
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
    
    -- Update generate_quiz_questions function to use Edge Function
    create or replace function public.generate_quiz_questions(
        p_quiz_session_id uuid,
        p_num_questions integer default 5,
        p_difficulty text default 'medium'
    ) returns setof public.quiz_questions as $$
    declare
        v_user_id uuid;
        v_reading_session_id uuid;
        v_content text;
        v_questions jsonb;
        v_question jsonb;
        v_question_id uuid;
    begin
        -- Check if quiz session belongs to user and get reading_session_id
        select qs.user_id, qs.reading_session_id into v_user_id, v_reading_session_id
        from public.quiz_sessions qs
        where qs.id = p_quiz_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Quiz session not found or you do not have permission';
        end if;
        
        -- Update quiz session status to creating
        update public.quiz_sessions
        set status = 'creating', updated_at = now()
        where id = p_quiz_session_id;
        
        -- Get content from reading session
        v_content := public.get_reading_context(
            p_reading_session_id := v_reading_session_id,
            p_window_size := 8000  -- Use a larger window for quizzes
        );
        
        if v_content is null or v_content = '' then
            raise exception 'No content available for quiz generation';
        end if;
        
        -- Generate questions using Edge Function
        v_questions := public.call_gemini_quiz_function(
            content := v_content,
            num_questions := p_num_questions,
            difficulty := p_difficulty
        );
        
        -- Insert each question
        for i in 0..jsonb_array_length(v_questions)-1 loop
            v_question := v_questions->i;
            
            -- Insert the question
            insert into public.quiz_questions (
                quiz_session_id,
                question,
                options,
                correct_option
            ) values (
                p_quiz_session_id,
                v_question->>'question',
                v_question->'options',
                (v_question->>'correct_option')::integer
            )
            returning id into v_question_id;
            
            -- Return the question
            return query select * from public.quiz_questions where id = v_question_id;
        end loop;
        
        -- Update quiz session status to ready
        update public.quiz_sessions
        set status = 'ready', updated_at = now()
        where id = p_quiz_session_id;
        
    exception
        when others then
            -- If anything fails, update quiz session status and re-raise
            update public.quiz_sessions
            set status = 'failed', updated_at = now()
            where id = p_quiz_session_id;
            
            raise;
    end;
    $$ language plpgsql security definer;

    -- Create a function to store the anon key securely (for use with edge functions)
    create or replace function public.set_anon_key(
        anon_key text
    ) returns void as $$
    begin
        perform set_config('supabase_anon_key', anon_key, false);
    end;
    $$ language plpgsql security definer;

    -- Grant execute permissions
    grant execute on function public.call_gemini_chat_function(text, text, text) to authenticated;
    grant execute on function public.call_gemini_summary_function(text, text) to authenticated;
    grant execute on function public.call_gemini_quiz_function(text, integer, text) to authenticated;
    grant execute on function public.call_ai_service(text, text, text, float, integer) to authenticated;
    grant execute on function public.get_ai_chat_response_with_context(uuid, text, text) to authenticated;
    grant execute on function public.generate_summary(uuid, text) to authenticated;
    grant execute on function public.generate_quiz_questions(uuid, integer, text) to authenticated;
    grant execute on function public.set_anon_key(text) to authenticated;
    
commit; 