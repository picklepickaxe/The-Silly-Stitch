import { useEffect, useState, useCallback } from "react";
import { addDoc, collection, deleteDoc, onSnapshot, doc, updateDoc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/Config";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { suggestDeadline } from "../utils/scheduling";

// ─────────────────────────────────────────────
// Colour tokens
// Light mode uses the brand palette directly:
//   page bg        → cream   #FFF1C1
//   sidebar bg     → #FEE8C8  (one step warmer/darker than cream)
//   card surface   → #FFFDF5  (near-white with warmth)
//   card inner     → cream   #FFF1C1
//   active accent  → pinky   #F7C8D3  + deep rose text #5a2434
//   brand / links  → yarn    #6B4E71
//   body text      → text    #3A3A3A
// ─────────────────────────────────────────────

const STATUS_OPTIONS = ["all", "pending", "accepted", "in_progress", "completed", "cancelled"];

const STATUS_STYLES = {
  pending:     { bg: "bg-amber-50   dark:bg-amber-950/60",   text: "text-amber-700  dark:text-amber-300",   border: "border-amber-200  dark:border-amber-700",   dot: "bg-amber-400"   },
  accepted:    { bg: "bg-blue-50    dark:bg-blue-950/60",    text: "text-blue-700   dark:text-blue-300",    border: "border-blue-200   dark:border-blue-700",    dot: "bg-blue-400"    },
  in_progress: { bg: "bg-purple-50  dark:bg-purple-950/60",  text: "text-purple-700 dark:text-purple-300",  border: "border-purple-200 dark:border-purple-700",  dot: "bg-purple-400"  },
  completed:   { bg: "bg-green-50   dark:bg-green-950/60",   text: "text-green-700  dark:text-green-300",   border: "border-green-200  dark:border-green-700",   dot: "bg-green-400"   },
  cancelled:   { bg: "bg-red-50     dark:bg-red-950/60",     text: "text-red-500    dark:text-red-300",     border: "border-red-200    dark:border-red-700",     dot: "bg-red-400"     },
};

const STATUS_META = {
  pending: "Waiting confirmation",
  accepted: "Accepted",
  in_progress: "Being prepared",
  completed: "Delivered",
  cancelled: "Stopped",
};

const ADMIN_ANNOUNCEMENT_DRAFT_KEY = "silly-stitch-admin-announcement-draft";
const ADMIN_PRODUCT_DRAFT_KEY = "silly-stitch-admin-product-draft";
const ADMIN_PRODUCT_CATEGORY_LIBRARY_KEY = "silly-stitch-admin-product-category-library";

const SORT_FIELDS = [
  { value: "total",     label: "Total"    },
  { value: "confirmedDeadline", label: "Deadline" },
];

// ─── Helpers ───────────────────────────────────

function readDraftFromStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function readDraftSavedAt(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).savedAt || null;
  } catch {
    return null;
  }
}

function formatDraftTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const normalizedStatus = status in STATUS_STYLES ? status : "pending";
  const dot = STATUS_STYLES[normalizedStatus].dot;
  const meta = STATUS_META[normalizedStatus];

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="capitalize text-text/80 dark:text-[#d4c6ea]">
        {normalizedStatus.replaceAll("_", " ")}
      </span>
      <span className="text-text/30 dark:text-[#6a5878] hidden sm:inline">
        • {meta}
      </span>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategoryList(values) {
  const items = Array.isArray(values) ? values : [values];
  const unique = new Set();

  items.forEach((value) => {
    const normalized = normalizeCategory(value);
    if (normalized) unique.add(normalized);
  });

  return Array.from(unique);
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => a.localeCompare(b));
}

function formatCategoryLabel(category) {
  return String(category || "").replaceAll("_", " ");
}

function getProductCategories(product) {
  const fromArray = Array.isArray(product?.categories) ? product.categories : [];
  const legacyCategory = product?.category ? [product.category] : [];
  return normalizeCategoryList([...fromArray, ...legacyCategory]);
}

function readCategoryLibraryFromStorage(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeCategoryList(parsed) : [];
  } catch {
    return [];
  }
}

function createEmptyProductForm() {
  return {
    name: "",
    categories: [],
    price: "",
    makingTimeHours: "",
    description: "",
    imageUrl: "",
    images: "",
  };
}

// ─── SVG Icons ─────────────────────────────────

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3"  /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22"  x2="5.64"  y2="5.64"  /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"    y1="12"    x2="3"      y2="12"    /><line x1="21"    y1="12"    x2="23"    y2="12"    />
      <line x1="4.22" y1="19.78" x2="5.64"  y2="18.36" /><line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function ArrowUpIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function ArrowDownIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Toast ─────────────────────────────────────

