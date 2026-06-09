/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Order, Product, LanguageType, OrderItem, 
  BasicInventoryItem, SubInventoryItem, ReturnInventoryItem, BusinessProfile 
} from "../types";
import { translations } from "../translations";
import { 
  Search, Filter, Plus, Printer, FileText, Trash2, Edit2, 
  X, Check, AlertTriangle, ArrowRightLeft, Info, Copy, DollarSign, RefreshCw, Undo, Eye
} from "lucide-react";
import { 
  mutateInventoryForNewOrder, revertInventoryForOrder, 
  addOrderToReturnInventory, removeOrderFromReturnInventory, 
  getWorkers, getAppSettings, getOrders, saveOrders
} from "../storageUtils";

import { default69Wilayas, getCommunesForWilaya } from "../wilayasData";

const DELIVERY_COMPANIES = [
  "Yalidine", "Noest", "Maystro Delivery", "ZR Express", "Amena", "Eco", "Autre"
];

interface OrdersViewProps {
  orders: Order[];
  onSaveOrders: (arr: Order[]) => void;
  products: Product[];
  basicInventory: BasicInventoryItem[];
  subInventory: SubInventoryItem[];
  returnInventory: ReturnInventoryItem[];
  lang: LanguageType;
  businessName: string;
  profile?: BusinessProfile | null;
  onSoftDelete: (id: string) => void;
  onTriggerNotification: (msg: string) => void;
}

