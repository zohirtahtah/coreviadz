import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { generateCompanyBackup } from "../lib/backupEngine";
import type { LanguageType } from "../types";

interface BackupPageProps {
  lang: LanguageType;
  session: any;
  onTriggerNotification?: (msg: string, type: "success" | "info") => void;
}

const DAYS_MAP: Record<string, string> = {
  Saturday: "السبت",
  Sunday: "الأحد",
  Monday: "الإثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
};

export default function BackupPage({ lang, session, onTriggerNotification }: BackupPageProps) {
  const isRtl = lang === "ar";
  const companyId = session?.company_id;

  const [isDownloading, setIsDownloading] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Thursday");
  const [selectedTime, setSelectedTime] = useState("16:00");

  useEffect(() => {
    if (!companyId || !supabase) return;
    supabase
      .from("corevia_companies")
      .select("backup_reminder_day, backup_reminder_time")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.backup_reminder_day) setSelectedDay(data.backup_reminder_day);
          if (data.backup_reminder_time) setSelectedTime(data.backup_reminder_time);
        }
      });
  }, [companyId]);

  const handleDownload = async () => {
    if (!companyId) return;
    setIsDownloading(true);
    const ok = await generateCompanyBackup(companyId, session?.username || "Company");
    if (ok) {
      onTriggerNotification?.(
        isRtl ? "✅ تم تنزيل النسخة الاحتياطية (ZIP) بنجاح!" : "✅ Backup ZIP downloaded successfully!",
        "success"
      );
    } else {
      onTriggerNotification?.(
        isRtl ? "❌ فشلت عملية النسخ الاحتياطي." : "❌ Backup failed.",
        "info"
      );
    }
    setIsDownloading(false);
  };

  const handleSaveSchedule = async () => {
    if (!companyId || !supabase) return;
    const { error } = await supabase
      .from("corevia_companies")
      .update({ backup_reminder_day: selectedDay, backup_reminder_time: selectedTime })
      .eq("id", companyId);
    if (error) {
      onTriggerNotification?.(
        isRtl ? "❌ فشل حفظ الجدولة." : "❌ Failed to save schedule.",
        "info"
      );
    } else {
      onTriggerNotification?.(
        isRtl ? "✅ تم تحديث موعد التذكير الأسبوعي بنجاح!" : "✅ Weekly reminder schedule updated!",
        "success"
      );
      setShowScheduler(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 text-center" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mb-10 space-y-2">
        <div className="text-5xl mb-4">💾</div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          {isRtl ? "مركز النسخ الاحتياطي الشامل" : "Backup Center"}
        </h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          {isRtl
            ? "لحماية بيانات شركتك من التلف الفجائي، يمكنك تنزيل نسخة مقسمة ومنظمة داخل ملف ZIP وحفظها على حاسوبك يدوياً في أي وقت."
            : "Protect your company data. Download a structured, organized ZIP backup of all your database tables anytime."}
        </p>
      </div>

      {/* Large download button */}
      <div className="mb-8">
        <button
          onClick={handleDownload}
          disabled={isDownloading || !companyId}
          className="w-72 sm:w-80 h-36 sm:h-40 bg-zinc-900 hover:bg-black border border-zinc-800 hover:border-indigo-600/50 text-white rounded-3xl text-lg sm:text-xl font-bold shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <svg className={`w-8 h-8 ${isDownloading ? "animate-bounce text-amber-400" : "text-indigo-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>
              {isDownloading
                ? (isRtl ? "جاري جلب وضغط البيانات..." : "Packaging backup...")
                : (isRtl ? "📥 جلب وتنزيل قاعدة البيانات" : "📥 Download Database Backup")}
            </span>
          </div>
        </button>
      </div>

      {/* Schedule reminder button */}
      <div>
        <button
          onClick={() => setShowScheduler(!showScheduler)}
          className="bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-slate-300 hover:text-white text-sm font-medium px-6 py-3 rounded-xl transition-all cursor-pointer"
        >
          ⚙️ {isRtl ? "تعديل وقت التذكير المخصص" : "Schedule Reminder"}
        </button>
      </div>

      {/* Scheduler panel */}
      {showScheduler && (
        <div className="mt-8 p-6 bg-[#121214] border border-[#27272a] rounded-2xl max-w-md mx-auto shadow-xl">
          <h4 className="font-bold mb-5 text-sm text-white text-right">
            {isRtl ? "تخصيص موعد التذكير الدوري للشركة:" : "Schedule Weekly Backup Reminder:"}
          </h4>

          <div className="mb-4 text-right">
            <label className="block text-xs text-slate-400 mb-1.5">
              {isRtl ? "اختر اليوم:" : "Day of week:"}
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl outline-none focus:border-indigo-600 transition-colors cursor-pointer"
            >
              {Object.entries(DAYS_MAP).map(([en, ar]) => (
                <option key={en} value={en}>
                  {isRtl ? ar : en}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 text-right">
            <label className="block text-xs text-slate-400 mb-1.5">
              {isRtl ? "اختر التوقيت والساعة:" : "Time:"}
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-xl outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          <button
            onClick={handleSaveSchedule}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            {isRtl ? "حفظ الجدولة الجديدة" : "Save Schedule"}
          </button>
        </div>
      )}
    </div>
  );
}
