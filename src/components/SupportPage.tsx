import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { LanguageType } from "../types";

interface SupportPageProps {
  lang: LanguageType;
  session?: any;
  onClose?: () => void;
}

export default function SupportPage({ lang, session, onClose }: SupportPageProps) {
  const isRtl = lang === "ar";
  const [adminPhone, setAdminPhone] = useState("+213 XX XX XX XX");
  const [adminEmail, setAdminEmail] = useState("admin@corevia.com");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("corevia_system_settings")
          .select("admin_phone, admin_email")
          .limit(1)
          .maybeSingle();
        if (data) {
          setAdminPhone(data.admin_phone || adminPhone);
          setAdminEmail(data.admin_email || adminEmail);
        }
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!supabase || !message.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("corevia_support_tickets").insert({
        user_id: user?.id || "anonymous",
        user_name: session?.username || user?.email || "Unknown",
        user_email: session?.email || user?.email || "",
        company_id: session?.company_id || "",
        message_content: message.trim(),
        has_new_admin_alert: true
      });
      setSuccess(true);
      setMessage("");
    } catch (err) {
      console.error("Support ticket error:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">

        {onClose && (
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isRtl ? "← العودة للتطبيق" : "← Back to app"}
          </button>
        )}

        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              {isRtl ? "مركز الاتصال المباشر بالإدارة العليا" : "Support Center"}
            </h2>
            <p className="text-xs text-slate-400">
              {isRtl
                ? "يمكنك الاتصال بنا مباشرة في أي وقت لتفعيل اشتراكك أو حل المشكلات التقنية."
                : "Contact us anytime to activate your subscription or resolve technical issues."}
            </p>
          </div>
          <div className={`text-sm font-mono space-y-1 ${isRtl ? "text-right" : "text-left"}`}>
            <div className="text-slate-300">
              <span className="text-indigo-400 text-xs">{isRtl ? "الهاتف: " : "Phone: "}</span>
              {adminPhone}
            </div>
            <div className="text-slate-300">
              <span className="text-indigo-400 text-xs">{isRtl ? "البريد: " : "Email: "}</span>
              {adminEmail}
            </div>
          </div>
        </div>

        <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {isRtl ? "أرسل استفسارك أو طلب تفعيل اشتراكك" : "Send a Support Ticket"}
          </h3>

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-sm">
              {isRtl
                ? "تم إرسال استفسارك بنجاح. سيظهر إشعار فوري للمشرف وسيتم الرد عليك في أقرب وقت."
                : "Your ticket has been submitted successfully. The admin will be notified immediately."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-4 bg-slate-900 border border-slate-800 text-white rounded-xl min-h-[150px] text-sm outline-none focus:border-indigo-600 transition-colors resize-y"
              placeholder={
                isRtl
                  ? "اكتب رسالتك بالتفصيل هنا... (مطلوب)"
                  : "Describe your issue or request in detail... (required)"
              }
              required
              dir={isRtl ? "rtl" : "ltr"}
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
            >
              {sending
                ? (isRtl ? "جارٍ الإرسال..." : "Sending...")
                : (isRtl ? "إرسال الرسالة للإدارة" : "Send Ticket")}
            </button>
          </form>
        </div>

        <p className="text-[10px] text-slate-600 text-center">
          {isRtl
            ? "نظام الدعم متاح على مدار الساعة. سيتم الرد على تذكرتك في أقرب وقت ممكن."
            : "Support is available 24/7. We'll respond to your ticket as soon as possible."}
        </p>
      </div>
    </div>
  );
}
