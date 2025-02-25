begin;

-- Make sure the quiz_sessions table has the status column
do $$ 
begin
    if not exists (select 1 from information_schema.columns 
                  where table_schema = 'public' 
                  and table_name = 'quiz_sessions' 
                  and column_name = 'status') then
        alter table public.quiz_sessions 
        add column status text default 'ready';
    end if;
end $$;

-- Create a function to get quiz analytics directly through RPC
-- This can be used as an alternative to the edge function
create or replace function public.get_quiz_analytics(p_quiz_session_id uuid)
returns json as $$
declare
    v_analytics json;
    v_quiz_data record;
    v_reading_data record;
    v_total_questions integer;
    v_score_percentage numeric;
begin
    -- Get quiz session data
    select *
    into v_quiz_data
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_quiz_data.id is null then
        raise exception 'Quiz session not found';
    end if;
    
    -- Get reading session data
    select document_id, words_read, total_words, average_speed
    into v_reading_data
    from public.reading_sessions
    where id = v_quiz_data.reading_session_id;
    
    -- Count total questions
    select count(*)
    into v_total_questions
    from public.quiz_questions
    where quiz_session_id = p_quiz_session_id;
    
    -- Calculate score percentage
    if v_total_questions > 0 and v_quiz_data.score is not null then
        v_score_percentage := (v_quiz_data.score::numeric / v_total_questions::numeric) * 100;
    else
        v_score_percentage := 0;
    end if;
    
    -- Build analytics object
    select json_build_object(
        'readingSessionId', v_quiz_data.reading_session_id,
        'documentId', v_reading_data.document_id,
        'wordsRead', coalesce(v_reading_data.words_read, 0),
        'totalWords', coalesce(v_reading_data.total_words, 100),
        'readingPositionPercent', case 
                                  when coalesce(v_reading_data.total_words, 0) > 0 
                                  then (coalesce(v_reading_data.words_read, 0)::numeric / v_reading_data.total_words::numeric) * 100
                                  else 0
                                  end,
        'averageSpeed', coalesce(v_reading_data.average_speed, 250),
        'quizSessionId', v_quiz_data.id,
        'quizScore', coalesce(v_quiz_data.score, 0),
        'totalQuestions', v_total_questions,
        'scorePercentage', v_score_percentage,
        'quizCreatedAt', v_quiz_data.created_at,
        'quizCompletedAt', v_quiz_data.updated_at
    ) into v_analytics;
    
    return v_analytics;
exception
    when others then
        raise exception 'Error getting quiz analytics: %', SQLERRM;
end;
$$ language plpgsql security definer;

-- Ensure the RPC is available to authenticated users
grant execute on function public.get_quiz_analytics(uuid) to authenticated;

commit; 