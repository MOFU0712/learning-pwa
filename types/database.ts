export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  title: string
  author: string | null
  total_chapters: number | null
  current_chapter: number
  created_at: string
  updated_at: string
}

export interface LearningSession {
  id: string
  user_id: string
  project_id: string
  date: string
  chapter: number | null
  chapter_title: string | null
  topic: string | null
  duration_minutes: number | null
  understanding_level: number | null
  key_concepts: string[] | null
  created_at: string
  raw_data: any | null
}

export interface ReviewQuestion {
  id: string
  user_id: string
  session_id: string | null
  project_id: string
  question: string
  answer: string
  explanation: string | null
  why_important: string | null
  difficulty_level: number | null
  related_concepts: string[] | null
  created_at: string
}

export interface ReviewHistory {
  id: string
  user_id: string
  question_id: string
  reviewed_at: string
  self_rating: number
  next_review_date: string
  interval_days: number
  ease_factor: number
  repetitions: number
}

export interface ReviewQuestionWithHistory extends ReviewQuestion {
  last_review?: ReviewHistory
}

// ========================================
// Learning Assistant v2.0: Books System
// ========================================

export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  total_pages: number | null
  total_chapters: number | null
  pdf_url: string | null
  pdf_hash: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error: string | null
  processed_chapters: number | null
  chapters_data: { number: number; title: string }[] | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  book_id: string
  chapter_number: number
  title: string
  summary: string | null
  created_at: string
}

export interface Section {
  id: string
  chapter_id: string
  section_number: string  // "1.1", "1.1.1" など階層的な番号をサポート
  title: string
  content: string
  content_vector?: number[]
  token_count: number | null
  estimated_minutes: number | null
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  book_id: string
  chapter_id: string | null
  llm_provider: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  status: 'active' | 'paused' | 'completed'
  current_topic: string | null
  understanding_level: number | null
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sections_used: string[] | null
  token_count: number | null
  created_at: string
}

export interface UserSettings {
  user_id: string
  preferred_llm: 'gemini-flash' | 'claude-haiku' | 'claude-sonnet'
  theme: 'light' | 'dark' | 'system'
  notifications_enabled: boolean
  created_at: string
  updated_at: string
}

// Combined Types

export interface BookWithChapters extends Book {
  chapters: ChapterWithSections[]
}

export interface ChapterWithSections extends Chapter {
  sections: Section[]
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[]
  book: Book
}

// API Request/Response Types

export interface PDFProcessingResult {
  title: string
  author: string
  totalPages: number
  chapters: {
    number: number
    title: string
    summary: string
    sections: {
      number: number
      title: string
      content: string
      estimatedMinutes: number
    }[]
  }[]
}
