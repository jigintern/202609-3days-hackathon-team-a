import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 認証専用。データの読み書きは必ず Express 経由で行う（テーブルへの直接アクセスはしない）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
