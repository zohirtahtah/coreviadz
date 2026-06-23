import React, { useState, useMemo, useEffect, useRef } from "react";
import { Worker, LanguageType, Order, Expense } from "../types";
import { 
  Users, Plus, Calendar, Search, Trash2, Printer, Edit2, 
  X, Check, DollarSign, Clock, Phone, AlertCircle, CheckCircle2, Trash, 
  ChevronLeft, Sparkles, TrendingUp, TrendingDown, Undo2, Award, FileText,
  XCircle
} from "lucide-react";
import { EmployeeSubmission, getSubmissions, saveSubmission } from "../employeeSubmissionsService";
import { supabase } from "../supabaseClient";

import { cleanArabicName, cleanPhoneDigits } from "./UsersPermissionsView";
import { calculateWorkerPayroll } from "../supabaseSync";

interface WorkersViewProps {
  workers: Worker[];
  onSaveWorkers: (arr: Worker[]) => void;
  lang: LanguageType;
  onSoftDeleteWorker: (id: string) => void;
  onDeleteEntireWorkerProfile?: (code: string) => void;
  onTriggerNotification: (msg: string, type?: "success" | "info" | "warning") => void;
  orders?: Order[];
  onSectionChange?: (tab: string) => void;
  session?: any;
}

// 2.1 الدوال المساعدة العامة
export const calcDailyWage = (salary: number, workingDaysCount = 22) => {
  return salary / (workingDaysCount || 22);
};

export const calcHourlyWage = (salary: number, dailyHours: number, workingDaysCount = 22) => {
  return (salary / (workingDaysCount || 22)) / (dailyHours || 8);
};

// 2.2 المكون الداخلي: UndoToast
interface UndoToastProps {
  workerName: string;
  onUndo: () => void;
  onClose: () => void;
}

