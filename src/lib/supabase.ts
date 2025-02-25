import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database.types'

// Type declaration for Vite's env
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string
    readonly VITE_SUPABASE_ANON_KEY?: string
  }
}

// Function to safely access environment variables that may not be available immediately in some environments
function getEnvVariable(key: string): string | undefined {
  // Check for window.__ENV (runtime environment variables)
  if (typeof window !== 'undefined' && window.__ENV) {
    // Use type assertion for type safety
    const env = window.__ENV as Record<string, string | undefined>;
    if (env[key]) {
      console.log(`Found ${key} in window.__ENV`);
      return env[key];
    }
  }
  
  // Check for import.meta.env (Vite environment variables)
  if (import.meta.env) {
    const env = import.meta.env as Record<string, string | undefined>;
    if (env[key]) {
      console.log(`Found ${key} in import.meta.env`);
      return env[key];
    }
  }
  
  // Try without the VITE_ prefix
  const unprefixedKey = key.replace(/^VITE_/, '');
  
  if (typeof window !== 'undefined' && window.__ENV) {
    const env = window.__ENV as Record<string, string | undefined>;
    if (env[unprefixedKey]) {
      console.log(`Found ${unprefixedKey} in window.__ENV`);
      return env[unprefixedKey];
    }
  }
  
  if (import.meta.env) {
    const env = import.meta.env as Record<string, string | undefined>;
    if (env[unprefixedKey]) {
      console.log(`Found ${unprefixedKey} in import.meta.env`);
      return env[unprefixedKey];
    }
  }
  
  console.log(`Could not find ${key} in any environment variable location`);
  return undefined;
}

// Get Supabase URL from environment variables
const supabaseUrl = process.env.NODE_ENV === 'test'
  ? process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
  : getEnvVariable('VITE_SUPABASE_URL');

// Get Supabase key from environment variables
const supabaseKey = process.env.NODE_ENV === 'test'
  ? process.env.VITE_SUPABASE_ANON_KEY || 'mock-key'
  : getEnvVariable('VITE_SUPABASE_ANON_KEY');

// Add console logs to help debug environment variable issues
console.log('Environment:', process.env.NODE_ENV);
console.log('Supabase URL available:', !!supabaseUrl);
console.log('Supabase Key available:', !!supabaseKey);

// Create Supabase client only if we have the required configuration
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
  } else {
    console.error('Supabase configuration is missing. Please check your environment variables.');
    console.error('VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not available.');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

// Export the client, ensuring it exists before use
export const supabase = supabaseClient!;

// Helper function to check if Supabase is properly initialized
export function isSupabaseInitialized(): boolean {
  return !!supabaseClient;
}

// Database table schemas
export const TABLES = {
  DOCUMENTS: 'documents',
  READING_SESSIONS: 'reading_sessions',
  USER_PREFERENCES: 'user_preferences',
  TEXT_CHUNKS: 'text_chunks',
  SUMMARIES: 'summaries',
  QUIZ_RESULTS: 'quiz_results',
  USER_NOTES: 'user_notes',
  BOOKMARKS: 'bookmarks'
} as const

// Type for metadata in document uploads
interface DocumentMetadata {
  title?: string
  description?: string
  [key: string]: any
}

// Document management
export async function uploadDocument(userId: string, file: File, metadata: DocumentMetadata) {
  const filePath = `${userId}/${file.name}`
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('user_documents')
    .upload(filePath, file)
  
  if (uploadError) return { error: uploadError }

  // Create document record
  const { data: doc, error: dbError } = await supabase
    .from(TABLES.DOCUMENTS)
    .insert([{
      user_id: userId,
      title: metadata.title || file.name,
      description: metadata.description,
      source_type: 'file',
      storage_path: filePath,
      ...metadata
    }])
    .select()
    .single()

  return { data: doc, error: dbError }
}

export async function uploadFromUrl(userId: string, url: string, metadata: DocumentMetadata) {
  const { data: doc, error } = await supabase
    .from(TABLES.DOCUMENTS)
    .insert([{
      user_id: userId,
      title: metadata.title || url,
      description: metadata.description,
      source_type: 'url',
      source_url: url,
      ...metadata
    }])
    .select()
    .single()

  return { data: doc, error }
}

interface ReadingSessionData {
  documentId: string
  currentWordIndex: number
  textContent: string
  wpm: number
  fontSize?: number
  title?: string
}

// Reading sessions
export async function saveReadingSession(userId: string, data: ReadingSessionData) {
  // Use the new create_reading_session RPC function that handles storage
  const { data: sessionId, error } = await supabase
    .rpc('create_reading_session', {
      content: data.textContent,
      title: data.title || 'Reading Session',
      wpm: data.wpm,
      font_size: data.fontSize || 16
    });
  
  return { sessionId, error };
}

// User preferences
interface UserPreferences {
    wpm?: number;
    font_size?: number;
    dark_mode?: boolean;
    keyboard_shortcuts?: Json;
    reading_preferences?: Json;
    quiz_preferences?: Json;
}

export async function getUserPreferences(userId: string) {
    try {
        // First ensure preferences exist
        const { error: ensureError } = await supabase
            .rpc('ensure_user_preferences', { p_user_id: userId });
        
        if (ensureError) {
            console.error('Error ensuring preferences:', ensureError);
            // Continue anyway, as the preferences might already exist
        }

        // Then get preferences
        const { data, error } = await supabase
            .from(TABLES.USER_PREFERENCES)
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) {
            console.error('Error fetching preferences:', error);
            return { error };
        }
        
        return { data };
    } catch (err) {
        console.error('Unexpected error in getUserPreferences:', err);
        return { error: err as any };
    }
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences) {
    try {
        // Extract reading preferences
        const readingPreferences = preferences.reading_preferences || {};
        
        const { error } = await supabase
            .rpc('update_user_preferences', {
                p_user_id: userId,
                p_wpm: preferences.wpm,
                p_font_size: preferences.font_size,
                p_dark_mode: preferences.dark_mode,
                p_keyboard_shortcuts: preferences.keyboard_shortcuts,
                p_reading_preferences: preferences.reading_preferences,
                p_quiz_preferences: preferences.quiz_preferences
            });
        
        if (error) {
            console.error('Error saving preferences:', error);
        }
        
        return { error };
    } catch (err) {
        console.error('Unexpected error in saveUserPreferences:', err);
        return { error: err as any };
    }
}

