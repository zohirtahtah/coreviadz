/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Order, Expense, Worker, LanguageType, Product, 
  BasicInventoryItem, SubInventoryItem, ReturnInventoryItem 
} from "../types";
import { translations } from "../translations";
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  DollarSign, TrendingUp, TrendingDown, Users, Sparkles, Percent, Target, 
  Calendar, Building2, Activity, Award, FileText, Check, MapPin, 
  UserCheck, Package, AlertCircle, Printer, X, Plus, Edit2, ChevronLeft 
} from "lucide-react";

// ==================== 1. CORE TYPES DECLARED EARLY ====================
export interface TopItem {
  name: string;
  count: number;
  percentage: number;
}

export interface MonthlyProfit {
  month: string; 
  year: number;
  totalSales: number; 
  totalCost: number; 
  netProfit: number; 
  profitMargin: number;
  totalOrders: number; 
  deliveredOrders: number; 
  returnedOrders: number;
  totalReturnCost: number; 
  workerCount: number; 
  totalWorkerSalaries: number;
  adBudget: number; 
  adBudgetUsd: number; 
  exchangeRate: number;
  startDate: string; 
  endDate: string; 
  days: number;
  budgetDzd: number; 
  dailyCost: number; 
  finalCalculation: number;
  returnCostTotal: number; 
  adBudgetTotal: number; 
  workerSalariesTotal: number;
  finalProfit: number; 
  finalStatus: 'profit' | 'loss';
  topWilayas: TopItem[]; 
  topModels: TopItem[]; 
  topColors: TopItem[]; 
  topSizes: TopItem[];
}

export interface YearlySummary {
  year: number;
  months: Record<string, { result: 'profit' | 'loss'; profit: number }>;
  totalProfit: number;
  topWilayas: TopItem[]; 
  topModels: TopItem[]; 
  topColors: TopItem[]; 
  topSizes: TopItem[];
}

interface ProfitViewProps {
  orders: Order[];
  expenses: Expense[];
  workers: Worker[];
  lang: LanguageType;
  products: Product[];
  basicInventory: BasicInventoryItem[];
  subInventory: SubInventoryItem[];
  returnInventory: ReturnInventoryItem[];
}

const MONTH_NAMES_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const COLORS_PALETTE = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe", "#00c49f", "#ffbb28", "#ff8042"];

