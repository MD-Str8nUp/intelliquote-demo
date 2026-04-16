import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inrzfybiqkdkmyflufci.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucnpmeWJpcWtka215Zmx1ZmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTI4NzksImV4cCI6MjA3NTg4ODg3OX0.WWIxW6So9pIwI2gnwtMNbYAGa9XLyxkB0wfJrdeb4Sc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const BUCKET_NAME = 'intelliquote-plans'

export async function uploadPlan(file: File): Promise<{ path: string; url: string } | null> {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `uploads/${timestamp}-${safeName}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  return { path: data.path, url: urlData.publicUrl }
}
