import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./Pages/Home.jsx";
import Shop from "./Pages/Shop.jsx";
import Contact from "./Pages/Contact.jsx";
import CartPage from "./Pages/CartPage.jsx";
import Admin from "./Pages/Admin.jsx";
import AdminLogin from "./Pages/AdminLogin.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin27");

  return (
    <>
      {isAdminPage ? (
        // Admin pages: no Navbar, no cream wrapper
        <Routes>
          <Route path="/admin27" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/admin27-login" element={<AdminLogin />} />
        </Routes>
      ) : (
        // Public pages: Navbar + cream background
        <div className="bg-cream dark:bg-[#0f0d1a] min-h-screen overflow-x-hidden transition-colors duration-300">
          <Navbar />
          <div className="pt-24 sm:pt-28">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </div>
        </div>
      )}
    </>
  );
}