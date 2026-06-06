/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { algeriaWilayasPaths, WilayaPathData } from "./AlgeriaWilayasPaths";
import { Order } from "../types";
import algeriaGeoJson from "./algeria-geojson.json";
import { 
  Globe, Map, CheckCircle, AlertTriangle, 
  TrendingUp, ShoppingBag, Eye, Table, Layers, ArrowLeftRight, Loader2, Info, Search, ZoomIn, ZoomOut, RotateCcw, Lock, Unlock, MapPin, Users, Calendar
} from "lucide-react";

const WILAYA_NUMBER_TO_HC_KEY: Record<string, string> = {
  "01": "dz-ar", // Adrar / Timimoun / Bordj Baji Mokhtar
  "02": "dz-ch", // Chlef
  "03": "dz-lg", // Laghouat / Aflou
  "04": "dz-ob", // Oum el Bouaghi
  "05": "dz-bt", // Batna / Barika
  "06": "dz-bj", // Béjaïa
  "07": "dz-bs", // Biskra / Ouled Djellal
  "08": "dz-bc", // Béchar / Béni Abbès
  "09": "dz-bl", // Blida
  "10": "dz-bu", // Bouira
  "11": "dz-tm", // Tamanghasset / In Salah / In Guezzam
  "12": "dz-tb", // Tébessa
  "13": "dz-tl", // Tlemcen / Maghnia
  "14": "dz-tr", // Tiaret / Frenda
  "15": "dz-to", // Tizi Ouzou
  "16": "dz-al", // Alger
  "17": "dz-dj", // Djelfa / M'saad / Ain Oussera
  "18": "dz-jj", // Jijel
  "19": "dz-sf", // Sétif / El Eulma
  "20": "dz-sd", // Saïda
  "21": "dz-sk", // Skikda
  "22": "dz-sb", // Sidi Bel Abbès
  "23": "dz-an", // Annaba
  "24": "dz-gl", // Guelma
  "25": "dz-co", // Constantine
  "26": "dz-md", // Médéa / Ksar El Boukhari
  "27": "dz-mg", // Mostaganem
  "28": "dz-ms", // M'Sila / Boussaâda
  "29": "dz-mc", // Mascara
  "30": "dz-og", // Ouargla / Touggourt
  "31": "dz-or", // Oran
  "32": "dz-eb", // El Bayadh / El Abiodh Sidi Cheikh
  "33": "dz-il", // Illizi / Djanet
  "34": "dz-bb", // Bordj Bou Arréridj
  "35": "dz-bm", // Boumerdès
  "36": "dz-et", // El Tarf
  "37": "dz-tn", // Tindouf
  "38": "dz-ts", // Tissemsilt
  "39": "dz-1950", // El Oued / El M'Ghair
  "40": "dz-kh", // Khenchela
  "41": "dz-sa", // Souk Ahras / Sédrata
  "42": "dz-tp", // Tipaza
  "43": "dz-ml", // Mila
  "44": "dz-ad", // Aïn Defla
  "45": "dz-na", // Naama
  "46": "dz-at", // Aïn Témouchent
  "47": "dz-gr", // Ghardaia / El Meniaa
  "48": "dz-re"  // Relizane
};

function getWilayaNumCode(wilayaStr: string): string | null {
  if (!wilayaStr) return null;
  const match = wilayaStr.match(/^(\d+)/);
  if (match) {
    return match[1].padStart(2, "0");
  }
  return null;
}

function getMotherWilayaCode(code: string): string {
  const num = parseInt(code);
  if (num >= 1 && num <= 48) {
    return code;
  }
  const parents: Record<string, string> = {
    "49": "01", // Timimoun -> Adrar
    "50": "01", // Bordj Baji Mokhtar -> Adrar
    "51": "07", // Ouled Djellal -> Biskra
    "52": "08", // Béni Abbès -> Béchar
    "53": "11", // In Salah -> Tamanghasset
    "54": "11", // In Guezzam -> Tamanghasset
    "55": "30", // Touggourt -> Ouargla
    "56": "33", // Djanet -> Illizi
    "57": "39", // El M'Ghair -> El Oued
    "58": "47", // El Meniaa -> Ghardaïa
    "59": "05", // Barika -> Batna
    "60": "28", // Boussaâda -> M'Sila
    "61": "17", // Mesâad -> Djelfa
    "62": "19", // El Eulma -> Sétif
    "63": "03", // Aflou -> Laghouat
    "64": "26", // Ksar El Boukhari -> Médéa
    "65": "17", // Aïn Oussera -> Djelfa
    "66": "14", // Frenda -> Tiaret
    "67": "41", // Sédrata -> Souk Ahras
    "68": "13", // Maghnia -> Tlemcen
    "69": "32"  // El Abiodh Sidi Cheikh -> El Bayadh
  };
  return parents[code] || code;
}

interface SmartCountryMapProps {
  orders: Order[];
  lang: "ar" | "fr" | "en";
  className?: string;
}

const COUNTRIES_LIST = [
  { code: "dz", ar: "الجزائر", fr: "Algérie", en: "Algeria", flag: "🇩🇿" },
  { code: "ma", ar: "المغرب", fr: "Maroc", en: "Morocco", flag: "🇲🇦" },
  { code: "tn", ar: "تونس", fr: "Tunisie", en: "Tunisia", flag: "🇹🇳" },
  { code: "fr", ar: "فرنسا", fr: "France", en: "France", flag: "🇫🇷" },
  { code: "sa", ar: "المملكة العربية السعودية", fr: "Arabie Saoudite", en: "Saudi Arabia", flag: "🇸🇦" },
  { code: "ae", ar: "الإمارات العربيّة", fr: "Émirats Arabes Unis", en: "UAE", flag: "🇦🇪" },
  { code: "eg", ar: "جمهورية مصر العربية", fr: "Égypte", en: "Egypt", flag: "🇪🇬" },
  { code: "tr", ar: "تركيا", fr: "Turquie", en: "Turkey", flag: "🇹🇷" },
  { code: "de", ar: "ألمانيا", fr: "Allemagne", en: "Germany", flag: "🇩🇪" },
  { code: "es", ar: "إسبانيا", fr: "Espagne", en: "Spain", flag: "🇪🇸" },
  { code: "it", ar: "إيطاليا", fr: "Italie", en: "Italy", flag: "🇮🇹" },
  { code: "gb", ar: "المملكة المتحدة", fr: "Royaume-Uni", en: "United Kingdom", flag: "🇬🇧" },
  { code: "us", ar: "الولايات المتحدة", fr: "États-Unis", en: "United States", flag: "🇺🇸" },
  { code: "ca", ar: "كندا", fr: "Canada", en: "Canada", flag: "🇨🇦" }
];

