/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { FixedExpense, VariableExpense, AdExpense, Worker, LanguageType } from "../types";
import { 
  Receipt, Plus, Edit2, Trash2, Printer, 
  Megaphone, Users, Calendar, Coins, ArrowUpRight, 
  Layers, Lock, Sparkles, TrendingUp
} from "lucide-react";

interface WorkerExpenseEntry {
  id: string;
  workerCode: string;
  workerName: string; // fetched automatically
  amount: number;
  description: string;
  notes: string;
  date: string;
  month: string;
  year: number;
}

interface ExpensesViewProps {
  expenses: any[]; // Kept for prop type compatibility
  onSaveExpenses: (arr: any[]) => void; // Kept for compatibility
  lang: LanguageType;
  onSoftDeleteExpense: (id: string) => void; // Kept for compatibility
  onTriggerNotification: (msg: string, type?: "success" | "info" | "warning") => void;
  onSectionChange?: (tab: string) => void;
}

const monthNamesAr = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function ExpensesView({
  lang,
  onTriggerNotification,
  onSectionChange
}: ExpensesViewProps) {
  // Choose default year and month based on current local time
  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const currentMonthAr = monthNamesAr[todayObj.getMonth()];

  // 13. State variables
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthAr);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Helper for formatting YYYY-MM based on selected month and year
  const getSelectedMonthYearKey = (): string => {
    const mIdx = monthNamesAr.indexOf(selectedMonth);
    const mm = String(mIdx === -1 ? 1 : mIdx + 1).padStart(2, "0");
    return `${selectedYear}-${mm}`;
  };

  // Collections (with storage persistence)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => {
    const stored = localStorage.getItem("fixedExpenses");
    return stored ? JSON.parse(stored) : [
      { id: "fe-demo-1", name: "كراء الورشة والمقر الرئيسي", amount: 25000, date: `${currentYear}-01-01` },
      { id: "fe-demo-2", name: "اشتراك إنترنت للعمل", amount: 4800, date: `${currentYear}-01-05` }
    ];
  });

  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>(() => {
    const stored = localStorage.getItem("variableExpenses");
    return stored ? JSON.parse(stored) : [
      { id: "ve-demo-1", name: "شراء شريط لاصق وأكياس تغليف شحن", amount: 12000, date: `${currentYear}-06-01`, monthYear: `${currentYear}-06` }
    ];
  });

  const [workerExpenseEntries, setWorkerExpenseEntries] = useState<WorkerExpenseEntry[]>(() => {
    const stored = localStorage.getItem("workerExpenseEntries");
    return stored ? JSON.parse(stored) : [];
  });

  const [adExpenses, setAdExpenses] = useState<AdExpense[]>(() => {
    const stored = localStorage.getItem("adExpenses");
    return stored ? JSON.parse(stored) : [
      { 
        id: "ad-demo-1", 
        platform: "Facebook", 
        amountUSD: 120, 
        exchangeRate: 245, 
        amountCurrency: 29400, 
        startDate: `${currentYear}-06-01`, 
        endDate: `${currentYear}-06-15`, 
        monthYear: `${currentYear}-06` 
      }
    ];
  });

  const [allFixedExpenseNames, setAllFixedExpenseNames] = useState<string[]>(() => {
    const stored = localStorage.getItem("allFixedExpenseNames");
    return stored ? JSON.parse(stored) : ["كراء الورشة والمقر الرئيسي", "اشتراك إنترنت للعمل", "فاتورة مياه وكهرباء غاز", "اشتراك ساس تليغرام بوت"];
  });

  const [allVariableExpenseNames, setAllVariableExpenseNames] = useState<string[]>(() => {
    const stored = localStorage.getItem("allVariableExpenseNames");
    return stored ? JSON.parse(stored) : ["شراء شريط لاصق وأكياس تغليف شحن", "كرتون تغليف مقوى سميك", "صيانة آلات وماكينات الخياطة", "فاتورة وقود مركبة التوصيل"];
  });

  const [fixedExpenseLastAmounts, setFixedExpenseLastAmounts] = useState<Record<string, number>>(() => {
    const stored = localStorage.getItem("fixedExpenseLastAmounts");
    return stored ? JSON.parse(stored) : {
      "كراء الورشة والمقر الرئيسي": 25000,
      "اشتراك إنترنت للعمل": 4800
    };
  });

  const [varExpenseLastAmounts, setVarExpenseLastAmounts] = useState<Record<string, number>>(() => {
    const stored = localStorage.getItem("varExpenseLastAmounts");
    return stored ? JSON.parse(stored) : {
      "شراء شريط لاصق وأكياس تغليف شحن": 12000
    };
  });

  const [workers, setWorkers] = useState<Worker[]>(() => {
    const stored = localStorage.getItem("corevia_workers_v1");
    return stored ? JSON.parse(stored) : [];
  });

  // 13. Form Input State Variables
  // Fixed Expenses fields
  const [fixedName, setFixedName] = useState<string>("");
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [fixedDate, setFixedDate] = useState<string>("");
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);

  // Variable Expenses fields
  const [varName, setVarName] = useState<string>("");
  const [varAmount, setVarAmount] = useState<number>(0);
  const [varDate, setVarDate] = useState<string>("");
  const [editingVarId, setEditingVarId] = useState<string | null>(null);

  // Worker Expenses fields
  const [workerCode, setWorkerCode] = useState<string>("");
  const [workerAmount, setWorkerAmount] = useState<number>(0);
  const [workerDate, setWorkerDate] = useState<string>("");
  const [workerDesc, setWorkerDesc] = useState<string>("");
  const [workerNotes, setWorkerNotes] = useState<string>("");

  // Ad Expenses fields
  const [adAmountUsd, setAdAmountUsd] = useState<number>(0);
  const [adExchangeRate, setAdExchangeRate] = useState<number>(250);
  const [adStartDate, setAdStartDate] = useState<string>("");
  const [adEndDate, setAdEndDate] = useState<string>("");
  const [editingAdId, setEditingAdId] = useState<string | null>(null);

  // 10.1 & 10.2 helpers to compute first and last of month
  const firstOfMonth = (m: string, y: number): string => {
    const mIdx = monthNamesAr.indexOf(m);
    const mm = String(mIdx === -1 ? 1 : mIdx + 1).padStart(2, "0");
    return `${y}-${mm}-01`;
  };

  const lastOfMonth = (m: string, y: number): string => {
    const mIdx = monthNamesAr.indexOf(m);
    const lastDay = new Date(y, mIdx === -1 ? 1 : mIdx + 1, 0).getDate();
    const mm = String(mIdx === -1 ? 1 : mIdx + 1).padStart(2, "0");
    return `${y}-${mm}-${String(lastDay).padStart(2, "0")}`;
  };

  // Synchronizers of persistence states
  useEffect(() => {
    localStorage.setItem("fixedExpenses", JSON.stringify(fixedExpenses));
  }, [fixedExpenses]);

  useEffect(() => {
    localStorage.setItem("variableExpenses", JSON.stringify(variableExpenses));
  }, [variableExpenses]);

  useEffect(() => {
    localStorage.setItem("workerExpenseEntries", JSON.stringify(workerExpenseEntries));
  }, [workerExpenseEntries]);

  useEffect(() => {
    localStorage.setItem("adExpenses", JSON.stringify(adExpenses));
  }, [adExpenses]);

  useEffect(() => {
    localStorage.setItem("allFixedExpenseNames", JSON.stringify(allFixedExpenseNames));
  }, [allFixedExpenseNames]);

  useEffect(() => {
    localStorage.setItem("allVariableExpenseNames", JSON.stringify(allVariableExpenseNames));
  }, [allVariableExpenseNames]);

  useEffect(() => {
    localStorage.setItem("fixedExpenseLastAmounts", JSON.stringify(fixedExpenseLastAmounts));
  }, [fixedExpenseLastAmounts]);

  useEffect(() => {
    localStorage.setItem("varExpenseLastAmounts", JSON.stringify(varExpenseLastAmounts));
  }, [varExpenseLastAmounts]);

  // Synchronize workers lists
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("corevia_workers_v1");
      if (stored) {
        setWorkers(JSON.parse(stored));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 8.1 Read URL search params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("workerCode");
    const name = params.get("workerName");
    const mVal = params.get("month");
    const yVal = params.get("year");

    if (code) {
      setWorkerCode(code);
      if (mVal !== null) {
        const mIdx = parseInt(mVal, 10);
        if (!isNaN(mIdx) && mIdx >= 0 && mIdx < 12) {
          setSelectedMonth(monthNamesAr[mIdx]);
        }
      }
      if (yVal !== null) {
        const yr = parseInt(yVal, 10);
        if (!isNaN(yr)) {
          setSelectedYear(yr);
        }
      }
      
      const mon = mVal !== null ? monthNamesAr[parseInt(mVal, 10)] : selectedMonth;
      const yr = yVal !== null ? parseInt(yVal, 10) : selectedYear;
      setWorkerDate(firstOfMonth(mon, yr));
      setWorkerDesc("");
      setWorkerAmount(0);
      setWorkerNotes("");
      
      onTriggerNotification(`مرحباً! تم تهيئة مصروف وسلفة الموظف ${name || ""} كود ${code} تلقائياً.`, "info");
    }
  }, []);

  // 10.4 Sync Dates automatically when month or year changes (for add mode only)
  useEffect(() => {
    const firstDate = firstOfMonth(selectedMonth, selectedYear);
    if (!editingFixedId) setFixedDate(firstDate);
    if (!editingVarId) setVarDate(firstDate);
    setWorkerDate(firstDate);
    setAdStartDate(firstDate);
    setAdEndDate(lastOfMonth(selectedMonth, selectedYear));
  }, [selectedMonth, selectedYear]);

  // 14. Derived calculations
  // 9.1 totalFixed
  const totalFixed = useMemo(() => {
    return fixedExpenses.reduce((s, f) => s + f.amount, 0);
  }, [fixedExpenses]);

  // 9.2 totalVariable
  const monthVar = useMemo(() => {
    const key = getSelectedMonthYearKey();
    return variableExpenses.filter(e => e.monthYear === key);
  }, [variableExpenses, selectedMonth, selectedYear]);

  const totalVariable = useMemo(() => {
    return monthVar.reduce((s, e) => s + e.amount, 0);
  }, [monthVar]);

  // 9.3 totalWorkerExpenses
  const monthWorkerEntries = useMemo(() => {
    return workerExpenseEntries.filter(e => e.month === selectedMonth && e.year === selectedYear);
  }, [workerExpenseEntries, selectedMonth, selectedYear]);

  const totalWorkerExpenses = useMemo(() => {
    return monthWorkerEntries.reduce((s, e) => s + e.amount, 0);
  }, [monthWorkerEntries]);

  // 9.5 totalAdExpenses (In Dinar)
  const monthAdExpenses = useMemo(() => {
    const key = getSelectedMonthYearKey();
    return adExpenses.filter(e => e.monthYear === key);
  }, [adExpenses, selectedMonth, selectedYear]);

  const totalAdExpenses = useMemo(() => {
    return monthAdExpenses.reduce((s, e) => s + e.amountCurrency, 0);
  }, [monthAdExpenses]);

  // 9.4 grandTotal without Ads
  const grandTotal = useMemo(() => {
    return totalFixed + totalVariable + totalWorkerExpenses;
  }, [totalFixed, totalVariable, totalWorkerExpenses]);

  // Derived workers datalist variables
  const uniqueWorkerCodes = useMemo(() => {
    return [...new Set(workers.map(w => w.code))].sort();
  }, [workers]);

  const workerNamesByCode = useMemo(() => {
    const mapping: Record<string, string> = {};
    workers.forEach(w => {
      mapping[w.code] = w.name;
    });
    return mapping;
  }, [workers]);

  // Year filter parameters
  const yearOptions = useMemo(() => {
    const arr = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      arr.push(i);
    }
    return arr;
  }, [currentYear]);

  // Focus and clear helper
  const handleFocusSelect = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0") {
      e.target.select();
    }
  };

  // 5.1 Autofill Fixed Expense amount on list selection or name typing
  const handleFixedNameChange = (val: string) => {
    setFixedName(val);
    if (fixedExpenseLastAmounts[val] !== undefined) {
      setFixedAmount(fixedExpenseLastAmounts[val]);
    }
  };

  // 6.1 Autofill Variable Expense amount on list selection or name typing
  const handleVarNameChange = (val: string) => {
    setVarName(val);
    if (varExpenseLastAmounts[val] !== undefined) {
      setVarAmount(varExpenseLastAmounts[val]);
    }
  };

  // Actions creators
  // Fixed Expenses Add/Edit Handler
  const handleAddFixed = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fixedName.trim() || fixedAmount <= 0) {
      onTriggerNotification("يرجى ملأ بيان المصروف ووضع قيمة أكبر من الصفر", "warning");
      return;
    }

    const trimmedName = fixedName.trim();

    if (editingFixedId) {
      setFixedExpenses(prev => prev.map(x => x.id === editingFixedId ? {
        ...x,
        name: trimmedName,
        amount: fixedAmount,
        date: fixedDate
      } : x));
      setEditingFixedId(null);
      onTriggerNotification(`تم تعديل قيد المصروف الثابت (${trimmedName}) بنجاح.`);
    } else {
      const newFixed: FixedExpense = {
        id: `fe-${Date.now()}`,
        name: trimmedName,
        amount: fixedAmount,
        date: fixedDate || undefined
      } as any;
      setFixedExpenses(prev => [newFixed, ...prev]);
      onTriggerNotification(`تم تسجيل المصروف الثابت الجديد (${trimmedName}) بقيمة ${fixedAmount.toLocaleString()} دج.`);
    }

    // Persist lists and caches
    setFixedExpenseLastAmounts(prev => ({ ...prev, [trimmedName]: fixedAmount }));
    if (!allFixedExpenseNames.includes(trimmedName)) {
      setAllFixedExpenseNames(prev => [...prev, trimmedName]);
    }

    // Reset input fields
    setFixedName("");
    setFixedAmount(0);
    setFixedDate(firstOfMonth(selectedMonth, selectedYear));
  };

  const handleEditFixed = (expense: FixedExpense) => {
    setEditingFixedId(expense.id);
    setFixedName(expense.name);
    setFixedAmount(expense.amount);
    setFixedDate(expense.date || firstOfMonth(selectedMonth, selectedYear));
  };

  const handleDeleteFixed = (id: string) => {
    const deleted = fixedExpenses.find(x => x.id === id);
    setFixedExpenses(prev => prev.filter(x => x.id !== id));
    if (deleted) {
      onTriggerNotification(`تم حذف المصروف الثابت (${deleted.name}) بنجاح.`);
    }
  };

  // Variable Expenses Add/Edit Handler
  const handleAddVariable = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!varName.trim() || varAmount <= 0) {
      onTriggerNotification("يرجى ملأ بيان المصروف المتغير بقيمة أعلى من الصفر", "warning");
      return;
    }

    const trimmedName = varName.trim();
    const key = getSelectedMonthYearKey();

    if (editingVarId) {
      setVariableExpenses(prev => prev.map(x => x.id === editingVarId ? {
        ...x,
        name: trimmedName,
        amount: varAmount,
        date: varDate,
        monthYear: key
      } : x));
      setEditingVarId(null);
      onTriggerNotification(`تم تعديل قيد المصروف الرياضي المتغير (${trimmedName}) بنجاح.`);
    } else {
      const newVar: VariableExpense = {
        id: `ve-${Date.now()}`,
        name: trimmedName,
        amount: varAmount,
        date: varDate,
        monthYear: key
      };
      setVariableExpenses(prev => [newVar, ...prev]);
      onTriggerNotification(`تم تسجيل المصروف المتغير الجديد (${trimmedName}) بقيمة ${varAmount.toLocaleString()} دج للشهر المحدد.`);
    }

    // Update auto amounts
    setVarExpenseLastAmounts(prev => ({ ...prev, [trimmedName]: varAmount }));
    if (!allVariableExpenseNames.includes(trimmedName)) {
      setAllVariableExpenseNames(prev => [...prev, trimmedName]);
    }

    // Reset fields
    setVarName("");
    setVarAmount(0);
    setVarDate(firstOfMonth(selectedMonth, selectedYear));
  };

  const handleEditVariable = (expense: VariableExpense) => {
    setEditingVarId(expense.id);
    setVarName(expense.name);
    setVarAmount(expense.amount);
    setVarDate(expense.date);
  };

  const handleDeleteVariable = (id: string) => {
    const deleted = variableExpenses.find(x => x.id === id);
    setVariableExpenses(prev => prev.filter(x => x.id !== id));
    if (deleted) {
      onTriggerNotification(`تم حذف المصروف المتغير (${deleted.name}) بنجاح.`);
    }
  };

  // Ad Expenses Add/Edit
  const handleAddAd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adAmountUsd <= 0 || adExchangeRate <= 0) {
      onTriggerNotification("يرجى ملأ قيمة ميزانية الإعلان وسعر الصرف بشكل سليم", "warning");
      return;
    }

    const computedDzd = Math.round(adAmountUsd * adExchangeRate);
    const key = getSelectedMonthYearKey();

    if (editingAdId) {
      setAdExpenses(prev => prev.map(x => x.id === editingAdId ? {
        ...x,
        platform: "Facebook",
        amountUSD: adAmountUsd,
        exchangeRate: adExchangeRate,
        amountCurrency: computedDzd,
        startDate: adStartDate,
        endDate: adEndDate,
        monthYear: key
      } : x));
      setEditingAdId(null);
      onTriggerNotification(`تم تعديل قيد إشهار التمويل بنجاح.`);
    } else {
      const newAd: AdExpense = {
        id: `ad-${Date.now()}`,
        platform: "Facebook",
        amountUSD: adAmountUsd,
        exchangeRate: adExchangeRate,
        amountCurrency: computedDzd,
        startDate: adStartDate,
        endDate: adEndDate,
        monthYear: key
      };
      setAdExpenses(prev => [newAd, ...prev]);
      onTriggerNotification(`تم تسجيل إعلان جديد بقيمة $${adAmountUsd} ما يعادل ${computedDzd.toLocaleString()} دج.`);
    }

    // Reset ad fields
    setAdAmountUsd(0);
    setAdExchangeRate(250);
    setAdStartDate(firstOfMonth(selectedMonth, selectedYear));
    setAdEndDate(lastOfMonth(selectedMonth, selectedYear));
  };

  const handleEditAd = (ad: AdExpense) => {
    setEditingAdId(ad.id);
    setAdAmountUsd(ad.amountUSD);
    setAdExchangeRate(ad.exchangeRate);
    setAdStartDate(ad.startDate);
    setAdEndDate(ad.endDate);
  };

  const handleDeleteAd = (id: string) => {
    setAdExpenses(prev => prev.filter(x => x.id !== id));
    onTriggerNotification("تم حذف قيد الإشهار بنجاح.");
  };

  // 8.2 Worker Expenses & Bidirectional synchronization
  const handleAddWorkerExpense = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workerCode.trim() || workerAmount <= 0) {
      onTriggerNotification("يرجى تحديد كود العامل وقيمة المبلغ", "warning");
      return;
    }

    const trimmedCode = workerCode.trim();
    const resolvedName = workerNamesByCode[trimmedCode] || "عامل غير مسجل";

    const newWXE: WorkerExpenseEntry = {
      id: `wxe-${Date.now()}`,
      workerCode: trimmedCode,
      workerName: resolvedName,
      amount: workerAmount,
      description: workerDesc.trim() || "اقتطاع/سلفة عادية",
      notes: workerNotes.trim(),
      date: workerDate,
      month: selectedMonth,
      year: selectedYear
    };

    // 8.2 Save workerExpenseEntries
    setWorkerExpenseEntries(prev => [newWXE, ...prev]);

    // Save/Sync to internal Worker object inside local workers array
    try {
      const storedWorkers = localStorage.getItem("corevia_workers_v1");
      let workersList: Worker[] = storedWorkers ? JSON.parse(storedWorkers) : [];
      let updated = false;

      const targetMonthIndex = monthNamesAr.indexOf(selectedMonth);

      workersList = workersList.map(w => {
        const matchesCode = w.code === trimmedCode;
        const matchesMonth = (w as any).month === targetMonthIndex && (w as any).year === selectedYear;

        if (matchesCode && matchesMonth) {
          updated = true;
          const currentExpList = (w as any).expenses || [];
          const syncedExpense = {
            id: newWXE.id, // mapped id
            desc: newWXE.description,
            amount: newWXE.amount,
            date: newWXE.date,
            notes: newWXE.notes || undefined
          };
          return {
            ...w,
            expenses: [...currentExpList, syncedExpense]
          } as any;
        }
        return w;
      });

      if (updated) {
        localStorage.setItem("corevia_workers_v1", JSON.stringify(workersList));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.error("Failed to sync worker expense inwards", err);
    }

    onTriggerNotification(`تم تسجيل مبلغ ${workerAmount.toLocaleString()} دج كخصم/سلفة للعامل: ${resolvedName}.`);

    // Reset fields except workerCode to optimize velocity
    setWorkerDesc("");
    setWorkerAmount(0);
    setWorkerNotes("");
  };

  // Delete worker expense with inside deletion (inverse synchronization)
  const handleDeleteWorkerExpense = (id: string, code: string, desc: string, valAmount: number) => {
    // Save to list
    setWorkerExpenseEntries(prev => prev.filter(x => x.id !== id));

    try {
      const storedWorkers = localStorage.getItem("corevia_workers_v1");
      if (storedWorkers) {
        let workersList: Worker[] = JSON.parse(storedWorkers);
        let updated = false;
        const targetMonthIndex = monthNamesAr.indexOf(selectedMonth);

        workersList = workersList.map(w => {
          const matchesCode = w.code === code;
          const matchesMonth = (w as any).month === targetMonthIndex && (w as any).year === selectedYear;

          if (matchesCode && matchesMonth) {
            const currentExpList = (w as any).expenses || [];
            // Remove matching expense inside the worker object
            const filtered = currentExpList.filter((e: any) => e.id !== id && !(e.desc === desc && e.amount === valAmount));
            if (filtered.length !== currentExpList.length) {
              updated = true;
            }
            return {
              ...w,
              expenses: filtered
            } as any;
          }
          return w;
        });

        if (updated) {
          localStorage.setItem("corevia_workers_v1", JSON.stringify(workersList));
          window.dispatchEvent(new Event("storage"));
        }
      }
    } catch (err) {
      console.error("Failed to sync deleted worker expense inwards", err);
    }

    onTriggerNotification("تم حذف مصروف العامل ومزامنته بملف الرواتب والعمل بنجاح.");
  };

  // 11. Printing report functions
  // Custom document wrapper
  const printWindow = (html: string) => {
    const pWin = window.open("", "_blank");
    if (!pWin) {
      alert("يرجى تمكين النوافذ المنبثقة لرؤية تقرير الطباعة");
      return;
    }
    pWin.document.write(`
      <html>
        <head>
          <title>طباعة قسيمة تقرير مالي</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { 
              font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; 
              direction: rtl; 
              padding: 30px; 
              color: #1f2937;
              background-color: #ffffff;
            }
            h1, h2, h3 { margin-top: 0; color: #111827; }
            h1 { font-size: 20px; text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
            h3 { font-size: 14px; margin-top: 25px; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: right; font-size: 11.5px; }
            th { background-color: #f9fafb; font-weight: bold; color: #374151; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 10px; border-radius: 4px; background: #f3f4f6; }
            .summary-box { 
              margin-top: 25px; 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              padding: 15px; 
              background-color: #fafafa;
            }
            .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
            .total-row { border-t: 1px solid #dddddd; padding-top: 8px; font-weight: bold; font-size: 14px; color: #059669; }
            .footer-note { text-align: center; font-size: 9px; color: #9ca3af; margin-top: 40px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${html}
          <div class="footer-note">صادر عن برنامج Corevia السحابي لإدارة الأعمال والمبيعات والرواتب</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    pWin.document.close();
  };

  // 11.1 printFixed()
  const printFixed = () => {
    let tableRows = "";
    fixedExpenses.forEach(e => {
      tableRows += `
        <tr>
          <td>${e.date || "-"}</td>
          <td>${e.name}</td>
          <td style="font-weight:bold; font-family: monospace;">${e.amount.toLocaleString()} دج</td>
        </tr>
      `;
    });

    const content = `
      <h1>تقرير الأعباء والمصاريف الثابتة التراكمية</h1>
      <h3>حسابات تصفية المصاريف الدائمة الكلية</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 20%;">التاريخ</th>
            <th>الوصف / قيد الاستحقاق</th>
            <th style="width: 25%;">القيمة المسددة</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="3" style="text-align:center; color:#9ca3af;">لا توجد قيود أعباء ثابتة مسجلة</td></tr>`}
        </tbody>
      </table>
      <div class="summary-box">
        <div class="summary-row" style="font-size:13px; font-weight:bold;">
          <span>إجمالي المصاريف الثابتة التراكمية:</span>
          <span style="font-family: monospace; color: #ea580c;">${totalFixed.toLocaleString()} دج</span>
        </div>
      </div>
    `;
    printWindow(content);
  };

  // 11.2 printVariable()
  const printVariable = () => {
    let tableRows = "";
    monthVar.forEach(e => {
      tableRows += `
        <tr>
          <td>${e.date}</td>
          <td>${e.name}</td>
          <td style="font-weight:bold; font-family: monospace;">${e.amount.toLocaleString()} دج</td>
        </tr>
      `;
    });

    const content = `
      <h1>تقرير المصاريف التشغيلية المتغيرة لشهر: ${selectedMonth} ${selectedYear}</h1>
      <h3>المصاريف والتوريدات المصاحبة للعمل والمشحونة لمبيعات الفترة</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 20%;">التاريخ</th>
            <th>البيان وقنوات الاستقطاع</th>
            <th style="width: 25%;">القيمة المسددة</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="3" style="text-align:center; color:#9ca3af;">لا توجد مصاريف متغيرة لهذا الشهر</td></tr>`}
        </tbody>
      </table>
      <div class="summary-box">
        <div class="summary-row" style="font-size:13px; font-weight:bold;">
          <span>مجموع المصاريف المتغيرة للفترة:</span>
          <span style="font-family: monospace; color: #2563eb;">${totalVariable.toLocaleString()} دج</span>
        </div>
      </div>
    `;
    printWindow(content);
  };

  // 11.3 printAll()
  const printAll = () => {
    let fRows = "";
    fixedExpenses.forEach(e => {
      fRows += `<tr><td>${e.date || "-"}</td><td>${e.name}</td><td style="font-family: monospace;">${e.amount.toLocaleString()} دج</td></tr>`;
    });

    let vRows = "";
    monthVar.forEach(e => {
      vRows += `<tr><td>${e.date}</td><td>${e.name}</td><td style="font-family: monospace;">${e.amount.toLocaleString()} دج</td></tr>`;
    });

    let wRows = "";
    monthWorkerEntries.forEach(e => {
      wRows += `<tr><td>${e.date}</td><td><b>${e.workerCode}</b> - ${e.workerName}</td><td>${e.description}</td><td>${e.notes || "-"}</td><td style="font-family: monospace;">${e.amount.toLocaleString()} دج</td></tr>`;
    });

    let adRows = "";
    monthAdExpenses.forEach(e => {
      const days = Math.max(1, Math.ceil((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const daily = Math.round(e.amountCurrency / days);
      adRows += `<tr><td>${e.startDate} ~ ${e.endDate}</td><td>$${e.amountUSD}</td><td style="font-family: monospace;">${e.exchangeRate} دج/$</td><td style="font-family: monospace; font-weight:bold;">${e.amountCurrency.toLocaleString()} دج</td><td>${days} أيام / ${daily.toLocaleString()} دج يومياً</td></tr>`;
    });

    const content = `
      <h1>التقرير الشامل والأعباء التشغيلية لفترة: ${selectedMonth} ${selectedYear}</h1>
      
      <h3>1. المصاريف والأعباء الثابتة (التراكمية المشتركة)</h3>
      <table>
        <thead>
          <tr><th style="width:15%">التاريخ</th><th>قيد المصروف الثابت</th><th style="width:20%">القيمة</th></tr>
        </thead>
        <tbody>
          ${fRows || `<tr><td colspan="3" style="text-align:center;">لا توجد مصاريف ثابتة مسجلة</td></tr>`}
        </tbody>
      </table>

      <h3>2. المصاريف المتغيرة لشهر ${selectedMonth} ${selectedYear}</h3>
      <table>
        <thead>
          <tr><th style="width:15%">التاريخ</th><th>بيان مصروف التشغيل</th><th style="width:20%">القيمة</th></tr>
        </thead>
        <tbody>
          ${vRows || `<tr><td colspan="3" style="text-align:center;">لا توجد مصاريف متغيرة لهذا الشهر</td></tr>`}
        </tbody>
      </table>

      <h3>3. مصاريف وسلفيات العمال للشهر</h3>
      <table>
        <thead>
          <tr><th style="width:15%">التاريخ</th><th style="width:25%">الموظف والعامل</th><th>بيان ووصف السلفة</th><th>ملاحظات</th><th style="width:18%">المبلغ دج</th></tr>
        </thead>
        <tbody>
          ${wRows || `<tr><td colspan="5" style="text-align:center;">لا توجد سلفيات مسجلة للعمال لهذا الشهر</td></tr>`}
        </tbody>
      </table>

      <h3>4. ميزانية إشهارات التمويل والتسويق (خارج الحسبة الكلية)</h3>
      <table>
        <thead>
          <tr><th style="width:25%">الفترة</th><th>بالدولار ($)</th><th>سعر الصرف</th><th style="width:20%">المبلغ دج</th><th>المعدل والمدة الزمنية</th></tr>
        </thead>
        <tbody>
          ${adRows || `<tr><td colspan="5" style="text-align:center;">لا توجد إعلانات ممولة مسجلة لهذا الشهر</td></tr>`}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row">
          <span>مجموع المصاريف والأعباء الثابتة:</span>
          <span style="font-family: monospace;">${totalFixed.toLocaleString()} دج</span>
        </div>
        <div class="summary-row">
          <span>مجموع المصاريف المتغيرة للبطاقة:</span>
          <span style="font-family: monospace;">${totalVariable.toLocaleString()} دج</span>
        </div>
        <div class="summary-row">
          <span>مجموع سلف وأعباء عمال الشهر:</span>
          <span style="font-family: monospace;">${totalWorkerExpenses.toLocaleString()} دج</span>
        </div>
        <div class="summary-row">
          <span>إجمالي ميزانية التسويق والإشهار (السبونسر):</span>
          <span style="font-family: monospace; color:#d97706;">${totalAdExpenses.toLocaleString()} دج</span>
        </div>
        <div class="summary-row total-row" style="margin-top:10px; border-top:1px solid #e5e7eb; padding-top:10px;">
          <span>المجموع الكلي المفرز (ثابتة + متغيرة + رواتب):</span>
          <span style="font-family: monospace;">${grandTotal.toLocaleString()} دج</span>
        </div>
      </div>
    `;
    printWindow(content);
  };

  // 11.5 Shortcut handler configuration using a mutable React reference pointing to the latest printAll state
  const printAllRef = useRef(printAll);
  useEffect(() => {
    printAllRef.current = printAll;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName)) {
        return; // Avoid intercepting fields typing
      }
      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        printAllRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 10.3 Keyboard navigation helper on focusable inputs
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

    const form = target.closest("form");
    if (!form) return;

    // List all visible/focusable inputs inside current form
    const focusable = Array.from(
      form.querySelectorAll("input:not([disabled]):not([type='hidden']), select:not([disabled])")
    ) as HTMLElement[];
    const index = focusable.indexOf(target);
    if (index === -1) return;

    if (e.key === "Enter") {
      // Allow specific inputs with custom click triggers to proceed (i.e. endDate and notes)
      if (target.classList.contains("submit-on-enter")) {
        return; // default key triggers
      }
      e.preventDefault();
      const next = focusable[index + 1];
      if (next) next.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusable[index + 1];
      if (next) next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = focusable[index - 1];
      if (prev) prev.focus();
    }
  };

  return (
    <div className="space-y-6 pt-16 md:pt-4 text-slate-100" id="expenses_ledger_module" dir="rtl">
      
      {/* 3.1 الشريط العلوي / Header bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-2xl" id="expenses_header">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <Receipt className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              إدارة المصاريف التشغيلية
            </h1>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
              <span>تصفية، طباعة، ومزامنة المصاريف الثابتة والمتغيرة، وإعلانات الدفع والعمال</span>
              <span className="hidden md:inline px-1 py-0.2 bg-zinc-800 text-[10px] text-zinc-300 rounded font-bold border border-zinc-700 select-none">
                اضغط على الحرف P للطباعة السريعة
              </span>
            </p>
          </div>
        </div>

        {/* Filters and Navigation controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto" id="expenses_header_actions">
          
          {/* Quick links to worker and products page */}
          <div className="flex gap-1 items-center bg-zinc-950 p-1 border border-zinc-900 rounded-lg">
            {onSectionChange && (
              <>
                <button
                  onClick={() => onSectionChange("workers")}
                  className="px-2.5 py-1 text-[10px] font-bold text-indigo-400 hover:text-white hover:bg-indigo-600/10 rounded transition cursor-pointer"
                >
                  صفحة العمال
                </button>
                <div className="w-px h-3.5 bg-zinc-850" />
                <button
                  onClick={() => onSectionChange("products")}
                  className="px-2.5 py-1 text-[10px] font-bold text-emerald-400 hover:text-white hover:bg-emerald-600/10 rounded transition cursor-pointer"
                >
                  صفحة المنتجات
                </button>
              </>
            )}
          </div>

          <div className="flex gap-1.5 items-center bg-zinc-950 border border-zinc-900 rounded-lg p-1">
            {/* 3.1 Month Filter dropdown */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-slate-100 py-1.2 px-2.5 font-bold focus:outline-none cursor-pointer"
            >
              {monthNamesAr.map((mName, i) => (
                <option key={i} value={mName} className="bg-zinc-950 text-slate-200">
                  {mName}
                </option>
              ))}
            </select>

            <div className="w-px h-4.5 bg-zinc-900" />

            {/* 3.1 Year Filter dropdown */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs text-slate-100 py-1.2 px-2.5 font-bold focus:outline-none cursor-pointer"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr} className="bg-zinc-950 text-slate-200">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={printAll}
            className="px-3.5 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-indigo-500/20 transition-all cursor-pointer shadow-md"
            title="طباعة التقرير العام والشامل"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">طباعة الكل</span>
          </button>
        </div>
      </div>

      {/* 3.2 بطاقات الإحصائيات (6 بطاقات) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="expenses_stats_boxes">
        
        {/* Card 1: Fixed Expenses */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-orange-500/30 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-orange-500/5 rounded-lg border border-orange-500/10">
            <Lock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-zinc-450 block">المصاريف الثابتة الكلية</span>
            <span className="text-sm font-semibold font-mono text-orange-400 block break-words">
              {totalFixed.toLocaleString()} <span className="text-[9px]">دج</span>
            </span>
          </div>
          <span className="text-[9px] text-orange-500/70 font-semibold block mt-3.5">
            {fixedExpenses.length} إدخال دائم
          </span>
        </div>

        {/* Card 2: Variable Expenses */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-blue-500/5 rounded-lg border border-blue-500/10">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-zinc-450 block">المصاريف المتغيرة</span>
            <span className="text-sm font-semibold font-mono text-blue-400 block break-words">
              {totalVariable.toLocaleString()} <span className="text-[9px]">دج</span>
            </span>
          </div>
          <span className="text-[9px] text-blue-500/70 font-semibold block mt-3.5">
            {monthVar.length} مقيد هدا الشهر
          </span>
        </div>

        {/* Card 3: Sum of Fixed and Variable */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-emerald-500/30 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-zinc-455 block">مجموع (ثابتة + متغيرة)</span>
            <span className="text-sm font-bold font-mono text-emerald-400 block break-words">
              {(totalFixed + totalVariable).toLocaleString()} <span className="text-[9px]">دج</span>
            </span>
          </div>
          <span className="text-[9px] text-emerald-500/70 font-semibold block mt-3.5">
            {fixedExpenses.length + monthVar.length} إدخال كلي
          </span>
        </div>

        {/* Card 4: Marketing / Ad Expenses Budget */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-yellow-500/30 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
            <Megaphone className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-zinc-455 block">ميزانية الإعلانات المموزعة</span>
            <span className="text-sm font-semibold font-mono text-yellow-400 block break-words">
              {totalAdExpenses.toLocaleString()} <span className="text-[9px]">دج</span>
            </span>
          </div>
          <span className="text-[9px] text-yellow-500/70 font-semibold block mt-3.5">
            {monthAdExpenses.length} إشهار تمويلي
          </span>
        </div>

        {/* Card 5: Worker Payroll Expenses */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-violet-500/30 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-violet-500/5 rounded-lg border border-violet-500/10">
            <Users className="w-4 h-4 text-violet-500" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-zinc-455 block">أعباء وسلف العمال</span>
            <span className="text-sm font-semibold font-mono text-violet-400 block break-words">
              {totalWorkerExpenses.toLocaleString()} <span className="text-[9px]">دج</span>
            </span>
          </div>
          <span className="text-[9px] text-violet-500/70 font-semibold block mt-3.5">
            {monthWorkerEntries.length} عمال بالشهر
          </span>
        </div>

        {/* Card 6: Grand Total (Fixed + Variable + Workers) */}
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between hover:border-green-500/40 border-l-2 border-l-green-600 transition-all relative overflow-hidden group shadow-lg">
          <div className="absolute top-2 left-2 p-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
            <Sparkles className="w-4 h-4 text-green-500 animate-spin-slow" />
          </div>
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold text-green-300 block">المجموع الكلي المفرز الدقيق</span>
            <span className="text-base font-black font-mono text-green-400 block break-words leading-tight">
              {grandTotal.toLocaleString()} <span className="text-xs">دج</span>
            </span>
          </div>
          {/* Cumulative summary label without entries indicator */}
          <span className="text-[9px] text-zinc-450 font-bold block mt-3.5">
            المصاريف الدورية + أجور الموظفين
          </span>
        </div>

      </div>

      {/* 3.3 ترتيب الأقسام في الصفحة */}

      {/* ==================== SECTION 4: ADS EXPENSES (الأصفر) ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl shadow-xl overflow-hidden" id="section_ad_expenses text-right">
        <div className="p-4 bg-zinc-950/70 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-xs font-black text-yellow-400 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-full" />
            <span>4. قسم إشهارات التمويل والتسويق (Ad Expenses)</span>
          </h2>
          <span className="text-[10px] text-zinc-500 font-bold">مساحة متابعة الحملات الإعلانية ومصاريف الدولار</span>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form */}
          <form 
            onSubmit={handleAddAd}
            className="lg:col-span-4 p-4.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4"
            onKeyDown={handleFormKeyDown}
          >
            <strong className="text-[10px] text-zinc-400 border-b border-zinc-900 pb-1.5 block">قيود تسجيل أو تعديل حملة</strong>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold">المبلغ المستقطع بالدولار ($) *</label>
                <input
                  type="number"
                  required
                  value={adAmountUsd || ""}
                  onChange={(e) => setAdAmountUsd(Number(e.target.value) || 0)}
                  onFocus={handleFocusSelect}
                  className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs font-mono text-center text-white"
                  placeholder="مثال: 50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold">سعر الصرف دج/$ *</label>
                <input
                  type="number"
                  required
                  value={adExchangeRate || ""}
                  onChange={(e) => setAdExchangeRate(Number(e.target.value) || 0)}
                  onFocus={handleFocusSelect}
                  className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs font-mono text-center text-white"
                  placeholder="250"
                />
              </div>
            </div>

            {/* Calculated Amount Dinar (DZD) Read-Only */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">المبلغ المحول للدينار الجزائري (دج)</label>
              <input
                type="text"
                readOnly
                value={`${(adAmountUsd * adExchangeRate).toLocaleString()} دج`}
                className="bg-zinc-900/50 border border-[#27272a] rounded-lg p-2 text-xs font-bold font-mono text-center text-yellow-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold">تاريخ البداية</label>
                <input
                  type="date"
                  required
                  value={adStartDate}
                  onChange={(e) => setAdStartDate(e.target.value)}
                  className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold">تاريخ النهاية</label>
                <input
                  type="date"
                  required
                  value={adEndDate}
                  onChange={(e) => setAdEndDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAd();
                    }
                  }}
                  className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white submit-on-enter"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-yellow-500 text-slate-950 hover:bg-yellow-400 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition"
              >
                {editingAdId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingAdId ? "حفظ تعديل الإعلان" : "تسجيل مصروف الإعلان"}</span>
              </button>
              {editingAdId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAdId(null);
                    setAdAmountUsd(0);
                    setAdExchangeRate(250);
                    setAdStartDate(firstOfMonth(selectedMonth, selectedYear));
                    setAdEndDate(lastOfMonth(selectedMonth, selectedYear));
                  }}
                  className="px-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-xs"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="lg:col-span-8 overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/30">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 uppercase font-bold text-[10px]">
                  <th className="px-3.5 py-2.5 text-center">الإجراءات</th>
                  <th className="px-3.5 py-2.5">المبلغ ($)</th>
                  <th className="px-3.5 py-2.5">سعر الصرف (دج/$)</th>
                  <th className="px-3.5 py-2.5">المبلغ (دج)</th>
                  <th className="px-3.5 py-2.5">من تاريخ</th>
                  <th className="px-3.5 py-2.5">إلى تاريخ</th>
                  <th className="px-3.5 py-2.5 text-center">المدة بالأيام</th>
                  <th className="px-3.5 py-2.5">معدل الاستهلاك اليومي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-medium">
                {monthAdExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3.5 py-8 text-center text-zinc-500">لا توجد إشهارات تمويل للميزانية المحددة لهذا الشهر</td>
                  </tr>
                ) : (
                  monthAdExpenses.map(item => {
                    const diffDays = Math.max(1, Math.ceil((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    const avgDaily = Math.round(item.amountCurrency / diffDays);
                    return (
                      <tr key={item.id} className="hover:bg-zinc-900/40">
                        <td className="px-3.5 py-2.5 text-center flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditAd(item)}
                            className="p-1.5 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/5 rounded transition cursor-pointer"
                            title="تعديل هذا الإعلان"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAd(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded transition cursor-pointer"
                            title="حذف الإعلان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-yellow-500 font-bold">${item.amountUSD}</td>
                        <td className="px-3.5 py-2.5 font-mono text-zinc-400">{item.exchangeRate} دج/$</td>
                        <td className="px-3.5 py-2.5 font-mono text-[13px] font-black text-slate-100">{item.amountCurrency.toLocaleString()} دج</td>
                        <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[10px]">{item.startDate}</td>
                        <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[10px]">{item.endDate}</td>
                        <td className="px-3.5 py-2.5 text-center font-mono text-zinc-400">{diffDays} أيام</td>
                        <td className="px-3.5 py-2.5 font-mono text-zinc-400">{avgDaily.toLocaleString()} دج/يوم</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>


      {/* ==================== SECTION 5: FIXED EXPENSES (البرتقالي) ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl shadow-xl overflow-hidden" id="section_fixed_expenses text-right">
        <div className="p-4 bg-zinc-950/70 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-xs font-black text-orange-500 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
            <span>5. قسم المصاريف والأعباء الثابتة (Fixed Expenses)</span>
          </h2>
          <button
            onClick={printFixed}
            className="p-1 px-3 bg-orange-500/10 border border-orange-500/20 rounded text-[10px] text-orange-400 font-black flex items-center gap-1 hover:bg-orange-500 hover:text-white transition cursor-pointer"
            title="طباعة تقرير الفروع الثابتة الدائمة"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الجدول فقط</span>
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form */}
          <form 
            onSubmit={handleAddFixed}
            className="lg:col-span-4 p-4.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4"
            onKeyDown={handleFormKeyDown}
          >
            <strong className="text-[10px] text-zinc-400 border-b border-zinc-900 pb-1.5 block">إضافة أو تعديل مصروف ثابت</strong>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">التاريخ</label>
              <input
                type="date"
                value={fixedDate}
                onChange={(e) => setFixedDate(e.target.value)}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">البيان والمنفعة (الوصف) *</label>
              <input
                type="text"
                required
                list="fixedExpenseList"
                value={fixedName}
                onChange={(e) => handleFixedNameChange(e.target.value)}
                placeholder="مثال: فاتورة كراء المحل"
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
              <datalist id="fixedExpenseList">
                {allFixedExpenseNames.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">المبلغ المالي الصافي (دج) *</label>
              <input
                type="number"
                required
                value={fixedAmount || ""}
                onChange={(e) => setFixedAmount(Number(e.target.value) || 0)}
                onFocus={handleFocusSelect}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs font-mono text-center text-white"
                placeholder="0"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-orange-600 text-white hover:bg-orange-500 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition-all"
              >
                {editingFixedId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingFixedId ? "حفظ التعديل" : "إضافة المصروف"}</span>
              </button>
              {editingFixedId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFixedId(null);
                    setFixedName("");
                    setFixedAmount(0);
                    setFixedDate(firstOfMonth(selectedMonth, selectedYear));
                  }}
                  className="px-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="lg:col-span-8 overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/30">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 uppercase font-bold text-[10px]">
                  <th className="px-3.5 py-2.5 text-center" style={{ width: "15%" }}>الإجراءات</th>
                  <th className="px-3.5 py-2.5">تاريخ تسجيل القيد</th>
                  <th className="px-3.5 py-2.5">الوصف والبيان</th>
                  <th className="px-3.5 py-2.5">المبلغ دج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-medium">
                {fixedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3.5 py-8 text-center text-zinc-500">لا توجد مصاريف ثابتة مسجلة في النظام التراكمي حالياً</td>
                  </tr>
                ) : (
                  fixedExpenses.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-900/40">
                      <td className="px-3.5 py-2.5 text-center flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditFixed(item)}
                          className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-orange-500/5 rounded transition cursor-pointer"
                          title="تعديل القيد المالي"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFixed(item.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded transition cursor-pointer"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[10px]">{item.date || "غير محدد / تراكمي"}</td>
                      <td className="px-3.5 py-2.5 font-bold text-white">{item.name}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[13px] text-orange-400 font-black">{item.amount.toLocaleString()} دج</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>


      {/* ==================== SECTION 6: VARIABLE EXPENSES (الأزرق) ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl shadow-xl overflow-hidden" id="section_variable_expenses text-right">
        <div className="p-4 bg-zinc-950/70 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-xs font-black text-blue-500 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-full" />
            <span>6. قسم المصاريف التشغيلية المتغيرة (Variable Expenses)</span>
          </h2>
          <button
            onClick={printVariable}
            className="p-1 px-3 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 font-black flex items-center gap-1 hover:bg-blue-500 hover:text-white transition cursor-pointer"
            title="طباعة التقريرات المتغيرة"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الجدول للشهر المحدد فقط</span>
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form */}
          <form 
            onSubmit={handleAddVariable}
            className="lg:col-span-4 p-4.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4"
            onKeyDown={handleFormKeyDown}
          >
            <strong className="text-[10px] text-zinc-400 border-b border-zinc-900 pb-1.5 block">إضافة أو تعديل مصروف متغير</strong>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">التاريخ</label>
              <input
                type="date"
                value={varDate}
                onChange={(e) => setVarDate(e.target.value)}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">بيان القنوات المستهلكة (datalist) *</label>
              <input
                type="text"
                required
                list="varExpenseList"
                value={varName}
                onChange={(e) => handleVarNameChange(e.target.value)}
                placeholder="أكياس تغليف شحن"
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
              <datalist id="varExpenseList">
                {allVariableExpenseNames.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">المبلغ المسدد (دج) *</label>
              <input
                type="number"
                required
                value={varAmount || ""}
                onChange={(e) => setVarAmount(Number(e.target.value) || 0)}
                onFocus={handleFocusSelect}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs font-mono text-center text-white"
                placeholder="0"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition-all"
              >
                {editingVarId ? <Edit2 className="w-3.5 h-3.5 animate-spin-slow" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingVarId ? "حفظ التعديل" : "تسجيل المصروف"}</span>
              </button>
              {editingVarId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingVarId(null);
                    setVarName("");
                    setVarAmount(0);
                    setVarDate(firstOfMonth(selectedMonth, selectedYear));
                  }}
                  className="px-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="lg:col-span-8 overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/30">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 uppercase font-bold text-[10px]">
                  <th className="px-3.5 py-2.5 text-center" style={{ width: "15%" }}>الإجراءات</th>
                  <th className="px-3.5 py-2.5">تاريخ المعاملة</th>
                  <th className="px-3.5 py-2.5">بيان المصروف المتغير</th>
                  <th className="px-3.5 py-2.5">المبلغ كلي دج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-medium">
                {monthVar.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3.5 py-8 text-center text-zinc-500">لا توجد مصاريف متغيرة مسجلة في شهر {selectedMonth} {selectedYear}</td>
                  </tr>
                ) : (
                  monthVar.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-900/40">
                      <td className="px-3.5 py-2.5 text-center flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditVariable(item)}
                          className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/5 rounded transition cursor-pointer"
                          title="تعديل هذا بملف المتغيرات"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVariable(item.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded transition cursor-pointer"
                          title="حذف المصروف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[10px]">{item.date}</td>
                      <td className="px-3.5 py-2.5 font-bold text-white">{item.name}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[13px] text-blue-400 font-black">{item.amount.toLocaleString()} دج</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>


      {/* ==================== SECTION 7: WORKER EXPENSES (البنفسجي) ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl shadow-xl overflow-hidden" id="section_worker_expenses text-right">
        <div className="p-4 bg-zinc-950/70 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-xs font-black text-violet-400 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-violet-500 rounded-full" />
            <span>7. قسم أعباء وإدخالات العمال وسلفيات الرواتب (Worker Expenses)</span>
          </h2>
          {onSectionChange && (
            <button
              onClick={() => onSectionChange("workers")}
              className="p-1.5 px-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-[10px] text-violet-400 hover:bg-violet-500 hover:text-white transition cursor-pointer font-extrabold flex items-center gap-1"
            >
              <span>صفحة شؤون الموظفين والرواتب</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Form */}
          <form 
            onSubmit={handleAddWorkerExpense}
            className="lg:col-span-4 p-4.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4"
            onKeyDown={handleFormKeyDown}
          >
            <strong className="text-[10px] text-zinc-400 border-b border-zinc-900 pb-1.5 block">تسجيل سلفة أو اقتطاع جديد لملف عامل</strong>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">تاريخ القيد المالي</label>
              <input
                type="date"
                required
                value={workerDate}
                onChange={(e) => setWorkerDate(e.target.value)}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">العامل / الموظف (datalist) *</label>
              <input
                type="text"
                required
                list="workerCodeList"
                value={workerCode}
                onChange={(e) => setWorkerCode(e.target.value)}
                placeholder="اكتب كود العامل EMP..."
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white placeholder-zinc-650"
              />
              <datalist id="workerCodeList">
                {uniqueWorkerCodes.map(code => (
                  <option key={code} value={code}>
                    {code} - {workerNamesByCode[code] || "عامل غير مسجل"}
                  </option>
                ))}
              </datalist>
              {workerCode && (
                <span className="text-[9.5px] text-indigo-400 font-extrabold self-start mt-0.5">
                  الاسم المتطابق: {workerNamesByCode[workerCode] || "غير متوفر، سيتم حفظ القيد يدوياً كعامل مجهول"}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">بيان الوصف / سبب السلفة *</label>
              <input
                type="text"
                required
                value={workerDesc}
                onChange={(e) => setWorkerDesc(e.target.value)}
                placeholder="مثال: سلفة نقدية على الحساب"
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">المبلغ المالي المخصوم (دج) *</label>
              <input
                type="number"
                required
                value={workerAmount || ""}
                onChange={(e) => setWorkerAmount(Number(e.target.value) || 0)}
                onFocus={handleFocusSelect}
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs font-mono text-center text-white"
                placeholder="0"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold">ملاحظات وقيود إضافية</label>
              <input
                type="text"
                value={workerNotes}
                onChange={(e) => setWorkerNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddWorkerExpense();
                  }
                }}
                placeholder="ملاحظات لتسوية آخر الشهر..."
                className="bg-[#040406] border border-zinc-850 rounded-lg p-2 text-xs text-white submit-on-enter"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-violet-600 text-white hover:bg-violet-500 rounded-lg text-xs font-black flex items-center justify-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سلفة للعامل ومزامنتها</span>
            </button>
          </form>

          {/* Table */}
          <div className="lg:col-span-8 overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/30">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-400 uppercase font-bold text-[10px]">
                  <th className="px-3.5 py-2.5 text-center" style={{ width: "10%" }}>حذف فقط</th>
                  <th className="px-3.5 py-2.5">تاريخ الصرف</th>
                  <th className="px-3.5 py-2.5">العامل والمستلم</th>
                  <th className="px-3.5 py-2.5">سبب السلفة والبيان</th>
                  <th className="px-3.5 py-2.5">ملاحظات تسوية القيد</th>
                  <th className="px-3.5 py-2.5">المبلغ دج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-medium">
                {monthWorkerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3.5 py-8 text-center text-zinc-500">لا توجد خصومات أو سلف عمال مقيدة لشهر {selectedMonth} {selectedYear}</td>
                  </tr>
                ) : (
                  monthWorkerEntries.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-900/40">
                      <td className="px-3.5 py-2.5 text-center flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteWorkerExpense(item.id, item.workerCode, item.description, item.amount)}
                          className="p-1.5 text-zinc-450 hover:text-red-400 hover:bg-red-500/5 rounded transition cursor-pointer"
                          title="حذف ومزامنة التراجع"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[10px]">{item.date}</td>
                      <td className="px-3.5 py-2.5 font-bold text-white">
                        <span className="px-1.5 py-0.5 bg-violet-900/20 text-violet-400 border border-violet-800/20 rounded font-mono text-[9px] ml-1.5">{item.workerCode}</span>
                        <span>{item.workerName}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-200">{item.description}</td>
                      <td className="px-3.5 py-2.5 text-zinc-450 italic">{item.notes || "-"}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[13px] text-violet-400 font-black">{item.amount.toLocaleString()} دج</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

    </div>
  );
}