export default function OrdersView({
  orders,
  onSaveOrders,
  products,
  basicInventory,
  subInventory,
  returnInventory,
  lang,
  businessName,
  profile,
  onSoftDelete,
  onTriggerNotification
}: OrdersViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // Interactive Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wilayaFilter, setWilayaFilter] = useState("all");

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form individual variables
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState(default69Wilayas[15]); // Default Algiers
  const [commune, setCommune] = useState("");
  const [isManualCommune, setIsManualCommune] = useState(false);

  // Computed Communes list for the selected Wilaya, including custom commune if any is present
  const communesList = useMemo(() => {
    const defaultCommunes = getCommunesForWilaya(selectedWilaya);
    if (commune && !defaultCommunes.includes(commune)) {
      return [commune, ...defaultCommunes];
    }
    return defaultCommunes;
  }, [selectedWilaya, commune]);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryCompany, setDeliveryCompany] = useState("Yalidine");

  // Custom persistent delivery companies dropdown options
  const [customDeliveryCompanies, setCustomDeliveryCompanies] = useState<string[]>(() => {
    const defaults = ["Yalidine", "Noest", "Maystro Delivery", "ZR Express"];
    try {
      const saved = localStorage.getItem("corevia_custom_delivery_companies_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...defaults, ...parsed]));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaults;
  });

  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const handleSaveNewCompany = () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed) {
      setIsAddingCompany(false);
      return;
    }
    
    if (customDeliveryCompanies.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      onTriggerNotification(
        lang === "ar"
          ? "هذه الشركة مسجلة بالفعل!"
          : "Cette entreprise existe déjà!"
      );
      const found = customDeliveryCompanies.find(c => c.toLowerCase() === trimmed.toLowerCase());
      if (found) {
        setDeliveryCompany(found);
      }
      setIsAddingCompany(false);
      setNewCompanyName("");
      return;
    }

    const newList = [...customDeliveryCompanies, trimmed];
    setCustomDeliveryCompanies(newList);
    localStorage.setItem("corevia_custom_delivery_companies_v1", JSON.stringify(newList));
    setDeliveryCompany(trimmed);
    setIsAddingCompany(false);
    setNewCompanyName("");
    
    onTriggerNotification(
      lang === "ar"
        ? `تمت إضافة شركة التوصيل (${trimmed}) بنجاح`
        : `Société de livraison (${trimmed}) ajoutée`
    );
  };

  const [deliveryType, setDeliveryType] = useState("Home (المنزل)");
  const [deliveryPrice, setDeliveryPrice] = useState(600);
  const [paidAmount, setPaidAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [customerPaysDelivery, setCustomerPaysDelivery] = useState(true);
  
  // Custom states matching user specs
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [isExchange, setIsExchange] = useState(false);
  const [exchangeOrderRef, setExchangeOrderRef] = useState("");
  const [agentName, setAgentName] = useState("");
  const [source, setSource] = useState<"1" | "2" | "3">("1");
  const [status, setStatus] = useState<"pending" | "delivered" | "returned">("pending");
  const [returnCost, setReturnCost] = useState(300);
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  
  // Repeating Product list array
  const [orderItemsList, setOrderItemsList] = useState<OrderItem[]>([]);

  // Ref to track if manual paid amount changed
  const paidTouched = useRef(false);

  // Field validation visual error boundaries
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  // Local state for undo fast countdown
  const [undoActiveOrder, setUndoActiveOrder] = useState<Order | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(5000);
  const undoInterval = useRef<any>(null);

  // Clearance confirmation dialog
  const [debtSettleConfirm, setDebtSettleConfirm] = useState<{ clientName: string } | null>(null);

  // Computed delivery companies list including the currently selected value if not present
  const renderedDeliveryCompanies = useMemo(() => {
    const list = [...customDeliveryCompanies];
    if (deliveryCompany && !list.includes(deliveryCompany)) {
      list.push(deliveryCompany);
    }
    return list;
  }, [customDeliveryCompanies, deliveryCompany]);

  // Global suggestion lists built from state
  const clientsNames = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.customerName).filter(Boolean)));
  }, [orders]);

  const clientsPhones = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.phone).filter(Boolean)));
  }, [orders]);

  const workersNames = useMemo(() => {
    const list = getWorkers().map(w => w.name);
    orders.forEach(o => {
      if (o.agentName) list.push(o.agentName);
    });
    return Array.from(new Set(list));
  }, [orders]);

  const allModels = useMemo(() => {
    const list = products.map(p => p.name);
    basicInventory.forEach(bi => list.push(bi.productName));
    subInventory.forEach(si => list.push(si.productName));
    returnInventory.forEach(ri => list.push(ri.productName));
    return Array.from(new Set(list)).filter(Boolean);
  }, [products, basicInventory, subInventory, returnInventory]);

  // Handle auto order numbering sequence
  const getNextOrderNumber = (): string => {
    const nums = orders.map(o => {
      const match = o.id.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const maxNum = nums.length > 0 ? Math.max(...nums) : 1000;
    return `ORD-${maxNum + 1}`;
  };

  const [customOrderId, setCustomOrderId] = useState("");

  // Get customer historical cumulative debt excluding current invoice
  const getCustomerDebt = (name: string, excludeOrderId?: string): number => {
    if (!name) return 0;
    return orders
      .filter(o => o.customerName === name && o.id !== excludeOrderId)
      .reduce((sum, o) => {
        const total = o.totalPrice + (o.customerPaysDelivery ? o.deliveryPrice : 0) - o.discount;
        const remaining = Math.max(0, total - o.paidAmount);
        return sum + remaining;
      }, 0);
  };

  // Check available stock helper
  const getAvailableStock = (modelName: string, color: string, size: string, src: "1" | "2" | "3"): number => {
    if (!modelName || !color) return 0;
    const prod = products.find(p => p.name === modelName);
    
    if (src === "1") {
      if (!prod) return 0;
      const b = basicInventory.find(x => x.productId === prod.id && x.color === color);
      return b ? b.quantity : 0;
    } else if (src === "2") {
      if (!prod || !size) return 0;
      const s = subInventory.find(x => x.productId === prod.id && x.color === color && x.size === size);
      return s ? s.quantity : 0;
    } else if (src === "3") {
      if (!size) return 0;
      const r = returnInventory.find(x => x.productName === modelName && x.color === color && x.size === size);
      return r ? r.quantity : 0;
    }
    return 0;
  };

  // Keyboard Shortcuts: Press "P" without ctrl. Prints form if open, or the first order in table.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if interactive element is active typing
      const active = document.activeElement;
      if (active && (
        active.tagName === "INPUT" || 
        active.tagName === "TEXTAREA" || 
        active.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      if (e.key.toLowerCase() === "p" && !(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) {
        e.preventDefault();
        if (showForm) {
          triggerFormPrint();
        } else if (filteredOrders.length > 0) {
          handlePrintOrder(filteredOrders[0], true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showForm, orderItemsList, customerName, phone, selectedWilaya, commune, 
    deliveryLocation, deliveryCompany, deliveryType, deliveryPrice, discount, 
    paidAmount, isExchange, exchangeOrderRef, agentName, notes, orders, products
  ]);

  // Reset form helper
  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    const defaultW = default69Wilayas[15];
    setSelectedWilaya(defaultW);
    const firstCommune = getCommunesForWilaya(defaultW)[0] || "";
    setCommune(firstCommune);
    setIsManualCommune(false);
    setDeliveryLocation("");
    setDeliveryCompany("Yalidine");
    setDeliveryType("Home (المنزل)");
    setDeliveryPrice(600);
    setPaidAmount(0);
    setDiscount(0);
    setCustomerPaysDelivery(true);
    setFreeDelivery(false);
    setIsExchange(false);
    setExchangeOrderRef("");
    setAgentName("");
    setSource("1");
    setStatus("pending");
    setReturnCost(300);
    setReturnDate("");
    setNotes("");
    setOrderItemsList([]);
    setEditingId(null);
    setFieldErrors({});
    paidTouched.current = false;
  };

  // Populate first blank item inside dynamically nested order list when opening form
  const addItem = () => {
    setOrderItemsList(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: "",
        productName: "",
        color: "",
        size: "",
        quantity: 1,
        productCost: 0,
        sellingPrice: 0,
        itemSource: undefined
      } as any
    ]);
  };

  const updateItem = (idx: number, fields: Partial<OrderItem> & { itemSource?: "1" | "2" | "3" }) => {
    setOrderItemsList(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...fields };
      return copy;
    });
  };

  // Form autosave to LocalStorageDraft
  useEffect(() => {
    if (showForm) {
      const draftObj = {
        customerName, phone, wilaya: selectedWilaya, commune, deliveryLocation,
        deliveryCompany, deliveryType, deliveryPrice, paidAmount, discount,
        customerPaysDelivery, isExchange, exchangeOrderRef, agentName, source,
        status, returnCost, returnDate, notes, items: orderItemsList, customOrderId
      };
      localStorage.setItem("orderFormDraft", JSON.stringify(draftObj));
    }
  }, [
    showForm, customerName, phone, selectedWilaya, commune, deliveryLocation,
    deliveryCompany, deliveryType, deliveryPrice, paidAmount, discount,
    customerPaysDelivery, isExchange, exchangeOrderRef, agentName, source,
    status, returnCost, returnDate, notes, orderItemsList, customOrderId
  ]);

  // Load draft on mount / opening of form if any exists
  const checkForDraft = () => {
    const draftStr = localStorage.getItem("orderFormDraft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setCustomerName(draft.customerName || "");
        setPhone(draft.phone || "");
        const draftW = draft.wilaya || default69Wilayas[15];
        const draftC = draft.commune || "";
        setSelectedWilaya(draftW);
        setCommune(draftC);
        setIsManualCommune(draftC ? !getCommunesForWilaya(draftW).includes(draftC) : false);
        setDeliveryLocation(draft.deliveryLocation || "");
        setDeliveryCompany(draft.deliveryCompany || "Yalidine");
        setDeliveryType(draft.deliveryType || "Home (المنزل)");
        setDeliveryPrice(draft.deliveryPrice || 600);
        setPaidAmount(draft.paidAmount || 0);
        setDiscount(draft.discount || 0);
        setCustomerPaysDelivery(draft.customerPaysDelivery !== false);
        setFreeDelivery(!draft.customerPaysDelivery);
        setIsExchange(!!draft.isExchange);
        setExchangeOrderRef(draft.exchangeOrderRef || "");
        setAgentName(draft.agentName || "");
        setSource(draft.source || "1");
        setStatus(draft.status || "pending");
        setReturnCost(draft.returnCost || 300);
        setReturnDate(draft.returnDate || "");
        setNotes(draft.notes || "");
        setOrderItemsList(draft.items || []);
        setCustomOrderId(draft.customOrderId || "");
        
        localStorage.removeItem("orderFormDraft");
        onTriggerNotification("تمت استعادة مسودة العمل السابقة بنجاح.");
      } catch (e) {
        console.error("Failed restoring draft", e);
      }
    }
  };

  // Open creation form setup
  const handleOpenAddForm = () => {
    resetForm();
    setCustomOrderId(getNextOrderNumber());
    setShowForm(true);
    checkForDraft();
    // Guarantee at least 1 item
    setTimeout(() => {
      setOrderItemsList(prev => prev.length === 0 ? [{
        id: `it-${Date.now()}`,
        productId: "",
        productName: "",
        color: "",
        size: "",
        quantity: 1,
        productCost: 0,
        sellingPrice: 0
      } as any] : prev);
    }, 50);
  };

  // Client name autofill hook
  const handleClientNameChange = (name: string) => {
    setCustomerName(name);
    if (!name) return;
    
    // Find last matching client order
    const lastOrder = [...orders].reverse().find(o => o.customerName === name);
    if (lastOrder) {
       setPhone(lastOrder.phone || "");
       const targetW = lastOrder.wilaya || default69Wilayas[15];
       const targetC = lastOrder.commune || "";
       setSelectedWilaya(targetW);
       setCommune(targetC);
       setIsManualCommune(targetC ? !getCommunesForWilaya(targetW).includes(targetC) : false);
       setDeliveryLocation(lastOrder.deliveryLocation || "");
       setDeliveryCompany(lastOrder.deliveryCompany || "Yalidine");
       setDeliveryPrice(lastOrder.deliveryPrice || 600);
       setNotes(lastOrder.notes || "");
       onTriggerNotification(`تم استيراد بيانات الزبون ${name} السابقة تلقائياً.`);
    }
  };

  // Client phone autofill hook
  const handleClientPhoneChange = (tel: string) => {
    setPhone(tel);
    if (!tel) return;

    const lastOrder = [...orders].reverse().find(o => o.phone === tel);
    if (lastOrder) {
       setCustomerName(lastOrder.customerName || "");
       const targetW = lastOrder.wilaya || default69Wilayas[15];
       const targetC = lastOrder.commune || "";
       setSelectedWilaya(targetW);
       setCommune(targetC);
       setIsManualCommune(targetC ? !getCommunesForWilaya(targetW).includes(targetC) : false);
       setDeliveryLocation(lastOrder.deliveryLocation || "");
       setDeliveryCompany(lastOrder.deliveryCompany || "Yalidine");
       setDeliveryPrice(lastOrder.deliveryPrice || 600);
       setNotes(lastOrder.notes || "");
       onTriggerNotification(`تم استيراد بيانات صاحب الموبايل تلقائياً.`);
    }
  };

  // Calculate items total sum dynamically
  const itemsTotalSum = useMemo(() => {
    return orderItemsList.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  }, [orderItemsList]);

  // Grand total sum
  const grandTotalComputed = useMemo(() => {
    const shipFee = freeDelivery ? 0 : deliveryPrice;
    return Math.max(0, itemsTotalSum + shipFee - discount);
  }, [itemsTotalSum, freeDelivery, deliveryPrice, discount]);

  // Real-time automatic adjustment of paidAmount unless user edits manually
  useEffect(() => {
    if (!paidTouched.current) {
      setPaidAmount(grandTotalComputed);
    }
  }, [grandTotalComputed]);

  // Validation checks prior to submit
  const validateForm = (): boolean => {
    const errs: Record<string, boolean> = {};
    if (!customerName) errs.customerName = true;
    if (!phone) errs.phone = true;
    if (!commune) errs.commune = true;
    if (!customOrderId) errs.customOrderId = true;

    // Check items
    if (orderItemsList.length === 0) {
      onTriggerNotification("خطأ: يرجى إضافة منتج واحد على الأقل للطلبية!");
      return false;
    }

    let itemsInvalid = false;
    orderItemsList.forEach((it, idx) => {
      if (!it.productName) {
        onTriggerNotification(`المنتج #${idx + 1} يفتقد لاسم الموديل.`);
        itemsInvalid = true;
      }
      if (!it.color) {
        onTriggerNotification(`المنتج #${idx + 1} يفتقد لاختيار اللون.`);
        itemsInvalid = true;
      }
      
      const activeSrc = it.itemSource || source;
      const avStock = getAvailableStock(it.productName, it.color, it.size, activeSrc);
      if (it.quantity > avStock) {
        onTriggerNotification(`خطأ: الكمية المطلوبة للمنتج #${idx + 1} أكبر من المخزون المتوفر (${avStock} قطع).`);
        itemsInvalid = true;
      }
    });

    if (itemsInvalid) return false;

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Order logic (Adding or Editing)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      onTriggerNotification("يرجى ملء جميع الحقول المطلوبة ومراجعة الأخطاء باللون الأحمر.");
      return;
    }

    const nextId = customOrderId.trim();
    
    // Check duplication of ID if creating new order
    if (!editingId && orders.some(o => o.id === nextId)) {
      onTriggerNotification(`رقم الطلبية ${nextId} مستخدم بالفعل!`);
      return;
    }

    const orderData: Order = {
      id: nextId,
      date: new Date().toISOString().split("T")[0],
      customerName: customerName.trim(),
      phone: phone.trim(),
      wilaya: selectedWilaya,
      commune: commune.trim(),
      deliveryLocation: deliveryLocation.trim(),
      deliveryCompany,
      deliveryType,
      deliveryPrice,
      items: orderItemsList,
      totalPrice: itemsTotalSum,
      paidAmount,
      discount,
      customerPaysDelivery: !freeDelivery,
      isExchange,
      exchangeOrderRef: isExchange ? exchangeOrderRef : undefined,
      agentName: agentName || "Abdelhadi",
      source,
      status,
      returnCost: status === "returned" ? returnCost || 300 : undefined,
      returnDate: status === "returned" ? returnDate || new Date().toISOString().split("T")[0] : undefined,
      notes: notes.trim()
    };

    let updatedOrders = [...orders];

    if (editingId) {
      // 1. REVERSE inventory impact of old state
      const oldOrder = orders.find(x => x.id === editingId);
      if (oldOrder) {
        if (oldOrder.status === "returned") {
          removeOrderFromReturnInventory(oldOrder);
        } else {
          revertInventoryForOrder(oldOrder);
        }
      }

      // 2. Map editing details
      updatedOrders = updatedOrders.map(o => o.id === editingId ? orderData : o);
      onTriggerNotification(`تم تعديل الطلبية ${nextId} بنجاح!`);
    } else {
      // Insert new
      updatedOrders.unshift(orderData);
      onTriggerNotification(`تمت إضافة الطلبية ${nextId} المبيعات بنجاح!`);
    }

    // 3. APPLY new inventory impact
    if (status === "returned") {
      addOrderToReturnInventory(orderData);
    } else {
      mutateInventoryForNewOrder(orderData);
    }

    // Save and clear
    onSaveOrders(updatedOrders);
    localStorage.removeItem("orderFormDraft");
    setShowForm(false);
    resetForm();
  };

  // Edit action
  const handleEditOrder = (ord: Order) => {
    resetForm();
    onTriggerNotification(`جاري تعديل الطلبية رقم ${ord.id}...`);

    setCustomerName(ord.customerName);
    setPhone(ord.phone);
    setSelectedWilaya(ord.wilaya);
    setCommune(ord.commune);
    setIsManualCommune(ord.commune ? !getCommunesForWilaya(ord.wilaya).includes(ord.commune) : false);
    setDeliveryLocation(ord.deliveryLocation || "");
    setDeliveryCompany(ord.deliveryCompany);
    setDeliveryType(ord.deliveryType);
    setDeliveryPrice(ord.deliveryPrice);
    setPaidAmount(ord.paidAmount);
    setDiscount(ord.discount || 0);
    setCustomerPaysDelivery(ord.customerPaysDelivery);
    setFreeDelivery(!ord.customerPaysDelivery);
    setIsExchange(!!ord.isExchange);
    setExchangeOrderRef(ord.exchangeOrderRef || "");
    setAgentName(ord.agentName);
    setSource(ord.source);
    setStatus(ord.status);
    setReturnCost(ord.returnCost || 300);
    setReturnDate(ord.returnDate || "");
    setNotes(ord.notes || "");
    setOrderItemsList(ord.items);
    setCustomOrderId(ord.id);
    setEditingId(ord.id);
    
    paidTouched.current = true; // Avoid over-writing the user's manual records retrospectively
    setShowForm(true);
  };

  // Soft deletion handler with 5 seconds custom interactive countdown
  const initiateSoftDelete = (ord: Order) => {
    // Clear previous timer
    if (undoInterval.current) clearInterval(undoInterval.current);

    onSoftDelete(ord.id);
    setUndoActiveOrder(ord);
    setUndoTimeLeft(5000);

    // Set interactive visual ticking subtraction
    undoInterval.current = setInterval(() => {
      setUndoTimeLeft(prev => {
        if (prev <= 50) {
          clearInterval(undoInterval.current);
          setUndoActiveOrder(null);
          return 0;
        }
        return prev - 50;
      });
    }, 50);
  };

  // Restore action
  const handleUndoDeleteAction = () => {
    if (!undoActiveOrder) return;
    clearInterval(undoInterval.current);

    const allOrders = getOrders();
    // Re-insert
    const newOrders = [undoActiveOrder, ...allOrders];
    saveOrders(newOrders);

    // Recommit stock impact
    if (undoActiveOrder.status === "returned") {
      addOrderToReturnInventory(undoActiveOrder);
    } else {
      mutateInventoryForNewOrder(undoActiveOrder);
    }

    onSaveOrders(newOrders);
    onTriggerNotification("تم التراجع واستعادة الطلبية كلياً مع مستودعاتها.");
    setUndoActiveOrder(null);
  };

  // Change order status inline from Table
  const handleInlineStatusChange = (order: Order, newStatus: "pending" | "delivered" | "returned") => {
    if (order.status === newStatus) return;

    const updated = { ...order, status: newStatus };
    if (newStatus === "returned") {
      updated.returnCost = updated.returnCost || 300;
      updated.returnDate = new Date().toISOString().split("T")[0];
    } else {
      updated.returnCost = undefined;
      updated.returnDate = undefined;
    }

    // A. Revert old inventory effect
    if (order.status === "returned") {
      removeOrderFromReturnInventory(order);
    } else {
      revertInventoryForOrder(order);
    }

    // B. Inject new inventory effect
    if (newStatus === "returned") {
      addOrderToReturnInventory(updated);
    } else {
      mutateInventoryForNewOrder(updated);
    }

    // Save
    const list = orders.map(o => o.id === order.id ? updated : o);
    onSaveOrders(list);
    onTriggerNotification(`تمت تحديث الحالة للطلبية ${order.id} إلى ${
      newStatus === "pending" ? "قيد الإرسال" : newStatus === "delivered" ? "تسليم" : "مرجع"
    }`);
  };

  // Settle client cumulative debts instantly
  const handleSettleAllClientDebts = () => {
    if (!debtSettleConfirm) return;
    const client = debtSettleConfirm.clientName;

    const updated = orders.map(o => {
      if (o.customerName === client) {
        const due = o.totalPrice + (o.customerPaysDelivery ? o.deliveryPrice : 0) - o.discount;
        return { ...o, paidAmount: due };
      }
      return o;
    });

    onSaveOrders(updated);
    onTriggerNotification(`تم تسوية وتصفية جميع الذمم المالية المستحقة على الزبون: ${client}.`);
    setDebtSettleConfirm(null);
  };

  // Printable HTML invoice generator in new browser tab
  const handlePrintOrder = (ord: Order, simple: boolean) => {
    const win = window.open("", "_blank");
    if (!win) {
      onTriggerNotification("تم حظر النافذة المنبثقة من المتصفح! يرجى السماح بالنوافذ المنبثقة للطباعة.");
      return;
    }

    const previousClientDebt = simple ? 0 : getCustomerDebt(ord.customerName, ord.id);
    const invoiceTotalRaw = ord.totalPrice + (ord.customerPaysDelivery ? ord.deliveryPrice : 0) - ord.discount;
    const currentUnpaidAmount = Math.max(0, invoiceTotalRaw - ord.paidAmount);
    const totalConsolidatedDebt = previousClientDebt + currentUnpaidAmount;

    const itemsHtml = ord.items.map(it => {
      const sizeStr = it.size ? ` (القياس: ${it.size})` : "";
      const colorStr = it.color ? ` (اللون: ${it.color})` : "";
      const fullDescription = `${it.productName}${colorStr}${sizeStr}`;
      return `
        <tr>
          <td style="padding: 12px 15px; border-left: 2px solid var(--brand-color); border-right: 2px solid var(--brand-color); text-align: right; font-family: 'Cairo', sans-serif; font-weight: 700; color: var(--text-color);">${fullDescription}</td>
          <td style="padding: 12px 15px; border-left: 2px solid var(--brand-color); border-right: 2px solid var(--brand-color); text-align: center; font-weight: bold; font-family: monospace; color: var(--text-color);">${it.quantity}</td>
          <td style="padding: 12px 15px; border-left: 2px solid var(--brand-color); border-right: 2px solid var(--brand-color); text-align: center; font-weight: bold; font-family: monospace; color: var(--text-color);">${it.sellingPrice.toLocaleString()} دج</td>
          <td style="padding: 12px 15px; border-left: 2px solid var(--brand-color); border-right: 2px solid var(--brand-color); text-align: center; font-weight: bold; font-family: monospace; color: var(--text-color);">${(it.sellingPrice * it.quantity).toLocaleString()} دج</td>
        </tr>
      `;
    }).join("");

    const swapBannerHtml = ord.isExchange ? `
      <div style="border: 2px dashed #f97316; padding: 12px; border-radius: 8px; margin-bottom: 20px; color: #ea580c; font-weight: bold; text-align: center; background-color: #fff7ed; font-size: 12px; font-family: 'Cairo', sans-serif;">
         🔄 عملية استبدال معتمدة - المرجع: ${ord.exchangeOrderRef || "غير محدد"}
      </div>
    ` : "";

    const debtsAlertBoxHtml = (!simple && totalConsolidatedDebt > 0) ? `
      <div style="border: 2px solid var(--brand-color); background: #FAFDFB; border-radius: 0px; padding: 15px; margin-top: 20px; font-family: 'Cairo', sans-serif; page-break-inside: avoid;">
        <div style="font-weight: bold; color: var(--brand-color); font-size: 13px; border-bottom: 1px dashed var(--brand-color); padding-bottom: 6px; margin-bottom: 8px; text-align: right;">
          📊 سجل المستحقات والذمم المالية للزبون (${ord.customerName})
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-color); margin-bottom: 4px; flex-direction: row-reverse;">
          <span>الديون السابقة المستحقة وغير المسددة:</span>
          <strong>${previousClientDebt.toLocaleString()} دج</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-color); margin-bottom: 4px; flex-direction: row-reverse;">
          <span>المتبقي غير المدفوع من هذه الفاتورة الحالية:</span>
          <strong>${currentUnpaidAmount.toLocaleString()} دج</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: var(--brand-color); margin-top: 8px; border-top: 1px solid var(--brand-color); padding-top: 6px; flex-direction: row-reverse;">
          <span>إجمالي الديون التراكمية الكلية المستحقة للدفع:</span>
          <strong>${totalConsolidatedDebt.toLocaleString()} دج</strong>
        </div>
      </div>
    ` : "";

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>FACT_ORD_${ord.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@700&family=Cairo:wght@400;600;700;800;950&family=Inter:wght@400;600;700;800;900&display=swap');
          
          :root {
            --brand-color: #5B2C16;
            --text-color: #000000;
            --muted-color: #555555;
            --light-bg: #FAF6F4;
          }
          
          body { 
            font-family: 'Cairo', 'Inter', 'Segoe UI', system-ui, sans-serif; 
            margin: 20px auto; 
            padding: 0;
            max-width: 190mm;
            font-size: 13px; 
            color: var(--text-color); 
            line-height: 1.5; 
            background: #fff;
          }
          
          .table-items { 
            width: 100%; 
            border-collapse: collapse; 
            border: 2px solid var(--brand-color);
            margin-bottom: 25px;
          }
          .table-items th { 
            background-color: var(--brand-color); 
            color: #ffffff; 
            font-weight: 900; 
            padding: 12px 15px; 
            border: 2px solid var(--brand-color); 
            text-align: center;
            font-family: 'Inter', 'Cairo', sans-serif;
            font-size: 13px;
          }
          .table-items td { 
            padding: 10px 15px;
            border: 1px solid var(--brand-color);
            vertical-align: middle;
            font-size: 13px;
          }
          
          @media print {
            body { 
              margin: 10mm 15mm; 
              max-width: 100%;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.print(); }, 250)">
        
        <!-- 1. Top Business/Store Header Panel -->
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 30px;">
          <tr>
            <!-- Left Corner: Shop/Company logo & store details directly underneath -->
            <td style="width: 50%; border: none; vertical-align: top; text-align: left; padding: 0;">
              <!-- Logo Container: 120px by 120px keeping aspect ratio -->
              <div style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: flex-start; overflow: hidden; margin-bottom: 15px;">
                ${profile?.logoUrl ? `
                  <img src="${profile.logoUrl}" style="max-width: 120px; max-height: 120px; object-fit: contain; display: block;" alt="STORE LOGO" />
                ` : `
                  <div style="width: 120px; height: 120px; border: 2px dashed var(--brand-color); background-color: var(--light-bg); color: var(--brand-color); display: flex; align-items: center; justify-content: center; font-family: 'Cairo', sans-serif; font-size: 16px; font-weight: bold; border-radius: 6px;">
                    LOGO
                  </div>
                `}
              </div>
              
              <!-- Company Information Section under the logo -->
              <div style="font-family: 'Cairo', sans-serif; font-size: 12px; line-height: 1.6; text-align: right; direction: rtl; color: #111111;">
                <div style="font-size: 18px; font-weight: 800; color: var(--brand-color); margin-bottom: 4px;">${businessName}</div>
                <div><strong>مقر الشركة:</strong> ${profile?.address || "الجزائر العاصمة"}</div>
                <div><strong>TEL:</strong> ${profile?.phone || "0555 12 34 56"}</div>
                <div><strong>RC:</strong> ${profile?.rc1 || "16/00-0987654B20"} ${profile?.rc2 ? `/ ${profile.rc2}` : ""}</div>
                <div><strong>NIF:</strong> ${profile?.nif || "002016098765432"}</div>
              </div>
            </td>
            
            <!-- Right Corner: Huge FACTURE title & Invoice Metadata -->
            <td style="width: 50%; border: none; vertical-align: top; text-align: left; padding: 0;">
              <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <div style="font-size: 45px; font-weight: 900; color: var(--brand-color); letter-spacing: 1px; line-height: 1; margin-bottom: 15px; font-family: 'Inter', sans-serif;">FACTURE</div>
                <div style="font-size: 12.5px; line-height: 1.8; color: #111111; direction: rtr; text-align: left;">
                  <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px; color: var(--brand-color);">رقم الفاتورة: <span style="font-family: monospace;">#${ord.id}</span></div>
                  <div>تاريخ الفاتورة: <strong style="font-family: monospace;">${ord.date}</strong></div>
                  <div>طريقة الدفع: <strong style="font-family: 'Cairo', sans-serif;">الدفع عند الاستلام (COD)</strong></div>
                  <div>تاريخ الاستحقاق: <strong style="font-family: monospace;">${ord.date} (DUE UPON RECEIPT)</strong></div>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- 2. Customer Information Section - "Bill To" block -->
        <div style="background-color: var(--light-bg); border-right: 4px solid var(--brand-color); padding: 15px; margin-bottom: 30px; font-family: 'Cairo', sans-serif; direction: rtl;">
          <div style="font-family: 'Inter', 'Cairo', sans-serif; font-size: 13px; font-weight: 900; color: var(--brand-color); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">BILL TO</div>
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="border: none; padding: 0; font-size: 13.5px; line-height: 1.8; text-align: right; width: 60%; vertical-align: top;">
                <div><strong>اسم الزبون:</strong> ${ord.customerName}</div>
                <div><strong>رقم الهاتف:</strong> ${ord.phone}</div>
                <div><strong>الولاية:</strong> ${ord.wilaya} ${ord.commune ? `— ${ord.commune}` : ""}</div>
                ${ord.deliveryLocation ? `<div style="font-size: 12px; color: var(--muted-color); margin-top: 4px;"><strong>العنوان بالتفصيل:</strong> ${ord.deliveryLocation}</div>` : ""}
              </td>
              <td style="border: none; padding: 0; font-size: 12px; line-height: 1.8; text-align: left; width: 40%; vertical-align: top; font-family: 'Cairo', sans-serif;">
                <div><strong>حالة الطلبية:</strong> ${ord.status === "pending" ? "قيد الانتظار" : ord.status === "delivered" ? "تم التسليم ✅" : "مسترجعة ⚠️"}</div>
                <div><strong>شركة التوصيل:</strong> ${ord.deliveryCompany || "شركة افتراضية"}</div>
                <div><strong>نوع التوصيل:</strong> ${ord.deliveryType || "المنزل"}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- 3. Products Table with 4-columns layout: QTY | PRODUCT | UNIT PRICE | AMOUNT -->
        <table class="table-items">
          <thead>
            <tr>
              <th style="width: 12%;">الكمية / QTY</th>
              <th style="width: 53%; text-align: right;">اسم المنتج / PRODUCT</th>
              <th style="width: 17%;">سعر الوحدة / UNIT PRICE</th>
              <th style="width: 18%;">المبلغ / AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}

            <!-- SUBTOTAL Row -->
            <tr>
              <td colspan="2" style="border-top: 2px solid var(--brand-color); border-bottom: none; border-left: none; border-right: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; font-weight: 800; font-size: 12px; text-align: center; font-family: 'Inter', sans-serif; background-color: var(--light-bg); color: var(--brand-color);">
                SUBTOTAL
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; background-color: var(--light-bg); color: #111111;">
                ${ord.totalPrice.toLocaleString()} DA
              </td>
            </tr>

            <!-- DISCOUNT Row (if any) -->
            ${ord.discount > 0 ? `
            <tr>
              <td colspan="2" style="border: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; font-weight: 800; font-size: 12px; text-align: center; font-family: 'Inter', sans-serif; background-color: #fef2f2; color: #b91c1c;">
                DISCOUNT
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; background-color: #fef2f2; color: #b91c1c;">
                -${ord.discount.toLocaleString()} DA
              </td>
            </tr>
            ` : ""}

            <!-- DELIVERY COST Row -->
            <tr>
              <td colspan="2" style="border: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; font-weight: 800; font-size: 12px; text-align: center; font-family: 'Inter', sans-serif; background-color: var(--light-bg); color: var(--brand-color);">
                DELIVERY COST
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 10px 12px; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; background-color: var(--light-bg); color: #111111;">
                ${ord.customerPaysDelivery ? `${ord.deliveryPrice.toLocaleString()} DA` : "0 DA (Free)"}
              </td>
            </tr>

            <!-- TOTAL Row -->
            <tr style="background-color: var(--brand-color); color: #ffffff;">
              <td colspan="2" style="border-top: none; border-bottom: none; border-left: none; border-right: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 12px 12px; font-weight: 950; font-size: 13px; text-align: center; color: #ffffff; font-family: 'Inter', sans-serif; background-color: var(--brand-color);">
                TOTAL
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 12px 12px; text-align: center; font-weight: 900; font-family: monospace; font-size: 15.5px; color: #ffffff; background-color: var(--brand-color);">
                ${invoiceTotalRaw.toLocaleString()} DA
              </td>
            </tr>

            <!-- PAID and DUE Rows (only if simple is false) -->
            ${!simple ? `
            <tr>
              <td colspan="2" style="border: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 8px 12px; font-weight: 850; font-size: 11px; text-align: center; background-color: #ffffff; color: var(--muted-color); font-family: 'Inter', sans-serif;">
                PAID
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 8px 12px; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; background-color: #ffffff; color: var(--text-color);">
                ${ord.paidAmount.toLocaleString()} DA
              </td>
            </tr>
            <tr>
              <td colspan="2" style="border: none; background: transparent;"></td>
              <td style="border: 1px solid var(--brand-color); padding: 8px 12px; font-weight: 850; font-size: 11px; text-align: center; background-color: #ffffff; color: #b91c1c; font-family: 'Inter', sans-serif;">
                DUE
              </td>
              <td style="border: 1px solid var(--brand-color); padding: 8px 12px; text-align: center; font-weight: bold; font-family: monospace; font-size: 13px; background-color: #ffffff; color: #b91c1c;">
                ${currentUnpaidAmount.toLocaleString()} DA
              </td>
            </tr>
            ` : ""}
          </tbody>
        </table>

        ${debtsAlertBoxHtml}

        <!-- 4. Footer Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; page-break-inside: avoid; border-top: 1px dashed var(--brand-color); padding-top: 20px; flex-direction: row-reverse;">
          <!-- Right: thank you policy note -->
          <div style="text-align: right; font-family: 'Cairo', sans-serif; max-width: 60%; direction: rtl;">
            <div style="font-size: 13.5px; font-weight: bold; color: var(--brand-color); margin-bottom: 4px;">
              شكراً لتعاملكم معنا / Thank you for your business
            </div>
            <div style="font-size: 11px; color: var(--muted-color); line-height: 1.6;">
              فاتورة مبيعات معتمدة تم إصدارها بواسطة نظام Corevia ERP لإدارة مبيعات وتوزيع الألبسة والمنتجات.
            </div>
          </div>
          <!-- Left: Signature wish -->
          <div style="font-family: 'Aref Ruqaa', serif; font-size: 32px; color: var(--brand-color); font-weight: bold; line-height: 1; padding-left: 20px; direction: rtl;">
            بالصحة والراحة
          </div>
        </div>

      </body>
      </html>
    `;

    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
  };

  // Helper trigger for unsaved Form state printing
  const triggerFormPrint = () => {
    const temp: Order = {
      id: customOrderId.trim() || "ORD-TEMP",
      date: new Date().toISOString().split("T")[0],
      customerName,
      phone,
      wilaya: selectedWilaya,
      commune,
      deliveryLocation,
      deliveryCompany,
      deliveryType,
      deliveryPrice,
      items: orderItemsList,
      totalPrice: itemsTotalSum,
      paidAmount,
      discount,
      customerPaysDelivery: !freeDelivery,
      isExchange,
      exchangeOrderRef,
      agentName: agentName || "Agent",
      source,
      status,
      notes
    };
    handlePrintOrder(temp, true);
  };

  // Filter computations
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const sLower = searchTerm.toLowerCase();
      const matchesSearch = 
        ord.customerName?.toLowerCase().includes(sLower) ||
        ord.id?.toLowerCase().includes(sLower) ||
        ord.phone?.includes(sLower);

      const matchesStatus = statusFilter === "all" || ord.status === statusFilter;
      const matchesWilaya = wilayaFilter === "all" || ord.wilaya === wilayaFilter;

      return matchesSearch && matchesStatus && matchesWilaya;
    });
  }, [orders, searchTerm, statusFilter, wilayaFilter]);

  return (
    <div className="space-y-6" id="orders-view-main-root">
      
      {/* 1. TOP HEADER PANEL */}
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5 ${isRtl ? "text-right" : "text-left"}`}>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            <span>{t.navOrders}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">إضافة وإدارة وتعديل طلبيات العملاء وإصدار الفواتير الفورية وإدارة سلف الديون</p>
        </div>

        <button
          onClick={handleOpenAddForm}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.orderAdd}</span>
        </button>
      </div>

      {/* 2. UNDO FLOATING TOAST COUNTDOWN */}
      {undoActiveOrder && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl flex flex-col gap-2.5 ltr" id="orders-local-undo-toast">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold tracking-widest block">أمن المبيعات الذكي (تراجع)</span>
            <button 
              onClick={() => { clearInterval(undoInterval.current); setUndoActiveOrder(null); }}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3 justify-between">
            <div className="flex-1 text-right">
              <span className="text-xs font-black text-white block">تم نقل الطلبية {undoActiveOrder.id} للقمامة...</span>
              <span className="text-[10px] text-slate-400">سيفقد النظام تمديد المخزون التلقائي إن لم تتراجع الآن.</span>
            </div>
            <button
              onClick={handleUndoDeleteAction}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all animate-pulse"
            >
              <Undo className="w-3.5 h-3.5" />
              <span>تراجع (Undo)</span>
            </button>
          </div>
          {/* Progress bar ticking countdown line */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all rounded-full" 
              style={{ width: `${(undoTimeLeft / 5000) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. INTERACTIVE SEARCH & FILTERS DECK */}
      <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#121214] border border-zinc-800/80 p-4 rounded-xl ${isRtl ? "text-right" : "text-left"}`}>
        
        {/* Search Input */}
        <div className="md:col-span-6 relative">
          <label className="block text-[10px] text-slate-400 font-bold mb-1">محرك البحث السريع</label>
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center justify-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الزبون، الموبايل، أو كود الطلب..."
              className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl pr-9 pl-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all text-right"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-3">
          <label className="block text-[10px] text-slate-400 font-bold mb-1">فلترة حسب الحالة</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all text-right"
          >
            <option value="all">كل الحالات المتوفرة</option>
            <option value="pending">قيد الإرسال</option>
            <option value="delivered">تسليم</option>
            <option value="returned">مرجع</option>
          </select>
        </div>

        {/* Wilaya Filter */}
        <div className="md:col-span-3">
          <label className="block text-[10px] text-slate-400 font-bold mb-1">فلتر حسب الولايات</label>
          <select
            value={wilayaFilter}
            onChange={(e) => setWilayaFilter(e.target.value)}
            className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all text-right"
          >
            <option value="all">كل الولايات (69)</option>
            {orders.map(o => o.wilaya).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

      </div>

      {/* 4. ORDERS DATABASE BOARD / TABLE MAP */}
      <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between flex-row-reverse">
          <span className="text-xs font-bold text-slate-400">
            العثور على: <strong className="text-indigo-400">{filteredOrders.length}</strong> طلبيات مبيعات
          </span>
          <span className="text-xs font-bold text-slate-400">سجل قاعدة المبيعات النشطة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[900px]">
            <thead>
              <tr className="bg-zinc-900/50 text-slate-400 text-[10px] uppercase font-black tracking-wider border-b border-zinc-800">
                <th className="p-3.5">الطلبية والزبون</th>
                <th className="p-3.5">تأريخ الطلب</th>
                <th className="p-3.5">المندوب</th>
                <th className="p-3.5">خط الموديل والقطع</th>
                <th className="p-3.5 text-center">المصدر</th>
                <th className="p-3.5">مكان التوصيل والولوج</th>
                <th className="p-3.5">سجل المجموع</th>
                <th className="p-3.5 text-center">حالة الشحن</th>
                <th className="p-3.5">ملخص الديون والذمم</th>
                <th className="p-3.5 text-center">الخيارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    لا تتوفر أي نتائج مطابقة لمحرك البيانات والفرز الخاص بك.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(ord => {
                  const billTotal = ord.totalPrice + (ord.customerPaysDelivery ? ord.deliveryPrice : 0) - ord.discount;
                  const balanceRemaining = billTotal - ord.paidAmount;

                  return (
                    <tr key={ord.id} className="hover:bg-zinc-800/20 transition-all">
                      
                      {/* Name / phone / ID */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-white">{ord.customerName}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{ord.phone}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="inline-flex items-center bg-zinc-800 px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-300">
                            {ord.id}
                          </span>
                          {ord.createdBy && (
                            <span className="inline-flex items-center bg-zinc-805/40 text-zinc-450 border border-zinc-800 px-1.5 py-0.5 rounded text-[8.5px] font-mono" title={`${lang === "ar" ? "المنشئ" : "Creator"}: ${ord.createdBy}`}>
                              👤 {ord.createdBy.split(" (")[0]}
                            </span>
                          )}
                        </div>
                        {ord.createdBy && (
                          <div className="text-[8.5px] text-zinc-500 mt-1 leading-normal space-y-0.5" dir="rtl">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px]">✍️</span>
                              <span>{lang === "ar" ? "أُنشئ:" : "Created:"} {ord.createdDate} {ord.createdTime} ({ord.createdBy.split(" (")[1]?.replace(")", "") || "Owner"})</span>
                            </div>
                            {ord.updatedBy && (ord.updatedBy !== ord.createdBy || ord.updatedDate !== ord.createdDate) && (
                              <div className="flex items-center gap-1 text-indigo-450/80 border-t border-zinc-900/65 pt-0.5 mt-0.5">
                                <span className="text-[10px]">🔄</span>
                                <span>{lang === "ar" ? "عُدّل:" : "Updated:"} {ord.updatedDate} {ord.updatedTime} ({ord.updatedBy.split(" (")[0]})</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-zinc-300 font-mono text-[11px]">{ord.date}</td>

                      {/* Agent */}
                      <td className="p-3.5 text-zinc-400">{ord.agentName || "غير محدد"}</td>

                      {/* Product line details */}
                      <td className="p-3.5 max-w-[200px]">
                        <div className="space-y-1">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-200">
                              • {it.productName} ({it.color} — {it.size || "بدون"}) <strong className="text-zinc-400">x{it.quantity}</strong>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          ord.source === "1" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          ord.source === "2" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                          "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {ord.source === "1" ? "أساسي" : ord.source === "2" ? "فرعي" : "مرتجع"}
                        </span>
                      </td>

                      {/* Logistical Area */}
                      <td className="p-3.5">
                        <div className="text-zinc-300 font-bold">{ord.wilaya}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{ord.commune} — {ord.deliveryCompany}</div>
                      </td>

                      {/* Math Summary Calculations */}
                      <td className="p-3.5">
                        <div className="font-mono text-white font-bold">{billTotal.toLocaleString()} دج</div>
                        <div className="text-[9px] text-zinc-500">
                          شحن: {ord.customerPaysDelivery ? ord.deliveryPrice : "مجاني"} | خصم: {ord.discount}
                        </div>
                      </td>

                      {/* Inline Status Selection */}
                      <td className="p-3.5 text-center">
                        <select
                          value={ord.status}
                          onChange={(e) => handleInlineStatusChange(ord, e.target.value as any)}
                          className={`p-1.5 rounded-lg text-[10px] font-black focus:outline-none focus:ring-1 cursor-pointer w-28 text-center ${
                            ord.status === "pending" ? "bg-amber-500/15 text-amber-500 border border-amber-500/30" :
                            ord.status === "delivered" ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" :
                            "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                          }`}
                        >
                          <option value="pending" className="bg-slate-900 text-slate-300">قيد الإرسال</option>
                          <option value="delivered" className="bg-slate-900 text-slate-300">تسليم</option>
                          <option value="returned" className="bg-slate-900 text-slate-300">مرجع</option>
                        </select>
                      </td>

                      {/* Cumulative Debt and inline debt settlement clearance option */}
                      <td className="p-3.5">
                        {balanceRemaining > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-rose-500 font-bold">دين: {balanceRemaining.toLocaleString()} دج</div>
                              <div className="text-[9px] text-zinc-500">مدفوع: {ord.paidAmount}</div>
                            </div>
                            <button
                              onClick={() => setDebtSettleConfirm({ clientName: ord.customerName })}
                              className="text-[10px] font-black text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded border border-amber-500/25 transition-all cursor-pointer"
                              title="تصفية وتسوية جميع مستحقات هذا العميل"
                            >
                              تصفية
                            </button>
                          </div>
                        ) : (
                          <span className="text-emerald-500 font-bold flex items-center gap-1 text-[11px]">
                            ✅ مدفوع بالكامل
                          </span>
                        )}
                      </td>

                      {/* Form / PDF Invoicing Operators */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Print Invoice with Historical debt calculations */}
                          <button
                            onClick={() => handlePrintOrder(ord, false)}
                            className="p-1 px-1.5 bg-zinc-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                            title="طباعة فاتورة تفصيلية بالديون المتراكمة"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Print simple invoice */}
                          <button
                            onClick={() => handlePrintOrder(ord, true)}
                            className="p-1 px-1.5 bg-zinc-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                            title="طباعة فاتورة مبسطة لهذه الطلبية فقط"
                          >
                            <span className="text-[9px] font-bold text-sky-400 flex items-center">مبسط</span>
                          </button>

                          {/* Edit order */}
                          <button
                            onClick={() => handleEditOrder(ord)}
                            className="p-1 px-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="تعديل تفاصيل الطلبية"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Soft delete order */}
                          <button
                            onClick={() => initiateSoftDelete(ord)}
                            className="p-1 px-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="نقل الطلبية لسلة الحذف والمستودعات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* 5. ADD / EDIT DIALOG OVERLAY PORTAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-fade-in" id="orders-form-overlay-modal">
          
          <form 
            onSubmit={handleSubmitForm}
            className="w-full max-w-5xl bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh]"
          >
            {/* Visual top accent bar */}
            <div className="h-1.5 bg-indigo-600 rounded-t-2xl w-full" />

            <div className="p-5 border-b border-zinc-800 flex items-center justify-between flex-row-reverse">
              <button 
                type="button" 
                onClick={() => { setShowForm(false); localStorage.removeItem("orderFormDraft"); resetForm(); }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-base font-black text-white">
                {editingId ? `تحديث الطلبية رقم ${customOrderId}` : "إصدار وتوثيق طلبية مبيعات جديدة"}
              </h3>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-right flex-1 select-none">
              
              {/* Draft auto recovering badge */}
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between flex-row-reverse text-xs text-indigo-400">
                <span>تكتيك الأمان: يُحفظ العمل تلقائياً كمسودة في المتصفح لاستعادته إذا تم قطع الاتصال.</span>
                <span className="font-extrabold text-[10px]">مسودة محمية ✅</span>
              </div>

              {/* Line 1 - Basic Customer coordinates */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Customer Name input via datalist suggestions */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">اسم المشتري (الزبون) *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    list="clients_names"
                    placeholder="اكتب اسم العميل الثلاثي..."
                    className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right ${
                      fieldErrors.customerName ? "border-rose-500 ring-1 ring-rose-500" : "border-zinc-800"
                    }`}
                  />
                  <datalist id="clients_names">
                    {clientsNames.map(name => <option key={name} value={name} />)}
                  </datalist>
                </div>

                {/* Phone index autofill option */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">رقم الموبايل (الهاتف) *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => handleClientPhoneChange(e.target.value)}
                    list="clients_phones"
                    placeholder="رقم الهاتف الجزائري..."
                    className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right ${
                      fieldErrors.phone ? "border-rose-500 ring-1 ring-rose-500" : "border-zinc-800"
                    }`}
                  />
                  <datalist id="clients_phones">
                    {clientsPhones.map(tel => <option key={tel} value={tel} />)}
                  </datalist>
                </div>

                {/* Incremental Customizable Order number */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">رقم الطلبية والمستند *</label>
                  <input
                    type="text"
                    value={customOrderId}
                    onChange={(e) => setCustomOrderId(e.target.value)}
                    placeholder="مثال: ORD-1002"
                    className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-indigo-500 text-right ${
                      fieldErrors.customOrderId ? "border-rose-500 ring-1 ring-rose-500" : "border-zinc-800"
                    }`}
                  />
                </div>

                {/* Agent/Worker suggestions dropdown */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">الموظف / منسق المبيعات</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    list="workers_names"
                    placeholder="اسم المندوب المسؤول..."
                    className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right"
                  />
                  <datalist id="workers_names">
                    {workersNames.map(name => <option key={name} value={name} />)}
                  </datalist>
                </div>

                {/* Source Select: Disabled in editing mode */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">المستودع الرئيسي الافتراضي</label>
                  <select
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value as any);
                      setOrderItemsList([]); // Reset to avoid mismatches
                      onTriggerNotification("تم تعديل مستودع الإسناد. تم تصفير قائمة المبيعات للتحقق.");
                    }}
                    disabled={!!editingId}
                    className="w-full bg-[#1c1c1e] text-slate-300 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right"
                  >
                    <option value="1">المخزون الأساسي (طاولة 1)</option>
                    <option value="2">المخزون الفرعي (طاولة 2)</option>
                    <option value="3">مخزون الإرجاعات (طاولة 3)</option>
                  </select>
                </div>

              </div>

              {/* Line 2 - Delivery coordinates and logistics */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* 69 Wilaya Selector */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">الولاية (Algerian Wilaya) *</label>
                  <select
                    value={selectedWilaya}
                    onChange={(e) => {
                      const newW = e.target.value;
                      setSelectedWilaya(newW);
                      const list = getCommunesForWilaya(newW);
                      setCommune(list[0] || "");
                      setIsManualCommune(false);
                    }}
                    className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right"
                  >
                    {default69Wilayas.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>

                {/* Commune */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5 flex justify-between items-center">
                    <span>{lang === "ar" ? "البلدية المستهدفة *" : lang === "fr" ? "Commune de livraison *" : "Target Commune *"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newMode = !isManualCommune;
                        setIsManualCommune(newMode);
                        if (!newMode) {
                          // Pick first default commune
                          const list = getCommunesForWilaya(selectedWilaya);
                          setCommune(list[0] || "");
                        } else {
                          setCommune("");
                        }
                      }}
                      className="text-[9px] text-indigo-400 hover:underline hover:text-indigo-300 cursor-pointer"
                    >
                      {isManualCommune ? (lang === "ar" ? "📋 اختر من القائمة" : "📋 Sélectionner") : (lang === "ar" ? "✍️ كتابة يدوية" : "✍️ Saisie manuelle")}
                    </button>
                  </label>
                  
                  {isManualCommune ? (
                    <input
                      type="text"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      placeholder={lang === "ar" ? "اكتب اسم البلدية يدوياً..." : lang === "fr" ? "Saisir manuellement..." : "Enter commune manually..."}
                      className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right ${
                        fieldErrors.commune ? "border-rose-500 ring-1 ring-rose-500" : "border-zinc-800"
                      }`}
                    />
                  ) : (
                    <select
                      value={communesList.includes(commune) ? commune : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "MANUAL_ENTRY") {
                          setIsManualCommune(true);
                          setCommune("");
                        } else {
                          setCommune(val);
                        }
                      }}
                      className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right ${
                        fieldErrors.commune ? "border-rose-500 ring-1 ring-rose-500" : "border-zinc-800"
                      }`}
                    >
                      <option value="">{lang === "ar" ? "-- اختر البلدية --" : lang === "fr" ? "-- Choisir --" : "-- Choose Commune --"}</option>
                      {communesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="MANUAL_ENTRY" className="text-indigo-400 font-bold">
                        {lang === "ar" ? "✍️ كتابة بلدية يدوياً..." : "✍️ Saisir autre commune..."}
                      </option>
                    </select>
                  )}
                </div>

                {/* Delivery location address */}
                <div className="w-full col-span-1 md:col-span-1">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">العنوان التفصيلي / مكان اللقاء</label>
                  <input
                    type="text"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="المكتب، البيت، الشارع..."
                    className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right"
                  />
                </div>

                {/* Shipping Company suggestions */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5 flex justify-between items-center">
                    <span>{lang === "ar" ? "شركة الشحن المسؤولة *" : lang === "fr" ? "Société de livraison *" : "Delivery Company *"}</span>
                    {isAddingCompany && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCompany(false);
                          setNewCompanyName("");
                        }}
                        className="text-[9px] text-zinc-450 hover:text-white cursor-pointer hover:underline"
                      >
                        {lang === "ar" ? "📋 إلغاء" : "📋 Annuler"}
                      </button>
                    )}
                  </label>

                  {isAddingCompany ? (
                    <div className="flex gap-1" id="new_delivery_company_entry_group">
                      <input
                        type="text"
                        autoFocus
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder={lang === "ar" ? "اكتب اسم الشركة..." : "Nom de l'entreprise..."}
                        className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveNewCompany();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveNewCompany}
                        className="bg-indigo-650 hover:bg-indigo-600 text-white px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                      >
                        {lang === "ar" ? "إضافة" : "Ajouter"}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={renderedDeliveryCompanies.includes(deliveryCompany) ? deliveryCompany : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "ADD_NEW_COMPANY") {
                          setIsAddingCompany(true);
                        } else {
                          setDeliveryCompany(val);
                        }
                      }}
                      className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-right font-semibold"
                    >
                      <option value="">{lang === "ar" ? "-- اختر شركة التوصيل --" : lang === "fr" ? "-- Choisir l'entreprise --" : "-- Select Delivery Company --"}</option>
                      {renderedDeliveryCompanies.map(comp => (
                        <option key={comp} value={comp} className="bg-[#1c1c1e] text-slate-200">{comp}</option>
                      ))}
                      <option value="ADD_NEW_COMPANY" className="text-indigo-400 font-bold bg-[#1c1c1e]">
                        {lang === "ar" ? "➕ إضافة شركة شحن أخرى..." : "➕ Ajouter autre entreprise..."}
                      </option>
                    </select>
                  )}
                </div>

                {/* Delivery Type method buttons */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">نوع الشحن</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryType("Home (المنزل)")}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        deliveryType === "Home (المنزل)" 
                          ? "bg-indigo-600 text-white border border-indigo-500" 
                          : "bg-zinc-800 text-slate-400 border border-zinc-700/40"
                      }`}
                    >
                      توصيل للمنزل
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType("Desk (المكتب)")}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        deliveryType === "Desk (المكتب)" 
                          ? "bg-indigo-600 text-white border border-indigo-00" 
                          : "bg-zinc-800 text-slate-400 border border-zinc-700/40"
                      }`}
                    >
                      توصيل للمكتب
                    </button>
                  </div>
                </div>

              </div>

              {/* 6. PRODUCTS REPEATING CARDS SECTION */}
              <div className="border-t border-zinc-800 pt-5 space-y-4">
                <div className="flex items-center justify-between flex-row-reverse">
                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة منتج آخر</span>
                  </button>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>🛒 المنتجات والقطع المطلوبة</span>
                    <span className="text-xs text-slate-400 font-bold">({orderItemsList.length} بنود مضافة)</span>
                  </h4>
                </div>

                {/* Mapping candidate repeating cards in direction-aware tabular grid */}
                <div className="space-y-3" dir={isRtl ? "rtl" : "ltr"}>
                  <datalist id="all_models_catalogs">
                    {allModels.map(m => <option key={m} value={m} />)}
                  </datalist>

                  {/* Desktop Table Headers */}
                  <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl text-slate-400 text-xs font-bold items-center text-center">
                    <div className="col-span-3 text-right">{lang === "ar" ? "اسم المنتج / الموديل *" : "Product Name *"}</div>
                    <div className="col-span-2 text-right">{lang === "ar" ? "اللون *" : "Color *"}</div>
                    <div className="col-span-1 text-center">{lang === "ar" ? "المقاس" : "Size"}</div>
                    <div className="col-span-1 text-center">{lang === "ar" ? "الكمية *" : "Qty *"}</div>
                    <div className="col-span-1 text-center">{lang === "ar" ? "التكلفة (ثابتة)" : "Cost (Fixed)"}</div>
                    <div className="col-span-2 text-center">{lang === "ar" ? "سعر البيع المعتمد *" : "Selling Price *"}</div>
                    <div className="col-span-1 text-center">{lang === "ar" ? "المستودع" : "Source"}</div>
                    <div className="col-span-1 text-center">{lang === "ar" ? "حذف" : "Del"}</div>
                  </div>

                  {orderItemsList.map((item, idx) => {
                    const activeItemSrc = item.itemSource || source;
                    const matchingCatalog = products.find(p => p.name === item.productName);

                    // Dynamic colors suggestions based on source
                    let itemColorOptions: string[] = [];
                    if (activeItemSrc === "1") {
                      const prodColList = matchingCatalog ? matchingCatalog.colors.map(c => c.color) : [];
                      const setColList = getAppSettings().colors || [];
                      itemColorOptions = Array.from(new Set([...prodColList, ...setColList]));
                    } else if (activeItemSrc === "2") {
                      const list = subInventory
                        .filter(x => x.productName === item.productName && x.quantity > 0)
                        .map(x => x.color);
                      itemColorOptions = Array.from(new Set(list));
                    } else if (activeItemSrc === "3") {
                      const list = returnInventory
                        .filter(x => x.productName === item.productName && x.quantity > 0)
                        .map(x => x.color);
                      itemColorOptions = Array.from(new Set(list));
                    }

                    // Dynamic sizes suggestions based on source
                    let itemSizeOptions: string[] = [];
                    if (activeItemSrc === "2") {
                      const list = subInventory
                        .filter(x => x.productName === item.productName && x.color === item.color && x.quantity > 0)
                        .map(x => x.size);
                      itemSizeOptions = Array.from(new Set(list));
                    } else if (activeItemSrc === "3") {
                      const list = returnInventory
                        .filter(x => x.productName === item.productName && x.color === item.color && x.quantity > 0)
                        .map(x => x.size);
                      itemSizeOptions = Array.from(new Set(list));
                    }

                    // Real-time stock validator checking
                    const avStock = getAvailableStock(item.productName, item.color, item.size, activeItemSrc);
                    const isQtyExceeded = item.quantity > avStock;

                    // Compute border color
                    let qtyBorderCls = "border-zinc-800";
                    if (isQtyExceeded || avStock === 0) {
                      qtyBorderCls = "border-rose-500 ring-1 ring-rose-500 text-rose-400";
                    } else if (avStock >= 10) {
                      qtyBorderCls = "border-emerald-500 text-emerald-400 focus:border-emerald-500 focus:ring-emerald-500";
                    } else if (avStock >= 5) {
                      qtyBorderCls = "border-blue-500 text-blue-400 focus:border-blue-500 focus:ring-blue-500";
                    } else if (avStock >= 1) {
                      qtyBorderCls = "border-amber-500 text-amber-400 focus:border-amber-500 focus:ring-amber-500";
                    }

                    return (
                      <div 
                        key={item.id}
                        className="bg-zinc-900/40 p-4 md:p-3 rounded-xl border border-zinc-800 relative grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 items-center transition-all hover:bg-zinc-850/50"
                      >
                        {/* Mobile view badge of index */}
                        <span className="md:hidden absolute top-2 left-2 bg-zinc-850 text-[10px] font-black text-slate-400 p-1 px-1.5 rounded-md">
                          #{idx + 1}
                        </span>

                        {/* Column 1: Product Name */}
                        <div className="col-span-1 md:col-span-3 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "اسم المنتج / الموديل *" : "Product Name *"}</label>
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => {
                              const v = e.target.value;
                              const matched = products.find(p => p.name === v);
                              updateItem(idx, {
                                productName: v,
                                productId: matched ? matched.id : "",
                                productCost: matched ? matched.wholesaleCostPrice : 0,
                                sellingPrice: matched ? matched.retailPrice : 0,
                                color: matched && matched.colors.length > 0 ? matched.colors[0].color : ""
                              });
                            }}
                            list="all_models_catalogs"
                            placeholder={lang === "ar" ? "اكتب اسم الموديل..." : "Type model name..."}
                            className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-1.8 text-xs focus:outline-none text-right placeholder-zinc-650"
                          />
                        </div>

                        {/* Column 2: Color */}
                        <div className="col-span-1 md:col-span-2 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "اللون *" : "Color *"}</label>
                          <select
                            value={item.color}
                            onChange={(e) => updateItem(idx, { color: e.target.value })}
                            className="w-full bg-[#1c1c1e] text-slate-330 border border-zinc-800 rounded-xl px-2 py-1.8 text-xs focus:outline-none text-right"
                          >
                            <option value="">{lang === "ar" ? "-- اختر اللون --" : "-- Color --"}</option>
                            {itemColorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        {/* Column 3: Size */}
                        <div className="col-span-1 md:col-span-1 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "المقاس" : "Size"}</label>
                          {activeItemSrc === "1" ? (
                            <input
                              type="text"
                              value={item.size}
                              onChange={(e) => updateItem(idx, { size: e.target.value })}
                              placeholder="XL..."
                              className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-2 py-1.8 text-xs focus:outline-none text-center"
                            />
                          ) : (
                            <select
                              value={item.size}
                              onChange={(e) => updateItem(idx, { size: e.target.value })}
                              className="w-full bg-[#1c1c1e] text-slate-350 border border-zinc-800 rounded-xl px-2 py-1.8 text-xs focus:outline-none text-center"
                            >
                              <option value="">--</option>
                              {itemSizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          )}
                        </div>

                        {/* Column 4: Quantity */}
                        <div className="col-span-1 md:col-span-1 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "الكمية *" : "Quantity *"}</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })}
                            className={`w-full bg-[#1c1c1e] text-slate-200 border rounded-xl px-2 py-1.8 text-xs font-bold text-center focus:outline-none ${qtyBorderCls}`}
                          />
                          <div className="flex items-center justify-between mt-0.5 px-0.5 text-[8px] text-zinc-500">
                            <span>{lang === "ar" ? `متاح: ${avStock}` : `Av: ${avStock}`}</span>
                            {isQtyExceeded && (
                              <span className="text-rose-500 font-extrabold">{lang === "ar" ? "غير كافٍ" : "Low"}</span>
                            )}
                          </div>
                        </div>

                        {/* Column 5: Cost Price - FIXED & READONLY */}
                        <div className="col-span-1 md:col-span-1 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "تكلفة المنتج (ثابتة)" : "Product Cost (Fixed)"}</label>
                          <input
                            type="text"
                            readOnly
                            value={`${item.productCost} دج`}
                            className="w-full bg-[#0d0d0f] text-emerald-400 border border-zinc-800/80 rounded-xl px-1 py-1.8 text-[11px] font-mono font-bold text-center focus:outline-none cursor-not-allowed"
                            title={lang === "ar" ? "تكلفة ثابتة مستوردة من بطاقة المنتج" : "Fixed cost imported from product profile"}
                          />
                        </div>

                        {/* Column 6: Selling Price with wholesale & retail option triggers */}
                        <div className="col-span-1 md:col-span-2 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "سعر البيع المعتمد *" : "Selling Price *"}</label>
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) => updateItem(idx, { sellingPrice: parseInt(e.target.value) || 0 })}
                            className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-2 py-1.8 text-xs font-bold text-center focus:outline-none focus:border-indigo-500 text-right md:text-center"
                          />
                          {matchingCatalog ? (
                            <div className="flex gap-1 mt-1 justify-center">
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { sellingPrice: matchingCatalog.wholesalePrice })}
                                className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                                  item.sellingPrice === matchingCatalog.wholesalePrice
                                    ? "bg-amber-500 text-black font-extrabold"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
                                }`}
                                title={lang === "ar" ? `سعر الجملة: ${matchingCatalog.wholesalePrice} دج` : `Wholesale: ${matchingCatalog.wholesalePrice} DZD`}
                              >
                                {lang === "ar" ? "جملة" : "Whl"} ({matchingCatalog.wholesalePrice})
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { sellingPrice: matchingCatalog.retailPrice })}
                                className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                                  item.sellingPrice === matchingCatalog.retailPrice
                                    ? "bg-blue-500 text-white font-extrabold"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25"
                                }`}
                                title={lang === "ar" ? `سعر التجزئة: ${matchingCatalog.retailPrice} دج` : `Retail: ${matchingCatalog.retailPrice} DZD`}
                              >
                                {lang === "ar" ? "تجزئة" : "Ret"} ({matchingCatalog.retailPrice})
                              </button>
                            </div>
                          ) : (
                            <div className="text-[7.5px] text-zinc-500 text-center mt-1">
                              {lang === "ar" ? "تأخذ تعريفتها تلقائياً" : "Loaded dynamically"}
                            </div>
                          )}
                        </div>

                        {/* Column 7: Item Source Override context */}
                        <div className="col-span-1 md:col-span-1 w-full">
                          <label className="block md:hidden text-slate-400 text-[10px] font-bold mb-1">{lang === "ar" ? "المستودع" : "Warehouse"}</label>
                          <select
                            value={item.itemSource || ""}
                            onChange={(e) => updateItem(idx, { itemSource: e.target.value ? e.target.value as any : undefined })}
                            className="w-full bg-[#1c1c1e] text-slate-350 border border-zinc-800 rounded-xl px-1 py-1.8 text-[10px] focus:outline-none text-center"
                          >
                            <option value="">{lang === "ar" ? "تلقائي" : "Auto"}</option>
                            <option value="1">رئيسي (1)</option>
                            <option value="2">وكلاء (2)</option>
                            <option value="3">إرجاع (3)</option>
                          </select>
                        </div>

                        {/* Column 8: Elegant Action Delete Button */}
                        <div className="col-span-1 md:col-span-1 w-full flex justify-center">
                          {orderItemsList.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setOrderItemsList(prev => prev.filter(x => x.id !== item.id))}
                              className="text-rose-500 hover:text-rose-450 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-xl flex items-center justify-center font-bold text-xs cursor-pointer transition-colors w-full md:w-auto"
                              title={lang === "ar" ? "حذف هذا البند" : "Remove this item"}
                            >
                              <span className="md:hidden ml-1">{lang === "ar" ? "حذف البند" : "Delete Item"}</span>
                              ✕
                            </button>
                          ) : (
                            <span className="text-[9px] text-zinc-650 font-bold hidden md:block">—</span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Line 3 - Financial Accounts calculations */}
              <div className="border-t border-zinc-850 pt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Delivery cost */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">سعر التوصيل (دج)</label>
                  <input
                    type="number"
                    value={deliveryPrice}
                    onChange={(e) => setDeliveryPrice(parseInt(e.target.value) || 0)}
                    placeholder="افتراضي: 600 دج"
                    className={`w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-right ${
                      deliveryPrice === 0 ? "opacity-40" : "opacity-100"
                    }`}
                  />
                </div>

                {/* Discount */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">الخصم</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                    placeholder="0 دج"
                    className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-right"
                  />
                </div>

                {/* Paid amount */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">المبلغ المدفوع</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => {
                      paidTouched.current = true;
                      setPaidAmount(parseInt(e.target.value) || 0);
                    }}
                    placeholder="يُقلم تلقائياً من المجموع"
                    className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-850 rounded-xl px-3 py-2 text-xs font-bold text-center focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <span className="text-[9px] text-zinc-500">تم تعديله يدوياً: {paidTouched.current ? "نعم" : "تلقائي"}</span>
                    {grandTotalComputed > paidAmount && (
                      <span className="text-[9px] text-rose-500 font-bold">باقي دين متبقي: {grandTotalComputed - paidAmount} دج</span>
                    )}
                  </div>
                </div>

                {/* Status selection */}
                <div className="w-full">
                  <label className="block text-slate-300 text-xs font-bold mb-1.5">حالة الطلب</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#1c1c1e] text-slate-300 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-right"
                  >
                    <option value="pending">قيد الإرسال</option>
                    <option value="delivered">تسليم</option>
                    <option value="returned">مرجع</option>
                  </select>
                </div>

              </div>

              {/* Extras block: Swap (Exchange), Free delivery, Return penalization */}
              <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-805 space-y-4">
                <div className="flex items-center gap-3 justify-end">
                  
                  {/* Free Delivery toggle */}
                  <button
                    type="button"
                    onClick={() => setFreeDelivery(!freeDelivery)}
                    className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      freeDelivery 
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500" 
                        : "bg-zinc-800/60 text-slate-400 border-zinc-700/40 hover:bg-zinc-800"
                    }`}
                  >
                    توصيل مجاني
                  </button>

                  {/* Swap Exchange toggle */}
                  <button
                    type="button"
                    onClick={() => setIsExchange(!isExchange)}
                    className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      isExchange 
                        ? "bg-amber-600/20 text-amber-400 border-amber-500" 
                        : "bg-zinc-800/60 text-slate-400 border-zinc-700/40 hover:bg-zinc-800"
                    }`}
                  >
                    مبادلة (Swap)
                  </button>

                </div>

                {/* Nested exchange options if swap selected */}
                {isExchange && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800/80 pt-4 text-right">
                    <div className="w-full">
                      <label className="block text-slate-400 text-xs font-bold mb-1.5">فاتورة المرجعية المستبدلة *</label>
                      <select
                        value={exchangeOrderRef}
                        onChange={(e) => setExchangeOrderRef(e.target.value)}
                        className="w-full bg-slate-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white text-right"
                      >
                        <option value="">-- اختر الفاتورة الأصلية للمنادلة --</option>
                        {orders
                          .filter(o => o.customerName === customerName && o.id !== editingId)
                          .map(o => (
                            <option key={o.id} value={o.id}>
                              {o.id} — تاريـخ: {o.date} (قيمة: {o.totalPrice} دج)
                            </option>
                          ))
                        }
                      </select>
                      <p className="text-[9px] text-amber-500/80 mt-1">يُشترط كتابة اسم المشتري بالأعلى أولاً لفلترة فواتيره السابقة المطابقة.</p>
                    </div>
                  </div>
                )}

                {/* Penalty return setup visible if status is returned */}
                {status === "returned" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800/80 pt-4 text-right animate-fade-in">
                    <div className="w-full">
                      <label className="block text-rose-400 text-xs font-black mb-1.5">تكلفة الإرجاع (دج)</label>
                      <input
                        type="number"
                        value={returnCost}
                        onChange={(e) => setReturnCost(e.target.value === "" ? 0 : parseInt(e.target.value))}
                        placeholder="300"
                        className="w-full bg-slate-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 text-right"
                      />
                    </div>
                    <div className="w-full">
                      <label className="block text-rose-400 text-xs font-black mb-1.5">تاريخ ورقة المرتجع</label>
                      <input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full bg-slate-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 text-right"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes Context area */}
              <div className="w-full">
                <label className="block text-slate-300 text-xs font-bold mb-1.5">ملاحظات داخلية وتعليمات خاصة بالطلب</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اكتب أي شروحات إضافية للمندوب أو الدليفري هنا..."
                  rows={2}
                  className="w-full bg-[#1c1c1e] text-slate-200 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none text-right"
                />
              </div>

            </div>

            {/* Calculations subtotals visual panel footer */}
            <div className="bg-zinc-900 p-5 border-t border-zinc-800 text-right space-y-3.5 select-none">
              
              {/* Debt notification block inside invoice creation helper */}
              {customerName && (
                <div className="bg-zinc-850 p-3 rounded-lg border border-zinc-800 flex items-center justify-between flex-row-reverse text-xs">
                  <span className="text-zinc-400">سجل الذمم للزبون {customerName}:</span>
                  {getCustomerDebt(customerName, editingId || undefined) > 0 ? (
                    <span className="text-rose-500 font-extrabold">
                      ⚠️ ديون متراكمة سابقة معلقة: {getCustomerDebt(customerName, editingId || undefined).toLocaleString()} دج
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-bold">🎯 ذمة مالية تامة النقاء (0 دج ديون)</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-4 flex-row-reverse">
                <div>
                  مجموع السلع الخام: <strong className="text-white">{itemsTotalSum.toLocaleString()} دج</strong>
                </div>
                <div>
                  خدمة الشحن: <strong className="text-white">{freeDelivery ? "توصيل مجاني" : `${deliveryPrice} دج`}</strong>
                </div>
                {discount > 0 && (
                  <div className="text-rose-400 font-bold">
                    خصومات: <strong>-{discount.toLocaleString()} دج</strong>
                  </div>
                )}
                <div className="text-sm bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg font-black">
                  المجموع الكلي: <span>{grandTotalComputed.toLocaleString()} دج</span>
                </div>
              </div>
            </div>

            {/* Action buttons inside the modal */}
            <div className="bg-[#121214] p-5 border-t border-zinc-800 rounded-b-2xl flex items-center justify-between flex-row-reverse gap-4">
              
              {/* Submit / Edit */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); localStorage.removeItem("orderFormDraft"); resetForm(); }}
                  className="bg-zinc-800 hover:bg-zinc-750 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold border border-zinc-700 transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] cursor-pointer"
                >
                  {editingId ? "حفظ التعديلات الحالية" : "إصدار وإرسال الطلبية للمستودع"}
                </button>
              </div>

              {/* Instant Printable PDF invoice generation preview */}
              <button
                type="button"
                onClick={triggerFormPrint}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="طباعة سريعة للفاتورة بالوضع المبسط (P)"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>طباعة للفاتورة الحالية (حتى وإن لم تُحفظ بعد)</span>
              </button>

            </div>

          </form>

        </div>
      )}

      {/* 6. CONSOLIDATED ACTION CONFIRMATION PORTALS (IFRAME SAFE) */}
      {debtSettleConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="w-full max-w-md bg-[#121214] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden text-center">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-indigo-600" />
            
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-400">
              <Eye className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-white mb-2">تصفية ديون العميل ({debtSettleConfirm.clientName})</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              هل أنت متأكد من رغبتك في تسوية وتصفية كامل الذمم والديون السابقة للعميل؟ سيقوم النظام بحساب فواتيره وحقنها كمدفوعة بالكامل.
            </p>

            <div className="flex items-center gap-3 flex-row-reverse">
              <button
                onClick={handleSettleAllClientDebts}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-550 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer"
              >
                تأكيد وتسوية الديون
              </button>
              <button
                onClick={() => setDebtSettleConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-slate-350 rounded-xl text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
