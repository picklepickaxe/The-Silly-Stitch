export default function ProductCard({ product, onClick, skeleton = false }) {
  // ── Skeleton tile ──────────────────────────────────────────────────────────
  if (skeleton) {
    return (
      <div className="relative bg-white dark:bg-[#16122a] rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-[#2a2040] animate-pulse">
        {/* Image placeholder */}
        <div className="aspect-[1/1] bg-gray-200 dark:bg-[#2a2040]" />

        {/* Text placeholders */}
        <div className="p-3 space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-[#2a2040]" />
          <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-[#2a2040]" />
        </div>

        {/* Floating icon placeholder */}
        <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-gray-200 dark:bg-[#2a2040]" />
      </div>
    );
  }

  // ── Real tile ──────────────────────────────────────────────────────────────
  const image =
    product.images && product.images.length > 0
      ? product.images[0]
      : "/placeholder.webp";

  return (
    <div
      onClick={() => onClick(product)}
      className="relative bg-white dark:bg-[#16122a] rounded-xl shadow-sm hover:shadow-2xl transition duration-300 cursor-pointer overflow-hidden border border-transparent dark:border-[#2a2040]"
    >
      {/* Image */}
      <div className="aspect-[1/1] bg-gray-100 dark:bg-[#1e1a30]">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="p-3">
        <h2 className="font-medium text-base text-gray-900 dark:text-[#e0d4f0] leading-snug">
          {product.name}
        </h2>
        <p className="mt-1 text-yarn dark:text-[#d4b8e0] font-semibold text-sm">
          ₹{product.price}
        </p>
      </div>

      {/* Floating icon */}
      <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-yarn dark:bg-[#2a1f3d] text-white dark:text-[#d4b8e0] flex items-center justify-center shadow">
        +
      </div>
    </div>
  );
}