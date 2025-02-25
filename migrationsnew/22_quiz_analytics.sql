begin;

-- First, add missing columns to reading_sessions if they don't exist
do $$ 
begin
    -- Add words_read if it doesn't exist
    if not exists (select 1 from information_schema.columns 
                  where table_schema = 'public' 
                  and table_name = 'reading_sessions' 
                  and column_name = 'words_read') then
        alter table public.reading_sessions 
        add column words_read integer default 0;
    end if;
    
    -- Add total_words if it doesn't exist
    if not exists (select 1 from information_schema.columns 
                  where table_schema = 'public' 
                  and table_name = 'reading_sessions' 
                  and column_name = 'total_words') then
        alter table public.reading_sessions 
        add column total_words integer default 0;
    end if;
    
    -- Add average_speed if it doesn't exist
    if not exists (select 1 from information_schema.columns 
                  where table_schema = 'public' 
                  and table_name = 'reading_sessions' 
                  and column_name = 'average_speed') then
        alter table public.reading_sessions 
        add column average_speed integer default 0;
    end if;
end $$;

-- Function to update reading metrics
create or replace function public.update_reading_metrics(
    p_reading_session_id uuid,
    p_words_read integer,
    p_total_words integer,
    p_average_speed integer
) returns boolean as $$
declare
    v_user_id uuid;
begin
    -- Check if reading session belongs to user
    select user_id into v_user_id
    from public.reading_sessions
    where id = p_reading_session_id;
    
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Reading session not found or you do not have permission';
    end if;
    
    -- Update reading metrics
    update public.reading_sessions
    set 
        words_read = p_words_read,
        total_words = p_total_words,
        average_speed = p_average_speed,
        updated_at = now()
    where id = p_reading_session_id;
    
    return true;
exception
    when others then
        raise exception 'Error updating reading metrics: %', SQLERRM;
        return false;
end;
$$ language plpgsql security definer;

-- Create a function to save quiz results properly
create or replace function public.save_quiz_results(
    p_quiz_session_id uuid,
    p_correct_answers integer
) returns boolean as $$
declare
    v_user_id uuid;
    v_total_questions integer;
    v_percent_score numeric;
    v_reading_session_id uuid;
begin
    -- Check if quiz session belongs to user
    select user_id, reading_session_id into v_user_id, v_reading_session_id
    from public.quiz_sessions
    where id = p_quiz_session_id;
    
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Quiz session not found or you do not have permission';
    end if;
    
    -- Count total questions
    select count(*) into v_total_questions
    from public.quiz_questions
    where quiz_session_id = p_quiz_session_id;
    
    if v_total_questions = 0 then
        raise exception 'No questions found for this quiz';
    end if;
    
    -- Calculate percentage score
    v_percent_score := (p_correct_answers::numeric / v_total_questions::numeric) * 100;
    
    -- Update quiz session with score
    update public.quiz_sessions
    set 
        status = 'completed',
        score = p_correct_answers,
        updated_at = now()
    where id = p_quiz_session_id;
    
    return true;
exception
    when others then
        raise exception 'Error saving quiz results: %', SQLERRM;
        return false;
end;
$$ language plpgsql security definer;

-- Function to submit quiz answer properly using the quiz_answers table
create or replace function public.submit_quiz_answer_v2(
    p_question_id uuid,
    p_selected_option integer
) returns boolean as $$
declare
    v_quiz_session_id uuid;
    v_user_id uuid;
    v_correct_option integer;
    v_is_correct boolean;
begin
    -- Get quiz session info and correct answer
    select 
        qs.id, qs.user_id, qq.correct_option 
    into 
        v_quiz_session_id, v_user_id, v_correct_option
    from 
        public.quiz_questions qq
        join public.quiz_sessions qs on qq.quiz_session_id = qs.id
    where 
        qq.id = p_question_id;
    
    -- Check permissions
    if v_user_id is null or v_user_id != auth.uid() then
        raise exception 'Question not found or you do not have permission';
    end if;
    
    -- Determine if answer is correct
    v_is_correct := (p_selected_option = v_correct_option);
    
    -- Delete any previous answer for this question by this user
    delete from public.quiz_answers
    where user_id = auth.uid() and question_id = p_question_id;
    
    -- Record the answer
    insert into public.quiz_answers (
        user_id,
        question_id,
        selected_option,
        is_correct
    ) values (
        auth.uid(),
        p_question_id,
        p_selected_option,
        v_is_correct
    );
    
    -- Update quiz session status if needed
    update public.quiz_sessions
    set status = 'in_progress'
    where id = v_quiz_session_id
    and status = 'ready';
    
    return v_is_correct;
end;
$$ language plpgsql security definer;

-- Create a view to analyze quiz performance in relation to reading metrics
-- Added security filter directly in the view definition instead of using RLS policy
create or replace view public.quiz_analytics as
select
    rs.id as reading_session_id,
    rs.document_id,
    rs.user_id,
    coalesce(rs.words_read, 0) as words_read,
    coalesce(rs.total_words, 0) as total_words,
    coalesce(rs.average_speed, 0) as average_speed,
    rs.created_at as reading_created_at,
    qs.id as quiz_session_id,
    qs.score as quiz_score,
    (select count(*) from public.quiz_questions where quiz_session_id = qs.id) as total_questions,
    case
        when (select count(*) from public.quiz_questions where quiz_session_id = qs.id) > 0 
        then (qs.score::numeric / (select count(*) from public.quiz_questions where quiz_session_id = qs.id)::numeric) * 100
        else 0
    end as score_percentage,
    qs.created_at as quiz_created_at,
    qs.updated_at as quiz_completed_at,
    -- Calculate reading position as percentage
    case 
        when coalesce(rs.total_words, 0) > 0 then (coalesce(rs.words_read, 0)::numeric / rs.total_words::numeric) * 100
        else 0
    end as reading_position_percent
from
    public.reading_sessions rs
    left join public.quiz_sessions qs on rs.id = qs.reading_session_id
where
    qs.status = 'completed'
    and qs.score is not null
    and rs.user_id = auth.uid(); -- Security enforced directly in the view definition

-- Grant permissions
grant execute on function public.save_quiz_results(uuid, integer) to authenticated;
grant execute on function public.submit_quiz_answer_v2(uuid, integer) to authenticated;
grant execute on function public.update_reading_metrics(uuid, integer, integer, integer) to authenticated;
grant select on public.quiz_analytics to authenticated;

commit; 