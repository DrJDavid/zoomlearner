begin;
-- First drop the existing function since we're changing its return type
drop function if exists public.get_quiz_questions(uuid);

-- Update the get_quiz_questions function to ensure options are correctly formatted as JSON/arrays
create or replace function public.get_quiz_questions(
    p_quiz_session_id uuid
) returns json as $$
declare
    v_user_id uuid;
    v_questions json;
begin
    -- Check if quiz session belongs to user
    select user_id into v_user_id
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Quiz session not found or you do not have permission';
    end if;
    
    -- Get questions with properly formatted options
    select json_agg(
        json_build_object(
            'id', q.id,
            'question', q.question,
            'options', q.options,
            'correct_option', q.correct_option,
            'created_at', q.created_at
        )
    ) into v_questions
    from public.quiz_questions q
    where q.quiz_session_id = p_quiz_session_id
    order by q.created_at;
    
    -- Return empty array if no questions found
    if v_questions is null then
        return '[]'::json;
    end if;
    
    return v_questions;
end;
$$ language plpgsql security definer;

-- Grant access to the updated function
grant execute on function public.get_quiz_questions(uuid) to authenticated;
grant execute on function public.get_quiz_questions(uuid) to service_role;

-- Create a helper function to check if questions exist for a quiz session
create or replace function public.has_quiz_questions(
    p_quiz_session_id uuid
) returns boolean as $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from public.quiz_questions
    where quiz_session_id = p_quiz_session_id;
    
    return v_count > 0;
end;
$$ language plpgsql security definer;

-- Grant access to the helper function
grant execute on function public.has_quiz_questions(uuid) to authenticated;
grant execute on function public.has_quiz_questions(uuid) to service_role;

commit; 