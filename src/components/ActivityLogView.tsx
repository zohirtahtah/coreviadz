import React, { useState, useEffect } from "react";
import { 
  History, Search, Filter, Calendar, FileText, ChevronRight, RefreshCw, Trash2, Watch, ArrowRight, CornerDownLeft
} from "lucide-react";
import { LanguageType } from "../types";
import { ActivityLogEntry, getActivityLogs, filterActivityLogs } from "../activityLogService";

interface ActivityLogViewProps {
  lang: LanguageType;
  session: any;
  onTriggerNotification: (msg: string) => void;
}

export default function ActivityLogView({
  lang,
  session,
  onTriggerNotification
}: ActivityLogViewProps) {
  const isRtl = lang === "ar";
  const companyId = session?.company_id || "cop_default";

  // State Management
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [pageFilter, setPageFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detailed Log Inspector Item
  const [activeInspectorItem, setActiveInspectorItem] = useState<ActivityLogEntry | null>(null);

  const loadLogsList = async () => {
    setIsLoading(true);
    try {
      const data = await getActivityLogs(companyId);
      setLogs(data);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogsList();
  }, [companyId]);

  // Compute filtered log records
  const filteredRecords = React.useMemo(() => {
    return filterActivityLogs(logs, {
      searchTerm,
      actionType: actionFilter,
      page: pageFilter,
      timeRange,
      startDate,
      endDate
    });
  }, [logs, searchTerm, actionFilter, pageFilter, timeRange, startDate, endDate]);

  // Get distinct Action Types & Pages for filter dropdowns mapping
  const actionTypesList = React.useMemo(() => {
    const list = new Set<string>();
    logs.forEach(log => { if (log.actionType) list.add(log.actionType); });
    return Array.from(list);
  }, [logs]);

  const pagesList = React.useMemo(() => {
    const list = new Set<string>();
    logs.forEach(log => { if (log.pageName) list.add(log.pageName); });
    return Array.from(list);
  }, [logs]);

  // Helper for rendering values prettified JSON
  const renderPrettifiedChange = (val?: string) => {
    if (!val) return "--";
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === "object") {
        return (
          <pre className="text-[10px] font-mono text-slate-350 bg-slate-950 p-2 rounded-lg text-right max-h-36 overflow-y-auto overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      }
    } catch (e) {
      // Just plain text
    }
    return <span className="font-mono text-slate-300 font-medium">{val}</span>;
  };

  return (
    <div className="space-y-4 pt-16 md:pt-4 text-right" id="activity_center_viewport">
      
      {/* HEADER BAR */}
      <div className={`p-4 bg-[#0a0a0c] border border-[#27272a] rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${isRtl ? "text-right" : "text-left"}`}>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5 justify-end">
            <span>📜 {isRtl ? "سجل عمليات الشركة" : "Company Activity Center"}</span>
          </h1>
          <p className="text-[10.5px] text-slate-400 mt-1 lines-relaxed">
            {isRtl 
              ? "مصفوفة توثيق لحظية ومتكاملة لكافة الإجراءات والعمليات المنفذة من طرف المالك والموظفين داخل المنصة."
              : "A real-time tamper-proof audit trail documenting all user modifications, invoices, inventory transactions and orders."}
          </p>
        </div>

        <button
          onClick={loadLogsList}
          className="px-3.5 py-1.8 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>{isRtl ? "تحديث السجلات" : "Refresh Audit Logs"}</span>
        </button>
      </div>

      {/* FILTER CONTROLS GRID */}
      <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 space-y-4 text-xs font-sans">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* 1. Search Username or Product etc */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold">{isRtl ? "البحث بـاسم الموظف أو الوصف" : "Search User or Detail"}</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRtl ? "ابحث باسم المستخدم، الوظيفة..." : "Search user, record id..."}
                className="w-full bg-[#040406] border border-[#27272a] p-2 pr-8 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-3" />
            </div>
          </div>

          {/* 2. Action filter dropdown */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold">{isRtl ? "نوع العملية (Action)" : "Action Category"}</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-[#040406] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs pr-7 text-right"
            >
              <option value="all">{isRtl ? "جميع العمليات" : "All Actions"}</option>
              {actionTypesList.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {/* 3. Page Name filter dropdown */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold">{isRtl ? "القسم / الصفحة" : "Target Workspace Page"}</label>
            <select
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              className="w-full bg-[#040406] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs pr-7 text-right"
            >
              <option value="all">{isRtl ? "جميع الأقسام" : "All Pages"}</option>
              {pagesList.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {/* 4. Chronological range */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold">{isRtl ? "الفترة الزمنية" : "Timeframe Horizon"}</label>
            <select
              value={timeRange}
              onChange={(e: any) => setTimeRange(e.target.value)}
              className="w-full bg-[#040406] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs pr-7 text-right"
            >
              <option value="all">{isRtl ? "كل السجل التاريخي" : "Entire Audit History"}</option>
              <option value="today">{isRtl ? "اليوم" : "Today only"}</option>
              <option value="week">{isRtl ? "هذا الأسبوع (آخر 7 أيام)" : "This Week"}</option>
              <option value="month">{isRtl ? "هذا الشهر (آخر 30 يوم)" : "This Month"}</option>
              <option value="custom">{isRtl ? "نطاق تاريخي مخصص" : "Custom Date Range"}</option>
            </select>
          </div>

        </div>

        {/* CUSTOM RANGE PICKERS */}
        {timeRange === "custom" && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-900 border-dashed animate-fade-in text-xs">
            <div className="space-y-1 text-right">
              <label className="text-slate-400 font-bold">{isRtl ? "تاريخ النهاية" : "End Date"}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#040406] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-center text-xs"
              />
            </div>
            <div className="space-y-1 text-right">
              <label className="text-slate-400 font-bold">{isRtl ? "تاريخ البداية" : "Start Date"}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#040406] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-center text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* CORE LOGS GRID */}
      {isLoading && filteredRecords.length === 0 ? (
        <div className="text-center py-20 bg-[#09090b] border border-[#27272a] rounded-xl">
          <RefreshCw className="w-10 h-10 text-rose-500 animate-spin mx-auto mb-4" />
          <p className="text-xs text-slate-400 font-semibold">{isRtl ? "جاري جلب وفهرسة وتزامن السجل السحابي..." : "Syncing security logs with cloud metadata ledger..."}</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20 bg-[#09090b] border border-[#27272a] rounded-xl p-6">
          <History className="w-12 h-12 text-slate-650 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">{isRtl ? "سجل العمليات فارغ حالياً" : "No Activity Records Match"}</h3>
          <p className="text-xs text-slate-450 mt-1.5 max-w-md mx-auto">
            {isRtl 
              ? "لم نجد أي عمليات مسجّلة توافق معايير البحث المحددة. سيتم تزويدك هنا بالتسلسلات الإجرائية بمجرد تفعيلها."
              : "Any changes to orders, client listings, and catalog records will formulate an automated tracking point in this panel."}
          </p>
        </div>
      ) : (
        <div className="bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden">
          <div className="p-3 bg-[#0a0a0c] border-b border-[#27272a] text-slate-400 font-bold text-[10.5px] flex justify-between items-center">
            <span className="font-mono text-slate-300">
              {filteredRecords.length} / {logs.length} {isRtl ? "عمليات مؤرشفة" : "total records logged"}
            </span>
            <span>{isRtl ? "الأرشيف الإجرائي العام" : "Total General Audit Trail Roster"}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse" style={{ direction: isRtl ? "rtl" : "ltr" }}>
              <thead>
                <tr className="border-b border-[#27272a] text-slate-400 bg-slate-950/60">
                  <th className="p-3 font-semibold text-center">{isRtl ? "التاريخ والوقت" : "Date & Time"}</th>
                  <th className="p-3 font-semibold text-center">{isRtl ? "المستخدم المسؤول" : "Responsible Agent"}</th>
                  <th className="p-3 font-semibold text-center">{isRtl ? "نوع الإجراء (Action)" : "Action Conducted"}</th>
                  <th className="p-3 font-semibold text-center">{isRtl ? "الصفحة المحددة" : "System Section"}</th>
                  <th className="p-3 font-semibold text-center">{isRtl ? "السجل المعني" : "Affected Item"}</th>
                  <th className="p-3 font-semibold text-center">{isRtl ? "تفاصيل" : "Payload Metadata"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((log) => {
                  const hasValues = !!(log.previousValue || log.newValue);
                  return (
                    <tr key={log.id} className="border-b border-[#1c1c1f] hover:bg-white/[0.01] transition-all">
                      
                      {/* DateTime Stamp */}
                      <td className="p-3 text-center space-y-0.5">
                        <div className="text-white font-mono font-bold text-[11px]">{log.date}</div>
                        <div className="text-slate-450 font-mono text-[10px]">⏱️ {log.time}</div>
                      </td>

                      {/* Agent user profile */}
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-slate-200 font-black">{log.userName}</span>
                          <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-[#121214] border border-[#27272a]/40 rounded mt-0.5">
                            {log.jobTitle}
                          </span>
                        </div>
                      </td>

                      {/* Action Operation Name */}
                      <td className="p-3 text-center font-bold">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] border ${
                          log.actionType.includes("Create") || log.actionType.includes("Reactivate") || log.actionType.includes("Login")
                            ? "bg-emerald-950 text-emerald-400 border-emerald-900/40"
                            : log.actionType.includes("Update") || log.actionType.includes("Status Changes")
                            ? "bg-amber-950 text-amber-400 border-amber-900/40"
                            : log.actionType.includes("Delete") || log.actionType.includes("Suspend")
                            ? "bg-rose-950 text-rose-450 border-rose-900/40"
                            : "bg-slate-900 text-slate-350 border-slate-800"
                        }`}>
                          {log.actionType}
                        </span>
                      </td>

                      {/* Section page */}
                      <td className="p-3 text-center text-slate-300 font-medium">
                        💼 {log.pageName}
                      </td>

                      {/* Affected record content */}
                      <td className="p-3 text-center font-semibold text-slate-100 font-mono text-[11.5px] max-w-[200px] truncate">
                        {log.affectedRecord}
                      </td>

                      {/* Details inspect */}
                      <td className="p-3 text-center">
                        {hasValues ? (
                          <button
                            onClick={() => setActiveInspectorItem(log)}
                            className="bg-[#141416] text-[#ff4e79] border border-[#27272a] hover:bg-[#1c1c1f] hover:text-[#ff3a69] transition-all px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                          >
                            {isRtl ? "فحص التغييرات 👁️" : "Audit Diff 👁️"}
                          </button>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYLOAD DETAILED INSPECTOR DIALOG MODAL */}
      {activeInspectorItem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in text-right">
          <div className="w-full max-w-2xl bg-[#0c0c0e] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden" id="log_diff_modal">
            
            {/* Ambient accent background */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-indigo-500 to-[#ff4e79]" />

            <div className="flex justify-between items-center border-b border-[#27272a] pb-4 mb-4">
              <button
                onClick={() => setActiveInspectorItem(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-[#1a1a1c] rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 justify-end">
                <span>{isRtl ? "مقارنة فروقات وتغييرات السجل" : "Log Changes Diff Inspector"}</span>
                <span>📋</span>
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Meta brief */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111113] p-3 rounded-xl border border-[#27272a]">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isRtl ? "الوقت والتاريخ" : "Timestamp"}</span>
                  <strong className="text-white font-mono text-[10.5px]">{activeInspectorItem.date} {activeInspectorItem.time}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isRtl ? "المستخدم المسؤول" : "Responsible"}</span>
                  <strong className="text-white text-[10.5px]">{activeInspectorItem.userName} ({activeInspectorItem.jobTitle})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isRtl ? "الفئة الإجرائية" : "Operation"}</span>
                  <strong className="text-amber-450 text-[10.5px]">{activeInspectorItem.actionType}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isRtl ? "السجل المعني" : "Affected Item"}</span>
                  <strong className="text-white font-mono text-[10.5px] truncate block">{activeInspectorItem.affectedRecord}</strong>
                </div>
              </div>

              {/* Comparing previous and new records */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                
                {/* Previous Value Column */}
                <div className="space-y-1.5 text-right">
                  <span className="text-slate-400 font-bold flex items-center gap-1 justify-end">
                    <span>{isRtl ? "القيمة والأبعاد السابقة (Before)" : "Previous State (Before)"}</span>
                    <span className="text-slate-500 font-normal">🔴</span>
                  </span>
                  <div className="bg-[#141416]/80 p-3 rounded-xl border border-rose-900/10 min-h-[150px] overflow-auto">
                    {renderPrettifiedChange(activeInspectorItem.previousValue)}
                  </div>
                </div>

                {/* New Value Column */}
                <div className="space-y-1.5 text-right">
                  <span className="text-slate-400 font-bold flex items-center gap-1 justify-end">
                    <span>{isRtl ? "القيمة والأبعاد الجديدة (After)" : "New State (After)"}</span>
                    <span className="text-emerald-500 font-normal">🟢</span>
                  </span>
                  <div className="bg-[#141416]/80 p-3 rounded-xl border border-emerald-900/10 min-h-[150px] overflow-auto">
                    {renderPrettifiedChange(activeInspectorItem.newValue)}
                  </div>
                </div>

              </div>
              
              <div className="flex items-center justify-between border-t border-[#27272a] pt-4 mt-2">
                <span className="text-[10px] text-slate-450 italic">
                  {isRtl ? "البيانات المسجلة أعلاه تعتبر دليلاً قانونياً مؤرشفاً في النظام." : "The immutable logs above constitute the official workspace metadata audit trails."}
                </span>
                <button
                  onClick={() => setActiveInspectorItem(null)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isRtl ? "إغلاق نافذة العرض" : "Close Inspector"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