interface TextChunk {
  index: number
  content: string
  embedding: number[]
  compressed?: string
  tokens: number
}

// Text chunks and embeddings
export async function saveTextChunks(documentId: string, chunks: TextChunk[]) {
  const { error } = await supabase
    .from(TABLES.TEXT_CHUNKS)
    .insert(chunks.map(chunk => ({
      document_id: documentId,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: chunk.embedding,
      embedding_compressed: chunk.compressed,
      tokens: chunk.tokens
    })))
  return { error }
}

interface Summary {
  chunkStart: number
  chunkEnd: number
  type: string
  content: string
}

// Summaries
export async function saveSummary(documentId: string, summary: Summary) {
  const { error } = await supabase
    .from(TABLES.SUMMARIES)
    .insert([{
      document_id: documentId,
      chunk_start: summary.chunkStart,
      chunk_end: summary.chunkEnd,
      summary_type: summary.type,
      content: summary.content
    }])
  return { error }
}

interface QuizData {
  documentId: string
  sessionId: string
  score: number
  totalQuestions: number
  answers: Json
}

// Quiz results
export async function saveQuizResult(userId: string, data: QuizData) {
  const { error } = await supabase
    .from(TABLES.QUIZ_RESULTS)
    .insert([{
      user_id: userId,
      document_id: data.documentId,
      reading_session_id: data.sessionId,
      score: data.score,
      total_questions: data.totalQuestions,
      answers: data.answers,
      timestamp: new Date().toISOString(),
    }])
  return { error }
}

interface NoteData {
  documentId: string
  chunkIndex: number
  content: string
}

// User notes
export async function saveUserNote(userId: string, data: NoteData) {
  const { error } = await supabase
    .from(TABLES.USER_NOTES)
    .insert([{
      user_id: userId,
      document_id: data.documentId,
      chunk_index: data.chunkIndex,
      content: data.content
    }])
  return { error }
}

// Realtime subscriptions
export function subscribeToDocumentChanges(userId: string, callback: (payload: any) => void) {
  return supabase
    .channel('document_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `user_id=eq.${userId}`
      },
      callback
    )
    .subscribe()
}

export function subscribeToReadingProgress(userId: string, documentId: string, callback: (payload: any) => void) {
  return supabase
    .channel('reading_progress')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reading_sessions',
        filter: `user_id=eq.${userId} AND document_id=eq.${documentId}`
      },
      callback
    )
    .subscribe()
}

