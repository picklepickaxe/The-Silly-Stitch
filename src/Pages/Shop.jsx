import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/Config";
import PageContainer from "../components/PageContainer";
import ProductCard from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { getThumbnailUrl, getDetailUrl } from "../utils/cloudinary";

const PAGE_SIZE = 12;

// ─── Product Overlay ──────────────────────────────────────────────────────────
function ProductOverlay({ product, onClose, onAddToCart }) {
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    setLightboxImage(null); // close lightbox whenever a new product opens
  }, [product]);

  if (!product) return null;

  const imageList =
    product.images?.length
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : ["/placeholder.webp"];

  return (
    <>
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
                src={getThumbnailUrl(img)}
                alt=""
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                onClick={() => setLightboxImage(img)}
                className="w-40 h-40 rounded-xl object-cover flex-shrink-0 cursor-zoom-in"
              />
            ))}
          </div>

          <h2 className="min-w-0 break-words text-2xl font-bold dark:text-[#e0d4f0]">
            {product.name}
          </h2>
          <div className="flex items-center flex-wrap gap-2 mt-1">
            <p className="text-yarn font-bold text-lg">₹{product.price}</p>
            <span className="max-w-[42%] shrink-0 rounded-full bg-pinky/30 dark:bg-[#3b2a4f] px-3 py-1 text-center text-xs font-semibold capitalize break-words text-yarn dark:text-[#d4b8e0]">
              {product.category || "uncategorized"}
            </span>
          </div>
          <p className="text-gray-600 dark:text-[#9b82b0] mt-3">{product.description}</p>
          <button
            onClick={() => { onAddToCart(product); onClose(); }}
            className="mt-6 w-full bg-yarn text-white py-3 rounded-xl font-semibold"
          >
            🛒 Add to cart
          </button>
        </div>
      </div>

      {/* Lightbox — opens on top when a thumbnail is tapped */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            aria-label="Close"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl leading-none transition-colors"
          >
            ×
          </button>
          <img
            src={getDetailUrl(lightboxImage)}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}

// ─── Shop Navbar ──────────────────────────────────────────────────────────────

const PRICE_OPTIONS = [
  { label: "All prices", value: "all" },
  { label: "Under ₹50",  value: 50  },
  { label: "Under ₹100", value: 100 },
  { label: "Under ₹150", value: 150 },
  { label: "Under ₹200", value: 200 },
  { label: "Under ₹500", value: 500 },
];

function ShopNavbar({ categoryOptions, category, setCategory, priceFilter, setPriceFilter, search, setSearch }) {
  return (
    <div className="sticky top-0 z-20 mb-4">
      <div className="relative overflow-hidden rounded-2xl border border-[#ead8bd] dark:border-[#3b2f53] bg-gradient-to-br from-[#fff7e8]/95 via-[#fffdf6]/95 to-[#fdeedf]/95 dark:from-[#1b152c]/95 dark:via-[#181226]/95 dark:to-[#221a34]/95 px-4 py-3 shadow-[0_10px_28px_rgba(107,78,113,0.14)] backdrop-blur-xl">
        <span className="pointer-events-none absolute -top-10 -right-6 h-24 w-24 rounded-full bg-pinky/40 blur-2xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]" />
        <span className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-yarn/25 blur-2xl motion-safe:animate-[pulse_5s_ease-in-out_infinite]" />

        <div className="relative flex flex-col gap-3">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {categoryOptions.map((c) => (
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

// ─── Pagination Bar ───────────────────────────────────────────────────────────
function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  // Build a compact page list: 1 ... 4 5 [6] 7 8 ... 20
  const pages = [];
  const windowSize = 1; // pages shown on each side of current

  for (let p = 1; p <= totalPages; p++) {
    const isEdge = p === 1 || p === totalPages;
    const isNearCurrent = Math.abs(p - currentPage) <= windowSize;
    if (isEdge || isNearCurrent) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 py-8 flex-wrap" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-full text-sm border border-yarn/25 text-text dark:text-[#d4c6ea] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/70 dark:hover:bg-[#2d2144]/70 transition-colors"
      >
        ‹ Prev
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400 dark:text-[#6b5a80]">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={`w-9 h-9 rounded-full text-sm font-medium transition-colors
              ${p === currentPage
                ? "bg-yarn text-white"
                : "text-text dark:text-[#d4c6ea] hover:bg-white/70 dark:hover:bg-[#2d2144]/70 border border-yarn/25"
              }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-full text-sm border border-yarn/25 text-text dark:text-[#d4c6ea] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/70 dark:hover:bg-[#2d2144]/70 transition-colors"
      >
        Next ›
      </button>
    </nav>
  );
}

// ─── Shop Page ────────────────────────────────────────────────────────────────
export default function Shop() {
  const [products, setProducts]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [category, setCategory]       = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [categoryOptions, setCategoryOptions] = useState(["all"]);

  const [currentPage, setCurrentPage] = useState(1);

  const { addToCart } = useCart();

  // ── Fetch ALL products once (fine for a catalogue under ~a few hundred) ────
  useEffect(() => {
    async function fetchAllProducts() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "products"));
        const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(all);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAllProducts();
  }, []);

  // ── Fetch categories once for the filter pills ─────────────────────────────
  useEffect(() => {
    async function fetchCategories() {
      try {
        const snap = await getDocs(collection(db, "categories"));
        const names = snap.docs.map((d) => d.data().name).sort();
        setCategoryOptions(["all", ...names]);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    }
    fetchCategories();
  }, []);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const categoryMatch = category === "all" || p.category === category;
    const priceMatch    = priceFilter === "all" || p.price <= priceFilter;
    const searchMatch   = p.name.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && priceMatch && searchMatch;
  });

  // ── Reset to page 1 whenever a filter changes ──────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [category, priceFilter, search]);

  // ── Slice out just the current page ─────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageProducts = filteredProducts.slice(startIdx, startIdx + PAGE_SIZE);

  function goToPage(page) {
    const clamped = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(clamped);
    // Scroll back to the top of the grid so the new page is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <PageContainer variant="tight">
      <h1 className="text-2xl sm:text-3xl font-extrabold font-poiret text-yarn mb-4 text-center">
        Shop Handmade Crochet
      </h1>

      <ShopNavbar
        categoryOptions={categoryOptions}
        category={category}       setCategory={setCategory}
        priceFilter={priceFilter} setPriceFilter={setPriceFilter}
        search={search}           setSearch={setSearch}
      />

      {/* Full-page load */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 p-2 sm:p-4">
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

      {/* Product grid — only the current page's products */}
      {!loading && pageProducts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 p-2 sm:p-4">
          {pageProducts.map((p) => (
            <ProductCard key={p.id} product={p} onClick={setSelectedProduct} />
          ))}
        </div>
      )}

      {/* Numbered pagination */}
      {!loading && (
        <PaginationBar
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}

      <ProductOverlay
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />
    </PageContainer>
  );
}