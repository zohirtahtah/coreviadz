/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { Order, Product, LanguageType } from "../types";
import { translations } from "../translations";
import { 
  TrendingUp, TrendingDown, Layers, ShoppingBag, 
  Package, CheckCircle2, History, AlertCircle,
  Palette, Ruler, MapPin, Award, Megaphone
} from "lucide-react";
import { SmartCountryMap } from "./SmartCountryMap";

interface DashboardViewProps {
  orders: Order[];
  products: Product[];
  lang: LanguageType;
  announcements?: any[];
}

export default function DashboardView({ orders, products, lang, announcements }: DashboardViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // Dynamic system notifications calculated live from localStorage
  const notificationsList = useMemo(() => {
    const list: string[] = [];
    try {
      const basic = JSON.parse(localStorage.getItem("corevia_basic_inventory_v1") || "[]");
      const sub = JSON.parse(localStorage.getItem("corevia_sub_inventory_v1") || "[]");
      
      basic.forEach((item: any) => {
        if (item.quantity < 5) {
          list.push(
            lang === "ar"
              ? `مخزون منخفض للموديل: متبقي ${item.quantity} قطع فقط من ${item.productName} (${item.color})`
              : lang === "fr"
              ? `Stock faible pour: seulement ${item.quantity} pcs de ${item.productName} (${item.color})`
              : `Low stock limit: only ${item.quantity} pcs remaining for ${item.productName} (${item.color})`
          );
        }
      });

      sub.forEach((item: any) => {
        if (item.quantity < 3) {
          list.push(
            lang === "ar"
              ? `مخزون فرعي حرج: متبقي ${item.quantity} قطع من ${item.productName} (مقاس ${item.size} / لون ${item.color})`
              : lang === "fr"
              ? `Stock secondaire critique: seulement ${item.quantity} pcs de ${item.productName} (Taille ${item.size} / ${item.color})`
              : `Sub stock critical: only ${item.quantity} pcs for ${item.productName} (Size ${item.size} / ${item.color})`
          );
        }
      });
    } catch (e) {
      console.error(e);
    }
    return list;
  }, [lang]);

  // 1. Calculate Core Financial Metrics from live Orders
  const metrics = useMemo(() => {
    // Only count active orders (exclude deleted or empty ones, status-based)
    // totalSales = Sum of order total prices for delivered orders
    // productCost = Sum of cost * quantity for delivered orders
    // pendingOrders = Count of pending orders
    let totalSales = 0;
    let totalCost = 0;
    let totalDeliveryPrice = 0;
    let totalReturnCost = 0;
    let pendingCount = 0;
    let deliveredCount = 0;
    let returnedCount = 0;

    orders.forEach(ord => {
      if (ord.status === "delivered") {
        totalSales += ord.totalPrice;
        totalDeliveryPrice += ord.deliveryPrice;
        deliveredCount++;
        ord.items.forEach(itm => {
          totalCost += (itm.productCost * itm.quantity);
        });
      } else if (ord.status === "returned") {
        totalReturnCost += (ord.returnCost || 0);
        returnedCount++;
      } else {
        pendingCount++;
      }
    });

    // Net Profit calculation matching specs:
    // صافي الربح = المبيعات - التكلفة - تكاليف التوصيل - تكاليف الإرجاع
    // Wait, the order total usually already has the discount factored in, or we subtract it.
    const netProfit = totalSales - totalCost - totalDeliveryPrice - totalReturnCost;

    return {
      sales: totalSales,
      cost: totalCost,
      profit: netProfit,
      pending: pendingCount,
      delivered: deliveredCount,
      returned: returnedCount,
      totalOrders: orders.length
    };
  }, [orders]);

  // 2. High Quality Analysis for Top 3 Entities (Models, Colors, Sizes, Wilayas)
  const statsRankings = useMemo(() => {
    const modelsMap: Record<string, number> = {};
    const colorsMap: Record<string, number> = {};
    const sizesMap: Record<string, number> = {};
    const wilayasMap: Record<string, number> = {};

    // Retrieve count only from Delivered orders to prioritize real sales performance!
    orders.forEach(ord => {
      if (ord.status === "delivered") {
        wilayasMap[ord.wilaya] = (wilayasMap[ord.wilaya] || 0) + 1;
        
        ord.items.forEach(itm => {
          modelsMap[itm.productName] = (modelsMap[itm.productName] || 0) + itm.quantity;
          colorsMap[itm.color] = (colorsMap[itm.color] || 0) + itm.quantity;
          if (itm.size) {
            sizesMap[itm.size] = (sizesMap[itm.size] || 0) + itm.quantity;
          }
        });
      }
    });

    const getTop3 = (map: Record<string, number>) => {
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    };

    return {
      topModels: getTop3(modelsMap),
      topColors: getTop3(colorsMap),
      topSizes: getTop3(sizesMap),
      topWilayas: getTop3(wilayasMap)
    };
  }, [orders]);

  // 3. Prepare monthly chart data from real orders (Grouped by month of the current year, e.g. 2026)
  const chartData = useMemo(() => {
    // We generate 5 active months up to now for representation
    const months = ["01", "02", "03", "04", "05", "06"];
    const monthLabelsMap: Record<string, string> = {
      "01": lang === "ar" ? "جانفي" : lang === "fr" ? "Janvier" : "January",
      "02": lang === "ar" ? "فيفري" : lang === "fr" ? "Février" : "February",
      "03": lang === "ar" ? "مارس" : lang === "fr" ? "Mars" : "March",
      "04": lang === "ar" ? "أفريل" : lang === "fr" ? "Avril" : "April",
      "05": lang === "ar" ? "ماي" : lang === "fr" ? "Mai" : "May",
      "06": lang === "ar" ? "جوان" : lang === "fr" ? "Juin" : "June"
    };

    return months.map(m => {
      let salesSum = 0;
      let costSum = 0;

      orders.forEach(ord => {
        if (ord.date.includes(`-${m}-`) && ord.status === "delivered") {
          salesSum += ord.totalPrice;
          ord.items.forEach(itm => {
            costSum += (itm.productCost * itm.quantity);
          });
        }
      });

      return {
        label: monthLabelsMap[m],
        sales: salesSum,
        cost: costSum
      };
    });
  }, [orders, lang]);

  // Custom SVG Bar Chart Drawing Metrics
  const chartSvg = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.cost, 10000)), 50000);
    const height = 180;
    const width = 500;
    const padding = 30;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;

    const points = chartData.map((d, index) => {
      const x = padding + (index * (graphWidth / chartData.length)) + (graphWidth / chartData.length / 4);
      const salesY = height - padding - (d.sales / maxVal) * graphHeight;
      const costY = height - padding - (d.cost / maxVal) * graphHeight;
      const colWidth = (graphWidth / chartData.length) / 3;

      return {
        label: d.label,
        sales: d.sales,
        cost: d.cost,
        sX: x,
        sY: salesY,
        sH: Math.max(2, (d.sales / maxVal) * graphHeight),
        cX: x + colWidth + 2,
        cY: costY,
        cH: Math.max(2, (d.cost / maxVal) * graphHeight),
        w: colWidth
      };
    });

    return { points, maxVal, height, width, padding };
  }, [chartData]);

  const currencyLabel = lang === "ar" ? "دج" : lang === "fr" ? "DA" : "DZD";

  return (
    <div className="space-y-6 pt-2" id="dashboard_view_panel">
      
      {/* Welcome Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#27272a] pb-4" id="dashboard_branding_strip">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            📊 {lang === "ar" ? "لوحة التحكم الذكية" : "Executive Control Center"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t.appSubtitle}</p>
        </div>
      </div>

      {/* Platform Announcements Ticker/Bulletin Board */}
      {announcements && announcements.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-4 md:p-5 relative overflow-hidden shadow-lg" id="dashboard_announcements_ticker">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className={`flex items-start gap-4 ${isRtl ? "text-right flex-row" : "text-left flex-row-reverse"}`}>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
              <Megaphone className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 space-y-2">
              <div className={`flex justify-between items-center ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                <h2 className="text-sm font-black text-white tracking-wide">
                  {lang === "ar" ? "📢 إعلانات وتحديثات المنصة الهامة" : "📢 Important Platform Announcements"}
                </h2>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-full font-bold">
                  {announcements.length} {lang === "ar" ? "نشط" : "Active"}
                </span>
              </div>
              <div className="space-y-3 mt-2">
                {announcements.slice(0, 2).map((ann, idx) => (
                  <div key={ann.id || idx} className="p-3 bg-black/35 border border-zinc-800/60 rounded-xl hover:border-zinc-700/60 transition-colors">
                    <div className={`flex justify-between items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"} mb-1`}>
                      <h3 className={`text-xs font-bold text-white flex items-center gap-1.5 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                        {ann.type === "Warning" && "⚠️"}
                        {ann.type === "Critical" && "🚨"}
                        {ann.type === "Maintenance" && "🔧"}
                        {ann.type === "New Feature" && "🚀"}
                        <span>{ann.title}</span>
                      </h3>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {ann.created_at ? ann.created_at.split("T")[0] : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-sans mt-1 whitespace-pre-line">
                      {ann.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STATS CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard_state_badges">
        
        {/* TOTAL ORDERS CARD */}
        <div className="p-4 sm:p-5 bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden group transform hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300" id="dash_card_orders">
          {/* Top light reflection border */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:via-white/40 transition-all duration-300 pointer-events-none" />
          {/* Top-left soft ambient reflection */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-lg pointer-events-none" />
          {/* Accent glow on top-right */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/20 to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-indigo-500/30 transition-all duration-300" />
          
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {lang === "ar" ? "مجموع الطلبات" : lang === "fr" ? "Total Commandes" : "Total Orders"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all duration-300">
              <ShoppingBag className="w-4 h-4 transform group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h2 className="text-xl md:text-2xl font-black text-white font-mono tracking-tight drop-shadow-md">
              {metrics.totalOrders}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] text-zinc-400 font-mono font-medium">
                {lang === "ar" ? "الطلبات المسجلة" : "Registered Orders"}
              </span>
            </div>
          </div>
        </div>

        {/* DELIVERED/RECEIVED CARD */}
        <div className="p-4 sm:p-5 bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden group transform hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300" id="dash_card_sales">
          {/* Top light reflection border */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:via-white/40 transition-all duration-300 pointer-events-none" />
          {/* Top-left soft ambient reflection */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-lg pointer-events-none" />
          {/* Accent glow on top-right */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-emerald-500/30 transition-all duration-300" />
          
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {lang === "ar" ? "الطلبات المستلمة" : lang === "fr" ? "Commandes Récupérées" : "Received Orders"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300">
              <CheckCircle2 className="w-4 h-4 transform group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h2 className="text-xl md:text-2xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-md">
              {metrics.delivered}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-300 font-mono font-bold tracking-wide">
                {lang === "ar" ? "سُلمت بنجاح" : "Delivered successfully"} ({((metrics.delivered / (metrics.totalOrders || 1)) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* PENDING CARD */}
        <div className="p-4 sm:p-5 bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden group transform hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300" id="dash_card_pending">
          {/* Top light reflection border */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:via-white/40 transition-all duration-300 pointer-events-none" />
          {/* Top-left soft ambient reflection */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-lg pointer-events-none" />
          {/* Accent glow on top-right */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-amber-500/20 to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-amber-500/30 transition-all duration-300" />
          
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {lang === "ar" ? "الطلبات قيد الإنتظار" : lang === "fr" ? "Commandes en Attente" : "Pending Orders"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 group-hover:border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all duration-300">
              <AlertCircle className="w-4 h-4 transform group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h2 className="text-xl md:text-2xl font-black text-amber-500 font-mono tracking-tight drop-shadow-md">
              {metrics.pending}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] text-amber-300 font-mono font-bold tracking-wide">
                {lang === "ar" ? "في انتظار التوصيل" : "Awaiting Delivery"} ({((metrics.pending / (metrics.totalOrders || 1)) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* RETURNED CARD */}
        <div className="p-4 sm:p-5 bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden group transform hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300" id="dash_card_profit">
          {/* Top light reflection border */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:via-white/40 transition-all duration-300 pointer-events-none" />
          {/* Top-left soft ambient reflection */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-lg pointer-events-none" />
          {/* Accent glow on top-right */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-rose-500/20 to-transparent rounded-full blur-2xl pointer-events-none group-hover:from-rose-500/30 transition-all duration-300" />
          
          <div className="flex justify-between items-start relative z-10">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {lang === "ar" ? "الطلبات غير المستلمة (المرجعة)" : lang === "fr" ? "Commandes Non-reçues" : "Returned Orders"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 group-hover:bg-rose-500/20 group-hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.2)] transition-all duration-300">
              <History className="w-4 h-4 transform group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h2 className="text-xl md:text-2xl font-black text-rose-400 font-mono tracking-tight drop-shadow-md">
              {metrics.returned}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] text-rose-300 font-mono font-bold tracking-wide">
                {lang === "ar" ? "المرتجع الكلي" : "Returned/Not received"} ({((metrics.returned / (metrics.totalOrders || 1)) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* LOCAL NOTIFICATIONS CENTER SYSTEM */}
      <div className="p-4 bg-indigo-500/5 dark:bg-[#121214]/40 rounded-2xl border border-indigo-500/15 dark:border-[#27272a] space-y-3 animate-fade-in animate-duration-300" id="live_notifications_center_shelf">
        <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10 dark:border-[#27272a]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <h2 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              🔔 {lang === "ar" ? "مركز الإشعارات والتنبيهات المباشر" : lang === "fr" ? "Centre d'alertes & notifications" : "Live Alert & Notifications Desk"}
            </h2>
          </div>
          <span className="text-[9px] font-mono text-indigo-650 dark:text-indigo-400 px-2.5 py-0.5 bg-indigo-500/10 dark:bg-[#18181b] border border-indigo-500/20 dark:border-[#27272a] rounded font-bold">
            {notificationsList.length} {lang === "ar" ? "تنبيه" : "alerts"}
          </span>
        </div>

        {notificationsList.length === 0 ? (
          <div className="flex items-center gap-2 p-2 justify-center text-xs text-indigo-650 dark:text-indigo-400 font-bold bg-indigo-500/5 rounded-xl">
            <span>✓</span>
            <span>{lang === "ar" ? "جميع أقسام ومستويات المخزون والصرف آمنة وممتازة اليوم!" : lang === "fr" ? "Tous les niveaux de stock et de trésorerie sont parfaits aujourd'hui!" : "All inventory levels and cash balances are in perfect standing today!"}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2" id="dashboard_alerts_grid">
            {notificationsList.map((notif, index) => (
              <div key={index} className="flex gap-2.5 items-start p-2.5 bg-white/40 dark:bg-[#09090b]/40 rounded-xl border border-slate-205 dark:border-[#27272a]">
                <div className="w-5 h-5 rounded bg-rose-505/10 bg-opacity-10 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  {notif}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GEOGRAPHIC HEATMAP WIDGET */}
      <div className="p-6 bg-[#09090b] rounded-2xl border border-[#27272a] space-y-4" id="dashboard_algeria_map_panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#27272a]/40 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
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
                        return lang === "ar" ? "خريطة فرنسا التفاعلية لكثافة المبيعات والأداء" : "France Performance & Density Heatmap";
                      }
                      if (parsed?.country === "Morocco") {
                        return lang === "ar" ? "خريطة المغرب التفاعلية لكثافة المبيعات والأداء" : "Morocco Performance & Density Heatmap";
                      }
                      if (parsed?.country === "Other") {
                        return lang === "ar" ? "الخريطة الجغرافية العالمية لتوزع المبيعات" : "Global Performance & Density Heatmap";
                      }
                    }
                  } catch {}
                  return lang === "ar" ? "خريطة الجزائر التفاعلية لكثافة المبيعات والأداء" : "Algeria Performance & Density Heatmap";
                })()}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === "ar" 
                ? "توزيع الطلبيات، نسب التوصيل والمرتجعات، والتدفقات المالية جغرافيًا بدقة متناهية" 
                : "Real-time geographical tracking of delivered/returned orders and revenue flow across regions"}
            </p>
          </div>
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-[#60a5fa] px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
            {lang === "ar" ? "قمر محلي نشط" : "GIS Engine Active"}
          </span>
        </div>
        
        <SmartCountryMap orders={orders} lang={lang} />
      </div>

      {/* GRAPH CHART SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard_analytics_grid">
        
        {/* CHART MODULE */}
        <div className="lg:col-span-2 p-6 bg-[#09090b] rounded-2xl border border-[#27272a] flex flex-col justify-between" id="dash_monthly_chart_card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-white">{t.dashSalesCostChart}</h2>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 block" />
                <span className="text-slate-300">{lang === "ar" ? "المبيعات" : "Revenues"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#27272a] block" />
                <span className="text-slate-300">{lang === "ar" ? "التكاليف" : "Costs"}</span>
              </div>
            </div>
          </div>

          {/* SVG CUSTOM RENDERED RESPONSIVE GRAPH */}
          <div className="relative w-full overflow-x-auto pt-2" id="canvas_chart_wrapper">
            <svg 
              viewBox={`0 0 ${chartSvg.width} ${chartSvg.height}`} 
              className="w-full h-auto min-w-[420px]"
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = chartSvg.padding + ratio * (chartSvg.height - chartSvg.padding * 2);
                const valueLabel = Math.round(chartSvg.maxVal * (1 - ratio));
                return (
                  <g key={i}>
                    <line 
                      x1={chartSvg.padding} 
                      y1={y} 
                      x2={chartSvg.width - chartSvg.padding} 
                      y2={y} 
                      stroke="#27272a" 
                      strokeWidth="0.5" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={chartSvg.width - chartSvg.padding + 5} 
                      y={y + 3} 
                      fill="#64748b" 
                      fontSize="7" 
                      fontFamily="monospace"
                      textAnchor="start"
                    >
                      {valueLabel >= 1000 ? `${(valueLabel/1000).toFixed(0)}k` : valueLabel}
                    </text>
                  </g>
                );
              })}

              {/* Draw Dual Bars */}
              {chartSvg.points.map((p, i) => (
                <g key={i} className="group/bar">
                  {/* Sales bar (Indigo) */}
                  <rect 
                    x={p.sX}
                    y={p.sY}
                    width={p.w}
                    height={p.sH}
                    fill="#6366f1"
                    rx="2"
                    className="transition-all hover:fill-indigo-400"
                  />
                  {/* Cost bar (Slate grey matching theme) */}
                  <rect 
                    x={p.cX}
                    y={p.cY}
                    width={p.w}
                    height={p.cH}
                    fill="#27272a"
                    rx="2"
                    className="transition-all hover:fill-[#3f3f46]"
                  />
                  {/* Monthly bottom Label */}
                  <text 
                    x={p.sX + p.w}
                    y={chartSvg.height - chartSvg.padding / 2}
                    fill="#94a3b8"
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>

                  {/* Quick reactive hover tooltip values inside SVG */}
                  <title>
                    {p.label}: Sales: {p.sales} {currencyLabel} | Cost: {p.cost} {currencyLabel}
                  </title>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* RATINGS & BENTO OF PRODUCTS */}
        <div className="p-6 bg-[#18181b]/55 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-6 relative overflow-hidden group transform hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300" id="dash_top_rankings_card">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 relative z-10">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-black text-white tracking-wider">
              {lang === "ar" ? "أفضل العناصر أداء" : "Demand Analytics"}
            </h2>
          </div>
          
          {orders.length === 0 ? (
            <div className="text-center py-6 relative z-10">
              <p className="text-slate-400 text-xs">{t.dashEmptyData}</p>
            </div>
          ) : (
            <div className="space-y-6 text-xs font-sans relative z-10" id="rankings_subcategories_list">
              
              {/* Product Modeles Top 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-zinc-300 font-extrabold tracking-wider uppercase">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span>{lang === "ar" ? "أفضل المنتجات مبيعا" : t.dashTop3Models}</span>
                </div>
                {statsRankings.topModels.length === 0 ? (
                  <span className="text-[10px] text-slate-500 block px-3">-</span>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const maxVal = Math.max(...statsRankings.topModels.map(i => i.count), 1);
                      return statsRankings.topModels.map((item, idx) => {
                        const percent = (item.count / maxVal) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="bg-gradient-to-r from-white/10 to-white/[0.02] backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.45),_inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.7),_inset_0_1px_2px_rgba(255,255,255,0.25)] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 space-y-2.5 group"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.25)] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-zinc-200 font-bold font-sans text-xs truncate">{item.name}</span>
                              </div>
                              <span className="font-extrabold text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all shrink-0">
                                {item.count} {lang === "ar" ? "قطعة" : "pcs"}
                              </span>
                            </div>
                            
                            {/* Horizontal Bar */}
                            <div className="h-2.5 w-full bg-black/45 rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                style={{ width: `${percent}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-full" />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Color Tends Top 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-zinc-300 font-extrabold tracking-wider uppercase">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <span>{lang === "ar" ? "أفضل الألوان مبيعا" : t.dashTop3Colors}</span>
                </div>
                {statsRankings.topColors.length === 0 ? (
                  <span className="text-[10px] text-slate-500 block px-3">-</span>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const maxVal = Math.max(...statsRankings.topColors.map(i => i.count), 1);
                      return statsRankings.topColors.map((item, idx) => {
                        const percent = (item.count / maxVal) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="bg-gradient-to-r from-white/10 to-white/[0.02] backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.45),_inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.7),_inset_0_1px_2px_rgba(255,255,255,0.25)] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 space-y-2.5 group"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.25)] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-zinc-200 font-bold font-sans text-xs truncate">{item.name}</span>
                              </div>
                              <span className="font-extrabold text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all shrink-0">
                                {item.count} {lang === "ar" ? "طلب" : "orders"}
                              </span>
                            </div>
                            
                            {/* Horizontal Bar */}
                            <div className="h-2.5 w-full bg-black/45 rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 relative transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                                style={{ width: `${percent}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-full" />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Size Trends Top 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-zinc-300 font-extrabold tracking-wider uppercase">
                  <Ruler className="w-4 h-4 text-indigo-400" />
                  <span>{lang === "ar" ? "أفضل المقاسات طلباً" : "Popular Sizes"}</span>
                </div>
                {statsRankings.topSizes.length === 0 ? (
                  <span className="text-[10px] text-slate-500 block px-3">-</span>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const maxVal = Math.max(...statsRankings.topSizes.map(i => i.count), 1);
                      return statsRankings.topSizes.map((item, idx) => {
                        const percent = (item.count / maxVal) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="bg-gradient-to-r from-white/10 to-white/[0.02] backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.45),_inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.7),_inset_0_1px_2px_rgba(255,255,255,0.25)] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 space-y-2.5 group"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.25)] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-zinc-200 font-bold font-sans text-xs truncate">
                                  {lang === "ar" ? `مقاس ${item.name}` : `Size ${item.name}`}
                                </span>
                              </div>
                              <span className="font-extrabold text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all shrink-0">
                                {item.count} {lang === "ar" ? "طلب" : "orders"}
                              </span>
                            </div>
                            
                            {/* Horizontal Bar */}
                            <div className="h-2.5 w-full bg-black/45 rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 relative transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                                style={{ width: `${percent}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-full" />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Wilaya Activity Level Top 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-zinc-300 font-extrabold tracking-wider uppercase">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span>{lang === "ar" ? "الولايات الأكثر نشاطاً" : t.dashTop3Wilayas}</span>
                </div>
                {statsRankings.topWilayas.length === 0 ? (
                  <span className="text-[10px] text-slate-500 block px-3">-</span>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const maxVal = Math.max(...statsRankings.topWilayas.map(i => i.count), 1);
                      return statsRankings.topWilayas.map((item, idx) => {
                        const percent = (item.count / maxVal) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="bg-gradient-to-r from-white/10 to-white/[0.02] backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.45),_inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.7),_inset_0_1px_2px_rgba(255,255,255,0.25)] hover:border-white/20 hover:-translate-y-1 transition-all duration-300 space-y-2.5 group"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.25)] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-zinc-200 font-bold font-sans text-xs truncate">{item.name}</span>
                              </div>
                              <span className="font-extrabold text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all shrink-0">
                                {item.count} {lang === "ar" ? "حالة" : "shp"}
                              </span>
                            </div>
                            
                            {/* Horizontal Bar */}
                            <div className="h-2.5 w-full bg-black/45 rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 relative transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(56,189,248,0.5)]" 
                                style={{ width: `${percent}%` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-full" />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
