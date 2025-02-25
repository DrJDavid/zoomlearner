begin;

-- The current quiz_analytics view returns multiple rows per reading session when a user
-- has taken multiple quizzes for the same reading. This can cause 406 errors when the client
-- code expects a single result.

-- Let's modify the view to return only the most recent completed quiz for each reading session
create or replace view public.quiz_analytics as
with latest_quiz_sessions as (
    select 
        rs.id as reading_session_id,
        (
            select qs.id
            from public.quiz_sessions qs
            where qs.reading_session_id = rs.id
            and qs.status = 'completed'
            and qs.score is not null
            and qs.user_id = auth.uid()
            order by qs.updated_at desc
            limit 1
        ) as latest_quiz_id
    from 
        public.reading_sessions rs
    where 
        rs.user_id = auth.uid()
)
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
    inner join latest_quiz_sessions lqs on rs.id = lqs.reading_session_id
    inner join public.quiz_sessions qs on qs.id = lqs.latest_quiz_id
where
    rs.user_id = auth.uid(); -- Security still enforced directly

-- Create a function that retrieves a single quiz analytics record
-- This is a safer approach than relying on .single() in the client code
create or replace function public.get_quiz_analytics_for_reading(
    p_reading_session_id uuid
) returns json as $$
declare
    v_result json;
begin
    -- Get the analytics for the specific reading session
    select json_build_object(
        'readingSessionId', reading_session_id,
        'documentId', document_id,
        'wordsRead', words_read,
        'totalWords', total_words,
        'readingPositionPercent', reading_position_percent,
        'averageSpeed', average_speed,
        'quizSessionId', quiz_session_id,
        'quizScore', quiz_score,
        'totalQuestions', total_questions,
        'scorePercentage', score_percentage,
        'quizCreatedAt', quiz_created_at,
        'quizCompletedAt', quiz_completed_at
    )
    into v_result
    from public.quiz_analytics
    where reading_session_id = p_reading_session_id;
    
    -- Return empty object if no results
    if v_result is null then
        return '{}'::json;
    end if;
    
    return v_result;
end;
$$ language plpgsql security definer;

-- Grant access to authenticated users
grant execute on function public.get_quiz_analytics_for_reading(uuid) to authenticated;

commit; 