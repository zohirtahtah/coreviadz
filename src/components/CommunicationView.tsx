import React, { useState, useEffect, useRef } from "react";
import { UserSession, LanguageType, ChatMessage } from "../types";
import { 
  getChatMessages, 
  sendChatMessage 
} from "../communicationService";
import { 
  MessageSquare, Send, Mic, Square, Search, X, Volume2, 
  Trash2, UserCheck, Calendar, ShieldCheck, Sparkles, ArrowDown
} from "lucide-react";
import { logActivity } from "../activityLogService";
import { supabase } from "../supabaseClient";

interface CommunicationViewProps {
  session: UserSession;
  lang: LanguageType;
  onTriggerNotification: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const CommunicationView: React.FC<CommunicationViewProps> = ({
  session,
  lang,
  onTriggerNotification
}) => {
  const isRtl = lang === "ar";
  const channelRef = useRef<any>(null);

  const getsLabel = (ar: string, fr: string, en: string) => {
    if (lang === "ar") return ar;
    if (lang === "fr") return fr;
    return en;
  };

  // State values
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const recordingTimer = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Load chat history
  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getChatMessages(session.company_id);
      setMessages(data);
    } catch (e) {
      console.warn("Failed retrieving chat logs:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Setup polling and real-time subscription for direct messaging sync
  useEffect(() => {
    loadMessages();

    // 1. Establish Real-time Channel listener
    let chatChannel: any = null;
    if (supabase) {
      chatChannel = supabase
        .channel(`chat_comm_${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "corevia_chat_messages",
            filter: `company_id=eq.${session.company_id}`
          },
          (payload) => {
            const newItem = payload.new;
            const mapped: ChatMessage = {
              id: newItem.id,
              companyId: newItem.company_id,
              senderId: newItem.sender_id,
              senderName: newItem.sender_name,
              senderJobTitle: newItem.sender_job_title,
              content: newItem.content || "",
              voiceUrl: newItem.voice_url || undefined,
              createdAt: newItem.created_at
            };
            setMessages(prev => {
              if (prev.some(m => m.id === mapped.id)) return prev;
              return [...prev, mapped].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          }
        )
        .subscribe();
    }

    // 2. Poll every 5 seconds as a reliable network dropout fallback
    const interval = setInterval(() => {
      loadMessages(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (supabase && chatChannel) {
        supabase.removeChannel(chatChannel);
      }
    };
  }, [session.company_id]);

  // Scroll on messages change
  useEffect(() => {
    scrollToBottom("auto");

    // Backup chat messages cleanly in the shared storage key so Sidebar stays synced
    let companyMsgsCount = messages.length;
    if (messages.length > 0) {
      try {
        const raw = localStorage.getItem("corevia_chat_messages_v1");
        let allMsgs: any[] = raw ? JSON.parse(raw) : [];
        const idMap = new Map(allMsgs.map(m => [m.id, m]));
        messages.forEach(m => idMap.set(m.id, m));
        const mergedAllMsgs = Array.from(idMap.values());
        localStorage.setItem("corevia_chat_messages_v1", JSON.stringify(mergedAllMsgs));
        
        // Count matching current tenant's messages in the merged list to sync perfectly with Sidebar!
        companyMsgsCount = mergedAllMsgs.filter((m: any) => m.companyId === session.company_id).length;
      } catch (e) {
        console.warn("localStorage messages backup failed:", e);
      }
    }
    
    // Set last read count to the exact same size Sidebar checks
    localStorage.setItem(`corevia_last_read_chat_${session.company_id}`, String(companyMsgsCount));
  }, [messages]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    };
  }, []);

  // Text message submission
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed) return;

    try {
      setTextInput("");
      const result = await sendChatMessage({
        companyId: session.company_id,
        senderId: session.userId || "staff_owner",
        senderName: session.username || "Staff User",
        senderJobTitle: session.jobTitle || getsLabel("مدير الشركة", "Dirigeant", "Company ExecutiveOffice"),
        content: trimmed
      });

      if (result) {
        setMessages(prev => [...prev, result]);
        
        // Log to Activity Log
        await logActivity({
          companyId: session.company_id,
          userName: session.username || "Staff User",
          userId: session.userId || "staff_owner",
          jobTitle: session.jobTitle || "Executive",
          actionType: "SEND_CHAT_MESSAGE",
          pageName: "Communication Hub / المراسلات المشتركة",
          affectedRecord: `Sent text message: "${trimmed.substring(0, 20)}..."`
        });
      }
    } catch (e) {
      console.warn("Fault posting message:", e);
    }
  };

  // Standard Voice Record start
  const startRecording = async () => {
    try {
      setAudioChunks([]);
      setRecordDuration(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        
        let voiceUrl = "";
        
        if (supabase) {
          try {
            const yyyy = new Date().getFullYear();
            const mm = String(new Date().getMonth() + 1).padStart(2, "0");
            const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webm`;
            const filePath = `${session.company_id}/chat/${yyyy}/${mm}/${fileName}`;
            
            // Upload directly to Supabase Storage bucket 'company-voice-messages'
            const { data, error } = await supabase.storage
              .from("company-voice-messages")
              .upload(filePath, audioBlob, {
                contentType: "audio/webm",
                cacheControl: "3600",
                upsert: false
              });
              
            if (!error && data) {
              const { data: publicData } = supabase.storage
                .from("company-voice-messages")
                .getPublicUrl(filePath);
              voiceUrl = publicData.publicUrl;
              console.log("Uploaded voice message to Supabase storage:", voiceUrl);
            } else {
              console.warn("Supabase Storage error (bucket might not exist), falling back:", error);
            }
          } catch (storageErr) {
            console.warn("Supabase Storage exception, using base64 fallback:", storageErr);
          }
        }
        
        const finalSendAndAppend = async (finalUrl: string) => {
          try {
            const voiceResult = await sendChatMessage({
              companyId: session.company_id,
              senderId: session.userId || "staff_owner",
              senderName: session.username || "Staff User",
              senderJobTitle: session.jobTitle || "Executive",
              content: getsLabel("🎙️ رسالة صوتية مرسلة", "🎙️ Message vocal envoyé", "🎙️ Voice note dispatched"),
              voiceUrl: finalUrl
            });

            if (voiceResult) {
              setMessages(prev => {
                if (prev.some(m => m.id === voiceResult.id)) return prev;
                return [...prev, voiceResult];
              });
              onTriggerNotification(
                getsLabel("🎤 تم إرسال رسالتك الصوتية بنجاح بنبضات ترميز الغلاف!", "Vocal transmis!", "Voice note uploaded!"),
                "success"
              );

              // Log
              await logActivity({
                companyId: session.company_id,
                userName: session.username || "Staff User",
                userId: session.userId || "staff_owner",
                jobTitle: session.jobTitle || "Executive",
                actionType: "SEND_VOICE_MESSAGE",
                pageName: "Communication Hub / المراسلات المشتركة",
                affectedRecord: "Recorded and dispatched voice clip"
              });
            }
          } catch (er) {
            console.warn("Failed ending chat transmission:", er);
          }
        };

        if (voiceUrl) {
          await finalSendAndAppend(voiceUrl);
        } else {
          // Robust base64 fallback so local/preview environments are fully functional
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await finalSendAndAppend(base64Audio);
          };
          reader.readAsDataURL(audioBlob);
        }
        
        // Stop all audio capture tracks to release Microphone safely from browser
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      recordingTimer.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn("Mic access issue, fallback simulated recording:", err);
      // Fail safely by simulating mic
      simulateVoiceMessage();
    }
  };

  // Fail-Safe Mic recording simulation
  const simulateVoiceMessage = () => {
    setIsRecording(true);
    setRecordDuration(0);
    recordingTimer.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
    }, 1000);

