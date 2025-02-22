export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Define Tables type first before using it
type Tables = Database['public']['Tables']

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          source_type: 'file' | 'url'
          source_url?: string
          storage_path?: string
          created_at: string
          last_accessed: string | null
          last_position: number | null
          word_count?: number
        }
        Insert: Omit<Tables['documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Tables['documents']['Insert']>
      }
      reading_sessions: {
        Row: {
          id: string
          user_id: string
          document_id: string
          current_word_index: number
          text_content: string
          wpm: number
          timestamp: string
          font_size: number
        }
        Insert: Omit<Tables['reading_sessions']['Row'], 'id'>
        Update: Partial<Tables['reading_sessions']['Insert']>
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          keyboard_shortcuts: Json
          reading_preferences: Json
          quiz_preferences: Json
          updated_at: string
        }
        Insert: Omit<Tables['user_preferences']['Row'], 'id' | 'updated_at'>
        Update: Partial<Tables['user_preferences']['Insert']>
      }
      quiz_questions: {
        Row: {
          id: string
          document_id: string
          chunk_start: number
          chunk_end: number
          question_text: string
          correct_answer: string
          incorrect_answers: string[]
          explanation: string | null
          difficulty: 'easy' | 'medium' | 'hard'
          question_type: 'multiple_choice' | 'true_false' | 'short_answer'
          created_at: string
          metadata: Json
        }
        Insert: Omit<Tables['quiz_questions']['Row'], 'id' | 'created_at'>
        Update: Partial<Tables['quiz_questions']['Insert']>
      }
      quiz_sessions: {
        Row: {
          id: string
          user_id: string
          document_id: string
          reading_session_id: string
          start_time: string
          end_time: string | null
          status: 'in_progress' | 'completed' | 'abandoned'
          total_questions: number
          correct_answers: number
          created_at: string
        }
        Insert: Omit<Tables['quiz_sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Tables['quiz_sessions']['Insert']>
      }
      quiz_responses: {
        Row: {
          id: string
          quiz_session_id: string
          question_id: string
          user_answer: string
          is_correct: boolean
          response_time: string | null
          created_at: string
        }
        Insert: Omit<Tables['quiz_responses']['Row'], 'id' | 'created_at'>
        Update: Partial<Tables['quiz_responses']['Insert']>
      }
      text_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          content: string
          embedding: number[]
          embedding_compressed?: string
          tokens: number
        }
        Insert: Omit<Tables['text_chunks']['Row'], 'id'>
        Update: Partial<Tables['text_chunks']['Insert']>
      }
      summaries: {
        Row: {
          id: string
          document_id: string
          chunk_start: number
          chunk_end: number
          summary_type: string
          content: string
        }
        Insert: Omit<Tables['summaries']['Row'], 'id'>
        Update: Partial<Tables['summaries']['Insert']>
      }
      quiz_results: {
        Row: {
          id: string
          user_id: string
          document_id: string
          reading_session_id: string
          score: number
          total_questions: number
          answers: Json
          timestamp: string
        }
        Insert: Omit<Tables['quiz_results']['Row'], 'id'>
        Update: Partial<Tables['quiz_results']['Insert']>
      }
      user_notes: {
        Row: {
          id: string
          user_id: string
          document_id: string
          chunk_index: number
          content: string
        }
        Insert: Omit<Tables['user_notes']['Row'], 'id'>
        Update: Partial<Tables['user_notes']['Insert']>
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          document_id: string
          position: number
          name: string
          notes: string | null
        }
        Insert: Omit<Tables['bookmarks']['Row'], 'id'>
        Update: Partial<Tables['bookmarks']['Insert']>
      }
      reading_statistics: {
        Row: {
          id: string
          user_id: string
          document_id: string
          start_time: string
          end_time?: string
          words_read?: number
          average_wpm?: number
          pauses?: number
        }
        Insert: Omit<Tables['reading_statistics']['Row'], 'id'>
        Update: Partial<Tables['reading_statistics']['Insert']>
      }
    }
  }
}

// Helper types for working with the database
export type TableName = keyof Database['public']['Tables']
export type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update']
