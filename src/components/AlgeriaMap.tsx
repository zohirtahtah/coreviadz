/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { algeriaWilayasPaths, WilayaPathData } from "./AlgeriaWilayasPaths";
import { Order } from "../types";
import { ZoomIn, ZoomOut, RotateCcw, Map, Eye, Info, CheckCircle, AlertTriangle, TrendingUp, ShoppingBag } from "lucide-react";

interface AlgeriaMapProps {
  orders: Order[];
  lang: "ar" | "fr" | "en";
  className?: string;
}

export const AlgeriaMap: React.FC<AlgeriaMapProps> = ({ orders, lang, className = "" }) => {
  const isRtl = lang === "ar";
  
  // State for panning and zooming the map
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Active region filter to guide visualization
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Hovered state for tooltip rendering
  const [hoveredWilaya, setHoveredWilaya] = useState<WilayaPathData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Helper to resolve localized strings
  const getLabel = (ar: string, fr: string, en: string) => {
    if (lang === "ar") return ar;
    if (lang === "fr") return fr;
    return en;
  };

  // Safe order total calculator matching the main engine
  const getOrderTotal = (order: Order) => {
    const itemsTotal = (order.items || []).reduce((sum, item) => {
      const price = item.sellingPrice || 0;
      const qty = item.quantity || 1;
      return sum + (price * qty);
    }, 0);
    return itemsTotal - (order.discount || 0) + (order.deliveryPrice || 0);
  };

  // Normalize and match order wilaya matching all formats
  const matchWilaya = (orderWilaya: string, pathCode: string, pathName: string, pathNameAr: string) => {
    if (!orderWilaya) return false;
    const normalizedOrder = orderWilaya.toLowerCase().trim();
    const normalizedCode = pathCode.toLowerCase().trim();
    const normalizedName = pathName.toLowerCase().trim();
    const normalizedNameAr = pathNameAr.toLowerCase().trim();
    
    return (
      normalizedOrder === normalizedCode ||
      normalizedOrder.includes(normalizedCode) ||
      normalizedOrder === normalizedName ||
      normalizedOrder.includes(normalizedName) ||
      normalizedOrder === normalizedNameAr ||
      normalizedOrder.includes(normalizedNameAr) ||
      normalizedOrder.startsWith(normalizedCode) ||
      normalizedOrder.endsWith(normalizedName)
    );
  };

  // Compile full metrics statistics per Wilaya path
  const wilayasStats = useMemo(() => {
    return algeriaWilayasPaths.map(w => {
      const matchingOrders = orders.filter(o => matchWilaya(o.wilaya, w.code, w.name, w.nameAr));
      const total = matchingOrders.length;
      const delivered = matchingOrders.filter(o => o.status === "delivered").length;
      const returned = matchingOrders.filter(o => o.status === "returned").length;
      const pending = matchingOrders.filter(o => o.status === "pending" || !o.status).length;
      
      const successRate = total > 0 ? (delivered / total) * 100 : 0;
      const returnRate = total > 0 ? (returned / total) * 100 : 0;
      
      const revenue = matchingOrders
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + getOrderTotal(o), 0);

      const itemsCount = matchingOrders
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + (o.items || []).reduce((s, item) => s + (item.quantity || 1), 0), 0);

      return {
        wilaya: w,
        total,
        delivered,
        returned,
        pending,
        successRate,
        returnRate,
        revenue,
        itemsCount
      };
    });
  }, [orders]);

  // Find the maximum orders count in a single Wilaya to normalize colors
  const maxOrdersCount = useMemo(() => {
    const counts = wilayasStats.map(s => s.total);
    return counts.length > 0 ? Math.max(...counts, 1) : 1;
  }, [wilayasStats]);

  // Zoom control mechanics
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 8));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.8));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedRegion(null);
  };

  // Drag and pan mechanics
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltipPos({ x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom logic
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.max(0.8, Math.min(prev * zoomFactor, 8)));
  };

  // Dynamic dual-gradient choropleth coloring generator
  const getWilayaColor = (stats: typeof wilayasStats[0], isHighlighted: boolean) => {
    if (stats.total === 0) {
      return "fill-zinc-900/60 stroke-zinc-800/40 hover:fill-zinc-850";
    }

    const { successRate, returnRate } = stats;

    // Check if highly filtered out by active regional filters
    if (selectedRegion && stats.wilaya.region !== selectedRegion) {
      return "fill-zinc-950/40 stroke-zinc-900/30 opacity-25";
    }

    // High Delivery performance (Green gradient logic)
    if (successRate >= 60) {
      const intensity = Math.min((successRate - 60) / 40, 1); // 0 to 1 scaling
      // Gradient from beautiful emerald to deep forest green
      if (intensity > 0.7) return "fill-[#064e3b] stroke-[#34d399]/40 hover:fill-[#047857]";
      if (intensity > 0.4) return "fill-[#0f766e] stroke-[#2dd4bf]/40 hover:fill-[#0d9488]";
      return "fill-[#115e59] stroke-[#14b8a6]/40 hover:fill-[#134e4a]";
    }

    // High Returns issues (Red gradient logic)
    if (returnRate >= 30) {
      const intensity = Math.min((returnRate - 30) / 40, 1); // 0 to 1 scaling
      // Gradient from soft brick red to deepest warning crimson
      if (intensity > 0.7) return "fill-[#7f1d1d] stroke-[#f87171]/40 hover:fill-[#991b1b]";
      if (intensity > 0.4) return "fill-[#991b1b] stroke-[#f87171]/30 hover:fill-[#b91c1c]";
      return "fill-[#881337] stroke-[#fda4af]/30 hover:fill-[#9f1239]";
    }

    // General default balanced region active volume coloring (Blue/Slate dynamic gradient)
    const ratio = stats.total / maxOrdersCount;
    if (ratio > 0.7) return "fill-[#1e3a8a] stroke-[#60a5fa]/40 hover:fill-[#2563eb]";
    if (ratio > 0.3) return "fill-[#1e40af] stroke-[#3b82f6]/40 hover:fill-[#1d4ed8]";
    return "fill-[#312e81] stroke-[#6366f1]/30 hover:fill-[#3730a3]";
  };

  const activeStats = hoveredWilaya 
    ? wilayasStats.find(s => s.wilaya.code === hoveredWilaya.code)
    : null;

  return (
    <div className="flex flex-col h-full select-none" id="algeria-interactive-heatmap">
      {/* 1. Regional Filtering Bar Option */}
      <div className="flex flex-wrap gap-1.5 mb-3.5" id="map-region-filter">
        <button
          onClick={() => setSelectedRegion(null)}
          className={`px-3 py-1 text-[10.5px] font-bold rounded-lg border transition-all ${
            !selectedRegion
              ? "bg-zinc-100 text-zinc-950 border-zinc-200"
              : "bg-[#09090b] text-zinc-400 border-zinc-900 hover:text-white"
          }`}
        >
          {getLabel("الكل (الجمهورية)", "Tout (République)", "All (Republic)")}
        </button>
        {[
          { key: "north_west", ar: "الشمال الغربي", fr: "Nord-Ouest", en: "North West" },
          { key: "north_center", ar: "الشمال الأوسط", fr: "Nord-Centre", en: "North Center" },
          { key: "north_east", ar: "الشمال الشرقي", fr: "Nord-Est", en: "North East" },
          { key: "high_plains_west", ar: "الهضاب العليا (غرب)", fr: "Hautes Plaines (O)", en: "High Plains (W)" },
          { key: "high_plains_east", ar: "الهضاب العليا (شرق)", fr: "Hautes Plaines (E)", en: "High Plains (E)" },
          { key: "sahara_north", ar: "شمال الصحراء", fr: "Bas-Sahara Nord", en: "North Sahara" },
          { key: "sahara_south", ar: "الصحراء الكبرى", fr: "Grand Sud", en: "Deep Sahara" },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setSelectedRegion(item.key)}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
              selectedRegion === item.key
                ? "bg-amber-500 text-zinc-950 border-amber-400 font-extrabold"
                : "bg-[#09090b]/80 text-zinc-400 border-zinc-900 hover:text-white hover:bg-zinc-900"
            }`}
          >
            {getLabel(item.ar, item.fr, item.en)}
          </button>
        ))}
      </div>

      {/* 2. Map Render Core Viewport */}
      <div
        ref={mapContainerRef}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[360px] rounded-2xl border border-zinc-900/80 bg-[#050507] overflow-hidden ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${className}`}
      >
        {/* Dynamic decorative radar backdrop */}
        <div className="absolute inset-0 select-none bg-[radial-gradient(#ffffff02_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

        {/* Floating Controller panel */}
        <div className="absolute bottom-4 right-4 flex gap-1.5 z-20" dir="ltr">
          <button
            onClick={handleZoomIn}
            title={getLabel("تكبير", "Zoom +", "Zoom In")}
            className="w-8 h-8 rounded-lg bg-zinc-950/80 border border-zinc-900 hover:text-white text-zinc-400 transition-colors flex items-center justify-center cursor-pointer hover:bg-zinc-900"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            title={getLabel("تصغير", "Zoom -", "Zoom Out")}
            className="w-8 h-8 rounded-lg bg-zinc-950/80 border border-zinc-900 hover:text-white text-zinc-400 transition-colors flex items-center justify-center cursor-pointer hover:bg-zinc-900"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            title={getLabel("إعادة تعيين", "Réinitialiser", "Reset View")}
            className="w-8 h-8 rounded-lg bg-zinc-950/80 border border-zinc-900 hover:text-white text-zinc-400 transition-colors flex items-center justify-center cursor-pointer hover:bg-zinc-900"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Core Layer */}
        <svg
          viewBox="0 0 600 550"
          className="w-full h-full transition-shadow duration-300 pointer-events-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out"
          }}
        >
          {/* Main Map Group */}
          <g>
            {wilayasStats.map(stats => {
              const isHovered = hoveredWilaya?.code === stats.wilaya.code;
              const isSelectedZone = !selectedRegion || stats.wilaya.region === selectedRegion;
              const colorClass = getWilayaColor(stats, isHovered);

              return (
                <g key={stats.wilaya.code} className="transition-all duration-300">
                  <polygon
                    points={stats.wilaya.points}
                    className={`${colorClass} transition-all duration-150 stroke-[0.45] hover:stroke-white hover:stroke-[1.2] cursor-pointer`}
                    onMouseEnter={() => setHoveredWilaya(stats.wilaya)}
                    onMouseLeave={() => setHoveredWilaya(null)}
                  />

                  {/* Tiny text label matching translation */}
                  {isSelectedZone && stats.total > 0 && zoom >= 1.5 && (
                    <text
                      x={stats.wilaya.center.x}
                      y={stats.wilaya.center.y}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="text-[4px] fill-zinc-200/90 font-extrabold stroke-black/80 stroke-[0.2] pointer-events-none"
                    >
                      {stats.wilaya.code}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Glassmorphism Tooltip Container */}
        {hoveredWilaya && activeStats && (
          <div
            className="absolute z-50 p-4 min-w-[240px] max-w-[280px] bg-zinc-950/95 border border-zinc-900 backdrop-blur-md rounded-xl shadow-2xl transition-all duration-100 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y + 15}px`,
              transform: tooltipPos.x > 320 ? "translateX(-100%)" : "none"
            }}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900/80 mb-2.5">
              <div>
                <h4 className="text-[12.5px] font-black text-white">
                  {isRtl ? hoveredWilaya.nameAr : hoveredWilaya.name}
                </h4>
                <span className="text-[9px] text-zinc-500 font-bold tracking-wide uppercase">
                  {getLabel(
                    `ولاية رَقْم ${hoveredWilaya.code}`,
                    `Wilaya N° ${hoveredWilaya.code}`,
                    `Province No. ${hoveredWilaya.code}`
                  )}
                </span>
              </div>
              <span className="px-2 py-0.5 text-[9.5px] rounded bg-zinc-900 text-zinc-400 font-bold uppercase tracking-wider">
                {hoveredWilaya.region.replace("_", " ")}
              </span>
            </div>

            {/* Quick Summary Numbers */}
            <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
              <div className="bg-zinc-900/40 border border-zinc-900 p-2 rounded-lg text-start flex flex-col">
                <span className="text-zinc-500 text-[9px] flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3 text-indigo-400" />
                  {getLabel("إجمالي الطلبيات", "Total Commandes", "Total Orders")}
                </span>
                <strong className="font-mono text-white text-xs mt-0.5 mt-auto">
                  {activeStats.total} {getLabel("طرد", "Colis", "Units")}
                </strong>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-900 p-2 rounded-lg text-start flex flex-col">
                <span className="text-zinc-500 text-[9px] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  {getLabel("صافي الأرباح", "Revenue Net", "Net Revenue")}
                </span>
                <strong className="font-mono text-emerald-400 text-xs mt-0.5 mt-auto">
                  {new Intl.NumberFormat().format(activeStats.revenue)} {isRtl ? "دج" : "DZD"}
                </strong>
              </div>
            </div>

            {/* Success Indicators ProgressBar */}
            <div className="space-y-2 text-[10px]">
              <div>
                <div className="flex justify-between text-[9px] text-zinc-400 font-bold mb-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    {getLabel("نسبة التوصيل", "Taux de Livraison", "Delivery Rate")}
                  </span>
                  <span className="font-mono text-white font-extrabold">{activeStats.successRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${Math.min(activeStats.successRate, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[9px] text-zinc-400 font-bold mb-1">
                  <span className="flex items-center gap-1 text-rose-400">
                    <AlertTriangle className="w-3 h-3" />
                    {getLabel("نسبة المرتجعات", "Taux de Retour", "Return Rate")}
                  </span>
                  <span className="font-mono text-white font-extrabold">{activeStats.returnRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{ width: `${Math.min(activeStats.returnRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Meta statistics log details */}
            <div className="mt-3 pt-2 border-t border-zinc-900/60 grid grid-cols-3 text-[9px] text-zinc-500 font-medium">
              <div>
                <span>{getLabel("مستلمة", "Livré", "Deliv.")}</span>
                <span className="block font-mono text-zinc-300 font-bold text-xs mt-0.5">{activeStats.delivered}</span>
              </div>
              <div className="text-center">
                <span>{getLabel("مرتجع", "Retour", "Retur.")}</span>
                <span className="block font-mono text-zinc-300 font-bold text-xs mt-0.5">{activeStats.returned}</span>
              </div>
              <div className="text-end">
                <span>{getLabel("قيد الانتظار", "En att.", "Pend.")}</span>
                <span className="block font-mono text-zinc-300 font-bold text-xs mt-0.5">{activeStats.pending}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Map Legend footer guides */}
      <div className="mt-2.5 p-3 bg-[#08080a]/50 rounded-xl border border-zinc-900/60 flex items-center justify-between flex-wrap gap-2 text-[9.5px]">
        <div className="flex items-center gap-1 text-zinc-400 font-bold">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>{getLabel("دليل الألوان والأداء الجغرافي:", "Guide Performance Géo:", "Map Performance Guide:")}</span>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#064e3b] border border-emerald-400/30" />
            <span className="text-zinc-400">{getLabel("توصيل ممتاز (>60%)", "Livraison Excellente", "Excellent Delivery")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#7f1d1d] border border-rose-400/30" />
            <span className="text-zinc-400">{getLabel("نشاط مرتجع مرتفع (>35%)", "Retours Élevés", "High Returns Issues")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#1e40af] border border-indigo-400/30" />
            <span className="text-zinc-400">{getLabel("نشاط اعتيادي متزن", "Activité Normale", "Normal Active Volume")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-zinc-900 border border-zinc-800/40" />
            <span className="text-zinc-400">{getLabel("بدون طلبيات", "Aucune commande", "No orders recorded")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
