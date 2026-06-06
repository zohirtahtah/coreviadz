/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Supplier, SupplierInvoice, Product, LanguageType } from "../types";
import { 
  Building2, Plus, Edit2, Trash2, Printer, X, Search, 
  Phone, Mail, MapPin, Landmark, Calendar, 
  Coins, Check, Sliders
} from "lucide-react";

// Inline interface mapping as requested
interface SupplierPayment {
  id: string | number;
  date: string;
  amount: number;
}

interface PurchaseItem {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  costPrice: number;
  targetTable: string;
}

interface PurchaseOrder {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  total: number;
  paymentAmount?: number;
  payments?: SupplierPayment[];
}

interface SupplierExtended {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  dateAdded?: string;
  payments?: SupplierPayment[];
}

interface SuppliersViewProps {
  suppliers: Supplier[];
  onSaveSuppliers: (arr: Supplier[]) => void;
  invoices: SupplierInvoice[];
  onSaveInvoices: (arr: SupplierInvoice[]) => void;
  products: Product[];
  lang: LanguageType;
  onSoftDeleteInvoice: (id: string) => void;
  onTriggerNotification: (msg: string, type?: "success" | "info" | "warning") => void;
}

export default function SuppliersView({
  suppliers,
  onSaveSuppliers,
  invoices,
  onSaveInvoices,
  lang,
  onTriggerNotification
}: SuppliersViewProps) {
  
  // 1. Storage Synced Suppliers Collection
  const [suppliersState, setSuppliersState] = useState<SupplierExtended[]>(() => {
    const stored = localStorage.getItem("suppliers");
    if (stored) return JSON.parse(stored);
    
    // Fallback to initial prop suppliers list for smooth integration of existing workspace data
    const propSupps = suppliers || [];
    return propSupps.map((s: any) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      email: s.email,
      dateAdded: s.createdAt ? s.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
      payments: s.payments || []
    }));
  });

  // 2. Storage Synced PurchaseOrders Collection
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const stored = localStorage.getItem("purchaseOrders");
    if (stored) return JSON.parse(stored);

    // Fallback to loading from prop invoices
    const propInvs = invoices || [];
    return propInvs.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.id.replace("INV-", "") || inv.id,
      supplierName: inv.supplierName,
      date: inv.date,
      items: (inv.items || []).map((it: any) => ({
        productName: it.productName,
        color: it.color,
        size: it.size,
        quantity: it.quantity,
        costPrice: it.costPrice,
        targetTable: it.targetTable === "2" ? "2" : "1"
      })),
      total: inv.totalAmount,
      paymentAmount: (inv.payments || []).reduce((s: number, p: any) => s + p.amount, 0),
      payments: (inv.payments || []).map((p: any) => ({
        id: p.id,
        date: p.date,
        amount: p.amount
      }))
    }));
  });

  // Bidirectional local storage and props synchronization
  useEffect(() => {
    localStorage.setItem("suppliers", JSON.stringify(suppliersState));
    
    const mappedSuppliers: Supplier[] = suppliersState.map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone || "",
      address: s.address || "",
      email: s.email || "",
      createdAt: s.dateAdded || new Date().toISOString().split("T")[0],
      payments: s.payments || []
    }) as any);
    
    localStorage.setItem("corevia_suppliers_v1", JSON.stringify(mappedSuppliers));
    // Propagate up to App.tsx
    onSaveSuppliers(mappedSuppliers);
  }, [suppliersState]);

  useEffect(() => {
    localStorage.setItem("purchaseOrders", JSON.stringify(purchaseOrders));

    const mappedInvoices: SupplierInvoice[] = purchaseOrders.map(po => {
      const supp = suppliersState.find(s => s.name === po.supplierName);
      return {
        id: po.id.startsWith("INV-") ? po.id : `INV-${po.id}`,
        date: po.date,
        supplierId: supp ? supp.id : `supp-unknown`,
        supplierName: po.supplierName,
        items: po.items.map((it, idx) => ({
          id: `litem-${Date.now()}-${idx}-${Math.random()}`,
          productId: `prod-unknown`,
          productName: it.productName,
          color: it.color,
          size: it.size,
          quantity: it.quantity,
          costPrice: it.costPrice,
          wholesalePercentage: 25,
          retailPercentage: 50,
          sellingPrice: it.costPrice * 1.5,
          targetTable: it.targetTable === "2" ? "2" : "1"
        })),
        totalAmount: po.total,
        payments: (po.payments || []).map((p: any) => ({
          id: String(p.id),
          date: p.date,
          amount: p.amount
        })),
        createdAt: new Date().toISOString()
      };
    });

    localStorage.setItem("corevia_invoices_v1", JSON.stringify(mappedInvoices));
    // Propagate up to App.tsx
    onSaveInvoices(mappedInvoices);
  }, [purchaseOrders]);

  // Handle live storage synchronizations from other concurrent tabs/windows
  useEffect(() => {
    const handleStorageChange = () => {
      const suppData = localStorage.getItem("suppliers");
      if (suppData) setSuppliersState(JSON.parse(suppData));
      
      const invoiceData = localStorage.getItem("purchaseOrders");
      if (invoiceData) setPurchaseOrders(JSON.parse(invoiceData));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 14 REQUIRED STATE VARIABLES
  const [editingId, setEditingId] = useState<string | null>(null); // 1
  const [name, setName] = useState<string>(""); // 2
  const [phone, setPhone] = useState<string>(""); // 3
  const [address, setAddress] = useState<string>(""); // 4
  const [email, setEmail] = useState<string>(""); // 5
  const [search, setSearch] = useState<string>(""); // 6
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // 7
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null); // 8
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]); // 9
  const [paymentAmount, setPaymentAmount] = useState<string | number>(""); // 10
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null); // 11
  const [payPOAmounts, setPayPOAmounts] = useState<Record<string, string>>({}); // 12
  const [invoiceSearch, setInvoiceSearch] = useState<string>(""); // 13
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState<number | null>(null); // 14

  // Helper inside form to reset inputs
  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setEmail("");
    setEditingId(null);
  };

  // Helper to fetch statistics dynamically for a specific supplier by name
  const getPurchaseStats = (supplierName: string) => {
    const supplierOrdersFiltered = purchaseOrders.filter(po => po.supplierName === supplierName);
    const count = supplierOrdersFiltered.length;
    const total = supplierOrdersFiltered.reduce((s, po) => s + po.total, 0);
    return { count, total };
  };

  // 3.2 Filtered suppliers based on name/phone/email/address search query
  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliersState;
    return suppliersState.filter(s => 
      s.name.toLowerCase().includes(query) ||
      (s.phone || "").toLowerCase().includes(query) ||
      (s.address || "").toLowerCase().includes(query) ||
      (s.email || "").toLowerCase().includes(query)
    );
  }, [suppliersState, search]);

  // Selected Supplier helper
  const selectedSupplier = useMemo(() => {
    return suppliersState.find(s => s.id === selectedSupplierId) || null;
  }, [suppliersState, selectedSupplierId]);

  // Sorted list of invoices for expanded details
  const supplierOrders = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchaseOrders
      .filter(po => po.supplierName === selectedSupplier.name)
      .sort((a,b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  }, [purchaseOrders, selectedSupplier]);

  // Filtered invoices inside supplier details
  const filteredInvoices = useMemo(() => {
    return supplierOrders.filter(po => 
      po.invoiceNumber.toLowerCase().includes(invoiceSearch.trim().toLowerCase())
    );
  }, [supplierOrders, invoiceSearch]);

  // Detailed modal financial metrics
  const totalPurchasesAmount = useMemo(() => {
    return supplierOrders.reduce((s, po) => s + po.total, 0);
  }, [supplierOrders]);

  const supplierPayments = useMemo(() => {
    return selectedSupplier?.payments ?? [];
  }, [selectedSupplier]);

  const totalPaymentsAmount = useMemo(() => {
    return supplierPayments.reduce((s, p) => s + p.amount, 0);
  }, [supplierPayments]);

  const debts = totalPurchasesAmount - totalPaymentsAmount;

  // Add/Edit Supplier Submission Handler
  const handleAddSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      onTriggerNotification("يرجى ملأ اسم المورد الإجباري", "warning");
      return;
    }

    if (editingId) {
      // Editing Mode
      const updated = suppliersState.map(s => {
        if (s.id === editingId) {
          return {
            ...s,
            name: name.trim(),
            phone,
            address,
            email
          };
        }
        return s;
      });
      setSuppliersState(updated);
      onTriggerNotification("تم تعديل بيانات المورد الشريك بنجاح.");
      setEditingId(null);
    } else {
      // Adding Mode
      const newSupp: SupplierExtended = {
        id: `supp-${Date.now()}`,
        name: name.trim(),
        phone,
        address,
        email,
        dateAdded: new Date().toISOString().split("T")[0],
        payments: []
      };
      setSuppliersState([newSupp, ...suppliersState]);
      onTriggerNotification(`تم تسجيل المورد الجديد (${name.trim()}) بنجاح.`);
    }

    resetForm();
  };

  // Click handler to load edit records
  const handleEditSupplierClick = (e: React.MouseEvent, s: SupplierExtended) => {
    e.stopPropagation();
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setEmail(s.email || "");
  };

  // Safe confirm delete handlers
  const handleDeleteSupplierClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      setSuppliersState(prev => prev.filter(s => s.id !== deleteConfirmId));
      onTriggerNotification("تم إقصاء المورد المالي بنجاح.");
      
      // FIXING BUG IN ORIGINAL SCRIPT: Lines 85-86 called non-existent functions causing ReferenceError!
      // setPasswordMode(false);  // ❌ REMOVED
      // setDeletePassword('');   // ❌ REMOVED
      
      setDeleteConfirmId(null);
    }
  };

  // 4.2 Invoice Specific Payment Creator inside Expanded Invoice
  const handlePayPO = (poId: string, amount: number) => {
    if (isNaN(amount) || amount <= 0) {
      onTriggerNotification("يرجى وضع قيمة صحيحة وموجبة لمبلغ الدفعة", "warning");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const newPayment = { id: Date.now(), date: today, amount };

    // Update Purchase Orders
    const updatedPOs = purchaseOrders.map(po => {
      if (po.id === poId) {
        const oldPayments = po.payments ?? [];
        const oldAmount = po.paymentAmount ?? 0;
        return {
          ...po,
          payments: [...oldPayments, newPayment],
          paymentAmount: oldAmount + amount
        };
      }
      return po;
    });
    setPurchaseOrders(updatedPOs);

    // Find and update Supplier payments
    const targetPo = purchaseOrders.find(po => po.id === poId);
    if (targetPo) {
      const supplier = suppliersState.find(s => s.name === targetPo.supplierName);
      if (supplier) {
        const updatedSuppliers = suppliersState.map(s => {
          if (s.id === supplier.id) {
            const oldPayments = s.payments ?? [];
            return {
              ...s,
              payments: [...oldPayments, newPayment]
            };
          }
          return s;
        });
        setSuppliersState(updatedSuppliers);
      }
    }

    // Clear input
    setPayPOAmounts(prev => ({ ...prev, [poId]: "" }));
    onTriggerNotification(`تم تسجيل الدفعة بنجاح بمبلغ ${amount.toLocaleString()} دج للفاتورة والمورد.`);
  };

  // 4.3 General Payments form submission handler
  const handleAddPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSupplier) return;

    const amt = Number(paymentAmount);
    if (!paymentAmount || isNaN(amt) || amt <= 0) {
      onTriggerNotification("يرجى إدخال مبلغ صحيح وموجب لإجراء دفعة", "warning");
      return;
    }

    if (editingPaymentId) {
      // Mode edit
      const updatedSuppliers = suppliersState.map(s => {
        if (s.id === selectedSupplier.id) {
          const updatedPayments = (s.payments || []).map(p => {
            if (p.id === editingPaymentId || String(p.id) === String(editingPaymentId)) {
              return { ...p, date: paymentDate, amount: amt };
            }
            return p;
          });
          return { ...s, payments: updatedPayments };
        }
        return s;
      });
      setSuppliersState(updatedSuppliers);

      // Search and update matching purchaseOrder if this payment was originally matched
      const updatedPOs = purchaseOrders.map(po => {
        const hasPayment = (po.payments || []).some(p => String(p.id) === String(editingPaymentId));
        if (hasPayment) {
          const updatedPoPays = (po.payments || []).map(p => {
            if (String(p.id) === String(editingPaymentId)) {
              return { ...p, date: paymentDate, amount: amt };
            }
            return p;
          });
          return {
            ...po,
            payments: updatedPoPays,
            paymentAmount: updatedPoPays.reduce((sum, p) => sum + p.amount, 0)
          };
        }
        return po;
      });
      setPurchaseOrders(updatedPOs);

      setEditingPaymentId(null);
      onTriggerNotification("تم تحديث الدفعة ومزامنتها بنجاح.");
    } else {
      // Mode add: Add payment solely on supplier level
      const newPayment: SupplierPayment = {
        id: Date.now(),
        date: paymentDate,
        amount: amt
      };

      const updatedSuppliers = suppliersState.map(s => {
        if (s.id === selectedSupplier.id) {
          return {
            ...s,
            payments: [...(s.payments || []), newPayment]
          };
        }
        return s;
      });
      setSuppliersState(updatedSuppliers);
      onTriggerNotification("تم تسجيل الدفعة بنجاح على مستوى المورد الكلي.");
    }

    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  const handleEditPayment = (p: SupplierPayment) => {
    setPaymentDate(p.date);
    setPaymentAmount(p.amount);
    setEditingPaymentId(String(p.id));
  };

  const handleDeletePayment = (paymentId: string | number) => {
    if (!selectedSupplier) return;

    // Filter payments from supplier
    const updatedSuppState = suppliersState.map(s => {
      if (s.id === selectedSupplier.id) {
        return {
          ...s,
          payments: (s.payments || []).filter(p => String(p.id) !== String(paymentId))
        };
      }
      return s;
    });
    setSuppliersState(updatedSuppState);

    // Also remove from any matched invoice
    const updatedPOs = purchaseOrders.map(po => {
      const hasPayment = (po.payments || []).some(p => String(p.id) === String(paymentId));
      if (hasPayment) {
        const filteredPays = (po.payments || []).filter(p => String(p.id) !== String(paymentId));
        return {
          ...po,
          payments: filteredPays,
          paymentAmount: filteredPays.reduce((sum, p) => sum + p.amount, 0)
        };
      }
      return po;
    });
    setPurchaseOrders(updatedPOs);

    if (String(editingPaymentId) === String(paymentId)) {
      setEditingPaymentId(null);
      setPaymentAmount("");
    }

    onTriggerNotification("تم إلغاء الدفعة ومزامنة تفاصيل الحسابات بنجاح.");
  };

  // 7. PRINTING ENGINE
  const handlePrintSupplier = () => {
    if (!selectedSupplier) return;
    
    const supplierOrdersFiltered = purchaseOrders.filter(po => po.supplierName === selectedSupplier.name);
    const totalPurchasesAmount = supplierOrdersFiltered.reduce((s, po) => s + po.total, 0);
    const supplierPayments = selectedSupplier.payments ?? [];
    const totalPaymentsAmount = supplierPayments.reduce((s, p) => s + p.amount, 0);
    const debts = totalPurchasesAmount - totalPaymentsAmount;

    const ordersRows = supplierOrdersFiltered.map(po => `
      <tr>
        <td>INV-${po.invoiceNumber}</td>
        <td>${po.date}</td>
        <td>${po.items.map(it => `${it.productName} (${it.quantity})`).join(", ")}</td>
        <td style="font-weight: bold;">${po.total.toLocaleString()} دج</td>
        <td style="color: #16a34a;">${(po.paymentAmount ?? 0).toLocaleString()} دج</td>
        <td style="color: #dc2626; font-weight: bold;">${(po.total - (po.paymentAmount ?? 0)).toLocaleString()} دج</td>
      </tr>
    `).join("");

    const paymentsRows = supplierPayments.map(p => `
      <tr>
        <td>${p.date}</td>
        <td style="color: #16a34a; font-weight: bold;">${p.amount.toLocaleString()} دج</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head>
          <title>تقرير المورد المالي: ${selectedSupplier.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              padding: 300px; 
              padding-top: 20px;
              padding-right: 25px;
              padding-left: 25px;
              background-color: #ffffff;
              color: #1f2937;
            }
            .title-sec {
              text-align: center;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 12px;
              margin-bottom: 25px;
            }
            h1 { font-size: 22px; margin: 0; font-weight: 900; }
            h2 { font-size: 16px; margin: 5px 0 0 0; color: #4b5563; }
            .info-card {
              display: flex;
              justify-content: space-between;
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 12px;
              margin-bottom: 25px;
            }
            .info-p { margin: 4px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: right; font-size: 12px; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .bento-grid { display: flex; gap: 12px; margin-top: 25px; }
            .bento-box { flex: 1; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid #e5e7eb; }
            .bento-box.blue { background-color: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
            .bento-box.green { background-color: #f0fdf4; color: #166534; border-color: #bbf7d0; }
            .bento-box.red { background-color: #fef2f2; color: #991b1b; border-color: #fecaca; }
            .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #9ca3af; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="title-sec">
            <h1>الملخص المالي الشامل للمورد</h1>
            <h2>برنامج تسيير المشتريات والحسابات الدائنة</h2>
          </div>

          <div class="info-card">
            <div>
              <p class="info-p"><strong>الاسم الكامل لجهة التوريد:</strong> ${selectedSupplier.name}</p>
              <p class="info-p"><strong>رقم الهاتف:</strong> ${selectedSupplier.phone || "—"}</p>
              <p class="info-p"><strong>العنوان الفعلي:</strong> ${selectedSupplier.address || "—"}</p>
            </div>
            <div style="text-align: left;">
              <p class="info-p"><strong>البريد الإلكتروني:</strong> ${selectedSupplier.email || "—"}</p>
              <p class="info-p"><strong>تاريخ الإلحاق بالبرنامج:</strong> ${selectedSupplier.dateAdded || "—"}</p>
              <p class="info-p"><strong>تاريخ الطباعة:</strong> ${new Date().toISOString().split("T")[0]}</p>
            </div>
          </div>

          <h3>1. كشف التوريدات وفواتير الشراء</h3>
          <table>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>التاريخ</th>
                <th>تفاصيل الأصناف والقطع المشحونة</th>
                <th>المجموع الإجمالي</th>
                <th>القيمة المدفوعة</th>
                <th>الديون المستحقة</th>
              </tr>
            </thead>
            <tbody>
              ${ordersRows || `<tr><td colspan="6" style="text-align:center;">لم يسجل فواتير توريد</td></tr>`}
            </tbody>
          </table>

          <h3>2. كشف الوصولات والمدفوعات السابقة</h3>
          <table style="width: 50%;">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>القيمة المسددة</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsRows || `<tr><td colspan="2" style="text-align:center;">لا يوجد أي دفعات مالية مسجلة</td></tr>`}
            </tbody>
          </table>

          <div class="bento-grid">
            <div class="bento-box blue">
              <strong>إجمالي المشتريات</strong>
              <h2 style="font-size: 20px; font-weight: 900; margin-top: 5px;">${totalPurchasesAmount.toLocaleString()} دج</h2>
            </div>
            <div class="bento-box green">
              <strong>إجمالي المدفوعات</strong>
              <h2 style="font-size: 20px; font-weight: 900; margin-top: 5px;">${totalPaymentsAmount.toLocaleString()} دج</h2>
            </div>
            <div class="bento-box red">
              <strong>الديون المتبقية للشركة</strong>
              <h2 style="font-size: 20px; font-weight: 900; margin-top: 5px;">${debts.toLocaleString()} دج</h2>
            </div>
          </div>

          <div class="footer">صادر رقمياً عن نظام Corevia - السجل المالي الآمن</div>
        </body>
      </html>
    `;

    const pWin = window.open("", "_blank");
    if (pWin) {
      pWin.document.write(html);
      pWin.document.close();
    } else {
      onTriggerNotification("يرجى تفعيل النوافذ المنبثقة للطباعة", "warning");
    }
  };

  const handlePrintInvoiceSingle = (po: PurchaseOrder) => {
    const paid = (po.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const rem = po.total - paid;

    const itemsRows = po.items.map(it => `
      <tr>
        <td>${it.productName}</td>
        <td>${it.color || "—"}</td>
        <td>${it.size || "—"}</td>
        <td style="font-weight: bold;">${it.quantity}</td>
        <td>${it.costPrice.toLocaleString()} دج</td>
        <td style="font-weight: bold;">${(it.costPrice * it.quantity).toLocaleString()} دج</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head>
          <title>فاتورة شراء #${po.invoiceNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              padding: 25px; 
              background-color: #ffffff;
              color: #1f2937;
            }
            .header-sec {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            h1 { font-size: 20px; margin: 0; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: right; font-size: 13px; }
            th { background-color: #f9fafb; }
            .summary-box {
              margin-top: 25px;
              display: flex;
              justify-content: flex-end;
            }
            .summary-inner {
              width: 300px;
              border: 1px solid #e5e7eb;
              background-color: #f9fafb;
              border-radius: 8px;
              padding: 12px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
              font-size: 13px;
            }
            .footer { text-align: center; margin-top: 60px; font-size: 11px; color: #9ca3af; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header-sec">
            <div>
              <h1>قسيمة فاتورة المشتريات</h1>
              <p style="margin: 4px 0; font-size: 13px;"><strong>رقم الفاتورة:</strong> INV-${po.invoiceNumber}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>التاريخ:</strong> ${po.date}</p>
            </div>
            <div style="text-align: left;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>المورد:</strong> ${po.supplierName}</p>
              <p style="margin: 4px 0; font-size: 13px;">السجل المالي لشركة Corevia</p>
            </div>
          </div>

          <h3>تفاصيل البنود والأصناف</h3>
          <table>
            <thead>
              <tr>
                <th>اسم وصنف المنتج</th>
                <th>اللون</th>
                <th>المقاس</th>
                <th>الكمية المشتراة</th>
                <th>سعر التكلفة دج/ق</th>
                <th>مجموع البند الكلي</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-inner">
              <div class="summary-row">
                <span>المجموع الكلي للفاتورة:</span>
                <span style="font-weight: bold;">${po.total.toLocaleString()} دج</span>
              </div>
              <div class="summary-row" style="color: #16a34a;">
                <span>المبلغ المدفوع منها:</span>
                <span>${paid.toLocaleString()} دج</span>
              </div>
              <div class="summary-row" style="color: #dc2626; font-weight: bold; border-top: 1px solid #e5e7eb; padding-top: 6px; margin-top: 6px;">
                <span>الرصيد المتبقي (دَيْن):</span>
                <span>${rem.toLocaleString()} دج</span>
              </div>
            </div>
          </div>

          <div class="footer">قسيمة مراجعة رسمية - الملحق السحابي للأعمال</div>
        </body>
      </html>
    `;

    const pWin = window.open("", "_blank");
    if (pWin) {
      pWin.document.write(html);
      pWin.document.close();
    } else {
      onTriggerNotification("يرجى تفعيل النوافذ المنبثقة للطباعة", "warning");
    }
  };

  // Keyboard layout Print triggers
  const printRef = useRef<() => void>(() => {});
  useEffect(() => {
    printRef.current = () => {
      if (selectedSupplierId && selectedSupplier) {
        if (selectedInvoiceIndex !== null && filteredInvoices[selectedInvoiceIndex]) {
          handlePrintInvoiceSingle(filteredInvoices[selectedInvoiceIndex]);
        } else {
          handlePrintSupplier();
        }
      }
    };
  });

  useEffect(() => {
    const handleKeyP = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;

      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        printRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyP);
    return () => window.removeEventListener("keydown", handleKeyP);
  }, []);

  // Keyboard navigation through invoice list inside supplier details
  useEffect(() => {
    const handleKeyDownInvoiceDetails = (e: KeyboardEvent) => {
      if (!selectedSupplierId) return;

      const active = document.activeElement;
      if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) {
        if (e.key === "Escape") {
          e.preventDefault();
          (active as HTMLElement).blur();
        }
        return;
      }

      const totalItems = filteredInvoices.length;
      if (totalItems === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedInvoiceIndex(prev => {
          if (prev === null) return 0;
          return Math.min(prev + 1, totalItems - 1);
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedInvoiceIndex(prev => {
          if (prev === null || prev === 0) return 0;
          return prev - 1;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        // Option to toggle details if highlighted
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedSupplierId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDownInvoiceDetails);
    return () => window.removeEventListener("keydown", handleKeyDownInvoiceDetails);
  }, [selectedSupplierId, filteredInvoices]);

  return (
    <div className="space-y-6 pt-16 md:pt-4 text-right" dir="rtl" id="suppliers_dashboard_root">
      
      {/* Visual Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#09090b] border border-zinc-900 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Landmark className="w-6 h-6 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">إدارة الشركاء والموردين</h1>
            <p className="text-xs text-zinc-400 mt-1">
              تسجيل بيانات الموردين، رصد فواتير التوريد، تتبع المدفوعات وتصفية الذمم المالية والتراكمية.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 3.1 ADD/EDIT FORM (4 Columns) */}
        <div className="lg:col-span-4 bg-[#09090b] border border-zinc-900 rounded-xl shadow-lg p-5 flex flex-col gap-4">
          <div className="border-b border-zinc-850 pb-2">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-550" />
              <span>{editingId ? "تعديل معلومات المورد" : "تسجيل مورد جديد"}</span>
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">يرجى ملأ البيانات بدقة</p>
          </div>

          <form onSubmit={handleAddSupplier} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-400 font-bold">اسم المورد / الشركة الشريكة *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: شركة النسيج الوطنية"
                className="bg-[#040406] border border-zinc-850 focus:border-amber-500/35 rounded-lg px-3 py-2 text-xs font-semibold text-white outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-400 font-bold">رقم الهاتف المميز</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 0550123456"
                className="bg-[#040406] border border-zinc-850 focus:border-amber-500/35 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-400 font-bold">العنوان الفعلي للشركة</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: المنطقة الصناعية الجزائر"
                className="bg-[#040406] border border-zinc-850 focus:border-amber-500/35 rounded-lg px-3 py-2 text-xs text-white outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-400 font-bold">البريد الإلكتروني للذكاء والاتصال</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="مثال: supplier@domain.com"
                className="bg-[#040406] text-left border border-zinc-850 focus:border-amber-500/35 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none transition-all"
              />
            </div>

            {/* Actions group inside form */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-850">
              <button
                type="submit"
                className="flex-1 py-2 rounded-lg text-xs font-black shadow-lg bg-amber-650 hover:bg-amber-600 transition-all text-black flex items-center justify-center gap-1.5"
              >
                {editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? "تحديث المورد" : "إضافة مورد جديد"}</span>
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-800 transition-all"
                >
                  إلغاء لغرض التعديل
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 3.2 & 3.3 DIRECTORY AND SUPPLIERS LIST (8 Columns) */}
        <div className="lg:col-span-8 bg-[#09090b] border border-zinc-900 rounded-xl shadow-lg p-5 flex flex-col gap-4">
          
          {/* 3.2 Search Filter Box */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-black text-white">دليل الشركاء والموردين الكلي</h2>
              <p className="text-[10px] text-zinc-450 mt-0.5">انقر على أي صف لاستعراض تفاصيل الفواتير والمدفوعات الشاملة</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute top-2.5 right-3" />
              <input
                type="text"
                placeholder="ابحث بالاسم، الهاتف، العنوان أو البريد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#040406] border border-zinc-850 rounded-lg py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-amber-500/40 select-all"
              />
            </div>
          </div>

          {/* 3.3 Supplier Table */}
          <div className="overflow-x-auto border border-zinc-850 rounded-xl">
            <table className="w-full text-right bg-black/25">
              <thead>
                <tr className="bg-zinc-950/60 text-[10px] text-zinc-450 border-b border-zinc-850">
                  <th className="p-3 text-center w-12">#</th>
                  <th className="p-3">الاسم الكامل لجهة التوريد</th>
                  <th className="p-3">رقم الهاتف</th>
                  <th className="p-3">العنوان</th>
                  <th className="p-3">البريد</th>
                  <th className="p-3 text-center">أضيف بتاريخ</th>
                  <th className="p-3 text-center">المشتريات</th>
                  <th className="p-3 text-left">قيمة الدفعة الكلية</th>
                  <th className="p-3 text-center w-24">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 text-xs">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-7 text-center text-zinc-500 font-medium">
                      لا يوجد أي موردين مسجلين يطابقون استعلامك الحالي.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s, idx) => {
                    const stats = getPurchaseStats(s.name);
                    return (
                      <tr 
                        key={s.id}
                        onClick={() => setSelectedSupplierId(s.id)}
                        className="hover:bg-zinc-950/40 transition-all cursor-pointer"
                      >
                        <td className="p-3 text-center font-mono text-zinc-500">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-100">{s.name}</td>
                        <td className="p-3 font-mono text-zinc-300">{s.phone || "—"}</td>
                        <td className="p-3 text-zinc-350">{s.address || "—"}</td>
                        <td className="p-3 font-mono text-zinc-400 text-left">{s.email || "—"}</td>
                        <td className="p-3 text-center text-zinc-500 font-mono">{s.dateAdded || "—"}</td>
                        <td className="p-3 text-center">
                          <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 rounded text-zinc-300 font-bold font-mono text-[10.5px]">
                            {stats.count}
                          </span>
                        </td>
                        <td className="p-3 text-left font-mono font-black text-[#50e3c2]">
                          {stats.total.toLocaleString()} دج
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSupplierId(s.id);
                              }}
                              className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 hover:border-amber-500/30 text-amber-500 rounded transition-all"
                              title="استعراض التفاصيل المالية"
                            >
                              👁️
                            </button>
                            <button
                              onClick={(e) => handleEditSupplierClick(e, s)}
                              className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 hover:border-blue-500/30 text-blue-400 rounded transition-all"
                              title="تعديل بيانات المورد"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => handleDeleteSupplierClick(e, s.id)}
                              className="p-1 px-1.5 bg-zinc-900 border border-zinc-800 hover:border-red-500/30 text-red-400 rounded transition-all"
                              title="إقصاء المورد"
                            >
                              🗑️
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

      </div>

      {/* CONFIRM SUPPLIER DELETION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-850 rounded-xl p-5 text-right relative shadow-2xl">
            <h3 className="text-sm font-black text-rose-450 border-b border-zinc-850 pb-2 flex items-center gap-1.5 mb-3.5">
              <span>⚠️ تأكيد حذف المورد المعتمد</span>
            </h3>
            
            <p className="text-xs text-zinc-300 mb-5 leading-relaxed">
              إن حذف المورد لن يعطل فواتير التوريد المرتبطة به ولكن سيتم إلغاء المزامنة الشخصية معه مباشرةً. هل أنت متأكد؟
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg text-xs font-bold hover:text-white"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-650 hover:bg-rose-600 text-white rounded-lg text-xs font-black shadow-lg"
              >
                نعم، احذف المورد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. DETAILED SUPPLIER VIEW POPUP MODAL ==================== */}
      {selectedSupplierId && selectedSupplier && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-[#09090b] border border-zinc-900 shadow-2xl rounded-2xl flex flex-col p-6 relative max-h-[92vh] text-right text-slate-100" id="supplier_extended_modal">
            
            {/* 4.1 Detail Header Banner */}
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900 flex-row-reverse" id="modal_supplier_head">
              <button
                onClick={() => setSelectedSupplierId(null)}
                className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-zinc-450 rounded-lg border border-zinc-800 text-xs font-black"
              >
                X
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrintSupplier}
                  className="px-3 py-1.5 bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-650 hover:text-white transition-all rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  title="استخراج التقرير الشامل"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف الحساب الكلي للمورد</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-505/10 rounded-lg border border-amber-500/15">
                  <Building2 className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{selectedSupplier.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono"><Phone className="w-3 h-3 text-zinc-500" /> {selectedSupplier.phone || "بدون هاتف"}</span>
                    {selectedSupplier.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-zinc-500" /> {selectedSupplier.address}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Scrollable Panels Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto py-5 flex-1 pr-1">
              
              {/* 4.2 BILLS & INVOICES MANAGEMENT (8 Columns List) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                      <span>قسيمة الفواتير والمشتريات المرتبطة</span>
                    </span>

                    {/* Invoice Search Bar */}
                    <div className="relative w-52">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute top-2 right-2.5" />
                      <input
                        type="text"
                        placeholder="ابحث برقم الفاتورة..."
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        className="w-full bg-[#040406] border border-zinc-900 py-1 px-3 pr-8 rounded text-[11px] text-white outline-none focus:border-amber-500/40"
                      />
                    </div>
                  </div>

                  {/* Filtered invoices layout */}
                  <div className="space-y-3">
                    {filteredInvoices.length === 0 ? (
                      <p className="text-center text-zinc-500 py-6 text-xs">لم يسجل فواتير توريد تحت استعلام البحث هذا.</p>
                    ) : (
                      filteredInvoices.map((po, idx) => {
                        const paid = (po.payments ?? []).reduce((s, p) => s + p.amount, 0);
                        const rem = po.total - paid;
                        const isExpanded = selectedInvoiceIndex === idx;

                        return (
                          <div 
                            key={po.id} 
                            onClick={() => setSelectedInvoiceIndex(isExpanded ? null : idx)}
                            className={`border rounded-xl transition-all cursor-pointer ${isExpanded ? "bg-[#040406] border-amber-500/25 " : "bg-black/35 border-zinc-900 hover:border-zinc-800"}`}
                          >
                            {/* Short Summary Bar */}
                            <div className="p-3.5 flex flex-wrap justify-between items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-350 text-[10px] font-bold font-mono rounded">
                                  INV-{po.invoiceNumber}
                                </span>
                                <span className="text-[10.5px] font-mono text-zinc-500">{po.date}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-white font-mono">{po.total.toLocaleString()} دج</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rem > 0 ? "bg-rose-500/10 text-rose-450" : "bg-emerald-500/15 text-[#50e3c2]"}`}>
                                  {rem > 0 ? `متبقي: ${rem.toLocaleString()} دج` : "مدفوع بالكامل"}
                                </span>
                              </div>
                            </div>

                            {/* Expanded checklist of Items */}
                            {isExpanded && (
                              <div className="p-4 pt-0 border-t border-zinc-900 space-y-3.5 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <div className="overflow-x-auto border border-zinc-900 rounded-lg max-h-48 overflow-y-auto mt-3">
                                  <table className="w-full text-right table-fixed leading-relaxed">
                                    <thead>
                                      <tr className="bg-zinc-950/50 text-[9px] text-zinc-500 border-b border-zinc-900">
                                        <th className="p-2 w-1/3">صنف المنتج</th>
                                        <th className="p-2 text-center">اللون</th>
                                        <th className="p-2 text-center">المقاس</th>
                                        <th className="p-2 text-center">الكمية</th>
                                        <th className="p-2 text-center">سعر التكلفة</th>
                                        <th className="p-2 text-left">قيمة البند</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-900 text-[11px] text-zinc-300">
                                      {po.items.map((it, iKey) => (
                                        <tr key={iKey} className="hover:bg-zinc-900/10">
                                          <td className="p-2 font-black truncate text-slate-100">{it.productName}</td>
                                          <td className="p-2 text-center font-bold text-zinc-400">{it.color || "—"}</td>
                                          <td className="p-2 text-center font-mono font-medium">{it.size || "—"}</td>
                                          <td className="p-2 text-center font-mono text-amber-500 font-bold">{it.quantity}</td>
                                          <td className="p-2 text-center font-mono">{it.costPrice.toLocaleString()} دج</td>
                                          <td className="p-2 text-left font-mono font-bold text-emerald-400">{(it.costPrice * it.quantity).toLocaleString()} دج</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Expanded invoice Footer */}
                                <div className="flex flex-wrap items-center justify-between border-t border-zinc-900 pt-3 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900 gap-3">
                                  <div className="flex flex-wrap gap-4 text-xs">
                                    <p className="text-zinc-500">المجموع: <strong className="text-white font-mono">{po.total.toLocaleString()} دج</strong></p>
                                    <p className="text-zinc-500">المدفوع: <strong className="text-emerald-400 font-mono">{paid.toLocaleString()} دج</strong></p>
                                    <p className="text-zinc-500">المتبقي: <strong className={`font-mono ${rem > 0 ? "text-rose-400" : "text-emerald-400"}`}>{rem.toLocaleString()} دج</strong></p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handlePrintInvoiceSingle(po)}
                                      className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 hover:text-white border border-zinc-805 rounded transition-all text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="طبع القسيمة"
                                    >
                                      <Printer className="w-3 h-3" />
                                      <span>طباعة الفاتورة</span>
                                    </button>

                                    {rem > 0 && (
                                      <div className="flex items-center gap-1.5 border-r border-zinc-900 pr-2">
                                        <input
                                          type="number"
                                          placeholder="أدخل مبلغ الدفع..."
                                          value={payPOAmounts[po.id] || ""}
                                          onChange={(e) => setPayPOAmounts({ ...payPOAmounts, [po.id]: e.target.value })}
                                          className="bg-[#040406] border border-zinc-900 rounded p-1 text-[11px] font-mono text-center text-white w-24 outline-none"
                                        />
                                        <button
                                          onClick={() => handlePayPO(po.id, Number(payPOAmounts[po.id] || "0"))}
                                          className="bg-emerald-650 hover:bg-emerald-600 text-black px-2.5 py-1 rounded text-[10px] font-black transition-all cursor-pointer"
                                        >
                                          إضافة دفعة
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* 4.3 GENERAL SUPPLIER PAYMENTS MANAGER (4 Columns) */}
              <div className="lg:col-span-4 bg-[#0a0a0c] border border-zinc-900 rounded-xl p-4 flex flex-col gap-4">
                <div className="border-b border-zinc-900 pb-2">
                  <span className="text-xs font-black text-emerald-450 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-555 rounded-full" />
                    <span>إدخال المدفوعات التراكمية العامة</span>
                  </span>
                  <p className="text-[9.5px] text-zinc-500 mt-0.5">تسوية الديون وتعديل القيود والوصولات</p>
                </div>

                {/* Form to submit general payments */}
                <form onSubmit={handleAddPayment} className="space-y-3.5 bg-black/40 p-3.5 border border-zinc-900 rounded-xl">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-450 font-bold">تاريخ وتوطين الدفعة</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="bg-[#040406] border border-zinc-900 p-2 rounded text-xs text-white text-center font-mono outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-455 font-bold">مبلغ الحوالة المالي *</label>
                    <input
                      type="number"
                      required
                      placeholder="أدخل المبلغ بدقة..."
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="bg-[#040406] border border-zinc-900 p-2 rounded text-xs text-center font-mono text-white font-bold outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-1.8 bg-emerald-650 hover:bg-emerald-600 text-black rounded text-[11px] font-black transition-all shadow-md"
                    >
                      {editingPaymentId ? "حفظ التعديل" : "إضافة الدفعة العامة"}
                    </button>
                    {editingPaymentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPaymentId(null);
                          setPaymentAmount("");
                        }}
                        className="px-2 py-1.8 bg-zinc-900 text-zinc-300 rounded border border-zinc-800 text-[10.5px] font-semibold"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>
                </form>

                {/* Payments Log Ledger Table */}
                <div className="flex-1 overflow-y-auto max-h-56 border border-zinc-900 rounded-lg">
                  <table className="w-full text-right bg-zinc-950/20 leading-relaxed">
                    <thead>
                      <tr className="bg-zinc-950 text-[9px] text-zinc-550 border-b border-zinc-900">
                        <th className="p-2">تاريخ الدفعة</th>
                        <th className="p-2 text-center">المبلغ دج</th>
                        <th className="p-2 text-left w-14">تحرير</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-[11px] font-mono">
                      {supplierPayments.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-zinc-600 font-medium">لم يتم تسجيل أي وصولات سداد حتى الآن.</td>
                        </tr>
                      ) : (
                        supplierPayments.map((p, pIdx) => (
                          <tr key={p.id || pIdx} className="hover:bg-zinc-900/15">
                            <td className="p-2 text-zinc-400">{p.date}</td>
                            <td className="p-2 text-center text-emerald-400 font-black">{p.amount.toLocaleString()} دج</td>
                            <td className="p-2">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleEditPayment(p)}
                                  className="text-blue-400 hover:text-white"
                                  title="تعديل"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(p.id)}
                                  className="text-red-400 hover:text-white"
                                  title="حذف"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* 4.4 BOTTOM FINANCIAL STATISTICS AND SAVE CARD */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-zinc-900 gap-4 mt-1 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-905">
              
              <div className="grid grid-cols-3 gap-3 w-full sm:w-auto text-center" id="summary_strip">
                
                {/* Debts Total */}
                <div className="bg-rose-500/10 border border-rose-500/20 p-2 px-4 rounded-xl">
                  <span className="text-[10px] text-rose-350 block font-bold mb-0.5">الرصيد المتبقي (الديون)</span>
                  <span className="text-sm font-black text-rose-450 font-mono">
                    {debts.toLocaleString()} <span className="text-[9px]">دج</span>
                  </span>
                </div>

                {/* Paid Total */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 px-4 rounded-xl">
                  <span className="text-[10px] text-emerald-350 block font-bold mb-0.5">إجمالي المدفوعات المسددة</span>
                  <span className="text-sm font-black text-[#50e3c2] font-mono">
                    {totalPaymentsAmount.toLocaleString()} <span className="text-[9px]">دج</span>
                  </span>
                </div>

                {/* Purchases Total */}
                <div className="bg-blue-500/10 border border-blue-500/20 p-2 px-4 rounded-xl">
                  <span className="text-[10px] text-blue-350 block font-bold mb-0.5">إجمالي المشتريات الكلية</span>
                  <span className="text-sm font-black text-blue-400 font-mono">
                    {totalPurchasesAmount.toLocaleString()} <span className="text-[9px]">دج</span>
                  </span>
                </div>

              </div>

              {/* Close and return to core board */}
              <button
                onClick={() => setSelectedSupplierId(null)}
                className="w-full sm:w-36 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl text-xs font-bold transition-all border border-zinc-700 shadow-md flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ وإغلاق نافذة المورد</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