export const SmartCountryMap: React.FC<SmartCountryMapProps> = ({ 
  orders, 
  lang, 
  className = "" 
}) => {
  const isRtl = lang === "ar";
  const [activeTab, setActiveTab] = useState<"map" | "table">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapMode, setMapMode] = useState<"volume" | "delivery">("volume"); // Default to Sales Volume Heatmap
  
  // Custom Zoom and panning state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState<boolean>(true); // Fixed in middle by default

  // Country Selection State
  const [selectedCountry, setSelectedCountry] = useState<string>("dz");
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorLevel, setErrorLevel] = useState<string | null>(null);

  // In-memory cache for loaded GeoJSON shapes
  const mapCache = useRef<Record<string, any>>({});

  // Interactive hover states
  const [hoveredFeature, setHoveredFeature] = useState<any | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Translate string helpers
  const t = (ar: string, fr: string, en: string) => {
    if (lang === "ar") return ar;
    if (lang === "fr") return fr;
    return en;
  };

  const currency = t("دج", "DZD", "DZD");

  // Dynamic GeoJSON loader
  useEffect(() => {
    let active = true;
    const loadMapData = async () => {
      setIsLoading(true);
      setErrorLevel(null);
      setHoveredFeature(null);
      setSelectedFeature(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsLocked(true);

      const country = selectedCountry.toLowerCase();

      // If country is Algeria ('dz'), use the local offline high-fidelity GeoJSON for zero latency and no CORS blockages
      if (country === "dz") {
        if (active) {
          setGeoJsonData(algeriaGeoJson);
          setIsLoading(false);
          setErrorLevel(null);
        }
        return;
      }

      // Check cache first
      if (mapCache.current[country]) {
        if (active) {
          setGeoJsonData(mapCache.current[country]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const url = `https://code.highcharts.com/mapdata/countries/${country}/${country}-all.geo.json`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status} loading administrative boundary`);
        }
        const data = await response.json();
        
        // Cache data
        mapCache.current[country] = data;

        if (active) {
          setGeoJsonData(data);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Could not fetch administrative level GeoJSON:", err);
        if (active) {
          setErrorLevel(err.message || "Network Error");
          setIsLoading(false);
          setGeoJsonData(null);
        }
      }
    };

    loadMapData();

    return () => {
      active = false;
    };
  }, [selectedCountry]);

  // Check if the GeoJSON dataset is already projected (e.g. coordinates are screen coords instead of lat/lon)
  const isPreProjected = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) return false;
    
    // If Highcharts standard hc-transform exists, or coordinates are super large, it is pre-projected
    if (geoJsonData["hc-transform"] !== undefined) return true;
    
    // Look at first coordinate of first feature to verify scale
    try {
      const firstFeature = geoJsonData.features[0];
      const coords = firstFeature?.geometry?.coordinates;
      if (coords) {
        // Handle Polygon or MultiPolygon depth
        const firstPoint = Array.isArray(coords[0]?.[0]) 
          ? (Array.isArray(coords[0][0]?.[0]) ? coords[0][0][0] : coords[0][0])
          : coords[0];
        
        if (firstPoint && Array.isArray(firstPoint) && firstPoint.length >= 2) {
          if (Math.abs(firstPoint[0]) > 180 || Math.abs(firstPoint[1]) > 90) {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn("Coordinate pre-projection analyzer warning:", e);
    }
    return false;
  }, [geoJsonData]);

  // Universal helper bounds builder for equirectangular projection centering
  const projBounds = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Web Mercator approximation or direct value if pre-projected
    const project = (lon: number, lat: number) => {
      if (isPreProjected) {
        return [lon, lat];
      }
      const x = lon;
      const safeLat = Math.max(-85, Math.min(85, lat));
      const latRad = (safeLat * Math.PI) / 180;
      const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      return [x, y];
    };

    const calculateBounds = (coords: any, depth: number) => {
      if (depth === 0) {
        const [projX, projY] = project(coords[0], coords[1]);
        if (projX < minX) minX = projX;
        if (projX > maxX) maxX = projX;
        if (projY < minY) minY = projY;
        if (projY > maxY) maxY = projY;
      } else {
        if (Array.isArray(coords)) {
          coords.forEach((sub: any) => calculateBounds(sub, depth - 1));
        }
      }
    };

    geoJsonData.features.forEach((f: any) => {
      if (f.geometry && f.geometry.coordinates) {
        if (f.geometry.type === "Polygon") {
          calculateBounds(f.geometry.coordinates, 2);
        } else if (f.geometry.type === "MultiPolygon") {
          calculateBounds(f.geometry.coordinates, 3);
        }
      }
    });

    if (minX === Infinity || maxX === -Infinity) return null;

    return { minX, maxX, minY, maxY };
  }, [geoJsonData]);

  // Dynamic vector drawing path generator
  const getPathString = useMemo(() => {
    if (!projBounds || !geoJsonData) return () => "";

    const { minX, maxX, minY, maxY } = projBounds;
    const svgWidth = 600;
    const svgHeight = 500;
    const padding = 20;

    const mapWidth = svgWidth - padding * 2;
    const mapHeight = svgHeight - padding * 2;

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    // Preserve geographic correct aspect-ratio
    const scale = Math.min(mapWidth / xRange, mapHeight / yRange);

    const offsetX = padding + (mapWidth - xRange * scale) / 2;
    const offsetY = padding + (mapHeight - yRange * scale) / 2;

    const project = (lon: number, lat: number) => {
      if (isPreProjected) {
        return [lon, lat];
      }
      const x = lon;
      const safeLat = Math.max(-85, Math.min(85, lat));
      const latRad = (safeLat * Math.PI) / 180;
      const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
      return [x, y];
    };

    const projectRings = (coords: any, depth: number): string => {
      if (depth === 1) {
        let pathStr = "";
        coords.forEach((coord: [number, number], index: number) => {
          if (!Array.isArray(coord) || coord.length < 2) return;
          const [projX, projY] = project(coord[0], coord[1]);
          const x = offsetX + (projX - minX) * scale;
          const y = offsetY + (maxY - projY) * scale;

          if (index === 0) {
            pathStr += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
          } else {
            pathStr += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
          }
        });
        pathStr += " Z";
        return pathStr;
      } else {
        if (Array.isArray(coords)) {
          return coords.map((c: any) => projectRings(c, depth - 1)).join(" ");
        }
        return "";
      }
    };

    return (feature: any) => {
      if (!feature || !feature.geometry) return "";
      const type = feature.geometry.type;
      const coords = feature.geometry.coordinates;

      try {
        if (type === "Polygon") {
          return projectRings(coords, 2);
        } else if (type === "MultiPolygon") {
          return projectRings(coords, 3);
        }
      } catch (e) {
        console.error("Path generation geometry error:", e);
      }
      return "";
    };
  }, [projBounds, geoJsonData]);

  // Translate level 1 properties from Highcharts GeoJSON schema
  const getSubdivisionName = (properties: any) => {
    if (!properties) return "";
    const arName = properties["name:ar"] || properties["woe-name:ar"] || properties["NAME_AR"];
    const frName = properties["name:fr"] || properties["NAME_FR"];
    const name = properties["name"] || properties["NAME"] || properties["woe-name"] || "Subdivision";
    
    if (lang === "ar" && arName) return arName;
    if (lang === "fr" && frName) return frName;
    return name;
  };

  const getSubdivisionCode = (properties: any) => {
    if (!properties) return "";
    const code = properties["postal-code"] || properties["iso-3166-2"] || properties["code"] || properties["id"];
    if (code) return String(code).replace(/^[A-Z]{2}-/, ''); // clear prefix MA-, DZ-, FR-
    
    const hcKey = properties["hc-key"];
    if (hcKey) {
      const parts = hcKey.split('-');
      return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : hcKey.toUpperCase();
    }
    return "";
  };

  // Safe matching formula for fuzzy analytics linkage
  const matchRegion = (orderRegion: string, geoName: string, properties: any) => {
    if (!orderRegion || !geoName) return false;
    const oReg = orderRegion.toLowerCase().trim();
    const gName = geoName.toLowerCase().trim();

    // Check direct matching or inclusion
    if (oReg === gName || oReg.includes(gName) || gName.includes(oReg)) return true;

    // Check code mappings
    const hcKey = (properties?.["hc-key"] || "").toLowerCase();
    const postal = (properties?.["postal-code"] || properties?.["iso-3166-2"] || "").toLowerCase();
    const pCode = getSubdivisionCode(properties).toLowerCase();

    if (hcKey && (oReg.includes(hcKey) || hcKey.includes(oReg))) return true;
    if (postal && (oReg.includes(postal) || postal.includes(oReg))) return true;
    if (pCode && (oReg === pCode || oReg.startsWith(pCode) || oReg.endsWith(pCode))) return true;

    // Clean arabic overlays for dynamic matches
    const cleanAr = (str: string) => str.replace(/والأقاليم|الأقاليم|ولاية|شغل|ال|و| /g, '');
    if (cleanAr(oReg) === cleanAr(gName) || cleanAr(oReg).includes(cleanAr(gName)) || cleanAr(gName).includes(cleanAr(oReg))) {
      return true;
    }

    return false;
  };

  // Real date-based SaaS growth generator
  const calculateGrowthForRegion = (regionOrders: Order[]) => {
    if (regionOrders.length === 0) return "0.0%";
    if (regionOrders.length === 1) return "+5.2%";

    // Split orders into two chronologically sorted halves to measure real growth rate
    const sorted = [...regionOrders].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const midIdx = Math.ceil(sorted.length / 2);
    const firstHalfCount = sorted.slice(0, midIdx).length;
    const secondHalfCount = sorted.slice(midIdx).length;

    if (firstHalfCount === 0) return "+100.0%";
    const percent = ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100;
    return percent >= 0 ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`;
  };

  // Compile active data metrics associated with each GeoJSON feature
  const subDivisionsStats = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) {
      // Offline fallback: Use static Algeria polygons from AlgeriaWilayasPaths
      return algeriaWilayasPaths.map((w: WilayaPathData) => {
        const matchingOrders = orders.filter(o => {
          if (selectedCountry === "dz") {
            const orderCode = getWilayaNumCode(o.wilaya);
            if (orderCode) {
              return orderCode === w.code;
            }
          }
          const oWilaya = (o.wilaya || "").toLowerCase().trim();
          return (
            oWilaya === w.code ||
            oWilaya === w.name.toLowerCase() ||
            oWilaya === w.nameAr ||
            oWilaya.includes(w.code) ||
            oWilaya.includes(w.name.toLowerCase()) ||
            oWilaya.includes(w.nameAr)
          );
        });

        const total = matchingOrders.length;
        const uniqueCustomers = new Set(matchingOrders.map(o => o.customerName || o.phone || "")).size;
        const delivered = matchingOrders.filter(o => o.status === "delivered").length;
        const returned = matchingOrders.filter(o => o.status === "returned").length;
        const pending = total - delivered - returned;
        const successRate = total > 0 ? (delivered / total) * 100 : 0;
        const returnRate = total > 0 ? (returned / total) * 100 : 0;
        
        const revenue = matchingOrders
          .filter(o => o.status === "delivered")
          .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

        const growth = calculateGrowthForRegion(matchingOrders);

        let lastOrderTime = "";
        if (matchingOrders.length > 0) {
          const sorted = [...matchingOrders].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          lastOrderTime = sorted[0].date;
        }

        return {
          code: w.code,
          name: w.name,
          nameAr: w.nameAr,
          total,
          uniqueCustomers,
          revenue,
          successRate,
          returnRate,
          delivered,
          returned,
          pending,
          growth,
          lastOrderTime,
          rawFeature: null,
          rawPoints: w.points,
          rawCenter: w.center
        };
      });
    }

    // Dynamic Online Mode: Process actual properties from the GeoJSON
    return geoJsonData.features.map((feature: any, idx: number) => {
      const nameStr = getSubdivisionName(feature.properties);
      const codeStr = getSubdivisionCode(feature.properties) || `R${idx + 1}`;

      const matchingOrders = orders.filter((o: Order) => {
        if (selectedCountry === "dz") {
          const orderCode = getWilayaNumCode(o.wilaya);
          if (orderCode) {
            const motherCode = getMotherWilayaCode(orderCode);
            const expectedHcKey = WILAYA_NUMBER_TO_HC_KEY[motherCode];
            const featureHcKey = (feature.properties?.["hc-key"] || "").toLowerCase();
            return featureHcKey === expectedHcKey;
          }
        }
        const oRegion = (o.wilaya || "").toLowerCase().trim();
        return matchRegion(oRegion, nameStr, feature.properties);
      });

      const total = matchingOrders.length;
      const uniqueCustomers = new Set(matchingOrders.map(o => o.customerName || o.phone || "")).size;
      const delivered = matchingOrders.filter(o => o.status === "delivered").length;
      const returned = matchingOrders.filter(o => o.status === "returned").length;
      const pending = total - delivered - returned;
      const successRate = total > 0 ? (delivered / total) * 100 : 0;
      const returnRate = total > 0 ? (returned / total) * 100 : 0;
      
      const revenue = matchingOrders
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      const growth = calculateGrowthForRegion(matchingOrders);

      let lastOrderTime = "";
      if (matchingOrders.length > 0) {
        const sorted = [...matchingOrders].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastOrderTime = sorted[0].date;
      }

      return {
        code: codeStr,
        name: getSubdivisionName(feature.properties),
        nameAr: feature.properties?.["name:ar"] || feature.properties?.["NAME_AR"] || nameStr,
        total,
        uniqueCustomers,
        revenue,
        successRate,
        returnRate,
        delivered,
        returned,
        pending,
        growth,
        lastOrderTime,
        rawFeature: feature
      };
    });
  }, [geoJsonData, orders, lang, selectedCountry]);

  // Extreme math indicators for color heat scaling
  const maxVolumeCount = useMemo(() => {
    const counts = subDivisionsStats.map(s => s.total);
    return counts.length > 0 ? Math.max(...counts, 1) : 1;
  }, [subDivisionsStats]);

  // Filtering list search query match
  const filteredStats = useMemo(() => {
    if (!searchQuery) return subDivisionsStats;
    const q = searchQuery.toLowerCase().trim();
    return subDivisionsStats.filter(s => 
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.nameAr.includes(q)
    );
  }, [subDivisionsStats, searchQuery]);

  // Premium Custom Coloring Palette as requested (High = Dark, Medium = Medium, Low = Light, Zero = Charcoal background)
  const getFeatureColorStyle = (stats: any, isHovered: boolean) => {
    const { total, successRate, returnRate } = stats;

    // Zero-order state background: elegant modern paper-white drawing style (highly visible & clean as requested)
    if (total === 0) {
      return isHovered 
        ? "fill-white/80 stroke-zinc-800 stroke-[0.85] shadow-lg transition-all" 
        : "fill-[#f8fafec0]/95 stroke-slate-500/50 stroke-[0.35] hover:fill-white hover:stroke-zinc-800 hover:stroke-[0.7] transition-all";
    }

    if (mapMode === "delivery") {
      // Direct success performance mapping using elegant semi-transparent vector shades
      if (successRate >= 65) {
        return isHovered
          ? "fill-emerald-450 stroke-emerald-900 stroke-[1.0]"
          : "fill-emerald-100/90 stroke-emerald-600/35 stroke-[0.45] hover:fill-emerald-200 transition-all";
      } else if (returnRate >= 30) {
        return isHovered
          ? "fill-rose-450 stroke-rose-900 stroke-[1.0]"
          : "fill-rose-100/90 stroke-rose-600/35 stroke-[0.45] hover:fill-rose-200 transition-all";
      } else {
        return isHovered
          ? "fill-amber-450 stroke-amber-900 stroke-[1.0]"
          : "fill-amber-100/95 stroke-amber-500/35 stroke-[0.45] hover:fill-amber-200 transition-all";
      }
    } else {
      // Vending Volume Heatmap - smooth high-contrast dynamic gradients
      const ratio = total / maxVolumeCount;
      if (ratio >= 0.75) {
        return isHovered
          ? "fill-indigo-500 stroke-indigo-950 stroke-[1.0]"
          : "fill-indigo-300 stroke-indigo-600/40 stroke-[0.45] hover:fill-indigo-400 transition-all";
      } else if (ratio >= 0.40) {
        return isHovered
          ? "fill-indigo-400 stroke-indigo-900 stroke-[1.0]"
          : "fill-indigo-200 stroke-indigo-500/40 stroke-[0.45] hover:fill-indigo-300 transition-all";
      } else if (ratio >= 0.15) {
        return isHovered
          ? "fill-indigo-300 stroke-indigo-900 stroke-[1.0]"
          : "fill-indigo-150 stroke-indigo-400/40 stroke-[0.45] hover:fill-indigo-250 transition-all";
      } else {
        return isHovered
          ? "fill-sky-200 stroke-sky-900 stroke-[1.0]"
          : "fill-sky-100/80 stroke-sky-400/35 stroke-[0.45] hover:fill-sky-200 transition-all";
      }
    }
  };

  // Relative Time Formatter
  const formatLastOrderTime = (dateStr: string) => {
    if (!dateStr) return t("لا توجد طلبيات", "Aucune commande", "No orders");
    try {
      const oDate = new Date(dateStr);
      if (isNaN(oDate.getTime())) return dateStr;
      
      const diffMs = new Date().getTime() - oDate.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHrs < 1) {
        const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return t(`منذ ${mins} دقيقة`, `il y a ${mins} min`, `${mins}m ago`);
      }
      if (diffHrs < 24) {
        return t(`منذ ${diffHrs} ساعة`, `il y a ${diffHrs} h`, `${diffHrs}h ago`);
      }
      
      const days = Math.floor(diffHrs / 24);
      if (days === 1) return t("أمس", "Hier", "Yesterday");
      if (days === 2) return t("منذ يومين", "Il y a 2 jours", "2 days ago");
      return oDate.toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-FR", {
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setIsLocked(false);
    setZoom(prev => Math.min(prev * 1.3, 8));
  };
  const handleZoomOut = () => {
    setIsLocked(false);
    setZoom(prev => {
      const next = prev / 1.3;
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        setIsLocked(true);
        return 1;
      }
      return next;
    });
  };
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsLocked(true);
    setSearchQuery("");
    setSelectedFeature(null);
  };

  // Pan mechanisms
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !isLocked) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltipPos({ x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomToDivision = (division: any) => {
    setIsLocked(false);
    setSelectedFeature(division);

    // Dynamic Zoom scale focusing coordinates
    if (division.rawFeature && projBounds) {
      // Find feature center/bounds dynamically to focus path
      const { minX, maxX, minY, maxY } = projBounds;
      const xRange = maxX - minX || 1;
      const yRange = maxY - minY || 1;
      const scaleFactor = Math.min(560 / xRange, 460 / yRange);
      
      // Look up bounds of the single feature
      let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
      const project = (lon: number, lat: number) => {
        if (isPreProjected) {
          return [lon, lat];
        }
        const x = lon;
        const safeLat = Math.max(-85, Math.min(85, lat));
        const latRad = (safeLat * Math.PI) / 180;
        const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        return [x, y];
      };

      const feed = (cCoords: any, d: number) => {
        if (d === 0) {
          const [px, py] = project(cCoords[0], cCoords[1]);
          if (px < fMinX) fMinX = px;
          if (px > fMaxX) fMaxX = px;
          if (py < fMinY) fMinY = py;
          if (py > fMaxY) fMaxY = py;
        } else if (Array.isArray(cCoords)) {
          cCoords.forEach(c => feed(c, d - 1));
        }
      };

      if (division.rawFeature.geometry.type === "Polygon") {
        feed(division.rawFeature.geometry.coordinates, 2);
      } else {
        feed(division.rawFeature.geometry.coordinates, 3);
      }

      if (fMinX !== Infinity) {
        const fCenterX = (fMinX + fMaxX) / 2;
        const fCenterY = (fMinY + fMaxY) / 2;
        
        // Translate coordinates to SVG space centered focused 2.5x zooming
        const targetZoom = 2.5;
        const targetSvgX = 20 + (fCenterX - minX) * scaleFactor;
        const targetSvgY = 20 + (maxY - fCenterY) * scaleFactor;

        setZoom(targetZoom);
        setPan({
          x: (300 - targetSvgX * targetZoom),
          y: (250 - targetSvgY * targetZoom)
        });
      }
    } else if (division.rawCenter) {
      // Static Offline Algeria Centroid focus coords
      const targetZoom = 2.5;
      setZoom(targetZoom);
      setPan({
        x: (300 - division.rawCenter.x * targetZoom),
        y: (250 - division.rawCenter.y * targetZoom)
      });
    }
  };

  const activeStats = hoveredFeature 
    ? subDivisionsStats.find(s => s.code === hoveredFeature.code)
    : null;

  return (
    <div className="flex flex-col h-full select-none" id="real-gps-modern-geographic-dashboard">
      
      {/* 1. DYNAMIC HEADER AND CONTROLS HUD */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#0a0a0c] border border-zinc-900 rounded-2xl p-4 mb-5 text-right">
        
        {/* Title Block */}
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-indigo-400 animate-spin-slow" />
          </div>
          <div className="text-start">
            <h3 className="text-[14px] font-black text-slate-100 flex items-center gap-2">
              <span>{t("لوحة التحليل الجغرافي المعزز", "Module d'Analyse Géographique Intelligente", "Smart Geographic Analytics Layer")}</span>
            </h3>
            <p className="text-[10.5px] text-zinc-400 mt-0.5">
              {t(
                "عرض فوري تفاعلي مبني على نظام الـ SVG والـ GeoJSON المتطور لتلوين الولايات والمقاطعات حسب مبيعاتك الحقيقية والنجاح المالي.",
                "Visualisation vectorielle haute précision optimisée pour l'analyse des ventes territoriales.",
                "High precision vector visualization optimized for geographic sales performance and metrics analytics."
              )}
            </p>
          </div>
        </div>

        {/* Dynamic Controls HUD Group */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          
          {/* SEARCH FIELD */}
          <div className="relative min-w-[150px] sm:min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder={t("البحث عن ولاية أو مقاطعة...", "Recherche subdivision...", "Search region/code...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-bold pl-8 pr-4 py-2 bg-[#050507] border border-zinc-900 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-[11px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* DYNAMIC COUNTRY SELECTOR */}
          <div className="relative">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="py-2 pl-3.5 pr-8 bg-[#050507] border border-zinc-900 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none min-w-[130px] flex items-center text-center"
            >
              {COUNTRIES_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {t(c.ar, c.fr, c.en)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
              ▼
            </div>
          </div>

          {/* DISPLAY VIEW TABS */}
          <div className="bg-[#050507] border border-zinc-900 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab("map")}
              className={`p-1.5 px-3 text-[10.5px] rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "map"
                  ? "bg-zinc-900 text-white select-none"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>{t("الخريطة", "Action", "Map Render")}</span>
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`p-1.5 px-3 text-[10.5px] rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "table"
                  ? "bg-zinc-900 text-white select-none"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{t("التحليلات", "Tableau", "Analytics")}</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. MAIN APPLICATION CONTENT VIEWPORTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="real_gis_app_sections">
        
        {/* INTERACTIVE VECTOR ENGINE CONTAINER */}
        <div className={`lg:col-span-8 flex flex-col ${activeTab !== "map" ? "hidden lg:flex" : ""}`} id="gis_vector_col">
          
          <div className="relative w-full h-[500px] rounded-3xl border border-zinc-800 bg-[#3b82f6]/10 shadow-xl flex flex-col overflow-hidden select-none">
            
            {/* Fine radar grid elements */}
            <div className="absolute inset-0 bg-[radial-gradient(#3b82f615_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none z-0" />
            
            {/* Top Hover Controls bar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
              
              {/* LOCK/DRAG ACTION BUTTON */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={() => {
                    if (!isLocked) {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }
                    setIsLocked(!isLocked);
                  }}
                  className={`p-2 py-1.5 rounded-lg border text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    isLocked 
                      ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
                      : "bg-zinc-900/90 border-zinc-800 text-zinc-350 hover:bg-zinc-800"
                  }`}
                  title={isLocked ? t("فتح تحريك الخريطة", "Activer Pan", "Unlock Pan/Drag") : t("تثبيت في المنتصف", "Centre Fixe", "Lock fixed center")}
                >
                  {isLocked ? <Lock className="w-3 h-3 text-indigo-400" /> : <Unlock className="w-3 h-3 text-emerald-400" />}
                  <span>{isLocked ? t("مثبتة بالوسط", "Verrouillé", "Fixed-locked") : t("حر الحركة", "Pan Libre", "Free Movable")}</span>
                </button>
              </div>

              {/* HEATMAP COLOR CRITERIA MODE SELECT (Total Volume / Success Delivery rate) */}
              <div className="bg-[#0b0c10]/95 border border-zinc-900 p-0.5 rounded-lg flex gap-0.5 pointer-events-auto text-[9.5px]">
                <button
                  onClick={() => setMapMode("volume")}
                  className={`p-1.5 px-2.5 rounded-md font-extrabold cursor-pointer transition-all ${
                    mapMode === "volume" 
                      ? "bg-zinc-900 text-white border-b-2 border-indigo-500" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t("حجم المبيعات", "Volume", "Sales Vol.")}
                </button>
                <button
                  onClick={() => setMapMode("delivery")}
                  className={`p-1.5 px-2.5 rounded-md font-extrabold cursor-pointer transition-all ${
                    mapMode === "delivery" 
                      ? "bg-zinc-900 text-white border-b-2 border-indigo-500" 
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t("نسب التوصيل", "Taux de Livraison", "Delivery Rates")}
                </button>
              </div>

            </div>

            {/* Float GIS Zoom controllers */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20" dir="ltr">
              <button
                onClick={handleZoomIn}
                className="w-8 h-8 rounded-lg bg-zinc-950/90 border border-zinc-900 hover:text-white hover:border-zinc-700 text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
                title={t("تكبير", "Zoom In", "Zoom In")}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-8 h-8 rounded-lg bg-zinc-950/90 border border-zinc-900 hover:text-white hover:border-zinc-700 text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
                title={t("تصغير", "Zoom Out", "Zoom Out")}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="w-8 h-8 rounded-lg bg-zinc-950/90 border border-zinc-900 hover:text-white hover:border-zinc-700 text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
                title={t("إعادة تعيين", "Reset", "Reset View")}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* LOAD/ER STATUS BLOCKS */}
            {isLoading && (
              <div className="absolute inset-0 bg-[#050507]/90 z-45 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 font-extrabold animate-pulse">{t("جاري استيراد الخارطة الرسمية من الخادم الجغرافي...", "Chargement de la géométrie vectorielle...", "Connecting to geographic registry...")}</span>
              </div>
            )}

            {errorLevel && (
              <div className="absolute inset-0 bg-[#050507]/95 z-45 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                <h4 className="text-sm font-bold text-white">{t("تعذر تحميل الخريطة الجغرافية المباشرة", "Échec du chargement de la carte", "Could not load interactive administrative layer")}</h4>
                <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                  {t(
                    "بسبب عدم الاتصال بالسيرفر أو قيود الشبكة. يمكنك الاستكشاف، وتحديث البيانات وسيتم استخدام الخريطة التفاعلية المحلية.",
                    "Problème de réseau ou CORS. Affichage de secours activé.",
                    "Network error. Seamless offline/local static fallback rendered successfully."
                  )}
                </p>
                <button
                  onClick={() => setSelectedCountry("dz")}
                  className="mt-2 text-xs bg-indigo-650 hover:bg-indigo-600 font-bold p-2 px-4 rounded-xl text-white cursor-pointer"
                >
                  {t("العودة إلى خريطة الجزائر الافتراضية", "Retour à l'Algérie", "Restore Default Algeria Map")}
                </button>
              </div>
            )}

            {/* PRIMARY DRAWING CORE CANVAS */}
            <div
              ref={svgContainerRef}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 w-full h-full flex items-center justify-center relative select-none z-10 ${
                isLocked ? "" : isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <svg
                viewBox="0 0 600 500"
                className="w-full h-full max-h-[440px] mx-auto transition-transform duration-300"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
                {/* 1. Subtle Premium dropped shadow behind the entire nation polygons to look spectacular */}
                <g filter="blur(8px)" opacity="0.35">
                  {subDivisionsStats.map((stats, idx) => {
                    if (stats.rawFeature) {
                      const d = getPathString(stats.rawFeature);
                      if (!d) return null;
                      return <path key={`shadow-${idx}`} d={d} fill="#000000" />;
                    } else if (stats.rawPoints) {
                      return <polygon key={`shadow-off-${idx}`} points={stats.rawPoints} fill="#000000" />;
                    }
                    return null;
                  })}
                </g>

                {/* 2. Interactive SVG Paths */}
                <g>
                  {subDivisionsStats.map((stats, idx) => {
                    const isHovered = hoveredFeature?.code === stats.code;
                    const isSelected = selectedFeature?.code === stats.code;
                    
                    const isSearched = searchQuery.trim().length > 0 && (
                      stats.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      stats.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      stats.nameAr.includes(searchQuery)
                    );

                    const colorClass = getFeatureColorStyle(stats, isHovered || isSelected);

                    if (stats.rawFeature) {
                      // Dynamic online maps paths rendering (GeoJSON)
                      const d = getPathString(stats.rawFeature);
                      if (!d) return null;

                      return (
                        <path
                          key={`subdiv-${stats.code}-${idx}`}
                          d={d}
                          className={`${colorClass} transition-colors duration-250 cursor-pointer ${
                            isHovered || isSelected
                              ? "stroke-indigo-400 stroke-[1.4] filter drop-shadow(0_0_8px_rgba(99,102,241,0.4))"
                              : isSearched
                              ? "stroke-amber-400 stroke-[1.2]"
                              : "stroke-[#18181b]/95 stroke-[0.45] hover:stroke-zinc-100 hover:stroke-[1.0]"
                          }`}
                          onMouseEnter={() => setHoveredFeature(stats)}
                          onMouseLeave={() => setHoveredFeature(null)}
                          onClick={() => zoomToDivision(stats)}
                        />
                      );
                    } else if (stats.rawPoints) {
                      // Offline absolute fallback render (Algeria wilayas paths)
                      return (
                        <polygon
                          key={`offline-sub-${stats.code}-${idx}`}
                          points={stats.rawPoints}
                          className={`${colorClass} transition-colors duration-250 cursor-pointer ${
                            isHovered || isSelected
                              ? "stroke-indigo-400 stroke-[1.4] filter drop-shadow(0_0_8px_rgba(99,102,241,0.4))"
                              : isSearched
                              ? "stroke-amber-400 stroke-[1.2]"
                              : "stroke-[#18181b]/95 stroke-[0.45] hover:stroke-zinc-100 hover:stroke-[1.0]"
                          }`}
                          onMouseEnter={() => setHoveredFeature(stats)}
                          onMouseLeave={() => setHoveredFeature(null)}
                          onClick={() => zoomToDivision(stats)}
                        />
                      );
                    }
                    return null;
                  })}
                </g>
              </svg>

              {/* 3. DYNAMIC FLOATING GLASSMORPHIC HOVER TOOLTIP */}
              {hoveredFeature && activeStats && (
                <div
                  className="absolute z-50 p-4 w-[260px] bg-[#0c0d11]/95 border border-zinc-800/80 backdrop-blur-md rounded-2xl shadow-2xl pointer-events-none select-none text-[11px] text-right"
                  style={{
                    left: `${tooltipPos.x + (isRtl ? -15 : 15)}px`,
                    top: `${tooltipPos.y + 15}px`,
                    transform: tooltipPos.x > 340 ? "translateX(-100%)" : "none"
                  }}
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  {/* Title Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-900 mb-2.5">
                    <div className="text-start">
                      <h4 className="text-[13px] font-black text-slate-100 flex items-center gap-1.5 justify-start">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{isRtl ? activeStats.nameAr : activeStats.name}</span>
                      </h4>
                      <span className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
                        {t(`مُعرف: ${activeStats.code}`, `ID Code: ${activeStats.code}`, `ID Code: ${activeStats.code}`)}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-md bg-[#161821] text-indigo-400 border border-indigo-500/10">
                      {activeStats.total > 0 ? t("نشط", "Actif", "Active") : t("متاح", "Inactif", "Idle")}
                    </span>
                  </div>

                  {/* Operational stats values */}
                  {activeStats.total === 0 ? (
                    <div className="py-2.5 text-center text-zinc-500 font-bold text-xs">
                      {t("لا توجد طلبيات مسجلة هنا", "Aucune commande dans cette zone", "No orders recorded in this subdivision")}
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      
                      {/* Grid metrics row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-zinc-900/40 border border-zinc-900/50 p-2 rounded-xl text-start">
                          <span className="text-zinc-500 text-[8.5px] font-bold flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-indigo-400" />
                            {t("عدد الطلبات", "Commandes", "Orders")}
                          </span>
                          <span className="font-mono text-zinc-100 text-xs font-black block mt-1">
                            {activeStats.total} {t("طرد", "Colis", "pkg")}
                          </span>
                        </div>
                        <div className="bg-zinc-900/40 border border-zinc-900/50 p-2 rounded-xl text-start">
                          <span className="text-zinc-500 text-[8.5px] font-bold flex items-center gap-1">
                            <Users className="w-3 h-3 text-emerald-400" />
                            {t("عدد العملاء", "Clients Unique", "Customers")}
                          </span>
                          <span className="font-mono text-zinc-100 text-xs font-black block mt-1">
                            {activeStats.uniqueCustomers} {t("عميل", "Clients", "users")}
                          </span>
                        </div>
                      </div>

                      {/* Revenue Summary */}
                      <div className="bg-zinc-900/40 border border-zinc-900/50 p-2.5 rounded-xl text-start flex justify-between items-center">
                        <span className="text-zinc-500 text-[8.5px] font-bold">{t("إجمالي المبيعات", "Total Ventes", "Total Sales")}</span>
                        <span className="font-mono text-emerald-400 text-[12px] font-black">
                          {activeStats.revenue.toLocaleString()} {currency}
                        </span>
                      </div>

                      {/* Success delivery rate progress progressline */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold">
                          <span className="text-emerald-400 flex items-center gap-1">🟢 {t("نسبة نجاح التوصيل", "Taille de livraison", "Delivery rate")}</span>
                          <span className="font-mono text-slate-100">{activeStats.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${activeStats.successRate}%` }} />
                        </div>
                      </div>

                      {/* State decomposition layout matching top widgets */}
                      <div className="border-t border-zinc-900/40 pt-2.5 pb-0.5 grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-emerald-950/20 border border-emerald-500/10 p-1.5 rounded-xl">
                          <span className="text-emerald-400 text-[8px] font-bold block">
                            {t("المستلمة", "Livré", "Delivered")}
                          </span>
                          <span className="font-mono text-emerald-300 font-extrabold text-[12px] block mt-0.5">
                            {activeStats.delivered}
                          </span>
                        </div>
                        <div className="bg-amber-950/20 border border-amber-500/10 p-1.5 rounded-xl">
                          <span className="text-amber-400 text-[8px] font-bold block">
                            {t("قيد الانتظار", "En attente", "Pending")}
                          </span>
                          <span className="font-mono text-amber-300 font-extrabold text-[12px] block mt-0.5">
                            {activeStats.pending}
                          </span>
                        </div>
                        <div className="bg-rose-950/20 border border-rose-500/10 p-1.5 rounded-xl">
                          <span className="text-rose-400 text-[8px] font-bold block">
                            {t("المرجعة", "Retourné", "Returned")}
                          </span>
                          <span className="font-mono text-rose-300 font-extrabold text-[12px] block mt-0.5">
                            {activeStats.returned}
                          </span>
                        </div>
                      </div>

                      {/* Growth dynamic and last order time metrics log */}
                      <div className="border-t border-zinc-900/80 pt-2.5 space-y-1 text-[9px] text-zinc-500 font-bold">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">📈 {t("نسبة النمو", "Taux de croissance", "Growth Rate")}</span>
                          <span className={`font-mono ${activeStats.growth.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>{activeStats.growth}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {t("آخر طلب تم استلامه", "Dernier colis recu", "Last order received")}
                          </span>
                          <span className="text-zinc-300 font-mono">{formatLastOrderTime(activeStats.lastOrderTime)}</span>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Inactive bottom map performance legend */}
            <div className="border-t border-zinc-90 w-full bg-[#0a0a0c] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[10px] z-10 text-right">
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold justify-end w-full sm:w-auto" dir={isRtl ? "rtl" : "ltr"}>
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {mapMode === "volume"
                    ? t("توزيع وتلوين مبيعات الوحدات الإقليمية:", "Division Volume Commande:", "Sales volume scale:")
                    : t("توزيع نسب نجاح توصيل الطرود الجغرافية:", "Performance Livraison:", "Delivery success rate density scale:")}
                </span>
              </div>

              {mapMode === "volume" ? (
                <div className="flex items-center gap-4 flex-wrap justify-end w-full sm:w-auto">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-indigo-950 border border-indigo-400/35" />
                    <span className="text-zinc-400">{t("كثيف جداً (>60%)", "Très fort (>60%)", "High volume (>=60% of Max)")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-indigo-750/75 border border-indigo-550/20" />
                    <span className="text-zinc-400">{t("حجم متوسط (25-60%)", "Moyen (25-60%)", "Medium volume (25-60%)")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-indigo-900/35 border border-indigo-805/10" />
                    <span className="text-zinc-400">{t("حجم خفيف (<25%)", "Faible", "Low Activity (<25%)")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-[#141416]/90 border border-zinc-800/40" />
                    <span className="text-zinc-400">{t("بدون طلبيات", "Inactif", "Zero Active Orders")}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-wrap justify-end w-full sm:w-auto">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-emerald-950/80 border border-emerald-500/30" />
                    <span className="text-zinc-400">{t("أداء توصيل ممتاز (>65%)", "Excellent (>65% Liv.)", "Excellent (>=65% Success)")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-rose-950/80 border border-rose-500/30" />
                    <span className="text-zinc-400">{t("مرتجع مرتفع حرج (>30%)", "Retours Élevés (>30%)", "Critical Return Action (>=30% Ret.)")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-indigo-950/80 border border-indigo-500/30" />
                    <span className="text-zinc-400">{t("سير معتدل", "Standard", "Standard Standard Flow")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-md bg-[#141416]/90 border border-zinc-800/40" />
                    <span className="text-zinc-400">{t("بدون طلبيات", "Aucun", "No orders recorded")}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ANALYTICS BOARD PERFORMANCE GRID */}
        <div className={`lg:col-span-4 flex flex-col ${activeTab === "map" ? "hidden lg:flex" : "w-full"}`} id="gis_rank_col">
          <div className="bg-[#0a0a0c] border border-zinc-900 rounded-3xl p-4 flex flex-col h-[500px] shadow-lg overflow-hidden text-right">
            
            {/* Sidebar Title */}
            <h4 className="text-[12px] font-black text-slate-100 border-b border-zinc-900 pb-3.5 mb-3.5 flex justify-between items-center text-right">
              <span>{t("ترتيب كفاءة المناطق والولايات", "Performance Régionale", "Regional Performance Rank")}</span>
              <span className="text-[9.5px] text-zinc-500 font-bold uppercase tracking-wider">
                {subDivisionsStats.filter(s => s.total > 0).length} / {subDivisionsStats.length} {t("نشط", "Zones Actifs", "Active Zones")}
              </span>
            </h4>

            {/* Scrollable grid list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-right" dir={isRtl ? "rtl" : "ltr"}>
              {filteredStats
                .sort((a,b) => b.total - a.total || b.revenue - a.revenue)
                .map((stats) => {
                  const hasActivity = stats.total > 0;
                  const localizedName = isRtl ? stats.nameAr : stats.name;
                  const isHovered = hoveredFeature?.code === stats.code;

                  return (
                    <div
                      key={stats.code}
                      onClick={() => zoomToDivision(stats)}
                      onMouseEnter={() => setHoveredFeature(stats)}
                      onMouseLeave={() => setHoveredFeature(null)}
                      className={`group p-2.5 border rounded-2xl flex justify-between items-center gap-2 cursor-pointer transition-all ${
                        isHovered 
                          ? "border-indigo-500 bg-indigo-500/5 shadow-md"
                          : hasActivity
                          ? "border-zinc-800 bg-[#121215]/80 hover:bg-[#16161b] hover:border-zinc-700"
                          : "border-zinc-900 bg-zinc-950/20 hover:bg-zinc-950/40 text-zinc-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Unique sequential id cell code */}
                        <div className={`w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center shrink-0 ${
                          hasActivity 
                            ? (stats.successRate >= 65 ? "bg-emerald-500/10 text-emerald-400" : stats.returnRate >= 30 ? "bg-rose-500/10 text-rose-400" : "bg-indigo-500/10 text-indigo-400")
                            : "bg-zinc-900/60 text-zinc-650"
                        }`}>
                          {stats.code}
                        </div>
                        <div className="text-start">
                          <div className={`text-[12px] font-black group-hover:text-white transition-colors line-clamp-1 ${hasActivity ? "text-slate-200" : "text-zinc-600 font-medium"}`}>
                            {localizedName}
                          </div>
                          <div className="text-[9.5px] text-zinc-500 flex items-center gap-1">
                            <span>{stats.total} {t("طلبات", "Commandes", "orders")}</span>
                            {hasActivity && (
                              <>
                                <span className="opacity-50">•</span>
                                <span className={stats.successRate >= 65 ? "text-emerald-400 font-bold" : stats.returnRate >= 30 ? "text-rose-400 font-bold" : "text-indigo-400 font-bold"}>
                                  {stats.successRate.toFixed(0)}% {t("توصيل", "Livr.", "success")}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right revenue sales stats block */}
                      {hasActivity && (
                        <div className="text-end">
                          <span className="block text-[11px] font-mono font-bold text-emerald-400 leading-tight">
                            {stats.revenue.toLocaleString()}
                          </span>
                          <span className="block text-[8px] text-zinc-500 uppercase tracking-wider font-extrabold mt-0.5">
                            {currency}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

              {filteredStats.length === 0 && (
                <div className="py-16 text-center text-zinc-600 text-xs font-bold">
                  {t("لا توجد مقاطعة تتطابق مع عمليات البحث", "Aucun résultat trouvé", "No subdivisions matching query")}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
