/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Product, LanguageType, ProductColorQuantity, 
  Supplier, SupplierInvoice, SupplierPurchaseItem, BasicInventoryItem, SubInventoryItem 
} from "../types";
import { translations } from "../translations";
import { 
  Plus, Trash2, Edit2, Sliders, Check, X, ArrowUpRight, 
  ShoppingCart, Package, Printer, FileText, Bookmark, ClipboardList, ShoppingBag, PlusCircle, Landmark, Sparkles
} from "lucide-react";
import { mutateInventoryForPurchase, revertInventoryForPurchase } from "../storageUtils";

interface ProductsViewProps {
  products: Product[];
  onSaveProducts: (arr: Product[]) => void;
  lang: LanguageType;
  customColorsList: string[];
  onSoftDeleteProduct: (id: string) => void;
  onTriggerNotification: (msg: string) => void;
  suppliers: Supplier[];
  onSaveSuppliers: (arr: Supplier[]) => void;
  invoices: SupplierInvoice[];
  onSaveInvoices: (arr: SupplierInvoice[]) => void;
  basicInventory: BasicInventoryItem[];
  onSaveBasic: (arr: BasicInventoryItem[]) => void;
  subInventory: SubInventoryItem[];
  onSaveSub: (arr: SubInventoryItem[]) => void;
  onSoftDeleteInvoice: (id: string) => void;
}