// Document retrieval
export async function getUserDocuments(userId: string) {
  const { data, error } = await supabase
    .from(TABLES.DOCUMENTS)
    .select(`
      *,
      reading_sessions (
        current_word_index,
        wpm,
        created_at
      ),
      summaries (
        summary_type,
        content
      ),
      quiz_results (
        score,
        total_questions
      ),
      user_notes (
        content
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

// Storage operations
export async function getDocumentUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from('user_documents')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  return { data, error }
}

export async function deleteDocument(userId: string, documentId: string) {
  // First get the document to check storage path
  const { data: doc, error: fetchError } = await supabase
    .from(TABLES.DOCUMENTS)
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (fetchError) return { error: fetchError }

  // If there's a storage path, delete the file
  if (doc?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('user_documents')
      .remove([doc.storage_path])

    if (storageError) return { error: storageError }
  }

  // Delete the document record (cascades to related tables)
  const { error: deleteError } = await supabase
    .from(TABLES.DOCUMENTS)
    .delete()
    .eq('id', documentId)
    .eq('user_id', userId)

  return { error: deleteError }
}

interface BookmarkData {
  documentId: string
  position: number
  name: string
  notes?: string
}

// Bookmark management
export async function createBookmark(userId: string, data: BookmarkData) {
  const { error } = await supabase
    .from(TABLES.BOOKMARKS)
    .insert([{
      user_id: userId,
      document_id: data.documentId,
      position: data.position,
      name: data.name,
      notes: data.notes
    }])
  return { error }
}

export async function getBookmarks(userId: string, documentId: string) {
  const { data, error } = await supabase
    .from(TABLES.BOOKMARKS)
    .select('*')
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .order('position', { ascending: true })
  return { data, error }
}

interface DocumentProgress {
  position: number
}

// Document progress
export async function updateDocumentProgress(documentId: string, progress: DocumentProgress) {
  const { error } = await supabase
    .from(TABLES.DOCUMENTS)
    .update({
      last_position: progress.position,
      last_accessed: new Date().toISOString()
    })
    .eq('id', documentId)
  return { error }
}

// Enhanced user preferences
export async function updateKeyboardShortcuts(userId: string, shortcuts: Json) {
  const { error } = await supabase
    .from(TABLES.USER_PREFERENCES)
    .update({
      keyboard_shortcuts: shortcuts
    })
    .eq('user_id', userId)
  return { error }
}

export async function updateReadingPreferences(userId: string, preferences: Json) {
  const { error } = await supabase
    .from(TABLES.USER_PREFERENCES)
    .update({
      reading_preferences: preferences
    })
    .eq('user_id', userId)
  return { error }
}

// Reading analytics
export async function getReadingStats(userId: string, documentId: string) {
  const { data, error } = await supabase
    .from(TABLES.READING_SESSIONS)
    .select(`
      *,
      documents (
        title,
        word_count
      )
    `)
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// Saved readings management
export const saveReading = async (
    userId: string,
    text: string,
    position: number,
    wpm: number,
    fontSize?: number,
    title?: string
) => {
    try {
        // Use the new create_reading_session RPC function
        const { data: sessionId, error } = await supabase
          .rpc('create_reading_session', {
            content: text,
            title: title || new Date().toLocaleString(),
            wpm,
            font_size: fontSize || 16
          });

        if (error) throw error;
        
        // Update position separately if needed
        if (position > 0) {
          await supabase
            .from('reading_sessions')
            .update({ current_word_index: position })
            .eq('id', sessionId);
        }
        
        return { data: { id: sessionId }, error: null };
    } catch (error) {
        console.error('Error in saveReading:', error);
        return { data: null, error };
    }
};

export const getSavedReadings = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('reading_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error in getSavedReadings:', error);
        return { data: null, error };
    }
};

export async function deleteSavedReading(userId: string, readingId: string) {
  const { error } = await supabase
    .from(TABLES.READING_SESSIONS)
    .delete()
    .eq('id', readingId)
    .eq('user_id', userId);
  return { error };
}

// Add a new function to get reading content using the storage URL
export const getReadingContent = async (sessionId: string) => {
    try {
        // First get the session to retrieve the storage_url
        const { data: session, error: sessionError } = await supabase
            .from('reading_sessions')
            .select('storage_url, text_content')
            .eq('id', sessionId)
            .single();
            
        if (sessionError) throw sessionError;
        
        // If we have a storage_url, use the get_document_content function
        if (session.storage_url) {
            const { data: content, error: contentError } = await supabase
                .rpc('get_document_content', { 
                    doc_identifier: session.storage_url 
                });
                
            if (contentError) throw contentError;
            return { content, error: null };
        } 
        // Fall back to text_content during migration
        else if (session.text_content) {
            return { content: session.text_content, error: null };
        }
        
        throw new Error('No content available for this reading session');
    } catch (error) {
        console.error('Error getting reading content:', error);
        return { content: null, error };
    }
}; 