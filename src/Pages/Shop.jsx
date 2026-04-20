import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/Config";
import PageContainer from "../components/PageContainer";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";

// ─── Toast ────────────────────────────────────────────────────────────────────
function CartToast({ visible, productName }) {
  return (
    <div className={`
      fixed top-5 left-1/2 -translate-x-1/2 z-[60]
      w-[min(92vw,420px)]
      bg-[#2a1f3d] dark:bg-[#f3e5f7]
      border border-[#5b3f77] dark:border-[#d1b1dd]
      text-[#fff7ef] dark:text-[#5b4368]
      px-4 py-3 rounded-2xl
      shadow-[0_14px_32px_rgba(58,38,74,0.35)] dark:shadow-[0_12px_28px_rgba(182,146,197,0.28)]
      text-sm font-medium
      transition-all duration-300
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}
    `}>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#e9d8f2] dark:text-[#886596]">
          Cart updated
        </span>
        <span className="break-words">
          <span className="font-semibold">{productName}</span> added to cart.
        </span>
      </div>
    </div>
  );
}

// ─── Sticky Cart Bar ──────────────────────────────────────────────────────────
function StickyCartBar({ totalItems, totalPrice }) {
  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
      <Link
        to="/cart"
        className="
          flex items-center justify-between
          w-full max-w-lg mx-auto
          bg-yarn dark:bg-[#2a1f3d]
          text-white dark:text-[#e0d4f0]
          px-5 py-3.5 rounded-2xl
          shadow-[0_8px_32px_rgba(107,78,113,0.35)]
          active:scale-95 transition-transform duration-150
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🛒</span>
          <span className="font-semibold text-sm">Go to Cart</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="font-bold">₹{totalPrice}</span>
        </div>
      </Link>
    </div>
  );
}

// ─── Product Overlay ──────────────────────────────────────────────────────────
function ProductOverlay({ product, onClose, onAddToCart }) {
  if (!product) return null;

  const imageList =
    product.images?.length
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : ["/placeholder.webp"];

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="
        absolute bottom-0 w-full bg-white dark:bg-[#16122a] rounded-t-3xl p-6
        lg:bottom-auto lg:top-1/2 lg:left-1/2
        lg:-translate-x-1/2 lg:-translate-y-1/2
        lg:max-w-3xl lg:rounded-3xl
      ">
        <div className="flex gap-4 overflow-x-auto mb-4">
          {imageList.map((img, i) => (
            <img key={i} src={img} alt="" className="w-40 h-40 rounded-xl object-cover flex-shrink-0" />
          ))}
        </div>
        <h2 className="text-2xl font-bold dark:text-[#e0d4f0]">{product.name}</h2>
        <p className="text-yarn font-bold text-lg mt-1">₹{product.price}</p>
        <p className="text-gray-600 dark:text-[#9b82b0] mt-3">{product.description}</p>
        <button
          onClick={() => { onAddToCart(product); onClose(); }}
          className="mt-6 w-full bg-yarn text-white py-3 rounded-xl font-semibold"
        >
          🛒 Add to cart
        </button>
      </div>
    </div>
  );
}

// ─── Shop Navbar ──────────────────────────────────────────────────────────────
function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getProductCategories(product) {
  const fromArray = Array.isArray(product?.categories) ? product.categories : [];
  const legacyCategory = product?.category ? [product.category] : [];
  const unique = new Set();
  [...fromArray, ...legacyCategory].forEach((item) => {
    const normalized = normalizeCategory(item);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
}

function formatCategoryLabel(category) {
  return String(category || "").replaceAll("_", " ");
}

const PRICE_OPTIONS = [
  { label: "All prices", value: "all" },
  { label: "Under ₹50",  value: 50  },
  { label: "Under ₹100", value: 100 },
  { label: "Under ₹150", value: 150 },
  { label: "Under ₹200", value: 200 },
  { label: "Under ₹500", value: 500 },
];

function ShopNavbar({ categories, category, setCategory, priceFilter, setPriceFilter, search, setSearch }) {
  return (
    <div className="sticky top-0 z-20 mb-4">
      <div className="relative overflow-hidden rounded-2xl border border-[#ead8bd] dark:border-[#3b2f53] bg-gradient-to-br from-[#fff7e8]/95 via-[#fffdf6]/95 to-[#fdeedf]/95 dark:from-[#1b152c]/95 dark:via-[#181226]/95 dark:to-[#221a34]/95 px-4 py-3 shadow-[0_10px_28px_rgba(107,78,113,0.14)] backdrop-blur-xl">
        <span className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-pinky/40 blur-2xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]" />
        <span className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-yarn/25 blur-2xl motion-safe:animate-[pulse_5s_ease-in-out_infinite]" />
        <div className="relative flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs capitalize whitespace-nowrap border transition-colors duration-300
                  ${category === c
                    ? "bg-yarn text-white border-yarn"
                    : "border-yarn/25 bg-white/55 dark:bg-[#241a38]/45 text-text dark:text-[#d4c6ea] hover:border-yarn/55 hover:bg-white/80 dark:hover:bg-[#2d2144]/70 hover:-translate-y-0.5"
                  }`}
              >
                {c === "all" ? "All" : formatCategoryLabel(c)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {PRICE_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPriceFilter(p.value)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors duration-300
                  ${priceFilter === p.value
                    ? "bg-pinky text-[#5a2434] border-pinky"
                    : "border-yarn/25 bg-white/55 dark:bg-[#241a38]/45 text-text dark:text-[#d4c6ea] hover:border-yarn/55 hover:bg-white/80 dark:hover:bg-[#2d2144]/70 hover:-translate-y-0.5"
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="group relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yarn/55 text-sm transition-transform duration-300 group-focus-within:scale-110">🔍︎</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-yarn/20 bg-white/80 dark:bg-[#23193a]/70 dark:text-[#d4c6ea] shadow-inner shadow-white/40 dark:shadow-none focus:outline-none focus:border-yarn/55 focus:ring-2 focus:ring-yarn/20 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shop Page ────────────────────────────────────────────────────────────────
export default function Shop() {
  const [products, setProducts]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [category, setCategory]               = useState("all");
  const [priceFilter, setPriceFilter]         = useState("all");
  const [search, setSearch]                   = useState("");

  // Toast state
  const [toastVisible, setToastVisible]       = useState(false);
  const [toastProduct, setToastProduct]       = useState("");
  const toastTimer                            = useRef(null);

  const { addToCart, totalItems, totalPrice } = useCart();

  const handleAddToCart = useCallback((product) => {
    addToCart(product);
    setToastProduct(product.name);
    setToastVisible(true);

    // Clear any existing timer
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, [addToCart]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      const snapshot = await getDocs(collection(db, "products"));
      setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const categoryOptions = useMemo(() => {
    const discovered = products.flatMap((product) => getProductCategories(product));
    const unique = Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b));
    return ["all", ...unique];
  }, [products]);

  useEffect(() => {
    if (category !== "all" && !categoryOptions.includes(category)) {
      setCategory("all");
    }
  }, [category, categoryOptions]);

  const filteredProducts = products.filter((p) => {
    const productCategories = getProductCategories(p);
    const categoryMatch = category === "all" || productCategories.includes(category);
    const priceMatch    = priceFilter === "all" || Number(p.price) <= priceFilter;
    const searchMatch   = String(p.name || "").toLowerCase().includes(search.toLowerCase());
    return categoryMatch && priceMatch && searchMatch;
  });

  return (
    <PageContainer variant="tight">
      <CartToast visible={toastVisible} productName={toastProduct} />

      <div className="pt-3">
        <ShopNavbar
          categories={categoryOptions}
          category={category}       setCategory={setCategory}
          priceFilter={priceFilter} setPriceFilter={setPriceFilter}
          search={search}           setSearch={setSearch}
        />
      </div>

      {!loading && filteredProducts.length === 0 && (
        <p className="text-center text-gray-500 mt-10">
          {products.length === 0 ? "No products yet." : "No products match your filters."}
        </p>
      )}

      {/* Extra bottom padding so last row isn't hidden behind sticky bar */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 p-4 pb-24">
        {filteredProducts.map((p) => (
          <ProductCard key={p.id} product={p} onClick={setSelectedProduct} />
        ))}
      </div>

      <ProductOverlay
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <StickyCartBar totalItems={totalItems} totalPrice={totalPrice} />
    </PageContainer>
  );
}