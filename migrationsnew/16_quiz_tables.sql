begin;
    -- Create quiz tables
    create table if not exists public.quiz_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        reading_session_id uuid references public.reading_sessions(id) on delete cascade,
        status text not null default 'creating' check (status in ('creating', 'ready', 'in_progress', 'completed')),
        score integer,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
    );

    create table if not exists public.quiz_questions (
        id uuid primary key default gen_random_uuid(),
        quiz_session_id uuid references public.quiz_sessions(id) on delete cascade not null,
        question text not null,
        options jsonb not null, -- Array of answer options
        correct_option integer not null, -- Index of correct option (0-based)
        created_at timestamptz default now()
    );

    create table if not exists public.quiz_answers (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        question_id uuid references public.quiz_questions(id) on delete cascade not null,
        selected_option integer not null,
        is_correct boolean not null,
        created_at timestamptz default now()
    );

    -- Add triggers for updated_at
    create trigger quiz_sessions_updated_at
        before update on quiz_sessions
        for each row
        execute function handle_updated_at();

    -- Enable RLS on quiz tables
    alter table public.quiz_sessions enable row level security;
    alter table public.quiz_questions enable row level security;
    alter table public.quiz_answers enable row level security;

    -- RLS policies for quiz_sessions
    create policy "Users can view their own quiz sessions"
        on quiz_sessions for select
        using (auth.uid() = user_id);

    create policy "Users can create their own quiz sessions"
        on quiz_sessions for insert
        with check (auth.uid() = user_id);

    create policy "Users can update their own quiz sessions"
        on quiz_sessions for update
        using (auth.uid() = user_id);

    create policy "Users can delete their own quiz sessions"
        on quiz_sessions for delete
        using (auth.uid() = user_id);

    -- RLS policies for quiz_questions
    create policy "Users can view questions in their quiz sessions"
        on quiz_questions for select
        using (
            quiz_session_id in (
                select id from public.quiz_sessions 
                where user_id = auth.uid()
            )
        );

    -- No insert/update/delete policies for quiz_questions
    -- These will be handled by backend functions

    -- RLS policies for quiz_answers
    create policy "Users can view their own answers"
        on quiz_answers for select
        using (auth.uid() = user_id);

    create policy "Users can insert their own answers"
        on quiz_answers for insert
        with check (auth.uid() = user_id);

    -- No update/delete policies for quiz_answers (answers should be immutable)

    -- Enable realtime for quiz tables
    alter publication supabase_realtime add table quiz_sessions;
    alter publication supabase_realtime add table quiz_questions;
    alter publication supabase_realtime add table quiz_answers;

    -- Basic function to create a quiz session
    create or replace function public.create_quiz_session(
        p_reading_session_id uuid
    ) returns uuid as $$
    declare
        v_user_id uuid;
        v_quiz_session_id uuid;
    begin
        -- Check if reading session belongs to user
        select user_id into v_user_id
        from public.reading_sessions
        where id = p_reading_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Reading session not found or you do not have permission';
        end if;
        
        -- Create quiz session
        insert into public.quiz_sessions (
            user_id,
            reading_session_id,
            status
        ) values (
            auth.uid(),
            p_reading_session_id,
            'creating'
        ) returning id into v_quiz_session_id;
        
        return v_quiz_session_id;
    end;
    $$ language plpgsql security definer;

    -- Function to get quiz questions
    create or replace function public.get_quiz_questions(
        p_quiz_session_id uuid
    ) returns setof public.quiz_questions as $$
    declare
        v_user_id uuid;
    begin
        -- Check if quiz session belongs to user
        select user_id into v_user_id
        from public.quiz_sessions
        where id = p_quiz_session_id;
        
        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Quiz session not found or you do not have permission';
        end if;
        
        -- Return questions
        return query
        select * 
        from public.quiz_questions
        where quiz_session_id = p_quiz_session_id
        order by created_at;
    end;
    $$ language plpgsql security definer;

    -- Function to submit an answer to a quiz question
    create or replace function public.submit_quiz_answer(
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

    -- Function to complete a quiz and calculate score
    create or replace function public.complete_quiz(
        p_quiz_session_id uuid
    ) returns integer as $$
    declare
        v_user_id uuid;
        v_score integer;
        v_total_questions integer;
        v_answered_questions integer;
    begin
        -- Check if quiz session belongs to user
        select user_id into v_user_id
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
        
        -- Calculate score based on correct answers
        select 
            count(qa.*), 
            count(case when qa.is_correct then 1 end) 
        into 
            v_answered_questions,
            v_score
        from 
            public.quiz_questions qq
            left join public.quiz_answers qa on qq.id = qa.question_id and qa.user_id = auth.uid()
        where 
            qq.quiz_session_id = p_quiz_session_id;
        
        if v_answered_questions < v_total_questions then
            raise exception 'Not all questions have been answered (% of %)', v_answered_questions, v_total_questions;
        end if;
        
        -- Update quiz session
        update public.quiz_sessions
        set 
            status = 'completed',
            score = v_score,
            updated_at = now()
        where id = p_quiz_session_id;
        
        return v_score;
    end;
    $$ language plpgsql security definer;

    -- Grant execute permissions
    grant execute on function public.create_quiz_session(uuid) to authenticated;
    grant execute on function public.get_quiz_questions(uuid) to authenticated;
    grant execute on function public.submit_quiz_answer(uuid, integer) to authenticated;
    grant execute on function public.complete_quiz(uuid) to authenticated;
    
commit; 