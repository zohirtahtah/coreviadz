/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo, Fragment } from "react";
import { Order, Expense, Worker, LanguageType } from "../types";
import { translations } from "../translations";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Line 
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Package, ShoppingBag, 
  ChevronRight, Calendar, Activity, Check, AlertCircle, Award, 
  Layers, MapPin, Tag, Palette, Ruler, BarChart3, HelpCircle, 
  Target, Percent, Landmark
} from "lucide-react";
import { TopItem, MonthlyProfit, YearlySummary } from "./ProfitView";
import { SmartCountryMap } from "./SmartCountryMap";

interface YearlyViewProps {
  orders: Order[];
  expenses: Expense[];
  workers: Worker[];
  lang: LanguageType;
}

const MONTH_NAMES_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#84cc16"
];

export default function YearlyView({
  orders,
  expenses,
  workers,
  lang
}: YearlyViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // ==================== 4. STATE VARIABLES ====================
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [productSortBy, setProductSortBy] = useState<"qty" | "revenue" | "profit">("qty");
  const [hoveredWilaya, setHoveredWilaya] = useState<any>(null);
  const [hoveredSlice, setHoveredSlice] = useState<Record<string, { name: string; count: number; percentage: number } | null>>({});

  // Load Saved collections from local storage with robust parsing safety
  const monthlyProfits: MonthlyProfit[] = useMemo(() => {
    const stored = localStorage.getItem("monthlyProfits");
    if (!stored || stored === "undefined" || stored === "null") return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }, [selectedYear]);

  const yearlySummaries: YearlySummary[] = useMemo(() => {
    const stored = localStorage.getItem("yearlySummaries");
    if (!stored || stored === "undefined" || stored === "null") return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }, [selectedYear]);

  // ==================== 5. CORE BUSINESS CALCULATIONS ====================

  // 5.1 yearOrders
  const yearOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.date) return false;
      const d = new Date(o.date);
      return d.getFullYear() === selectedYear;
    });
  }, [orders, selectedYear]);

  // 5.2 yearDelivered
  const yearDelivered = useMemo(() => {
    return yearOrders.filter(o => o.status === "delivered");
  }, [yearOrders]);

  // 5.3 yearReturned
  const yearReturned = useMemo(() => {
    return yearOrders.filter(o => o.status === "returned");
  }, [yearOrders]);

  // Helper helper to get Order Total consistent with ProfitView
  const getOrderTotal = (o: Order) => {
    return (o.totalPrice || 0) + (o.customerPaysDelivery ? (o.deliveryPrice || 0) : 0) - (o.discount || 0);
  };

  // 5.4 yearTotalSales (مجموع مبيعات الطلبات المستلمة والمنجزة فقط للولايات)
  const yearTotalSales = useMemo(() => {
    return yearDelivered.reduce((sum, o) => sum + getOrderTotal(o), 0);
  }, [yearDelivered]);

  // 5.5 getTop(field, n)
  const getTop = (field: "wilaya" | "productName" | "color" | "size", n: number): TopItem[] => {
    const counts: Record<string, number> = {};
    yearDelivered.forEach(o => {
      const itemsList = o.items || [];
      if (field === "wilaya") {
        const qtySum = itemsList.reduce((sum, it) => sum + (it.quantity || 1), 0);
        counts[o.wilaya] = (counts[o.wilaya] || 0) + qtySum;
      } else {
        itemsList.forEach(it => {
          const val = field === "productName" ? it.productName : (field === "color" ? it.color : it.size);
          if (val) {
            counts[val] = (counts[val] || 0) + (it.quantity || 1);
          }
        });
      }
    });

    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0
      }));
  };

  const topWilayas = useMemo(() => getTop("wilaya", 10), [yearDelivered]);
  const topModels = useMemo(() => getTop("productName", 10), [yearDelivered]);
  const topColors = useMemo(() => getTop("color", 10), [yearDelivered]);
  const topSizes = useMemo(() => getTop("size", 10), [yearDelivered]);

  // 5.6 monthlyData (12 months summary matrix mapped elegantly)
  const monthlyData = useMemo(() => {
    return MONTH_NAMES_AR.map((mn, i) => {
      const mp = monthlyProfits.find(p => p.month === mn && p.year === selectedYear);
      if (mp) {
        return {
          month: mn,
          profit: mp.finalProfit,
          sales: mp.totalSales,
          cost: mp.totalCost + mp.returnCostTotal + mp.workerSalariesTotal + mp.adBudgetTotal,
          delivered: mp.deliveredOrders,
          returned: mp.returnedOrders,
        };
      } else {
        // Fallback calculations directly on date indexing
        const mOrders = yearOrders.filter(o => o.date && new Date(o.date).getMonth() === i);
        const mDelivered = mOrders.filter(o => o.status === "delivered");
        const mReturned = mOrders.filter(o => o.status === "returned");
        
        const mSales = mDelivered.reduce((sum, o) => sum + getOrderTotal(o), 0);
        const mCost = mDelivered.reduce((s, o) => {
          return s + (o.items || []).reduce((sum, it) => sum + (it.productCost || 0) * (it.quantity || 1), 0);
        }, 0);

        return {
          month: mn,
          profit: mSales - mCost,
          sales: mSales,
          cost: mCost,
          delivered: mDelivered.length,
          returned: mReturned.length
        };
      }
    });
  }, [monthlyProfits, selectedYear, yearOrders]);

  // 5.7 yearSummary object
  const yearSummary = useMemo(() => {
    return yearlySummaries.find(y => y.year === selectedYear) || null;
  }, [yearlySummaries, selectedYear]);

  // 5.8 totalProfit computed
  const totalProfit = useMemo(() => {
    if (yearSummary) {
      return yearSummary.totalProfit;
    }
    return monthlyData.reduce((s, m) => s + m.profit, 0);
  }, [yearSummary, monthlyData]);

  // 5.9 profitTrend
  const profitTrend = useMemo(() => {
    return monthlyData.length >= 2 ? monthlyData[11].profit - monthlyData[10].profit : 0;
  }, [monthlyData]);

  // 5.10 profitableMonths / lossMonths
  const { profitableMonths, lossMonths } = useMemo(() => {
    const pCount = monthlyData.filter(m => m.profit > 0).length;
    const lCount = monthlyData.filter(m => m.profit < 0).length;
    return { profitableMonths: pCount, lossMonths: lCount };
  }, [monthlyData]);

  // 5.11 Best Selling Products Calculation (including Images and Progress Bars based on Revenue relative to Max)
  const bestSellingProducts = useMemo(() => {
    const counts: Record<string, { id: string; name: string; qty: number; revenue: number; cost: number; profit: number }> = {};
    yearDelivered.forEach(o => {
      (o.items || []).forEach(it => {
        if (!it.productId) return;
        if (!counts[it.productId]) {
          counts[it.productId] = {
            id: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        const itemQty = it.quantity || 1;
        const itemRevenue = (it.sellingPrice || 0) * itemQty;
        const itemCost = (it.productCost || 0) * itemQty;
        counts[it.productId].qty += itemQty;
        counts[it.productId].revenue += itemRevenue;
        counts[it.productId].cost += itemCost;
        counts[it.productId].profit += (itemRevenue - itemCost);
      });
    });

    return Object.values(counts).sort((a, b) => {
      if (productSortBy === "revenue") return b.revenue - a.revenue;
      if (productSortBy === "profit") return b.profit - a.profit;
      return b.qty - a.qty;
    });
  }, [yearDelivered, productSortBy]);

  const maxProductRevenue = useMemo(() => {
    if (bestSellingProducts.length === 0) return 1;
    return Math.max(...bestSellingProducts.map(p => p.revenue), 1);
  }, [bestSellingProducts]);

  const algerianWilayaMapNodes = useMemo(() => [
    { name: "Alger", arName: "الجزائر العاصمة", x: 48, y: 15, code: "16" },
    { name: "Oran", arName: "وهران", x: 20, y: 24, code: "31" },
    { name: "Constantine", arName: "قسنطينة", x: 74, y: 19, code: "25" },
    { name: "Sétif", arName: "سطيف", x: 64, y: 21, code: "19" },
    { name: "Annaba", arName: "عنابة", x: 80, y: 12, code: "23" },
    { name: "Blida", arName: "البليدة", x: 44, y: 19, code: "09" },
    { name: "Tizi Ouzou", arName: "تيزي وزو", x: 53, y: 16, code: "15" },
    { name: "Béjaïa", arName: "بجاية", x: 60, y: 15, code: "06" },
    { name: "Chlef", arName: "الشلف", x: 33, y: 20, code: "02" },
    { name: "Djelfa", arName: "الجلفة", x: 45, y: 35, code: "17" },
    { name: "Biskra", arName: "بسكرة", x: 68, y: 31, code: "07" },
    { name: "Ghardaïa", arName: "غرداية", x: 47, y: 50, code: "47" },
    { name: "Ouargla", arName: "ورقلة", x: 62, y: 53, code: "30" },
    { name: "Adrar", arName: "أدرار", x: 25, y: 70, code: "01" },
    { name: "Tamanrasset", arName: "تمنراست", x: 55, y: 84, code: "11" },
  ], []);

  const getWilayaOrdersInfo = (wilayaNodeName: string) => {
    const matchingOrders = yearOrders.filter(o => 
      o.wilaya.toLowerCase().includes(wilayaNodeName.toLowerCase())
    );
    const delivered = matchingOrders.filter(o => o.status === "delivered");
    const returned = matchingOrders.filter(o => o.status === "returned");
    const totalOrdersCount = matchingOrders.length;
    const deliveredCount = delivered.length;
    const returnedCount = returned.length;
    
    const revenue = delivered.reduce((sum, o) => sum + getOrderTotal(o), 0);
    const unitsSold = delivered.reduce((sum, o) => 
      sum + (o.items || []).reduce((s, it) => s + (it.quantity || 1), 0)
    , 0);

    return {
      totalOrdersCount,
      deliveredCount,
      returnedCount,
      revenue,
      unitsSold
    };
  };

  const maxWilayaOrders = useMemo(() => {
    let max = 1;
    algerianWilayaMapNodes.forEach(node => {
      const stats = getWilayaOrdersInfo(node.name);
      if (stats.totalOrdersCount > max) max = stats.totalOrdersCount;
    });
    return max;
  }, [yearOrders, algerianWilayaMapNodes]);

  const currencyLabel = lang === "ar" ? "دج" : "DZD";

  // helper widget to render circular state (PieChart format)
  const renderCustomPie = (data: TopItem[], title: string, icon: string) => {
    const active = hoveredSlice[title];
    const safeSlug = title === "ولايات الاستلام" ? "wilaya" :
                     title === "الموديلات والمنتجات" ? "products" :
                     title === "الألوان الرئيسية" ? "colors" : "sizes";

    return (
      <div 
        className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 flex flex-col items-center justify-between text-center relative overflow-hidden transition-all duration-300 hover:border-zinc-800 shadow-xl group" 
        id={`pie_${safeSlug}`}
      >
        <div className="w-full flex justify-between items-center pb-2.5 border-b border-zinc-900/60 mb-2.5 transition-colors">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
            <span className="text-sm group-hover:scale-125 transition-transform duration-300">{icon}</span>
            <span className="text-zinc-300 group-hover:text-white transition-colors">{title}</span>
          </span>
          <span className="text-[9px] bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-400 font-black">أقوى 3</span>
        </div>

        {data.length > 0 ? (
          <div className="w-full h-44 flex items-center justify-center relative [perspective:1000px] select-none">
            
            {/* 3D Isometric Base Pedestal/Platter to give realistic depth */}
            <div 
              className="absolute w-[136px] h-[136px] rounded-full border-b-[8px] border-zinc-900 bg-[#060608]/95 shadow-[inset_0_4px_12px_rgba(255,255,255,0.03),0_12px_24px_rgba(0,0,0,0.85)] pointer-events-none transition-all duration-500 group-hover:border-zinc-800 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.95)]"
              style={{ 
                transform: "rotateX(62deg) rotateY(-4deg) translateZ(-14px) scale(0.96)",
                transformStyle: "preserve-3d"
              }} 
            />

            {/* Glowing neon ring indicating active state / interaction area */}
            <div 
              className={`absolute w-[130px] h-[130px] rounded-full border border-emerald-500/10 transition-all duration-500 pointer-events-none ${active ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
              style={{ 
                transform: "rotateX(62deg) rotateY(-4deg) translateZ(-6px)",
                transformStyle: "preserve-3d",
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.15)"
              }} 
            />

            {/* Recharts Pie Chart wrapping matching exact dimensions */}
            <div 
              className="w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-102"
              style={{
                transform: "rotateX(20deg) rotateY(-2deg)",
                transformStyle: "preserve-3d"
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id={`grad-blue-${safeSlug}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="60%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                    <linearGradient id={`grad-green-${safeSlug}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="60%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#064e3b" />
                    </linearGradient>
                    <linearGradient id={`grad-yellow-${safeSlug}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="60%" stopColor="#d97706" />
                      <stop offset="100%" stopColor="#78350f" />
                    </linearGradient>
                  </defs>
                  
                  <Pie
                    data={data}
                    dataKey="count"
                    outerRadius={65}
                    innerRadius={46}
                    paddingAngle={4}
                    stroke="#09090b"
                    strokeWidth={2}
                    label={false}
                    labelLine={false}
                  >
                    {data.map((item, i) => {
                      const gradIds = [
                        `url(#grad-blue-${safeSlug})`,
                        `url(#grad-green-${safeSlug})`,
                        `url(#grad-yellow-${safeSlug})`
                      ];
                      return (
                        <Cell 
                          key={`cell-${i}`} 
                          fill={gradIds[i % gradIds.length]} 
                          onMouseEnter={() => {
                            setHoveredSlice(prev => ({
                              ...prev,
                              [title]: {
                                name: item.name,
                                count: item.count,
                                percentage: item.percentage
                              }
                            }));
                          }}
                          onMouseLeave={() => {
                            setHoveredSlice(prev => ({
                              ...prev,
                              [title]: null
                            }));
                          }}
                          style={{
                            filter: "drop-shadow(0px 8px 10px rgba(0,0,0,0.8))",
                            cursor: "pointer",
                            transition: "all 0.3s ease"
                          }}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Absolute Centered details within the Donut cavity */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
              {active ? (
                <div className="text-center animate-fade-in p-1 max-w-[80px]">
                  <span className="text-[10px] text-zinc-400 font-extrabold block truncate leading-tight mb-0.5">
                    {active.name}
                  </span>
                  <span className="text-sm font-black text-emerald-400 block font-mono leading-none tracking-tight my-0.5">
                    {active.percentage}%
                  </span>
                  <span className="text-[8px] text-zinc-500 font-bold block">
                    {active.count} طرد
                  </span>
                </div>
              ) : (
                <div className="text-center text-zinc-650 transition-all duration-300 group-hover:text-zinc-500">
                  <span className="text-base block mb-0.5 transform group-hover:scale-110 transition-transform duration-300">{icon}</span>
                  <span className="text-[8.5px] font-extrabold block text-zinc-500 tracking-wider">
                    ضع المؤشر
                  </span>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="h-44 flex items-center justify-center text-xs text-zinc-500 font-bold">
            — لا توجد مبيعات موثقة —
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-16 md:pt-4 text-right overflow-x-hidden font-sans pb-10" dir="rtl" id="yearly_workspace_root">
      
      {/* 6.1 UPPER CONTROLS BAR (الشريط العلوي) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-505/10 rounded-xl border border-indigo-500/15">
            <BarChart3 className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>📊</span>
              <span>التحليلات المالية والتقارير السنوية</span>
            </h1>
            <p className="text-[10px] text-zinc-400 mt-0.5">دراسة سنوية مدمجة وهوامش الأداء الميداني، أفضل الولايات، الموديلات الأكثر بيعاً والألوان شهراً بشهر.</p>
          </div>
        </div>

        {/* State selectors dropdown (السنة) */}
        <div className="flex items-center gap-2.5 bg-[#040406] border border-zinc-900 rounded-lg px-3 py-1.5 self-stretch sm:self-auto justify-end">
          <span className="text-xs text-zinc-400 font-bold">تحليلات سنة المالية:</span>
          <div className="flex items-center gap-1 text-white text-xs font-black">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedYear}
              id="selectedYearSelector"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-black text-emerald-400 outline-none cursor-pointer pr-1"
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                <option key={y} value={y} className="bg-zinc-950 text-white">{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ==================== 6.2 HIGH-LEVEL EXECUTIVE HIGHLIGHTS CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="yearly_grand_metrics_blocks">
        
        {/* Total Year Profit Card */}
        <div className="bg-[#09090b] border-2 border-indigo-600/35 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg">
          <div className="absolute right-0 bottom-0 select-none translate-y-3 translate-x-3 pointer-events-none text-indigo-550/10 text-8xl font-black">
            <Award className="w-24 h-24" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold block">إجمالي الأرباح السنوية الصافية 🏆</span>
            <span className={`text-2xl font-black font-mono block mt-2 ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-455"}`}>
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-zinc-905 pt-2 text-[10px]">
            <span className="text-zinc-400">مقارنة بآخر فترة:</span>
            {profitTrend !== 0 ? (
              <span className={`font-black flex items-center gap-1 ${profitTrend > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {profitTrend > 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+{profitTrend.toLocaleString()} دج (ارتفاع)</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{profitTrend.toLocaleString()} دج (انخفاض)</span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-zinc-500">— استقرار الحسابات</span>
            )}
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-md">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold block">مجموع الطلبات التراكمية 🛍️</span>
            <span className="text-2xl font-black font-mono mt-2 block text-zinc-100">
              {yearOrders.length.toLocaleString()} <span className="text-xs font-normal text-zinc-400">طلب</span>
            </span>
          </div>

          <div className="mt-4 border-t border-zinc-900 pt-2 text-[9.5px] text-zinc-400 flex justify-between">
            <span>مسلمة: <strong className="font-mono text-emerald-400">{yearDelivered.length}</strong></span>
            <span>مرتجعة: <strong className="font-mono text-rose-400">{yearReturned.length}</strong></span>
            <span>قيد المعالجة: <strong className="font-mono text-amber-500">{yearOrders.length - yearDelivered.length - yearReturned.length}</strong></span>
          </div>
        </div>

        {/* Cumulative Annual Sales Value */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-md">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold block">القيمة الإجمالية للمبيعات المنجزة 💵</span>
            <span className="text-2xl font-black font-mono mt-2 block text-emerald-400">
              {yearTotalSales.toLocaleString()} <span className="text-xs font-normal">دج</span>
            </span>
          </div>

          <div className="mt-4 border-t border-zinc-900 pt-2 text-[9.5px] text-zinc-500">
            <span>حصيلة التدفق المالي الكلي الفعلي للولايات</span>
          </div>
        </div>

        {/* Calendar performance months metrics */}
        <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-md">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold block">ميزان الفترات والشهور 📦</span>
            <div className="flex gap-4 mt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-center flex-1">
                <span className="text-[9px] text-emerald-500 block">أشهر ناجحة</span>
                <span className="text-lg font-black font-mono text-emerald-400">✅ {profitableMonths}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl text-center flex-1">
                <span className="text-[9px] text-rose-400 block">أشهر خاسرة</span>
                <span className="text-lg font-black font-mono text-rose-455">❌ {lossMonths}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-900 pt-2 text-[9px] text-zinc-500">
            <span>الأشهر ذات الأرباح أو الخسائر المستهدفة</span>
          </div>
        </div>

      </div>

      {/* ==================== 6.3 MAIN MONTHLY PERFORMANCE AREA CHART ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-xl space-y-4" id="monthly_performance_area_chart_container">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Activity className="w-4 h-4 text-emerald-400" />
            </span>
            <div>
              <h2 className="text-xs font-black text-white">تحليل منحنى الإيرادات والمصاريف والأرباح الشهرية</h2>
              <p className="text-[9px] text-zinc-500">مراقبة الأداء البياني التراكمي ومقارنة نسبة الصافي بالأحمال التشغيلية العامة</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[9.5px] font-bold text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> إيراد المبيعات</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> تكلفة النشاط</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> أرباح الشهور</span>
          </div>
        </div>

        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a/25" vertical={false} />
              <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#09090b", borderColor: "#1f1f23", borderRadius: "12px", direction: "rtl", textAlign: "right", fontSize: "11px" }}
                itemStyle={{ color: "#d4d4d8" }}
              />
              <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.2} fillOpacity={1} fill="url(#salesGrad)" name="مبيعات مجمعة" />
              <Area type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#costGrad)" name="نفقات وتشغيل" />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="الأرباح الصافية" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==================== 6.4 MONTHLY NET PROFIT / LOSS BAR CHART ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-xl space-y-4" id="monthly_net_profit_barchart_container">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Landmark className="w-4 h-4 text-blue-400" />
            </span>
            <div>
              <h2 className="text-xs font-black text-white">مؤشر صافي التدفق المالي والربح شهريا</h2>
              <p className="text-[9px] text-zinc-500">مقارنة العجز والفوائض النقدية لتحديد فترات التوسع أو تذبذب الحسابات</p>
            </div>
          </div>
        </div>

        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a/20" vertical={false} />
              <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#09090b", borderColor: "#1f1f23", borderRadius: "12px", direction: "rtl", textAlign: "right", fontSize: "11px" }}
                cursor={{ fill: '#ffffff', opacity: 0.03 }}
              />
              <Bar 
                dataKey="profit" 
                name="صافي الربح" 
                radius={[4, 4, 0, 0]}
              >
                {monthlyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.profit >= 0 ? "#10b981" : "#ef4444"} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ==================== 6.4.5 GEOGRAPHICAL DENSITY MAP & BEST SELLING PRODUCTS GRID ==================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="algeria_map_best_sellers_grid">
        
        {/* Map column (5 columns space in xl) */}
        <div className="xl:col-span-5 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[500px]" id="yearly_algeria_map_panel">
          {/* Header */}
          <div className="pb-3 border-b border-zinc-900/60 flex justify-between items-center z-10 flex-row">
            <div>
              <h2 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>
                  {(() => {
                    try {
                      const stored = localStorage.getItem("corevia_profile_v1");
                      if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed?.country === "France") return "🇫🇷";
                        if (parsed?.country === "Morocco") return "🇲🇦";
                        if (parsed?.country === "Other") return "🌐";
                      }
                    } catch {}
                    return "🇩🇿";
                  })()}
                </span>
                <span>
                  {(() => {
                    try {
                      const stored = localStorage.getItem("corevia_profile_v1");
                      if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed?.country === "France") {
                          return lang === "ar" ? "خريطة فرنسا التفاعلية لكثافة المبيعات والأداء الجغرافي السنوي" : "Annual France Performance & Density Heatmap";
                        }
                        if (parsed?.country === "Morocco") {
                          return lang === "ar" ? "خريطة المغرب التفاعلية لكثافة المبيعات والأداء الجغرافي السنوي" : "Annual Morocco Performance & Density Heatmap";
                        }
                        if (parsed?.country === "Other") {
                          return lang === "ar" ? "خريطة توزع المنتجات الكونية لتفاصيل المبيعات" : "Annual Global Performance & Density Heatmap";
                        }
                      }
                    } catch {}
                    return lang === "ar" ? "خريطة الجزائر التفاعلية لكثافة الطلبيات والأداء الجغرافي السنوي" : "Annual Algeria Performance & Density Heatmap";
                  })()}
                </span>
              </h2>
              <p className="text-[9px] text-zinc-500 mt-0.5">
                {lang === "ar" ? "تحليل بؤر الكثافة الشرائية ومعدلات نجاح التوصيل مقابل المرتجعات" : "Annual geographical tracking of Delivered vs Returned ratio and revenues"}
              </p>
            </div>
            <span className="text-[9.5px] bg-indigo-500/10 border border-indigo-500/20 text-[#60a5fa] px-2.5 py-0.5 rounded font-black max-h-[22px] flex items-center">
              {lang === "ar" ? "نشط" : "Active"}
            </span>
          </div>

          {/* Map Core Visualization */}
          <div className="my-4 flex-1">
            <SmartCountryMap orders={yearOrders} lang={lang} />
          </div>
        </div>

        {/* Sortable Best Selling Products Column (7 columns space in xl) */}
        <div className="xl:col-span-7 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          
          {/* Header Controls */}
          <div className="pb-3 border-b border-zinc-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>🏆</span>
                <span>ترتيب السلع والموديلات الأكثر مبيعاً وأرباحاً</span>
              </h2>
              <p className="text-[9px] text-zinc-500 mt-0.5">جدول مفصل لتصنيف حركة المنتجات في السوق ونسبة الإرجاع</p>
            </div>

            {/* Sorters */}
            <div className="flex gap-1.5 bg-[#050507] border border-zinc-900 p-1 rounded-lg">
              <button
                onClick={() => setProductSortBy("qty")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${productSortBy === "qty" ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-350"}`}
              >
                الكميات المباعة
              </button>
              <button
                onClick={() => setProductSortBy("revenue")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${productSortBy === "revenue" ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-350"}`}
              >
                المداخيل المجمعة
              </button>
              <button
                onClick={() => setProductSortBy("profit")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${productSortBy === "profit" ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-350"}`}
              >
                الأرباح الصافية
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto my-4 max-h-[350px] overflow-y-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 uppercase font-black bg-[#050507]">
                  <th className="p-2.5">الرتبة</th>
                  <th className="p-2.5">الموديل والقطعة</th>
                  <th className="p-2.5">الوحدات الكلية</th>
                  <th className="p-2.5 font-mono text-left">عائد الإيرادات (DZD)</th>
                  <th className="p-2.5 text-center font-bold">أوزان الإيراد النسبي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950">
                {bestSellingProducts.map((p, idx) => {
                  const revenuePercentage = Math.round((p.revenue / maxProductRevenue) * 100);
                  
                  // Stylized product thumbnail with abstract glowing patterns
                  const colorIndex = idx % 5;
                  const colorsList = [
                    "from-blue-600 to-indigo-700",
                    "from-emerald-600 to-teal-700",
                    "from-amber-500 to-orange-600",
                    "from-purple-600 to-fuchsia-700",
                    "from-rose-600 to-pink-700"
                  ];

                  return (
                    <tr key={p.id} className="hover:bg-[#07070a]/50 transition-colors">
                      {/* Rank badge */}
                      <td className="p-3">
                        <span className="w-5 h-5 flex items-center justify-center rounded-lg font-mono text-[11px] font-black bg-zinc-900 text-zinc-200">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                        </span>
                      </td>

                      {/* Product details */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorsList[colorIndex]} p-0.5 flex items-center justify-center text-white text-[10px] font-black tracking-tight select-none`}>
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold block text-white text-xs">{p.name}</span>
                            <span className="text-[9px] text-zinc-650 font-mono">ID: {p.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Sold Qty */}
                      <td className="p-3">
                        <strong className="font-mono text-zinc-200 text-xs">{p.qty}</strong> <span className="text-[10px] text-zinc-500">وحدة</span>
                      </td>

                      {/* Revenue */}
                      <td className="p-3 font-mono text-left font-black text-xs text-emerald-400">
                        {p.revenue.toLocaleString()} دج
                      </td>

                      {/* Percentage relative progress block */}
                      <td className="p-3 max-w-[120px]">
                        <div className="space-y-1">
                          <span className="text-[9px] text-zinc-400 block text-center font-mono font-bold">
                            {revenuePercentage}% من السقف الأقصى
                          </span>
                          <div className="w-full bg-zinc-905 bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${colorsList[colorIndex]} rounded-full`}
                              style={{ width: `${revenuePercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {bestSellingProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-zinc-500 font-bold">
                      — لا توجد منتجات مسجلة في المبيعات المسلمة بعد لهذه السنة —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sourcing/Delivery insights */}
          <div className="bg-[#050507] rounded-xl border border-zinc-950 p-2.5 text-[9.5px] text-zinc-500 text-center">
            تُحتسب النسب بناءً على معايير الفواتير المُسلمة الموثقة في نظام المحاسبة الختامي.
          </div>
        </div>

      </div>

      {/* ==================== 6.5 TOP 10 RANKINGS HORIZONTAL BARCHARTS ==================== */}
      <div className="space-y-4" id="top_10_rankings_charts_wrapper">
        <h2 className="text-sm font-black text-white flex items-center gap-1 px-1">
          <span>🏆</span>
          <span>ترتيب الفئات والولايات الأكثر توزيهاً ومبيعاً (أفضل 10)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="top_10_grid">
          
          {/* Top 10 Wilayas */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-3 shadow-md">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 pb-2 border-b border-zinc-900">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>أفضل 10 ولايات مستلمة للطرود</span>
            </span>

            {topWilayas.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topWilayas} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" stroke="#71717a" fontSize={9} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={9} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }} />
                    <Bar dataKey="count" name="كمية الاستلام" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">لا توجد مبيعات ولايات متوفرة</div>
            )}
          </div>

          {/* Top 10 Models */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-3 shadow-md">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 pb-2 border-b border-zinc-900">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span>أفضل 10 موديلات طلبات مباعة</span>
            </span>

            {topModels.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topModels} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" stroke="#71717a" fontSize={9} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={9} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }} />
                    <Bar dataKey="count" name="كمية الوحدات" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">لا توجد موديلات مستخدمة</div>
            )}
          </div>

          {/* Top 10 Colors */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-3 shadow-md">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 pb-2 border-b border-zinc-900">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>أفضل 10 ألوان مطلوبة بالطلب</span>
            </span>

            {topColors.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topColors} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" stroke="#71717a" fontSize={9} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={9} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }} />
                    <Bar dataKey="count" name="الكميات المقتطعة" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">لا توجد مبيعات ألوان متوفرة</div>
            )}
          </div>

          {/* Top 10 Sizes */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-3 shadow-md">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 pb-2 border-b border-zinc-900">
              <Ruler className="w-4 h-4 text-purple-400" />
              <span>أفضل 10 مقاسات مختارة للزبائن</span>
            </span>

            {topSizes.length > 0 ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSizes} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                    <XAxis type="number" stroke="#71717a" fontSize={9} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={9} tickLine={false} width={75} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }} />
                    <Bar dataKey="count" name="مرات الطلب" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">لا توجد مقاسات مسجلة</div>
            )}
          </div>

        </div>
      </div>

      {/* ==================== 6.6 TOP 3 PIECHART CIRCULAR METRICS ==================== */}
      <div className="space-y-4" id="top_3_pie_sections">
        <h2 className="text-sm font-black text-white flex items-center gap-1 px-1">
          <span>🥇</span>
          <span>الحصص الدائرية والمؤشرات المئوية للتوريد والطلب (أفضل 3)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderCustomPie(topWilayas.slice(0, 3), "ولايات الاستلام", "🗺️")}
          {renderCustomPie(topModels.slice(0, 3), "الموديلات والمنتجات", "👕")}
          {renderCustomPie(topColors.slice(0, 3), "الألوان الرئيسية", "🎨")}
          {renderCustomPie(topSizes.slice(0, 3), "المقاسات الأكثر شحناً", "📏")}
        </div>
      </div>

      {/* ==================== 6.7 DETAILED RANKINGS SHEET WITH LINEAR PROGRESS BARS ==================== */}
      <div className="space-y-4" id="detailed_yearly_ranks_cards_block">
        <h2 className="text-sm font-black text-white flex items-center gap-1 px-1">
          <span>🏅</span>
          <span>منصة تحليل الكتل والأوزان النسبية للنشاط التجاري</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Wilayas Detailed ranks */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-4 shadow-md text-right">
            <span className="text-xs font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-1.5 flex-row">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>المدن والولايات الثلاثة الأقوى مبيعاً وتوصيلاً</span>
            </span>

            <div className="space-y-3.5">
              {topWilayas.slice(0, 3).map((w, i) => (
                <div key={w.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <span className="text-zinc-200">{w.name}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-400">
                      {w.count} قطعة <span className="text-zinc-500 font-normal">({w.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                      style={{ width: `${w.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {topWilayas.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">— لا توجد مبيعات ولايات —</p>}
            </div>
          </div>

          {/* Models Detailed ranks */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-4 shadow-md text-right">
            <span className="text-xs font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-1.5 flex-row">
              <Tag className="w-4 h-4 text-emerald-400" />
              <span>الموديلات والقطع الثلاثة الأقوى طلباً</span>
            </span>

            <div className="space-y-3.5">
              {topModels.slice(0, 3).map((w, i) => (
                <div key={w.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <span className="text-zinc-200">{w.name}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {w.count} قطعة <span className="text-zinc-500 font-normal">({w.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                      style={{ width: `${w.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {topModels.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">— لا توجد موديلات أو قطع —</p>}
            </div>
          </div>

          {/* Colors Detailed ranks */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-4 shadow-md text-right">
            <span className="text-xs font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-1.5 flex-row">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>الألوان والأنسجة الثلاثة الأقوى مبيعاً</span>
            </span>

            <div className="space-y-3.5">
              {topColors.slice(0, 3).map((w, i) => (
                <div key={w.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <span className="text-zinc-200">{w.name}</span>
                    </span>
                    <span className="font-mono font-bold text-amber-500">
                      {w.count} قطعة <span className="text-zinc-500 font-normal">({w.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-650 to-amber-400 rounded-full"
                      style={{ width: `${w.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {topColors.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">— لا توجد ألوان كتلية موثقة —</p>}
            </div>
          </div>

          {/* Sizes Detailed ranks */}
          <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-4 space-y-4 shadow-md text-right">
            <span className="text-xs font-black text-white border-b border-zinc-900 pb-2 flex items-center gap-1.5 flex-row">
              <Ruler className="w-4 h-4 text-purple-400" />
              <span>المقاسات الثلاثة الأكثر تحديداً للزبائن</span>
            </span>

            <div className="space-y-3.5">
              {topSizes.slice(0, 3).map((w, i) => (
                <div key={w.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <span className="text-zinc-200">{w.name}</span>
                    </span>
                    <span className="font-mono font-bold text-purple-400">
                      {w.count} قطعة <span className="text-zinc-500 font-normal">({w.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                      style={{ width: `${w.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {topSizes.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">— لا توجد مقاسات مسجلة —</p>}
            </div>
          </div>

        </div>
      </div>

      {/* ==================== 6.8 DETAILED CLASSIFIED YEAR REPORT TABLE (جدول السنة التفصيلي) ==================== */}
      <div className="bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-xl text-right space-y-4" id="detailed_yearly_report_table_block">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-900">
          <Layers className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-xs font-black text-white">التقرير المدمج والمثبت لسنة {selectedYear}</h2>
            <p className="text-[9px] text-zinc-500">مخرجات سنوية معممة لكافة الفئات الخمسة الأعلى توزيعاً</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs" id="yearly_detailed_table">
            <thead>
              <tr className="border-b border-zinc-850 text-zinc-400 text-[10px] uppercase font-bold bg-[#040406]">
                <th className="p-3"># الترتيب</th>
                <th className="p-3">اسم التصنيف والفئة المدمجة</th>
                <th className="p-3">العنصر المحدد</th>
                <th className="p-3">كمية الحركة بالقطع</th>
                <th className="p-3">الوزن المئوي العام</th>
              </tr>
            </thead>
            <tbody>
              
              {/* Category 1: Wilayas */}
              <Fragment>
                <tr className="bg-indigo-950/20 text-indigo-300 font-bold border-y border-zinc-900">
                  <td colSpan={5} className="p-2.5 text-[10px] tracking-wider">🗺️ ولايات التوصيل والتوريد (الأولى خمسة)</td>
                </tr>
                {topWilayas.slice(0, 5).map((it, idx) => (
                  <tr key={`w-${idx}`} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-zinc-400">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}</td>
                    <td className="p-3 text-zinc-400">ولاية مستلمة</td>
                    <td className="p-3 text-zinc-100 font-bold">{it.name}</td>
                    <td className="p-3 font-mono text-zinc-200">{it.count.toLocaleString()} قطعة</td>
                    <td className="p-3 font-mono text-indigo-400 font-bold">{it.percentage}%</td>
                  </tr>
                ))}
                {topWilayas.length === 0 && (
                  <tr className="border-b border-zinc-900/50"><td colSpan={5} className="p-4 text-center text-zinc-500">لا توجد مبيعات ولايات مسجلة سنة {selectedYear}</td></tr>
                )}
              </Fragment>

              {/* Category 2: Models */}
              <Fragment>
                <tr className="bg-emerald-950/20 text-emerald-300 font-bold border-y border-zinc-900">
                  <td colSpan={5} className="p-2.5 text-[10px] tracking-wider">👕 الموديلات والسلع المقتطعة (الأولى خمسة)</td>
                </tr>
                {topModels.slice(0, 5).map((it, idx) => (
                  <tr key={`m-${idx}`} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-zinc-400">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}</td>
                    <td className="p-3 text-zinc-400">موديل سلعة</td>
                    <td className="p-3 text-zinc-100 font-bold">{it.name}</td>
                    <td className="p-3 font-mono text-zinc-200">{it.count.toLocaleString()} قطعة</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{it.percentage}%</td>
                  </tr>
                ))}
                {topModels.length === 0 && (
                  <tr className="border-b border-zinc-900/50"><td colSpan={5} className="p-4 text-center text-zinc-500">لا توجد مبيعات موديلات مسجلة سنة {selectedYear}</td></tr>
                )}
              </Fragment>

              {/* Category 3: Colors */}
              <Fragment>
                <tr className="bg-amber-950/20 text-amber-300 font-bold border-y border-zinc-900">
                  <td colSpan={5} className="p-2.5 text-[10px] tracking-wider">🎨 الألوان والانسجة المطلوبة (الأولى خمسة)</td>
                </tr>
                {topColors.slice(0, 5).map((it, idx) => (
                  <tr key={`c-${idx}`} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-zinc-400">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}</td>
                    <td className="p-3 text-zinc-400">لون الموديل</td>
                    <td className="p-3 text-zinc-100 font-bold">{it.name}</td>
                    <td className="p-3 font-mono text-zinc-200">{it.count.toLocaleString()} قطعة</td>
                    <td className="p-3 font-mono text-amber-500 font-bold">{it.percentage}%</td>
                  </tr>
                ))}
                {topColors.length === 0 && (
                  <tr className="border-b border-zinc-900/50"><td colSpan={5} className="p-4 text-center text-zinc-500">لا توجد مبيعات ألوان مسجلة سنة {selectedYear}</td></tr>
                )}
              </Fragment>

              {/* Category 4: Sizes */}
              <Fragment>
                <tr className="bg-purple-950/20 text-purple-300 font-bold border-y border-zinc-900">
                  <td colSpan={5} className="p-2.5 text-[10px] tracking-wider">📏 المقاسات والنماذج الأكثر شحناً (الأولى خمسة)</td>
                </tr>
                {topSizes.slice(0, 5).map((it, idx) => (
                  <tr key={`s-${idx}`} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-zinc-400">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}</td>
                    <td className="p-3 text-zinc-400">مقاس قطعة</td>
                    <td className="p-3 text-[#f4f4f5] font-bold">{it.name}</td>
                    <td className="p-3 font-mono text-zinc-200">{it.count.toLocaleString()} قطعة</td>
                    <td className="p-3 font-mono text-purple-400 font-bold">{it.percentage}%</td>
                  </tr>
                ))}
                {topSizes.length === 0 && (
                  <tr className="border-b border-zinc-900/50"><td colSpan={5} className="p-4 text-center text-zinc-500">لا توجد مقاسات مسجلة سنة {selectedYear}</td></tr>
                )}
              </Fragment>

            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
