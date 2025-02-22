-- Enable realtime for relevant tables
begin;
    -- Add tables to realtime publication
    alter publication supabase_realtime add table documents;
    alter publication supabase_realtime add table reading_sessions;
    alter publication supabase_realtime add table user_notes;
    alter publication supabase_realtime add table quiz_results;
commit; 