export default function ProductsView({
  products,
  onSaveProducts,
  lang,
  customColorsList,
  onSoftDeleteProduct,
  onTriggerNotification,
  suppliers,
  onSaveSuppliers,
  invoices,
  onSaveInvoices,
  basicInventory,
  onSaveBasic,
  subInventory,
  onSaveSub,
  onSoftDeleteInvoice
}: ProductsViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // Navigation tab for unified product workspace
  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "catalog">("invoices");

  // Catalog Section Form States
  const [showCatalogAddForm, setShowCatalogAddForm] = useState(false);
  const [catalogEditingId, setCatalogEditingId] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [wholesaleCost, setWholesaleCost] = useState(1000);
  const [wholesaleProfitPct, setWholesaleProfitPct] = useState(20);
  const [retailCost, setRetailCost] = useState(1000);
  const [retailProfitPct, setRetailProfitPct] = useState(50);
  const [sizesList, setSizesList] = useState<string[]>(["M", "L", "XL"]);
  const [colorsTable, setColorsTable] = useState<ProductColorQuantity[]>([
    { color: customColorsList[0] || "Black (أسود)", quantity: 50 }
  ]);
  const [tempColor, setTempColor] = useState(customColorsList[0] || "Black (أسود)");
  const [tempColorQty, setTempColorQty] = useState(20);

  // Form helpers
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

  // Safe loading custom colors
  const colorList = useMemo(() => {
    return customColorsList.length > 0 ? customColorsList : [
      "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
      "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)"
    ];
  }, [customColorsList]);

  // Invoice Section Form States (from user provided specifications)
  const today = new Date().toISOString().split('T')[0];
  const [poDate, setPoDate] = useState(today);
  const [poSupplier, setPoSupplier] = useState('');
  const [poInvoiceNo, setPoInvoiceNo] = useState('');
  const [poItems, setPoItems] = useState<any[]>([{ productName: '', color: '', size: '', quantity: 1, costPrice: 0, wholesalePct: 0, retailPct: 0, targetTable: "1" }]);
  const [poEditId, setPoEditId] = useState<string | null>(null);
  const [poPaymentAmount, setPoPaymentAmount] = useState(0);
  const [poPaymentEditId, setPoPaymentEditId] = useState<string | null>(null);
  const [poPaymentModalOpen, setPoPaymentModalOpen] = useState(false);
  const [poPaymentInput, setPoPaymentInput] = useState(0);
  const [poPaymentDateInput, setPoPaymentDateInput] = useState(poDate);
  const [newColorInput, setNewColorInput] = useState('');
  const [showColorInput, setShowColorInput] = useState<number | null>(null);
  const [poDeleteId, setPoDeleteId] = useState<string | null>(null);
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPaySupplier, setQuickPaySupplier] = useState('');
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayDate, setQuickPayDate] = useState(today);

  // Dynamic next invoice number loader
  useEffect(() => {
    if (!poInvoiceNo) {
      const maxInvoiceId = invoices.reduce((max, inv) => {
        const val = parseInt(inv.id.replace(/\D/g, "")) || 0;
        return val > max ? val : max;
      }, 1000);
      setPoInvoiceNo((maxInvoiceId + 1).toString());
    }
  }, [invoices, poInvoiceNo]);

  // Translation helpers
  const getsLabel = (key: string, arText: string, frText: string, enText: string) => {
    if (lang === "ar") return arText;
    if (lang === "fr") return frText;
    return enText;
  };

  const currencyLabel = lang === "ar" ? "دج" : lang === "fr" ? "DA" : "DZD";

  // Previous Debts calculations per supplier
  const poSupplierDebt = useMemo(() => {
    if (!poSupplier) return 0;
    return invoices
      .filter(inv => inv.supplierName === poSupplier)
      .reduce((s, inv) => {
        const paid = (inv.payments || []).reduce((ps, p) => ps + p.amount, 0);
        return s + inv.totalAmount - paid;
      }, 0);
  }, [poSupplier, invoices]);

  const poSupplierPayments = useMemo(() => {
    if (!poSupplier) return [];
    const supp = suppliers.find(s => s.name === poSupplier);
    return (supp as any)?.payments || [];
  }, [poSupplier, suppliers]);

  const poUpdateItem = (idx: number, data: Partial<any>) => {
    setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, ...data } : item));
  };

  const handlePoWsPct = (idx: number, pct: number) => {
    const rounded = Math.round(pct * 10) / 10;
    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const cost = item.costPrice;
      return { 
        ...item, 
        wholesalePct: rounded, 
        wholesalePrice: cost > 0 ? Math.round((cost + cost * rounded / 100) * 10) / 10 : 0 
      };
    }));
  };

  const handlePoWsPrice = (idx: number, price: number) => {
    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const cost = item.costPrice;
      return { 
        ...item, 
        wholesalePrice: price, 
        wholesalePct: cost > 0 ? Math.round(((price - cost) / cost) * 100 * 10) / 10 : 0 
      };
    }));
  };

  const handlePoRtPct = (idx: number, pct: number) => {
    const rounded = Math.round(pct * 10) / 10;
    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const cost = item.costPrice;
      return { 
        ...item, 
        retailPct: rounded, 
        retailPrice: cost > 0 ? Math.round((cost + cost * rounded / 100) * 10) / 10 : 0 
      };
    }));
  };

  const handlePoRtPrice = (idx: number, price: number) => {
    setPoItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const cost = item.costPrice;
      return { 
        ...item, 
        retailPrice: price, 
        retailPct: cost > 0 ? Math.round(((price - cost) / cost) * 100 * 10) / 10 : 0 
      };
    }));
  };

  const poAddItem = () => {
    setPoItems(prev => [...prev, { productName: '', color: '', size: '', quantity: 1, costPrice: 0, wholesalePct: 0, retailPct: 0, targetTable: "1" }]);
  };

  const poRemoveItem = (idx: number) => {
    if (poItems.length <= 1) return;
    setPoItems(prev => prev.filter((_, i) => i !== idx));
  };

  const poCalcTotal = () => { 
    return poItems.reduce((s, item) => s + (Number(item.costPrice) || 0) * (Number(item.quantity) || 0), 0); 
  };

  const poResetForm = () => {
    setPoDate(today);
    setPoSupplier('');
    setPoItems([{ productName: '', color: '', size: '', quantity: 1, costPrice: 0, wholesalePct: 0, retailPct: 0, targetTable: "1" }]);
    
    const maxInvoiceId = invoices.reduce((max, inv) => {
      const val = parseInt(inv.id.replace(/\D/g, "")) || 0;
      return val > max ? val : max;
    }, 1000);
    setPoInvoiceNo((maxInvoiceId + 1).toString());

    setPoEditId(null);
    setPoPaymentAmount(0);
    setPoPaymentEditId(null);
    setPoPaymentModalOpen(false);
    setPoPaymentInput(0);
    setPoPaymentDateInput(today);
  };

  // Submit purchase order invoice
  const poSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplier.trim()) { 
      onTriggerNotification(lang === 'ar' ? 'يرجى اختيار المورد' : 'Select supplier'); 
      return; 
    }
    for (const item of poItems) {
      if (!item.productName.trim() || !item.color || item.quantity < 1) { 
        onTriggerNotification(lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Fill all fields'); 
        return; 
      }
      if (item.targetTable === "2" && !item.size) { 
        onTriggerNotification(lang === 'ar' ? 'الجدول الفرعي يتطلب كتابة المقاس للقطعة' : 'Table 2 requires size'); 
        return; 
      }
    }

    // Resolve supplier ID
    const currentSupplier = suppliers.find(s => s.name === poSupplier);
    const supplierId = currentSupplier ? currentSupplier.id : `supp-generated-${Date.now()}`;

    // Map items list to DB template structure
    const mappedItems: SupplierPurchaseItem[] = poItems.map((item, idx) => {
      const linkProd = products.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
      const pId = linkProd ? linkProd.id : `prod-auto-${Date.now()}-${idx}`;

      return {
        id: `it-${Date.now()}-${idx}`,
        productId: pId,
        productName: item.productName.trim(),
        color: item.color,
        size: item.size || "",
        quantity: Number(item.quantity) || 1,
        costPrice: Number(item.costPrice) || 0,
        wholesalePercentage: Number(item.wholesalePct) || 0,
        retailPercentage: Number(item.retailPct) || 0,
        sellingPrice: Number(item.wholesalePrice) || Number(item.costPrice) || 0,
        targetTable: item.targetTable as "1" | "2"
      };
    });

    const invoiceTotal = mappedItems.reduce((acc, current) => acc + (current.costPrice * current.quantity), 0);

    let updatedInvoices = [...invoices];
    if (poEditId) {
      // Revert stock balances of parent first
      const oldInvoice = invoices.find(x => x.id === poEditId);
      if (oldInvoice) {
        revertInventoryForPurchase(oldInvoice);
      }

      // Update in array
      updatedInvoices = updatedInvoices.map(inv => {
        if (inv.id === poEditId) {
          return {
            ...inv,
            date: poDate,
            supplierId,
            supplierName: poSupplier,
            items: mappedItems,
            totalAmount: invoiceTotal,
            updatedAt: new Date().toISOString()
          };
        }
        return inv;
      });

      // Apply new stock
      const parentInvoice = updatedInvoices.find(x => x.id === poEditId)!;
      mutateInventoryForPurchase(parentInvoice);

      onSaveInvoices(updatedInvoices);
      onTriggerNotification(lang === 'ar' ? 'تم تحديث الفاتورة والمخزون بنجاح' : 'Invoice modified successfully');
    } else {
      // Save new Invoice
      const newInvoice: SupplierInvoice = {
        id: poInvoiceNo.trim() || `po-${Date.now()}`,
        date: poDate,
        supplierId,
        supplierName: poSupplier,
        items: mappedItems,
        totalAmount: invoiceTotal,
        payments: poPaymentAmount > 0 ? [{ id: `pay-${Date.now()}`, date: poDate, amount: poPaymentAmount }] : [],
        createdAt: new Date().toISOString()
      };

      // Add to inventory
      mutateInventoryForPurchase(newInvoice);

      updatedInvoices.push(newInvoice);
      onSaveInvoices(updatedInvoices);

      // Save supplier payment link
      if (poPaymentAmount > 0 && currentSupplier) {
        onSaveSuppliers(suppliers.map(s => {
          if (s.id === currentSupplier.id) {
            const currentPayments = (s as any).payments || [];
            return {
              ...s,
              payments: [...currentPayments, { id: `pay-${Date.now()}`, date: poDate, amount: poPaymentAmount }]
            };
          }
          return s;
        }));
      }

      // Proactively merge new products into the official catalog index
      let updatedProducts = [...products];
      mappedItems.forEach(item => {
        const exists = updatedProducts.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
        if (!exists) {
          updatedProducts.push({
            id: item.productId,
            name: item.productName,
            wholesaleCostPrice: item.costPrice,
            wholesalePercentage: item.wholesalePercentage,
            wholesalePrice: item.sellingPrice || (item.costPrice + (item.costPrice * item.wholesalePercentage / 105)),
            retailCostPrice: item.costPrice,
            retailPercentage: item.retailPercentage,
            retailPrice: item.costPrice + (item.costPrice * item.retailPercentage / 100),
            colors: [{ color: item.color, quantity: item.quantity }],
            sizes: item.size ? [item.size] : ["M", "L", "XL"],
            createdAt: new Date().toISOString()
          });
        } else {
          // Verify color index mapping
          const colorsIndex = exists.colors.findIndex(c => c.color === item.color);
          let currentColors = [...exists.colors];
          if (colorsIndex === -1) {
            currentColors.push({ color: item.color, quantity: item.quantity });
          } else {
            currentColors[colorsIndex] = { ...currentColors[colorsIndex], quantity: currentColors[colorsIndex].quantity + item.quantity };
          }
          let currentSizes = [...exists.sizes];
          if (item.size && !currentSizes.includes(item.size)) {
            currentSizes.push(item.size);
          }
          const prodIndex = updatedProducts.findIndex(p => p.id === exists.id);
          updatedProducts[prodIndex] = {
            ...exists,
            colors: currentColors,
            sizes: currentSizes
          };
        }
      });
      onSaveProducts(updatedProducts);

      onTriggerNotification(lang === 'ar' ? 'تم تسجيل فاتورة الشراء وتنسيق المخزونات' : 'Invoice saved successfully');
    }

    poResetForm();
  };

  // Reprint / Print Supplier Purchase Invoice Layout
  const handlePrintPO = (po: SupplierInvoice) => {
    const win = window.open('', '_blank');
    if (!win) return;
    
    const supplier = suppliers.find(s => s.name === po.supplierName);
    const poPayments = po.payments || [];
    const totalPaid = poPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = po.totalAmount - totalPaid;

    const itemRows = po.items.map(item =>
      `<tr>
        <td>${item.productName}${item.color ? ` (${item.color})` : ''}${item.size ? ` - ${item.size}` : ''}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${item.costPrice.toLocaleString()} DZD</td>
        <td style="text-align:right">${(item.costPrice * item.quantity).toLocaleString()} DZD</td>
      </tr>`
    ).join('');

    const paymentRows = poPayments.length > 0 ? poPayments.map(p =>
      `<tr>
        <td>${p.date}</td>
        <td style="text-align:right">${p.amount.toLocaleString()} DZD</td>
      </tr>`
    ).join('') : `<tr><td colspan="2" style="text-align:center;color:#999">${lang === 'ar' ? 'لا توجد دفعات مسجلة' : 'No payments found'}</td></tr>`;

    win.document.write(`
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
      <head><title>FOU-${po.id}</title>
      <style>
        @page { margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { padding: 30px; color: #1a1a2e; max-width: 800px; margin: auto; }
        h1 { text-align: center; font-size: 20px; margin-bottom: 24px; border-bottom: 2px solid #1a1a2e; padding-bottom: 12px; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; gap: 8px; }
        .info div { line-height: 1.8; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th { background: #1a1a2e; color: white; padding: 8px 10px; font-size: 12px; }
        td { padding: 8px 10px; border-bottom: 1px solid #e9ecef; }
        tfoot td { font-weight: bold; border-top: 2px solid #1a1a2e; }
        .total-label { text-align: ${lang === 'ar' ? 'start' : 'end'}; }
        .total-value { text-align: right; color: #4f46e5; font-size: 16px; }
        .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
        .summary { margin-top: 20px; font-size: 14px; line-height: 2; }
        .summary div { display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 4px 0; }
        .summary .label { font-weight: bold; }
        .summary .paid { color: #10b981; }
        .summary .remaining { color: ${remaining > 0 ? '#ef4444' : '#10b981'}; font-weight: bold; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #6c757d; border-top: 1px solid #e9ecef; padding-top: 12px; }
      </style>
      </head><body>
        <h1>${lang === "ar" ? "فاتورة شراء السلع والتوريد" : "BONS D'ACHAT & DIRECTIVES DE RECEPTION"}</h1>
        <div class="info">
          <div>
            <strong>${lang === 'ar' ? 'اسم المورد' : 'Fournisseur'}:</strong> ${po.supplierName}<br>
            ${supplier?.phone ? `<strong>Tél:</strong> ${supplier.phone}<br>` : ''}
            ${supplier?.address ? `<strong>Adresse:</strong> ${supplier.address}` : ''}
          </div>
          <div style="text-align:${lang === 'ar' ? 'start' : 'end'}">
            <strong>N° Facture:</strong> INV-${po.id}<br>
            <strong>Date:</strong> ${po.date}
          </div>
        </div>
        <div class="section-title">${lang === 'ar' ? 'قائمة السلع والكميات المستقبلة' : 'Détail des pièces'}</div>
        <table>
          <thead><tr>
            <th>${lang === 'ar' ? 'المنتج والمواصفات' : 'Désignation'}</th>
            <th style="text-align:center">${lang === 'ar' ? 'الكمية' : 'Quantité'}</th>
            <th style="text-align:right">${lang === 'ar' ? 'سعر التكلفة' : 'P.U Cost'}</th>
            <th style="text-align:right">${lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr>
            <td colspan="3" class="total-label">${lang === 'ar' ? 'المجموع الكلي' : 'Total Général'}</td>
            <td class="total-value">${po.totalAmount.toLocaleString()} DZD</td>
          </tr></tfoot>
        </table>
        <div class="section-title">${lang === 'ar' ? 'دفعات الحساب والأقساط' : 'Acomptes versés'}</div>
        <table>
          <thead><tr>
            <th>Date</th>
            <th style="text-align:right">Montant</th>
          </tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
        <div class="summary">
          <div><span class="label">Total Brut:</span> <span>${po.totalAmount.toLocaleString()} DZD</span></div>
          <div><span class="label">Total Payé:</span> <span class="paid">${totalPaid.toLocaleString()} DZD</span></div>
          <div><span class="label">Unpaid Balance (Dette):</span> <span class="remaining">${remaining.toLocaleString()} DZD</span></div>
        </div>
        <div class="footer">${getsLabel("appName", "نظام تشغيل وإدارة المستودعات Corevia", "Système d'exploitation Corevia ERP", "Corevia ERP Enterprise Edition")}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const poStartEdit = (po: SupplierInvoice) => {
    setPoDate(po.date);
    setPoSupplier(po.supplierName);
    setPoInvoiceNo(po.id);
    setPoItems(po.items.map(i => ({
      productName: i.productName,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
      costPrice: i.costPrice,
      wholesalePct: i.wholesalePercentage || 0,
      wholesalePrice: i.sellingPrice || 0,
      retailPct: i.retailPercentage || 0,
      retailPrice: i.costPrice + (i.costPrice * (i.retailPercentage || 0) / 100),
      targetTable: i.targetTable || "1"
    })));
    setPoEditId(po.id);
    setActiveSubTab("invoices");
  };

  const poStartDelete = (po: SupplierInvoice) => {
    setPoDeleteId(po.id);
  };

  const poConfirmDelete = () => {
    if (!poDeleteId) return;
    onSoftDeleteInvoice(poDeleteId);
    setPoDeleteId(null);
  };

  // Computed Values formulas for general catalog
  const computedCatalogPrices = useMemo(() => {
    const wholesale = wholesaleCost + (wholesaleCost * wholesaleProfitPct / 100);
    const retail = retailCost + (retailCost * retailProfitPct / 100);

    return {
      wholesale: Math.round(wholesale),
      retail: Math.round(retail)
    };
  }, [wholesaleCost, wholesaleProfitPct, retailCost, retailProfitPct]);

  // Handle saving directly to universal catalog
  const handleSaveCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) return;

    const arr = [...products];

    if (catalogEditingId) {
      const idx = arr.findIndex(x => x.id === catalogEditingId);
      if (idx !== -1) {
        arr[idx] = {
          ...arr[idx],
          name: modelName,
          wholesaleCostPrice: wholesaleCost,
          wholesalePercentage: wholesaleProfitPct,
          wholesalePrice: computedCatalogPrices.wholesale,
          retailCostPrice: retailCost,
          retailPercentage: retailProfitPct,
          retailPrice: computedCatalogPrices.retail,
          colors: colorsTable,
          sizes: sizesList
        };
      }
      onTriggerNotification(lang === "ar" ? `تم تحديث المنتج ${modelName} بنجاح.` : `Adjusted design properties for ${modelName}`);
    } else {
      const newPid = `prod-${Date.now()}`;
      const newProduct: Product = {
        id: newPid,
        name: modelName,
        wholesaleCostPrice: wholesaleCost,
        wholesalePercentage: wholesaleProfitPct,
        wholesalePrice: computedCatalogPrices.wholesale,
        retailCostPrice: retailCost,
        retailPercentage: retailProfitPct,
        retailPrice: computedCatalogPrices.retail,
        colors: colorsTable,
        sizes: sizesList,
        createdAt: new Date().toISOString()
      };
      
      arr.unshift(newProduct);
      onTriggerNotification(lang === "ar" ? `تم تسجيل المنتج ${modelName} في الدليل.` : `Registered ${modelName} design parameters.`);
    }

    onSaveProducts(arr);
    resetCatalogForm();
  };

  const handleEditCatalogClick = (p: Product) => {
    setCatalogEditingId(p.id);
    setModelName(p.name);
    setWholesaleCost(p.wholesaleCostPrice);
    setWholesaleProfitPct(p.wholesalePercentage);
    setRetailCost(p.retailCostPrice);
    setRetailProfitPct(p.retailPercentage);
    setColorsTable(p.colors);
    setSizesList(p.sizes);
    setShowCatalogAddForm(true);
  };

  const resetCatalogForm = () => {
    setModelName("");
    setWholesaleCost(1000);
    setWholesaleProfitPct(20);
    setRetailCost(1000);
    setRetailProfitPct(50);
    setColorsTable([{ color: colorList[0] || "Black (أسود)", quantity: 50 }]);
    setSizesList(["M", "L", "XL"]);
    setCatalogEditingId(null);
    setShowCatalogAddForm(false);
  };

  const handleCreateColorRow = () => {
    if (colorsTable.some(c => c.color === tempColor)) {
      alert(lang === "ar" ? "هذا اللون مسجل مسبقاً لهذا المنتج" : "Color already mapped to this design.");
      return;
    }
    setColorsTable(prev => [...prev, { color: tempColor, quantity: tempColorQty }]);
    setTempColorQty(20);
  };

  const handleRemoveColorRow = (colVal: string) => {
    setColorsTable(prev => prev.filter(c => c.color !== colVal));
  };

  const handleToggleSize = (sz: string) => {
    if (sizesList.includes(sz)) {
      setSizesList(prev => prev.filter(x => x !== sz));
    } else {
      setSizesList(prev => [...prev, sz]);
    }
  };

  return (
    <div className="space-y-6 pt-16 md:pt-4" dir={isRtl ? "rtl" : "ltr"} id="products_workspace">
      
      {/* Tab Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#27272a] pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-500" />
            <span>{getsLabel("productsTitleTab", "إدارة وتوريد المنتجات", "Gestion des Modèles & Approvisionnements", "Products & Stock Sourcing")}</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {getsLabel("productsDescSubtitle", "التحكم في فواتير الشراء والأسعار التنافسية للأزياء والموديلات", "Facturation des achats auprès des grossistes et tarification", "Gross wholesale purchasing and retail pricing margins control room")}
          </p>
        </div>

        {/* Sub-tab selections */}
        <div className="flex bg-[#040406] border border-[#27272a] rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveSubTab("invoices")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "invoices" 
                ? "bg-indigo-650 text-white shadow" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingCart size={13} />
            <span>{getsLabel("invTabInvoices", "فواتير الشراء والتوريد", "Factures d'Achats (POs)", "Supplier Purchases")}</span>
          </button>
          
          <button
            onClick={() => {
              setActiveSubTab("catalog");
              resetCatalogForm();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "catalog" 
                ? "bg-indigo-650 text-white shadow" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardList size={13} />
            <span>{getsLabel("invTabCatalog", "دليل تصميمات المنتجات", "Catalogue Général", "Universal Catalog")}</span>
          </button>
        </div>
      </div>

      {/* RENDER INVOICES WORKSPACE TAB */}
      {activeSubTab === "invoices" && (
        <div className="space-y-6">
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <ShoppingCart size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-white">
                {poEditId ? getsLabel("editInvoice", "تعديل فاتورة الشراء", "Modifier la Facture d'Achat", "Edit Sourcing Invoice") : getsLabel("addPurchaseInvoice", "إنشاء وتوثيق فاتورة شراء واردة", "Saisir une Facture de Grossiste / Fournisseur", "New Wholesaler Sourcing Ledger")}
              </h3>
              {poEditId && <span className="text-xs text-orange-500 ms-2">({getsLabel("poEditingLabel", "تعديل نشط", "Modification en cours", "Draft Edit Mode")})</span>}
            </div>
            
            <form onSubmit={poSubmit} className="p-4 space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Date */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-slate-300">{getsLabel("date", "التاريخ", "Date d'Achat", "Date")}</label>
                  <input 
                    type="date" 
                    value={poDate} 
                    onChange={e => setPoDate(e.target.value)} 
                    onKeyDown={focusNextInput} 
                    onFocus={clearZeroOnFocus}
                    required
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                  />
                </div>

                {/* Supplier select */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-slate-300">{getsLabel("supplierName", "المورد (الشركة الموردة)", "Grossiste / Fournisseur", "Wholesale Supplier")}</label>
                  <select 
                    value={poSupplier} 
                    onChange={e => { setPoSupplier(e.target.value); }} 
                    onKeyDown={focusNextInput} 
                    required
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- {lang === "ar" ? "اختر المورد" : "Choisir"} --</option>
                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                {/* Invoice ID / Code */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-slate-300">{getsLabel("invoiceNo", "رقم أو معرف الفاتورة", "N° Document / Facture", "Invoice Reference ID")}</label>
                  <input 
                    type="text" 
                    value={poInvoiceNo} 
                    onChange={e => setPoInvoiceNo(e.target.value)} 
                    onKeyDown={focusNextInput}
                    required
                    placeholder="INV-5009"
                    className="w-full px-3 py-2 rounded-xl border text-sm font-semibold outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                  />
                </div>
              </div>

              {/* Line items generator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-t border-slate-800 pt-3 flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-white">{getsLabel("orderItems", "محتويات شحن الفاتورة والأسعار والنسب", "Détail des pièces & Marges associées", "Sourced Inventory Items & Financial Metrics")}</h4>
                  <button 
                    type="button" 
                    onClick={poAddItem} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold"
                  >
                    <Plus size={14} /> 
                    <span>{getsLabel("add", "إضافة سطر سلع جديد", "Ajouter une ligne", "Insert Line Row")}</span>
                  </button>
                </div>

                {/* Iterate items */}
                <div className="space-y-4">
                  {poItems.map((item, idx) => {
                    const wsPct = item.wholesalePct ?? 0;
                    const wsPrice = item.wholesalePrice ?? 0;
                    const rtPct = item.retailPct ?? 0;
                    const rtPrice = item.retailPrice ?? 0;

                    return (
                      <div key={idx} className="border rounded-2xl p-4 space-y-3 bg-[#040406]/40 shadow-sm relative border-slate-800">
                        {/* First line row options */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          
                          {/* Item Model input with dynamic autosuggestion */}
                          <div className="md:col-span-3 text-right">
                            <label className="text-[10px] font-medium mb-1 block text-slate-400">{getsLabel("productName", "اسم الموديل", "Modèle Pris", "Item Model Design")}</label>
                            <input 
                              type="text" 
                              value={item.productName} 
                              onChange={e => {
                                const name = e.target.value;
                                const existingProduct = products.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
                                poUpdateItem(idx, { 
                                  productName: name, 
                                  wholesalePct: existingProduct?.wholesalePercentage ?? 20, 
                                  retailPct: existingProduct?.retailPercentage ?? 50,
                                  wholesalePrice: existingProduct?.wholesalePrice ?? 0,
                                  retailPrice: existingProduct?.retailPrice ?? 0
                                });
                              }} 
                              onKeyDown={focusNextInput}
                              list={`po-prod-list-${idx}`}
                              className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              placeholder="Fila Classic Hoodie, Basic..." 
                            />
                            <datalist id={`po-prod-list-${idx}`}>
                              {products.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                          </div>

                          {/* Quantity */}
                          <div className="md:col-span-1 text-center">
                            <label className="text-[10px] font-medium mb-1 block text-slate-400">{getsLabel("quantity", "الكمية", "Quantité", "Qty")}</label>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity} 
                              onChange={e => poUpdateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1.5 rounded-lg border text-xs text-center font-bold font-mono outline-none"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                          </div>

                          {/* Color */}
                          <div className="md:col-span-3 text-right">
                            <label className="text-[10px] font-medium mb-1 block text-slate-400">{getsLabel("color", "اللون الموجه", "Couleur", "Color")}</label>
                            <div className="flex gap-2">
                              <select 
                                value={item.color} 
                                onChange={e => poUpdateItem(idx, { color: e.target.value })} 
                                onKeyDown={focusNextInput}
                                className="flex-1 px-2 py-1.5 rounded-lg border text-xs outline-none"
                                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              >
                                <option value="">--</option>
                                {colorList.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {showColorInput === idx ? (
                                <div className="flex gap-1">
                                  <input 
                                    type="text" 
                                    value={newColorInput} 
                                    onChange={e => setNewColorInput(e.target.value)} 
                                    onKeyDown={focusNextInput}
                                    placeholder="Pink"
                                    className="w-20 px-2 py-1 rounded-lg border text-xs text-white bg-slate-800 border-slate-700" 
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if (newColorInput.trim() && !colorList.includes(newColorInput.trim())) {
                                        // Merge to dynamic catalog if verified
                                        onTriggerNotification(lang === "ar" ? "تمت إضافة اللون للقائمة المؤقتة" : "Color added temporarily");
                                      }
                                      setNewColorInput('');
                                      setShowColorInput(null);
                                    }} 
                                    className="p-1.5 rounded bg-green-950/40 text-green-400 border border-transparent hover:border-green-800 shadow"
                                  >
                                    <Plus size={12} />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => { setShowColorInput(null); setNewColorInput(''); }} 
                                    className="p-1.5 rounded bg-red-950/40 text-red-400 border border-transparent shadow"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  type="button" 
                                  onClick={() => setShowColorInput(idx)} 
                                  className="p-1.5 rounded-lg text-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/40 border border-indigo-900/40"
                                >
                                  <Plus size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Size Selection */}
                          <div className="md:col-span-2 text-right">
                            <label className="text-[10px] font-medium mb-1 block text-slate-400">{getsLabel("size", "المقاس (إذا فرعي)", "Taille", "Size")}</label>
                            <input 
                              type="text" 
                              value={item.size} 
                              onChange={e => {
                                const val = e.target.value;
                                poUpdateItem(idx, { size: val, targetTable: val ? "2" : "1" });
                              }} 
                              onKeyDown={focusNextInput}
                              placeholder="L, XL, Big..."
                              className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none text-center"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                          </div>

                          {/* Destination Store */}
                          <div className="md:col-span-2 text-center">
                            <label className="text-[10px] font-medium mb-1 block text-slate-400">{getsLabel("targetTable", "المستودع", "Lieu Dépôt", "Store")}</label>
                            <select 
                              value={item.targetTable} 
                              onChange={e => poUpdateItem(idx, { targetTable: e.target.value as "1" | "2" })} 
                              onKeyDown={focusNextInput}
                              className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none text-center font-bold"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                              <option value="1">1 (الرئيسي)</option>
                              <option value="2">2 (الفرعي)</option>
                            </select>
                          </div>

                          {/* Delete Row button */}
                          <div className="md:col-span-1 flex justify-center pb-1">
                            {poItems.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => poRemoveItem(idx)} 
                                className="p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-950/20 border border-transparent hover:border-red-900/45 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cost, Margins and selling prices row */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 border-t border-slate-900/60">
                          
                          {/* Retail Cost Price */}
                          <div>
                            <label className="text-[10px] font-semibold block text-slate-400 mb-1">{getsLabel("costLabelRow", "سعر شراء التكلفة للقطعة", "Coût d'Acquisition U.", "Cost Price")}</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={item.costPrice} 
                              onChange={e => poUpdateItem(idx, { costPrice: parseFloat(e.target.value) || 0 })}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1 rounded border text-xs text-center font-mono font-bold"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                          </div>

                          {/* Wholesale Selling Price */}
                          <div>
                            <label className="text-[10px] font-semibold block text-emerald-400/90 mb-1">{getsLabel("wholesalePrice", "سعر البيع للجملة الكلي", "Prévu Vente (Gros)", "Wholesale Price")}</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={wsPrice} 
                              onChange={e => handlePoWsPrice(idx, parseFloat(e.target.value) || 0)}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1 rounded border text-xs text-center font-mono font-black text-emerald-400"
                              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} 
                            />
                          </div>

                          {/* Wholesale Percentage Profit */}
                          <div>
                            <label className="text-[10px] font-semibold block text-slate-400 mb-1">{getsLabel("wholesalePct", "فائدة الجملة المستهدفة %", "Marge Gros %", "Wholesale Profit %")}</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={wsPct} 
                              onChange={e => handlePoWsPct(idx, parseFloat(e.target.value) || 0)}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1 rounded border text-xs text-center font-mono"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                          </div>

                          {/* Retail Selling Price */}
                          <div>
                            <label className="text-[10px] font-semibold block text-blue-400 mb-1">{getsLabel("retailPrice", "سعر البيع للتجزئة المقترح", "Prévu Vente (Détail)", "Retail Price")}</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={rtPrice} 
                              onChange={e => handlePoRtPrice(idx, parseFloat(e.target.value) || 0)}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1 rounded border text-xs text-center font-mono font-black text-blue-400"
                              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }} 
                            />
                          </div>

                          {/* Retail Profit Percentage */}
                          <div>
                            <label className="text-[10px] font-semibold block text-slate-400 mb-1">{getsLabel("retailPct", "نسبة فائدة التجزئة %", "Marge Détail %", "Retail Profit %")}</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={rtPct} 
                              onChange={e => handlePoRtPct(idx, parseFloat(e.target.value) || 0)}
                              onKeyDown={focusNextInput} 
                              onFocus={clearZeroOnFocus}
                              className="w-full px-2 py-1 rounded border text-xs text-center font-mono"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                            />
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Debt and accounting summaries block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
                
                {/* Calculated Invoice Total */}
                <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <p className="text-[10px] text-slate-450">{getsLabel("invTotalLabel", "إجمالي هذه الفاتورة الكلي", "Total Brut Facture", "Current Invoice Total")}</p>
                  <p className="text-base font-bold text-blue-400 mt-1 font-mono">
                    {poCalcTotal().toLocaleString()} {currencyLabel}
                  </p>
                </div>

                {/* Amount Paid for this PO */}
                <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <p className="text-[10px] text-slate-450">{getsLabel("paidThisPo", "الحساب المدفوع حالياً", "Montant Versé", "Acompte Paid Now")}</p>
                  <input 
                    type="number" 
                    min="0" 
                    value={poPaymentAmount} 
                    onChange={e => setPoPaymentAmount(parseFloat(e.target.value) || 0)}
                    onKeyDown={focusNextInput} 
                    onFocus={clearZeroOnFocus}
                    className="w-full mt-1 px-2 py-1 rounded-lg border text-sm text-center font-bold font-mono outline-none"
                    style={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: poPaymentAmount >= poCalcTotal() && poCalcTotal() > 0 ? '#10b981' : 'var(--border-color)',
                      color: 'var(--text-primary)' 
                    }} 
                  />
                </div>

                {/* Previous Supplier Debt Mapped */}
                <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: poSupplierDebt > 0 ? '#f87171' : 'var(--border-color)' }}>
                  <p className="text-[10px] text-slate-450">{getsLabel("prevDebtLabel", "ديون الحساب السابقة للمورد", "Total Marge Dette Dépôt", "Supplier Outstanding Debt")}</p>
                  <p className={`text-base font-bold mt-1 font-mono ${poSupplierDebt > 0 ? 'text-rose-450' : 'text-emerald-400'}`}>
                    {poSupplierDebt.toLocaleString()} {currencyLabel}
                  </p>
                </div>

                {/* Cumulative Purchases recorded */}
                <div className="p-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <p className="text-[10px] text-slate-450">{getsLabel("cumulativeOrdersAmt", "تراكم مجاميع المبيعات المستلمة", "Volume Cumulé Reçu", "Lump Sum Supplier Purchases")}</p>
                  <p className="text-base font-bold text-indigo-400 mt-1 font-mono">
                    {(() => {
                      if (!poSupplier) return 0;
                      return invoices.filter(po => po.supplierName === poSupplier).reduce((s, po) => s + po.totalAmount, 0);
                    })().toLocaleString()} {currencyLabel}
                  </p>
                </div>

              </div>

              {/* Saved Supplier Payments List for active supplier selection */}
              {poSupplier && poSupplierPayments.length > 0 && (
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-white">{getsLabel("suppPaymentsLabel", "سجل سلف ودفعات المورد", "Historique Direct des Frais", "Supplier Account Tranches History")}</p>
                    <button 
                      type="button" 
                      onClick={() => { setPoPaymentModalOpen(true); setPoPaymentInput(0); setPoPaymentDateInput(poDate); setPoPaymentEditId(null); }}
                      className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white font-semibold shadow hover:scale-[1.01]"
                    >
                      {getsLabel("registerPayBtn", "إضافة دفعة مباشرة", "Ajouter Versement", "Add Payment")}
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {poSupplierPayments.slice().reverse().map((pay: any) => (
                      <div key={pay.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <span className="text-slate-400 font-mono">{pay.date}</span>
                        <span className="font-bold text-emerald-400 font-mono">{pay.amount.toLocaleString()} {currencyLabel}</span>
                        
                        <div className="flex gap-1.5">
                          {/* Edit payment */}
                          <button 
                            type="button" 
                            onClick={() => { setPoPaymentModalOpen(true); setPoPaymentEditId(pay.id); setPoPaymentInput(pay.amount); setPoPaymentDateInput(pay.date); }}
                            className="text-blue-400 hover:text-blue-500 p-0.5"
                          >
                            <Edit2 size={12} />
                          </button>
                          
                          {/* Delete historical payment */}
                          <button 
                            type="button" 
                            onClick={() => {
                              const supp = suppliers.find(s => s.name === poSupplier);
                              if (supp) {
                                const paymentsFiltered = (supp as any).payments.filter((p: any) => p.id !== pay.id);
                                onSaveSuppliers(suppliers.map(s => s.id === supp.id ? { ...s, payments: paymentsFiltered } : s));
                                
                                // Clean up from active parent PO invoice list as well
                                const mappedInvoice = poEditId ? invoices.find(inv => inv.id === poEditId) : invoices.filter(inv => inv.supplierName === poSupplier).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                                if (mappedInvoice) {
                                  const updatedPoPayments = (mappedInvoice.payments || []).filter(pp => pp.id !== pay.id);
                                  onSaveInvoices(invoices.map(inv => inv.id === mappedInvoice.id ? { ...inv, payments: updatedPoPayments } : inv));
                                }
                              }
                            }} 
                            className="text-red-400 hover:text-red-500 p-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action utilities bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-800 pt-3">
                {poSupplier && (
                  <button 
                    type="button" 
                    onClick={() => { setPoPaymentModalOpen(true); setPoPaymentInput(0); setPoPaymentDateInput(poDate); setPoPaymentEditId(null); }}
                    className="text-xs px-3 py-1.5 rounded-xl border border-dashed text-slate-300 hover:text-white" 
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    + {lang === "ar" ? "أضف دفعة مالية للحساب" : "Ajouter Acompte"}
                  </button>
                )}
                
                <div className="flex gap-2">
                  {poEditId && (
                    <button 
                      type="button" 
                      onClick={poResetForm} 
                      className="px-4 py-2 rounded-xl border text-sm text-slate-350 hover:bg-slate-900/60" 
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <ShoppingCart size={15} /> 
                    <span>{poEditId ? getsLabel("executeEdit", "تأكيد تعديل الفاتورة", "Confirmer Modification", "Apply Changes") : getsLabel("executeSave", "حفظ وتثبيت الفاتورة الكلي", "Finir la Saisie & Enregistrer", "Post Sourcing Entry")}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* TABLE OF HISTORICAL SAVED PURCHASE INVOICES */}
          {invoices.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2 text-xs" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">{getsLabel("historicalLedgerTitle", "سجل الفواتير الواردة المخزنة", "Registre des Factures Validées", "Sourced Invoices Ledger")}</h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <select 
                    value={quickPaySupplier} 
                    onChange={e => setQuickPaySupplier(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border bg-stone-900 text-slate-300 outline-none text-xs"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <option value="">{lang === "ar" ? "كل الموردين المسجلين" : "Tous les grossistes"}</option>
                    {[...new Set(invoices.map(po => po.supplierName))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  
                  <button 
                    onClick={() => { setQuickPayOpen(true); setQuickPayAmount(''); setQuickPayDate(today); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all shadow"
                  >
                    <Plus size={13} /> 
                    <span>{lang === "ar" ? "دفعة تكميلية سريعة" : "Versement Instantané"}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-sm text-right" style={{ color: 'var(--text-primary)' }} dir={isRtl ? "rtl" : "ltr"}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("invoiceNo", "رقم الفاتورة", "N° Doc", "Invoice ID")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("date", "التاريخ", "Date", "Date")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("supplierName", "المورد", "Fournisseur", "Supplier")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("productName", "اسم السلعة الموردة", "Désignation", "Model")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("color", "اللون", "Couleur", "Color")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("size", "المقاس", "Taille", "Size")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("quantity", "الكمية الواردة", "Qt.", "Qty")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("store", "المستودع", "Zone", "Store")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("wholesalePriceRow", "سعر البيع للجملة", "Tarif Gros", "Wholesale")}</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">فائدة الجملة %</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">سعر التجزئة المقترح</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">فائدة التجزئة %</th>
                      <th className="px-3 py-2.5 font-bold text-slate-400 text-center">{getsLabel("status", "حالة الدفع", "Statut", "Status")}</th>
                      <th className="px-2 py-2.5 w-24 text-center" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...invoices]
                      .sort((a, b) => {
                        const scoreA = parseInt(a.id.replace(/\D/g, "")) || 0;
                        const scoreB = parseInt(b.id.replace(/\D/g, "")) || 0;
                        return scoreB - scoreA;
                      })
                      .filter(po => {
                        if (!quickPaySupplier) return true;
                        return po.supplierName === quickPaySupplier;
                      })
                      .map(po => {
                        return po.items.map((item, idx) => {
                          const isFirst = idx === 0;
                          return (
                            <tr key={`${po.id}-${idx}`} className="border-b hover:bg-slate-800/10 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                              <td className="px-3 py-1.5 font-semibold font-mono text-indigo-400 text-center">
                                {isFirst ? `INV-${po.id}` : ""}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-center text-slate-400">
                                {isFirst ? po.date : ""}
                              </td>
                              <td className="px-3 py-1.5 font-medium text-center">
                                {isFirst ? po.supplierName : ""}
                              </td>
                              <td className="px-3 py-1.5 text-center font-bold text-slate-250">
                                {item.productName}
                              </td>
                              <td className="px-3 py-1.5 text-center text-slate-350">{item.color}</td>
                              <td className="px-3 py-1.5 text-center font-semibold font-mono text-orange-400">{item.size || "-"}</td>
                              <td className="px-3 py-1.5 text-center font-bold font-mono text-slate-200">{item.quantity}</td>
                              <td className="px-3 py-1.5 text-center font-mono">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] ${
                                  item.targetTable === "2" 
                                    ? "bg-yellow-950/20 text-yellow-500 border border-yellow-900/30" 
                                    : "bg-blue-950/20 text-blue-400 border border-blue-900/30"
                                }`}>
                                  {item.targetTable || "1"}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 font-mono text-center text-emerald-400 font-bold">
                                {item.sellingPrice ? `${item.sellingPrice.toLocaleString()} دج` : "-"}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-center text-slate-400">{item.wholesalePercentage}%</td>
                              <td className="px-3 py-1.5 font-mono text-center text-blue-450 font-bold">
                                {item.retailPercentage ? `${(item.costPrice + (item.costPrice * item.retailPercentage / 100)).toLocaleString()} دج` : "-"}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-center text-slate-400">{item.retailPercentage}%</td>
                              
                              <td className="px-3 py-1.5 text-center">
                                {isFirst ? (() => {
                                  const totalPaid = (po.payments || []).reduce((acc, p) => acc + p.amount, 0);
                                  const remaining = po.totalAmount - totalPaid;
                                  return remaining <= 0 
                                    ? <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-green-950/20 text-green-400 border border-green-900/40 font-bold">{lang === "ar" ? "مسدد بالكامل" : "Encaissé / Reglé"}</span>
                                    : <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-red-950/20 text-red-400 border border-red-900/40 font-bold">{lang === "ar" ? "قيد الديون والمتبقي" : "Dette Active"}</span>;
                                })() : ""}
                              </td>

                              <td className="px-2 py-1.5 text-center">
                                {isFirst && (
                                  <div className="flex gap-1 justify-center">
                                    <button onClick={() => handlePrintPO(po)} className="p-1 rounded hover:bg-slate-800 text-slate-400" title="طباعة">
                                      <Printer size={13} />
                                    </button>
                                    <button onClick={() => poStartEdit(po)} className="p-1 rounded hover:bg-slate-800 text-indigo-400" title="تعديل">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => poStartDelete(po)} className="p-1 rounded hover:bg-red-950/30 text-rose-450" title="حذف الفاتورة">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENDER MASTER PRODUCTS CATALOG TAB */}
      {activeSubTab === "catalog" && (
        <div className="space-y-4">
          
          {/* Catalog stats & Add control header */}
          <div className="flex justify-between items-center bg-[#09090b] rounded-xl border border-[#27272a] p-4 font-sans text-xs flex-wrap gap-2">
            <div>
              <p className="text-slate-400 font-bold text-sm">{getsLabel("catalogStats", "إجمالي مواصفات الموديلات بالشركة", "Nombre de profils de vêtements modélisés", "Cumulative Apparel Designs Profiles Map")}</p>
              <p className="text-slate-500 mt-1">{products.length} {lang === "ar" ? "موديل وتصميم تيشيرت / ملابس مسجل بقاعدة الإدارة" : "apparel model designs currently registered"}</p>
            </div>
            
            <button 
              onClick={() => {
                resetCatalogForm();
                setShowCatalogAddForm(true);
              }}
              className="bg-indigo-650 hover:bg-indigo-600 font-bold px-4 py-2 rounded-xl text-white flex items-center gap-1.5 text-xs transition-all shadow"
            >
              <PlusCircle size={15} />
              <span>{getsLabel("registerBtn", "إدراج وتصميم موديل جديد", "Concevoir un profil de vêtement", "Model Custom Style Pattern")}</span>
            </button>
          </div>

          {/* Catalog directory grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="catalog_grid">
            {products.length === 0 ? (
              <div className="col-span-full p-12 bg-[#09090b] rounded-2xl text-center border border-[#27272a]">
                <p className="text-slate-400 text-xs">{getsLabel("noCatalogRegistered", "دليل الموديلات فارغ حالياً. يمكنك تسجيل فواتير وسيتم إدراجهم تلقائياً أو إنشاؤها يدوياً من الأعلى.", "Le catalogue est vide. Saisissez des factures d'achat pour importer.", "Apparel design directory index is blank.")}</p>
              </div>
            ) : (
              products.map(p => (
                <div key={p.id} className="bg-[#09090b] rounded-2xl border border-[#27272a] overflow-hidden shadow-sm flex flex-col justify-between" id={`catalog_card_${p.id}`}>
                  
                  {/* Detailed card specs */}
                  <div className="p-4 space-y-4 text-right">
                    <div className="flex justify-between items-start flex-row-reverse gap-2">
                      <span className="text-[9px] bg-[#040406] border border-[#27272a] font-mono tracking-wider px-2 py-0.5 rounded-full text-slate-400">
                        ID: {p.id.slice(0, 8)}
                      </span>
                      <h3 className="text-xs font-bold text-white tracking-tight text-right flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-500" />
                        <span>{p.name}</span>
                      </h3>
                    </div>

                    {/* Cost matrices */}
                    <div className="grid grid-cols-2 gap-2">
                      
                      <div className="bg-[#040406]/65 p-2.5 rounded-xl border border-[#27272a]/60 text-center">
                        <span className="text-[9px] font-semibold text-slate-450 block">{lang === "ar" ? "سعر الجملة" : "Wholesale Price"}</span>
                        <span className="text-xs font-bold font-mono text-emerald-400 block mt-1">
                          {p.wholesalePrice.toLocaleString()} <span className="text-[9px] font-sans font-normal text-slate-400">{currencyLabel}</span>
                        </span>
                        <span className="text-[8.5px] text-slate-500 mt-0.5 block">+{p.wholesalePercentage || 0}% margin</span>
                      </div>

                      <div className="bg-[#040406]/65 p-2.5 rounded-xl border border-[#27272a]/60 text-center">
                        <span className="text-[9px] font-semibold text-slate-450 block">{lang === "ar" ? "سعر التجزئة" : "Retail Price"}</span>
                        <span className="text-xs font-bold font-mono text-blue-400 block mt-1">
                          {p.retailPrice.toLocaleString()} <span className="text-[9px] font-sans font-normal text-slate-400">{currencyLabel}</span>
                        </span>
                        <span className="text-[8.5px] text-slate-500 mt-0.5 block">+{p.retailPercentage || 0}% price margin</span>
                      </div>
                    </div>

                    {/* Sizes supporting list */}
                    <div className="space-y-1.5 text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">{lang === "ar" ? "مقاسات الموديل المتوفرة" : "Sizes support catalog"}</span>
                      <div className="flex justify-start sm:justify-end gap-1 flex-row-reverse flex-wrap">
                        {p.sizes && p.sizes.map((sz, i) => (
                          <span key={i} className="px-1.5 py-0.2 bg-[#040406] border border-[#27272a]/60 rounded text-[9px] font-mono font-bold text-orange-400">
                            {sz}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Colors & quantity table mapping */}
                    <div className="space-y-1.5 text-right border-t border-[#27272a]/45 pt-3">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">{lang === "ar" ? "خريطة الألوان بالتناسق" : "Colors holding schema"}</span>
                      <div className="flex flex-col gap-1">
                        {p.colors && p.colors.map((c, i) => (
                          <div key={i} className="flex justify-between items-center text-[10.5px] bg-[#040406]/40 px-2.5 py-1 rounded-lg border border-[#27272a]">
                            <span className="text-slate-400 font-mono font-bold">{c.quantity} PCS</span>
                            <span className="text-slate-300 font-medium">{c.color}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Operational actions */}
                  <div className="bg-[#040406]/55 p-2 px-3 flex justify-end gap-1.5 border-t border-[#27272a]">
                    <button
                      onClick={() => handleEditCatalogClick(p)}
                      className="p-1.5 px-3 rounded-lg hover:bg-[#27272a] text-slate-405 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all outline-none"
                    >
                      <Edit2 className="w-3 h-3 text-indigo-400" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(lang === "ar" ? `هل أنت متأكد من حذف ${p.name} نهائياً؟` : `Delete product design ${p.name}?`)) {
                          onSoftDeleteProduct(p.id);
                        }
                      }}
                      className="p-1.5 px-3 rounded-lg hover:bg-rose-500/10 text-rose-450 text-[10px] font-bold flex items-center gap-1 transition-all outline-none"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QUICK PAY MODAL POPUP FOR HISTORICAL DEBT REGISTRATION */}
      {quickPayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQuickPayOpen(false)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-1.5">
              <Landmark className="w-5 h-5 text-emerald-500" />
              <span>{lang === 'ar' ? 'إضافة دفعة مالية للحساب' : 'Ajouter un paiement direct'}</span>
            </h3>
            
            <div className="space-y-4 text-xs text-right">
              
              {/* Supplier */}
              <div>
                <label className="text-xs font-medium mb-1 block text-slate-300">{lang === 'ar' ? 'اختر المورد المستهدف' : 'Grossiste'}</label>
                <select 
                  value={quickPaySupplier} 
                  onChange={e => setQuickPaySupplier(e.target.value)} 
                  onKeyDown={focusNextInput}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="" className="bg-slate-900 text-white">--</option>
                  {[...new Set(invoices.map(po => po.supplierName))].map(s => (
                    <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium mb-1 block text-slate-300">{getsLabel("date", "التاريخ", "Date", "Date")}</label>
                <input 
                  type="date" 
                  value={quickPayDate} 
                  onChange={e => setQuickPayDate(e.target.value)} 
                  onKeyDown={focusNextInput} 
                  onFocus={clearZeroOnFocus}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium mb-1 block text-slate-300">{lang === 'ar' ? 'المبلغ النقدي المدفوع' : 'Montant versé'} ({currencyLabel})</label>
                <input 
                  type="number" 
                  min="1" 
                  value={quickPayAmount} 
                  onChange={e => setQuickPayAmount(e.target.value)}
                  onFocus={e => { if (e.target.value === '0' || e.target.value === '') { setQuickPayAmount(''); } }}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm font-bold text-center"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('quick-pay-submit')?.click(); } }} 
                />
              </div>

            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={() => setQuickPayOpen(false)} 
                className="px-4 py-2 rounded-xl border text-sm" 
                style={{ borderColor: 'var(--border-color)' }}
              >
                {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
              </button>
              
              <button 
                id="quick-pay-submit"
                onClick={() => {
                  if (!quickPaySupplier || !quickPayAmount || parseFloat(quickPayAmount) <= 0) { 
                    onTriggerNotification(lang === 'ar' ? 'اختر المورد وأدخل مبلغ الدفعة بشكل صحيح' : 'Select supplier and enter a valid amount'); 
                    return; 
                  }
                  
                  const targetSupplierRef = suppliers.find(s => s.name === quickPaySupplier);
                  if (!targetSupplierRef) return;
                  
                  const qpAmount = parseFloat(quickPayAmount);
                  const payId = `pay-${Date.now()}`;
                  
                  // Register new payment on supplier profile
                  const updatedSuppliers = suppliers.map(s => {
                    if (s.id === targetSupplierRef.id) {
                      const currentPayments = (s as any).payments || [];
                      return {
                        ...s,
                        payments: [...currentPayments, { id: payId, date: quickPayDate, amount: qpAmount }]
                      };
                    }
                    return s;
                  });
                  onSaveSuppliers(updatedSuppliers);

                  // Allocate this payment contextually to the latest pending / outstanding invoice
                  const sortedSupplierInvoices = invoices
                    .filter(inv => inv.supplierName === quickPaySupplier)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (sortedSupplierInvoices.length > 0) {
                    const latestInvoice = sortedSupplierInvoices[0];
                    const existingPayments = latestInvoice.payments || [];
                    
                    const updatedInvoices = invoices.map(inv => {
                      if (inv.id === latestInvoice.id) {
                        return {
                          ...inv,
                          payments: [...existingPayments, { id: payId, date: quickPayDate, amount: qpAmount }]
                        };
                      }
                      return inv;
                    });
                    onSaveInvoices(updatedInvoices);
                  }

                  setQuickPayOpen(false);
                  setQuickPayAmount('');
                  onTriggerNotification(lang === 'ar' ? 'تم قيد الدفعة المالية وتوزيع حساباتها' : 'Payment registered successfully');
                }} 
                className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow transition-all hover:scale-[1.01]"
              >
                {getsLabel("btnSave", "تثبيت الدفعة", "Enregistrer", "Save Payment")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL SINGLE PO TRANCHE PAYMENT MODAL (FROM USER DESIGN) */}
      {poPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPoPaymentModalOpen(false)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-xl border p-6 text-right" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {poPaymentEditId ? (lang === 'ar' ? 'تعديل الدفعة المالية المخصصة' : 'Modifier le versement') : (lang === 'ar' ? 'قيد دفعة مالية جديدة' : 'Nouveau versement')}
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-semibold block text-slate-400 mb-1">{getsLabel("date", "التاريخ", "Date d'effet", "Date")}</label>
                <input 
                  type="date" 
                  value={poPaymentDateInput} 
                  onChange={e => setPoPaymentDateInput(e.target.value)} 
                  onKeyDown={focusNextInput} 
                  onFocus={clearZeroOnFocus}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm text-center"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                />
              </div>
              
              <div>
                <label className="text-[10px] font-semibold block text-slate-400 mb-1">{lang === 'ar' ? 'المبلغ النقدي' : 'Montant'} ({currencyLabel})</label>
                <input 
                  type="number" 
                  min="1" 
                  value={poPaymentInput} 
                  onChange={e => setPoPaymentInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm font-bold text-center font-mono"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('po-tranche-save')?.click(); } }} 
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setPoPaymentModalOpen(false)} className="px-4 py-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border-color)' }}>
                {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
              </button>
              <button 
                id="po-tranche-save" 
                onClick={() => {
                  if (poPaymentInput <= 0) return;
                  const currentSuppRef = suppliers.find(s => s.name === poSupplier);
                  if (!currentSuppRef) return;

                  const parentInvoice = poEditId ? invoices.find(inv => inv.id === poEditId) : invoices.filter(inv => inv.supplierName === poSupplier).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  
                  if (poPaymentEditId) {
                    // Update supplier payments array
                    const currentPayments = (currentSuppRef as any).payments || [];
                    const updatedPayments = currentPayments.map((p: any) => p.id === poPaymentEditId ? { ...p, date: poPaymentDateInput, amount: poPaymentInput } : p);
                    
                    onSaveSuppliers(suppliers.map(s => s.id === currentSuppRef.id ? { ...s, payments: updatedPayments } : s));

                    // Update corresponding invoice payments
                    if (parentInvoice) {
                      const updatedInvoicePayments = (parentInvoice.payments || []).map(p => p.id === poPaymentEditId ? { ...p, date: poPaymentDateInput, amount: poPaymentInput } : p);
                      onSaveInvoices(invoices.map(inv => inv.id === parentInvoice.id ? { ...inv, payments: updatedInvoicePayments } : inv));
                    }
                  } else {
                    const newTranche = { id: `pay-${Date.now()}`, date: poPaymentDateInput, amount: poPaymentInput };
                    
                    // Add payment allocation to supplier profile
                    const currentPayments = (currentSuppRef as any).payments || [];
                    onSaveSuppliers(suppliers.map(s => s.id === currentSuppRef.id ? { ...s, payments: [...currentPayments, newTranche] } : s));

                    // Mapped invoice allotment
                    if (parentInvoice) {
                      const updatedInvoicePayments = [...(parentInvoice.payments || []), newTranche];
                      onSaveInvoices(invoices.map(inv => inv.id === parentInvoice.id ? { ...inv, payments: updatedInvoicePayments } : inv));
                    }
                    
                    setPoPaymentAmount(poPaymentInput);
                  }

                  setPoPaymentModalOpen(false);
                }} 
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow"
              >
                {getsLabel("btnSave", "تثبيت وتوثيق", "Valider", "Apply Tranche")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PURCHASE ORDER DELETE MODAL POPUP */}
      {poDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPoDeleteId(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl border p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <p className="text-sm font-bold mb-5">{lang === "ar" ? "هل أنت متأكد من حذف وإلغاء هذه الفاتورة؟ سيتم سحب كمياتها الهيكلية من المستودع تلقائياً." : "Permanently remove this purchase order and deduct the associated quantity increments?"}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setPoDeleteId(null)} className="px-4 py-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border-color)' }}>
                {getsLabel("btnCancel", "تراجع وإلغاء", "Annuler", "Cancel")}
              </button>
              <button onClick={poConfirmDelete} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow">
                {getsLabel("btnConfirmDelete", "تأكيد الحذف نهائياً", "Confirmer la suppression", "Yes, Delete invoice")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER CATALOG ADD/EDIT FORM MODAL SHEET */}
      {showCatalogAddForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative flex flex-col max-h-[90vh] text-right" id="catalog_modal">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4 flex-row-reverse">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>{catalogEditingId ? getsLabel("editApparelProfile", "تعديل خيارات ونسب الموديل", "Ajuster le Profil Modèle", "Refine Cloth Design Profile") : getsLabel("newApparelProfile", "تصميم وإدراج موديل ملابس ملبسي جديد", "Créer un nouveau profil vêtement", "New Cloth Style Definition")}</span>
              </h2>
              <button onClick={resetCatalogForm} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveCatalog} className="space-y-4 overflow-y-auto flex-1 pr-1 font-sans text-xs flex flex-col gap-3">
              
              {/* Product design label */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "اسم أو موديل السلعة" : "Désignation Unique"} *</label>
                <input 
                  type="text" 
                  required 
                  value={modelName} 
                  onChange={e => setModelName(e.target.value)}
                  placeholder="Zara Winter Oversized Hoodie"
                  className="w-full bg-slate-850 border border-slate-750 p-2 text-sm rounded-xl text-white text-right outline-none focus:border-indigo-500" 
                />
              </div>

              {/* WHOLESALE CALIBRATION */}
              <div className="p-3 bg-slate-850/50 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block border-b border-slate-800 pb-1">
                  📦 {lang === "ar" ? "محاسبة وهوامش البيع بالجملة" : "Grossiste Pricing Metrics"}
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">{lang === "ar" ? "سعر التكلفة الافتراضي" : "Coût Initial (Dépôt)"}</label>
                    <input 
                      type="number" 
                      value={wholesaleCost} 
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setWholesaleCost(val);
                        setRetailCost(val);
                      }}
                      className="w-full bg-slate-800 border border-slate-755 rounded-lg p-1.5 text-center font-mono text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">{lang === "ar" ? "نسبة الفائدة المستهدفة بالجملة %" : "Marge Gros Cible %"}</label>
                    <input 
                      type="number" 
                      value={wholesaleProfitPct} 
                      onChange={e => setWholesaleProfitPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-755 rounded-lg p-1.5 text-center font-mono text-white" 
                    />
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg flex flex-col justify-center text-center">
                    <span className="text-[10px] text-slate-450">{lang === "ar" ? "سعر الجملة التلقائي المحسوب" : "P.V Gros Prévu"}</span>
                    <span className="text-sm font-bold font-mono text-emerald-400 mt-1">
                      {computedCatalogPrices.wholesale.toLocaleString()} {currencyLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* RETAIL CALIBRATION */}
              <div className="p-3 bg-slate-850/50 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block border-b border-slate-800 pb-1">
                  🛒 {lang === "ar" ? "محاسبة وهوامش البيع بالتجزئة" : "Boutique Retail Pricing Metrics"}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">{lang === "ar" ? "سعر التكلفة الافتراضي للتجزئة" : "Coût initial"}</label>
                    <input 
                      type="number" 
                      value={retailCost} 
                      onChange={e => setRetailCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-755 rounded-lg p-1.5 text-center font-mono text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">{lang === "ar" ? "نسبة ربح التجزئة المستهدفة %" : "Marde Détail %"}</label>
                    <input 
                      type="number" 
                      value={retailProfitPct} 
                      onChange={e => setRetailProfitPct(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-755 rounded-lg p-1.5 text-center font-mono text-white" 
                    />
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg flex flex-col justify-center text-center">
                    <span className="text-[10px] text-slate-450">{lang === "ar" ? "سعر التجزئة التلقائي للزبون" : "P.V Boutique Prévu"}</span>
                    <span className="text-sm font-bold font-mono text-blue-400 mt-1">
                      {computedCatalogPrices.retail.toLocaleString()} {currencyLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIZES MATRIX */}
              <div className="p-3 bg-slate-850/50 rounded-2xl border border-slate-850">
                <span className="block text-slate-300 font-bold mb-2">{lang === "ar" ? "مسارات المقاسات العليلة للموديل" : "Tailles Supportées"}</span>
                <div className="flex gap-1.5 justify-start sm:justify-end flex-wrap flex-row-reverse">
                  {["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"].map(sz => {
                    const active = sizesList.includes(sz);
                    return (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => handleToggleSize(sz)}
                        className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                          active 
                            ? "bg-indigo-600 border-indigo-500 text-white shadow"
                            : "bg-slate-805 border-slate-700 text-slate-400"
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COLORS MATRIX AND DOCK */}
              <div className="p-3 bg-slate-850/50 rounded-2xl border border-slate-800 space-y-3 text-right">
                <span className="block text-slate-350 font-bold">{lang === "ar" ? "خارطة الألوان لمنتجات أول المدة" : "Couleurs Stockées Initiales"}</span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <select 
                      value={tempColor} 
                      onChange={e => setTempColor(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-750 p-2 rounded-lg text-white"
                    >
                      {colorList.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <input 
                      type="number" 
                      min="0"
                      value={tempColorQty} 
                      onChange={e => setTempColorQty(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-750 p-2 rounded-lg text-white text-center font-mono"
                      placeholder="الأولى" 
                    />
                  </div>
                  <div>
                    <button 
                      type="button" 
                      onClick={handleCreateColorRow}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold p-2 rounded-lg text-white text-xs transition-all flex items-center justify-center gap-1"
                    >
                      <Plus size={14} />
                      <span>{lang === "ar" ? "إدراج اللون" : "Ajouter couleur"}</span>
                    </button>
                  </div>
                </div>

                {colorsTable.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 justify-start sm:justify-end flex-row-reverse">
                    {colorsTable.map((cc, idx) => (
                      <span key={idx} className="bg-slate-950 border border-slate-800 text-[10px] py-1 px-2 rounded-lg flex items-center gap-1.5">
                        <button type="button" onClick={() => handleRemoveColorRow(cc.color)} className="text-red-400">✕</button>
                        <span className="text-slate-400 font-mono">({cc.quantity} pcs)</span>
                        <span className="text-slate-200 font-bold">{cc.color}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Form buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={resetCatalogForm}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  {getsLabel("btnCancel", "إلغاء", "Annuler", "Cancel")}
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-650 hover:bg-indigo-600 font-bold text-white px-6 py-2 rounded-xl text-xs shadow transition-all hover:scale-[1.01]"
                >
                  {getsLabel("btnSave", "تأكيد وحفظ", "Sauvegarder", "Save Model")}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
