import React, { useState, useEffect } from "react";
import { UserSession, Worker, LanguageType } from "../types";
import { 
  getWorkers 
} from "../storageUtils";
import { 
  EmployeeSubmission, 
  getSubmissions, 
  saveSubmission, 
  deleteSubmission 
} from "../employeeSubmissionsService";
import { 
  DollarSign, Clock, Calendar, FileText, AlertCircle, 
  CheckCircle2, XCircle, Send, Plus, Trash2, ShieldAlert,
  UserCheck, HeartHandshake, TrendingUp
} from "lucide-react";
import { logActivity } from "../activityLogService";

interface MyProfileViewProps {
  session: UserSession;
  lang: LanguageType;
  onTriggerNotification: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  session,
  lang,
  onTriggerNotification
}) => {
  const isRtl = lang === "ar";
  const currencyLabel = "دج";

  // State
  const [submissions, setSubmissions] = useState<EmployeeSubmission[]>([]);
  const [workerProfile, setWorkerProfile] = useState<Worker | null>(null);
  
  // Form State
  const [subType, setSubType] = useState<"overtime" | "missing_hours" | "absence" | "expense">("overtime");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all synced info
  const loadProfileAndHistory = async () => {
    // 1. Locate matching Worker record
    const allWorkers = getWorkers();
    const match = allWorkers.find(
      w => w.id === session.userId || 
           (w.phone && session.phone && w.phone.replace(/[^0-9]/g, "") === session.phone.replace(/[^0-9]/g, "")) ||
           w.name.toLowerCase().trim() === (session.username || "").toLowerCase().trim()
    );
    if (match) {
      setWorkerProfile(match);
    }

    // 2. Load submission history
    try {
      const data = await getSubmissions(session.company_id);
      // Filter for this specific employee
      const filtered = data.filter(
        s => s.employeeId === session.userId || 
             s.employeeName.toLowerCase().trim() === (session.username || "").toLowerCase().trim()
      );
      setSubmissions(filtered);
    } catch (err) {
      console.warn("Failed to retrieve submissions", err);
    }
  };

  useEffect(() => {
    loadProfileAndHistory();
    const interval = setInterval(() => {
      // Re-read worker profile from localStorage (updated by real-time subscriptions)
      const allWorkers = getWorkers();
      const match = allWorkers.find(
        w => w.id === session.userId || 
             (w.phone && session.phone && w.phone.replace(/[^0-9]/g, "") === session.phone.replace(/[^0-9]/g, "")) ||
             w.name.toLowerCase().trim() === (session.username || "").toLowerCase().trim()
      );
      if (match) setWorkerProfile(match);
    }, 5000);
    const subInterval = setInterval(async () => {
      try {
        const data = await getSubmissions(session.company_id);
        const filtered = data.filter(
          s => s.employeeId === session.userId || 
               s.employeeName.toLowerCase().trim() === (session.username || "").toLowerCase().trim()
        );
        setSubmissions(filtered);
      } catch (err) {
        console.warn("Failed to refresh submissions", err);
      }
    }, 5000);
    return () => { clearInterval(interval); clearInterval(subInterval); };
  }, [session]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      onTriggerNotification(
        isRtl 
          ? "⚠️ يرجى إدخال قيمة صحيحة أكبر من الصفر." 
          : "⚠️ Please enter a valid quantity greater than zero.",
        "warning"
      );
      return;
    }
    if (!description.trim()) {
      onTriggerNotification(
        isRtl 
          ? "⚠️ يرجى توضيح السبب أو التفاصيل." 
          : "⚠️ Please fill in detailed reasons or expense specs.",
        "warning"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const newSub: EmployeeSubmission = {
        id: "SUB-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
        companyId: session.company_id,
        employeeId: session.userId || "EMP-" + Math.random().toString(36).substring(2, 5),
        employeeName: session.username || "Employee Name",
        type: subType,
        amount: Number(amount),
        description: description.trim(),
        date: date,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      const success = await saveSubmission(newSub);
      if (success) {
        onTriggerNotification(
          isRtl 
            ? "🚀 تم إرسال تقريرك بنجاح وهو بانتظار مراجعة الإدارة." 
            : "🚀 Report submitted successfully! Pending owner approval.",
          "success"
        );
        
        // Log Activity
        await logActivity({
          companyId: session.company_id,
          userName: session.username || "Employee",
          userId: session.userId || "Employee",
          jobTitle: session.jobTitle || "Employee Account",
          actionType: "CREATE_REPORT",
          pageName: "My Profile / ملفي الشخصي",
          affectedRecord: `Submitted ${subType} report: ${amount} units`
        });

        // Reset form
        setAmount(0);
        setDescription("");
        setDate(new Date().toISOString().substring(0, 10));
        loadProfileAndHistory();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePending = async (id: string, type: string) => {
    try {
      const success = await deleteSubmission(id, session.company_id);
      if (success) {
        onTriggerNotification(
          isRtl 
            ? "✓ تم سحب وإلغاء الطلب المعلق بنجاح." 
            : "✓ Pending submission withdrawn successfully.",
          "success"
        );
        // Log Activity
        await logActivity({
          companyId: session.company_id,
          userName: session.username || "Employee",
          userId: session.userId || "Employee",
          jobTitle: session.jobTitle || "Employee Account",
          actionType: "DELETE_REPORT",
          pageName: "My Profile / ملفي الشخصي",
          affectedRecord: `Withdrawn pending ${type} submission`
        });
        loadProfileAndHistory();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Helper Labels mapping
  const getSubLabelAr = (val: string) => {
    switch(val) {
      case "overtime": return "ساعات عمل إضافية";
      case "missing_hours": return "ساعات ضائعة / غياب جزئي";
      case "absence": return "أيام غياب كاملة";
      case "expense": return "تعويض مصاريف مدفوعة";
      default: return val;
    }
  };

  const getSubLabelEn = (val: string) => {
    switch(val) {
      case "overtime": return "Overtime Hours";
      case "missing_hours": return "Missing/Lost Hours";
      case "absence": return "Absence Days (Unpaid)";
      case "expense": return "Refundable Expense Claim";
      default: return val;
    }
  };

  const getStatusBadge = (status: "pending" | "approved" | "rejected") => {
    if (status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 font-bold text-[10px]">
          <CheckCircle2 size={11} />
          {isRtl ? "مقبول ومؤكد" : "Approved"}
        </span>
      );
    } else if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-450 font-bold text-[10px]">
          <XCircle size={11} />
          {isRtl ? "مرفوض" : "Rejected"}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-450 font-bold text-[10px]">
          <Clock size={11} className="animate-spin duration-3000" />
          {isRtl ? "قيد المراجعة" : "Pending Review"}
        </span>
      );
    }
  };

  // Resolve salary numbers nicely
  const baseSalaryVal = workerProfile?.baseSalary ?? 35000;
  const monthlySalaryVal = workerProfile?.monthlySalary ?? 35000;
  const dailyHoursVal = workerProfile?.dailyHours ?? 8;
  const workingDaysVal = workerProfile?.workingDaysPerMonth ?? 26;
  const overtimeRateVal = workerProfile?.overtimeRate ?? 250;
  const absenceRateVal = workerProfile?.absenceDeductionRate ?? 1500;
  const notesVal = workerProfile?.notes ?? "";

  return (
    <div className="space-y-6 animate-fade-in" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Intro Banner */}
      <div className="p-6 rounded-3xl bg-indigo-950/25 border border-indigo-500/15 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-right flex-1 space-y-1">
          <div className="flex items-center gap-2 justify-end md:justify-start flex-row-reverse">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[10.5px] font-black uppercase">
              {isRtl ? "عقد العمل النشط" : "Active Employment Agreement"}
            </span>
            <h2 className="text-xl font-extrabold text-white">
              {isRtl ? "مرحباً بك،" : "Greetings,"} {session.username}
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isRtl 
              ? "مساحتك المهنية المخصصة لمتابعة المستحقات المالية، شروط التعاقد، وتقديم تقارير الحضور والمصاريف المباشرة للمدير."
              : "Your dedicated dashboard to review salary schemes, contractual work schedules, and submit real-time reports."}
          </p>
        </div>
        <div className="p-3 bg-indigo-950 rounded-2xl border border-indigo-500/30 text-center select-none w-full md:w-auto min-w-[160px]">
          <span className="block text-[10px] uppercase font-bold tracking-wider text-indigo-400 mb-0.5">{isRtl ? "المنصب الوظيفي" : "Role Title"}</span>
          <span className="block font-black text-sm text-white">💼 {session.jobTitle || (isRtl ? "موظف مبيعات" : "Specialist")}</span>
        </div>
      </div>

      {/* Main Grid: Contracts & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Box 1: Read-Only Contract & Salary Data (Cols occupies 2 slots on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-5 space-y-4">
            
            <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
              <span className="text-[10px] text-slate-500 font-mono">ID: {session.userId?.substring(0, 8) || "N/A"}</span>
              <h3 className="text-xs font-black text-white flex items-center gap-2 justify-end">
                <span>{isRtl ? "تفاصيل التعويض والمستحقات (تحت العقد)" : "Salary Regulations & Compensation Details"}</span>
                <HeartHandshake className="text-emerald-450 w-4 h-4" />
              </h3>
            </div>

            {/* Financial indicators widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="bg-[#121214] border border-[#1d1d20] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <DollarSign className="text-emerald-500 w-5 h-5 mb-1.5" />
                <span className="text-[10px] text-zinc-450 font-bold">{isRtl ? "الراتب الأساسي الشهري" : "Base Monthly Salary"}</span>
                <span className="text-base font-black text-white mt-0.5">{monthlySalaryVal.toLocaleString()} {currencyLabel}</span>
              </div>

              <div className="bg-[#121214] border border-[#1d1d20] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <TrendingUp className="text-indigo-500 w-5 h-5 mb-1.5" />
                <span className="text-[10px] text-zinc-450 font-bold">{isRtl ? "معدل الساعة الإضافية" : "Overtime Rate (Hour)"}</span>
                <span className="text-sm font-black text-indigo-400 mt-0.5">+{overtimeRateVal.toLocaleString()} {currencyLabel}</span>
              </div>

              <div className="bg-[#121214] border border-[#1d1d20] p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <ShieldAlert className="text-rose-500 w-5 h-5 mb-1.5" />
                <span className="text-[10px] text-zinc-450 font-bold">{isRtl ? "تخفيض الغياب اليومي" : "Daily Absence Penalty"}</span>
                <span className="text-sm font-black text-rose-450 mt-0.5">-{absenceRateVal.toLocaleString()} {currencyLabel}</span>
              </div>

            </div>

            {/* General scheduling properties list */}
            <div className="bg-[#121214] border border-[#1d1d20] p-4 rounded-2xl text-xs space-y-3">
              <span className="block font-black text-slate-300 border-b border-[#1c1c1f] pb-1.5">{isRtl ? "بروتوكول الحضور والدوام:" : "Attendance Rules & Shift Schedule:"}</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 leading-loose text-slate-350">
                <div className="flex justify-between items-center sm:flex-row-reverse">
                  <span>{isRtl ? "ساعات العمل اليومية:" : "Daily Working Hours:"}</span>
                  <strong className="text-white font-mono">{dailyHoursVal} {isRtl ? "ساعات / يوم" : "hrs/day"}</strong>
                </div>

                <div className="flex justify-between items-center sm:flex-row-reverse">
                  <span>{isRtl ? "بروتوكول الساعات الأسبوعي:" : "Working Days Per Month:"}</span>
                  <strong className="text-white font-mono">{workingDaysVal} {isRtl ? "أيام عادية / شهر" : "days/month"}</strong>
                </div>
              </div>

              {notesVal && (
                <div className="border-t border-[#1c1c1f] pt-3 mt-3">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-rose-500 mb-1">{isRtl ? "ملاحظات إدارية ملحقة بالعقد" : "Company Notes & Directives"}</span>
                  <p className="text-xs text-slate-400 bg-black/40 p-2.5 rounded-lg border border-[#27272a] leading-relaxed">
                    {notesVal}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-rose-500/5 text-rose-400 border border-rose-500/20 p-3 rounded-2xl text-[11px] leading-relaxed">
              <AlertCircle size={15} className="shrink-0 text-rose-500" />
              <span>
                {isRtl 
                  ? "تنبيه الأمان: بيانات هذا العقد والراتب للقراءة فقط. يرجى التواصل التام مع المالك أو إدارة الموارد البشرية لطلب تعديلات على الامتيازات التعاقدية."
                  : "Security Advisory: Compensation schema is read-only. Contact the Company Owner or HR representative to submit modification queries."}
              </span>
            </div>

          </div>
        </div>

        {/* Box 2: Submissions Console Form */}
        <div>
          <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-black text-white flex items-center gap-2 justify-end border-b border-[#27272a] pb-3">
              <span>{isRtl ? "بوابة الإبلاغ الذاتي السري" : "Self-Reporting Deck"}</span>
              <Send className="text-indigo-400 w-4 h-4" />
            </h3>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              
              {/* Type Category Selection */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5">{isRtl ? "تصنيف الإبلاغ *" : "Submission Category *"}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSubType("overtime"); setAmount(0); }}
                    className={`py-2 px-1 rounded-xl text-center font-bold border transition-all text-[11px] ${
                      subType === "overtime"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-455"
                        : "bg-[#121214] border-[#1d1d20] text-slate-400 hover:border-slate-705"
                    }`}
                  >
                    🚀 {isRtl ? "إضافي" : "Overtime"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubType("expense"); setAmount(0); }}
                    className={`py-2 px-1 rounded-xl text-center font-bold border transition-all text-[11px] ${
                      subType === "expense"
                        ? "bg-emerald-600/10 border-emerald-500 text-emerald-450"
                        : "bg-[#121214] border-[#1d1d20] text-slate-400 hover:border-slate-705"
                    }`}
                  >
                    💰 {isRtl ? "مصاريف" : "Expenses"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubType("absence"); setAmount(0); }}
                    className={`py-2 px-1 rounded-xl text-center font-bold border transition-all text-[11px] ${
                      subType === "absence"
                        ? "bg-rose-600/10 border-rose-500 text-rose-455"
                        : "bg-[#121214] border-[#1d1d20] text-slate-400 hover:border-slate-705"
                    }`}
                  >
                    📅 {isRtl ? "غياب" : "Absence"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubType("missing_hours"); setAmount(0); }}
                    className={`py-2 px-1 rounded-xl text-center font-bold border transition-all text-[11px] ${
                      subType === "missing_hours"
                        ? "bg-amber-600/10 border-amber-500 text-amber-500"
                        : "bg-[#121214] border-[#1d1d20] text-slate-400 hover:border-slate-705"
                    }`}
                  >
                    ⏰ {isRtl ? "تأخر/ضائعة" : "Lost Hours"}
                  </button>
                </div>
              </div>

              {/* Amount value */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5">
                  {subType === "overtime" && (isRtl ? "عدد ساعات المداومة الإضافية *" : "Additional Worked Hours *")}
                  {subType === "missing_hours" && (isRtl ? "عدد ساعات الخروج / التأخر *" : "Amount of Lost/Deficit Hours *")}
                  {subType === "absence" && (isRtl ? "عدد أيام الغياب الكاملة *" : "Absence Days count *")}
                  {subType === "expense" && (isRtl ? "قيمة الفواتير والمصاريف (دج) *" : "Expense Balance amount *")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder={subType === "expense" ? "8000" : "2"}
                    className="w-full p-2.5 bg-[#09090b] border border-[#27272a] text-white font-mono rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-right pr-12"
                  />
                  <span className="absolute left-3 top-2.5 text-[10px] text-slate-450 font-bold">
                    {subType === "expense" ? (isRtl ? "دج" : "DZD") : subType === "absence" ? (isRtl ? "أيام" : "days") : (isRtl ? "ساعة" : "hrs")}
                  </span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5">{isRtl ? "تاريخ الواقعة *" : "Event Date *"}</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-[#09090b] border border-[#27272a] text-white font-mono rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-right"
                />
              </div>

              {/* Description specs */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5">
                  {subType === "expense" ? (isRtl ? "بيان تفاصيل المقتنيات أو الفاتورة *" : "Details of invoice bought *") : (isRtl ? "السبب المبرر أو شرح الظروف *" : "Context/Justification *")}
                </label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    subType === "expense" 
                      ? (isRtl ? "مثال: شراء بنزين للسيارة (2500 دج) + فليكسي خدمة (500 دج)" : "e.g. Fuel purchase for transport + service SIM card flexy")
                      : (isRtl ? "اكتب هنا تفاصيل المطلب، وقت التأخر، أو مبررات الغياب التفصيلية..." : "Context regarding this attendance adjustment...")
                  }
                  rows={3}
                  className="w-full bg-[#09090b] border border-[#27272a] p-2.5 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-right placeholder-slate-650 resize-y"
                />
              </div>

              {/* Submit report button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Send size={13} />
                <span>{isSubmitting ? (isRtl ? "جاري الإرسال بطلب..." : "Delivering...") : (isRtl ? "إرسال التقرير للمدير" : "Submit to Company Owner")}</span>
              </button>

            </form>
          </div>
        </div>

      </div>

      {/* Box 3: History Timeline Logs */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-3xl p-5 space-y-4">
        
        <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
          <span className="text-[10px] font-mono text-zinc-500 bg-[#121214] px-2.5 py-0.5 rounded-full">
            {submissions.length} {isRtl ? "تقارير مقدمة" : "total filings"}
          </span>
          <h3 className="text-xs font-black text-white flex items-center gap-2 justify-end">
            <span>{isRtl ? "سجل التقارير والإبلاغات السابقة وحالة الموافقة" : "Your Filed Submissions & Tracking Pipeline"}</span>
            <Calendar className="text-zinc-400 w-4 h-4" />
          </h3>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs leading-loose">
            <p>📭 {isRtl ? "لم تقم بتقديم أي تقارير أو كشوف حتى الآن." : "No reports have been filed by your account for the current company."}</p>
            <p className="text-[10px] text-slate-500">
              {isRtl 
                ? "استخدم الخيار أعلاه لإرسال كشف ساعات إضافية أو تعويض مصاريف فوري." 
                : "Choose a category on the right to log your extra hours, absences, or field receipts."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs gap-y-2 border-collapse">
              <thead>
                <tr className="border-b border-[#27272a] text-zinc-450 text-[11px] select-none">
                  <th className="p-3 text-right">{isRtl ? "تاريخ الواقعة" : "Event Date"}</th>
                  <th className="p-3 text-right">{isRtl ? "نوع الإبلاغ" : "Filing Type"}</th>
                  <th className="p-3 text-right">{isRtl ? "الكمية / المبلغ" : "Amount / Claim"}</th>
                  <th className="p-3 text-right">{isRtl ? "التبرير والبيان التفصيلي" : "Justification & Details"}</th>
                  <th className="p-3 text-center">{isRtl ? "الحالة" : "Verification Status"}</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18181b]">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-zinc-950/40 transition-colors">
                    <td className="p-3 text-zinc-300 font-mono text-[11px] whitespace-nowrap">{sub.date}</td>
                    <td className="p-3 font-semibold text-white">
                      {isRtl ? getSubLabelAr(sub.type) : getSubLabelEn(sub.type)}
                    </td>
                    <td className="p-3 font-bold font-mono">
                      {sub.type === "expense" ? (
                        <span className="text-emerald-450">{sub.amount.toLocaleString()} {currencyLabel}</span>
                      ) : sub.type === "absence" ? (
                        <span className="text-rose-455">{sub.amount} {isRtl ? "أيام" : "days"}</span>
                      ) : sub.type === "missing_hours" ? (
                        <span className="text-amber-500">{sub.amount} {isRtl ? "ساعة" : "hrs"}</span>
                      ) : (
                        <span className="text-indigo-400">{sub.amount} {isRtl ? "ساعة إضافية" : "hrs"}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 leading-normal max-w-sm truncate" title={sub.description}>
                      {sub.description}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">{getStatusBadge(sub.status)}</td>
                    <td className="p-3 text-left">
                      {sub.status === "pending" ? (
                        <button
                          onClick={() => handleDeletePending(sub.id, sub.type)}
                          className="p-1.5 bg-rose-500/10 border border-rose-500/25 text-rose-450 rounded-lg hover:bg-rose-500/20 hover:text-white transition-all cursor-pointer"
                          title={isRtl ? "سحب وإلغاء هذا الطلب" : "Withdraw pending report"}
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 block select-none">
                          {isRtl ? "مغلق" : "Locked"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
export default MyProfileView;
