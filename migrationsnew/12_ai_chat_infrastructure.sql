begin;
    -- Create tables for chat functionality
    create table if not exists public.chat_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade not null,
        reading_session_id uuid references public.reading_sessions(id) on delete cascade,
        title text not null default 'New Chat',
        created_at timestamptz default now(),
        updated_at timestamptz default now()
    );

    create table if not exists public.chat_messages (
        id uuid primary key default gen_random_uuid(),
        session_id uuid references public.chat_sessions(id) on delete cascade not null,
        role text not null check (role in ('user', 'assistant', 'system')),
        content text not null,
        created_at timestamptz default now()
    );

    -- Enable RLS on new tables
    alter table public.chat_sessions enable row level security;
    alter table public.chat_messages enable row level security;

    -- RLS policies for chat_sessions
    create policy "Users can view their own chat sessions"
        on chat_sessions for select
        using (auth.uid() = user_id);

    create policy "Users can create their own chat sessions"
        on chat_sessions for insert
        with check (auth.uid() = user_id);

    create policy "Users can update their own chat sessions"
        on chat_sessions for update
        using (auth.uid() = user_id);

    create policy "Users can delete their own chat sessions"
        on chat_sessions for delete
        using (auth.uid() = user_id);

    -- RLS policies for chat_messages
    create policy "Users can view messages in their chat sessions"
        on chat_messages for select
        using (
            session_id in (
                select id from public.chat_sessions 
                where user_id = auth.uid()
            )
        );

    create policy "Users can add messages to their chat sessions"
        on chat_messages for insert
        with check (
            session_id in (
                select id from public.chat_sessions 
                where user_id = auth.uid()
            )
        );

    -- No update policy for chat_messages - messages should be immutable

    create policy "Users can delete messages in their chat sessions"
        on chat_messages for delete
        using (
            session_id in (
                select id from public.chat_sessions 
                where user_id = auth.uid()
            )
        );

    -- Add updated_at trigger for chat_sessions
    create trigger chat_sessions_updated_at
        before update on chat_sessions
        for each row
        execute function handle_updated_at();

    -- Enable realtime for chat
    alter publication supabase_realtime add table chat_sessions;
    alter publication supabase_realtime add table chat_messages;

    -- Basic function to create a chat session
    create or replace function public.create_chat_session(
        p_reading_session_id uuid,
        p_title text default 'New Chat'
    ) returns uuid as $$
    declare
        v_session_id uuid;
    begin
        insert into public.chat_sessions (
            user_id,
            reading_session_id,
            title
        ) values (
            auth.uid(),
            p_reading_session_id,
            p_title
        ) returning id into v_session_id;

        return v_session_id;
    end;
    $$ language plpgsql security definer;

    -- Basic function to add a message to a chat session
    create or replace function public.add_chat_message(
        p_session_id uuid,
        p_role text,
        p_content text
    ) returns uuid as $$
    declare
        v_message_id uuid;
        v_user_id uuid;
    begin
        -- Verify ownership of the chat session
        select user_id into v_user_id
        from public.chat_sessions
        where id = p_session_id;

        if v_user_id is null or v_user_id != auth.uid() then
            raise exception 'Chat session not found or you do not have permission';
        end if;

        -- Add the message
        insert into public.chat_messages (
            session_id,
            role,
            content
        ) values (
            p_session_id,
            p_role,
            p_content
        ) returning id into v_message_id;

        return v_message_id;
    end;
    $$ language plpgsql security definer;

    -- Grant execute permissions
    grant execute on function public.create_chat_session(uuid, text) to authenticated;
    grant execute on function public.add_chat_message(uuid, text, text) to authenticated;

commit; 