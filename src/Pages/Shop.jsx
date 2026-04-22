import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase/Config";
import PageContainer from "../components/PageContainer";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";

const PAGE_SIZE = 12;

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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="
        absolute bottom-0 w-full bg-white dark:bg-[#16122a] rounded-t-3xl p-6
        lg:bottom-auto lg:top-1/2 lg:left-1/2
        lg:-translate-x-1/2 lg:-translate-y-1/2
        lg:max-w-3xl lg:rounded-3xl
      ">
        <div className="flex gap-4 overflow-x-auto mb-4">
          {imageList.map((img, i) => (
            <img
              key={i}
              src={img}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-40 h-40 rounded-xl object-cover flex-shrink-0"
            />
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
const CATEGORIES = ["all", "keychain", "plushie", "bracelet", "accessory", "custom"];

const PRICE_OPTIONS = [
  { label: "All prices", value: "all" },
  { label: "Under ₹50",  value: 50  },
  { label: "Under ₹100", value: 100 },
  { label: "Under ₹150", value: 150 },
  { label: "Under ₹200", value: 200 },
  { label: "Under ₹500", value: 500 },
];

function ShopNavbar({ category, setCategory, priceFilter, setPriceFilter, search, setSearch }) {
  return (
    <div className="sticky top-0 z-20 mb-4">
      <div className="relative overflow-hidden rounded-2xl border border-[#ead8bd] dark:border-[#3b2f53] bg-gradient-to-br from-[#fff7e8]/95 via-[#fffdf6]/95 to-[#fdeedf]/95 dark:from-[#1b152c]/95 dark:via-[#181226]/95 dark:to-[#221a34]/95 px-4 py-3 shadow-[0_10px_28px_rgba(107,78,113,0.14)] backdrop-blur-xl">
        <span className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-pinky/40 blur-2xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]" />
        <span className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-yarn/25 blur-2xl motion-safe:animate-[pulse_5s_ease-in-out_infinite]" />

        <div className="relative flex flex-col gap-3">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs capitalize whitespace-nowrap border transition-colors duration-300
                  ${category === c
                    ? "bg-yarn text-white border-yarn"
                    : "border-yarn/25 bg-white/55 dark:bg-[#241a38]/45 text-text dark:text-[#d4c6ea] hover:border-yarn/55 hover:bg-white/80 dark:hover:bg-[#2d2144]/70 hover:-translate-y-0.5"
                  }`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>

          {/* Price filters */}
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

          {/* Search */}
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
  const [products, setProducts]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [loadingMore, setLoadingMore]           = useState(false);
  const [hasMore, setHasMore]                   = useState(true);
  const [selectedProduct, setSelectedProduct]   = useState(null);

  const [category, setCategory]     = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [search, setSearch]         = useState("");

  // Firestore cursor — holds the last DocumentSnapshot of the previous page
  const lastDocRef = useRef(null);

  // Sentinel div at the bottom of the grid — watched by IntersectionObserver
  const sentinelRef = useRef(null);

  const { addToCart } = useCart();

  // ── Fetch a page from Firestore ──────────────────────────────────────────
  const fetchPage = useCallback(async (isFirstPage = false) => {
    // Guard: don't double-fetch while one is in flight
    if (!isFirstPage && (loadingMore || !hasMore)) return;

    isFirstPage ? setLoading(true) : setLoadingMore(true);

    try {
      let q = query(
        collection(db, "products"),
        orderBy("name"),          // keep a consistent order; change to "createdAt" etc. as needed
        limit(PAGE_SIZE),
        ...(isFirstPage || !lastDocRef.current
          ? []
          : [startAfter(lastDocRef.current)])
      );

      const snapshot = await getDocs(q);

      const newProducts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Remember the last doc for the next page cursor
      lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;

      // If we got fewer docs than PAGE_SIZE, we've reached the end
      if (snapshot.docs.length < PAGE_SIZE) setHasMore(false);

      setProducts((prev) => (isFirstPage ? newProducts : [...prev, ...newProducts]));
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      isFirstPage ? setLoading(false) : setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    setProducts([]);
    setHasMore(true);
    lastDocRef.current = null;
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset & re-fetch when filters change ─────────────────────────────────
  // NOTE: category / priceFilter / search are applied CLIENT-SIDE below.
  // If your catalogue grows large, move these to Firestore `where()` clauses
  // and trigger a fresh fetchPage(true) on each filter change instead.

  // ── IntersectionObserver — fires when sentinel enters the viewport ─────────
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(false);
        }
      },
      { rootMargin: "200px" } // start loading 200 px before the sentinel is visible
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchPage]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const categoryMatch = category === "all" || p.category === category;
    const priceMatch    = priceFilter === "all" || p.price <= priceFilter;
    const searchMatch   = p.name.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && priceMatch && searchMatch;
  });

  return (
    <PageContainer variant="tight">
      <h1 className="text-2xl sm:text-3xl font-extrabold font-poiret text-yarn mb-4 text-center">
        Shop Handmade Crochet
      </h1>

      <ShopNavbar
        category={category}       setCategory={setCategory}
        priceFilter={priceFilter} setPriceFilter={setPriceFilter}
        search={search}           setSearch={setSearch}
      />

      {/* Initial full-page load */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <ProductCard key={`skeleton-init-${i}`} skeleton />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!loading && filteredProducts.length === 0 && (
        <p className="text-center text-gray-500 mt-10">
          {products.length === 0
            ? "No products yet."
            : "No products match your filters."}
        </p>
      )}

      {/* Product grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} onClick={setSelectedProduct} />
          ))}

          {/* "Loading more" skeleton tiles appended at the end of the same grid */}
          {loadingMore &&
            Array.from({ length: 4 }).map((_, i) => (
              <ProductCard key={`skeleton-more-${i}`} skeleton />
            ))}
        </div>
      )}

      {/* Sentinel — observed by IntersectionObserver to trigger next page */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* End-of-catalogue message */}
      {!hasMore && !loading && products.length > 0 && (
        <p className="text-center text-gray-400 dark:text-[#6b5a80] text-sm py-8">
          You have seen everything!
        </p>
      )}

      <ProductOverlay
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />
    </PageContainer>
  );
}