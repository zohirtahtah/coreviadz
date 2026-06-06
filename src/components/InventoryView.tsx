/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  BasicInventoryItem, SubInventoryItem, ReturnInventoryItem, 
  Product, LanguageType 
} from "../types";
import { 
  Package, RotateCcw, Edit2, X, Check, Search, Trash2, ArrowRightLeft, AlertTriangle, RefreshCw 
} from "lucide-react";
import { getStockMovements, logStockMovement } from "../storageUtils";

interface InventoryViewProps {
  basicInventory: BasicInventoryItem[];
  subInventory: SubInventoryItem[];
  returnInventory: ReturnInventoryItem[];
  onSaveBasic: (arr: BasicInventoryItem[]) => void;
  onSaveSub: (arr: SubInventoryItem[]) => void;
  onSaveReturn: (arr: ReturnInventoryItem[]) => void;
  products: Product[];
  lang: LanguageType;
  onSoftDeleteProduct?: (id: string) => void;
}

export default function InventoryView({
  basicInventory,
  subInventory,
  returnInventory,
  onSaveBasic,
  onSaveSub,
  onSaveReturn,
  products,
  lang,
  onSoftDeleteProduct
}: InventoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editQty, setEditQty] = useState<{ id: string; qty: number } | null>(null);

  // Adjustment Modal for cells/rows
  const [showAdjustModal, setShowAdjustModal] = useState<{
    type: "basic" | "sub" | "return";
    productId?: string;
    productName?: string;
    color?: string;
    size?: string;
    index?: number;
    label: string;
  } | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [movements, setMovements] = useState(() => getStockMovements());

  // Transfer Modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<"1" | "2">("1"); // 1: Basic to Sub, 2: Sub to Basic
  const [transferTargetProd, setTransferTargetProd] = useState("");
  const [transferColor, setTransferColor] = useState("");
  const [transferSize, setTransferSize] = useState("");
  const [transferQty, setTransferQty] = useState(1);

  // Helper translations lookup
  const getsLabel = (key: string, arText: string, frText: string, enText: string) => {
    if (lang === "ar") return arText;
    if (lang === "fr") return frText;
    return enText;
  };

  // Safe loading custom colors
  const colors = useMemo(() => {
    try {
      const stored = localStorage.getItem("corevia_custom_colors_v1");
      if (stored) return JSON.parse(stored) as string[];
    } catch (e) {}
    return [
      "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
      "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)"
    ];
  }, []);

  // Safe loading supplier invoices to determine delete dependencies
  const invoices = useMemo(() => {
    try {
      const stored = localStorage.getItem("corevia_supplier_invoices_v1");
      if (stored) {
        return JSON.parse(stored) as any[];
      }
    } catch (e) {}
    return [];
  }, []);

  const totalBasicItems = useMemo(() => {
    return basicInventory.reduce((s, i) => s + i.quantity, 0);
  }, [basicInventory]);

  const totalSubItems = useMemo(() => {
    return subInventory.reduce((s, i) => s + i.quantity, 0);
  }, [subInventory]);

  const totalReturnQty = useMemo(() => {
    return returnInventory.reduce((s, i) => s + i.quantity, 0);
  }, [returnInventory]);

  const totalAllItems = totalBasicItems + totalSubItems + totalReturnQty;

  const q = searchTerm.trim().toLowerCase();

  // Helper form functions
  const focusNextInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      const form = input.form || input.closest("form");
      if (form) {
        const elements = Array.from(form.elements);
        const index = elements.indexOf(input);
        const next = elements[index + 1] as HTMLElement;
        if (next) {
          next.focus();
        }
      }
    }
  };

  const clearZeroOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === "0") {
      e.target.value = "";
    }
  };

  // TableData for Basic Inventory: maps products into the customizable colors grid
  const tableData = useMemo(() => {
    return products
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.colors?.some(c => c.color.toLowerCase().includes(q)))
      .map(p => {
        const itemColors: Record<string, number> = {};
        colors.forEach(c => {
          const invItem = basicInventory.find(inv => inv.productId === p.id && inv.color === c);
          itemColors[c] = invItem ? invItem.quantity : 0;
        });
        return {
          id: p.id,
          model: p.name,
          colors: itemColors,
        };
      })
      .filter(row => Object.values(row.colors).some(v => v > 0) || !q);
  }, [products, basicInventory, colors, q]);

  // Filters for sub and returns
  const filteredSubInventory = useMemo(() => {
    return subInventory.filter(item => {
      const matchModel = item.productName.toLowerCase().includes(q);
      const matchColor = item.color.toLowerCase().includes(q);
      const matchSize = item.size.toLowerCase().includes(q);
      return !q || matchModel || matchColor || matchSize;
    });
  }, [subInventory, q]);

  const filteredReturnInventory = useMemo(() => {
    return returnInventory.filter(item => {
      const matchModel = item.productName.toLowerCase().includes(q);
      const matchColor = item.color.toLowerCase().includes(q);
      const matchSize = item.size.toLowerCase().includes(q);
      return !q || matchModel || matchColor || matchSize;
    });
  }, [returnInventory, q]);

  // Adjust Dialog Callback
  const handleCalibrateQuantity = () => {
    if (!showAdjustModal) return;
    const { type, productId, productName, color, size, index } = showAdjustModal;

    if (type === "basic" && productId && color && productName) {
      const copy = [...basicInventory];
      const idx = copy.findIndex(inv => inv.productId === productId && inv.color === color);
      const oldQty = idx !== -1 ? copy[idx].quantity : 0;
      if (idx !== -1) {
        copy[idx].quantity = adjustQty;
      } else {
        copy.push({
          productId,
          productName,
          color,
          quantity: adjustQty
        });
      }
      onSaveBasic(copy);
      logStockMovement(
        "MANUAL",
        productName,
        color,
        size || "",
        adjustQty - oldQty,
        "Manual Adjustment",
        "Local Application"
      );
    } else if (type === "sub" && typeof index === "number") {
      const copy = [...subInventory];
      const oldQty = copy[index].quantity;
      copy[index].quantity = adjustQty;
      onSaveSub(copy);
      logStockMovement(
        "MANUAL",
        copy[index].productName,
        copy[index].color,
        copy[index].size,
        adjustQty - oldQty,
        "Manual Adjustment",
        "Local Application"
      );
    } else if (type === "return" && typeof index === "number") {
      const copy = [...returnInventory];
      const oldQty = copy[index].quantity;
      copy[index].quantity = adjustQty;
      onSaveReturn(copy);
      logStockMovement(
        copy[index].orderId || "MANUAL",
        copy[index].productName,
        copy[index].color,
        copy[index].size,
        adjustQty - oldQty,
        "Manual Adjustment",
        "Local Application"
      );
    }
    setMovements(getStockMovements());
    setShowAdjustModal(null);
  };

  // Execute Quantity Transfer between locations
  const executeQuantityTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetProd || transferQty <= 0) return;

    const prod = products.find(x => x.id === transferTargetProd);
    if (!prod) return;

    if (transferFrom === "1") {
      const basicCopy = [...basicInventory];
      const subCopy = [...subInventory];

      const bIdx = basicCopy.findIndex(x => x.productId === transferTargetProd && x.color === transferColor);
      if (bIdx === -1 || basicCopy[bIdx].quantity < transferQty) {
        alert(
          lang === "ar" 
            ? "الكمية المطلوبة غير متوفرة في المخزون الأساسي!" 
            : "Requested transfer quantity is unavailable in basic inventory!"
        );
        return;
      }

      // Deduct basic
      basicCopy[bIdx].quantity -= transferQty;

      // Add to sub
      const sIdx = subCopy.findIndex(x => x.productId === transferTargetProd && x.color === transferColor && x.size === transferSize);
      if (sIdx !== -1) {
        subCopy[sIdx].quantity += transferQty;
      } else {
        subCopy.push({
          productId: transferTargetProd,
          productName: prod.name,
          color: transferColor,
          size: transferSize,
          quantity: transferQty
        });
      }

      onSaveBasic(basicCopy);
      onSaveSub(subCopy);
    } else {
      const basicCopy = [...basicInventory];
      const subCopy = [...subInventory];

      const sIdx = subCopy.findIndex(x => x.productId === transferTargetProd && x.color === transferColor && x.size === transferSize);
      if (sIdx === -1 || subCopy[sIdx].quantity < transferQty) {
        alert(
          lang === "ar" 
            ? "الكمية المطلوبة غير متوفرة في المخزون الفرعي!" 
            : "Requested transfer quantity is unavailable in sub inventory!"
        );
        return;
      }

      // Deduct sub
      subCopy[sIdx].quantity -= transferQty;

      // Add basic
      const bIdx = basicCopy.findIndex(x => x.productId === transferTargetProd && x.color === transferColor);
      if (bIdx !== -1) {
        basicCopy[bIdx].quantity += transferQty;
      } else {
        basicCopy.push({
          productId: transferTargetProd,
          productName: prod.name,
          color: transferColor,
          quantity: transferQty
        });
      }

      onSaveBasic(basicCopy);
      onSaveSub(subCopy);
    }

    setShowTransferModal(false);
    setTransferTargetProd("");
    setTransferQty(1);
  };

  const isRtl = lang === "ar";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {getsLabel("inventory", "إدارة المخزون الذكية", "Gestion des Stocks", "Storage & Inventory")}
        </h1>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Transfer button */}
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:scale-[1.01] active:scale-[0.99] transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md border border-transparent"
          >
            <ArrowRightLeft size={14} />
            <span>{getsLabel("invTransferBtn", "ترحيل ونقل مخزون", "Transférer les volumes", "Route Stock")}</span>
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? "right-3" : "left-3"} pointer-events-none`} style={{ color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className={`py-1.5 rounded-lg border text-sm outline-none w-56 ${isRtl ? "pr-9 pl-3" : "pl-9 pr-3"}`}
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder={lang === 'ar' ? 'بحث...' : lang === 'fr' ? 'Recherche...' : 'Search...'} 
            />
          </div>
        </div>
      </div>

      {/* TABLE 1: Basic Inventory (product × colors grid) */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Package size={18} className="text-blue-500" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            🔹 {getsLabel("invTabBasic", "المخزون الأساسي (Basic)", "Stock Principal", "Major Holding Store")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap sticky ${isRtl ? "right-0" : "left-0"} bg-inherit z-15`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invProductModel", "موديل المنتج", "Modèle", "Item Model")}
                </th>
                {colors.map(c => (
                  <th key={c} className="px-2 py-2.5 text-xs font-semibold text-center whitespace-nowrap min-w-[60px]" style={{ color: 'var(--text-secondary)' }}>{c}</th>
                ))}
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("totalAuto", "المجموع التلقائي", "Moyenne / Total", "Total Auto")}
                </th>
                <th className="px-2 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={colors.length + 3} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {searchTerm.trim() 
                      ? (lang === 'ar' ? 'لا توجد نتائج مطابقة' : lang === 'fr' ? 'Aucun résultat' : 'No results') 
                      : (lang === 'ar' ? 'لا توجد منتجات مسجلة' : lang === 'fr' ? 'Aucun produit' : 'No products')
                    }
                  </td>
                </tr>
              ) : (
                tableData.map(item => {
                  const total = (Object.values(item.colors) as number[]).reduce((a, b) => a + b, 0);
                  const prod = products.find(p => p.id === item.id);
                  return (
                    <tr key={item.model} className="border-b hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                      <td className={`px-3 py-2.5 font-medium text-sm sticky ${isRtl ? "right-0" : "left-0"} z-10`} style={{ backgroundColor: 'var(--bg-card)' }}>{item.model}</td>
                      {colors.map(c => {
                        const qty = item.colors[c] ?? 0;
                        return (
                          <td key={c} className="px-2 py-2.5 text-center text-sm">
                            <button
                              onClick={() => {
                                setShowAdjustModal({
                                  type: "basic",
                                  productId: item.id,
                                  productName: item.model,
                                  color: c,
                                  label: `${item.model} — ${c}`
                                });
                                setAdjustQty(qty);
                              }}
                              className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-500 hover:underline transition-all cursor-pointer focus:outline-none"
                              title={getsLabel("invAddManual", "تعديل الكمية يدوياً", "Ajuster la quantité", "Calibrate stock balances")}
                            >
                              {qty}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-bold text-sm bg-slate-50/10 dark:bg-slate-900/10">{total}</td>
                      <td className="px-2 py-2.5 text-center">
                        {(() => {
                          const hasPOs = invoices.some(po => po.items?.some((it: any) => it.productName === item.model));
                          return hasPOs ? (
                            <span className="inline-block p-1.5 text-gray-300 dark:text-slate-600 cursor-not-allowed" title={
                              lang === 'ar' ? 'لا يمكن الحذف — يوجد فواتير بهذا المنتج' :
                              lang === 'fr' ? 'Suppression impossible — des factures existent pour ce produit' :
                              'Cannot delete — invoices exist for this product'
                            }>
                              <Trash2 size={14} />
                            </span>
                          ) : (
                            <button 
                              onClick={() => {
                                if (lang === 'ar' ? confirm(`حذف "${item.model}" نهائياً؟`) :
                                    lang === 'fr' ? confirm(`Supprimer "${item.model}" définitivement ?`) :
                                    confirm(`Delete "${item.model}" permanently?`)) {
                                  if (onSoftDeleteProduct && prod) {
                                    onSoftDeleteProduct(prod.id);
                                  }
                                }
                              }} 
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-500 transition-colors" 
                              title={getsLabel("btnDelete", "حذف نهائي", "Supprimer", "Delete")}
                            >
                              <Trash2 size={14} />
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 2: Sub Inventory (auto, read-only) — matches invoice format (model, color, size, qty) */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Package size={18} className="text-yellow-500" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            🔹 {getsLabel("invTabSub", "المخزون الفرعي (Sub)", "Stock Collaborateurs / Sub", "Secondary Sub Division")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invProductModel", "موديل المنتج", "Modèle", "Item Model")}
                </th>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("orderColor", "اللون", "Couleur", "Color Palette")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("orderSize", "المقاس", "Taille", "Size Accent")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invQuantity", "الكمية المتوفرة", "Quantité Disponible", "Net Volume Hold")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap w-24 hover:underline" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("tableActions", "الخيارات", "Actions", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSubInventory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {searchTerm.trim() ? (lang === 'ar' ? 'لا توجد نتائج' : lang === 'fr' ? 'Aucun résultat' : 'No results') : '—'}
                  </td>
                </tr>
              ) : (
                filteredSubInventory.map((item, idx) => (
                  <tr key={`${item.productId}-${item.color}-${item.size}-${idx}`} className="border-b hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-3 py-2.5 font-medium text-sm">{item.productName}</td>
                    <td className="px-3 py-2.5 text-sm">{item.color}</td>
                    <td className="px-3 py-2.5 text-sm text-center font-semibold">{item.size}</td>
                    <td className="px-3 py-2.5 text-sm text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => {
                          setShowAdjustModal({
                            type: "sub",
                            index: subInventory.findIndex(x => x.productId === item.productId && x.color === item.color && x.size === item.size),
                            label: `${item.productName} — ${item.color} [${item.size}]`
                          });
                          setAdjustQty(item.quantity);
                        }}
                        className="p-1 rounded text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all font-semibold text-xs"
                      >
                        <Edit2 size={13} className="inline mr-0.5 ml-0.5" />
                        <span>{getsLabel("btnUpdate", "تعديل", "Ajuster", "Adjust")}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 3: Return Inventory */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <RotateCcw size={18} className="text-red-500" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            🔹 {getsLabel("invTabReturn", "مخزون الإرجاع (Returns)", "Stock des Retours", "Re-entry returned hold")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("orderId", "رقم الطلبية", "ID Commande", "Order Reference")}
                </th>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invProductModel", "موديل المنتج", "Modèle", "Item Model")}
                </th>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("orderColor", "اللون", "Couleur", "Color Palette")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("orderSize", "المقاس", "Taille", "Size Accent")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invQuantity", "الكمية المتوفرة", "Quantité Disponible", "Net Volume Hold")}
                </th>
                <th className="px-2 py-2.5 w-24 text-center" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("tableActions", "العمليات", "Actions", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredReturnInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {searchTerm.trim() ? (lang === 'ar' ? 'لا توجد نتائج' : lang === 'fr' ? 'Aucun résultat' : 'No results') : '—'}
                  </td>
                </tr>
              ) : (
                filteredReturnInventory.map((item, idx) => {
                  const itemKey = `${item.orderId || ''}-${item.productName}-${item.color}-${item.size}-${idx}`;
                  return (
                    <tr key={itemKey} className="border-b hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-3 py-2.5 text-sm font-mono text-slate-500">#{item.orderId || '-'}</td>
                      <td className="px-3 py-2.5 font-medium text-sm">{item.productName}</td>
                      <td className="px-3 py-2.5 text-sm">{item.color}</td>
                      <td className="px-3 py-2.5 text-sm text-center font-semibold">{item.size}</td>
                      <td className="px-3 py-2.5 text-sm text-center font-medium">
                        {editQty?.id === itemKey ? (
                          <div className="flex items-center justify-center gap-1">
                            <input 
                              type="number" 
                              min="0" 
                              value={editQty.qty} 
                              onChange={e => setEditQty({ id: itemKey, qty: Number(e.target.value) })} 
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-16 px-1.5 py-0.5 rounded border text-xs text-center outline-none bg-transparent"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                            <button 
                              onClick={() => {
                                const realIdx = returnInventory.findIndex(r => r.productName === item.productName && r.color === item.color && r.size === item.size && r.orderId === item.orderId);
                                if (realIdx === -1) return;
                                handleSaveReturnQty(item, editQty.qty);
                                setEditQty(null);
                              }} 
                              className="p-0.5 text-green-500 hover:text-green-600 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setEditQty(null)} 
                              className="p-0.5 text-red-400 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                            {item.quantity}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex gap-1 justify-center">
                          <button 
                            onClick={() => setEditQty({ id: itemKey, qty: item.quantity })} 
                            className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-400 transition-all" 
                            title={getsLabel("btnUpdate", "تعديل", "Modifier", "Adjust")}
                          >
                            <Edit2 size={13} />
                          </button>
                          
                          <button 
                            onClick={() => {
                              if (lang === 'ar' ? confirm('حذف هذا العنصر من مخزون الإرجاع؟') : lang === 'fr' ? confirm('Supprimer cet élément du stock retour ?') : confirm('Delete this item from return inventory?')) {
                                handleDeleteReturnItem(item);
                              }
                            }} 
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all" 
                            title={getsLabel("btnDelete", "حذف", "Supprimer", "Delete")}
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* TABLE 4: Consolidated Stock Totals Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Package size={18} className="text-purple-500" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            🔹 {getsLabel("consolidatedTableTitle", "جدول مجاميع كميات الموديلات في كل المستودعات", "Tableau de Synthèse et Total Général par Modèle", "Consolidated Totals Ledger per Model")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className={`px-3 py-2.5 text-xs font-semibold ${isRtl ? "text-right" : "text-left"} whitespace-nowrap`} style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("invProductModel", "موديل المنتج", "Modèle", "Item Model")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("basicWarehouse", "المستودع الرئيسي", "Dépôt Principal (Basic)", "Basic Warehouse")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("subWarehouse", "المستودع الفرعي", "Dépôt Collaborateurs (Sub)", "Sub Warehouse")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("returnWarehouse", "مستودع المرتجعات", "Stock Retours (Returns)", "Returns Warehouse")}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap bg-slate-500/5" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("combinedTotalGrand", "إجمالي الكمية الكلي", "Total Général Consolidé", "Combined Grand Total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {products
                .filter(p => !q || p.name.toLowerCase().includes(q))
                .map(p => {
                  const basicSum = basicInventory.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantity, 0);
                  const subSum = subInventory.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantity, 0);
                  const returnSum = returnInventory.filter(item => item.productName === p.name).reduce((sum, item) => sum + item.quantity, 0);
                  const totalCombined = basicSum + subSum + returnSum;
                  const isCriticalLow = totalCombined < 10;

                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-3 py-2.5 font-bold text-sm">{p.name}</td>
                      <td className="px-3 py-2.5 text-sm text-center font-mono text-slate-500 font-medium">
                        {basicSum}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-center font-mono text-slate-500 font-medium">
                        {subSum}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-center font-mono text-slate-500 font-medium">
                        {returnSum}
                      </td>
                      <td className={`px-3 py-2.5 text-sm text-center font-mono font-black ${
                        isCriticalLow 
                          ? 'text-red-500 dark:text-red-400 font-extrabold animate-pulse' 
                          : 'text-indigo-600 dark:text-indigo-400'
                      } bg-slate-500/5`}>
                        {totalCombined} {isCriticalLow && (lang === "ar" ? " (قليل!)" : " (Low!)")}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLE 5: Stock Summary Box (Dynamic Stats Grid) */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Package size={18} className="text-purple-500" />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            🔹 {getsLabel("table4", "خلاصة حركة المخزون والقطع", "Mouvements & Synthèse Générale", "Stock Movements Summary")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4">
          
          <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {getsLabel("totalStockLabel", "إجمالي جميع المخازن", "Stock total consolidé", "Total Aggregated Stocks")}
            </p>
            <p className="text-2xl font-black mt-2" style={{ color: 'var(--text-primary)' }}>
              {totalAllItems.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          
          <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <p className="text-xs font-semibold text-blue-400">
              {getsLabel("basicInvLabel", "المخزون الأساسي", "Stock Principal (Basic)", "Major Wholesaler Stocks")}
            </p>
            <p className="text-2xl font-black text-blue-500 mt-2">
              {totalBasicItems.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          
          <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <p className="text-xs font-semibold text-yellow-500">
              {getsLabel("subInvLabel", "المخزون الفرعي", "Stock Collaborateurs (Sub)", "Secondary Sub Stocks")}
            </p>
            <p className="text-2xl font-black text-yellow-500 mt-2">
              {totalSubItems.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          
          <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <p className="text-xs font-semibold text-red-500">
              {getsLabel("returnsTableLabel", "مخزون المرتجعات", "Stock des Retours", "Unallocated Return Pools")}
            </p>
            <p className="text-2xl font-black text-red-500 mt-2">
              {totalReturnQty.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

        </div>
      </div>

      {/* TABLE 6: Stock Movements Journal (جدول سجّل حركات المخزّن) */}
      <div 
        id="stock-movements-journal"
        className="rounded-2xl border overflow-hidden mt-6 text-right transition-all duration-300" 
        style={{ 
          backgroundColor: 'var(--bg-card)', 
          borderColor: 'var(--border-color)',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.2)' 
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          
          <div className="flex items-center gap-2 justify-end self-end sm:self-auto order-1">
            <RefreshCw 
              size={13} 
              className="text-[#6366f1] cursor-pointer hover:rotate-180 transition-all duration-500" 
              onClick={() => setMovements(getStockMovements())} 
            />
            <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              📝 {getsLabel("movementsJournalHeader", "سجل حركة المخزون التفصيلي", "Journal des Mouvements de Stock", "Detailed Stock Movements Journal")}
            </h3>
          </div>

          <p className="text-xs text-slate-400 font-mono self-start sm:self-auto order-2">
            {getsLabel("movementsCount", `إجمالي العمليات المسجلة: ${movements.length}`, `Total opérations: ${movements.length}`, `Recorded Actions: ${movements.length}`)}
          </p>

        </div>

        {movements.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-500 font-medium">
            ☕ {getsLabel("noMovementsMsg", "لا توجد حركات مخزون مسجلة بعد. سيتم تسجيل أي عملية إنشاء أو تعديل أو إرجاع للطلبات هنا تلقائياً.", "Aucun mouvement de stock enregistré.", "No stock movements recorded yet.")}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 scrollbar-thin">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#18181b]/55 sticky top-0" style={{ color: 'var(--text-secondary)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMTime", "الوقت والتاريخ", "Date & Time", "Date & Time")}</th>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMOrderId", "معرف الطلبية", "ID Commande", "Order ID")}</th>
                  <th className="px-4 py-3 font-bold">{getsLabel("colMProduct", "المنتج", "Produit", "Product")}</th>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMColorSize", "اللون / المقاس", "Couleur / Taille", "Color / Size")}</th>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMQty", "التغيير في الكمية", "Delta Quantité", "Qty Delta")}</th>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMType", "نوع الحركة", "Type Opération", "Movement Type")}</th>
                  <th className="px-4 py-3 font-bold text-center">{getsLabel("colMSource", "المصدر", "Source", "Source")}</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                {movements.map((mv) => {
                  const isPositive = mv.quantityChange > 0;
                  
                  // Arabic translation labels for movement types
                  let arMvTypeLabel = mv.movementType;
                  if (mv.movementType === "New Order") arMvTypeLabel = "طلب مبيعات جديد 🛒";
                  else if (mv.movementType === "Order Update") arMvTypeLabel = "تعديل طلبية ✏️";
                  else if (mv.movementType === "Order Delete") arMvTypeLabel = "إلغاء واستعادة 🗑️";
                  else if (mv.movementType === "Return") arMvTypeLabel = "مرتجع مبيعات ⚠️";
                  else if (mv.movementType === "Manual Adjustment") arMvTypeLabel = "ضبط يدوي ⚙️";

                  return (
                    <tr 
                      key={mv.id} 
                      className="hover:bg-zinc-900/25 transition-all text-slate-300 font-medium"
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                    >
                      {/* Date & Time */}
                      <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-[10.5px]">
                        {new Date(mv.date).toLocaleString(undefined, { 
                          month: "short", 
                          day: "numeric", 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </td>

                      {/* Order ID */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-bold border ${
                            mv.orderId === "MANUAL" 
                              ? "bg-zinc-800/20 text-zinc-400 border-zinc-700/30" 
                              : "bg-indigo-500/10 text-indigo-400 border-indigo-500/15"
                          }`}
                        >
                          {mv.orderId}
                        </span>
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3 truncate max-w-[180px] font-bold text-white">
                        {mv.productName}
                      </td>

                      {/* Color & Size */}
                      <td className="px-4 py-3 text-center whitespace-nowrap text-slate-400">
                        {mv.color} {mv.size ? `/ ${mv.size}` : ""}
                      </td>

                      {/* Qty Change Delta */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          className={`font-black font-mono text-center text-sm inline-block min-w-[35px] py-0.5 px-2 rounded-md ${
                            isPositive 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" 
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                          }`}
                        >
                          {isPositive ? `+${mv.quantityChange}` : mv.quantityChange}
                        </span>
                      </td>

                      {/* Movement Type badge */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          className={`px-2.5 py-0.8 rounded-full text-[10px] font-bold ${
                            mv.movementType === "New Order" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                            mv.movementType === "Order Update" ? "bg-zinc-700/25 text-slate-300 border border-zinc-700/30" :
                            mv.movementType === "Order Delete" ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" :
                            mv.movementType === "Return" ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" :
                            "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                          }`}
                        >
                          {lang === "ar" ? arMvTypeLabel : mv.movementType}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 text-center whitespace-nowrap text-[10px] text-zinc-400">
                        <span className="font-bold select-none border border-zinc-800 bg-zinc-950/40 py-0.5 px-2 rounded">
                          {mv.source === "Google Sheets Sync" ? (lang === "ar" ? "مزامنة Sheets 📊" : "Sheets Sync") : (lang === "ar" ? "الموقع 🛒" : "Local Portal")}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADJUST QUANTITY OVERLAY POPUP */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#09090b] border border-slate-800 shadow-2xl rounded-2xl p-5 relative text-right" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            
            <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              📊 {getsLabel("invAddManual", "تعديل الكمية يدوياً", "Ajuster la quantité", "Configure Stock Balance")}
            </h3>
            
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              {getsLabel("adjustDescLabel", "ضبط الحصيلة المادية للعنصر:", "Calibrer le niveau réel pour complet:", "Modify physical quantity balance for absolute record:")}
              <div className="font-bold text-indigo-500 mt-1">{showAdjustModal.label}</div>
            </p>

            <input
              type="number"
              min="0"
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-center text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 bg-transparent"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />

            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowAdjustModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
              </button>
              <button 
                onClick={handleCalibrateQuantity}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                {getsLabel("btnSave", "حفظ وتعديل", "Sauvegarder", "Apply Changes")}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TRANSFER ROUTING MODAL POPUP */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md border shadow-2xl rounded-2xl p-6 relative" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            
            <div className={`flex justify-between items-center pb-3 border-b mb-4 ${isRtl ? "flex-row" : "flex-row-reverse"}`} style={{ borderColor: 'var(--border-color)' }}>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-200 transition-colors">✕</button>
              <h3 className="text-base font-bold flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                <span>{getsLabel("invTransferTitle", "ترحيل ونقل مخزون داخلي", "Transfert Opérationnel Inter-Dépôt", "Operational Stock Transfer")}</span>
              </h3>
            </div>

            <form onSubmit={executeQuantityTransfer} className="space-y-4 text-xs">
              
              {/* Route Direction */}
              <div>
                <label className="block font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("transferRouteLabel", "اتجاه ومسار النقل", "Direction du Routage", "Transfer Routing Direction")}
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value as any)}
                  className="w-full border rounded-lg px-3 py-2 bg-transparent text-sm active:bg-gray-800"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="1" className="bg-slate-900 text-white">
                    {getsLabel("t1", "من المخزون الأساسي ➔ إلى المخزون الفرعي", "Du Dépôt Principal ➔ Au Dépôt Collaborateurs", "From Major holding ➔ To Sub holding")}
                  </option>
                  <option value="2" className="bg-slate-900 text-white">
                    {getsLabel("t2", "من المخزون الفرعي ➔ إلى المخزون الأساسي", "Du Dépôt Collaborateurs ➔ Au Dépôt Principal", "From Sub holding ➔ To Major holding")}
                  </option>
                </select>
              </div>

              {/* Product Model */}
              <div>
                <label className="block font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("transferTargetLabel", "الموديل المراد نقله", "Modèle de Vêtement", "Target Product Design")}
                </label>
                <select
                  value={transferTargetProd}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setTransferTargetProd(pid);
                    const pr = products.find(x => x.id === pid);
                    if (pr) {
                      if (pr.colors?.length > 0) setTransferColor(pr.colors[0].color);
                      if (pr.sizes?.length > 0) setTransferSize(pr.sizes[0]);
                    }
                  }}
                  className="w-full border rounded-lg px-3 py-2 bg-transparent text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  required
                >
                  <option value="" className="bg-slate-900 text-white">{getsLabel("selectModelLabel", "— اختر الموديل —", "— Choisir un modèle —", "— Select Model —")}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>
                  ))}
                </select>
              </div>

              {transferTargetProd && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Color */}
                  <div>
                    <label className="block font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {getsLabel("orderColor", "اللون", "Couleur", "Color")}
                    </label>
                    <select
                      value={transferColor}
                      onChange={(e) => setTransferColor(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-transparent text-sm"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {products.find(x => x.id === transferTargetProd)?.colors?.map((c, i) => (
                        <option key={i} value={c.color} className="bg-slate-900 text-white">{c.color}</option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {getsLabel("orderSize", "المقاس", "Taille", "Size")}
                    </label>
                    <select
                      value={transferSize}
                      onChange={(e) => setTransferSize(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-transparent text-sm"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {products.find(x => x.id === transferTargetProd)?.sizes?.map((s, i) => (
                        <option key={i} value={s} className="bg-slate-900 text-white">{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {getsLabel("transferQtyLabel", "الكمية المراد ترحيلها", "Nombre d'unités à déplacer", "Transfer Units Count")}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                  className="w-full border rounded-lg px-3 py-2 text-center text-base font-bold font-mono bg-transparent"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md hover:scale-[1.01] transition-all"
                >
                  {getsLabel("btnConfirmTransfer", "تأكيد الترحيل النهائي", "Confirmer le Transfert", "Execute Transfer")}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );

  // Helper local function to save modified return item quantity
  function handleSaveReturnQty(item: ReturnInventoryItem, newQty: number) {
    const updated = returnInventory.map(r => 
      (r.productName === item.productName && r.color === item.color && r.size === item.size && r.orderId === item.orderId) 
        ? { ...r, quantity: newQty } 
        : r
    );
    onSaveReturn(updated);
  }

  // Helper local function to delete return item
  function handleDeleteReturnItem(item: ReturnInventoryItem) {
    const updated = returnInventory.filter(r => 
      !(r.productName === item.productName && r.color === item.color && r.size === item.size && r.orderId === item.orderId)
    );
    onSaveReturn(updated);
  }
}
