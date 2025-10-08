import { supabase } from '../../../lib/supabaseClient'

export type Conversation = {
  id: string
  user_id: string
  title: string
  created_at: string
}

// 🟢 Fetch all conversations for a user
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// 🟢 Create new conversation
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id, user_id, title, created_at')
    .single()

  if (error) throw error
  return data
}

// 🟡 Rename conversation
export async function renameConversation(conversationId: string, newTitle: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ title: newTitle })
    .eq('id', conversationId)
    .select('id, user_id, title, created_at')
    .single()

  if (error) throw error
  return data
}

// 🔴 Delete conversation (and its messages)
export async function deleteConversation(conversationId: string): Promise<void> {
  // Optional: Delete related messages first (if not handled by FK cascade)
  await supabase.from('messages').delete().eq('conversation_id', conversationId)
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) throw error
}
