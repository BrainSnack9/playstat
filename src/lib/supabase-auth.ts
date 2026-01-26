import { createClient } from '@supabase/supabase-js'

// 환경변수 체크
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// 클라이언트 사이드용 Supabase 클라이언트
export function createBrowserClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!)
}

// 관리자 이메일 검증
export function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.warn('ADMIN_EMAIL environment variable is not set')
    return false
  }
  return email.toLowerCase() === adminEmail.toLowerCase()
}
