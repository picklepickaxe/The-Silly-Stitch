import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

const CartContext = createContext();

function normalizeProduct(product) {
  const image = product.imageUrl || (product.images && product.images[0]) || "/placeholder.webp";

  return {
    id: product.id,
    name: product.name,
    price: Number(product.price) || 0,
    image,
    quantity: 1,
  };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
// Rendered globally by CartProvider so it works no matter where addToCart
// is called from (product grid, overlay, related products, etc.)
function CartToast({ message, show }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ease-out
        ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 bg-[#2c2140] text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium">
        <span></span>
        <span>{message}</span>
      </div>
    </div>
  );
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const stored = localStorage.getItem("silly-stitch-cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [toast, setToast] = useState({ show: false, message: "" });
  const toastTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("silly-stitch-cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Clean up the pending timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 2200);
  }, []);

  function addToCart(product) {
    const normalized = normalizeProduct(product);

    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === normalized.id);
      if (existing) {
        return prev.map((item) =>
          item.id === normalized.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, normalized];
    });

    showToast(`Added "${normalized.name}" to cart`);
  }

  function removeFromCart(productId) {
    const item = cartItems.find((i) => i.id === productId);
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
    if (item) showToast(`Removed "${item.name}" from cart`);
  }

  function updateQuantity(productId, quantity) {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  function incrementQuantity(productId) {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decrementQuantity(productId) {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item
      )
    );
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        incrementQuantity,
        decrementQuantity,
        clearCart,
        totalItems,
        totalPrice,
        items: cartItems,
        itemCount: totalItems,
        cartTotal: totalPrice,
      }}
    >
      {children}
      <CartToast message={toast.message} show={toast.show} />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}