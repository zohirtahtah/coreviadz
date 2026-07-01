/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  MessageSquare, Send, RefreshCw, AlertCircle, HelpCircle, 
  Clock, CheckCircle, ChevronLeft, ChevronRight, Plus, Eye, User
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { LanguageType, BusinessProfile } from "../types";

interface SupportViewProps {
  lang: LanguageType;
  session: any;
  profile: BusinessProfile | null;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function SupportView({ 
  lang, 
  session, 
  profile, 
  onTriggerNotification 
}: SupportViewProps) {
  const isRtl = lang === "ar";
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Create ticket form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Message reply state
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const companyId = session?.company_id || "";

  const loadTickets = async () => {
    if (!supabase || !companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("corevia_support_tickets")
        .select("*")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST205" || error.message.includes("relation does not exist")) {
          setTickets([]);
          return;
        }
        throw error;
      }
      setTickets(data || []);
    } catch (err: any) {
      console.error("Error loading tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    if (!supabase) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("corevia_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 8000); // Poll ticket list every 8 seconds
    return () => clearInterval(interval);
  }, [companyId]);

  // Poll active ticket messages every 4 seconds for real-time chat feeling
  useEffect(() => {
    if (!selectedTicket?.ticket_id) return;
    const interval = setInterval(() => {
      loadMessages(selectedTicket.ticket_id);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedTicket?.ticket_id]);

  const handleSelectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    await loadMessages(ticket.ticket_id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const ticketId = `tkt-${Date.now()}`;
      const newTicket = {
        ticket_id: ticketId,
        company_id: companyId,
        company_name: profile?.businessName || "My Store",
        owner_name: session?.username || "Owner",
        email: session?.email || "",
        phone: profile?.phone || "",
        subject: subject.trim(),
        message: message.trim(),
        status: "Open",
        priority: priority,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("corevia_support_tickets")
        .insert(newTicket);

      if (error) throw error;

      // Also create an initial message record
      const initialMessage = {
        id: `msg-${Date.now()}`,
        ticket_id: ticketId,
        sender_name: session?.username || "Owner",
        sender_role: "user",
        message: message.trim(),
        is_internal: false,
        created_at: new Date().toISOString()
      };

      await supabase
        .from("corevia_ticket_messages")
        .insert(initialMessage);

      setTickets(prev => [newTicket, ...prev]);
      setShowCreateModal(false);
      setSubject("");
      setMessage("");
      onTriggerNotification(
        isRtl ? "تم فتح تذكرة الدعم الفني بنجاح! سيقوم مهندسونا بالرد عليكم قريباً." : "Support ticket opened successfully! Our engineer will reply shortly.",
        "success"
      );
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setIsSendingReply(true);
    try {
      const newMessage = {
        id: `msg-${Date.now()}`,
        ticket_id: selectedTicket.ticket_id,
        sender_name: session?.username || "Owner",
        sender_role: "user",
        message: replyText.trim(),
        is_internal: false,
        created_at: new Date().toISOString()
      };

      const { error: msgErr } = await supabase
        .from("corevia_ticket_messages")
        .insert(newMessage);

      if (msgErr) throw msgErr;

      // Update status of the ticket back to "Open" for admin review
      const { error: ticketErr } = await supabase
        .from("corevia_support_tickets")
        .update({ 
          status: "Open", 
          updated_at: new Date().toISOString() 
        })
        .eq("ticket_id", selectedTicket.ticket_id);

      if (ticketErr) throw ticketErr;

      setMessages(prev => [...prev, newMessage]);
      setReplyText("");
      
      // Update local ticket list updated_at
      setTickets(prev => prev.map(t => t.ticket_id === selectedTicket.ticket_id ? { ...t, status: "Open", updated_at: new Date().toISOString() } : t));
      
      onTriggerNotification(isRtl ? "تم إرسال الرد بنجاح!" : "Reply sent successfully!", "success");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
            {isRtl ? "مفتوحة" : "Open"}
          </span>
        );
      case "Answered":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            {isRtl ? "تم الرد" : "Answered"}
          </span>
        );
      case "Closed":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-500/10 border border-zinc-500/30 text-zinc-400">
            {isRtl ? "مغلقة" : "Closed"}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-500/10 border border-zinc-500/30 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "Critical":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "High":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "Medium":
        return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
      default:
        return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  return (
    <div className={`space-y-6 pt-2 ${isRtl ? "text-right" : "text-left"}`} id="support_client_viewport">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#27272a] pb-4" id="support_header">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            💬 {isRtl ? "الدعم الفني والبطاقات" : "Technical Support Tickets"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isRtl 
              ? "تواصل مباشرة مع إدارة المنصة، اطرح استفساراتك أو أبلغ عن مشاكل تقنية" 
              : "Direct channel to system administrators, resolve tickets or seek technical advice"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadTickets}
            className="p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/30 cursor-pointer transition-all active:scale-95"
            title={isRtl ? "تحديث التذاكر" : "Refresh list"}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isRtl ? "إنشاء تذكرة دعم" : "Create Ticket"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Main Column: Tickets Directory */}
        <div className="lg:col-span-1 bg-[#121214] border border-[#27272a] rounded-2xl p-4 space-y-4 shadow-md h-[600px] flex flex-col">
          <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
            <h2 className="text-xs font-extrabold text-white">
              {isRtl ? `تذاكرك النشطة (${tickets.length})` : `Your Open Tickets (${tickets.length})`}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2 text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">{isRtl ? "جاري تحميل التذاكر..." : "Retrieving support directory..."}</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-zinc-500">
                <HelpCircle className="w-10 h-10 text-zinc-600 mb-2" />
                <p className="text-xs font-bold text-zinc-400">{isRtl ? "لا توجد تذاكر دعم فني مفتوحة حالياً" : "No technical support logs recorded."}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{isRtl ? "اضغط على الزر بالأعلى لإنشاء أول تذكرة لك." : "Press Create Ticket to open a request."}</p>
              </div>
            ) : (
              tickets.map((tkt) => (
                <div 
                  key={tkt.ticket_id}
                  onClick={() => handleSelectTicket(tkt)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all duration-200 text-right ${
                    selectedTicket?.ticket_id === tkt.ticket_id 
                      ? "bg-indigo-600/10 border-indigo-500" 
                      : "bg-[#18181b]/50 border-zinc-800/85 hover:bg-[#18181b]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1 flex-row-reverse mb-1.5">
                    {getStatusBadge(tkt.status)}
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${getPriorityColor(tkt.priority)}`}>
                      {tkt.priority}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white truncate">{tkt.subject}</h3>
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-2 flex-row-reverse">
                    <span>{tkt.created_at ? tkt.created_at.split("T")[0] : ""}</span>
                    <span className="font-mono text-[9px] text-zinc-600">ID: {tkt.ticket_id.substring(4, 9)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right/Detail Column: Active Ticket Conversation Workspace */}
        <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-2xl p-4 shadow-md h-[600px] flex flex-col">
          {selectedTicket ? (
            <div className="h-full flex flex-col">
              
              {/* Ticket header details */}
              <div className="border-b border-zinc-800 pb-3 mb-3 text-right">
                <div className="flex items-center justify-between flex-row-reverse">
                  <div className="space-y-1">
                    <h2 className="text-sm font-extrabold text-white">{selectedTicket.subject}</h2>
                    <p className="text-[10px] text-zinc-500">
                      {isRtl ? "تم الإنشاء في: " : "Created at: "} {selectedTicket.created_at?.replace("T", " ").substring(0, 16)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(selectedTicket.status)}
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4" id="ticket_thread">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-48">
                    <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                ) : (
                  <>
                    {/* Primary ticket content */}
                    <div className="p-3 bg-[#18181b]/70 border border-zinc-850 rounded-2xl text-right">
                      <div className="flex items-center gap-2 mb-2 justify-end">
                        <span className="text-[10px] font-extrabold text-zinc-300">{selectedTicket.owner_name}</span>
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                          <User className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                        {selectedTicket.message}
                      </p>
                    </div>

                    {/* Replies */}
                    {messages.filter(m => m.id !== `msg-initial`).map((msg) => {
                      const isAdmin = msg.sender_role === "admin" || msg.sender_role === "superadmin" || msg.sender_name.includes("Admin");
                      return (
                        <div 
                          key={msg.id} 
                          className={`p-3 border rounded-2xl max-w-[85%] text-right ${
                            isAdmin 
                              ? "bg-indigo-600/10 border-indigo-500/20 mr-auto" 
                              : "bg-[#18181b]/70 border-zinc-850 ml-auto"
                          }`}
                        >
                          <div className={`flex items-center gap-2 mb-2 ${isAdmin ? "justify-start flex-row-reverse" : "justify-end"}`}>
                            <span className="text-[10px] font-extrabold text-zinc-300">
                              {isAdmin ? (isRtl ? "إدارة المنصة" : "Platform Admin") : msg.sender_name}
                            </span>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isAdmin ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
                            }`}>
                              <User className="w-3 h-3" />
                            </div>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                            {msg.message || msg.message_text}
                          </p>
                          <span className="text-[8px] text-zinc-600 mt-1 block">
                            {msg.created_at?.replace("T", " ").substring(11, 16)}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Reply Composer */}
              {selectedTicket.status !== "Closed" ? (
                <form onSubmit={handleSendReply} className="flex gap-2 items-center flex-row-reverse">
                  <textarea 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    required
                    rows={2}
                    placeholder={isRtl ? "اكتب ردك وملاحظاتك هنا للتواصل..." : "Compose support follow-up message..."}
                    className="flex-1 p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-xl outline-none focus:border-indigo-600 text-right resize-none"
                  />
                  <button 
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className={`w-4 h-4 ${isRtl ? "transform rotate-180" : ""}`} />
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-xl text-center text-xs font-bold text-zinc-500">
                  🔒 {isRtl ? "هذه التذكرة مغلقة وحلّت من قبل المهندسين." : "This support ticket is marked as resolved and closed."}
                </div>
              )}

            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 text-zinc-500">
              <MessageSquare className="w-12 h-12 text-zinc-600 mb-2" />
              <p className="text-sm font-extrabold text-zinc-400">
                {isRtl ? "حدد تذكرة دعم فني لعرض المراسلات" : "Select a Ticket to view messages"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {isRtl 
                  ? "اختر أي تذكرة من اللوحة الجانبية لمتابعة تفاصيل ردود فريقنا الفني." 
                  : "Click on any active thread from the left list to follow-up or reply."}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* CREATE TICKET DIALOG MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="create_ticket_modal">
          <div className="w-full max-w-lg bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-850 mb-4 flex-row-reverse">
              <h3 className="text-base font-extrabold text-white">
                {isRtl ? "فتح تذكرة دعم فني جديدة" : "Open Technical Support Request"}
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "عنوان تذكرة الدعم" : "Subject Summary"}</label>
                <input 
                  type="text"
                  required
                  placeholder={isRtl ? "مثال: خطأ في مزامنة فواتير الإكسل، مشكلة في حساب رواتب العمال..." : "e.g., Billing Sync Issue, Account lock warning"}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "مستوى الأولوية والخطورة" : "Ticket Severity"}</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-indigo-400 font-extrabold rounded-lg outline-none focus:border-indigo-600 text-right"
                >
                  <option value="Low">💡 Low / Question</option>
                  <option value="Medium">⚡ Medium / Functional Block</option>
                  <option value="High">🔥 High / Crash Warning</option>
                  <option value="Critical">🚨 Critical / Security or System lock</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "شرح وتفاصيل المشكلة" : "Elaborative Details"}</label>
                <textarea 
                  required
                  rows={5}
                  placeholder={isRtl ? "يرجى كتابة تفاصيل المشكلة أو الاستفسار هنا بالتفصيل لكي يتمكن مهندسونا من مساعدتكم مباشرة..." : "Describe the scenario, error logs, or specific request..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-lg cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || !subject.trim() || !message.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRtl ? "إرسال التذكرة" : "Submit Ticket"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
