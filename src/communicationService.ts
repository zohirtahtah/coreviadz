import { supabase } from "./supabaseClient";
import { ChatMessage } from "./types";

export async function getChatMessages(companyId: string): Promise<ChatMessage[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("corevia_chat_messages")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Supabase chat fetch error:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((d: any) => ({
      id: d.id,
      companyId: d.company_id,
      senderId: d.sender_id,
      senderName: d.sender_name,
      senderJobTitle: d.sender_job_title,
      content: d.content || "",
      voiceUrl: d.voice_url || undefined,
      createdAt: d.created_at
    }));
  } catch (err) {
    console.warn("Supabase fetch exception:", err);
    return [];
  }
}

export async function sendChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage | null> {
  const now = new Date().toISOString();
  const newId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullMsg: ChatMessage = {
    ...msg,
    id: newId,
    createdAt: now
  };

  if (!supabase) return fullMsg;

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
      console.warn("Supabase failed writing chat message:", error);
    }
  } catch (err) {
    console.warn("Supabase write exception:", err);
  }

  return fullMsg;
}
