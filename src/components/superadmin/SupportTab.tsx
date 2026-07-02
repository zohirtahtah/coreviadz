import React, { useState, useEffect } from "react";
import { 
  Ticket, Users, Mail, Phone, Clock, AlertCircle, MessageSquare, 
  Send, RefreshCw, Archive, CheckCircle, HelpCircle, ArrowLeft, Tag
} from "lucide-react";
import { supabase } from "../../supabaseClient";

interface SupportTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

const getAuthDetails = () => {
  let token = "";
  try {
    const cachedRaw = localStorage.getItem("corevia_session_v1");
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      token = parsed?.token || "";
    }
  } catch (_) {}
  
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return { token, headers };
};

export default function SupportTab({ isRtl, onTriggerNotification }: SupportTabProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { token, headers } = getAuthDetails();
      const url = token ? `/api/superadmin/support-tickets?token=${encodeURIComponent(token)}` : "/api/superadmin/support-tickets";
      const response = await fetch(url, {
        headers,
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`Failed to load support tickets: ${response.statusText}`);
      }
      const data = await response.json();
      setTickets(data || []);
    } catch (err: any) {
      console.error("Error loading support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { token, headers } = getAuthDetails();
      const url = token ? `/api/superadmin/support-messages/${ticketId}?token=${encodeURIComponent(token)}` : `/api/superadmin/support-messages/${ticketId}`;
      const response = await fetch(url, {
        headers,
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }
      const data = await response.json();
      setMessages(data || []);
    } catch (err: any) {
      console.error("Error loading messages:", err);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 8000); // Poll ticket list every 8 seconds
    return () => clearInterval(interval);
  }, []);

  // Poll active ticket messages every 4 seconds for real-time chat feeling
  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => {
      loadMessages(selectedTicket.ticket_id);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedTicket]);

  const handleSelectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    await loadMessages(ticket.ticket_id);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      const payload = {
        ticket_id: selectedTicket.ticket_id,
        sender_name: "SaaS Super Admin",
        sender_role: "admin",
        message: replyText.trim(),
        is_internal: isInternal
      };

      const { token, headers } = getAuthDetails();
      const url = token ? `/api/superadmin/support-reply?token=${encodeURIComponent(token)}` : "/api/superadmin/support-reply";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to send reply through server");
      }

      setReplyText("");
      onTriggerNotification(isRtl ? "تم إرسال الرد وتحديث حالة التذكرة!" : "Reply sent, ticket status updated!", "success");
      
      // Reload tickets directory & messages
      await loadMessages(selectedTicket.ticket_id);
      await loadTickets();
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from("corevia_support_tickets")
        .update({ status: "Closed", updated_at: new Date().toISOString() })
        .eq("ticket_id", ticketId);
      
      if (error) throw error;
      
      if (selectedTicket?.ticket_id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: "Closed" }));
      }
      loadTickets();
      onTriggerNotification(isRtl ? "تم إغلاق تذكرة الدعم بنجاح!" : "Ticket closed!", "success");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  if (loading) {
    return (
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-6 text-center text-zinc-500 animate-pulse">
        {isRtl ? "جاري تحميل تذاكر الدعم الفني..." : "Loading Active Support Tickets..."}
      </div>
    );
  }

  // Handle case where custom table isn't created yet in Postgres
  if (tickets.length === 0) {
    return (
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center">
          <Ticket className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-sm font-black text-white">{isRtl ? "لم يتم العثور على تذاكر دعم فني" : "No Support Tickets Found"}</h3>
          <p className="text-[11px] text-zinc-400 leading-normal">
            {isRtl 
              ? "لم يتم تسجيل أي تذاكر دعم فني حتى الآن أو أن جداول قاعدة البيانات المخصصة (corevia_support_tickets) لم يتم تهيئتها بعد."
              : "No tickets have been logged, or support database schemas haven't been created in Supabase yet."}
          </p>
        </div>
        <button 
          onClick={loadTickets}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold rounded-lg border border-zinc-700 cursor-pointer active:scale-95 transition-all"
        >
          {isRtl ? "إعادة فحص الاتصال" : "Retry Database Fetch"}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="super_admin_support_panel">
      
      {/* 1. TICKETS DIRECTORY COLUMN */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden flex flex-col h-[650px] shadow-sm">
        
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Ticket className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? `تذاكر الدعم الفني المفتوحة (${tickets.length})` : `Workspace Support Tickets (${tickets.length})`}</span>
          </h3>
          <button onClick={loadTickets} className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
          {tickets.map((t) => {
            const active = selectedTicket?.ticket_id === t.ticket_id;
            return (
              <div 
                key={t.ticket_id}
                onClick={() => handleSelectTicket(t)}
                className={`p-4 cursor-pointer transition-colors text-right relative ${
                  active ? "bg-indigo-500/5 border-r-2 border-indigo-500" : "hover:bg-zinc-900/20"
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    t.priority === "High" ? "bg-rose-500/10 text-rose-400" : 
                    t.priority === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-300"
                  }`}>{t.priority}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{t.created_at ? t.created_at.substring(0, 10) : ""}</span>
                </div>

                <h4 className="font-bold text-white text-xs truncate mb-1">{t.subject}</h4>
                
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    t.status === "Open" ? "bg-blue-500/10 text-blue-400" :
                    t.status === "Answered" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-900 text-zinc-500"
                  }`}>{t.status}</span>
                  <span className="truncate max-w-[150px] font-semibold text-zinc-300">{t.company_name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CHAT & CONVERSATION TIMELINE VIEW */}
      <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-xl flex flex-col h-[650px] overflow-hidden shadow-sm">
        
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Ticket Subject Header */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-right">
              <button 
                onClick={() => handleCloseTicket(selectedTicket.ticket_id)}
                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[10px] font-bold cursor-pointer"
              >
                {isRtl ? "إغلاق التذكرة" : "Close Ticket"}
              </button>

              <div className={`${isRtl ? "text-right" : "text-left"}`}>
                <h3 className="text-xs font-black text-white">{selectedTicket.subject}</h3>
                <span className="text-[10px] text-zinc-400">{selectedTicket.company_name} | {selectedTicket.owner_name}</span>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
              
              {/* Original Query Message */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2 text-right">
                <div className="flex justify-between items-center text-[10px] text-zinc-500">
                  <span>{selectedTicket.created_at ? selectedTicket.created_at.substring(0, 16).replace("T", " ") : ""}</span>
                  <span className="font-black text-indigo-400">{selectedTicket.owner_name} ({isRtl ? "السؤال الأساسي" : "Initial Query"})</span>
                </div>
                <p className="text-xs text-zinc-200 leading-normal whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Thread Responses */}
              {messages.map((m) => {
                const isAdmin = m.sender_role === "admin";
                return (
                  <div 
                    key={m.id}
                    className={`p-3.5 rounded-xl border max-w-[85%] text-right space-y-1.5 ${
                      isAdmin 
                        ? "bg-zinc-900 border-zinc-800 mr-auto" 
                        : "bg-zinc-950 border-zinc-850 ml-auto"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 gap-6">
                      <span className="font-mono">{m.created_at ? m.created_at.substring(0, 16).replace("T", " ") : ""}</span>
                      <span className={`font-extrabold ${isAdmin ? "text-emerald-400" : "text-zinc-300"}`}>
                        {m.sender_name} {m.is_internal && <span className="bg-rose-500/10 text-rose-400 px-1 py-0.2 rounded text-[8px]">INTERNAL</span>}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{m.message}</p>
                  </div>
                );
              })}

            </div>

            {/* Admin Response Form Box */}
            <form onSubmit={handleSendReply} className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-3">
              <textarea
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isRtl ? "اكتب الرد الرسمي للعميل هنا..." : "Type official support response..."}
                rows={3}
                className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded-lg placeholder-zinc-600 outline-none focus:border-indigo-600 text-right resize-none"
              />

              <div className="flex items-center justify-between">
                <button 
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold rounded shadow cursor-pointer active:scale-95 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isRtl ? "إرسال الرد" : "Publish Reply"}</span>
                </button>

                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                  <label htmlFor="internal_note_chk" className="cursor-pointer">{isRtl ? "ملاحظة داخلية سرية" : "Private Internal Note"}</label>
                  <input 
                    type="checkbox"
                    id="internal_note_chk"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </form>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 text-zinc-600" />
            <p className="text-xs font-bold">{isRtl ? "الرجاء تحديد تذكرة من اللوحة الجانبية لعرض timeline والرد" : "Select a support ticket to audit details"}</p>
          </div>
        )}

      </div>

    </div>
  );
}
