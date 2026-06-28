import React, { useState, useEffect } from "react";
import { 
  Megaphone, Plus, Search, Calendar, RefreshCw, AlertTriangle, 
  Trash, Send, Info, Eye, ShieldAlert, CheckCircle
} from "lucide-react";
import { supabase } from "../../supabaseClient";

interface AnnouncementsTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function AnnouncementsTab({ isRtl, onTriggerNotification }: AnnouncementsTabProps) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcaster form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"Information" | "Warning" | "Maintenance" | "New Feature" | "Critical">("Information");
  const [targetType, setTargetType] = useState<"all" | "trial" | "expired">("all");

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("corevia_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("relation does not exist")) {
          setAnnouncements([]);
          return;
        }
        throw error;
      }
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const newAnn = {
        id: `ann-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        type,
        target_type: targetType,
        created_by: "Super Admin",
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("corevia_announcements")
        .insert(newAnn);
      
      if (error) throw error;

      setAnnouncements(prev => [newAnn, ...prev]);
      setTitle("");
      setContent("");
      onTriggerNotification(isRtl ? "تم نشر الإعلان بنجاح لجميع العملاء المستهدفين!" : "Announcement published successfully to target tiers!", "success");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isRtl ? "هل أنت متأكد من حذف هذا الإعلان نهائياً؟" : "Permanently remove this broadcast?")) return;
    try {
      const { error } = await supabase
        .from("corevia_announcements")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== id));
      onTriggerNotification(isRtl ? "تم حذف الإعلان بنجاح!" : "Broadcast deleted!", "success");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="super_admin_announcements_panel">
      
      {/* 1. BROADCAST CREATOR FORM */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm h-fit">
        <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 text-right justify-end">
          <Megaphone className="w-4 h-4 text-indigo-400" />
          <span>{isRtl ? "إنشاء ونشر إعلان منصة جديد" : "Compose Broadcast Notice"}</span>
        </h3>

        <form onSubmit={handlePublish} className="space-y-4 text-right">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "عنوان الإعلان" : "Broadcast Title"}</label>
            <input 
              type="text"
              required
              placeholder={isRtl ? "أعمال صيانة مجدولة، ميزات جديدة..." : "e.g. Schedule Maintenance Notice"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "نوع الإعلان" : "Notice Level"}</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-indigo-400 font-extrabold rounded-lg outline-none focus:border-indigo-600 text-right"
            >
              <option value="Information">💡 Information</option>
              <option value="Warning">⚠️ Warning</option>
              <option value="Maintenance">🔧 Maintenance</option>
              <option value="New Feature">🚀 New Feature</option>
              <option value="Critical">🚨 Critical Lock</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "الشريحة المستهدفة" : "Target Segment"}</label>
            <select 
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
            >
              <option value="all">{isRtl ? "جميع الشركات المشتركة" : "All Subscribed Tenants"}</option>
              <option value="trial">{isRtl ? "شركات الباقات التجريبية فقط" : "Trials & Free plans only"}</option>
              <option value="expired">{isRtl ? "الشركات منتهية الصلاحية فقط" : "Expired subscribers only"}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "محتوى الإعلان" : "Notice Content Body"}</label>
            <textarea 
              required
              rows={4}
              placeholder={isRtl ? "أدخل تفاصيل الإعلان هنا لتظهر فوراً بلوحة تحكم العميل..." : "Describe broadcast notice payload..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right resize-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-2.5 bg-indigo-605 hover:bg-indigo-600 text-white text-xs font-black rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isRtl ? "بث ونشر الإعلان فوراً" : "Send Global Broadcast"}</span>
          </button>
        </form>
      </div>

      {/* 2. LIVE BROADCAST TIMELINE FEED */}
      <div className="lg:col-span-2 bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden flex flex-col h-[580px] shadow-sm">
        
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? `أرشيف إعلانات المنصة المنشورة (${announcements.length})` : `Active platform broadcasts archive (${announcements.length})`}</span>
          </h3>
          <button onClick={loadAnnouncements} className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center text-zinc-500 py-12">
              <Megaphone className="w-8 h-8 text-zinc-750 mx-auto mb-2" />
              <p className="text-xs font-bold">{isRtl ? "لم يتم بث أي إعلانات للمنصة حتى الآن." : "No published announcements."}</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2.5 relative hover:border-zinc-700 transition-all text-right">
                
                <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                  <button 
                    onClick={() => handleDelete(a.id)}
                    className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800/40"
                    title={isRtl ? "حذف نهائياً" : "Remove Notice"}
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{a.created_at ? a.created_at.substring(0, 16).replace("T", " ") : ""}</span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Target: {a.target_type}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      a.type === "Warning" ? "bg-amber-500/10 text-amber-400" :
                      a.type === "Maintenance" ? "bg-indigo-500/10 text-indigo-400" :
                      a.type === "Critical" ? "bg-rose-500/10 text-rose-400 animate-pulse" : "bg-zinc-800 text-zinc-300"
                    }`}>{a.type}</span>
                  </div>
                </div>

                <h4 className="font-extrabold text-white text-xs">{a.title}</h4>
                <p className="text-xs text-zinc-300 leading-normal">{a.content}</p>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