const UndoToast: React.FC<UndoToastProps> = ({ workerName, onUndo, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 5) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-6 z-50 bg-[#09090b] border border-[#27272a] shadow-2xl rounded-2xl p-4 flex flex-col gap-2 min-w-[320px] animate-fade-in text-right" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300 font-medium">تم حذف الموظف: <b className="text-white">{workerName}</b></span>
        <button 
          onClick={onUndo}
          className="flex items-center gap-1 px-3 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          <Undo2 size={12} />
          <span>تراجع</span>
        </button>
      </div>
      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
        <div className="h-full bg-indigo-500 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

// English / Arabic Month Names
const monthNamesAr = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const monthNamesFr = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const monthNamesEn = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const WorkersView: React.FC<WorkersViewProps> = ({
  workers = [],
  onSaveWorkers,
  lang,
  onSoftDeleteWorker,
  onDeleteEntireWorkerProfile,
  onTriggerNotification,
  orders = [],
  onSectionChange,
  session
}) => {
  const isRtl = lang === "ar";
  const currencyLabel = "دج";

  // Filter values
  const today = new Date();
  const [monthFilter, setMonthFilter] = useState<number>(today.getMonth());
  const [yearFilter, setYearFilter] = useState<number>(today.getFullYear());
  const [searchQuery, setSearchQuery] = useState("");

  // UI state managers
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedMonthsToDelete, setSelectedMonthsToDelete] = useState<string[]>([]);
  const [showCalc, setShowCalc] = useState<string | null>(null); // holds worker code

  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalCode, setPayModalCode] = useState("");
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<string[]>([]); // worker IDs list

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState<number>(0);
  const [newExpDate, setNewExpDate] = useState("");

  const [showYearlySummary, setShowYearlySummary] = useState(false);
  const [lastDeletedWorker, setLastDeletedWorker] = useState<any | null>(null);

  // Employee approval workflow states
  const [showEmployeeFilings, setShowEmployeeFilings] = useState(false);
  const [employeeSubmissions, setEmployeeSubmissions] = useState<any[]>([]);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubAmount, setEditSubAmount] = useState<number>(0);

  // Load all submissions for this company
  const loadAllSubmissions = async () => {
    try {
      let companyIdValue = "";
      const stored = localStorage.getItem("corevia_session_v1") || localStorage.getItem("corevia_user_session_v1");
      if (stored) {
        companyIdValue = JSON.parse(stored).company_id || "";
      }
      if (companyIdValue) {
        const data = await getSubmissions(companyIdValue);
        setEmployeeSubmissions(data);
      }
    } catch (err) {
      console.warn("Failed loading company employee self-filings:", err);
    }
  };

  useEffect(() => {
    loadAllSubmissions();
  }, [showEmployeeFilings]);

  useEffect(() => {
    if (deleteConfirm) {
      setSelectedMonthsToDelete([deleteConfirm]);
    } else {
      setSelectedMonthsToDelete([]);
    }
  }, [deleteConfirm]);

  // Core Submission Approval
  const handleApproveSubmissionInWorkersList = (sub: any, adjustedAmount?: number) => {
    const finalAmount = adjustedAmount !== undefined ? adjustedAmount : sub.amount;

    // Resolve date parts
    const subDate = new Date(sub.date);
    const subMonth = isNaN(subDate.getTime()) ? monthFilter : subDate.getMonth();
    const subYear = isNaN(subDate.getTime()) ? yearFilter : subDate.getFullYear();

    // 1. Copy the current workers list
    const listCopy = [...workers];

    // 2. Find matching monthly worker record
    let worker = listCopy.find(w => 
      ((w as any).month === subMonth && (w as any).year === subYear) &&
      (w.id === sub.employeeId || w.name.toLowerCase().trim() === sub.employeeName.toLowerCase().trim())
    );

    if (!worker) {
      // Find standard base roster record for this worker
      const baseObj = listCopy.find(w => w.id === sub.employeeId || w.name.toLowerCase().trim() === sub.employeeName.toLowerCase().trim());
      if (baseObj) {
        // Build new monthly clones
        const dates = fillDates(subMonth, subYear);
        const newId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        worker = {
          ...baseObj,
          id: newId,
          month: subMonth,
          year: subYear,
          payPeriodStart: dates.start,
          payPeriodEnd: dates.end,
          overtimeHours: 0,
          missingHours: 0,
          absenceDays: 0,
          expenses: [],
          payrolls: [{
            id: `pay-${newId}`,
            payPeriod: `${monthNamesEn[subMonth]} ${subYear}`,
            datePaid: "",
            baseSalary: baseObj.baseSalary,
            overtimeHours: 0,
            overtimeEarned: 0,
            bonus: 0,
            absenceDays: 0,
            absenceDeductions: 0,
            cashAdvances: 0,
            otherDeductions: 0,
            netSalary: Math.round(baseObj.baseSalary),
            released: false
          }]
        };
        listCopy.push(worker);
      } else {
        // Create absolute fallback profile
        const dates = fillDates(subMonth, subYear);
        const newId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        worker = {
          id: newId,
          name: sub.employeeName,
          code: "W-" + sub.employeeId.substring(0, 4),
          phone: "",
          role: "Employee",
          baseSalary: 35000,
          dailyHours: 8,
          overtimeRate: 250,
          createdAt: new Date().toISOString(),
          month: subMonth,
          year: subYear,
          payPeriodStart: dates.start,
          payPeriodEnd: dates.end,
          overtimeHours: 0,
          missingHours: 0,
          absenceDays: 0,
          expenses: [],
          payrolls: [{
            id: `pay-${newId}`,
            payPeriod: `${monthNamesEn[subMonth]} ${subYear}`,
            datePaid: "",
            baseSalary: 35000,
            overtimeHours: 0,
            overtimeEarned: 0,
            bonus: 0,
            absenceDays: 0,
            absenceDeductions: 0,
            cashAdvances: 0,
            otherDeductions: 0,
            netSalary: 35000,
            released: false
          }]
        } as any;
        listCopy.push(worker);
      }
    }

    // 3. Inject quantities directly into the resolved month sheet!
    if (sub.type === "overtime") {
      (worker as any).overtimeHours = ((worker as any).overtimeHours || 0) + finalAmount;
    } else if (sub.type === "missing_hours") {
      (worker as any).missingHours = ((worker as any).missingHours || 0) + finalAmount;
    } else if (sub.type === "absence") {
      (worker as any).absenceDays = ((worker as any).absenceDays || 0) + finalAmount;
    } else if (sub.type === "expense") {
      // Reimbursement expense record inside expenses list
      (worker as any).expenses = [
        ...((worker as any).expenses || []),
        {
          id: "EXP-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
          amount: finalAmount,
          desc: sub.description,
          date: sub.date
        }
      ];
    }

    // 4. Recalculate payroll netSalary for this record instantly!
    const basePayroll = worker.payrolls[0];
    if (basePayroll) {
      const otWage = ((worker as any).overtimeHours || 0) * (worker.overtimeRate || 250);
      const dw = calcDailyWage(worker.baseSalary);
      const hw = calcHourlyWage(worker.baseSalary, worker.dailyHours || 8);
      const absDed = ((worker as any).absenceDays || 0) * dw;
      const misDed = ((worker as any).missingHours || 0) * hw;
      const expDed = ((worker as any).expenses || []).reduce((sum: number, exItem: any) => sum + exItem.amount, 0);

      basePayroll.overtimeHours = (worker as any).overtimeHours;
      basePayroll.overtimeEarned = otWage;
      basePayroll.absenceDays = (worker as any).absenceDays;
      basePayroll.absenceDeductions = Math.round(absDed + misDed);
      basePayroll.otherDeductions = Math.round(expDed);
      basePayroll.netSalary = Math.max(0, Math.round(worker.baseSalary + otWage - (absDed + misDed + expDed)));
    }

    // 5. Fire saved callback to save and push to Cloud
    onSaveWorkers(listCopy);

    // 6. Update the submission status in storage/cloud
    const updatedSub = {
      ...sub,
      amount: finalAmount,
      status: "approved" as const
    };
    saveSubmission(updatedSub).then(() => {
      // Reload lists
      loadAllSubmissions();
      onTriggerNotification(
        isRtl 
          ? `🟢 تم بنجاح اعتماد الطلب وضمه لحساب راتب شهر (${subMonth + 1}-${subYear})!`
          : `🟢 Approved and compiled into paycheck details for month (${subMonth + 1}-${subYear})!`,
        "success"
      );
    });
  };

  // Rejection Handler
  const handleRejectSubmissionInWorkersList = (sub: any) => {
    const updatedSub = {
      ...sub,
      status: "rejected" as const
    };
    saveSubmission(updatedSub).then(() => {
      loadAllSubmissions();
      onTriggerNotification(
        isRtl ? "✗ تم رفض الطلب وتحديث الحالة للموظف." : "✗ Submission rejected successfully.",
        "info"
      );
    });
  };

  // References
  const formCache = useRef<Record<string, any>>({});
  const prevWorkerCode = useRef<string | null>(null);
  const autoCreated = useRef(false);

  // Form Field State Values
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("Sales Handler");
  const [formMonth, setFormMonth] = useState<number>(today.getMonth());
  const [formBaseSalary, setFormBaseSalary] = useState<number>(35000);
  const [formDailyHours, setFormDailyHours] = useState<number>(8);
  const [formOvertimeHours, setFormOvertimeHours] = useState<number>(0);
  const [formOvertimeRate, setFormOvertimeRate] = useState<number>(250);
  const [formMissingHours, setFormMissingHours] = useState<number>(0);
  const [formAbsenceDays, setFormAbsenceDays] = useState<number>(0);
  const [formExpenses, setFormExpenses] = useState<any[]>([]);
  const [formPaid, setFormPaid] = useState(false);
  const [formPaymentAmount, setFormPaymentAmount] = useState<number>(0);
  const [formPaymentDate, setFormPaymentDate] = useState("");
  // Login credentials for worker
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");

  // Labels helper
  const getsLabel = (lblAr: string, lblFr: string, lblEn: string) => {
    return lang === "ar" ? lblAr : lang === "fr" ? lblFr : lblEn;
  };

  const getMonthName = (idx: number) => {
    return getsLabel(monthNamesAr[idx], monthNamesFr[idx], monthNamesEn[idx]);
  };

  // Helper date fill
  const fillDates = (m: number, y: number) => {
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const formatDate = (d: Date) => {
      const yearStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const dStr = String(d.getDate()).padStart(2, "0");
      return `${yearStr}-${mStr}-${dStr}`;
    };
    return {
      start: formatDate(firstDay),
      end: formatDate(lastDay),
      days: lastDay.getDate()
    };
  };

  // Code Generator
  const getNextCode = () => {
    let max = 0;
    workers.forEach(w => {
      const num = parseInt(w.code.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > max) {
        max = num;
      }
    });
    return String(max + 1).padStart(3, "0");
  };

  // Synchronize expenses with `/expenses` tab
  const syncExpensesWithGeneralLedger = (
    workerCode: string, 
    workerName: string, 
    expensesList: any[],
    mIdx: number,
    yVal: number
  ) => {
    try {
      const stored = localStorage.getItem("corevia_unified_expenses_v1");
      let list: Expense[] = stored ? JSON.parse(stored) : [];
      
      const prefix = `wexp-sync-${workerCode}-`;
      // Remove all synced expenses for this worker
      list = list.filter(ex => !ex.id.startsWith(prefix));

      // Append newer entries
      const targetDates = fillDates(mIdx, yVal);
      const newEntries: Expense[] = expensesList.map(e => ({
        id: `${prefix}${e.id}`,
        title: `خصم/سلفة عامل - ${workerName} - ${e.desc}`,
        type: "variable",
        amount: e.amount,
        date: e.date || targetDates.start,
        notes: `كود العامل: ${workerCode} | ${monthNamesAr[mIdx]} ${yVal}`,
        createdAt: new Date().toISOString()
      }));

      const merged = [...newEntries, ...list];
      localStorage.setItem("corevia_unified_expenses_v1", JSON.stringify(merged));
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Expense synchronization error", err);
    }
  };

  // 9.2 Automatic background month creation disabled to prevent unwanted "Registered Months" increment on page refresh
  // Months are now created strictly via user request (e.g. clicking the "Next Month" button) or when manually adding/editing.

  // 11. حسابات الإحصائيات (Calculated Stats)
  const stats = useMemo(() => {
    let totalSalaries = 0;
    let totalOvertimePay = 0;
    let totalDeductions = 0;

    let grandSalaries = 0;
    let grandOT = 0;
    let grandDed = 0;

    let targetWorkers = workers;
    if (session?.role === "employee") {
      targetWorkers = workers.filter(w => 
        w.name.toLowerCase().trim() === session.username?.toLowerCase().trim() ||
        w.phone === session.phone
      );
    }

    targetWorkers.forEach(w => {
      const baseSalary = w.baseSalary || 0;
      const overtimeHours = (w as any).overtimeHours || 0;
      const overtimeRate = (w as any).overtimeRate || 250;
      const missingHours = (w as any).missingHours || 0;
      const absenceDays = (w as any).absenceDays || 0;
      const dailyHours = w.dailyHours || 8;
      const expensesList = (w as any).expenses || [];

      const recordOTPay = overtimeHours * overtimeRate;
      const dw = calcDailyWage(baseSalary);
      const hw = calcHourlyWage(baseSalary, dailyHours);

      const recordAbsDeduct = absenceDays * dw;
      const recordMisDeduct = missingHours * hw;
      const recordExpDeduct = expensesList.reduce((sum: number, e: any) => sum + e.amount, 0);
      const recordTotalDeduction = recordAbsDeduct + recordMisDeduct + recordExpDeduct;

      grandSalaries += baseSalary;
      grandOT += recordOTPay;
      grandDed += recordTotalDeduction;

      if ((w as any).month === monthFilter && (w as any).year === yearFilter) {
        totalSalaries += baseSalary;
        totalOvertimePay += recordOTPay;
        totalDeductions += recordTotalDeduction;
      }
    });

    return {
      totalSalaries,
      totalOvertimePay,
      totalDeductions,
      totalNet: Math.max(0, Math.round(totalSalaries + totalOvertimePay - totalDeductions)),
      grandSalaries,
      grandOT,
      grandDed,
      grandNet: Math.max(0, Math.round(grandSalaries + grandOT - grandDed))
    };
  }, [workers, monthFilter, yearFilter]);

  // Group and sort ascendingly
  const displayedWorkers = useMemo(() => {
    let targetWorkers = workers;
    if (session?.role === "employee") {
      targetWorkers = workers.filter(w => 
        w.name.toLowerCase().trim() === session.username?.toLowerCase().trim() ||
        w.phone === session.phone
      );
    }

    const uniqueCodes = Array.from(new Set(targetWorkers.map(w => w.code)));
    uniqueCodes.sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    const query = searchQuery.toLowerCase().trim();
    const list: any[] = [];

    uniqueCodes.forEach(code => {
      const currentRecord = targetWorkers.find(w => w.code === code && (w as any).month === monthFilter && (w as any).year === yearFilter);
      const fallback = targetWorkers.filter(w => w.code === code).sort((a,b) => ((b as any).year - (a as any).year) || ((b as any).month - (a as any).month))[0];
      const record = currentRecord || fallback;
      if (!record) return;

      if (query) {
        const matchName = record.name.toLowerCase().includes(query);
        const matchCode = record.code.toLowerCase().includes(query);
        if (!matchName && !matchCode) return;
      }
      list.push(record);
    });

    return list;
  }, [workers, monthFilter, yearFilter, searchQuery, session]);

  // Yearly aggregating summary
  const workerYearlyAverages = useMemo(() => {
    const map: Record<string, any> = {};
    workers.forEach(w => {
      const code = w.code;
      if (!map[code]) {
        map[code] = {
          code,
          name: w.name,
          monthsCount: 0,
          totalBase: 0,
          totalOT: 0,
          totalDed: 0,
          totalExpenses: 0,
          netSalary: 0
        };
      }
      const recordOTPay = ((w as any).overtimeHours || 0) * ((w as any).overtimeRate || 250);
      const recordDaily = calcDailyWage(w.baseSalary);
      const recordHourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
      const recordAbsDeduct = ((w as any).absenceDays || 0) * recordDaily;
      const recordMisDeduct = ((w as any).missingHours || 0) * recordHourly;
      const recordExpDeduct = ((w as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
      const recordTotalDeduction = recordAbsDeduct + recordMisDeduct + recordExpDeduct;

      const net = Math.max(0, Math.round(w.baseSalary + recordOTPay - recordTotalDeduction));

      const statsObj = map[code];
      statsObj.monthsCount += 1;
      statsObj.totalBase += w.baseSalary;
      statsObj.totalOT += recordOTPay;
      statsObj.totalDed += (recordAbsDeduct + recordMisDeduct);
      statsObj.totalExpenses += recordExpDeduct;
      statsObj.netSalary += net;
    });

    return Object.values(map);
  }, [workers]);

  // Dynamic deliveries counter linked with orders!
  const getOrdersCountForWorker = (workerName: string, targetMonth: number, targetYear: number) => {
    let delivered = 0;
    let returned = 0;
    orders.forEach(o => {
      if (o.agentName && o.agentName.trim().toLowerCase() === workerName.trim().toLowerCase()) {
        if (o.date) {
          const dObj = new Date(o.date);
          if (dObj.getMonth() === targetMonth && dObj.getFullYear() === targetYear) {
            if (o.status === "delivered") {
              delivered++;
            } else if (o.status === "returned") {
              returned++;
            }
          }
        }
      }
    });
    return { delivered, returned };
  };

  const getCumulativeOrdersCount = (workerName: string) => {
    let delivered = 0;
    let returned = 0;
    orders.forEach(o => {
      if (o.agentName && o.agentName.trim().toLowerCase() === workerName.trim().toLowerCase()) {
        if (o.status === "delivered") {
          delivered++;
        } else if (o.status === "returned") {
          returned++;
        }
      }
    });
    return { delivered, returned };
  };

  // 8. دوال الطباعة (Printing functions)
  // 8.1 طباعة القائمة الطولية للشهر
  const printWorkers = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const mLabel = getMonthName(monthFilter);
    const rtlAttr = isRtl ? 'dir="rtl"' : 'dir="ltr"';
    const monthWorkersList = workers.filter(w => (w as any).month === monthFilter && (w as any).year === yearFilter);

    win.document.write(`
      <html ${rtlAttr}>
      <head>
        <title>سجل أجور العمال - ${mLabel} ${yearFilter}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #111; }
          h1 { text-align: center; font-size: 19px; margin-bottom: 25px; border-bottom: 2px solid #ccc; padding-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border: 1px solid #aaa; padding: 9px; text-align: center; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .summary-pane { display: flex; justify-content: space-between; font-weight: bold; margin-top: 30px; border-top: 2px solid #222; padding-top: 15px; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>${isRtl ? `كشف تفصيل أجور العمال والموظفين لشهر ${mLabel} سنة ${yearFilter}` : `Staff Payroll Ledger for ${mLabel} ${yearFilter}`}</h1>
        <table>
          <thead>
            <tr>
              <th>${isRtl ? "كود" : "ID"}</th>
              <th>${isRtl ? "الاسم" : "Name"}</th>
              <th>${isRtl ? "الدور الإداري" : "Role"}</th>
              <th>${isRtl ? "الأجر الأساسي" : "Base Salary"}</th>
              <th>${isRtl ? "ساعات إضافية" : "Overtime Hours"}</th>
              <th>${isRtl ? "غياب (أيام)" : "Absences"}</th>
              <th>${isRtl ? "الساعات المتأخرة" : "Missing Hours"}</th>
              <th>${isRtl ? "قيمة المصاريف" : "Expenses"}</th>
              <th>${isRtl ? "صافي المقبوض" : "Final Net Pay"}</th>
              <th>${isRtl ? "الدفع" : "Paid Status"}</th>
            </tr>
          </thead>
          <tbody>
            ${monthWorkersList.map(w => {
              const otPay = ((w as any).overtimeHours || 0) * ((w as any).overtimeRate || 250);
              const daily = calcDailyWage(w.baseSalary);
              const hourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
              const absD = ((w as any).absenceDays || 0) * daily;
              const misD = ((w as any).missingHours || 0) * hourly;
              const expD = ((w as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
              const net = Math.max(0, Math.round(w.baseSalary + otPay - (absD + misD + expD)));

              return `
                <tr>
                  <td><b>${w.code}</b></td>
                  <td>${w.name}</td>
                  <td>${w.role || "Sales Handler"}</td>
                  <td>${w.baseSalary.toLocaleString()}</td>
                  <td>${(w as any).overtimeHours || 0}</td>
                  <td>${(w as any).absenceDays || 0}</td>
                  <td>${(w as any).missingHours || 0}</td>
                  <td>${expD.toLocaleString()}</td>
                  <td><strong>${net.toLocaleString()}</strong></td>
                  <td>${(w as any).paid ? (isRtl ? "✓ مدفوع" : "✓ Paid") : (isRtl ? "معلق" : "Unpaid")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <div class="summary-pane">
          <span>${isRtl ? "مجموع الأجور الأساسية:" : "Total Base Salaries:"} ${stats.totalSalaries.toLocaleString()} ${currencyLabel}</span>
          <span>${isRtl ? "صافي الرواتب المستحق:" : "Total Net Pay:"} ${stats.totalNet.toLocaleString()} ${currencyLabel}</span>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 450);
  };

  // 8.2 طباعة قسيمة فردية مفصلة
  const printWorkerDetail = (w: any) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const mLabel = getMonthName(w.month);
    const rtlAttr = isRtl ? 'dir="rtl"' : 'dir="ltr"';

    const otPay = (w.overtimeHours || 0) * (w.overtimeRate || 250);
    const daily = calcDailyWage(w.baseSalary);
    const hourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
    const absD = (w.absenceDays || 0) * daily;
    const misD = (w.missingHours || 0) * hourly;
    const expD = (w.expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
    const net = Math.max(0, Math.round(w.baseSalary + otPay - (absD + misD + expD)));

    win.document.write(`
      <html ${rtlAttr}>
      <head>
        <title>قسيمة الراتب - ${w.name}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 30px; line-height: 1.6; color: #111; }
          .holder { max-width: 600px; margin: 0 auto; border: 1px solid #222; padding: 25px; border-radius: 8px; }
          .header { text-align: center; border-b: 2px solid #111; padding-bottom: 12px; margin-bottom: 25px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 13px; margin-bottom: 25px; }
          .card { border: 1px solid #aaa; padding: 12px; rounded: 4px; background: #fafafa; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #aaa; padding: 8px; text-align: right; }
          th { background-color: #f3f3f3; }
          .net-pay { font-size: 17px; font-weight: bold; border: 2px solid #222; padding: 12px; margin-top: 25px; text-align: center; background: #f4f6ff; }
        </style>
      </head>
      <body>
        <div class="holder">
          <div class="header">
            <h2>${isRtl ? "كشف حساب الأجر الشهري للعامِل" : "Monthly Wages Settlement Slip"}</h2>
            <p>${mLabel} ${w.year || yearFilter}</p>
          </div>

          <div class="grid">
            <div class="card">
              <strong>${isRtl ? "معلومات الهوية:" : "Employee Profile:"}</strong><br>
              ${isRtl ? "الاسم:" : "Name:"} ${w.name}<br>
              ${isRtl ? "الرمز الجمركي:" : "Internal Code:"} <b>${w.code}</b><br>
              ${isRtl ? "الهاتف:" : "Phone:"} ${w.phone || "-"}<br>
              ${isRtl ? "العمل الموكل:" : "Assigned Role:"} ${w.role || "-"}
            </div>
            <div class="card">
              <strong>${isRtl ? "أسس التعريف والمعدل:" : "Base Rate Coefficients:"}</strong><br>
              ${isRtl ? "الراتب الأساسي:" : "Base Salary:"} ${w.baseSalary.toLocaleString()} ${currencyLabel}<br>
              ${isRtl ? "ساعات يومية:" : "Daily hours:"} ${w.dailyHours || 8}<br>
              ${isRtl ? "عائد العمل اليومي:" : "Daily Wage factor:"} ${daily.toFixed(1)} ${currencyLabel}<br>
              ${isRtl ? "عائد عمل ساعي:" : "Hourly Wage factor:"} ${hourly.toFixed(1)} ${currencyLabel}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: right;">${isRtl ? "بيان الرصيد والاستحقاق" : "Payment Breakdown Item"}</th>
                <th style="text-align: right;">${isRtl ? "القيمة المضافة (+)" : "Additions (+)"}</th>
                <th style="text-align: right;">${isRtl ? "القيمة المخصومة (-)" : "Deductions (-)"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>الراتب الأساسي الشهر</td>
                <td>${w.baseSalary.toLocaleString()} ${currencyLabel}</td>
                <td>-</td>
              </tr>
              ${otPay > 0 ? `
              <tr>
                <td>الساعات الإضافية (+ ${w.overtimeHours} ساعة دج ${w.overtimeRate})</td>
                <td style="color: green;">+${otPay.toLocaleString()} ${currencyLabel}</td>
                <td>-</td>
              </tr>
              ` : ""}
              ${absD > 0 ? `
              <tr>
                <td>أيام الغياب (- ${w.absenceDays} غيابات)</td>
                <td>-</td>
                <td style="color: red;">-${absD.toLocaleString()} ${currencyLabel}</td>
              </tr>
              ` : ""}
              ${misD > 0 ? `
              <tr>
                <td>الدقائق/ساعات ناقصة متأخرة (- ${w.missingHours} ساعة)</td>
                <td>-</td>
                <td style="color: red;">-${misD.toLocaleString()} ${currencyLabel}</td>
              </tr>
              ` : ""}
              ${expD > 0 ? `
              <tr>
                <td>سلف واقتطاع مصاريف داخلية</td>
                <td>-</td>
                <td style="color: red;">-${expD.toLocaleString()} ${currencyLabel}</td>
              </tr>
              ` : ""}
            </tbody>
          </table>

          <div class="net-pay">
            ${isRtl ? "الصافي النهائي المعتمد للدفع:" : "Approved Net Pay for Disbursement:"} ${net.toLocaleString()} ${currencyLabel}
            ${w.paid ? `<div style="font-size:11px; color:green; margin-top:5px;">(${isRtl ? "تم صرف هذا الحساب" : "This paycheck has been paid"} - ${w.paymentDate || ""})</div>` : ""}
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 450);
  };

  // 8.3 طباعة كل الشهور التوليفية لعامل معين
  const printWorkerAllMonths = (wCode: string) => {
    const win = window.open("", "_blank");
    if (!win) return;

    const rList = workers.filter(w => w.code === wCode);
    const name = rList[0]?.name || "-";
    const rtlAttr = isRtl ? 'dir="rtl"' : 'dir="ltr"';

    const summary = { base: 0, ot: 0, ded: 0, exp: 0, net: 0 };
    rList.forEach(w => {
      const otPay = ((w as any).overtimeHours || 0) * ((w as any).overtimeRate || 250);
      const daily = calcDailyWage(w.baseSalary);
      const hourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
      const absD = ((w as any).absenceDays || 0) * daily;
      const misD = ((w as any).missingHours || 0) * hourly;
      const expD = ((w as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
      const net = Math.max(0, Math.round(w.baseSalary + otPay - (absD + misD + expD)));

      summary.base += w.baseSalary;
      summary.ot += otPay;
      summary.ded += (absD + misD);
      summary.exp += expD;
      summary.net += net;
    });

    win.document.write(`
      <html ${rtlAttr}>
      <head>
        <title>سجل أجور العامل السنوي - ${name}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #111; }
          h1 { text-align: center; font-size: 19px; margin-bottom: 25px; border-bottom: 3px double #333; padding-bottom: 10px; }
          .summary-card { border: 2px solid #111; background-color: #fafafa; padding: 15px; rounded: 6px; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #999; padding: 10px; text-align: center; }
          th { background-color: #ebdff; background: #e3e8fc; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${isRtl ? `الملخص السنوي والدورة الكاملة للأجور للعامِل: ${name}` : `Annual Payroll Transcript Summary: ${name}`}</h1>
        <p><b>${isRtl ? "الرقم الجمركي للعامل:" : "Employee Code Identification:"}</b> ${wCode}</p>

        <div class="summary-card">
          <strong>إجمالي الحساب التراكمي للفترة:</strong><br>
          مجموع الرواتب الأساسية: ${summary.base.toLocaleString()} دج | 
          مجموع الساعات الإضافية المنجزة: +${summary.ot.toLocaleString()} دج | 
          مجموع الاقتطاعات والغياب: -${summary.ded.toLocaleString()} دج | 
          مجموع سحبيات المصاريف: -${summary.exp.toLocaleString()} دج | 
          <span style="font-size:14px; font-weight:bold; color: #1e3a8a;">الصافي الشامل المقبوض: ${summary.net.toLocaleString()} دج</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>الشهر والسنة</th>
              <th>العمل الموكل</th>
              <th>الراتب الأساسي</th>
              <th>قيمة الإضافي</th>
              <th>الغياب والجزاء</th>
              <th>المصاريف</th>
              <th>الصافي المقبوض كلياً</th>
              <th>حالة الصرف والاستحقاق</th>
            </tr>
          </thead>
          <tbody>
            ${rList.map(w => {
              const otPay = ((w as any).overtimeHours || 0) * ((w as any).overtimeRate || 250);
              const daily = calcDailyWage(w.baseSalary);
              const hourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
              const absD = ((w as any).absenceDays || 0) * daily;
              const misD = ((w as any).missingHours || 0) * hourly;
              const expD = ((w as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
              const net = Math.max(0, Math.round(w.baseSalary + otPay - (absD + misD + expD)));

              return `
                <tr>
                  <td><b>${getMonthName((w as any).month)} ${(w as any).year}</b></td>
                  <td>${w.role || "Sales Handler"}</td>
                  <td>${w.baseSalary.toLocaleString()}</td>
                  <td>+${otPay.toLocaleString()}</td>
                  <td>-${(absD + misD).toLocaleString()}</td>
                  <td>-${expD.toLocaleString()}</td>
                  <td><strong>${net.toLocaleString()}</strong></td>
                  <td>${(w as any).paid ? (isRtl ? "✓ تم الصرف" : "✓ Paid") : (isRtl ? "معلق" : "Unpaid")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 450);
  };

  // 8.4 Keyboard Shortcut: Key 'P' / 'p'
  useEffect(() => {
    const handleKeyShortcut = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        e.preventDefault();
        if (showCalc) {
          const rec = workers.find(w => w.code === showCalc && (w as any).month === monthFilter && (w as any).year === yearFilter) 
            || workers.filter(w => w.code === showCalc)[0];
          if (rec) printWorkerDetail(rec);
        } else {
          printWorkers();
        }
      }
    };
    window.addEventListener("keydown", handleKeyShortcut);
    return () => window.removeEventListener("keydown", handleKeyShortcut);
  }, [showCalc, workers, monthFilter, yearFilter, stats]);

  // 9.1 توليد شهر جديد (addNextMonth)
  const addNextMonth = () => {
    let nextMonth = monthFilter + 1;
    let nextYear = yearFilter;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    // Only rollover employees who are active/exist in the CURRENT filtered month/year!
    const activeWorkersInCurrentFilteredMonth = workers.filter(w => (w as any).month === monthFilter && (w as any).year === yearFilter);
    const uniqueCodes = Array.from(new Set(activeWorkersInCurrentFilteredMonth.map(w => w.code)));
    if (uniqueCodes.length === 0) {
      onTriggerNotification(isRtl ? "يرجى تسجيل عامل في الشهر الحالي أولاً قبل فتح شهر جديد" : "No active workers inside the current month's list to roll over", "warning");
      return;
    }

    const listCopy = [...workers];
    let addedCount = 0;
    let firstNewId = "";

    uniqueCodes.forEach(code => {
      const exists = listCopy.some(w => w.code === code && (w as any).month === nextMonth && (w as any).year === nextYear);
      if (!exists) {
        const prev = listCopy.find(w => w.code === code && (w as any).month === monthFilter && (w as any).year === yearFilter)
          || listCopy.filter(w => w.code === code).sort((a,b) => ((b as any).year - (a as any).year) || ((b as any).month - (a as any).month))[0];
        
        const dates = fillDates(nextMonth, nextYear);
        const newId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        const baseSalary = prev ? prev.baseSalary : 35000;
        const dailyHours = prev ? prev.dailyHours : 8;
        const overtimeRate = prev ? (prev as any).overtimeRate || 250 : 250;
        const name = prev ? prev.name : "";
        const phone = prev ? prev.phone : "";
        const role = prev ? prev.role || "Sales Handler" : "Sales Handler";

        const newRecord: any = {
          id: newId,
          name,
          code,
          phone,
          role,
          baseSalary,
          dailyHours,
          overtimeRate,
          month: nextMonth,
          year: nextYear,
          payPeriodStart: dates.start,
          payPeriodEnd: dates.end,
          overtimeHours: 0,
          missingHours: 0,
          absenceDays: 0,
          expenses: [],
          paid: false,
          paymentAmount: 0,
          paymentDate: "",
          createdAt: new Date().toISOString()
        };

        const netVal = Math.round(baseSalary);
        newRecord.payrolls = [{
          id: `pay-${newId}`,
          payPeriod: `${monthNamesEn[nextMonth]} ${nextYear}`,
          datePaid: "",
          baseSalary,
          overtimeHours: 0,
          overtimeEarned: 0,
          bonus: 0,
          absenceDays: 0,
          absenceDeductions: 0,
          cashAdvances: 0,
          otherDeductions: 0,
          netSalary: netVal,
          released: false
        }];

        listCopy.push(newRecord);
        addedCount++;
        if (!firstNewId) firstNewId = newId;
      }
    });

    if (addedCount > 0) {
      onSaveWorkers(listCopy);
      onTriggerNotification(isRtl ? `تم تفجير وتهيئة حسابات شهر جديد لـ ${addedCount} عمال` : `Initialized next month calculations for ${addedCount} employees`, "success");
    }

    setMonthFilter(nextMonth);
    setYearFilter(nextYear);

    if (firstNewId) {
      const fresh = listCopy.find(x => x.id === firstNewId);
      if (fresh) {
        setEditId(firstNewId);
        setFormCode(fresh.code);
        setFormName(fresh.name);
        setFormPhone(fresh.phone || "");
        setFormRole(fresh.role || "Sales Handler");
        setFormMonth(fresh.hasOwnProperty("month") ? (fresh as any).month : nextMonth);
        setFormBaseSalary(fresh.baseSalary);
        setFormDailyHours(fresh.dailyHours || 8);
        setFormOvertimeHours((fresh as any).overtimeHours || 0);
        setFormOvertimeRate((fresh as any).overtimeRate || 250);
        setFormMissingHours((fresh as any).missingHours || 0);
        setFormAbsenceDays((fresh as any).absenceDays || 0);
        setFormExpenses((fresh as any).expenses || []);
        setFormPaid((fresh as any).paid || false);
        setFormPaymentAmount((fresh as any).paymentAmount || 0);
        setFormPaymentDate((fresh as any).paymentDate || "");
        setShowForm(true);
      }
    }
  };

  // Helper forms reset
  const resetForm = () => {
    const nextC = getNextCode();
    setEditId(null);
    setFormCode(nextC);
    setFormName("");
    setFormPhone("");
    setFormRole("Sales Handler");
    setFormMonth(monthFilter);
    setFormBaseSalary(35000);
    setFormDailyHours(8);
    setFormOvertimeHours(0);
    setFormOvertimeRate(250);
    setFormMissingHours(0);
    setFormAbsenceDays(0);
    setFormExpenses([]);
    setFormPaid(false);
    setFormPaymentAmount(0);
    setFormPaymentDate("");
    setFormEmail("");
    setFormPassword("");
  };

  // Handle month selection change in adding/editing employee profile
  const handleMonthChangeInForm = (newM: number) => {
    // Save current states into form cache
    const cachedKey = `${formCode}-${formMonth}`;
    formCache.current[cachedKey] = {
      overtimeHours: formOvertimeHours,
      overtimeRate: formOvertimeRate,
      missingHours: formMissingHours,
      absenceDays: formAbsenceDays,
      expenses: formExpenses
    };

    setFormMonth(newM);

    // Sync editId so changing months works reactively as edit or insert
    const exist = workers.find(w => w.code === formCode && (w as any).month === newM && (w as any).year === yearFilter);
    if (exist) {
      setEditId(exist.id);
    } else {
      setEditId(null);
    }

    const targetKey = `${formCode}-${newM}`;
    const cachedItem = formCache.current[targetKey];
    if (cachedItem) {
      setFormOvertimeHours(cachedItem.overtimeHours);
      setFormOvertimeRate(cachedItem.overtimeRate || 250);
      setFormMissingHours(cachedItem.missingHours);
      setFormAbsenceDays(cachedItem.absenceDays);
      setFormExpenses(cachedItem.expenses || []);
    } else {
      if (exist) {
        setFormOvertimeHours((exist as any).overtimeHours || 0);
        setFormOvertimeRate((exist as any).overtimeRate || 250);
        setFormMissingHours((exist as any).missingHours || 0);
        setFormAbsenceDays((exist as any).absenceDays || 0);
        setFormExpenses((exist as any).expenses || []);
      } else {
        setFormOvertimeHours(0);
        setFormOvertimeRate(250);
        setFormMissingHours(0);
        setFormAbsenceDays(0);
        setFormExpenses([]);
      }
    }
  };

  // Add individual worker expense inside the form
  const handleAddIndividualExpenseValue = () => {
    if (!newExpDesc.trim() || newExpAmount <= 0) {
      onTriggerNotification(isRtl ? "يرجى تعبئة خانات المصروف بالشكل الصحيح" : "Invalid expense values", "warning");
      return;
    }
    const targetDates = fillDates(formMonth, yearFilter);
    const newWExp = {
      id: `wexp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      desc: newExpDesc.trim(),
      amount: newExpAmount,
      date: newExpDate || targetDates.start
    };
    setFormExpenses([...formExpenses, newWExp]);
    setNewExpDesc("");
    setNewExpAmount(0);
    setNewExpDate("");
    setShowExpenseModal(false);
  };

  const handleRemoveIndividualExpenseValue = (id: string) => {
    setFormExpenses(formExpenses.filter(e => e.id !== id));
  };

  // Form Submission
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onTriggerNotification(isRtl ? "يلزم إدخال اسم العامل للمتابعة" : "Employee name is required", "warning");
      return;
    }

    const targetDates = fillDates(formMonth, yearFilter);
    const listCopy = [...workers];

    const parsedOvertimeHours = Number(formOvertimeHours) || 0;
    const parsedOvertimeRate = Number(formOvertimeRate) || 250;
    const parsedAbsenceDays = Number(formAbsenceDays) || 0;
    const parsedMissingHours = Number(formMissingHours) || 0;
    const parsedBaseSalary = Number(formBaseSalary) || 0;
    const parsedDailyHours = Number(formDailyHours) || 8;

    const op = parsedOvertimeHours * parsedOvertimeRate;
    const dw = calcDailyWage(parsedBaseSalary);
    const hw = calcHourlyWage(parsedBaseSalary, parsedDailyHours);
    const ab = parsedAbsenceDays * dw;
    const ms = parsedMissingHours * hw;
    const exSum = formExpenses.reduce((s, x) => s + x.amount, 0);

    const calculatedNet = Math.max(0, Math.round(parsedBaseSalary + op - (ab + ms + exSum)));

    if (editId) {
      // Modifying
      const index = listCopy.findIndex(x => x.id === editId);
      if (index !== -1) {
        const updated: any = {
          ...listCopy[index],
          name: formName.trim(),
          phone: formPhone.trim(),
          role: formRole,
          baseSalary: parsedBaseSalary,
          dailyHours: parsedDailyHours,
          overtimeRate: parsedOvertimeRate,
          overtimeHours: parsedOvertimeHours,
          missingHours: parsedMissingHours,
          absenceDays: parsedAbsenceDays,
          expenses: formExpenses,
          paid: formPaid,
          paymentAmount: formPaid ? calculatedNet : 0,
          paymentDate: formPaid ? (formPaymentDate || new Date().toISOString().split("T")[0]) : "",
          payPeriodStart: targetDates.start,
          payPeriodEnd: targetDates.end,
          month: formMonth,
          year: yearFilter
        };

        updated.payrolls = [{
          id: `pay-${updated.id}`,
          payPeriod: `${monthNamesEn[formMonth]} ${yearFilter}`,
          datePaid: updated.paid ? updated.paymentDate : "",
          baseSalary: parsedBaseSalary,
          overtimeHours: parsedOvertimeHours,
          overtimeEarned: op,
          bonus: 0,
          absenceDays: parsedAbsenceDays,
          absenceDeductions: ab,
          cashAdvances: 0,
          otherDeductions: ms + exSum,
          netSalary: calculatedNet,
          released: updated.paid
        }];

        listCopy[index] = updated;

        // Sync salary, dailyHours, and overtimeRate across all months for this worker
        listCopy.forEach((item, idx) => {
          if (item.code === formCode) {
            const itemOvertimeHours = Number((item as any).overtimeHours) || 0;
            const itemAbsenceDays = Number((item as any).absenceDays) || 0;
            const itemMissingHours = Number((item as any).missingHours) || 0;
            const itemExpenses = (item as any).expenses || [];

            const itemOp = itemOvertimeHours * parsedOvertimeRate;
            const itemDw = calcDailyWage(parsedBaseSalary);
            const itemHw = calcHourlyWage(parsedBaseSalary, parsedDailyHours);
            const itemAb = itemAbsenceDays * itemDw;
            const itemMs = itemMissingHours * itemHw;
            const itemExSum = itemExpenses.reduce((s: number, x: any) => s + x.amount, 0);

            const itemCalculatedNet = Math.max(0, Math.round(parsedBaseSalary + itemOp - (itemAb + itemMs + itemExSum)));

            listCopy[idx] = {
              ...item,
              name: formName.trim(),
              phone: formPhone.trim(),
              role: formRole,
              baseSalary: parsedBaseSalary,
              dailyHours: parsedDailyHours,
              overtimeRate: parsedOvertimeRate,
              paymentAmount: (item as any).paid ? itemCalculatedNet : 0,
              payrolls: [{
                id: `pay-${item.id}`,
                payPeriod: `${monthNamesEn[(item as any).month]} ${(item as any).year || yearFilter}`,
                datePaid: (item as any).paid ? ((item as any).paymentDate || new Date().toISOString().split("T")[0]) : "",
                baseSalary: parsedBaseSalary,
                overtimeHours: itemOvertimeHours,
                overtimeEarned: itemOp,
                bonus: 0,
                absenceDays: itemAbsenceDays,
                absenceDeductions: itemAb,
                cashAdvances: 0,
                otherDeductions: itemMs + itemExSum,
                netSalary: itemCalculatedNet,
                released: (item as any).paid
              }]
            };
          }
        });

        // Sync with general ledger
        syncExpensesWithGeneralLedger(formCode, formName.trim(), formExpenses, formMonth, yearFilter);

        onSaveWorkers(listCopy);
        onTriggerNotification(isRtl ? "تم تعديل ملف العامل وحساباته الشهرية بنجاح" : "Payroll files adjusted successfully", "success");
      }
    } else {
      // Prevent duplicate names under different codes
      const nameConflict = listCopy.find(w => w.code !== formCode && cleanArabicName(w.name) === cleanArabicName(formName));
      if (nameConflict) {
        onTriggerNotification(
          isRtl
            ? `❌ هذا العامل مسجل في النظام برمز تعريف آخر (${nameConflict.code}). يرجى اختياره من القائمة أو مطابقة رمز التعريف لتجنب التكرار.`
            : `❌ This worker is already registered under code (${nameConflict.code}). Please match the code or select them from the list to avoid duplication.`,
          "warning"
        );
        return;
      }

      // Check if worker record already exists for selected month/year
      const conflict = listCopy.some(w => w.code === formCode && (w as any).month === formMonth && (w as any).year === yearFilter);
      if (conflict) {
        onTriggerNotification(isRtl ? "هناك سجل شهري مسجل مسبقاً لهذا الموظف في الشهر الحالي" : "Employee monthly record already registered", "warning");
        return;
      }

      const freshId = `work-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newRecord: any = {
        id: freshId,
        name: formName.trim(),
        code: formCode,
        phone: formPhone.trim(),
        role: formRole,
        baseSalary: parsedBaseSalary,
        dailyHours: parsedDailyHours,
        overtimeRate: parsedOvertimeRate,
        overtimeHours: parsedOvertimeHours,
        missingHours: parsedMissingHours,
        absenceDays: parsedAbsenceDays,
        expenses: formExpenses,
        paid: formPaid,
        paymentAmount: formPaid ? calculatedNet : 0,
        paymentDate: formPaid ? (formPaymentDate || new Date().toISOString().split("T")[0]) : "",
        payPeriodStart: targetDates.start,
        payPeriodEnd: targetDates.end,
        month: formMonth,
        year: yearFilter,
        createdAt: new Date().toISOString()
      };

      newRecord.payrolls = [{
        id: `pay-${freshId}`,
        payPeriod: `${monthNamesEn[formMonth]} ${yearFilter}`,
        datePaid: newRecord.paid ? newRecord.paymentDate : "",
        baseSalary: parsedBaseSalary,
        overtimeHours: parsedOvertimeHours,
        overtimeEarned: op,
        bonus: 0,
        absenceDays: parsedAbsenceDays,
        absenceDeductions: ab,
        cashAdvances: 0,
        otherDeductions: ms + exSum,
        netSalary: calculatedNet,
        released: newRecord.paid
      }];

      listCopy.push(newRecord);

      // Sync salary, dailyHours, and overtimeRate across all months for this worker
      listCopy.forEach((item, idx) => {
        if (item.code === formCode) {
          const itemOvertimeHours = Number((item as any).overtimeHours) || 0;
          const itemAbsenceDays = Number((item as any).absenceDays) || 0;
          const itemMissingHours = Number((item as any).missingHours) || 0;
          const itemExpenses = (item as any).expenses || [];

          const itemOp = itemOvertimeHours * parsedOvertimeRate;
          const itemDw = calcDailyWage(parsedBaseSalary);
          const itemHw = calcHourlyWage(parsedBaseSalary, parsedDailyHours);
          const itemAb = itemAbsenceDays * itemDw;
          const itemMs = itemMissingHours * itemHw;
          const itemExSum = itemExpenses.reduce((s: number, x: any) => s + x.amount, 0);

          const itemCalculatedNet = Math.max(0, Math.round(parsedBaseSalary + itemOp - (itemAb + itemMs + itemExSum)));

          listCopy[idx] = {
            ...item,
            name: formName.trim(),
            phone: formPhone.trim(),
            role: formRole,
            baseSalary: parsedBaseSalary,
            dailyHours: parsedDailyHours,
            overtimeRate: parsedOvertimeRate,
            paymentAmount: (item as any).paid ? itemCalculatedNet : 0,
            payrolls: [{
              id: `pay-${item.id}`,
              payPeriod: `${monthNamesEn[(item as any).month]} ${(item as any).year || yearFilter}`,
              datePaid: (item as any).paid ? ((item as any).paymentDate || new Date().toISOString().split("T")[0]) : "",
              baseSalary: parsedBaseSalary,
              overtimeHours: itemOvertimeHours,
              overtimeEarned: itemOp,
              bonus: 0,
              absenceDays: itemAbsenceDays,
              absenceDeductions: itemAb,
              cashAdvances: 0,
              otherDeductions: itemMs + itemExSum,
              netSalary: itemCalculatedNet,
              released: (item as any).paid
            }]
          };
        }
      });

      syncExpensesWithGeneralLedger(formCode, formName.trim(), formExpenses, formMonth, yearFilter);

      onSaveWorkers(listCopy);

      // Create login account if email provided
      if (formEmail.trim() && supabase) {
        try {
          const username = formName.trim().replace(/\s+/g, "_").toLowerCase();
          const { error: userErr } = await supabase.from("corevia_company_users").upsert({
            user_id: freshId,
            company_id: session?.company_id || "",
            email: formEmail.trim().toLowerCase(),
            username,
            password: formPassword || formPhone.trim(),
            role: formRole,
            status: "Active",
            allowed_pages: ["dashboard", "orders", "products", "inventory", "workers", "expenses", "reports", "yearly", "profit", "activity_log"],
            created_at: new Date().toISOString(),
          });
          if (userErr) console.warn("WorkersView: Failed to create login account", userErr);
        } catch (loginErr) {
          console.warn("WorkersView: Login account creation error", loginErr);
        }
      }

      onTriggerNotification(isRtl ? "تم تفصيل وتوظيف العامل الجديد بنجاح" : "Staff onboarded successfully!", "success");
    }

    setShowForm(false);
    if (prevWorkerCode.current) {
      setShowCalc(prevWorkerCode.current);
      prevWorkerCode.current = null;
    }
  };

  // Delete worker monthly record
  const handleDeleteWorkerRecord = () => {
    if (!deleteConfirm) return;
    const workerToDelete = workers.find(x => x.id === deleteConfirm);
    if (workerToDelete) {
      setLastDeletedWorker(workerToDelete);
      onSaveWorkers(workers.filter(x => x.id !== deleteConfirm));
      onTriggerNotification(isRtl ? "تم حذف السجل الشهري للعامِل بنجاح." : "Monthly statements dropped.", "info");
    }
    setDeleteConfirm(null);
  };

  // Delete selected worker months
  const handleDeleteSelectedMonths = () => {
    if (selectedMonthsToDelete.length === 0) return;
    const remaining = workers.filter(x => !selectedMonthsToDelete.includes(x.id));
    onSaveWorkers(remaining);
    onTriggerNotification(
      isRtl
        ? "✅ تم حذف السجلات الشهرية المحددة للعامِل بنجاح."
        : "✅ Selected monthly records deleted successfully.",
      "success"
    );
    setDeleteConfirm(null);
  };

  // Delete worker ENTIRE profile (all monthly statements)
  const handleDeleteEntireWorkerProfile = () => {
    if (!deleteConfirm) return;
    const workerToDelete = workers.find(x => x.id === deleteConfirm);
    if (workerToDelete) {
      const targetCode = workerToDelete.code;
      const targetName = workerToDelete.name;
      
      if (onDeleteEntireWorkerProfile) {
        onDeleteEntireWorkerProfile(targetCode);
      } else {
        const remaining = workers.filter(x => x.code !== targetCode);
        onSaveWorkers(remaining);
        if (onSoftDeleteWorker) {
          onSoftDeleteWorker(workerToDelete.id);
        }
        onTriggerNotification(
          isRtl 
            ? `✅ تم حذف ملف الموظف (${targetName}) بالكامل مع جميع سجلاته.` 
            : `✅ Employee (${targetName}) and all records deleted permanently.`, 
          "success"
        );
      }
    }
    setDeleteConfirm(null);
  };

  // Undo delete restore function
  const handleUndoDeleteRecord = () => {
    if (!lastDeletedWorker) return;
    onSaveWorkers([lastDeletedWorker, ...workers]);
    setLastDeletedWorker(null);
    onTriggerNotification(isRtl ? "تم التراجع واستعادة ملف الموظف بنجاح" : "Record successfully restored!", "success");
  };

  // Open edit form from detail modal handler
  const handleEditFromDetails = (record: any) => {
    prevWorkerCode.current = record.code;
    setShowCalc(null);

    setEditId(record.id);
    setFormCode(record.code);
    setFormName(record.name);
    setFormPhone(record.phone || "");
    setFormRole(record.role || "Sales Handler");
    setFormMonth(record.month !== undefined ? record.month : monthFilter);
    setFormBaseSalary(record.baseSalary);
    setFormDailyHours(record.dailyHours || 8);
    setFormOvertimeHours(record.overtimeHours || 0);
    setFormOvertimeRate(record.overtimeRate || 250);
    setFormMissingHours(record.missingHours || 0);
    setFormAbsenceDays(record.absenceDays || 0);
    setFormExpenses(record.expenses || []);
    setFormPaid(record.paid || false);
    setFormPaymentAmount(record.paymentAmount || 0);
    setFormPaymentDate(record.paymentDate || "");
    setShowForm(true);
  };

  // Open Payment modal from details page
  const handleOpenPayModal = (wCode: string) => {
    setPayModalCode(wCode);
    setShowPayModal(true);
    
    // Select unpaid records initially
    const wUnpaid = workers.filter(w => w.code === wCode && !(w as any).paid).map(w => w.id);
    setSelectedMonthsToPay(wUnpaid);
  };

  const handleConfirmMassPayments = () => {
    const listCopy = [...workers];
    let count = 0;

    // First go through all of this worker's records
    listCopy.forEach((item, idx) => {
      if (item.code === payModalCode) {
        const isTargeted = selectedMonthsToPay.includes(item.id);
        const otPay = ((item as any).overtimeHours || 0) * ((item as any).overtimeRate || 250);
        const daily = calcDailyWage(item.baseSalary);
        const hourly = calcHourlyWage(item.baseSalary, item.dailyHours || 8);
        const absD = ((item as any).absenceDays || 0) * daily;
        const misD = ((item as any).missingHours || 0) * hourly;
        const expD = ((item as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
        const net = Math.max(0, Math.round(item.baseSalary + otPay - (absD + misD + expD)));

        if (isTargeted) {
          // Set to Paid
          listCopy[idx] = {
            ...item,
            paid: true,
            paymentAmount: net,
            paymentDate: new Date().toISOString().split("T")[0]
          };
          (listCopy[idx] as any).payrolls = [{
            id: `pay-${item.id}`,
            payPeriod: `${monthNamesEn[(item as any).month]} ${(item as any).year}`,
            datePaid: listCopy[idx].paymentDate,
            baseSalary: item.baseSalary,
            overtimeHours: (item as any).overtimeHours || 0,
            overtimeEarned: otPay,
            bonus: 0,
            absenceDays: (item as any).absenceDays || 0,
            absenceDeductions: absD,
            cashAdvances: 0,
            otherDeductions: misD + expD,
            netSalary: net,
            released: true
          }];
          count++;
        } else {
          // Set to Unpaid
          listCopy[idx] = {
            ...item,
            paid: false,
            paymentAmount: 0,
            paymentDate: ""
          };
          (listCopy[idx] as any).payrolls = [{
            id: `pay-${item.id}`,
            payPeriod: `${monthNamesEn[(item as any).month]} ${(item as any).year}`,
            datePaid: "",
            baseSalary: item.baseSalary,
            overtimeHours: (item as any).overtimeHours || 0,
            overtimeEarned: otPay,
            bonus: 0,
            absenceDays: (item as any).absenceDays || 0,
            absenceDeductions: absD,
            cashAdvances: 0,
            otherDeductions: misD + expD,
            netSalary: net,
            released: false
          }];
        }
      }
    });

    onSaveWorkers(listCopy);
    onTriggerNotification(isRtl ? `تم صرف وتسوية معاملة ${count} أشهر بنجاح` : `Processed payment for ${count} periods successfully`, "success");
    setShowPayModal(false);
  };

  return (
    <div className="space-y-6 pt-16 md:pt-4 text-[#e2e8f0] font-sans" dir={isRtl ? "rtl" : "ltr"} id="workers_general_panel">
      
      {/* 3.1 الشريط العلوي للقسم المالي */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#09090b] p-5 rounded-2xl border border-zinc-900 shadow">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400 w-5 h-5" />
            <span>{getsLabel("إدارة الرواتب والعمال الكلاسيكية", "Gestion du Personnel", "Staff Directory Ledger")}</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">
            {getsLabel("إضافة وتحديث سجلات العمال، ضبط الساعات الإضافية والناقصة، وتفصيل الرواتب والمصاريف الخاصة", "Gérer la paie mensuelle, heures supplémentaires, retenues et acomptes", "Record monthly allowances, overtime values, absences, individual loans, and export sheets")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {session?.role !== "employee" && (
            <>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>{getsLabel("إضافة عامل", "Ajouter Salarié", "Add Worker")}</span>
              </button>
              
              <button
                onClick={() => { addNextMonth(); }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Calendar size={14} />
                <span>{getsLabel("شهر جديد", "Nouveau Mois", "Next Month")}</span>
              </button>
            </>
          )}

          <button
            onClick={printWorkers}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer size={14} />
            <span>{getsLabel("طباعة", "Imprimer", "Print")}</span>
          </button>

          <button
            onClick={() => setShowYearlySummary(!showYearlySummary)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              showYearlySummary ? "bg-amber-600 text-black hover:bg-amber-500" : "bg-zinc-900 border border-zinc-800 text-amber-500 hover:text-white"
            }`}
          >
            <FileText size={14} />
            <span>{getsLabel("الملخص السنوي", "Résumé Annuel", "Yearly Review")}</span>
          </button>

          {/* Submissions Reviews Activator */}
          <button
            onClick={() => { setShowEmployeeFilings(!showEmployeeFilings); setShowYearlySummary(false); }}
            className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              showEmployeeFilings 
                ? "bg-rose-600 text-white hover:bg-rose-500" 
                : "bg-zinc-900 border border-zinc-800 text-indigo-400 hover:text-indigo-300"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{getsLabel("طلبات واعتمادات الموظفين", "Approbations Salariés", "Employee Request Reviews")}</span>
            {employeeSubmissions.filter(s => s.status === "pending").length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white animate-bounce shadow">
                {employeeSubmissions.filter(s => s.status === "pending").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3.2 بطاقات الإحصائيات العامة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#09090b] rounded-2xl border border-zinc-900 p-4 relative overflow-hidden">
          <span className="text-[10px] text-slate-400 font-bold block uppercase">{getsLabel("مجموع الرواتب", "Masse Salariale Base", "Base payroll sum")}</span>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {stats.grandSalaries.toLocaleString()}<span className="text-[10px] text-zinc-500 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{getsLabel("عبر جميع الأشهر المسجلة", "Cumul historique", "Historical records summary")}</p>
        </div>

        <div className="bg-[#09090b] rounded-2xl border border-zinc-900 p-4 relative overflow-hidden">
          <div className="absolute top-2 right-2 text-emerald-500"><TrendingUp size={14} /></div>
          <span className="text-[10px] text-slate-400 font-bold block uppercase">{getsLabel("أجرة الساعات الإضافية", "Heures Supp (+)", "Overtime wage earned")}</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            +{stats.grandOT.toLocaleString()}<span className="text-[10px] text-zinc-500 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{getsLabel("إضافات الأوفرتايم المستحقة", "Coefficients cumulés", "Total recorded overtime")}</p>
        </div>

        <div className="bg-[#09090b] rounded-2xl border border-zinc-900 p-4 relative overflow-hidden">
          <div className="absolute top-2 right-2 text-rose-500"><TrendingDown size={14} /></div>
          <span className="text-[10px] text-slate-400 font-bold block uppercase">{getsLabel("مجموع الخصومات والغيابات", "Retenues & Absences (-)", "Sum of deductions")}</span>
          <div className="text-xl font-bold font-mono text-rose-500 mt-1">
            -{stats.grandDed.toLocaleString()}<span className="text-[10px] text-zinc-500 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{getsLabel("يشمل الغياب والتأخر والمصاريف", "Absences & acomptes", "Absences and advanced expenses")}</p>
        </div>

        <div className="bg-[#09090b] rounded-2xl border border-zinc-900 p-4 bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
          <span className="text-[10px] text-indigo-400 font-bold block uppercase">{getsLabel("صافي رواتب العمال الكلي", "Net Global Liquid", "Overall Net wage payout")}</span>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
            {stats.grandNet.toLocaleString()}<span className="text-[10px] text-zinc-500 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[10px] text-indigo-500/80 mt-0.5">{getsLabel("جميع الموظفين وعبر التاريخ كلياً", "Total liquide validé", "All resources final payout")}</p>
        </div>
      </div>

      {/* 10. الملخص السنوي الجدول الإضافي */}
      {showYearlySummary && (
        <div className="bg-[#09090b] rounded-2xl border border-zinc-900 overflow-hidden shadow-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>الملخص السنوي العام لرواتب العمال (تجميع تاريخي)</span>
            </h3>
            <button onClick={() => setShowYearlySummary(false)} className="text-zinc-500 hover:text-white"><X size={15} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#040406] text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3 text-right">كود الموظف</th>
                  <th className="p-3 text-right">الاسم الكامل</th>
                  <th className="p-3 text-center">عدد سجلات الشهور</th>
                  <th className="p-3 text-left">مجموع الأساسي</th>
                  <th className="p-3 text-left text-emerald-400">مجموع الإضافي</th>
                  <th className="p-3 text-left text-rose-500">الخصومات (تأخير وغياب)</th>
                  <th className="p-3 text-left text-orange-400">مجموع السلف والمصاريف</th>
                  <th className="p-3 text-left text-indigo-400">الصافي الكلي المعتمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {workerYearlyAverages.map((y: any) => (
                  <tr key={y.code} className="hover:bg-zinc-950 transition-colors">
                    <td className="p-3 font-mono font-bold">{y.code}</td>
                    <td className="p-3 font-semibold">{y.name}</td>
                    <td className="p-3 text-center font-mono">{y.monthsCount} أشهر</td>
                    <td className="p-3 font-mono text-left">{y.totalBase.toLocaleString()} دج</td>
                    <td className="p-3 font-mono text-left text-emerald-400">+{y.totalOT.toLocaleString()} دج</td>
                    <td className="p-3 font-mono text-left text-rose-500">-${y.totalDed.toLocaleString()} دج</td>
                    <td className="p-3 font-mono text-left text-orange-400">-${y.totalExpenses.toLocaleString()} دج</td>
                    <td className="p-3 font-mono text-left text-indigo-400 font-bold bg-zinc-900/40">{y.netSalary.toLocaleString()} دج</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.3 حقل التصفية والبحث بأسماء الشهور */}
      <div className="bg-[#09090b] rounded-2xl border border-zinc-900 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full md:max-w-lg items-center">
          <Calendar size={16} className="text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300 min-w-fit">{getsLabel("تحديد فترة الفرز للعرض والرواتب:", "Période de calcul brute :", "Choose wage calculations target:")}</span>
          
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(parseInt(e.target.value, 10))}
            className="bg-[#040406] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-600 font-bold cursor-pointer"
          >
            {monthNamesAr.map((m, idx) => (
              <option key={m} value={idx}>{getMonthName(idx)}</option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value, 10))}
            className="bg-[#040406] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-600 font-mono font-bold cursor-pointer"
          >
            {Array.from({ length: 30 }, (_, i) => today.getFullYear() - 5 + i).map(colY => (
              <option key={colY} value={colY}>{colY}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={getsLabel("البحث باسم الموظف أو الكود...", "Chercher salarié...", "Search worker name or ID...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#040406] border border-zinc-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-600"
          />
        </div>
      </div>

      {/* 3.3b لوحة طلبات واعتمادات الموظفين */}
      {showEmployeeFilings && (
        <div className="bg-[#09090b] rounded-2xl border border-rose-500/20 overflow-hidden shadow-2xl p-5 space-y-4 animate-fade-in mb-6" id="employee_approvals_panel" dir="rtl">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full font-mono font-bold">
                {employeeSubmissions.filter(s => s.status === "pending").length} المعلقة
              </span>
              <h3 className="text-sm font-black text-rose-450 flex items-center gap-1.5 justify-end">
                <span>{getsLabel("طلبات واعتمادات الموظفين وقنوات التبليغ الذاتي", "Demandes de Salariés à Valider", "Employee Request Reviews")}</span>
              </h3>
            </div>
            <button 
              onClick={() => setShowEmployeeFilings(false)} 
              className="p-1 hover:bg-[#18181b] text-zinc-500 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {employeeSubmissions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <p>📭 {getsLabel("لا توجد طلبات حضور أو مصاريف مقدمة من طرف الموظفين حالياً.", "Aucune demande soumise par le personnel pour le moment.", "No active employee reports registered for approval.")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-[#040406] text-zinc-400 border-b border-zinc-805 text-[11px] select-none">
                    <th className="p-3 text-right">{getsLabel("الموظف", "Salarié", "Employee")}</th>
                    <th className="p-3 text-right">{getsLabel("النوع", "Type", "Type")}</th>
                    <th className="p-3 text-right">{getsLabel("الكمية المعروضة", "Quantité", "Amount")}</th>
                    <th className="p-3 text-right">{getsLabel("البيان والمبررات", "Justification", "Justification")}</th>
                    <th className="p-3 text-right">{getsLabel("التاريخ المعني", "Date de l'évènement", "Date")}</th>
                    <th className="p-3 text-center">{getsLabel("الحالة", "Statut", "Status")}</th>
                    <th className="p-3 text-center">{getsLabel("الاعتماد والإقرار", "Actions/Décision", "Approve / Reject")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {employeeSubmissions.map((sub) => {
                    const isPending = sub.status === "pending";
                    const isEditing = editingSubId === sub.id;
                    return (
                      <tr key={sub.id} className="hover:bg-zinc-950/40 transition-colors">
                        <td className="p-3 font-semibold text-white">
                          <span className="block">{sub.employeeName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">ID: {sub.employeeId?.substring(0, 5)}</span>
                        </td>
                        <td className="p-3 font-medium">
                          {sub.type === "overtime" && <span className="text-indigo-400 font-bold">🚀 {getsLabel("عمل إضافي", "Heures Supp", "Overtime")}</span>}
                          {sub.type === "missing_hours" && <span className="text-amber-500 font-bold">⏰ {getsLabel("ساعات ضائعة", "Heures perdues", "Lost Hours")}</span>}
                          {sub.type === "absence" && <span className="text-rose-400 font-bold">📅 {getsLabel("غياب كامل", "Absence", "Absence")}</span>}
                          {sub.type === "expense" && <span className="text-emerald-450 font-bold">💰 {getsLabel("تعويض مصاريف", "Remboursement", "Expense Refund")}</span>}
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <input
                                type="number"
                                className="w-16 bg-[#18181b] border border-zinc-700 text-white rounded p-1 text-center text-xs font-mono"
                                value={editSubAmount}
                                onChange={(e) => setEditSubAmount(Number(e.target.value))}
                              />
                              <button
                                onClick={() => {
                                  handleApproveSubmissionInWorkersList(sub, editSubAmount);
                                  setEditingSubId(null);
                                }}
                                className="p-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded"
                                title="حفظ واعتماد التعديل"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                onClick={() => setEditingSubId(null)}
                                className="p-1 bg-rose-600/20 text-rose-405 border border-rose-500/30 rounded"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 justify-end">
                              <span>
                                {sub.amount} {sub.type === "expense" ? currencyLabel : sub.type === "absence" ? getsLabel("أيام", "jours", "days") : getsLabel("ساعة", "heures", "hrs")}
                              </span>
                              {isPending && (
                                <button
                                  onClick={() => {
                                    setEditingSubId(sub.id);
                                    setEditSubAmount(sub.amount);
                                  }}
                                  className="text-zinc-600 hover:text-white"
                                  title="تعديل القيمة قبل الاعتماد"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-405 leading-normal max-w-xs truncate" title={sub.description}>
                          {sub.description}
                        </td>
                        <td className="p-3 text-zinc-300 font-mono text-[11px]">{sub.date}</td>
                        <td className="p-3 text-center">
                          {sub.status === "approved" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-[10px]">
                              <CheckCircle2 size={11} />
                              {getsLabel("معتمد ومثبت", "Validé", "Approved & Synced")}
                            </span>
                          )}
                          {sub.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 font-bold text-[10px]">
                              <XCircle size={11} />
                              {getsLabel("مرفوض", "Refusé", "Rejected")}
                            </span>
                          )}
                          {sub.status === "pending" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-550 font-bold text-[10px]">
                              <Clock size={11} className="animate-pulse" />
                              {getsLabel("انتظار الاعتماد", "En attente", "Reviewing")}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isPending ? (
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => handleApproveSubmissionInWorkersList(sub)}
                                className="px-3 py-1.5 bg-emerald-650 hover:bg-emerald-600 border border-emerald-650/30 text-white font-extrabold rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Check size={11} />
                                <span>{getsLabel("قبول", "Accepter", "Approve")}</span>
                              </button>
                              <button
                                onClick={() => handleRejectSubmissionInWorkersList(sub)}
                                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/30 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                              >
                                <XCircle size={11} />
                                <span>{getsLabel("رفض", "Rejeter", "Reject")}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-zinc-600 font-mono">
                              ✓ {getsLabel("معالج ومغلق", "Traité", "Closed Case")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.4 جدول العمال الرئيسي */}
      <div className="bg-[#09090b] rounded-2xl border border-zinc-900 overflow-hidden shadow">
        <div className="p-4 border-b border-zinc-900 flex justify-between items-center">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-400" />
            <span>كشوف مرتبات الفترة: {getMonthName(monthFilter)} {yearFilter}</span>
          </span>
          <div className="flex gap-2 text-[10px] font-semibold bg-zinc-900 p-1.5 rounded-lg">
            <span className="text-emerald-400">الصافي الإجمالي للفترة: {stats.totalNet.toLocaleString()} دج</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#040406] text-zinc-400 border-b border-zinc-900">
              <tr>
                <th className="p-4 text-right">الرمز</th>
                <th className="p-4 text-right">الاسم الكامل</th>
                <th className="p-4 text-center">أشهر مسجلة</th>
                <th className="p-4 text-left">الراتب الأساسي</th>
                <th className="p-4 text-left text-emerald-400 font-bold">ساعات إضافية (+)</th>
                <th className="p-4 text-left text-rose-500">الخصومات والمصاريف (-)</th>
                <th className="p-4 text-left text-indigo-400 font-extrabold">الصافي المقبوض</th>
                <th className="p-4 text-center">حالة الصرف</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {displayedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-zinc-500 font-medium whitespace-nowrap">
                    لا تتوفر حالياً أي قيود لمرتبات عمال مطابقة للفرز المستهدف.
                  </td>
                </tr>
              ) : (
                displayedWorkers.map(w => {
                  const monthsCount = workers.filter(x => x.code === w.code).length;
                  const targetRecord = workers.find(x => x.code === w.code && (x as any).month === monthFilter && (x as any).year === yearFilter) || w;

                  // calculations
                  const otPay = ((targetRecord as any).overtimeHours || 0) * ((targetRecord as any).overtimeRate || 250);
                  const daily = calcDailyWage(targetRecord.baseSalary);
                  const hourly = calcHourlyWage(targetRecord.baseSalary, targetRecord.dailyHours || 8);
                  const absD = ((targetRecord as any).absenceDays || 0) * daily;
                  const misD = ((targetRecord as any).missingHours || 0) * hourly;
                  const expD = ((targetRecord as any).expenses || []).reduce((s: number, e: any) => s + e.amount, 0);
                  const net = Math.max(0, Math.round(targetRecord.baseSalary + otPay - (absD + misD + expD)));

                  return (
                    <tr 
                      key={w.id} 
                      className="hover:bg-zinc-950 transition-colors cursor-pointer group"
                      onClick={() => setShowCalc(w.code)}
                    >
                      <td className="p-4 font-mono font-bold text-zinc-300">{w.code}</td>
                      <td className="p-4">
                        <div className="font-bold text-white text-xs">{w.name}</div>
                        <div className="text-[10px] text-indigo-400">{w.role || "Sales Handler"}</div>
                        {targetRecord.createdBy && (
                          <div className="text-[8.5px] text-zinc-500 mt-1 flex flex-wrap items-center gap-1" dir="rtl">
                            <span className="inline-flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 px-1 py-0.2 rounded text-[8.5px] font-mono text-zinc-400">
                              👤 {targetRecord.createdBy.split(" (")[0]}
                            </span>
                            <span>{lang === "ar" ? "أُنشئ:" : "Created:"} {targetRecord.createdDate}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="bg-zinc-800 text-zinc-300 font-medium font-mono px-2.5 py-1 rounded text-[10px]">
                          {monthsCount} شهور
                        </span>
                      </td>
                      <td className="p-4 text-left font-mono">{targetRecord.baseSalary.toLocaleString()} دج</td>
                      <td className="p-4 text-left font-mono text-emerald-400 font-bold">+{otPay.toLocaleString()} دج</td>
                      <td className="p-4 text-left font-mono text-rose-400">-${(absD + misD + expD).toLocaleString()} دج</td>
                      <td className="p-4 text-left font-mono text-indigo-400 font-extrabold bg-zinc-900/20">{net.toLocaleString()} دج</td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {targetRecord.paid ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
                            ✓ تم الصرف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                            معلق
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-center items-center">
                          <button
                            onClick={() => setShowCalc(w.code)}
                            className="p-1.5 bg-indigo-950 text-indigo-300 border border-indigo-900 rounded-lg hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                            title="عرض تفاصيل حسابات العامل الشاملة"
                          >
                            <Edit2 size={13} />
                          </button>
                          
                          <button
                            onClick={() => printWorkerAllMonths(w.code)}
                            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="طباعة الدورة الكاملة لجميع شهور العامل"
                          >
                            <Printer size={13} />
                          </button>

                          {session?.role !== "employee" && (
                            <button
                              onClick={() => setDeleteConfirm(targetRecord.id)}
                              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                              title="حذف هذا السجل الشهري فقط"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3.5 التفاصيل الكاملة للعامل (showCalc) */}
      {showCalc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl w-full max-w-4xl p-6 relative shadow-2xl space-y-6">
            
            {/* Top controller bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-4">
              <div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">ملف الموظف وحساباته الكلاسيكية</span>
                <h2 className="text-base font-extrabold text-white">
                  {workers.find(x => x.code === showCalc)?.name} | {showCalc}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleOpenPayModal(showCalc)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  💰 صرف فليكس
                </button>
                <button
                  onClick={() => printWorkerAllMonths(showCalc)}
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer size={13} />
                  <span>طباعة الكل</span>
                </button>
                <button
                  onClick={() => setShowCalc(null)}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-zinc-800"
                >
                  رجوع
                </button>
              </div>
            </div>

            {/* Sticky Overview Stats Card */}
            {(() => {
              const personalRecords = workers.filter(x => x.code === showCalc);
              const pName = personalRecords[0]?.name || "-";
              let baseSum = 0;
              let otSum = 0;
              let dedSum = 0;
              let totalNetSum = 0;

              personalRecords.forEach(x => {
                const oPay = ((x as any).overtimeHours || 0) * ((x as any).overtimeRate || 250);
                const daily = calcDailyWage(x.baseSalary);
                const hourly = calcHourlyWage(x.baseSalary, x.dailyHours || 8);
                const abs = ((x as any).absenceDays || 0) * daily;
                const mis = ((x as any).missingHours || 0) * hourly;
                const exp = ((x as any).expenses || []).reduce((sum: number, e: any) => sum + e.amount, 0);

                const recordDeducts = abs + mis + exp;
                const netObj = Math.max(0, Math.round(x.baseSalary + oPay - recordDeducts));

                baseSum += x.baseSalary;
                otSum += oPay;
                dedSum += recordDeducts;
                totalNetSum += netObj;
              });

              // Cumulative order stats from system!
              const cumulativeOrders = getCumulativeOrdersCount(pName);

              return (
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 bg-[#040406] p-4 rounded-xl border border-zinc-900 text-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 block">عدد الأشهر</span>
                    <span className="font-bold text-white font-mono text-sm block">{personalRecords.length} م</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 block">الراتب المتراكم</span>
                    <span className="font-bold text-indigo-400 font-mono text-sm block">{baseSum.toLocaleString()} دج</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 block">س.إضافية</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm block">+{otSum.toLocaleString()} دج</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 block">الخصومات</span>
                    <span className="font-bold text-rose-500 font-mono text-sm block">-${dedSum.toLocaleString()} دج</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-emerald-400 block">ط.مستلمة</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm block">{cumulativeOrders.delivered} ط</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-rose-400 block">ط.مرتجعة</span>
                    <span className="font-bold text-rose-400 font-mono text-sm block">{cumulativeOrders.returned} ط</span>
                  </div>
                  <div className="space-y-0.5 col-span-2 md:col-span-1 bg-zinc-900/60 p-1 rounded">
                    <span className="text-[10px] text-indigo-400 block">صافي شامل</span>
                    <span className="font-bold text-indigo-300 font-mono text-sm block">{totalNetSum.toLocaleString()} دج</span>
                  </div>
                </div>
              );
            })()}

            {/* Chronological Monthly detail layout list */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
              {workers.filter(x => x.code === showCalc)
                .sort((a,b) => ((b as any).year - (a as any).year) || ((b as any).month - (a as any).month))
                .map(r => {
                  const otPayVal = ((r as any).overtimeHours || 0) * ((r as any).overtimeRate || 250);
                  const daily = calcDailyWage(r.baseSalary);
                  const hourly = calcHourlyWage(r.baseSalary, r.dailyHours || 8);
                  const absD = ((r as any).absenceDays || 0) * daily;
                  const misD = ((r as any).missingHours || 0) * hourly;
                  const expD = ((r as any).expenses || []).reduce((s: number, e: any) => s+e.amount, 0);
                  const net = Math.max(0, Math.round(r.baseSalary + otPayVal - (absD + misD + expD)));

                  // Month order performance
                  const perf = getOrdersCountForWorker(r.name, (r as any).month, r.year || yearFilter);

                  return (
                    <div key={r.id} className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 space-y-4">
                      
                      {/* Sub card label header block */}
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-900/40">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white">شهر {getMonthName((r as any).month)} {r.year}</span>
                          {r.paid ? (
                            <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/15 px-2 py-0.5 rounded-full font-bold">
                              ✓ تم الصرف
                            </span>
                          ) : (
                            <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/15 px-2 py-0.5 rounded-full font-bold">
                              بروز معلق
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditFromDetails(r)}
                            className="p-1 text-indigo-400 hover:text-white hover:bg-zinc-900 rounded cursor-pointer"
                            title="تعديل تفاصيل هذا الشهر"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => printWorkerDetail(r)}
                            className="p-1 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded cursor-pointer"
                            title="طباعة قسيمة فردية"
                          >
                            <Printer size={12} />
                          </button>
                          {session?.role !== "employee" && (
                            <button
                              onClick={() => setDeleteConfirm(r.id)}
                              className="p-1 text-rose-500 hover:text-white hover:bg-zinc-900 rounded cursor-pointer"
                              title="حذف هذا السجل الشهري"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 5 columns metric badge */}
                      <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                        <div className="bg-[#09090b] p-1.5 rounded">
                          <span className="text-zinc-500 block">س.إضافية</span>
                          <span className="font-bold text-emerald-400">{(r as any).overtimeHours || 0} س</span>
                        </div>
                        <div className="bg-[#09090b] p-1.5 rounded">
                          <span className="text-zinc-500 block">س.ناقصة</span>
                          <span className="font-bold text-rose-400">{(r as any).missingHours || 0} س</span>
                        </div>
                        <div className="bg-[#09090b] p-1.5 rounded">
                          <span className="text-zinc-500 block">غياب</span>
                          <span className="font-bold text-orange-400">{(r as any).absenceDays || 0} ي</span>
                        </div>
                        <div className="bg-[#09090b] p-1.5 rounded">
                          <span className="text-zinc-550 block">مستلمة</span>
                          <span className="font-bold text-emerald-400 font-mono">{perf.delivered}</span>
                        </div>
                        <div className="bg-[#09090b] p-1.5 rounded">
                          <span className="text-zinc-550 block">مرتجعة</span>
                          <span className="font-bold text-rose-400 font-mono">{perf.returned}</span>
                        </div>
                      </div>

                      {/* Cash breakdowns detail list */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1 bg-[#040406]/60 p-3 rounded">
                          <div className="flex justify-between">
                            <span className="text-zinc-400">الراتب الأساسي الشهر:</span>
                            <span className="font-mono text-zinc-300">{r.baseSalary.toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between text-emerald-400">
                            <span>قيمة الساعات الإضافية (+):</span>
                            <span className="font-mono">+{otPayVal.toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between text-rose-400">
                            <span>خصم أيام الغياب:</span>
                            <span className="font-mono">-${absD.toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between text-rose-400">
                            <span>خصم ساعات التأخير:</span>
                            <span className="font-mono">-${misD.toLocaleString()} دج</span>
                          </div>
                          <div className="flex justify-between text-orange-400">
                            <span>إجمالي سلفيات المصاريف:</span>
                            <span className="font-mono">-${expD.toLocaleString()} دج</span>
                          </div>
                          <div className="h-px bg-zinc-800 my-1" />
                          <div className="flex justify-between font-bold text-indigo-400">
                            <span>صافي راتب المقبوض:</span>
                            <span className="font-mono">{net.toLocaleString()} دج</span>
                          </div>
                          {r.paid && (
                            <p className="text-[10px] text-green-400 text-left mt-1">✓ صرفت: {r.paymentAmount?.toLocaleString() || net} دج بتاريخ {r.paymentDate || "-"}</p>
                          )}
                        </div>

                        {/* List individual expenses */}
                        <div className="space-y-1 bg-[#040406]/60 p-3 rounded overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">تفاصيل المصاريف الفردية والسلف بالشهر:</span>
                          {(!r.expenses || r.expenses.length === 0) ? (
                            <p className="text-[10px] text-zinc-600">لا توجد سحبيات مسجلة.</p>
                          ) : (
                            <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
                              {r.expenses.map((exItem: any) => (
                                <div key={exItem.id} className="flex justify-between items-center text-[11px] bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                                  <span>{exItem.desc}</span>
                                  <span className="font-mono text-rose-400">-{exItem.amount} دج</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

      {/* 4. نافذة إضافة وتعديل عامل (showForm) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form 
            onSubmit={handleSubmitForm}
            className="bg-[#09090b] border border-zinc-900 shadow-2xl rounded-2xl w-full max-w-2xl p-6 relative space-y-5 text-right"
            dir="rtl"
          >
            
            {/* Header Form */}
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <div className="flex items-center gap-2">
                {prevWorkerCode.current && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      if (prevWorkerCode.current) setShowCalc(prevWorkerCode.current);
                      prevWorkerCode.current = null;
                    }}
                    className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-all cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <h3 className="text-sm font-extrabold text-white">
                  {editId ? "تعديل القيود وضبط المرتب الشهري" : "توظيف وتفصيل بطاقة ملف لعامل جديد"}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowForm(false); prevWorkerCode.current = null; }} 
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Profile setup fields */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 border-b border-zinc-900 pb-1">4.2 معلومات العامل والهوية وبطاقة الراتب</h4>
                
                {/* Link with existing worker dropdown */}
                {!editId && (() => {
                  const uniqueCodes = Array.from(new Set(workers.map(w => w.code)));
                  const uniqueWorkersList = uniqueCodes.map(code => workers.find(w => w.code === code)!).filter(Boolean);
                  if (uniqueWorkersList.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-1 p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-lg text-right">
                      <label className="text-[10px] text-indigo-400 font-bold block">
                        🔗 تعبئة من ملف عامل مسجل مسبقاً (اختياري):
                      </label>
                      <select
                        onChange={(e) => {
                          const selectedCode = e.target.value;
                          if (selectedCode) {
                            const match = workers.find(w => w.code === selectedCode);
                            if (match) {
                              setFormCode(match.code);
                              setFormName(match.name);
                              setFormPhone(match.phone || "");
                              setFormRole(match.role || "Sales Handler");
                              setFormBaseSalary(match.baseSalary || 35000);
                              setFormDailyHours(match.dailyHours || 8);
                              setFormOvertimeRate((match as any).overtimeRate || 250);
                            }
                          }
                        }}
                        className="bg-[#040406] border border-indigo-900/40 rounded p-1.5 text-xs text-white outline-none mt-1 shadow-inner focus:border-indigo-500"
                      >
                        <option value="">{isRtl ? "-- اختر عاملاً لتعبئة البيانات تلقائياً --" : "-- Select an existing worker --"}</option>
                        {uniqueWorkersList.map(w => (
                          <option key={w.code} value={w.code}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">كود الموظف (الرمز المعرف)</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                    placeholder="مثال: 001"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">الاسم الكامل (إجباري)</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                    placeholder="الاسم الثلاثي واللقب"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">رقم الهاتف الهاتف المحمول</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                    placeholder="مكالمات الموظف"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">البريد الإلكتروني (للدخول إلى الموقع)</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                    placeholder="email@example.com"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">كلمة المرور (للدخول إلى الموقع)</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                    placeholder="أدخل كلمة المرور"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold">الدور الوظيفي والصفة</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    <option value="Sales Handler">مناوب مبيعات - Sales Handler</option>
                    <option value="Inventory Manager">تأطير المخازن - Inventory Manager</option>
                    <option value="Courier Delivery Handler">عون شحن وتوصيل - Courier</option>
                    <option value="Packaging Officer">فرز وتغليف - Packaging Officer</option>
                    <option value="Operations Director">إشراف وتسيير عام - Director</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold">الراتب الأساسي المعتاد</label>
                    <input
                      type="number"
                      value={formBaseSalary}
                      onChange={(e) => setFormBaseSalary(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={session?.role === "employee"}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold">ساعات العمل اليومية</label>
                    <input
                      type="number"
                      value={formDailyHours}
                      onChange={(e) => setFormDailyHours(Math.max(1, parseInt(e.target.value, 10) || 8))}
                      className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={session?.role === "employee"}
                    />
                  </div>
                </div>

                {/* 4.3 الدورة الحسابية */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 space-y-1.5 text-xs text-zinc-400">
                  <strong className="text-[10px] text-zinc-500 block">4.3 فترة الدورة الحسابية الملء التلقائي</strong>
                  <div className="flex justify-between text-[11px]">
                    <span>تاريخ البداية المستحق:</span>
                    <span className="font-mono text-zinc-200">{fillDates(formMonth, yearFilter).start}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>تاريخ النهاية المستحق:</span>
                    <span className="font-mono text-zinc-200">{fillDates(formMonth, yearFilter).end}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>عدد الأيام الإفتراضي بالدورة:</span>
                    <span className="font-mono text-indigo-400">{fillDates(formMonth, yearFilter).days} يوماً</span>
                  </div>
                </div>

              </div>

              {/* Math additions and deductions */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-500 border-b border-zinc-900 pb-1">الحساب المالي والجزاءات الفردية للفترة</h4>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold font-mono">شهر الراتب المستهدف للفترة الحالية</label>
                  <select
                    value={formMonth}
                    onChange={(e) => handleMonthChangeInForm(parseInt(e.target.value, 10))}
                    className="bg-[#040406] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none cursor-pointer font-bold"
                  >
                    {monthNamesAr.map((m, idx) => (
                      <option key={m} value={idx}>{getMonthName(idx)}</option>
                    ))}
                  </select>
                </div>

                {/* 4.4 الساعات الإضافية والتعويض (+) */}
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 flex flex-col gap-2">
                  <strong className="text-[10px] text-emerald-400">4.4 الساعات الإضافية والتعويض (+)</strong>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 font-bold block">مكان كتابة عدد الساعات الإضافية:</span>
                      <input
                        type="number"
                        placeholder="اكتب الساعات هنا"
                        value={formOvertimeHours}
                        onChange={(e) => setFormOvertimeHours(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#040406] text-center border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 font-bold block">مكان كتابة أجر الساعة الإضافية:</span>
                      <input
                        type="number"
                        placeholder="اكتب أجر الساعة هنا"
                        value={formOvertimeRate}
                        onChange={(e) => setFormOvertimeRate(Math.max(0, parseInt(e.target.value, 10) || 250))}
                        className="w-full bg-[#040406] text-center border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        title="عائد كل ساعة إضافية بالدينار"
                        disabled={session?.role === "employee"}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-emerald-500 font-mono mt-0.5 bg-[#030304] px-2 py-1 rounded">
                    <span>حسبة الساعات الإضافية:</span>
                    <span>+{formOvertimeHours} ساعة × {formOvertimeRate} دج = +{formOvertimeHours * formOvertimeRate} دج</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* 4.5 الساعات المفقودة */}
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 flex flex-col gap-1 justify-between">
                    <strong className="text-[10px] text-rose-400">4.5 ساعات تأخر منتقصة (-)</strong>
                    <input
                      type="number"
                      placeholder="ساعات"
                      value={formMissingHours}
                      onChange={(e) => setFormMissingHours(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#040406] text-center border border-zinc-800 rounded p-1 text-xs text-white font-mono outline-none"
                    />
                    <span className="text-[9px] text-rose-500 text-left mt-1 block">
                      -${Math.round(formMissingHours * calcHourlyWage(formBaseSalary, formDailyHours))} دج
                    </span>
                  </div>

                  {/* 4.6 أيام الغياب */}
                  <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-900 flex flex-col gap-1 justify-between">
                    <strong className="text-[10px] text-rose-500">4.6 غياب بالأيام (-)</strong>
                    <input
                      type="number"
                      placeholder="أيام الغياب"
                      value={formAbsenceDays}
                      onChange={(e) => setFormAbsenceDays(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#040406] text-center border border-zinc-800 rounded p-1 text-xs text-white font-mono outline-none"
                    />
                    <span className="text-[9px] text-rose-500 text-left mt-1 block">
                      -${Math.round(formAbsenceDays * calcDailyWage(formBaseSalary))} دج
                    </span>
                  </div>
                </div>

                {/* 4.7 إدارة المصاريف الفردية بالشهر */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 space-y-2">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                    <strong className="text-[10px] text-slate-350">4.7 مصاريف وسلفيات العقد الفردية</strong>
                    <div className="flex gap-1">
                      {onSectionChange && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = `?workerCode=${formCode}&workerName=${encodeURIComponent(formName)}&month=${formMonth}&year=${yearFilter}`;
                            window.history.pushState(null, "", url);
                            onSectionChange("expenses");
                          }}
                          className="px-2 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800/50 rounded text-[9px] font-bold hover:bg-purple-900/50 hover:text-white transition cursor-pointer"
                        >
                          صفحة المصاريف
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNewExpDesc("");
                          setNewExpAmount(0);
                          setNewExpDate(new Date().toISOString().split("T")[0]);
                          setShowExpenseModal(true);
                        }}
                        className="px-2 py-0.5 bg-zinc-900 text-zinc-350 border border-zinc-800 rounded text-[9px] font-bold hover:text-white transition cursor-pointer"
                      >
                        إضافة سلفة
                      </button>
                    </div>
                  </div>

                  {formExpenses.length === 0 ? (
                    <p className="text-[10px] text-zinc-600">لا توجد سلفيات في الدورة المحددة.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[80px] overflow-y-auto pl-1">
                      {formExpenses.map(e => (
                        <div key={e.id} className="flex justify-between items-center text-[11px] bg-zinc-900 border border-zinc-900 px-2 py-1 rounded">
                          <span>{e.desc}</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-rose-400">-{e.amount} دج</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIndividualExpenseValue(e.id)}
                              className="text-zinc-600 hover:text-red-400 cursor-pointer"
                            >
                              <Trash size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 text-left font-semibold">إجمالي المصاريف: -{formExpenses.reduce((s,x)=>s+x.amount,0)} دج</div>
                </div>

                {/* 4.8 ملخص الراتب الصافي للفترة */}
                <div className="p-3 bg-indigo-950/40 rounded-lg border border-indigo-900/40 block text-xs">
                  <span className="text-[10px] text-indigo-400 font-bold block mb-1">4.8 بطاقة ملخص الحسبة وصافي الراتب المستحق</span>
                  
                  {(() => {
                    const opPay = formOvertimeHours * formOvertimeRate;
                    const abD = formAbsenceDays * calcDailyWage(formBaseSalary);
                    const misD = formMissingHours * calcHourlyWage(formBaseSalary, formDailyHours);
                    const expSum = formExpenses.reduce((s,x)=>s+x.amount, 0);
                    const netVal = Math.max(0, Math.round(formBaseSalary + opPay - (abD + misD + expSum)));
                    
                    return (
                      <div className="space-y-1 text-slate-350">
                        <div className="flex justify-between">
                          <span>الأساسي + الإضافي المنجز:</span>
                          <span className="font-mono text-zinc-100">{(formBaseSalary + opPay).toLocaleString()} دج</span>
                        </div>
                        <div className="flex justify-between text-rose-450 text-[10px]">
                          <span>إجمالي الخصومات (غياب/تأخير/مصاريف):</span>
                          <span className="font-mono">-${Math.round(abD + misD + expSum).toLocaleString()} دج</span>
                        </div>
                        <div className="h-px bg-indigo-900 my-1"/>
                        <div className="flex justify-between font-bold text-white text-sm">
                          <span>صافي المستحق الصافي:</span>
                          <span className="font-mono text-indigo-400">{netVal.toLocaleString()} دج</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 4.9 خيارات تأكيد الدفع الفوري */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formPaid}
                      onChange={(e) => setFormPaid(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-650 accent-indigo-600 cursor-pointer"
                    />
                    <span>✓ تم تسوية وصرف الراتب لهذه الفترة</span>
                  </label>

                  {formPaid && (
                    <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-[10px] text-zinc-500 font-bold">تاريخ الصرف والدفع</span>
                        <input
                          type="date"
                          value={formPaymentDate}
                          onChange={(e) => setFormPaymentDate(e.target.value)}
                          className="bg-[#040406] border border-zinc-800 rounded p-1 px-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-[10px] text-zinc-500 font-bold">المبلغ الفعلي المدفوع دج</span>
                        <input
                          type="number"
                          value={formBaseSalary}
                          readOnly
                          className="bg-zinc-900/60 border border-transparent rounded p-1 px-2 text-xs text-zinc-450 font-mono outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Form actions footer bar */}
            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => { setShowForm(false); prevWorkerCode.current = null; }}
                className="px-4 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg text-xs font-bold hover:text-white"
              >
                إلغاء الأمر
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-md"
              >
                {editId ? "حفظ التعديلات" : "توظيف وحفظ"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 4.7.1 النافذة الملحقة لمصروف جديد داخل الفورم */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl w-full max-w-sm p-5 space-y-4 text-right" dir="rtl">
            <h4 className="text-xs font-extrabold text-white border-b border-zinc-900 pb-1">إضافة بند سلفة أو اقتطاع مخصص</h4>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">بيان المصروف والوصف</span>
                <input
                  type="text"
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  className="bg-[#040406] border border-zinc-800 rounded p-2 text-xs text-white"
                  placeholder="مثال: سلفة نقدية لظرف خاص"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">المبلغ المخصوم (دج)</span>
                <input
                  type="number"
                  value={newExpAmount}
                  onChange={(e) => setNewExpAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="bg-[#040406] border border-zinc-800 rounded p-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500 font-bold">التاريخ</span>
                <input
                  type="date"
                  value={newExpDate}
                  onChange={(e) => setNewExpDate(e.target.value)}
                  className="bg-[#040406] border border-zinc-800 rounded p-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="px-3 py-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddIndividualExpenseValue}
                className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-xs font-bold"
              >
                تأكيد البند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. نافذة الصرف الجماعي والدفع (showPayModal) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl w-full max-w-md p-5 relative shadow-2xl space-y-4 text-right" dir="rtl">
            
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                <DollarSign size={13} className="text-emerald-400" />
                <span>تسوية الحسابات الشهرية وصرف الأجور للعمل</span>
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={15} /></button>
            </div>

            <p className="text-[11px] text-zinc-400">حدد الأشهر التي تود تمييزها كمدفوعة ومصروفة بالكامل الآن لموظف الكود: <b>{payModalCode}</b></p>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {workers.filter(w => w.code === payModalCode).map(w => {
                const isSelected = selectedMonthsToPay.includes(w.id);
                
                // net
                const ot = ((w as any).overtimeHours || 0) * ((w as any).overtimeRate || 250);
                const daily = calcDailyWage(w.baseSalary);
                const hourly = calcHourlyWage(w.baseSalary, w.dailyHours || 8);
                const absD = ((w as any).absenceDays || 0) * daily;
                const misD = ((w as any).missingHours || 0) * hourly;
                const expD = ((w as any).expenses || []).reduce((s: number, e: any) => s+e.amount,0);
                const net = Math.max(0, Math.round(w.baseSalary + ot - (absD + misD + expD)));

                return (
                  <label 
                    key={w.id} 
                    className={`flex justify-between items-center p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                      isSelected ? "bg-emerald-950/20 border-emerald-900 text-white" : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedMonthsToPay(selectedMonthsToPay.filter(id => id !== w.id));
                          } else {
                            setSelectedMonthsToPay([...selectedMonthsToPay, w.id]);
                          }
                        }}
                        className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                      />
                      <span>شهر {getMonthName((w as any).month)} {w.year}</span>
                    </div>
                    <span className="font-mono font-bold text-indigo-400">{net.toLocaleString()} دج</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-1.5 border-t border-zinc-900 pt-3">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-3 py-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg text-xs"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={handleConfirmMassPayments}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                تأكيد وباقي الصرف
              </button>
            </div>

          </div>
        </div>
      )}

      {/* deleteConfirm Dialog */}
      {deleteConfirm && (() => {
        const workerToDelete = workers.find(x => x.id === deleteConfirm);
        const workerCode = workerToDelete?.code;
        const workerRecords = workers.filter(w => w.code === workerCode);
        const workerName = workerToDelete?.name || "";

        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl" dir="rtl">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 justify-end">
                <span>خيارات حذف بيانات العامل: {workerName}</span>
                <span className="text-rose-500">⚠</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                يرجى تحديد الأشهر التي ترغب في حذفها للعامل من القائمة أدناه، أو اختيار حذف الملف بالكامل:
              </p>

              {/* Checklist representing worker records/months */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[10px] text-zinc-500 font-bold mb-1">📅 الأشهر المسجلة لهذا العامل:</p>
                {workerRecords.map((r: any) => {
                  const isChecked = selectedMonthsToDelete.includes(r.id);
                  const mName = lang === "ar" ? monthNamesAr[r.month] : (lang === "fr" ? monthNamesFr[r.month] : monthNamesEn[r.month]);
                  return (
                    <label key={r.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer hover:bg-zinc-900/50 p-1.5 rounded transition">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedMonthsToDelete(selectedMonthsToDelete.filter(id => id !== r.id));
                          } else {
                            setSelectedMonthsToDelete([...selectedMonthsToDelete, r.id]);
                          }
                        }}
                        className="rounded border-zinc-800 text-rose-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-medium">{mName} / {r.year}</span>
                    </label>
                  );
                })}
              </div>
              
              <div className="space-y-2 pt-2">
                <button 
                  type="button" 
                  onClick={handleDeleteSelectedMonths} 
                  disabled={selectedMonthsToDelete.length === 0}
                  className="w-full py-2.5 px-3 bg-rose-650 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow flex items-center justify-center gap-1.5"
                >
                  <span>🗑️ حذف الأشهر المحددة ({selectedMonthsToDelete.length})</span>
                </button>
                <button 
                  type="button" 
                  onClick={handleDeleteEntireWorkerProfile} 
                  className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-500 hover:text-amber-400 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>⚠️ حذف ملف العامل بالكامل (كل شهوره وتاريخه)</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setDeleteConfirm(null)} 
                  className="w-full py-2 bg-transparent text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center"
                >
                  تراجع وإلغاء
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Undo Toast component overlay */}
      {lastDeletedWorker && (
        <UndoToast
          workerName={lastDeletedWorker.name}
          onUndo={handleUndoDeleteRecord}
          onClose={() => setLastDeletedWorker(null)}
        />
      )}

    </div>
  );
};

export default WorkersView;

