// src/Pages/Account.jsx  (new)
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/Config";

export default function Account() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.name || "");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setNameInput(profile?.name || "");
  }, [profile]);

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

  async function saveName() {
    if (!user || !nameInput.trim()) return;
    await updateDoc(doc(db, "users", user.uid), { name: nameInput.trim() });
    await refreshProfile();
    setEditingName(false);
  }

  function copyReferralCode() {
    if (!profile?.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1500);
  }

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#e0d4f0] mb-8">Your Account</h1>

        <div className="bg-white dark:bg-[#16122a] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2a2040] p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-[#e0d4f0] mb-4">Profile</h2>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400 dark:text-[#6a5878]">Name: </span>
              {editingName ? (
                <span className="inline-flex items-center gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-[#3a3050] bg-white dark:bg-[#1e1a30] px-2 py-1 text-sm"
                  />
                  <button onClick={saveName} className="text-yarn text-xs font-medium">Save</button>
                  <button onClick={() => setEditingName(false)} className="text-gray-400 text-xs">Cancel</button>
                </span>
              ) : (
                <span className="text-gray-800 dark:text-[#c0aad8] font-medium">
                  {profile?.name || "—"}{" "}
                  <button onClick={() => setEditingName(true)} className="text-yarn text-xs ml-1 hover:underline">
                    edit
                  </button>
                </span>
              )}
            </div>

            <div>
              <span className="text-gray-400 dark:text-[#6a5878]">Email: </span>
              <span className="text-gray-800 dark:text-[#c0aad8] font-medium">{user?.email}</span>
            </div>

            <div>
              <span className="text-gray-400 dark:text-[#6a5878]">Your referral code: </span>
              <span className="text-gray-800 dark:text-[#c0aad8] font-mono font-semibold">
                {profile?.referralCode || "generating..."}
              </span>
              {profile?.referralCode && (
                <button onClick={copyReferralCode} className="text-yarn text-xs ml-2 hover:underline">
                  {copySuccess ? "copied!" : "copy"}
                </button>
              )}
            </div>

            <div>
              <span className="text-gray-400 dark:text-[#6a5878]">Successful referrals: </span>
              <span className="text-gray-800 dark:text-[#c0aad8] font-medium">{profile?.successfulReferralCount || 0}</span>
            </div>
          </div>

          <button onClick={logout} className="mt-5 text-xs text-red-500 hover:underline">
            Log out
          </button>
        </div>

        <div className="bg-white dark:bg-[#16122a] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2a2040] p-6">
          <h2 className="font-semibold text-gray-900 dark:text-[#e0d4f0] mb-4">Order History</h2>

          {loadingOrders ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-400">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-100 dark:border-[#2a2040] rounded-xl p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-800 dark:text-[#c0aad8]">{order.orderId}</span>
                    <span className="text-yarn font-semibold">Rs {order.total}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span className="capitalize">{order.status}</span>
                    <span>{order.items?.length || 0} items</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}