begin;
-- Drop the existing function so we can fix the GROUP BY issue
drop function if exists public.get_quiz_questions(uuid);

-- Fix the quiz questions function to properly handle the GROUP BY/aggregation
create or replace function public.get_quiz_questions(
    p_quiz_session_id uuid
) returns json as $$
declare
    v_user_id uuid;
    v_questions json;
    v_session_exists boolean;
begin
    -- First check if the session exists at all
    select exists(
        select 1 from public.quiz_sessions where id = p_quiz_session_id
    ) into v_session_exists;
    
    if not v_session_exists then
        raise exception 'Quiz session not found with ID: %', p_quiz_session_id;
    end if;

    -- Check if quiz session belongs to user
    select user_id into v_user_id
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Quiz session not found or you do not have permission';
    end if;
    
    -- Just get all questions directly without any grouping
    -- This avoids the GROUP BY error entirely
    select json_agg(q.*) into v_questions
    from (
        select 
            id,
            question,
            options,
            correct_option,
            created_at
        from public.quiz_questions
        where quiz_session_id = p_quiz_session_id
        order by created_at
    ) q;
    
    -- Return empty array if no questions found
    if v_questions is null then
        return '[]'::json;
    end if;
    
    return v_questions;
end;
$$ language plpgsql security definer;

-- Fix any issues with quiz session tracking
create or replace function public.get_latest_quiz_session(
    p_reading_session_id uuid
) returns uuid as $$
declare
    v_session_id uuid;
begin
    -- Find the most recent quiz session for this reading
    select id into v_session_id
    from public.quiz_sessions
    where reading_session_id = p_reading_session_id
    order by created_at desc
    limit 1;
    
    return v_session_id;
end;
$$ language plpgsql security definer;

-- Grant access to these functions
grant execute on function public.get_quiz_questions(uuid) to authenticated;
grant execute on function public.get_quiz_questions(uuid) to service_role;
grant execute on function public.get_latest_quiz_session(uuid) to authenticated;
grant execute on function public.get_latest_quiz_session(uuid) to service_role;

commit; 