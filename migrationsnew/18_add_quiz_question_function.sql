begin;
-- Function to add a quiz question to a quiz session
create or replace function public.add_quiz_question(
    p_quiz_session_id uuid,
    p_question_text text,
    p_options text[],
    p_correct_option integer
) returns uuid as $$
declare
    v_user_id uuid;
    v_question_id uuid;
    v_options_json jsonb;
begin
    -- Check if quiz session belongs to user
    select user_id into v_user_id
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Quiz session not found or you do not have permission';
    end if;
    
    -- Convert text array to jsonb for storage
    v_options_json := to_jsonb(p_options);
    
    -- Insert the question
    insert into public.quiz_questions (
        quiz_session_id,
        question,
        options,
        correct_option
    ) values (
        p_quiz_session_id,
        p_question_text,
        v_options_json,
        p_correct_option
    ) returning id into v_question_id;
    
    -- Update quiz session status if it's the first question
    update public.quiz_sessions
    set 
        status = 'ready',
        updated_at = now()
    where 
        id = p_quiz_session_id and
        status = 'creating';
    
    return v_question_id;
end;
$$ language plpgsql security definer;

-- Grant access to the function
grant execute on function public.add_quiz_question to authenticated;
grant execute on function public.add_quiz_question to service_role;

commit; 