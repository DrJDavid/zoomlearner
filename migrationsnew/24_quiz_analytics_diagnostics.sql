begin;

-- Diagnostic view to check the state of quiz sessions without any filtering
create or replace view public.quiz_sessions_diagnostic as
select
    qs.id as quiz_session_id,
    qs.reading_session_id,
    qs.user_id,
    qs.status,
    qs.score,
    qs.created_at,
    qs.updated_at,
    (select count(*) from public.quiz_questions where quiz_session_id = qs.id) as question_count,
    (select count(*) from public.quiz_answers where question_id in 
        (select id from public.quiz_questions where quiz_session_id = qs.id)) as answer_count,
    rs.document_id,
    rs.words_read,
    rs.total_words,
    rs.average_speed
from
    public.quiz_sessions qs
    left join public.reading_sessions rs on qs.reading_session_id = rs.id;

-- Grant access to authenticated users
grant select on public.quiz_sessions_diagnostic to authenticated;

-- Function to debug and fix quiz session status
create or replace function public.debug_fix_quiz_session(p_quiz_session_id uuid)
returns json as $$
declare
    v_result json;
    v_quiz_data record;
    v_questions_count integer;
    v_answers_count integer;
    v_user_id uuid;
    v_correct_answers integer;
    v_needs_fixing boolean := false;
    v_fixed boolean := false;
begin
    -- Get current quiz session data
    select *
    into v_quiz_data
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    -- Get authentication info
    v_user_id := auth.uid();
    
    -- Count questions
    select count(*)
    into v_questions_count
    from public.quiz_questions
    where quiz_session_id = p_quiz_session_id;
    
    -- Count answers
    select count(*)
    into v_answers_count
    from public.quiz_answers
    where question_id in (
        select id from public.quiz_questions 
        where quiz_session_id = p_quiz_session_id
    );
    
    -- Count correct answers
    select count(*)
    into v_correct_answers
    from public.quiz_answers
    where question_id in (
        select id from public.quiz_questions 
        where quiz_session_id = p_quiz_session_id
    )
    and is_correct = true;
    
    -- Determine if we need to fix the quiz session
    if v_quiz_data.status is null or v_quiz_data.status != 'completed' then
        v_needs_fixing := true;
    end if;
    
    if v_quiz_data.score is null and v_correct_answers > 0 then
        v_needs_fixing := true;
    end if;
    
    -- Fix the quiz session if needed
    if v_needs_fixing and v_questions_count > 0 and v_answers_count > 0 then
        update public.quiz_sessions
        set 
            status = 'completed',
            score = v_correct_answers,
            updated_at = now()
        where id = p_quiz_session_id
        and (user_id = v_user_id or v_user_id is null);
        
        v_fixed := true;
    end if;
    
    -- Return diagnostic info
    select json_build_object(
        'quiz_session_id', v_quiz_data.id,
        'reading_session_id', v_quiz_data.reading_session_id,
        'user_id', v_quiz_data.user_id,
        'current_status', v_quiz_data.status,
        'current_score', v_quiz_data.score,
        'questions_count', v_questions_count,
        'answers_count', v_answers_count,
        'correct_answers', v_correct_answers,
        'needs_fixing', v_needs_fixing,
        'fixed', v_fixed,
        'authenticated_user', v_user_id
    ) into v_result;
    
    return v_result;
end;
$$ language plpgsql security definer;

-- Grant access to the debug function
grant execute on function public.debug_fix_quiz_session(uuid) to authenticated;

-- Function to check and auto-fix quiz analytics data
create or replace function public.auto_fix_quiz_analytics()
returns json as $$
declare
    v_fixed_count integer := 0;
    v_quiz_sessions record;
    v_fixed_sessions json[];
begin
    -- Loop through quiz sessions with answers but no score or incomplete status
    for v_quiz_sessions in (
        select 
            qs.id as quiz_session_id,
            (select count(*) from public.quiz_questions where quiz_session_id = qs.id) as question_count,
            (select count(*) from public.quiz_answers 
             where question_id in (select id from public.quiz_questions where quiz_session_id = qs.id)
            ) as answer_count,
            (select count(*) from public.quiz_answers 
             where question_id in (select id from public.quiz_questions where quiz_session_id = qs.id)
             and is_correct = true
            ) as correct_answers
        from 
            public.quiz_sessions qs
        where 
            (qs.status is null or qs.status != 'completed' or qs.score is null)
            and qs.user_id = auth.uid()
    ) loop
        -- Only fix if there are answers
        if v_quiz_sessions.answer_count > 0 and v_quiz_sessions.question_count > 0 then
            update public.quiz_sessions
            set 
                status = 'completed',
                score = v_quiz_sessions.correct_answers,
                updated_at = now()
            where id = v_quiz_sessions.quiz_session_id;
            
            v_fixed_count := v_fixed_count + 1;
            v_fixed_sessions := array_append(v_fixed_sessions, json_build_object(
                'quiz_session_id', v_quiz_sessions.quiz_session_id,
                'questions', v_quiz_sessions.question_count,
                'answers', v_quiz_sessions.answer_count,
                'correct', v_quiz_sessions.correct_answers
            ));
        end if;
    end loop;
    
    return json_build_object(
        'fixed_count', v_fixed_count,
        'fixed_sessions', v_fixed_sessions
    );
end;
$$ language plpgsql security definer;

-- Grant access to the auto-fix function
grant execute on function public.auto_fix_quiz_analytics() to authenticated;

commit; 