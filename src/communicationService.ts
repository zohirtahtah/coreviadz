import { supabase } from "./supabaseClient";
import { ChatMessage } from "./types";

const STORAGE_KEY = "corevia_chat_messages_v1";

// Read Local messages cached offline fallback
export function getLocalChatMessages(companyId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const msgs: ChatMessage[] = raw ? JSON.parse(raw) : [];
    // Only return matching company isolate
    return msgs.filter(m => m.companyId === companyId);
  } catch (e) {
    console.error("Failed to read local company chat messages", e);
    return [];
  }
}

// Save Local messages cached offline fallback
export function saveLocalChatMessages(messages: ChatMessage[]): void {
  try {
    // Keep all messages in storage but merge/update
    const raw = localStorage.getItem(STORAGE_KEY);
    let allMsgs: ChatMessage[] = raw ? JSON.parse(raw) : [];
    
    // Merge new messages (by unique ID)
    const idMap = new Map(allMsgs.map(m => [m.id, m]));
    messages.forEach(m => idMap.set(m.id, m));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(idMap.values())));
  } catch (e) {
    console.error("Failed to write local company chat messages", e);
  }
}

// Fetch all messages (Supabase + local merge fallback)
export async function getChatMessages(companyId: string): Promise<ChatMessage[]> {
  const localList = getLocalChatMessages(companyId);
  
  if (!supabase) {
    // Local memory only
    return localList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  try {
    const { data, error } = await supabase
      .from("corevia_chat_messages")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
      
    if (error) {
      console.warn("Supabase chat fetch error, falling back:", error);
      return localList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    
    if (data && data.length > 0) {
      // Structure fields nicely
      const mapped: ChatMessage[] = data.map((d: any) => ({
        id: d.id,
        companyId: d.company_id,
        senderId: d.sender_id,
        senderName: d.sender_name,
        senderJobTitle: d.sender_job_title,
        content: d.content || "",
        voiceUrl: d.voice_url || undefined,
        createdAt: d.created_at
      }));
      
      // Save to local cache
      saveLocalChatMessages(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetch exception, falling back:", err);
  }
  
  return localList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// Post a chat message
export async function sendChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage | null> {
  const now = new Date().toISOString();
  const newId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullMsg: ChatMessage = {
    ...msg,
    id: newId,
    createdAt: now
  };
  
  // Save locally first for instant reactive response
  saveLocalChatMessages([fullMsg]);
  
  if (!supabase) {
    return fullMsg;
  }
  
  try {
    const { error } = await supabase
      .from("corevia_chat_messages")
      .insert([{
        id: fullMsg.id,
        company_id: fullMsg.companyId,
        sender_id: fullMsg.senderId,
        sender_name: fullMsg.senderName,
        sender_job_title: fullMsg.senderJobTitle,
        content: fullMsg.content,
        voice_url: fullMsg.voiceUrl || null,
        created_at: fullMsg.createdAt
      }]);
      
    if (error) {
      console.warn("Supabase failed writing chat message direct, keeping in local cache:", error);
    }
  } catch (err) {
    console.warn("Supabase write exception, cached locally:", err);
  }
  
  return fullMsg;
}
