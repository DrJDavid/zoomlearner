import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database.types'

// Type declaration for Vite's env
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }
}

// Get environment variables based on environment
const supabaseUrl = process.env.NODE_ENV === 'test'
  ? process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
  : import.meta.env.VITE_SUPABASE_URL;

const supabaseKey = process.env.NODE_ENV === 'test'
  ? process.env.VITE_SUPABASE_ANON_KEY || 'mock-key'
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Database table schemas
export const TABLES = {
  DOCUMENTS: 'documents',
  READING_SESSIONS: 'reading_sessions',
  USER_PREFERENCES: 'user_preferences',
  TEXT_CHUNKS: 'text_chunks',
  SUMMARIES: 'summaries',
  QUIZ_RESULTS: 'quiz_results',
  USER_NOTES: 'user_notes',
  BOOKMARKS: 'bookmarks',
  READING_STATISTICS: 'reading_statistics'
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
}

// Reading sessions
export async function saveReadingSession(userId: string, data: ReadingSessionData) {
  const { error } = await supabase
    .from(TABLES.READING_SESSIONS)
    .insert([{
      user_id: userId,
      document_id: data.documentId,
      current_word_index: data.currentWordIndex,
      text_content: data.textContent,
      wpm: data.wpm,
      timestamp: new Date().toISOString(),
    }])
  return { error }
}

// User preferences
export async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from(TABLES.USER_PREFERENCES)
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

interface UserPreferences {
  keyboard_shortcuts?: Json
  reading_preferences?: Json
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences) {
  const { error } = await supabase
    .from(TABLES.USER_PREFERENCES)
    .upsert([{
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    }])
  return { error }
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

// Reading statistics
export async function startReadingSession(userId: string, documentId: string) {
  const { data, error } = await supabase
    .from(TABLES.READING_STATISTICS)
    .insert([{
      user_id: userId,
      document_id: documentId,
      start_time: new Date().toISOString()
    }])
    .select()
    .single()
  return { data, error }
}

interface ReadingStats {
  endTime: string
  wordsRead: number
  averageWpm: number
  pauses: number
}

export async function updateReadingStatistics(sessionId: string, stats: ReadingStats) {
  const { error } = await supabase
    .from(TABLES.READING_STATISTICS)
    .update({
      end_time: stats.endTime,
      words_read: stats.wordsRead,
      average_wpm: stats.averageWpm,
      pauses: stats.pauses
    })
    .eq('id', sessionId)
  return { error }
}

interface DocumentProgress {
  position: number
}

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
    .from(TABLES.READING_STATISTICS)
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