export default function ProfitView({
  orders,
  expenses,
  workers,
  lang,
  products,
  basicInventory,
  subInventory,
  returnInventory
}: ProfitViewProps) {
  const t = translations[lang];

  // ==================== 4. STATE MANAGEMENT VARIABLES ====================
  const [selectedMonth, setSelectedMonth] = useState<string>(() => MONTH_NAMES_AR[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [showMonthlyForm, setShowMonthlyForm] = useState<boolean>(false);
  const [localNotification, setLocalNotification] = useState<{ msg: string; type: "success" | "warning" | "info" } | null>(null);

  // Loaded database summaries
  const [monthlyProfits, setMonthlyProfits] = useState<MonthlyProfit[]>(() => {
    const stored = localStorage.getItem("monthlyProfits");
    return stored ? JSON.parse(stored) : [];
  });

  const [yearlySummaries, setYearlySummaries] = useState<YearlySummary[]>(() => {
    const stored = localStorage.getItem("yearlySummaries");
    return stored ? JSON.parse(stored) : [];
  });

  // Highlight/Keyboard Index for Orders List Inside Dashboard modal
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Trigger notice helper
  const triggerNotification = (msg: string, type: "success" | "warning" | "info" = "success") => {
    setLocalNotification({ msg, type });
    setTimeout(() => setLocalNotification(null), 4000);
  };

  // Convert month Arabic name to numeric zero-based index for comparisons
  const monthIndex = useMemo(() => {
    const idx = MONTH_NAMES_AR.indexOf(selectedMonth);
    return idx >= 0 ? idx : new Date().getMonth();
  }, [selectedMonth]);

  const monthYearString = useMemo(() => {
    return `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
  }, [selectedYear, monthIndex]);

  // ==================== 5. CORE BUSINESS CALCULATIONS ====================

  // 5.1 Orders Calculations (المبيعات والتوصيل)
  const monthOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date);
      return d.getMonth() === monthIndex && d.getFullYear() === selectedYear;
    });
  }, [orders, monthIndex, selectedYear]);

  const deliveredOrders = useMemo(() => monthOrders.filter(o => o.status === "delivered"), [monthOrders]);
  const pendingOrders = useMemo(() => monthOrders.filter(o => o.status === "pending"), [monthOrders]);
  const returnedOrders = useMemo(() => monthOrders.filter(o => o.status === "returned"), [monthOrders]);
  const pendingDeliveredOrders = useMemo(() => [...pendingOrders, ...deliveredOrders], [pendingOrders, deliveredOrders]);

  const getOrderTotal = (o: Order) => {
    return (o.totalPrice || 0) + (o.customerPaysDelivery ? (o.deliveryPrice || 0) : 0) - (o.discount || 0);
  };

  const totalAllSales = useMemo(() => {
    return pendingDeliveredOrders.reduce((s, o) => s + getOrderTotal(o), 0);
  }, [pendingDeliveredOrders]);

  const totalDeliveredSales = useMemo(() => {
    return deliveredOrders.reduce((s, o) => s + getOrderTotal(o), 0);
  }, [deliveredOrders]);

  const totalPendingSales = useMemo(() => {
    return pendingOrders.reduce((s, o) => s + getOrderTotal(o), 0);
  }, [pendingOrders]);

  const totalReturnedSales = useMemo(() => {
    return returnedOrders.reduce((s, o) => s + getOrderTotal(o), 0);
  }, [returnedOrders]);

  const totalCostPendingDelivered = useMemo(() => {
    return pendingDeliveredOrders.reduce((s, o) => {
      const itemsCost = (o.items || []).reduce((sum, it) => sum + (it.productCost || 0) * (it.quantity || 0), 0);
      return s + itemsCost;
    }, 0);
  }, [pendingDeliveredOrders]);

  const deliveryCostOnShop = useMemo(() => {
    return pendingDeliveredOrders
      .filter(o => o.customerPaysDelivery === false)
      .reduce((s, o) => s + (o.deliveryPrice || 0), 0);
  }, [pendingDeliveredOrders]);

  // Pure profit from matching products cart: (price - cost) * quantity
  const netProfitPendingDelivered = useMemo(() => {
    return pendingDeliveredOrders.reduce((s, o) => {
      const itemsNet = (o.items || []).reduce((sum, it) => {
        return sum + ((it.sellingPrice || 0) - (it.productCost || 0)) * (it.quantity || 0);
      }, 0);
      return s + itemsNet;
    }, 0);
  }, [pendingDeliveredOrders]);

  const totalReturnCost = useMemo(() => {
    return returnedOrders.reduce((s, o) => s + (o.returnCost || 0), 0);
  }, [returnedOrders]);

  const profitMargin = useMemo(() => {
    return totalDeliveredSales > 0 ? (netProfitPendingDelivered / totalDeliveredSales) * 100 : 0;
  }, [netProfitPendingDelivered, totalDeliveredSales]);

  // 5.2 Workers Calculations (الرواتب والأجور)
  const salarySheets = useMemo(() => {
    const stored = localStorage.getItem("salarySheets");
    return stored ? JSON.parse(stored) : [];
  }, [selectedMonth, selectedYear]);

  // Find sheet structures matching the current selected period (Ar month + Year)
  const monthSalarySheets = useMemo(() => {
    const formattedDate = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    return salarySheets.filter((s: any) => s.monthYear === formattedDate);
  }, [salarySheets, selectedYear, monthIndex]);

  const { totalWorkerDues, totalPaidWorkerAmount } = useMemo(() => {
    if (monthSalarySheets.length > 0) {
      const dues = monthSalarySheets.reduce((s: number, sh: any) => s + (sh.calculatedSalary?.netSalary || 0), 0);
      const paid = monthSalarySheets
        .filter((sh: any) => sh.payStatus === "paid")
        .reduce((s: number, sh: any) => s + (sh.calculatedSalary?.netSalary || 0), 0);
      return { totalWorkerDues: dues, totalPaidWorkerAmount: paid };
    } else {
      // Fallback calculation directly on active workers list to ensure no empty cards
      const duesFallback = workers.reduce((s, w) => s + (w.baseSalary || w.monthlySalary || 0), 0);
      return { totalWorkerDues: duesFallback, totalPaidWorkerAmount: duesFallback };
    }
  }, [monthSalarySheets, workers]);

  // 5.3 Overhead Expenses (المصاريف الثابتة والمتغيرة)
  const totalFixedExpenses = useMemo(() => {
    const stored = localStorage.getItem("fixedExpenses");
    const arr = stored ? JSON.parse(stored) : [];
    return arr.reduce((s: number, ex: any) => s + (ex.amount || 0), 0);
  }, [selectedMonth, selectedYear]);

  const totalVariableExpenses = useMemo(() => {
    const stored = localStorage.getItem("variableExpenses");
    const arr = stored ? JSON.parse(stored) : [];
    const formatted = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    return arr
      .filter((ex: any) => ex.monthYear === formatted)
      .reduce((s: number, ex: any) => s + (ex.amount || 0), 0);
  }, [monthIndex, selectedYear]);

  const totalExpensesAmount = totalFixedExpenses + totalVariableExpenses;

  // 5.4 Ads Campaigns budget calculations (الإعلانات)
  const monthAdEntries = useMemo(() => {
    const stored = localStorage.getItem("adExpenses");
    const arr = stored ? JSON.parse(stored) : [];
    const formatted = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    return arr.filter((e: any) => e.monthYear === formatted);
  }, [monthIndex, selectedYear]);

  const { totalAdDzd, totalAdUsd, avgExchangeRate, adDays, adDailyCost } = useMemo(() => {
    const dzd = monthAdEntries.reduce((s: number, e: any) => s + (e.amountCurrency || 0), 0);
    const usd = monthAdEntries.reduce((s: number, e: any) => s + (e.amountUSD || 0), 0);
    const rate = usd > 0 ? Math.round(dzd / usd) : 250;

    let minStart = Infinity;
    let maxEnd = -Infinity;
    monthAdEntries.forEach((e: any) => {
      const sDate = new Date(e.startDate).getTime();
      const eDate = new Date(e.endDate).getTime();
      if (sDate < minStart) minStart = sDate;
      if (eDate > maxEnd) maxEnd = eDate;
    });

    const daysCalculated = minStart !== Infinity && maxEnd !== -Infinity 
      ? Math.ceil((maxEnd - minStart) / (1000 * 60 * 60 * 24)) 
      : 1;
    const days = daysCalculated > 0 ? daysCalculated : 1;

    return {
      totalAdDzd: dzd,
      totalAdUsd: usd,
      avgExchangeRate: rate,
      adDays: monthAdEntries.length > 0 ? days : 0,
      adDailyCost: monthAdEntries.length > 0 ? Math.round(dzd / days) : 0
    };
  }, [monthAdEntries]);

  const budgetDzd = totalAdDzd;

  // 5.5 Stock calculations (تكلفة وقيمة المخزن)
  const { totalBasicItems, totalSubItems, totalReturnQty, totalStockQty, totalInventoryCost } = useMemo(() => {
    // Basic inventory quantities sum
    const basicQty = basicInventory.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
    // Sub inventory quantities sum
    const subQty = subInventory.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
    // Return quantities sum
    const returnQty = returnInventory.reduce((s: number, it: any) => s + (it.quantity || 0), 0);

    // Cost multiplier
    let costSum = 0;
    basicInventory.forEach((it: any) => {
      const prod = products.find((p: any) => p.name === it.productName || p.id === it.productId);
      const costPrice = prod ? (prod.wholesaleCostPrice || 0) : 0;
      costSum += (it.quantity || 0) * costPrice;
    });

    subInventory.forEach((it: any) => {
      const prod = products.find((p: any) => p.name === it.productName || p.id === it.productId);
      const costPrice = prod ? (prod.wholesaleCostPrice || 0) : 0;
      costSum += (it.quantity || 0) * costPrice;
    });

    returnInventory.forEach((it: any) => {
      const prod = products.find((p: any) => p.name === it.productName || p.id === it.productId);
      const costPrice = prod ? (prod.wholesaleCostPrice || 0) : 0;
      costSum += (it.quantity || 0) * costPrice;
    });

    return {
      totalBasicItems: basicQty,
      totalSubItems: subQty,
      totalReturnQty: returnQty,
      totalStockQty: basicQty + subQty + returnQty,
      totalInventoryCost: costSum
    };
  }, [basicInventory, subInventory, returnInventory, products]);

  // 5.6 Suppliers accounts states (الموردين والحساب المصرفي الدائن)
  const { totalSupplierDebt, totalPaidToSuppliers } = useMemo(() => {
    const purchaseStored = localStorage.getItem("purchaseOrders");
    const ordersList = purchaseStored ? JSON.parse(purchaseStored) : [];

    let debt = 0;
    let paidAmt = 0;

    ordersList.forEach((po: any) => {
      const itemPayments = po.payments || [];
      const totalPaid = itemPayments.reduce((s: number, p: any) => s + p.amount, 0);
      paidAmt += totalPaid;
      
      const outstanding = po.total - totalPaid;
      if (outstanding > 0) {
        debt += outstanding;
      }
    });

    return {
      totalSupplierDebt: debt,
      totalPaidToSuppliers: paidAmt
    };
  }, [orders]);

  // ==================== 10. FINAL COMPREHENSIVE REVENUE STATEMENT MATRIX ====================
  const finalProfit = useMemo(() => {
    return (
      netProfitPendingDelivered - 
      totalReturnCost - 
      budgetDzd - 
      totalPaidWorkerAmount - 
      totalExpensesAmount - 
      deliveryCostOnShop
    );
  }, [netProfitPendingDelivered, totalReturnCost, budgetDzd, totalPaidWorkerAmount, totalExpensesAmount, deliveryCostOnShop]);

  const finalStatus = finalProfit >= 0 ? 'profit' : 'loss';

  // ==================== 7. INTERACTIVE DERIVED COUNTS AUXILIARIES ====================

  // helper to extract counts
  const getCounts = (field: "productName" | "color" | "size") => {
    const counts: Record<string, number> = {};
    deliveredOrders.forEach(o => {
      (o.items || []).forEach(it => {
        const val = it[field === "productName" ? "productName" : field];
        if (val) {
          counts[val] = (counts[val] || 0) + (it.quantity || 0);
        }
      });
    });
    return counts;
  };

  const getWilayaCounts = () => {
    const counts: Record<string, number> = {};
    deliveredOrders.forEach(o => {
      const qty = (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
      counts[o.wilaya] = (counts[o.wilaya] || 0) + qty;
    });
    return counts;
  };

  const toTop = (counts: Record<string, number>, n: number): TopItem[] => {
    const total = Object.values(counts).reduce((s, count) => s + count, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0
      }));
  };

  // Monthly stats
  const topWilayas = useMemo(() => toTop(getWilayaCounts(), 3), [deliveredOrders]);
  const topModels = useMemo(() => toTop(getCounts("productName"), 3), [deliveredOrders]);
  const topColors = useMemo(() => toTop(getCounts("color"), 3), [deliveredOrders]);
  const topSizes = useMemo(() => toTop(getCounts("size"), 3), [deliveredOrders]);

  // Yearly helpers across all orders of selected year
  const getTopYear = (field: "productName" | "color" | "size" | "wilaya", n: number): TopItem[] => {
    const yrOrders = orders.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date);
      return d.getFullYear() === selectedYear && o.status === "delivered";
    });

    const counts: Record<string, number> = {};
    yrOrders.forEach(o => {
      if (field === "wilaya") {
        const qty = (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
        counts[o.wilaya] = (counts[o.wilaya] || 0) + qty;
      } else {
        (o.items || []).forEach(it => {
          const val = it[field === "productName" ? "productName" : field];
          if (val) counts[val] = (counts[val] || 0) + (it.quantity || 0);
        });
      }
    });

    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    return Object.entries(counts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0
      }));
  };

  // Find Saved Summary if any
  const yearSummary = useMemo(() => {
    return yearlySummaries.find(y => y.year === selectedYear) || null;
  }, [yearlySummaries, selectedYear]);

  // ==================== 6.3 SUBMISSION HANDLER & REPORT UPDATER ====================
  const handleSaveMonth = () => {
    const newReport: MonthlyProfit = {
      month: selectedMonth,
      year: selectedYear,
      totalSales: totalAllSales,
      totalCost: totalCostPendingDelivered,
      netProfit: netProfitPendingDelivered,
      profitMargin: parseFloat(profitMargin.toFixed(1)),
      totalOrders: monthOrders.length,
      deliveredOrders: deliveredOrders.length,
      returnedOrders: returnedOrders.length,
      totalReturnCost: totalReturnCost,
      workerCount: monthSalarySheets.length || workers.length,
      totalWorkerSalaries: totalPaidWorkerAmount,
      adBudget: totalAdDzd,
      adBudgetUsd: totalAdUsd,
      exchangeRate: avgExchangeRate,
      startDate: monthAdEntries[0]?.startDate || "",
      endDate: monthAdEntries[monthAdEntries.length - 1]?.endDate || "",
      days: adDays,
      budgetDzd: budgetDzd,
      dailyCost: adDailyCost,
      finalCalculation: finalProfit,
      returnCostTotal: totalReturnCost,
      adBudgetTotal: budgetDzd,
      workerSalariesTotal: totalPaidWorkerAmount,
      finalProfit: finalProfit,
      finalStatus: finalStatus,
      topWilayas: topWilayas,
      topModels: topModels,
      topColors: topColors,
      topSizes: topSizes
    };

    // 1. Add/Update MonthlyProfits collection
    let updatedMonthly = [...monthlyProfits];
    const existingIndex = updatedMonthly.findIndex(p => p.month === selectedMonth && p.year === selectedYear);
    if (existingIndex >= 0) {
      updatedMonthly[existingIndex] = newReport;
    } else {
      updatedMonthly.push(newReport);
    }
    setMonthlyProfits(updatedMonthly);
    localStorage.setItem("monthlyProfits", JSON.stringify(updatedMonthly));

    // 2. Add/Update YearlySummary collection
    let updatedYearly = [...yearlySummaries];
    const existingYrIndex = updatedYearly.findIndex(y => y.year === selectedYear);

    const updatedMonthsMap: Record<string, { result: 'profit' | 'loss'; profit: number }> = existingYrIndex >= 0 
      ? { ...updatedYearly[existingYrIndex].months }
      : {};
    updatedMonthsMap[selectedMonth] = { result: finalStatus, profit: finalProfit };

    const totalProfitSum = Object.values(updatedMonthsMap).reduce((s, m) => s + m.profit, 0);

    const yearTopWilayas = getTopYear("wilaya", 3);
    const yearTopModels = getTopYear("productName", 3);
    const yearTopColors = getTopYear("color", 3);
    const yearTopSizes = getTopYear("size", 3);

    const newYearlySummary: YearlySummary = {
      year: selectedYear,
      months: updatedMonthsMap,
      totalProfit: totalProfitSum,
      topWilayas: yearTopWilayas,
      topModels: yearTopModels,
      topColors: yearTopColors,
      topSizes: yearTopSizes
    };

    if (existingYrIndex >= 0) {
      updatedYearly[existingYrIndex] = newYearlySummary;
    } else {
      updatedYearly.push(newYearlySummary);
    }

    setYearlySummaries(updatedYearly);
    localStorage.setItem("yearlySummaries", JSON.stringify(updatedYearly));

    triggerNotification("تم حفظ وإدراج التقرير الشهري الحالي بنجاح.", "success");
    setShowMonthlyForm(false);
  };

  // ==================== 8. CHART DERIVED STATISTICS ====================
  const allModelStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    deliveredOrders.forEach(o => {
      (o.items || []).forEach(it => {
        if (!stats[it.productName]) stats[it.productName] = { count: 0, revenue: 0 };
        stats[it.productName].count += (it.quantity || 0);
        stats[it.productName].revenue += ((it.sellingPrice || 0) * (it.quantity || 0));
      });
    });

    return Object.entries(stats)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a,b) => b.count - a.count);
  }, [deliveredOrders]);

  const allColorStats = useMemo(() => {
    const stats = getCounts("color");
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count);
  }, [deliveredOrders]);

  const allSizeStats = useMemo(() => {
    const stats = getCounts("size");
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count);
  }, [deliveredOrders]);

  // Worker stats
  const workerStatsSorted = useMemo(() => {
    const stats: Record<string, { count: number; totalSales: number }> = {};
    monthOrders.filter(o => o.status === "pending" || o.status === "delivered").forEach(o => {
      const agent = o.agentName || "غير محدد";
      if (!stats[agent]) stats[agent] = { count: 0, totalSales: 0 };
      stats[agent].count += 1;
      stats[agent].totalSales += getOrderTotal(o);
    });

    return Object.entries(stats)
      .map(([name, d]) => ({
        name,
        ordersCount: d.count,
        salesAmount: d.totalSales,
        averageAmount: d.count > 0 ? Math.round(d.totalSales / d.count) : 0
      }))
      .sort((a,b) => b.ordersCount - a.ordersCount);
  }, [monthOrders]);

  const totalWorkerOrders = useMemo(() => {
    return workerStatsSorted.reduce((s, w) => s + w.ordersCount, 0);
  }, [workerStatsSorted]);

  const workerPieData = useMemo(() => {
    return workerStatsSorted.map(w => ({
      name: w.name,
      value: w.ordersCount,
      percentage: totalWorkerOrders > 0 ? parseFloat((w.ordersCount / totalWorkerOrders * 100).toFixed(1)) : 0
    }));
  }, [workerStatsSorted, totalWorkerOrders]);

  // State calculations for Delivery States (أكثر التوصيلات استلاماً)
  const topDeliveryWilayas = useMemo(() => {
    const counts: Record<string, number> = {};
    deliveredOrders.forEach(o => {
      counts[o.wilaya] = (counts[o.wilaya] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count);
  }, [deliveredOrders]);

  const totalDeliveryWilayaCount = useMemo(() => {
    return topDeliveryWilayas.reduce((s, w) => s + w.count, 0);
  }, [topDeliveryWilayas]);

  const deliveryWilayaPieData = useMemo(() => {
    return topDeliveryWilayas.map(w => ({
      name: w.name,
      value: w.count,
      percentage: totalDeliveryWilayaCount > 0 ? parseFloat((w.count / totalDeliveryWilayaCount * 100).toFixed(1)) : 0
    }));
  }, [topDeliveryWilayas, totalDeliveryWilayaCount]);

  // Returned States metrics (ولاية الأكثر إرجاعاً)
  const wilayaReturnStats = useMemo(() => {
    const stats: Record<string, { delivered: number; returned: number }> = {};
    monthOrders.forEach(o => {
      if (!stats[o.wilaya]) stats[o.wilaya] = { delivered: 0, returned: 0 };
      if (o.status === "delivered") stats[o.wilaya].delivered += 1;
      if (o.status === "returned") stats[o.wilaya].returned += 1;
    });

    return Object.entries(stats)
      .map(([name, d]) => {
        const total = d.delivered + d.returned;
        const rate = total > 0 ? (d.returned / total * 100) : 0;
        return {
          name,
          delivered: d.delivered,
          returned: d.returned,
          returnRate: parseFloat(rate.toFixed(1))
        };
      })
      .sort((a,b) => b.returnRate - a.returnRate);
  }, [monthOrders]);

  const returnWilayaPieData = useMemo(() => {
    return wilayaReturnStats
      .filter(w => w.returned > 0)
      .map(w => ({
        name: w.name,
        value: w.returned,
      }));
  }, [wilayaReturnStats]);

  // ==================== 7. PRINTING FUNCTION (كامل أو قسيمة محددة) ====================
  const handlePrintFullReport = () => {
    const reportHtml = `
      <html>
        <head>
          <title>التقرير المالي العام والمحاسبي - ${selectedMonth} ${selectedYear}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              padding: 40px 25px; 
              background-color: #ffffff;
              color: #111827;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .grid-cards {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .card {
              border: 1px solid #000;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .card h3 { margin: 0 0 10px 0; font-size: 14px; }
            .card p { margin: 0; font-size: 22px; font-weight: 900; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px 12px;
              text-align: right;
              font-size: 13px;
            }
            th { background-color: #f3f4f6; }
            .section-title {
              border-bottom: 2px solid #000;
              padding-bottom: 6px;
              margin-top: 30px;
              font-weight: 900;
            }
            .footer {
              text-align: center;
              margin-top: 60px;
              font-size: 11px;
              color: #6b7280;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <h1 style="margin:0; font-size:24px;">قسيمة الحسابات الختامية السحابية</h1>
            <p style="margin:5px 0 0 0; font-size:14px;">دفتر الأرباح والخسائر لشهر: ${selectedMonth} / ${selectedYear}</p>
          </div>

          <div class="grid-cards">
            <div class="card" style="background:#f0fdf4;">
              <h3>حصيلة المبيعات المسلمة</h3>
              <p>${totalDeliveredSales.toLocaleString()} دج</p>
            </div>
            <div class="card" style="background:#eff6ff;">
              <h3>إجمالي المبيعات (مع التعليق)</h3>
              <p>${totalAllSales.toLocaleString()} دج</p>
            </div>
            <div class="card" style="${finalProfit >= 0 ? "background:#f0fdf4;" : "background:#fef2f2;"}">
              <h3>الربح الصافي النهائي</h3>
              <p>${finalProfit.toLocaleString()} دج</p>
            </div>
          </div>

          <h2 class="section-title">أولا: كشف تفصيلي للميزانية والخصومات</h2>
          <table>
            <thead>
              <tr>
                <th>اسم البند الإداري</th>
                <th>الأرباح والمداخيل</th>
                <th>الأعباء والنفقات المقتطعة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>مجموع صافي مبيعات القطع المباعة (بيع - تكلفة)</td>
                <td style="color:green; font-weight:bold;">+${netProfitPendingDelivered.toLocaleString()} دج</td>
                <td>—</td>
              </tr>
              <tr>
                <td>أعباء إرجاع الطرود للولايات (المرتجع المرفوض)</td>
                <td>—</td>
                <td style="color:red;">-${totalReturnCost.toLocaleString()} دج</td>
              </tr>
              <tr>
                <td>ميزانية الإعلانات والترويج المدفوعة</td>
                <td>—</td>
                <td style="color:red;">-${budgetDzd.toLocaleString()} دج</td>
              </tr>
              <tr>
                <td>تعويضات ومرتبات عمال التشغيل الحالية</td>
                <td>—</td>
                <td style="color:red;">-${totalPaidWorkerAmount.toLocaleString()} دج</td>
              </tr>
              <tr>
                <td>المصاريف التشغيلية (الثابتة والمتغيرة المدمجة)</td>
                <td>—</td>
                <td style="color:red;">-${totalExpensesAmount.toLocaleString()} دج</td>
              </tr>
              <tr>
                <td>تكاليف توصيل الطلبات (توصيل مجاني على عهدة المحل)</td>
                <td>—</td>
                <td style="color:red;">-${deliveryCostOnShop.toLocaleString()} دج</td>
              </tr>
              <tr style="font-weight:bold; background-color:#f9fafb;">
                <td>الحساب الختامي الصافي للمحل</td>
                <td colspan="2" style="font-size:16px; text-align:left; ${finalProfit >= 0 ? "color:green;" : "color:red;"}">
                  ${finalProfit.toLocaleString()} دج (${finalStatus === 'profit' ? 'شهر ناجح' : 'شهر خاسر'})
                </td>
              </tr>
            </tbody>
          </table>

          <h2 class="section-title">ثانياً: أداء الولايات الأكثر بيعاً</h2>
          <table>
            <thead>
              <tr>
                <th>الترتيب</th>
                <th>اسم الولاية</th>
                <th>عدد الطلبيات الموصولة</th>
              </tr>
            </thead>
            <tbody>
              ${topWilayas.map((w, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${w.name}</td>
                  <td>${w.count} (${w.percentage}%)</td>
                </tr>
              `).join("") || '<tr><td colspan="3" style="text-align:center;">لا يوجد أي فواتير</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            تم استخراج التقرير آلياً عبر نظام تسيير المؤسسات Corevia ERP في تمام: ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(reportHtml);
      printWin.document.close();
    } else {
      triggerNotification("يرجى السماح بالنوافذ المنبثقة لفتح قسيمة تذكرة الطباعة", "warning");
    }
  };

  // Keyboard shortcut configuration: P key to trigger prints
  const printPageRef = useRef<() => void>(() => {});
  useEffect(() => {
    printPageRef.current = handlePrintFullReport;
  });

  useEffect(() => {
    const handleKeyShortcut = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;

      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        printPageRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyShortcut);
    return () => window.removeEventListener("keydown", handleKeyShortcut);
  }, []);

  // Keyboard accessibility inside modals
  useEffect(() => {
    const handleModalKeys = (e: KeyboardEvent) => {
      if (!showMonthlyForm) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMonthlyForm(false);
      }
    };
    window.addEventListener("keydown", handleModalKeys);
    return () => window.removeEventListener("keydown", handleModalKeys);
  }, [showMonthlyForm]);

  return (
    <div className="space-y-6 pt-16 md:pt-4 text-right overflow-x-hidden font-sans" dir="rtl" id="profit_workspace_root">
      
      {/* 6.1 STATE NOTIFICATION TOAST BAR */}
      {localNotification && (
        <div className="fixed top-20 left-6 z-55 flex items-center gap-3.5 bg-zinc-950 border border-zinc-850 px-5 py-3 rounded-xl shadow-2xl text-xs animate-fade-in-left">
          <Check className={`w-4 h-4 ${localNotification.type === "success" ? "text-emerald-500" : "text-amber-500"}`} />
          <span className="text-zinc-200 font-bold">{localNotification.msg}</span>
        </div>
      )}

      {/* 6.1 HEADER CONTROLS SHEET (الشريط العلوي) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-505/10 rounded-xl border border-indigo-500/15">
            <Activity className="w-6 h-6 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">ملخص الأرباح والمالية الإدارية</h1>
            <p className="text-[10px] text-zinc-400 mt-0.5">خصم المصاريف العامة، تتبع الإعلانات والترويج، احتساب الديون، الأرباح الصيفية وحقول الولايات.</p>
          </div>
        </div>

        {/* State filters selectors (Month, Year) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-[#040406] border border-zinc-900 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            
            <select
              value={selectedMonth}
              id="selectedMonthSelector"
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer pr-1"
            >
              {MONTH_NAMES_AR.map(m => (
                <option key={m} value={m} className="bg-zinc-950 text-white">{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#040406] border border-zinc-900 rounded-lg px-2.5 py-1.5">
            <Target className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedYear}
              id="selectedYearSelector"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer pr-1"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 4 + i).map(y => (
                <option key={y} value={y} className="bg-zinc-950 text-white">{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowMonthlyForm(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg transition-all shadow-md flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>عرض التقرير الشهري المقارن</span>
          </button>

          <button
            onClick={handlePrintFullReport}
            className="px-4 py-2 bg-zinc-90 w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            title="P key shortcut"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500" />
            <span>طباعة الملخص المالي الكلي</span>
          </button>
        </div>
      </div>

      {/* ==================== 6.2 MONTHLY PROFIT REPORT SAVE MODAL ==================== */}
      {showMonthlyForm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-900 shadow-2xl rounded-2xl flex flex-col p-6 max-h-[92vh] text-right text-slate-100 overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3 flex-row-reverse">
              <button 
                onClick={() => setShowMonthlyForm(false)}
                className="p-1 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-800 text-xs font-black"
              >
                X
              </button>
              <h2 className="text-sm font-black text-amber-500 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-550" />
                <span>إدراج الموازنة والميزان الشهري المجمع لشهر {selectedMonth} {selectedYear}</span>
              </h2>
            </div>

            {/* Content divided blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-5">
              
              {/* Section Outflows */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-900 pb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>تفاصيل الخصومات والمصاريف المدفوعة</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-zinc-400 font-bold">مستحقات العمال الإجمالية</span>
                    <span className="font-mono text-white font-black">{totalWorkerDues.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-emerald-500 font-bold">الرواتب الفعلية المدفوعة</span>
                    <span className="font-mono text-[#50e3c2] font-black">{totalPaidWorkerAmount.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-orange-450 font-bold">إجمالي المصاريف (المدمجة)</span>
                    <span className="font-mono text-orange-400 font-black">{totalExpensesAmount.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-rose-455 font-bold">تكاليف إرجاع الطرود (Penalty)</span>
                    <span className="font-mono text-rose-450 font-black">{totalReturnCost.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-purple-400">
                    <span className="font-bold">توصيل الطلبات على عاتق المحل</span>
                    <span className="font-mono font-black">-{deliveryCostOnShop.toLocaleString()} دج</span>
                  </div>

                  {monthAdEntries.length > 0 && (
                    <div className="bg-slate-900/10 border border-slate-500/10 p-3 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sky-400 font-semibold">ميزانية الإعلان المتبناة</span>
                        <span className="font-mono text-sky-400 font-bold">{budgetDzd.toLocaleString()} دج</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>المبلغ المستهلك الكي</span>
                        <span>{totalAdUsd.toLocaleString()} USD</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>سعر الصرف الإعلانات</span>
                        <span>{avgExchangeRate} دج/دولار</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>أيام استهلاك الحملات</span>
                        <span>{adDays} يوم (يومي: {adDailyCost.toLocaleString()} دج)</span>
                      </div>
                    </div>
                  )}

                  <div className={`mt-4 p-4 border rounded-xl flex flex-col items-center justify-center text-center ${finalProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-505/20"}`}>
                    <span className="text-[10px] text-zinc-450 uppercase tracking-widest block">الربح المالي الصافي النهائي للنشاط</span>
                    <span className={`text-2xl font-black font-mono mt-1 ${finalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {finalProfit.toLocaleString()} دج
                    </span>
                    <span className="text-[10px] mt-2 font-black">
                      {finalStatus === 'profit' ? '✅ موازنة خضراء - شهر ناجح ومحقق للنمو والفوائد' : '❌ موازنة حمراء - فترة خسارة مالية مقتطعة'}
                    </span>
                  </div>

                </div>
              </div>

              {/* Section Inflows Sales */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-900 pb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>ملخص التوريدات ومداخيل المبيعات</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-zinc-450">إجمالي المبيعات (مستلمة + معلقة)</span>
                    <span className="font-mono text-emerald-450 font-bold">+{totalAllSales.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-emerald-400">
                    <span className="font-bold">المداخيل الموثقة للطلبات المستلمة</span>
                    <span className="font-mono font-black">+{totalDeliveredSales.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-[#ffc658]">
                    <span className="font-bold">المنتجات المعلقة قيد التسليم</span>
                    <span className="font-mono font-black">+{totalPendingSales.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-rose-400">
                    <span className="font-bold">المبيعات المهملة (الملغاة والمرتجعة)</span>
                    <span className="font-mono font-black">-{totalReturnedSales.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-amber-500">
                    <span className="font-bold">تكلفة السلع والمخرجات الأصلية (دون التوصيل)</span>
                    <span className="font-mono font-black">-{totalCostPendingDelivered.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg text-emerald-500 font-bold">
                    <span>صافي هامش بيع القطع (الربح الإجمالي)</span>
                    <span className="font-mono font-black">+{netProfitPendingDelivered.toLocaleString()} دج</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#09090b] p-2.5 border border-zinc-900 rounded-lg">
                    <span className="text-zinc-450 font-bold">هامش الربح التشغيلي المجمع</span>
                    <span className="font-mono text-[#50e3c2] font-black">{profitMargin.toFixed(1)}%</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Actions modal footer */}
            <div className="border-t border-zinc-900 pt-3 flex justify-end gap-2 text-xs">
              <button 
                onClick={() => setShowMonthlyForm(false)}
                className="px-4 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:text-white"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleSaveMonth}
                className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-black rounded-lg shadow-lg flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>حفظ وإغلاق التقرير</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== 6.4 ROW 1: SALES AND ORDERS SCORECARDS (الصف الأول) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="scorecards_row_first">
        
        {/* Total revenue potential card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 relative overflow-hidden flex flex-col">
          <div className="absolute right-0 bottom-0 select-none translate-y-2 pointer-events-none">
            <Building2 className="w-14 h-14 text-zinc-900/35" />
          </div>
          <span className="text-[10px] text-zinc-400 font-bold mb-1">إجمالي المبيعات (مستلمة + معلقة)</span>
          <span className="text-lg font-black font-mono text-zinc-100">{totalAllSales.toLocaleString()} دج</span>
          <p className="text-[9px] text-zinc-500 mt-2 flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 font-bold rounded">{pendingDeliveredOrders.length}</span>
            <span>طلبية مسجلة قيد الدريسي</span>
          </p>
        </div>

        {/* Confirmed Delivery card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 relative overflow-hidden flex flex-col">
          <div className="absolute right-0 bottom-0 select-none translate-y-2 pointer-events-none">
            <Check className="w-14 h-14 text-zinc-900/35" />
          </div>
          <span className="text-[10px] text-zinc-400 font-bold mb-1">إجمالي المبيعات المستلمة للزبائن</span>
          <span className="text-lg font-black font-mono text-emerald-400">{totalDeliveredSales.toLocaleString()} دج</span>
          <p className="text-[9px] text-zinc-500 mt-2 flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 font-bold text-emerald-400 rounded">{deliveredOrders.length}</span>
            <span>طلبيات مسلمة بالكامل للزبون</span>
          </p>
        </div>

        {/* Pending Deliveries card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 relative overflow-hidden flex flex-col">
          <div className="absolute right-0 bottom-0 select-none translate-y-2 pointer-events-none">
            <Activity className="w-14 h-14 text-zinc-900/35" />
          </div>
          <span className="text-[10px] text-zinc-400 font-bold mb-1">المبيعات قيد الانتظار والتوصيل</span>
          <span className="text-lg font-black font-mono text-yellow-500">{totalPendingSales.toLocaleString()} دج</span>
          <p className="text-[9px] text-zinc-500 mt-2 flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 font-bold text-yellow-450 rounded">{pendingOrders.length}</span>
            <span>طلبية للتسليم قيد الاتصال</span>
          </p>
        </div>

        {/* Failed Returned Sales card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 relative overflow-hidden flex flex-col">
          <div className="absolute right-0 bottom-0 select-none translate-y-2 pointer-events-none">
            <X className="w-14 h-14 text-zinc-900/35" />
          </div>
          <span className="text-[10px] text-zinc-400 font-bold mb-1">مداخيل المبيعات المرفوضة (المرتجعات)</span>
          <span className="text-lg font-black font-mono text-[#f65a5a]">{totalReturnedSales.toLocaleString()} دج</span>
          <p className="text-[9px] text-zinc-500 mt-2 flex items-center gap-1">
            <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 font-bold text-rose-455 rounded">{returnedOrders.length}</span>
            <span>طلبيات رجعت بالكامل مجدداً</span>
          </p>
        </div>

      </div>

      {/* ==================== 6.5 ROW 2: COSTS & OUTFLOW SCORECARDS (الصف الثاني) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3" id="scorecards_row_second">
        
        {/* Product standard cost */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">إجمالي تكلفة المخرجات (COGS)</span>
          <span className="text-[15px] font-mono text-rose-350 font-black mt-1">{totalCostPendingDelivered.toLocaleString()} دج</span>
          <span className="text-[8px] text-zinc-550 mt-1">سعر شراء السلعة الأصلي للتحميل</span>
        </div>

        {/* Delivery Costs On Shop */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">توصيل على عاتق المحل</span>
          <span className="text-[15px] font-mono text-purple-400 font-black mt-1">-{deliveryCostOnShop.toLocaleString()} دج</span>
          <span className="text-[8px] text-zinc-550 mt-1">طلب مجاني التوصيل للعميل</span>
        </div>

        {/* Net Profit Margin Card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">صافي الأرباح (الخام)</span>
          <span className="text-[15px] font-mono text-emerald-400 font-black mt-1">+{netProfitPendingDelivered.toLocaleString()} دج</span>
          <span className="text-[8px] text-emerald-450 font-mono mt-1 font-semibold">{profitMargin.toFixed(1)}% هامش البيع</span>
        </div>

        {/* Ads outlay */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">ميزانية الإعلانات الترويجية</span>
          <span className="text-[15px] font-mono text-sky-400 font-black mt-1">-{budgetDzd.toLocaleString()} دج</span>
          <span className="text-[8px] text-zinc-500 mt-1">{totalAdUsd.toLocaleString()} USD | الصرف {avgExchangeRate}</span>
        </div>

        {/* Monthly General overheads */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">نفقات المصاريف (ثابتة+متغيرة)</span>
          <span className="text-[15px] font-mono text-emerald-400 font-black mt-1">-{totalExpensesAmount.toLocaleString()} دج</span>
          <span className="text-[8px] text-emerald-500 mt-1">ثابتة {totalFixedExpenses.toLocaleString()} دج | متغيرة {totalVariableExpenses.toLocaleString()} دج</span>
        </div>

        {/* Return Penalties */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">تكاليف إرجاع الطلبيات</span>
          <span className="text-[15px] font-mono text-orange-400 font-black mt-1">-{totalReturnCost.toLocaleString()} دج</span>
          <span className="text-[8px] text-zinc-550 mt-1">رسوم شحن مستحقة للمرتجعات المرفوضة</span>
        </div>

        {/* Suppliers Debt */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-3 flex flex-col">
          <span className="text-[9.5px] text-zinc-450 font-bold">ديون الموردين المترتبة</span>
          <span className="text-[15px] font-mono text-rose-450 font-black mt-1">{totalSupplierDebt.toLocaleString()} دج</span>
          <span className="text-[8px] text-zinc-550 mt-1">المصاريف الآجلة لفواتير التوريد</span>
        </div>

      </div>

      {/* ==================== 6.6 ROW 3: STOCK & SUPPLIERS FINANCIAL METRICS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Inventory Values Cost block */}
        <div className="bg-[#09090b] border-2 border-zinc-900 rounded-2xl p-5 relative overflow-hidden flex flex-col">
          <div className="absolute right-0 bottom-0 select-none translate-y-2 pointer-events-none text-zinc-900/15 text-7xl font-mono">DZD</div>
          <span className="text-xs text-zinc-400 font-bold">القيمة الحسابية الإجمالية للمخزون (الأساسي + الفرعي + المرتجع)</span>
          
          <span className="text-xl font-black font-mono text-zinc-100 mt-2">
            {totalInventoryCost.toLocaleString()} <span className="text-xs font-normal">دج</span>
          </span>

          <div className="flex items-center gap-4 mt-4 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>المخزون الأساسي: <strong className="font-mono text-white">{totalBasicItems}</strong> قطعة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span>المخزون الفرعي: <strong className="font-mono text-white">{totalSubItems}</strong> قطعة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span>مرتجع المخزن: <strong className="font-mono text-white">{totalReturnQty}</strong> قطعة</span>
            </div>
            <div className="flex items-center gap-2 border-r border-zinc-850 pr-4">
              <span>إجمالي السلع الكلي: <strong className="font-mono text-[#50e3c2]">{totalStockQty}</strong> قطعة</span>
            </div>
          </div>
        </div>

        {/* Paid and clear to Suppliers ledger */}
        <div className="bg-[#09090b] border-2 border-zinc-900 rounded-2xl p-5 relative overflow-hidden flex flex-col">
          <span className="text-xs text-zinc-400 font-bold">الدفعات والتحويلات النقدية المسددة للموردين</span>
          
          <span className="text-xl font-black font-mono text-[#50e3c2] mt-2">
            {totalPaidToSuppliers.toLocaleString()} <span className="text-xs font-normal text-zinc-350">دج</span>
          </span>

          <p className="text-[10px] text-zinc-500 mt-4">
            إجمالي المدفوعات المسجلة للشركاء والموردين عبر جميع وصولات الفواتير الآمنة السابقة.
          </p>
        </div>

      </div>

      {/* ==================== 6.7 ROW 4: WORKER DUETS METRICS (صف العمال) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="workers_dues_matrix">
        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-xl flex flex-col text-right">
          <span className="text-[10px] text-zinc-400 font-bold">مستحقات أجور العمال غير المدفوعة (دَيْن)</span>
          <span className={`text-lg font-black font-mono mt-1.5 ${totalWorkerDues - totalPaidWorkerAmount > 0 ? "text-rose-450" : "text-emerald-400"}`}>
            {(totalWorkerDues - totalPaidWorkerAmount).toLocaleString()} دج
          </span>
          <span className="text-[8px] text-zinc-500 mt-1">الرواتب المتبقية المسجلة في السجلات الإدارية</span>
        </div>

        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-xl flex flex-col text-right">
          <span className="text-[10px] text-zinc-400 font-bold">الرواتب المسددة والمدفوعة حالياً</span>
          <span className="text-lg font-black font-mono text-[#50e3c2] mt-1.5">
            {totalPaidWorkerAmount.toLocaleString()} دج
          </span>
          <span className="text-[8px] text-zinc-500 mt-1">المكافآت والرواتب الفعلية الموزعة</span>
        </div>

        <div className="bg-[#09090b] border border-zinc-900 p-4 rounded-xl flex flex-col text-right">
          <span className="text-[10px] text-zinc-400 font-bold">أعباء وتكاليف المرتجعات اللوجستية</span>
          <span className="text-lg font-black font-mono text-orange-450 mt-1.5">
            {totalReturnCost.toLocaleString()} دج
          </span>
          <span className="text-[8px] text-zinc-500 mt-1">تكلفة شحن الطرود المسترجعة للولايات</span>
        </div>
      </div>

      {/* ==================== 6.8 DYNAMIC EXTREME PROFIT/LOSS BANNER ==================== */}
      <div className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${finalProfit >= 0 ? "bg-emerald-950/10 border-emerald-500/25 text-emerald-300" : "bg-rose-950/10 border-rose-500/25 text-rose-300"}`} id="ultimate_profit_summary_banner">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest block opacity-75">الميزان الختامي للربحية</span>
          <h2 className="text-2xl font-black font-mono mt-1">
            {finalProfit >= 0 ? "+" : ""}{finalProfit.toLocaleString()} دج
          </h2>
          <p className="text-xs mt-1 text-zinc-400">القيمة الصافية المتبقية للمؤسسة بعد خصم العمال، الإشهارات، المرتجع، التوصيل الحر والصيانة.</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-black">
          {finalProfit >= 0 ? (
            <span className="px-3.5 py-1.5 bg-emerald-500 text-black rounded-lg shadow-md">
              ✅ شهر ناجح ومربح للمحل
            </span>
          ) : (
            <span className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg shadow-md animate-pulse">
              ⚠️ ميزانية خاسرة ومثقلة بالأعباء
            </span>
          )}
        </div>
      </div>

      {/* ==================== 6.9 TOP 3 - CURRENT MONTH CATEGORIZED CHARTS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="top_stats_pnl">
        
        {/* Top wilayas */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-5 text-right flex flex-col">
          <h3 className="text-xs font-extrabold text-[#50e3c2] flex items-center gap-1 border-b border-zinc-950 pb-2 mb-4">
            <MapPin className="w-4 h-4" />
            <span>🗺️ أكثر 3 ولايات استلاماً للمبيعات</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
            {/* Table stats representation */}
            <div className="space-y-3 text-xs">
              {topWilayas.length === 0 ? (
                <p className="text-zinc-500 text-center py-6">لا يوجد أي مبيعات مستلمة لتحديد المواقع</p>
              ) : (
                topWilayas.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-zinc-200">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-500">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-mono text-zinc-400 font-bold">{item.count} قطعة ({item.percentage}%)</span>
                  </div>
                ))
              )}
            </div>

            {/* Recharts Pie component */}
            <div className="w-full h-40">
              {topWilayas.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topWilayas}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {topWilayas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top Selling Models */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-5 text-right flex flex-col">
          <h3 className="text-xs font-extrabold text-[#50e3c2] flex items-center gap-1 border-b border-zinc-950 pb-2 mb-4">
            <Package className="w-4 h-4" />
            <span>👕 أفضل 3 موديلات وسلع مبيعاً</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
            <div className="space-y-3 text-xs">
              {topModels.length === 0 ? (
                <p className="text-zinc-500 text-center py-6">لم يتم رصد أصناف مسلّمة ومباعة هذا الشهر</p>
              ) : (
                topModels.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-zinc-200">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-500">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-mono text-zinc-400 font-bold">{item.count} قطعة ({item.percentage}%)</span>
                  </div>
                ))
              )}
            </div>

            <div className="w-full h-40">
              {topModels.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topModels}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {topModels.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PALETTE[(index + 1) % COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top Colors and Sizes */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-5 text-right flex flex-col">
          <h3 className="text-xs font-extrabold text-[#50e3c2] flex items-center gap-1 border-b border-zinc-950 pb-2 mb-4">
            <Sparkles className="w-4 h-4" />
            <span>🎨 أفضل 3 ألوان تطلبها الزبائن</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
            <div className="space-y-3 text-xs">
              {topColors.length === 0 ? (
                <p className="text-zinc-500 text-center py-6">لا يوجد مبيعات كافية لتصنيف الألوان</p>
              ) : (
                topColors.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-zinc-200">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-500">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-mono text-zinc-400 font-bold">{item.count} قطعة ({item.percentage}%)</span>
                  </div>
                ))
              )}
            </div>

            <div className="w-full h-40">
              {topColors.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topColors}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {topColors.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PALETTE[(index + 2) % COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top Sizes */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-5 text-right flex flex-col">
          <h3 className="text-xs font-extrabold text-[#50e3c2] flex items-center gap-1 border-b border-zinc-950 pb-2 mb-4">
            <Percent className="w-4 h-4" />
            <span>📏 الموديلات بمقاساتها الأكثر تفضيلاً</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
            <div className="space-y-3 text-xs">
              {topSizes.length === 0 ? (
                <p className="text-zinc-500 text-center py-6">لم تسجّل مقاسات مبيعات هذا الشهر</p>
              ) : (
                topSizes.map((item, idx) => (
                  <div key={item.name} className="flex justify-between items-center text-zinc-200">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-500">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span className="font-semibold">{item.name}</span>
                    </span>
                    <span className="font-mono text-zinc-400 font-bold">{item.count} قطعة ({item.percentage}%)</span>
                  </div>
                ))
              )}
            </div>

            <div className="w-full h-40">
              {topSizes.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topSizes}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {topSizes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_PALETTE[(index + 3) % COLORS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ==================== 6.10 DETAILED RETAILY METRICS AND TABLES GRID ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="retaily_ranking_tables">
        
        {/* Models ranking with detailed revenue calculations */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-black text-white border-b border-zinc-950 pb-2">سجل ترتيب السلع والموديلات مبيعاً</h3>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
            {allModelStats.length === 0 ? (
              <p className="text-zinc-500 text-center py-6">لا يوجد بيانات للسلع</p>
            ) : (
              allModelStats.map((it, idx) => (
                <div key={it.name} className="flex justify-between items-center p-2 bg-[#040406]/55 border border-zinc-900 rounded-lg">
                  <div>
                    <span className="font-bold text-zinc-100">{it.name}</span>
                    <span className="text-[10px] text-zinc-450 block font-mono">الإيرادات: {it.revenue.toLocaleString()} دج</span>
                  </div>
                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-850 text-white font-black font-mono text-[10px] rounded">
                    {it.count} قطعة
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Colors stats ranks */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-black text-white border-b border-zinc-950 pb-2">سجل الألوان الأكثر طلبا</h3>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
            {allColorStats.length === 0 ? (
              <p className="text-zinc-500 text-center py-6">لا يوجد مبيعات ألوان</p>
            ) : (
              allColorStats.map((it, idx) => (
                <div key={it.name} className="flex justify-between items-center p-2 bg-[#040406]/55 border border-zinc-900 rounded-lg">
                  <span className="font-bold text-zinc-200">{it.name}</span>
                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-850 text-sky-400 font-bold font-mono text-[10px] rounded">
                    {it.count} قطعة
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sizes stats ranks */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-black text-white border-b border-zinc-950 pb-2">سجل المقاسات الأكثر تفضيلا</h3>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
            {allSizeStats.length === 0 ? (
              <p className="text-zinc-500 text-center py-6">لا يوجد مقاسات توريد مسلّمة</p>
            ) : (
              allSizeStats.map((it, idx) => (
                <div key={it.name} className="flex justify-between items-center p-2 bg-[#040406]/55 border border-zinc-900 rounded-lg">
                  <span className="font-bold text-zinc-200">{it.name}</span>
                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-850 text-[#ffc658] font-bold font-mono text-[10px] rounded">
                    {it.count} قطعة
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ==================== 6.11 WORKER PERFORMANCE DIRECTORY AND CHARTS ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 space-y-4" id="worker_performance_directory">
        <div>
          <h2 className="text-sm font-black text-white flex items-center gap-1.5 border-b border-zinc-950 pb-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <span>📊 مصفوفة متابعة أداء العمال والموظفين (تسجيل الإثباتات)</span>
          </h2>
          <p className="text-[10px] text-zinc-400 mt-0.5">ترتيب تنازلي للعمال حسب إجمالي المبيعات والطلبيات المنجز تأكيدها</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-6 overflow-x-auto border border-zinc-900 rounded-xl">
            <table className="w-full text-right text-xs bg-[#040406]/20">
              <thead>
                <tr className="bg-zinc-950/40 text-[10px] text-zinc-400 border-b border-zinc-900">
                  <th className="p-3 w-12 text-center">الترتيب</th>
                  <th className="p-3">اسم العامل / موظف التأكيد</th>
                  <th className="p-3 text-center">عدد الطلبات</th>
                  <th className="p-3 text-left">إجمالي المبيعات المنجزة</th>
                  <th className="p-3 text-left">متوسط قيمة الطلب الواحد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {workerStatsSorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-500 font-semibold">لم تسجّل أي معاملات بيع للعمال هذا الشهر</td>
                  </tr>
                ) : (
                  workerStatsSorted.map((w, i) => (
                    <tr key={w.name} className="hover:bg-zinc-900/10">
                      <td className="p-3 text-center text-zinc-400 font-bold">{i + 1}</td>
                      <td className="p-3 font-bold text-zinc-200">{w.name}</td>
                      <td className="p-3 text-center font-mono">{w.ordersCount}</td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-400">{w.salesAmount.toLocaleString()} دج</td>
                      <td className="p-3 text-left font-mono text-zinc-400">{w.averageAmount.toLocaleString()} دج</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 h-52">
            <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-450 block mb-2 font-bold">توزيع الحصص من المبيعات</span>
              <div className="w-full h-36">
                {workerPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workerPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={45}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {workerPieData.map((e, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS_PALETTE[idx % COLORS_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-zinc-650 pt-12 text-xs">لا توجد بيانات</p>
                )}
              </div>
            </div>

            <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-455 block mb-2 font-bold">قيمة العوائد مقارنة بالطلب</span>
              <div className="w-full h-36">
                {workerStatsSorted.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workerStatsSorted}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#555" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#555" />
                      <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                      <Bar dataKey="salesAmount" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-zinc-650 pt-12 text-xs">لا توجد مخططات للتبني</p>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ==================== 6.12 GEOGRAPHICAL WILAYAS STATISTICS ANALYSIS ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 space-y-5" id="wilayas_geographical_statistics">
        <div>
          <h2 className="text-sm font-black text-white border-b border-zinc-950 pb-2">🗺️ مصفوفة تحليل التوزيع الجغرافي ونظام المرتجعات للولايات الجزائيرية</h2>
          <p className="text-[10px] text-zinc-400 mt-0.5">دراسة ولايات التسليم الأكثر استلاماً ومقارنتها بنسبة الارتجاع اللوجستية المفروضة</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Delivering states */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-xs font-black text-[#50e3c2] flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>المدن والولايات الأكثر تسليماً واستلاماً</span>
            </h3>
            
            <div className="overflow-x-auto border border-zinc-900 rounded-xl">
              <table className="w-full text-right text-xs bg-[#040406]/20">
                <thead>
                  <tr className="bg-zinc-950/40 text-[10px] text-zinc-400 border-b border-zinc-900">
                    <th className="p-2.5 w-12 text-center">الترتيب</th>
                    <th className="p-2.5">اسم الولاية</th>
                    <th className="p-2.5 text-center">عدد التوصيلات المغلقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {topDeliveryWilayas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-zinc-500">لا يوجد طلبيات للتحليل</td>
                    </tr>
                  ) : (
                    topDeliveryWilayas.map((it, idx) => (
                      <tr key={it.name}>
                        <td className="p-2.5 text-center font-bold text-zinc-350">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-white mb-1">{it.name}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-450">{it.count} طلبيات</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-48">
              <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-zinc-450 font-bold mb-1 block">توزيع الاستلامات الجغرافي</span>
                <div className="w-full h-36">
                  {deliveryWilayaPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deliveryWilayaPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {deliveryWilayaPieData.map((e, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS_PALETTE[(idx + 4) % COLORS_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-zinc-650 pt-12 text-xs">لا توجد بيانات</p>
                  )}
                </div>
              </div>

              <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-zinc-455 font-bold mb-1 block">مستويات التسليم الكلي</span>
                <div className="w-full h-36">
                  {topDeliveryWilayas.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDeliveryWilayas}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#5aa" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#5aa" />
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                        <Bar dataKey="count" fill="#3182ce" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-zinc-650 pt-12 text-xs">لم يسجل إحصاء للمخطط</p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Return states ratings */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-xs font-black text-rose-455 flex items-center gap-1">
              <X className="w-4 h-4" />
              <span>المدن والولايات الأكثر ارجاعا للطرود (الخسارة اللوجستية)</span>
            </h3>

            <div className="overflow-x-auto border border-zinc-900 rounded-xl">
              <table className="w-full text-right text-xs bg-[#040406]/20">
                <thead>
                  <tr className="bg-zinc-950/40 text-[10px] text-zinc-400 border-b border-zinc-900">
                    <th className="p-2.5 w-12 text-center">الترتيب</th>
                    <th className="p-2.5">اسم الولاية</th>
                    <th className="p-2.5 text-center">المستلمة</th>
                    <th className="p-2.5 text-center">المرتجع الكلي</th>
                    <th className="p-2.5 text-left">نسبة الارتجاع المئوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {wilayaReturnStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-zinc-500">لا يوجد أي مرتجعات لرصدها للتحليل مقارنة بالتسليم</td>
                    </tr>
                  ) : (
                    wilayaReturnStats.map((it, idx) => (
                      <tr key={it.name}>
                        <td className="p-2.5 text-center font-bold text-zinc-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-white">{it.name}</td>
                        <td className="p-2.5 text-center font-mono">{it.delivered}</td>
                        <td className="p-2.5 text-center font-mono text-rose-450 font-bold">{it.returned}</td>
                        <td className="p-2.5 text-left font-mono font-bold text-rose-500">{it.returnRate}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-48">
              <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-zinc-450 font-bold mb-1 block">توزيع المرتجعات التراكمي</span>
                <div className="w-full h-36">
                  {returnWilayaPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={returnWilayaPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {returnWilayaPieData.map((e, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS_PALETTE[(idx + 2) % COLORS_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-zinc-650 pt-12 text-xs">لا توجد مرتجعات مسجلة</p>
                  )}
                </div>
              </div>

              <div className="w-full h-full bg-black/15 border border-zinc-900 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] text-zinc-455 font-bold mb-1 block">منسوب الارتجاع والرفض لمستقبل الولايات</span>
                <div className="w-full h-36">
                  {wilayaReturnStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wilayaReturnStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#faa" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#faa" />
                        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
                        <Bar dataKey="returnRate" fill="#e53e3e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-zinc-650 pt-12 text-xs">لا يوجد مخططات للاستعراض</p>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ==================== 6.13 ANNUAL PROGRESS SUMMARY ANALYSIS ==================== */}
      {yearSummary && (
        <div className="bg-[#09090b] border-2 border-zinc-900 rounded-2xl p-5 space-y-5" id="annual_progress_summary_analysis">
          <div className="flex border-b border-zinc-950 pb-2 justify-between items-center text-right flex-row-reverse w-full">
            <span className="px-3.5 py-1 text-xs font-black bg-indigo-650/15 border border-indigo-500/10 text-indigo-400 rounded-lg">
              الملخص السنوي - {selectedYear}
            </span>
            <h2 className="text-sm font-black text-white">📈 الميزان السنوي والدليل المجمع لأرباح السنة الكلية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Top Wilayas progress status */}
            <div className="p-4 bg-black/30 border border-zinc-900 rounded-xl flex flex-col justify-between text-right">
              <div>
                <span className="text-[10px] text-zinc-450 font-bold uppercase block mb-3">أكثر ولاية تسليما للسنة الكلية</span>
                {yearSummary.topWilayas && yearSummary.topWilayas[0] ? (
                  <>
                    <h4 className="text-sm font-black text-zinc-200">{yearSummary.topWilayas[0].name}</h4>
                    <span className="text-[10px] text-zinc-400 block mt-1">{yearSummary.topWilayas[0].count} توصيل ({yearSummary.topWilayas[0].percentage}%)</span>
                  </>
                ) : (
                  <span className="text-zinc-550 text-xs">—</span>
                )}
              </div>
              
              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-550 rounded-full" 
                  style={{ width: `${yearSummary.topWilayas && yearSummary.topWilayas[0] ? yearSummary.topWilayas[0].percentage : 0}%` }}
                />
              </div>
            </div>

            {/* Top Product Model progress status */}
            <div className="p-4 bg-black/30 border border-zinc-900 rounded-xl flex flex-col justify-between text-right">
              <div>
                <span className="text-[10px] text-zinc-455 font-bold uppercase block mb-3">الصنف / الموديل السنوي الأكثر حصادا</span>
                {yearSummary.topModels && yearSummary.topModels[0] ? (
                  <>
                    <h4 className="text-sm font-black text-zinc-200">{yearSummary.topModels[0].name}</h4>
                    <span className="text-[10px] text-zinc-400 block mt-1">{yearSummary.topModels[0].count} قطعة ({yearSummary.topModels[0].percentage}%)</span>
                  </>
                ) : (
                  <span className="text-zinc-550 text-xs">—</span>
                )}
              </div>

              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" 
                  style={{ width: `${yearSummary.topModels && yearSummary.topModels[0] ? yearSummary.topModels[0].percentage : 0}%` }}
                />
              </div>
            </div>

            {/* Top Size progress status */}
            <div className="p-4 bg-black/30 border border-zinc-900 rounded-xl flex flex-col justify-between text-right">
              <div>
                <span className="text-[10px] text-zinc-450 font-bold uppercase block mb-3">المقاس السنوي القياسي المفضل</span>
                {yearSummary.topSizes && yearSummary.topSizes[0] ? (
                  <>
                    <h4 className="text-sm font-black text-zinc-200">المقاس {yearSummary.topSizes[0].name}</h4>
                    <span className="text-[10px] text-zinc-400 block mt-1">{yearSummary.topSizes[0].count} قطعة ({yearSummary.topSizes[0].percentage}%)</span>
                  </>
                ) : (
                  <span className="text-zinc-550 text-xs">—</span>
                )}
              </div>

              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full" 
                  style={{ width: `${yearSummary.topSizes && yearSummary.topSizes[0] ? yearSummary.topSizes[0].percentage : 0}%` }}
                />
              </div>
            </div>

            {/* Top colors progress status */}
            <div className="p-4 bg-black/30 border border-zinc-900 rounded-xl flex flex-col justify-between text-right">
              <div>
                <span className="text-[10px] text-zinc-455 font-bold uppercase block mb-3">اللون الأكثر جذبا وشعبية في عامه</span>
                {yearSummary.topColors && yearSummary.topColors[0] ? (
                  <>
                    <h4 className="text-sm font-black text-zinc-200">{yearSummary.topColors[0].name}</h4>
                    <span className="text-[10px] text-zinc-400 block mt-1">{yearSummary.topColors[0].count} قطعة ({yearSummary.topColors[0].percentage}%)</span>
                  </>
                ) : (
                  <span className="text-zinc-550 text-xs">—</span>
                )}
              </div>

              <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden mt-4">
                <div 
                  className="h-full bg-gradient-to-r from-[#8884d8] to-[#82ca9d] rounded-full" 
                  style={{ width: `${yearSummary.topColors && yearSummary.topColors[0] ? yearSummary.topColors[0].percentage : 0}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================== 12. EMPTY STATE ALERT (الحالة: لا توجد طلبات) ==================== */}
      {monthOrders.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-350 px-5 py-4 rounded-xl flex items-center justify-between text-right text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span>
              <strong>تحذير عدم توفر سجلات:</strong> لم يتم العثور على أي حركات أو طلبيات بيع مدرجة طوال الشهر المحدد ({selectedMonth}). جميع الإحصائيات النسبية سيتم تصفيرها تلقائياً.
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
