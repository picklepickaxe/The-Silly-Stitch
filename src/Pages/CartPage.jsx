import { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "8799741646";
const CART_CHECKOUT_DRAFT_KEY = "silly-stitch-cart-checkout-draft";

function readFromStorage(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatSavedTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeWhatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  // If a 10-digit local number is provided, assume India (+91).
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, clearCart, totalPrice, totalItems } = useCart();
  const { isLoggedIn, openAuthModal, user, profile } = useAuth();
  const [resumeCheckoutAfterAuth, setResumeCheckoutAfterAuth] = useState(false);

  // Name and email now come from the account, not typed in here.
  const accountName = profile?.name?.trim() || user?.displayName?.trim() || "";
  const accountEmail = user?.email?.trim() || "";

  // Only phone still needs to be typed — it's not stored on the account yet.
  const [checkoutDraft] = useState(() => readFromStorage(CART_CHECKOUT_DRAFT_KEY, {}));
  const [phone, setPhone] = useState(checkoutDraft.phone || "");
  const [checkoutSavedAt, setCheckoutSavedAt] = useState(checkoutDraft.savedAt || null);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Placing order...");
  const [error, setError] = useState("");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [confirmReadHowTo, setConfirmReadHowTo] = useState(false);
  const [confirmReadPolicy, setConfirmReadPolicy] = useState(false);

  const isFormValid = useMemo(() => {
    if (!isLoggedIn) return true; // phone alone is enough pre-login; login gate happens on click
    return Boolean(accountName) && Boolean(accountEmail) && /^\d{10}$/.test(phone.trim());
  }, [isLoggedIn, accountName, accountEmail, phone]);

  useEffect(() => {
    if (!resumeCheckoutAfterAuth || !isLoggedIn) return;

    setResumeCheckoutAfterAuth(false);

    if (!cartItems.length || placingOrder) return;
    if (!isFormValid) {
      setError("Please add a valid 10-digit WhatsApp number to continue.");
      return;
    }

    setError("");
    setShowPolicyModal(true);
  }, [resumeCheckoutAfterAuth, isLoggedIn, cartItems.length, placingOrder, isFormValid]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const timeout = setTimeout(() => {
      const hasDraftContent = phone.trim().length > 0 || cartItems.length > 0;

      if (!hasDraftContent) {
        window.localStorage.removeItem(CART_CHECKOUT_DRAFT_KEY);
        setCheckoutSavedAt(null);
        return;
      }

      const payload = {
        phone,
        cartSnapshot: cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
        savedAt: Date.now(),
      };

      window.localStorage.setItem(CART_CHECKOUT_DRAFT_KEY, JSON.stringify(payload));
      setCheckoutSavedAt(payload.savedAt);
    }, 500);

    return () => clearTimeout(timeout);
  }, [phone, cartItems]);

  function closePolicyModal() {
    setShowPolicyModal(false);
    setConfirmReadHowTo(false);
    setConfirmReadPolicy(false);
  }

  async function submitOrderToWhatsapp() {
    if (!cartItems.length || !isFormValid || placingOrder || !isLoggedIn) return;

    setError("");
    setPlacingOrder(true);
    setLoadingMessage("Placing order...");

    const t1 = setTimeout(() => setLoadingMessage("Still working on it..."), 4000);
    const t2 = setTimeout(() => setLoadingMessage("Waking up our server, almost there..."), 10000);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("https://the-silly-stitch.onrender.com/placeOrder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customerName: accountName,
          email: accountEmail,
          phone: phone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not place order.");
      }

      const { orderId, items: resolvedItems, total, customerName: name, email: mail, phone: ph } = result;

      const itemLines = resolvedItems
        .map((item) => `${item.name} x ${item.quantity} = Rs ${item.price * item.quantity}`)
        .join("\n");

      const message = [
        `Hi, I want to confirm my order ${orderId}`,
        `Name: ${name}`,
        `Email: ${mail}`,
        `Phone: ${ph}`,
        "Items:",
        itemLines,
        `Total: Rs ${total}`,
      ].join("\n");

      clearCart();
      setPhone("");
      setCheckoutSavedAt(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(CART_CHECKOUT_DRAFT_KEY);
      }

      const whatsappTarget = normalizeWhatsappNumber(WHATSAPP_NUMBER);
      window.location.href = `https://wa.me/${whatsappTarget}?text=${encodeURIComponent(message)}`;
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not place order. Please try again.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setPlacingOrder(false);
    }
  }

  function handleOrderNow() {
    if (!cartItems.length || placingOrder) return;

    if (!isLoggedIn) {
      openAuthModal({
        mode: "login",
        onSuccess: () => setResumeCheckoutAfterAuth(true),
      });
      return;
    }

    if (!isFormValid) return;

    setError("");
    setShowPolicyModal(true);
  }

  async function handlePolicyConfirmAndOrder() {
    if (!confirmReadHowTo || !confirmReadPolicy || placingOrder) return;
    closePolicyModal();
    await submitOrderToWhatsapp();
  }

  if (cartItems.length === 0) {
    return (
      <PageContainer>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-12">
          <svg className="w-28 h-28 mb-8" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="42" width="84" height="64" rx="10" fill="#f5f4f0" stroke="#d1cfc7" strokeWidth="1.5"/>
            <path d="M42 42V34C42 24.6 50.1 17 60 17C69.9 17 78 24.6 78 34V42" stroke="#b0aea6" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <line x1="60" y1="66" x2="60" y2="86" stroke="#d1cfc7" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="50" y1="76" x2="70" y2="76" stroke="#d1cfc7" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>

          <h2 className="text-2xl font-serif font-normal text-gray-900 dark:text-[#e0d4f0] tracking-tight mb-2">
            Your bag is empty
          </h2>
          <p className="text-sm text-gray-400 dark:text-[#6a5878] max-w-[260px] leading-relaxed mb-8">
            You haven't added anything yet. Find something you'll love.
          </p>
          <Link
            to="/shop"
            className="px-9 py-3 bg-yarn text-white rounded-full text-sm font-medium tracking-wide hover:opacity-75 transition"
          >
            Browse the shop
          </Link>

        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[#e0d4f0]">Your Cart</h1>
          <p className="text-gray-400 dark:text-[#6a5878] text-sm mt-1">{totalItems} {totalItems === 1 ? "item" : "items"} in your bag</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] items-start">

          {/* Cart Items */}
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 items-center bg-white dark:bg-[#16122a] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#2a2040] transition hover:shadow-md"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="w-20 h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 dark:text-[#e0d4f0] truncate">{item.name}</h2>
                  <p className="text-sm text-gray-400 dark:text-[#6a5878] mt-0.5">Rs {item.price} each</p>

                  {/* Quantity controls */}
                  <div className="mt-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#2a2040] hover:bg-gray-200 dark:hover:bg-[#3a3050] text-gray-700 dark:text-[#c0aad8] font-bold text-base flex items-center justify-center transition"
                    >
                      −
                    </button>
                    <span className="min-w-[28px] text-center text-sm font-medium text-gray-800">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#2a2040] hover:bg-gray-200 dark:hover:bg-[#3a3050] text-gray-700 dark:text-[#c0aad8] font-bold text-base flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price + remove */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="font-semibold text-gray-900 dark:text-[#e0d4f0]">Rs {item.price * item.quantity}</p>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* Clear cart */}
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-red-500 hover:underline transition"
              >
                Clear your cart
              </button>
            </div>
          </div>

          {/* Checkout sidebar */}
          <aside className="bg-white dark:bg-[#16122a] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2a2040] overflow-hidden">

            {/* Order summary */}
            <div className="p-5 border-b border-gray-100 dark:border-[#2a2040]">
              <h2 className="font-semibold text-gray-900 dark:text-[#e0d4f0] mb-3">Order Summary</h2>
              <div className="space-y-2 text-sm text-gray-500 dark:text-[#9b82b0]">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate max-w-[160px]">{item.name} × {item.quantity}</span>
                    <span className="text-gray-700 dark:text-[#c0aad8] font-medium">Rs {item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100 dark:border-[#2a2040]">
                <span className="font-semibold text-gray-900 dark:text-[#e0d4f0]">Total</span>
                <span className="text-lg font-bold text-yarn">Rs {totalPrice}</span>
              </div>
            </div>

            {/* Customer details */}
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 dark:text-[#e0d4f0] mb-4">Your Details</h2>

              {isLoggedIn ? (
                <div className="space-y-4">
                  {/* Read-only account info */}
                  <div className="rounded-xl bg-cream/60 dark:bg-[#1e1a30] border border-gray-100 dark:border-[#2a2040] px-3.5 py-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-[#9b82b0] uppercase tracking-wide mb-1.5">
                      Ordering as
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#e0d4f0]">
                      {accountName || "—"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-[#7a6490] mt-0.5">
                      {accountEmail || "—"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-[#9b82b0] uppercase tracking-wide">
                      WhatsApp Number
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setPhone(digitsOnly);
                      }}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 dark:border-[#3a3050] bg-white dark:bg-[#1e1a30] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#e0d4f0] placeholder-gray-300 dark:placeholder-[#4a3868] focus:outline-none focus:ring-2 focus:ring-yarn/40 focus:border-yarn transition"
                      placeholder="10-digit number"
                      inputMode="numeric"
                      maxLength={10}
                    />
                    <p className="mt-1.5 text-[11px] text-gray-400 dark:text-[#6a5878]">
                      Used only for this order, not saved to your account.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-cream/60 dark:bg-[#1e1a30] border border-gray-100 dark:border-[#2a2040] px-3.5 py-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-[#c0aad8]">
                    Log in to check out — we'll fill in your name and email automatically.
                  </p>
                  <button
                    type="button"
                    onClick={handleOrderNow}
                    className="mt-3 text-sm font-semibold text-yarn hover:underline"
                  >
                    Log in
                  </button>
                </div>
              )}

              {error && (
                <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-dashed border-yarn/20 dark:border-[#3d2f5a] text-center">
  <p className="text-yarn/70 dark:text-[#c0aad8] text-sm mb-1 select-none">
    𑣲⋆ ₍^. .^₎⟆ .☘︎ ݁˖
  </p>
  <p className="text-[12px] text-text/70 dark:text-[#a78dbd]">
    IGDTUW students: your order is handed over on campus only, with no shipping charges.
  </p>
</div>

              <button
                type="button"
                onClick={handleOrderNow}
                disabled={(isLoggedIn && !isFormValid) || placingOrder}
                className="mt-5 w-full bg-yarn text-white py-3 rounded-xl text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {placingOrder && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {placingOrder ? loadingMessage : "Order on WhatsApp →"}
              </button>

              {isLoggedIn && (
                <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-[#7a6490]">
                  {checkoutSavedAt ? `Saved ✓ ${formatSavedTime(checkoutSavedAt)}` : "Autosave active"}
                </p>
              )}

              <p className="mt-3 text-center text-xs text-gray-300">
                You'll be redirected to WhatsApp to confirm
              </p>

              {isLoggedIn && (
                <p className="mt-1 text-center text-[11px] text-text/55 dark:text-[#9b82b0]">
                  Policy confirmation is required before each order.
                </p>
              )}
            </div>
          </aside>

        </div>
      </div>

      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closePolicyModal} />

          <div className="relative w-full max-w-md rounded-2xl border border-yarn/20 bg-[#FFFDF7] dark:bg-[#16122a] dark:border-[#3d2f5a] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-text dark:text-[#e0d4f0] mb-2">
              Before continuing, please confirm:
            </h3>
            <p className="text-xs text-text/60 dark:text-[#a78dbd] mb-4">
              Order rules and policy are available in Home / Announcements (tap "The Silly Stitch").
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 text-sm text-text dark:text-[#d4c6ea]">
                <input
                  type="checkbox"
                  checked={confirmReadHowTo}
                  onChange={(e) => setConfirmReadHowTo(e.target.checked)}
                  className="mt-0.5 accent-yarn"
                />
                <span>I have read How to Place Your Order</span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-text dark:text-[#d4c6ea]">
                <input
                  type="checkbox"
                  checked={confirmReadPolicy}
                  onChange={(e) => setConfirmReadPolicy(e.target.checked)}
                  className="mt-0.5 accent-yarn"
                />
                <span>I have read Return & Cancellation Policy</span>
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closePolicyModal}
                className="rounded-lg border border-yarn/20 dark:border-[#4a3560] px-3 py-2 text-sm text-text dark:text-[#c0aad8]"
              >
                No
              </button>
              <button
                type="button"
                onClick={handlePolicyConfirmAndOrder}
                disabled={!confirmReadHowTo || !confirmReadPolicy || placingOrder}
                className="rounded-lg bg-yarn dark:bg-[#2a1f3d] text-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Yes, I understand
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}