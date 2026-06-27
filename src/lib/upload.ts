import { supabase } from './supabase'

const BUCKET = 'screenshots'
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png']

/**
 * Upload an evidence screenshot to Supabase Storage and return its public URL.
 * Never throws — returns null on any failure so submission is non-blocking.
 */
export async function uploadScreenshot(file: File): Promise<string | null> {
  try {
    if (!ACCEPTED.includes(file.type)) return null
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `sos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    if (error) {
      console.error('[uploadScreenshot] upload failed:', error.message)
      return null
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error('[uploadScreenshot] unexpected error:', e)
    return null
  }
}
