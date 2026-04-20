import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

function normalizeProduct(product) {
  const image = product.imageUrl || (product.images && product.images[0]) || "/placeholder.webp";
  const rawMakingTime = Number(product.makingTimeHours);
  const makingTimeHours = Number.isFinite(rawMakingTime) && rawMakingTime >= 0 ? rawMakingTime : 0;

  return {
    id: product.id,
    name: product.name,
    price: Number(product.price) || 0,
    makingTimeHours,
    image,
    quantity: 1,
  };
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

  useEffect(() => {
    localStorage.setItem("silly-stitch-cart", JSON.stringify(cartItems));
  }, [cartItems]);

  function addToCart(product) {
    const normalized = normalizeProduct(product);

    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === normalized.id);
      if (existing) {
        return prev.map((item) =>
          item.id === normalized.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                makingTimeHours:
                  typeof item.makingTimeHours === "number"
                    ? item.makingTimeHours
                    : normalized.makingTimeHours,
              }
            : item
        );
      }
      return [...prev, normalized];
    });
  }

  function removeFromCart(productId) {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
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