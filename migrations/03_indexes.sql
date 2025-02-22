-- Create indexes for better performance
create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists documents_content_hash_idx on documents(content_hash);
create index if not exists reading_sessions_user_id_idx on reading_sessions(user_id);
create index if not exists reading_sessions_document_id_idx on reading_sessions(document_id);
create index if not exists quiz_results_user_id_idx on quiz_results(user_id);
create index if not exists quiz_results_session_id_idx on quiz_results(reading_session_id);
create index if not exists quiz_results_document_id_idx on quiz_results(document_id);
create index if not exists text_chunks_document_id_idx on text_chunks(document_id);
create index if not exists summaries_document_chunks_idx on summaries(document_id, chunk_start, chunk_end);
create index if not exists user_notes_user_doc_idx on user_notes(user_id, document_id); 