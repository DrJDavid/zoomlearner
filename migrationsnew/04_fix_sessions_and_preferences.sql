begin;
    -- Add missing text_content column to reading_sessions
    alter table public.reading_sessions
        add column text_content text not null;

    -- Create function to ensure user preferences exist
    create or replace function public.ensure_user_preferences(p_user_id uuid)
    returns void
    language plpgsql
    security definer
    as $$
    begin
        insert into public.user_preferences (user_id)
        values (p_user_id)
        on conflict (user_id) do nothing;
    end;
    $$;

    -- Create function to update user preferences
    create or replace function public.update_user_preferences(
        p_user_id uuid,
        p_wpm integer default null,
        p_font_size integer default null,
        p_dark_mode boolean default null,
        p_quizzes_enabled boolean default null
    )
    returns public.user_preferences
    language plpgsql
    security definer
    as $$
    declare
        v_preferences public.user_preferences;
    begin
        -- Ensure preferences exist
        perform public.ensure_user_preferences(p_user_id);

        -- Update preferences with non-null values
        update public.user_preferences
        set
            default_wpm = coalesce(p_wpm, default_wpm),
            font_size = coalesce(p_font_size, font_size),
            dark_mode = coalesce(p_dark_mode, dark_mode),
            quizzes_enabled = coalesce(p_quizzes_enabled, quizzes_enabled),
            updated_at = now()
        where user_id = p_user_id
        returning * into v_preferences;

        return v_preferences;
    end;
    $$;

    -- Grant execute permissions on functions
    grant execute on function public.ensure_user_preferences to authenticated;
    grant execute on function public.update_user_preferences to authenticated;

    -- Create trigger to automatically create preferences for new users
    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    as $$
    begin
        insert into public.user_preferences (user_id)
        values (new.id)
        on conflict do nothing;
        return new;
    end;
    $$;

    -- Drop existing trigger if it exists
    drop trigger if exists on_auth_user_created on auth.users;

    -- Add trigger to auth.users
    create trigger on_auth_user_created
        after insert on auth.users
        for each row
        execute function public.handle_new_user();

commit;