function Toast({ message, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  const isError = type === "error";
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-medium border
      ${isError
        ? "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        : "bg-[#FFFDF5] dark:bg-[#1e1a30] border-yarn/20 dark:border-[#3d2f5a] text-text dark:text-[#e0d4f0] shadow-[0_4px_20px_rgba(107,78,113,0.12)]"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isError ? "bg-red-400" : "bg-green-400"}`} />
      {message}
    </div>
  );
}

// --- Slide Panel ───────────────────────────────

function SlidePanel({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative ml-auto w-full sm:w-[520px] h-full bg-[#FFFDF5] dark:bg-[#16122a] shadow-2xl p-5 overflow-y-auto flex flex-col gap-4 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b border-yarn/10 dark:border-[#2a2040] pb-4 mb-2 shrink-0">
          <h2 className="text-2xl font-poiret text-text dark:text-[#e0d4f0] font-bold">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-yarn/10 flex items-center justify-center text-yarn hover:bg-yarn/20 transition dark:bg-[#2a1f3d] dark:text-[#c4a8cc] dark:hover:bg-[#3a2e50]">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

function AnnouncementsPanel({
  open,
  onClose,
  announcements,
  announcementsLoading,
  announcementError,
  announcementForm,
  setAnnouncementForm,
  handleSaveAnnouncement,
  startEditAnnouncement,
  handleDeleteAnnouncement,
  editingAnnouncementId,
  savingAnnouncement,
  deletingAnnouncementId,
  resetAnnouncementForm,
  announcementDraftSavedAt,
}) {
  if (!open) return null;

  return (
    <SlidePanel open={open} title="Announcements" onClose={onClose}>
      <section className="rounded-2xl border border-yarn/12 dark:border-[#2a2040] bg-[#FFFDF5] dark:bg-[#16122a] p-4 sm:p-5">
        <div className="flex items-center justify-end gap-3 mb-4">
          <span className="text-xs text-text/40 dark:text-[#7a6490]">
            {announcements.length} item{announcements.length !== 1 ? "s" : ""}
          </span>
        </div>

        {announcementError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-600 dark:text-red-300 mb-4">
            {announcementError}
          </div>
        )}

        <form onSubmit={handleSaveAnnouncement} className="mb-6 rounded-xl border border-yarn/12 dark:border-[#3d2f5a] bg-cream dark:bg-[#1e1a30] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-text dark:text-[#e0d4f0]">{editingAnnouncementId ? "Edit Announcement" : "Add Announcement"}</h3>
            <span className="text-[11px] text-text/55 dark:text-[#9b82b0]">
              {announcementDraftSavedAt ? `Saved ✓ ${formatDraftTime(announcementDraftSavedAt)}` : "Autosave active"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={announcementForm.title} onChange={e => setAnnouncementForm({...announcementForm, title: e.target.value})} className="w-full text-sm rounded-lg border border-yarn/20 dark:border-[#4a3560] bg-white/50 dark:bg-[#16122a] px-3 py-2 text-text dark:text-[#e0d4f0]" placeholder="Title (e.g. Welcome!)" />
            <input value={announcementForm.date} onChange={e => setAnnouncementForm({...announcementForm, date: e.target.value})} className="w-full text-sm rounded-lg border border-yarn/20 dark:border-[#4a3560] bg-white/50 dark:bg-[#16122a] px-3 py-2 text-text dark:text-[#e0d4f0]" placeholder="Date tag (e.g. Latest)" />
            <input className="sm:col-span-2 w-full text-sm rounded-lg border border-yarn/20 dark:border-[#4a3560] bg-white/50 dark:bg-[#16122a] px-3 py-2 text-text dark:text-[#e0d4f0]" value={announcementForm.short} onChange={e => setAnnouncementForm({...announcementForm, short: e.target.value})} placeholder="Short Description..." />
            <textarea rows="2" className="sm:col-span-2 w-full text-sm rounded-lg border border-yarn/20 dark:border-[#4a3560] bg-white/50 dark:bg-[#16122a] px-3 py-2 text-text dark:text-[#e0d4f0] resize-y" value={announcementForm.full} onChange={e => setAnnouncementForm({...announcementForm, full: e.target.value})} placeholder="Full content for modal..."></textarea>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            {editingAnnouncementId && <button type="button" onClick={resetAnnouncementForm} className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-[#2a2040] hover:bg-gray-300 text-gray-700 dark:text-[#c0aad8]">Cancel</button>}
            <button type="submit" disabled={savingAnnouncement} className="px-5 py-2 text-xs font-semibold rounded-lg bg-yarn dark:bg-[#3a2e50] text-write text-white transition hover:opacity-90">{editingAnnouncementId ? "Save" : "Add"}</button>
          </div>
        </form>

        {announcementsLoading ? (
          <p className="text-sm text-text/45 dark:text-[#7a6490]">Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-text/45 dark:text-[#7a6490]">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((ann) => (
              <div key={ann.docId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yarn/12 dark:border-[#2a2040] bg-cream/50 dark:bg-[#1e1a30] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text dark:text-[#e0d4f0] truncate">{ann.title} <span className="font-normal text-xs text-yarn/60">({ann.date})</span></p>
                  <p className="text-xs text-text/60 truncate">{ann.short}</p>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-1.5 ml-auto">
                  <button onClick={() => startEditAnnouncement(ann)} className="rounded-lg px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#2a1f3d] text-yarn dark:text-[#cbb6dd] shadow-sm ring-1 ring-yarn/10 dark:ring-yarn/40 hover:bg-[#FEE8C8] dark:hover:bg-[#3d2f5a]">Edit</button>
                  <button onClick={() => handleDeleteAnnouncement(ann.docId)} disabled={deletingAnnouncementId === ann.docId} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 disabled:opacity-50">Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SlidePanel>
  );
}

function ProductsPanel({
  open,
  onClose,
  products,
  productsLoading,
  productError,
  productForm,
  setProductForm,
  productCategories,
  newCategoryInput,
  setNewCategoryInput,
  handleAddProductCategory,
  handleDeleteProductCategory,
  toggleProductCategory,
  handleSaveProduct,
  startEditProduct,
  handleDeleteProduct,
  editingProductId,
  savingProduct,
  deletingProductId,
  resetProductForm,
  productDraftSavedAt,
}) {
  const selectedCategories = normalizeCategoryList(productForm.categories);

  if (!open) return null;

  return (
    <SlidePanel open={open} title="Products" onClose={onClose}>
      <section className="rounded-2xl border border-yarn/12 dark:border-[#2a2040] bg-[#FFFDF5] dark:bg-[#16122a] p-4 sm:p-5">
        <div className="flex items-center justify-end gap-3 mb-4">
          <span className="text-xs text-text/40 dark:text-[#7a6490]">
            {products.length} item{products.length !== 1 ? "s" : ""}
          </span>
        </div>

        {productError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-600 dark:text-red-300 mb-4">
            {productError}
          </div>
        )}

        <p className="text-[11px] text-text/55 dark:text-[#9b82b0] mb-3">
          {productDraftSavedAt ? `Saved ✓ ${formatDraftTime(productDraftSavedAt)}` : "Autosave active"}
        </p>

        <div className="mb-4 rounded-xl border border-yarn/12 dark:border-[#3d2f5a] bg-cream/55 dark:bg-[#1e1a30] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text dark:text-[#e0d4f0]">Categories</h3>
            <span className="text-[11px] text-text/50 dark:text-[#9b82b0]">{productCategories.length} saved</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddProductCategory();
                }
              }}
              placeholder="Add category (example: festival special)"
              className="flex-1 rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-white/70 dark:bg-[#16122a] px-3 py-2 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
            />
            <button
              type="button"
              onClick={handleAddProductCategory}
              className="rounded-xl bg-yarn dark:bg-[#2a1f3d] text-white dark:text-[#e0d4f0] px-4 py-2 text-sm font-medium"
            >
              Add category
            </button>
          </div>

          {productCategories.length === 0 ? (
            <p className="text-xs text-text/45 dark:text-[#7a6490]">No categories yet. Add one to begin.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {productCategories.map((category) => {
                const selected = selectedCategories.includes(category);
                return (
                  <div key={category} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleProductCategory(category)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors
                        ${selected
                          ? "bg-pinky/70 dark:bg-[#3a1e35] border-pinky dark:border-[#6b2e55] text-[#5a2434] dark:text-[#f0aad0]"
                          : "bg-white/70 dark:bg-[#16122a] border-yarn/20 dark:border-[#3d2f5a] text-text/70 dark:text-[#c0aad8]"
                        }`}
                    >
                      {selected && <CheckIcon />}
                      <span className="capitalize">{formatCategoryLabel(category)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProductCategory(category)}
                      className="rounded-full border border-red-200 dark:border-red-800 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-300"
                      title="Delete category"
                    >
                      X
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-text/50 dark:text-[#9b82b0]">
            {selectedCategories.length
              ? `Selected for this product: ${selectedCategories.map(formatCategoryLabel).join(", ")}`
              : "Select one or more categories for this product."}
          </p>
        </div>

        <form onSubmit={handleSaveProduct} className="grid gap-3 sm:grid-cols-2 mb-4">
          <input
            value={productForm.name}
            onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Product name"
            className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />
          <input
            value={productForm.price}
            onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))}
            placeholder="Price"
            inputMode="decimal"
            className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />
          <input
            type="number"
            min="0"
            step="0.25"
            value={productForm.makingTimeHours}
            onChange={(e) => setProductForm((p) => ({ ...p, makingTimeHours: e.target.value }))}
            placeholder="Making Time (hours) — how long this product takes to make"
            inputMode="decimal"
            className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />
          <input
            value={productForm.imageUrl}
            onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))}
            placeholder="Primary image URL"
            className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />
          <input
            value={productForm.images}
            onChange={(e) => setProductForm((p) => ({ ...p, images: e.target.value }))}
            placeholder="Extra image URLs (comma separated)"
            className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />
          <textarea
            value={productForm.description}
            onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Description"
            rows={3}
            className="sm:col-span-2 rounded-xl border border-yarn/20 dark:border-[#3d2f5a] bg-cream/70 dark:bg-[#1e1a30] px-3 py-2.5 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878]"
          />

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingProduct}
              className="rounded-xl bg-yarn dark:bg-[#2a1f3d] text-white dark:text-[#e0d4f0] px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {savingProduct ? "Saving..." : editingProductId ? "Update Product" : "Add Product"}
            </button>
            {editingProductId && (
              <button
                type="button"
                onClick={resetProductForm}
                className="rounded-xl border border-yarn/20 dark:border-[#3d2f5a] px-4 py-2 text-sm text-text dark:text-[#c0aad8]"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {productsLoading ? (
          <p className="text-sm text-text/45 dark:text-[#7a6490]">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-text/45 dark:text-[#7a6490]">No products yet.</p>
        ) : (
          <div className="space-y-2">
            {products.map((product) => {
              const productCategoryTags = getProductCategories(product);

              return (
                <div key={product.docId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yarn/12 dark:border-[#2a2040] bg-cream/50 dark:bg-[#1e1a30] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text dark:text-[#e0d4f0] truncate">{product.name}</p>
                    <p className="text-xs text-yarn dark:text-[#c4a8cc]">Rs {Number(product.price) || 0}</p>
                    <p className="text-[11px] capitalize text-text/45 dark:text-[#9b82b0]">
                      {productCategoryTags.length
                        ? productCategoryTags.map(formatCategoryLabel).join(", ")
                        : "uncategorized"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditProduct(product)}
                      className="rounded-lg border border-yarn/20 dark:border-[#3d2f5a] px-2.5 py-1.5 text-xs text-text dark:text-[#c0aad8]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product.docId)}
                      disabled={deletingProductId === product.docId}
                      className="rounded-lg border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-300 disabled:opacity-60"
                    >
                      {deletingProductId === product.docId ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </SlidePanel>
  );
}

function NotifsPanel({ open, onClose, orders }) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const optedIn = orders
    .filter((o) => o.wantsLaunchNotifications && o.email)
    .reduce((acc, o) => {
      const email = o.email.trim().toLowerCase();
      if (!acc.find((e) => e.email === email)) {
        acc.push({ email, name: o.customerName || "—" });
      }
      return acc;
    }, []);

  const emailString = optedIn.map((e) => e.email).join(", ");

  function handleCopy() {
    if (!emailString) return;
    navigator.clipboard.writeText(emailString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <SlidePanel open={open} title="Launch Notifications" onClose={onClose}>
      <section className="rounded-2xl border border-yarn/12 dark:border-[#2a2040] bg-[#FFFDF5] dark:bg-[#16122a] p-4 sm:p-5">

        <p className="text-xs text-text/50 dark:text-[#7a6490] mb-4">
          {optedIn.length} customer{optedIn.length !== 1 ? "s" : ""} opted in to product launch emails.
          Copy all emails and paste into Gmail BCC.
        </p>

        {optedIn.length > 0 && (
          <button
            onClick={handleCopy}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold mb-4 transition
              ${copied
                ? "bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-yarn dark:bg-[#2a1f3d] text-white dark:text-[#e0d4f0] hover:opacity-90"
              }`}
          >
            {copied ? "✓ Copied to clipboard!" : `Copy all ${optedIn.length} emails`}
          </button>
        )}

        {optedIn.length === 0 ? (
          <p className="text-sm text-text/40 dark:text-[#5a4878] text-center py-8">
            No opt-ins yet. They'll appear here once customers check the notification box at checkout.
          </p>
        ) : (
          <div className="space-y-2">
            {optedIn.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-yarn/12 dark:border-[#2a2040] bg-cream/50 dark:bg-[#1e1a30] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text dark:text-[#e0d4f0] truncate">{entry.email}</p>
                  <p className="text-xs text-text/45 dark:text-[#7a6490] truncate">{entry.name}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(entry.email)}
                  className="shrink-0 text-xs text-yarn dark:text-[#c4a8cc] hover:underline"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </SlidePanel>
  );
}

// --- Main component ----------------------------

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const CAPACITY = 4;
  const BUFFER_DAYS = 4;

  const [products, setProducts]       = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productError, setProductError] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [productForm, setProductForm] = useState(() => {
    const empty = createEmptyProductForm();
    const draft = readDraftFromStorage(ADMIN_PRODUCT_DRAFT_KEY, empty);

    return {
      ...empty,
      ...draft,
      categories: normalizeCategoryList([
        ...(Array.isArray(draft.categories) ? draft.categories : []),
        draft.category,
      ]),
    };
  });
  const [productCategories, setProductCategories] = useState(() =>
    sortCategories(readCategoryLibraryFromStorage(ADMIN_PRODUCT_CATEGORY_LIBRARY_KEY))
  );
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [productDraftSavedAt, setProductDraftSavedAt] = useState(() => readDraftSavedAt(ADMIN_PRODUCT_DRAFT_KEY));

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState(() =>
    readDraftFromStorage(ADMIN_ANNOUNCEMENT_DRAFT_KEY, {
      title: "",
      short: "",
      full: "",
      date: "",
    })
  );
  const [announcementDraftSavedAt, setAnnouncementDraftSavedAt] = useState(() => readDraftSavedAt(ADMIN_ANNOUNCEMENT_DRAFT_KEY));

  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [filter, setFilter]           = useState("all");
  const [searchTerm, setSearchTerm]   = useState("");
  const [updatingId, setUpdatingId]   = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]             = useState(null);
  const [sortField, setSortField]     = useState(null);
  const [sortDir, setSortDir]         = useState("asc");

  const [showAnnouncementsPanel, setShowAnnouncementsPanel] = useState(false);
  const [showProductsPanel, setShowProductsPanel] = useState(false);
  const [showNotifsPanel, setShowNotifsPanel] = useState(false);

  const { darkMode, toggleDark } = useTheme();

  useEffect(() => {
    if (user === null) navigate("/admin27-login", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
        setLoading(false);
        setFetchError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setFetchError("Could not load orders. Check your connection or Firestore rules.");
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "products"),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ docId: d.id, ...d.data() }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

        setProducts(docs);
        setProductsLoading(false);
        setProductError(null);
      },
      (err) => {
        console.error("Products error:", err);
        setProductError("Could not load products. Check your Firestore rules.");
        setProductsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (productCategories.length === 0) {
      window.localStorage.removeItem(ADMIN_PRODUCT_CATEGORY_LIBRARY_KEY);
      return;
    }

    window.localStorage.setItem(
      ADMIN_PRODUCT_CATEGORY_LIBRARY_KEY,
      JSON.stringify(productCategories)
    );
  }, [productCategories]);

  useEffect(() => {
    return onSnapshot(
      collection(db, "announcements"),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ docId: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setAnnouncements(docs);
        setAnnouncementsLoading(false);
        setAnnouncementError(null);
      },
      (err) => {
        console.error("Announcements error:", err);
        setAnnouncementError("Could not load announcements. Check your Firestore rules.");
        setAnnouncementsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const timeout = setTimeout(() => {
      const isEmpty =
        !announcementForm.title.trim() &&
        !announcementForm.short.trim() &&
        !announcementForm.full.trim() &&
        !announcementForm.date.trim();

      if (isEmpty) {
        window.localStorage.removeItem(ADMIN_ANNOUNCEMENT_DRAFT_KEY);
        setAnnouncementDraftSavedAt(null);
        return;
      }

      const payload = { ...announcementForm, savedAt: Date.now() };
      window.localStorage.setItem(ADMIN_ANNOUNCEMENT_DRAFT_KEY, JSON.stringify(payload));
      setAnnouncementDraftSavedAt(payload.savedAt);
    }, 500);

    return () => clearTimeout(timeout);
  }, [announcementForm]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const timeout = setTimeout(() => {
      const selectedCategories = normalizeCategoryList(productForm.categories);
      const isEmpty =
        !productForm.name.trim() &&
        selectedCategories.length === 0 &&
        !productForm.price.trim() &&
        !String(productForm.makingTimeHours || "").trim() &&
        !productForm.description.trim() &&
        !productForm.imageUrl.trim() &&
        !productForm.images.trim();

      if (isEmpty) {
        window.localStorage.removeItem(ADMIN_PRODUCT_DRAFT_KEY);
        setProductDraftSavedAt(null);
        return;
      }

      const payload = {
        ...productForm,
        categories: selectedCategories,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(ADMIN_PRODUCT_DRAFT_KEY, JSON.stringify(payload));
      setProductDraftSavedAt(payload.savedAt);
    }, 500);

    return () => clearTimeout(timeout);
  }, [productForm]);

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  function resetProductForm() {
    setProductForm(createEmptyProductForm());
    setEditingProductId(null);
  }

  function resetAnnouncementForm() {
    setAnnouncementForm({ title: "", short: "", full: "", date: "" });
    setEditingAnnouncementId(null);
  }

  function startEditAnnouncement(announcement) {
    setEditingAnnouncementId(announcement.docId);
    setAnnouncementForm({
      title: announcement.title || "",
      short: announcement.short || "",
      full: announcement.full || "",
      date: announcement.date || "",
    });
  }

  async function handleSaveAnnouncement(e) {
    e.preventDefault();
    if (savingAnnouncement) return;

    if (!announcementForm.title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    const payload = {
      title: announcementForm.title.trim(),
      short: announcementForm.short.trim(),
      full: announcementForm.full.trim(),
      date: announcementForm.date.trim(),
    };

    setSavingAnnouncement(true);
    try {
      if (editingAnnouncementId) {
        await updateDoc(doc(db, "announcements", editingAnnouncementId), payload);
        showToast("Announcement updated");
      } else {
        await addDoc(collection(db, "announcements"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        showToast("Announcement added");
      }
      resetAnnouncementForm();
    } catch (err) {
      console.error(err);
      showToast("Could not save announcement", "error");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement(docId) {
    const ok = window.confirm("Delete this announcement?");
    if (!ok) return;

    setDeletingAnnouncementId(docId);
    try {
      await deleteDoc(doc(db, "announcements", docId));
      if (editingAnnouncementId === docId) resetAnnouncementForm();
      showToast("Announcement deleted");
    } catch (err) {
      console.error(err);
      showToast("Could not delete announcement", "error");
    } finally {
      setDeletingAnnouncementId(null);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/admin27-login", { replace: true });
  }

  async function updateStatus(docId, newStatus) {
    setUpdatingId(docId + "_status");
    try {
      const payload = { status: newStatus };

      if (newStatus === "accepted") {
        const order = orders.find((o) => o.docId === docId);
        const activeOrders = orders.filter(
          (o) =>
            (o.status === "accepted" || o.status === "in_progress") &&
            o.docId !== docId
        );
        const result = suggestDeadline(order, activeOrders, CAPACITY, BUFFER_DAYS);
        payload.makingTime         = result.makingTime;
        payload.confirmedDeadline  = result.suggestedDeadline;
        payload.dailyAllocations   = result.dailyAllocations;
      }

      await updateDoc(doc(db, "orders", docId), payload);
      showToast("Status updated");
    } catch (err) {
      console.error(err);
      showToast("Update failed — try again", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleWhatsapp(docId, current) {
    setUpdatingId(docId + "_wa");
    try {
      await updateDoc(doc(db, "orders", docId), { whatsappConfirmed: !current });
      showToast(current ? "WhatsApp confirmation removed" : "WhatsApp confirmed");
    } catch (err) {
      console.error(err);
      showToast("Update failed - try again", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  function startEditProduct(product) {
    const categories = getProductCategories(product);

    setEditingProductId(product.docId);
    setProductForm({
      name: product.name || "",
      categories,
      price: String(product.price ?? ""),
      makingTimeHours: String(product.makingTimeHours ?? ""),
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      images: Array.isArray(product.images) ? product.images.join(", ") : "",
    });

    setProductCategories((prev) => sortCategories(normalizeCategoryList([...prev, ...categories])));
  }

  function toggleProductCategory(category) {
    setProductForm((prev) => {
      const current = normalizeCategoryList(prev.categories);
      const hasCategory = current.includes(category);
      const next = hasCategory
        ? current.filter((item) => item !== category)
        : [...current, category];

      return {
        ...prev,
        categories: sortCategories(next),
      };
    });
  }

  function handleAddProductCategory() {
    const normalized = normalizeCategory(newCategoryInput);

    if (!normalized) {
      showToast("Enter a valid category name", "error");
      return;
    }

    const exists = productCategories.includes(normalized);
    setProductCategories((prev) =>
      exists ? prev : sortCategories(normalizeCategoryList([...prev, normalized]))
    );

    setProductForm((prev) => ({
      ...prev,
      categories: sortCategories(normalizeCategoryList([...(prev.categories || []), normalized])),
    }));

    setNewCategoryInput("");
    showToast(exists ? "Category already exists and is now selected" : "Category added");
  }

  function handleDeleteProductCategory(category) {
    const ok = window.confirm(`Delete category "${formatCategoryLabel(category)}" from this panel?`);
    if (!ok) return;

    setProductCategories((prev) => prev.filter((item) => item !== category));
    setProductForm((prev) => ({
      ...prev,
      categories: normalizeCategoryList((prev.categories || []).filter((item) => item !== category)),
    }));
    showToast("Category removed");
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    if (savingProduct) return;

    const name = productForm.name.trim();
    const categories = normalizeCategoryList(productForm.categories);
    const price = Number(productForm.price);
    const parsedMakingTime = Number(productForm.makingTimeHours || 0);
    const makingTimeHours = Number.isNaN(parsedMakingTime) || parsedMakingTime < 0 ? 0 : parsedMakingTime;

    if (!name || Number.isNaN(price) || price < 0 || categories.length === 0) {
      showToast("Name, valid price, and at least one category are required", "error");
      return;
    }

    const parsedImages = productForm.images
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      name,
      category: categories[0] || "",
      categories,
      price,
      makingTimeHours,
      description: productForm.description.trim(),
      imageUrl: productForm.imageUrl.trim(),
      images: parsedImages,
    };

    setSavingProduct(true);
    try {
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), payload);
        showToast("Product updated");
      } else {
        await addDoc(collection(db, "products"), payload);
        showToast("Product added");
      }
      resetProductForm();
    } catch (err) {
      console.error(err);
      showToast("Could not save product", "error");
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(docId) {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    setDeletingProductId(docId);
    try {
      await deleteDoc(doc(db, "products", docId));
      if (editingProductId === docId) resetProductForm();
      showToast("Product deleted");
    } catch (err) {
      console.error(err);
      showToast("Could not delete product", "error");
    } finally {
      setDeletingProductId(null);
    }
  }

  async function handleDeleteOrder(docId) {
    const ok = window.confirm("Permanently delete this cancelled order?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "orders", docId));
      showToast("Order deleted");
    } catch (err) {
      console.error(err);
      showToast("Could not delete order", "error");
    }
  }

  function toggleExpanded(docId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }

  function handleSortField(field) {
    if (sortField === field) {
      setSortField(null);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const getTotal = (order) =>
    (order.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filtered = orders
    .filter((o) => {
      const statusMatch = filter === "all" || o.status === filter;
      const searchMatch =
        !normalizedSearch ||
        String(o.orderId     || "").toLowerCase().includes(normalizedSearch) ||
        String(o.customerName|| "").toLowerCase().includes(normalizedSearch) ||
        String(o.phone       || "").toLowerCase().includes(normalizedSearch);
      return statusMatch && searchMatch;
    })
    .sort((a, b) => {
      if (!sortField) {
        if (filter === "pending") {
          const aDate = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const bDate = b.createdAt?.toDate?.()?.getTime() ?? 0;

          if (aDate < bDate) return -1;
          if (aDate > bDate) return 1;
        }

        return 0;
      }

      let aVal, bVal;
      if (sortField === "confirmedDeadline") {
        const aTime = a.confirmedDeadline?.toDate?.()?.getTime();
        const bTime = b.confirmedDeadline?.toDate?.()?.getTime();

        // Orders with no deadline should always sink to the bottom.
        aVal = aTime ?? (sortDir === "asc" ? Infinity : -Infinity);
        bVal = bTime ?? (sortDir === "asc" ? Infinity : -Infinity);
      } else if (sortField === "total") {
        aVal = getTotal(a);
        bVal = getTotal(b);
      } else {
        aVal = String(a[sortField] ?? "").toLowerCase();
        bVal = String(b[sortField] ?? "").toLowerCase();
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const counts = STATUS_OPTIONS.filter((s) => s !== "all").reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  // Auth loading spinner
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-[#0f0d1a]">
        <span className="w-6 h-6 rounded-full border-2 border-yarn/20 dark:border-[#3d2f5a] border-t-yarn dark:border-t-[#c4a8cc] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0f0d1a] text-text dark:text-[#e0d4f0] transition-colors duration-300">

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Floating sidebar re-open */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-9 h-9 rounded-full
            bg-yarn          dark:bg-[#2a1f3d]
            border border-yarn/30 dark:border-[#3d2f5a]
            text-white dark:text-[#c4a8cc]
            shadow-[0_4px_16px_rgba(107,78,113,0.25)] dark:shadow-none
            flex items-center justify-center hover:opacity-85 transition"
          title="Open sidebar"
        >
          <MenuIcon />
        </button>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className={`grid gap-6 ${sidebarOpen ? "lg:grid-cols-[268px_1fr]" : "grid-cols-1"}`}>

          {/* ════════════════ SIDEBAR ════════════════ */}
          {sidebarOpen && (
            <aside className="
              rounded-[28px]
              border border-yarn/18     dark:border-[#2e2545]
              bg-[#FEE8C8]              dark:bg-[#16122a]
              p-5 flex flex-col gap-4 min-h-[calc(100vh-3rem)]
              transition-colors duration-300
              shadow-[0_2px_24px_rgba(107,78,113,0.07)] dark:shadow-none
            ">

              {/* Top bar */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.22em] uppercase font-semibold
                  text-yarn/60 dark:text-[#7a6490]">
                  Admin Dashboard
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleDark}
                    className="w-7 h-7 rounded-full flex items-center justify-center
                      bg-yarn/12     dark:bg-[#2a1f3d]
                      text-yarn      dark:text-[#c4a8cc]
                      hover:bg-yarn/22 dark:hover:bg-[#3a2e50] transition"
                    title="Toggle dark mode"
                  >
                    {darkMode ? <SunIcon /> : <MoonIcon />}
                  </button>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center
                      bg-yarn/12     dark:bg-[#2a1f3d]
                      text-yarn      dark:text-[#c4a8cc]
                      hover:bg-yarn/22 dark:hover:bg-[#3a2e50] transition"
                    title="Close sidebar"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Brand pill */}
              <div className="rounded-full px-5 py-2.5 text-center
                bg-yarn/12       dark:bg-[#2a1f3d]
                border border-yarn/30 dark:border-[#3d2f5a]
                text-yarn        dark:text-[#d4b8e0]
                text-xl font-poiret tracking-wide mb-2">
                The Silly Stitch
              </div>

              {/* Simple Sidebar Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowAnnouncementsPanel(true)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium bg-yarn text-white hover:opacity-90 shadow-sm transition"
                >
                  Announcements
                </button>

                <button
                  onClick={() => setShowProductsPanel(true)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium bg-pinky text-[#5a2434] dark:bg-[#3a1e35] dark:text-[#f0aad0] hover:opacity-90 shadow-sm transition"
                >
                  Products
                </button>

                <button
                  onClick={() => setShowNotifsPanel(true)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium bg-cream dark:bg-[#1e1a30] border border-yarn/20 dark:border-[#3d2f5a] text-yarn dark:text-[#c4a8cc] hover:opacity-90 shadow-sm transition"
                >
                  Notification List
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-yarn/12 dark:bg-[#2a2040]" />

              {/* ── Sort section ── */}
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase font-semibold
                  text-yarn/50 dark:text-[#6a5878] mb-2 px-0.5">
                  Sort orders
                </p>

                {/* Field pills */}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  {SORT_FIELDS.map(({ value, label }) => {
                    const active = sortField === value;
                    return (
                      <button
                        key={value}
                        onClick={() => handleSortField(value)}
                        className={`rounded-xl py-2 text-xs font-medium flex flex-col items-center gap-0.5 border transition
                          ${active
                            ? "bg-yarn/15      dark:bg-[#2e2048] border-yarn/40     dark:border-[#5a3e80] text-yarn      dark:text-[#d4b8e0]"
                            : "bg-cream/80     dark:bg-[#1e1a30] border-yarn/15     dark:border-[#2a2040] text-text/55   dark:text-[#6a5878] hover:border-yarn/30 dark:hover:border-[#3d2f5a]"
                          }`}
                      >
                        <span>{label}</span>
                        {active && (
                          <span className="text-yarn dark:text-[#c4a8cc] mt-0.5">
                            {sortDir === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Direction toggle */}
                <div className="flex gap-1.5">
                  {[
                    { dir: "asc",  label: "Ascending" },
                    { dir: "desc", label: "Descending" },
                  ].map(({ dir, label }) => (
                    <button
                      key={dir}
                      onClick={() => setSortDir(dir)}
                      disabled={!sortField}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-medium border flex items-center justify-center gap-1 transition
                        ${sortDir === dir
                          ? "bg-pinky/70    dark:bg-[#3a1e35] border-pinky       dark:border-[#6b2e55] text-[#5a2434] dark:text-[#f0aad0]"
                          : "bg-cream/80   dark:bg-[#1e1a30] border-yarn/15     dark:border-[#2a2040] text-text/45  dark:text-[#5a4878] hover:border-yarn/30"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {dir === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-yarn/12 dark:bg-[#2a2040]" />

              {/* ── Status filters ── */}
              <div className="flex-1">
                <p className="text-[10px] tracking-[0.18em] uppercase font-semibold
                  text-yarn/50 dark:text-[#6a5878] mb-2 px-0.5">
                  Filter by status
                </p>
                <div className="space-y-1.5">

                  {/* All */}
                  <button
                    onClick={() => setFilter("all")}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium flex items-center justify-between transition
                      ${filter === "all"
                        ? "bg-pinky/80      dark:bg-[#3a1e35] border-pinky          dark:border-[#6b2e55] text-[#5a2434]  dark:text-[#f0aad0]"
                        : "bg-cream/70      dark:bg-[#1e1a30] border-yarn/15        dark:border-[#2a2040] text-text        dark:text-[#c0aad8] hover:border-yarn/30 dark:hover:border-[#3d2f5a]"
                      }`}
                  >
                    <span>All orders</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                      ${filter === "all"
                        ? "bg-[#5a2434]/10  dark:bg-[#6b2e55]/40  text-[#5a2434]  dark:text-[#f0aad0]"
                        : "bg-yarn/10       dark:bg-[#2a1f3d]      text-yarn/70    dark:text-[#9b82b0]"
                      }`}>
                      {orders.length}
                    </span>
                  </button>

                  {/* Per-status */}
                  {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => {
                    const active = filter === s;
                    const dot = STATUS_STYLES[s].dot;
                    return (
                      <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium flex items-center justify-between transition
                          ${active
                            ? "bg-pinky/80    dark:bg-[#3a1e35] border-pinky       dark:border-[#6b2e55] text-[#5a2434] dark:text-[#f0aad0]"
                            : "bg-cream/70    dark:bg-[#1e1a30] border-yarn/15     dark:border-[#2a2040] text-text       dark:text-[#c0aad8] hover:border-yarn/30 dark:hover:border-[#3d2f5a]"
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                          <span className="capitalize">{s.replaceAll("_", " ")}</span>
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                          ${active
                            ? "bg-[#5a2434]/10  dark:bg-[#6b2e55]/40 text-[#5a2434] dark:text-[#f0aad0]"
                            : "bg-yarn/10       dark:bg-[#2a1f3d]    text-yarn/70   dark:text-[#9b82b0]"
                          }`}>
                          {counts[s] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="w-full rounded-xl
                  bg-yarn             dark:bg-[#2a1f3d]
                  border border-yarn  dark:border-[#4a3560]
                  text-white          dark:text-[#d4b8e0]
                  py-3 text-sm font-semibold tracking-widest uppercase
                  hover:bg-yarn/90    dark:hover:bg-[#3a2e50]
                  transition shadow-[0_2px_12px_rgba(107,78,113,0.2)] dark:shadow-none"
              >
                Sign Out
              </button>
            </aside>
          )}

          {/* ════════════════ MAIN ════════════════ */}
          <main className="py-2 min-w-0">

            {/* Search bar */}
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none
                text-yarn/40 dark:text-[#5a4878]">
                <SearchIcon />
              </span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, order ID, or phone…"
                className="w-full rounded-2xl
                  border border-yarn/20     dark:border-[#2a2040]
                  bg-[#FFFDF5]              dark:bg-[#16122a]
                  pl-10 pr-5 py-3 text-sm
                  placeholder:text-text/35  dark:placeholder:text-[#4a3868]
                  text-text                 dark:text-[#e0d4f0]
                  focus:outline-none focus:border-yarn/50 dark:focus:border-[#5a3e80]
                  shadow-[0_1px_8px_rgba(107,78,113,0.06)] dark:shadow-none
                  transition-colors"
              />
            </div>

            {/* Heading + count */}
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <p className="text-4xl font-poiret uppercase tracking-wide
                text-text/88 dark:text-[#e0d4f0]">
                {filter === "all" ? "All Orders" : filter.replaceAll("_", " ")}
              </p>
              <span className="text-xs shrink-0
                text-text/35 dark:text-[#5a4878]">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Active sort chip */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-text/35 dark:text-[#4a3868]">Sorted by</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full
                bg-yarn/8    dark:bg-[#2a1f3d]
                border border-yarn/18 dark:border-[#3d2f5a]
                text-yarn    dark:text-[#c4a8cc]">
                {sortField ? SORT_FIELDS.find((f) => f.value === sortField)?.label : "Default"}
                {sortField && (sortDir === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              </span>
            </div>

            {/* Error banner */}
            {fetchError && (
              <div className="rounded-2xl border border-red-200 dark:border-red-900
                bg-red-50 dark:bg-red-950/40 p-4
                text-red-600 dark:text-red-300 text-sm mb-4">
                {fetchError}
              </div>
            )}

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-24 gap-3
                text-text/38 dark:text-[#4a3868] text-sm">
                <span className="w-4 h-4 rounded-full border-2
                  border-yarn/18 dark:border-[#3d2f5a]
                  border-t-yarn  dark:border-t-[#c4a8cc] animate-spin" />
                Loading orders…
              </div>

            ) : filtered.length === 0 ? (
              <div className="rounded-2xl
                border border-yarn/12 dark:border-[#2a2040]
                bg-[#FFFDF5]          dark:bg-[#16122a]
                p-10 text-text/38     dark:text-[#4a3868] text-sm text-center">
                No orders match this filter.
              </div>

            ) : (
              <div className="space-y-2.5">
                {filtered.map((order) => {
                  const isExpanded = expandedIds.has(order.docId);
                  const isUpdating = updatingId?.startsWith(order.docId);
                  const total      = getTotal(order);
                  const activeOrders = orders.filter(
                    (o) =>
                      (o.status === "accepted" || o.status === "in_progress") &&
                      o.docId !== order.docId
                  );
                  const scheduleResult = suggestDeadline(order, activeOrders, CAPACITY, BUFFER_DAYS);
                  const displayDeadline = order.confirmedDeadline
                    ? order.confirmedDeadline.toDate
                      ? order.confirmedDeadline.toDate()
                      : new Date(order.confirmedDeadline)
                    : scheduleResult.suggestedDeadline;
                  const showDeadline = !["completed", "cancelled"].includes(order.status);
                  const shouldShowConfirmedLabel =
                    Boolean(order.confirmedDeadline) ||
                    order.status === "accepted" ||
                    order.status === "in_progress";

                  return (
                    <div
                      key={order.docId}
                      className="rounded-2xl overflow-hidden transition-colors duration-200
                        border border-yarn/12  dark:border-[#2a2040]
                        bg-[#FFFDF5]           dark:bg-[#16122a]
                        shadow-[0_1px_6px_rgba(107,78,113,0.05)] dark:shadow-none"
                    >
                      {/* Collapsed header */}
                      <div
                        onClick={() => toggleExpanded(order.docId)}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 cursor-pointer
                          hover:bg-cream/60 dark:hover:bg-[#1e1a30] transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold tracking-wide
                              text-text dark:text-[#e0d4f0]">
                              #{order.orderId}
                            </p>
                            {order.customerName && (
                              <p className="text-sm text-text/60 dark:text-[#9b82b0]">
                                {order.customerName}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-text/38 dark:text-[#4a3868]">
                            {formatDate(order.createdAt)}
                          </p>
                          {showDeadline && (
                            <p className="text-xs font-medium text-yarn/70 dark:text-[#9b82b0]">
                              {shouldShowConfirmedLabel ? "Deadline" : "Est. deadline"}:{" "}
                              {displayDeadline.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-sm font-medium text-yarn/70 dark:text-[#9b82b0]">
                            Rs {total}
                          </span>
                          <StatusBadge status={order.status} />
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center
                            border border-yarn/18   dark:border-[#3d2f5a]
                            text-yarn/40            dark:text-[#6a5878]
                            transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                            <ChevronDownIcon />
                          </span>
                        </div>
                      </div>

                      {/* Expanded panel */}
                      {isExpanded && (
                        <div className="border-t border-yarn/10 dark:border-[#2a2040] px-4 pb-4 pt-3.5 space-y-4">

                          {/* Items */}
                          <div className="rounded-xl p-3 space-y-2
                            bg-cream/70        dark:bg-[#0f0d1a]/70
                            border border-yarn/10 dark:border-[#1e1a30]">
                            {(order.items || []).map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-text/68 dark:text-[#b0a0c8]">
                                  {item.name}
                                  <span className="text-text/35 dark:text-[#4a3868] ml-1.5">x{item.quantity}</span>
                                </span>
                                <span className="text-text/55 dark:text-[#9b82b0]">Rs {item.price * item.quantity}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-semibold pt-2
                              border-t border-yarn/10 dark:border-[#2a2040]">
                              <span className="text-text dark:text-[#e0d4f0]">Total</span>
                              <span className="text-yarn dark:text-[#d4b8e0]">Rs {total}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2.5">

                            {/* WhatsApp link */}
                            <a
                              href={`https://wa.me/91${order.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-medium
                                text-yarn        dark:text-[#c4a8cc]
                                underline decoration-yarn/25 dark:decoration-[#6b5080]
                                underline-offset-2 hover:decoration-yarn dark:hover:decoration-[#c4a8cc]
                                transition"
                            >
                              {order.phone}
                            </a>

                            {/* Status dropdown */}
                            <select
                              value={order.status}
                              disabled={isUpdating}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); updateStatus(order.docId, e.target.value); }}
                              className="rounded-xl px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50 transition-colors
                                border border-yarn/20    dark:border-[#3d2f5a]
                                bg-cream/80              dark:bg-[#1e1a30]
                                text-text                dark:text-[#c0aad8]"
                            >
                              {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
                              ))}
                            </select>

                            {/* WhatsApp confirm */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleWhatsapp(order.docId, order.whatsappConfirmed); }}
                              disabled={isUpdating}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-medium
                                flex items-center gap-1.5 disabled:opacity-50 transition-colors
                                ${order.whatsappConfirmed
                                  ? "border-yarn/25      dark:border-[#4a3560] bg-yarn/8       dark:bg-[#2a1f3d] text-yarn      dark:text-[#c4a8cc]"
                                  : "border-yarn/15      dark:border-[#2a2040] bg-cream/60     dark:bg-[#1e1a30] text-text/50   dark:text-[#5a4878] hover:border-yarn/28 dark:hover:border-[#3d2f5a]"
                                }`}
                            >
                              {order.whatsappConfirmed && <CheckIcon />}
                              {order.whatsappConfirmed ? "WhatsApp confirmed" : "Mark WhatsApp confirmed"}
                            </button>

                            {/* Delete — only for cancelled orders */}
                            {order.status === "cancelled" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOrder(order.docId);
                                }}
                                className="rounded-xl border border-red-200 dark:border-red-800
                                  bg-red-50 dark:bg-red-950/40
                                  px-3 py-1.5 text-xs font-medium
                                  text-red-600 dark:text-red-300
                                  hover:bg-red-100 dark:hover:bg-red-900/60
                                  transition"
                              >
                                Delete order
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      <AnnouncementsPanel
        open={showAnnouncementsPanel}
        onClose={() => setShowAnnouncementsPanel(false)}
        announcements={announcements}
        announcementsLoading={announcementsLoading}
        announcementError={announcementError}
        announcementForm={announcementForm}
        setAnnouncementForm={setAnnouncementForm}
        handleSaveAnnouncement={handleSaveAnnouncement}
        startEditAnnouncement={startEditAnnouncement}
        handleDeleteAnnouncement={handleDeleteAnnouncement}
        editingAnnouncementId={editingAnnouncementId}
        savingAnnouncement={savingAnnouncement}
        deletingAnnouncementId={deletingAnnouncementId}
        resetAnnouncementForm={resetAnnouncementForm}
        announcementDraftSavedAt={announcementDraftSavedAt}
      />

      <ProductsPanel
        open={showProductsPanel}
        onClose={() => setShowProductsPanel(false)}
        products={products}
        productsLoading={productsLoading}
        productError={productError}
        productForm={productForm}
        setProductForm={setProductForm}
        productCategories={productCategories}
        newCategoryInput={newCategoryInput}
        setNewCategoryInput={setNewCategoryInput}
        handleAddProductCategory={handleAddProductCategory}
        handleDeleteProductCategory={handleDeleteProductCategory}
        toggleProductCategory={toggleProductCategory}
        handleSaveProduct={handleSaveProduct}
        startEditProduct={startEditProduct}
        handleDeleteProduct={handleDeleteProduct}
        editingProductId={editingProductId}
        savingProduct={savingProduct}
        deletingProductId={deletingProductId}
        resetProductForm={resetProductForm}
        productDraftSavedAt={productDraftSavedAt}
      />

      <NotifsPanel
        open={showNotifsPanel}
        onClose={() => setShowNotifsPanel(false)}
        orders={orders}
      />

    </div>
  );
}







