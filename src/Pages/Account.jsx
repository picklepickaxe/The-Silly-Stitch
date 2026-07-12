// src/Pages/Account.jsx
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/Config";

const STATUS_STYLES = {
  pending:     { text: "text-amber-700  dark:text-amber-300",  dot: "bg-amber-400"  },
  accepted:    { text: "text-blue-700   dark:text-blue-300",   dot: "bg-blue-400"   },
  in_progress: { text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-400" },
  completed:   { text: "text-green-700  dark:text-green-300",  dot: "bg-green-400"  },
  cancelled:   { text: "text-red-500    dark:text-red-300",    dot: "bg-red-400"    },
};

function StatusChip({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`capitalize ${s.text}`}>{String(status || "pending").replaceAll("_", " ")}</span>
    </span>
  );
}

function BagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function formatDate(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Account() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!user) return;
      setLoadingOrders(true);
      try {
        const q = query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }
    loadOrders();
  }, [user]);

  const initial = (profile?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <PageContainer variant="tight">
      <div className="max-w-2xl mx-auto pb-16">
        <h1 className="text-4xl font-poiret text-text dark:text-[#e0d4f0] mb-6">
          Account
        </h1>

        {/* ── Profile card ── */}
        <div className="rounded-[32px] border border-yarn/12 dark:border-[#2a2040] bg-[#FFFDF5] dark:bg-[#16122a] shadow-[0_2px_20px_rgba(107,78,113,0.06)] dark:shadow-none p-6 sm:p-7 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-full bg-pinky dark:bg-[#3a1e35] text-[#5a2434] dark:text-[#f0aad0] flex items-center justify-center text-xl font-poiret font-bold ring-4 ring-pinky/25 dark:ring-[#3a1e35]/50">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-text dark:text-[#e0d4f0] truncate">
                {profile?.name || "Welcome back"}
              </p>
              <p className="text-xs text-text/45 dark:text-[#7a6490] truncate">{user?.email}</p>
            </div>
          </div>

          <div className="h-px bg-yarn/10 dark:bg-[#2a2040] my-5" />

          <button
            onClick={logout}
            className="mt-5 text-xs font-medium text-red-500 dark:text-red-400 hover:underline"
          >
            Log out
          </button>
        </div>

        {/* ── Order history card ── */}
        <div className="rounded-[32px] border border-yarn/12 dark:border-[#2a2040] bg-[#FFFDF5] dark:bg-[#16122a] shadow-[0_2px_20px_rgba(107,78,113,0.06)] dark:shadow-none p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-text dark:text-[#e0d4f0] flex items-center gap-2">
              <BagIcon /> Order history
            </h2>
            <span className="text-xs text-text/35 dark:text-[#5a4878]">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loadingOrders ? (
            <div className="flex items-center justify-center py-10 gap-2.5 text-text/38 dark:text-[#4a3868] text-xs">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-yarn/18 dark:border-[#3d2f5a] border-t-yarn dark:border-t-[#c4a8cc] animate-spin" />
              Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl bg-cream/60 dark:bg-[#1e1a30] border border-yarn/10 dark:border-[#2a2040] py-10 text-center">
              <p className="text-sm text-text/45 dark:text-[#7a6490]">No orders yet</p>
              <p className="text-xs text-text/30 dark:text-[#4a3868] mt-1">Your first order will show up here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream/50 dark:bg-[#1e1a30] border border-yarn/10 dark:border-[#2a2040] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text dark:text-[#e0d4f0]">#{order.orderId}</p>
                      <StatusChip status={order.status} />
                    </div>
                    <p className="text-[11px] text-text/40 dark:text-[#5a4878] mt-0.5">
                      {formatDate(order.createdAt)} • {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-yarn dark:text-[#d4b8e0]">Rs {order.total}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}