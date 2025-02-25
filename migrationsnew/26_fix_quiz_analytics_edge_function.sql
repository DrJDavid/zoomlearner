begin;

-- Create an improved version of the get_quiz_analytics function that handles the case 
-- when multiple quiz results are available for a quiz session
create or replace function public.get_quiz_analytics(p_quiz_session_id uuid)
returns json as $$
declare
    v_analytics json;
    v_quiz_data record;
    v_reading_session_id uuid;
    v_reading_data record;
begin
    -- Get quiz session data
    select *
    into v_quiz_data
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_quiz_data.id is null then
        raise exception 'Quiz session not found';
    end if;

    -- Save reading session ID
    v_reading_session_id := v_quiz_data.reading_session_id;
    
    -- Get reading session data
    select *
    into v_reading_data
    from public.reading_sessions
    where id = v_reading_session_id;
    
    if v_reading_data.id is null then
        raise exception 'Reading session not found';
    end if;
    
    -- Count questions
    declare
        v_total_questions integer;
    begin
        select count(*)
        into v_total_questions
        from public.quiz_questions
        where quiz_session_id = p_quiz_session_id;
    end;
    
    -- Calculate score percentage
    declare
        v_score_percentage numeric := 0;
    begin
        if v_total_questions > 0 and v_quiz_data.score is not null then
            v_score_percentage := (v_quiz_data.score::numeric / v_total_questions::numeric) * 100;
        end if;
    end;
    
    -- Calculate reading position percentage
    declare
        v_reading_position_percent numeric := 0;
    begin
        if coalesce(v_reading_data.total_words, 0) > 0 then
            v_reading_position_percent := (coalesce(v_reading_data.words_read, 0)::numeric / v_reading_data.total_words::numeric) * 100;
        end if;
    end;
    
    -- Build the analytics JSON object with the same field names as in the client code
    select json_build_object(
        'readingSessionId', v_reading_session_id,
        'documentId', v_reading_data.document_id,
        'wordsRead', coalesce(v_reading_data.words_read, 0),
        'totalWords', coalesce(v_reading_data.total_words, 0),
        'readingPositionPercent', v_reading_position_percent,
        'averageSpeed', coalesce(v_reading_data.average_speed, 0),
        'quizSessionId', p_quiz_session_id,
        'quizScore', coalesce(v_quiz_data.score, 0),
        'totalQuestions', v_total_questions,
        'scorePercentage', v_score_percentage,
        'quizCreatedAt', v_quiz_data.created_at,
        'quizCompletedAt', v_quiz_data.updated_at
    ) into v_analytics;
    
    return v_analytics;
end;
$$ language plpgsql security definer;

-- Grant access to authenticated users
grant execute on function public.get_quiz_analytics(uuid) to authenticated;

-- Edge function for quiz analytics (this is a dummy function, actual code will be in the edge function file)
-- We're recreating it here to maintain schema consistency
create or replace function public.handle_quiz_analytics(quiz_session_id text)
returns json as $$
begin
    -- In practice, this function won't be called directly - the edge function will be used
    -- But we create it to document its existence in the database schema
    return json_build_object('message', 'Use the edge function gemini-quiz-analytics instead');
end;
$$ language plpgsql security definer;

-- Grant permissions
grant execute on function public.handle_quiz_analytics(text) to authenticated;

commit; 