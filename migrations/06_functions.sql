-- Function to match text chunks for RAG
create or replace function match_text_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
returns table (
    id uuid,
    content text,
    similarity float
)
language sql stable
as $$
    select
        id,
        content,
        1 - (embedding <=> query_embedding) as similarity
    from text_chunks
    where 1 - (embedding <=> query_embedding) > match_threshold
    order by similarity desc
    limit match_count;
$$;

-- Function to compress embeddings
create or replace function compress_embedding(
    embedding vector(1536)
)
returns bytea
language plpgsql
as $$
declare
    compressed bytea;
begin
    -- Simple compression for now, can be enhanced later
    compressed := embedding::text::bytea;
    return compressed;
end;
$$;

-- Function to decompress embeddings
create or replace function decompress_embedding(
    compressed_embedding bytea
)
returns vector(1536)
language plpgsql
as $$
declare
    decompressed vector(1536);
begin
    -- Simple decompression for now, can be enhanced later
    decompressed := compressed_embedding::text::vector(1536);
    return decompressed;
end;
$$;

-- Function to cleanup old uploads
create or replace function cleanup_old_uploads()
returns void
language plpgsql
security definer
as $$
begin
    -- Delete files from user_uploads bucket older than 24 hours
    delete from storage.objects
    where bucket_id = 'user_uploads'
    and (created_at < now() - interval '24 hours');
end;
$$; 