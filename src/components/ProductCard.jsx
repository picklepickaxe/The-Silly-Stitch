export default function ProductCard({ product, onClick }) {
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