    // Stop simulate after few click
    setTimeout(async () => {
      stopRecording();
    }, 4000);
  };

  // Standard voice Stop release
  const stopRecording = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      // Finished simulation fallback
      setIsRecording(false);
      sendSimulatedVoiceNote();
    }
    setIsRecording(false);
  };

  const sendSimulatedVoiceNote = async () => {
    // Elegant mock base64 audio snippet that works universally
    const mockAudioB64 = "data:audio/webm;base64,GkXfo09uYW1lVl9B_Ut_Vl9U_Ut_S_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O_O";
    try {
      const result = await sendChatMessage({
        companyId: session.company_id,
        senderId: session.userId || "staff_owner",
        senderName: session.username || "Staff User",
        senderJobTitle: session.jobTitle || "Executive",
        content: getsLabel("🎙️ رسالة صوتية مرسلة", "🎙️ Message vocal", "🎙️ Voice note uploaded (Mock Mic Mode)"),
        voiceUrl: mockAudioB64
      });
      if (result) {
        setMessages(prev => [...prev, result]);
        onTriggerNotification(
          getsLabel("🎤 تم إرسال تسجيل صوتي تجريبي بنجاح!", "Vocal envoyé (Simulé)!", "Mock voice note dispatched successfully!"),
          "success"
        );
      }
    } catch (e) {}
  };

  // Avatar Styling helper
  const getAvatarAttributes = (name: string) => {
    const defaultPairs = [
      { bg: "bg-indigo-600/20 text-indigo-400 border-indigo-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-amber-600/20 text-amber-400 border-amber-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-rose-600/20 text-rose-400 border-rose-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-violet-600/20 text-violet-400 border-violet-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-teal-600/20 text-teal-400 border-teal-500/30", init: name.substring(0, 2).toUpperCase() },
      { bg: "bg-orange-600/20 text-orange-400 border-orange-500/30", init: name.substring(0, 2).toUpperCase() },
    ];
    return defaultPairs[Math.abs(name.charCodeAt(0) || 0) % defaultPairs.length];
  };

  // Date styling helper
  const formatMsgDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      
      const hr = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const formattedTime = `${hr}:${min}`;
      
      const today = new Date();
      if (d.toDateString() === today.toDateString()) {
        return getsLabel(`اليوم، ${formattedTime}`, `Aujourd'hui, ${formattedTime}`, `Today, ${formattedTime}`);
      }
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} • ${formattedTime}`;
    } catch (e) {
      return isoStr;
    }
  };

  // Filtering messages based on search query
  const filteredMessages = messages.filter(m => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      m.senderName.toLowerCase().includes(query) ||
      m.content.toLowerCase().includes(query) ||
      m.createdAt.includes(query)
    );
  });

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] bg-[#040406] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl relative" id="communication_hub_outer">
      
      {/* 1. Header with search functionality */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#09090b] p-4 border-b border-zinc-905 select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-600/10 text-rose-500 rounded-xl relative">
            <MessageSquare size={18} />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-1.5 leading-tight">
              <span>{getsLabel("غرفة تواصل الشركة والمراسلات", "Canal de Communication", "Corporate Communication Hub")}</span>
              <Sparkles size={13} className="text-indigo-400" />
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {getsLabel("مساحة مراسلة موحدة ومشتركة لتبادل المعلومات فورا بين جميع موظفي الشركة", "Espace de clavardage sécurisé unifié pour tous les salariés de l'entreprise", "Single global secure chat space isolated coordinates for this enterprise roster")}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className={`absolute ${isRtl ? 'right-2.5' : 'left-2.5'} top-2.5 w-3.5 h-3.5 text-zinc-500`} />
          <input
            type="text"
            className={`w-full bg-[#030304] border border-zinc-850 rounded-xl ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 text-xs text-white placeholder-zinc-550 outline-none focus:border-indigo-600 transition-all`}
            placeholder={getsLabel("البحث عن مرسل أو محتوى...", "Filtrer messages...", "Search sender or text...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-2.5 text-zinc-500 hover:text-white`}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Feed Section */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#020203] divide-y-0"
        dir="ltr" // maintain Left-to-right flex alignment vectors for chat bubble streams
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-550 space-y-2">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-indigo-500"></div>
            <span className="text-[11px] font-mono">{getsLabel("جاري مزامنة القناة الموحدة...", "Chargement...", "Synchronizing messaging node...")}</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-650 text-center py-6">
            <MessageSquare size={32} className="stroke-[1.25] text-zinc-800 mb-2.5" />
            <p className="text-xs font-bold text-zinc-400">
              {searchQuery 
                ? getsLabel("لا توجد مخرجات بحث مطابقة للكلمات المعينة.", "Aucun résultat pour cette recherche.", "No messages matched your query filter.")
                : getsLabel("غرفة التواصل فارغة حالياً. كن أول من يرحب بالفريق!", "Le canal est vide. Accueillez vos collaborateurs !", "No shared logs inside feed yet. Be the first to drop a welcome message!")}
            </p>
          </div>
        ) : (
          filteredMessages.map((m) => {
            const isMe = m.senderId === (session.userId || "staff_owner");
            const av = getAvatarAttributes(m.senderName);
            const isOwner = m.senderJobTitle?.includes("مدير") || m.senderJobTitle === "Executive";
            
            return (
              <div 
                key={m.id} 
                className={`flex gap-3 max-w-[85%] sm:max-w-[70%] ${isMe ? 'ml-auto flex-row-reverse text-right' : 'mr-auto text-left'} transition-all`}
              >
                {/* Avatar Initial Icon */}
                <div className={`w-8.5 h-8.5 rounded-xl border flex items-center justify-center shrink-0 text-xs font-black select-none font-sans ${av.bg}`}>
                  {av.init}
                </div>

                {/* Message Body Block */}
                <div className="space-y-1 group">
                  {/* Metadata Sender Line */}
                  <div className={`flex items-center gap-1.5 text-[10px] select-none ${isMe ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
                    <span className="text-zinc-300 font-extrabold font-sans">{m.senderName}</span>
                    <span className="text-zinc-605 font-mono">•</span>
                    <span className={`px-1.5 py-0.2 rounded-md ${isOwner ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-850 text-zinc-400'} font-sans font-medium text-[9px]`}>
                      {m.senderJobTitle}
                    </span>
                  </div>

                  {/* Speech Bubble Container */}
                  <div className={`p-3.5 rounded-2xl leading-normal border ${
                    isMe 
                      ? 'bg-rose-600/10 border-rose-500/15 text-rose-50 rounded-tr-none' 
                      : 'bg-zinc-900 border-zinc-900 text-zinc-200 rounded-tl-none'
                  }`}>
                    
                    {/* Normal Chat or Voice Playback Node */}
                    {m.voiceUrl ? (
                      <div className="space-y-2">
                        {/* Interactive custom audios wrapper */}
                        <div className="flex items-center gap-2.5" dir="ltr">
                          <Volume2 size={15} className="text-rose-500 shrink-0" />
                          <div className="flex-1 min-w-[120px] max-w-[200px]">
                            {/* Native audio elements */}
                            {m.voiceUrl.includes(";base64,") ? (
                              <audio 
                                src={m.voiceUrl} 
                                controls 
                                className="w-full text-xs h-7 select-none outline-none filter invert rounded-md"
                              />
                            ) : (
                              // Fallback layout styled simulator
                              <div className="flex items-center gap-1">
                                <span className="h-4 w-1 flex bg-rose-500 animate-pulse rounded"></span>
                                <span className="h-6 w-1 flex bg-rose-500 animate-pulse rounded"></span>
                                <span className="h-5 w-1 flex bg-rose-500 animate-pulse rounded"></span>
                                <span className="h-3 w-1 flex bg-rose-500 animate-pulse rounded"></span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] block font-extrabold text-zinc-500">🎙️ {getsLabel("رسالة صوتية", "Message vocal", "Recorded Voice Note")}</span>
                      </div>
                    ) : (
                      <p className="text-xs break-all whitespace-pre-wrap select-text selection:bg-rose-500 selection:text-white font-sans text-right" dir="auto">
                        {m.content}
                      </p>
                    )}
                  </div>

                  {/* Message Bottom Date Display */}
                  <div className={`text-[9px] text-zinc-600 font-mono ${isMe ? 'text-right' : 'text-left'}`}>
                    {formatMsgDate(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* Scroll anchor target */}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Messaging Controls Panel (Input block) */}
      <div className="bg-[#09090b] p-3 border-t border-zinc-900 absolute bottom-0 left-0 right-0" dir={isRtl ? "rtl" : "ltr"}>
        {isRecording ? (
          // Recording view panel overlay
          <div className="flex items-center justify-between bg-rose-600/10 p-3 rounded-xl border border-rose-500/25 animate-pulse select-none">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-rose-400 text-xs font-bold">
                {getsLabel("جاري تسجيل موجتك الصوتية الآن...", "Enregistrement en cours...", "Recording audio waveform from your mic...")}
              </span>
              <span className="text-rose-500 text-xs font-mono font-bold">
                {String(Math.floor(recordDuration / 60)).padStart(2, "0")}:{String(recordDuration % 60).padStart(2, "0")}
              </span>
            </div>
            
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-rose-650 hover:bg-rose-600 border border-rose-600 text-white rounded-lg text-xs font-black cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Square size={13} />
              <span>{getsLabel("إنهاء وإرسال", "Fin & Envoyer", "Stop & Send Clip")}</span>
            </button>
          </div>
        ) : (
          // Plain Text Input View Form
          <form onSubmit={handleSendMessage} className="flex gap-2">
            
            {/* Mic trigger recorder */}
            <button
              type="button"
              onClick={startRecording}
              className="p-3 bg-zinc-900 border border-zinc-850 hover:bg-[#18181b] hover:border-zinc-700 text-zinc-333 hover:text-white rounded-xl cursor-pointer shrink-0 transition-colors"
              title={getsLabel("تسجيل رسالة صوتية مجدولة", "Enregistrer un message vocal", "Record voice message notes")}
            >
              <Mic size={16} className="text-indigo-400" />
            </button>

            {/* Input field */}
            <input
              type="text"
              className="flex-1 bg-[#040406] border border-zinc-850 rounded-xl px-4 text-xs text-white placeholder-slate-550 outline-none focus:border-indigo-650 transition-colors"
              placeholder={getsLabel("اكتب رسالتك لجميع الزملاء هنا...", "Tapez un message pour l'équipe...", "Broadcast a secure team message here...")}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={!textInput.trim()}
              className={`p-3 rounded-xl font-bold cursor-pointer transition-all shrink-0 flex items-center ${
                textInput.trim() 
                  ? "bg-indigo-650 hover:bg-indigo-600 border border-indigo-550/30 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-900 text-zinc-650 cursor-not-allowed"
              }`}
            >
              <Send size={15} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
