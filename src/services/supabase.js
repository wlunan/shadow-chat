/**
 * Supabase 客户端初始化
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('缺少环境变量: VITE_SUPABASE_URL 或 VITE_SUPABASE_KEY')
}

// 初始化 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseKey)

// 默认房间 ID
export const DEFAULT_ROOM_ID = 1
