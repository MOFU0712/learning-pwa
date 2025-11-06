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
