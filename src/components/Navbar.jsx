import { Link } from "react-router-dom";
import { useState } from "react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItems } = useCart();
  const { darkMode, toggleDark } = useTheme();
  const { isLoggedIn, profile, user, openAuthModal } = useAuth();

  return (
    <nav className="fixed top-4 left-0 right-0 z-50">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl bg-[#FAF6E8] dark:bg-[#16122a] shadow-md px-4 sm:px-8 py-3 sm:py-4 transition-colors duration-300">

          {/* Top Row */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-[#e0d4f0]">
              <Link to="/" className="hover:bg-[#6b4e71] hover:text-[#ffffff] hover:rounded-full transition-all duration-500 relative group">
                The
                <span className="font-poiret text-xl sm:text-3xl font-semibold text-gray-900 dark:text-[#e0d4f0]"> Silly </span>
                Stitch
              </Link>
            </h1>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-[#b0a0c8]">

              {/* Cart icon — comes first */}
              <Link to="/cart" className="relative group flex items-center">
                <div className="relative">
                  {/* Cart SVG */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-gray-600 dark:text-[#b0a0c8] group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z"
                    />
                  </svg>

                  {/* Heart inside cart on hover */}
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none -mt-1">
                    ♡
                  </span>

                  {/* Item count badge */}
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-yarn text-white text-[10px] leading-[18px] text-center">
                      {totalItems > 9 ? "9+" : totalItems}
                    </span>
                  )}
                </div>

                {/* Underline slide — same as other links */}
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-gray-900 dark:bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </Link>

              <Link to="/shop" className="hover:text-gray-900 dark:hover:text-white transition-all duration-200 relative group">
                Shop
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-gray-900 dark:bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                <span className="absolute -right-3 -bottom-[6px] text-xs text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  ♡
                </span>
              </Link>

              <Link to="/contact" className="hover:text-gray-900 dark:hover:text-white transition-all duration-200 relative group">
                Contact
                <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-gray-900 dark:bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                <span className="absolute -right-3 -bottom-[6px] text-xs text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  ♡
                </span>
              </Link>

              <button
                onClick={toggleDark}
                className="w-7 h-7 rounded-full flex items-center justify-center
                  bg-yarn/12     dark:bg-[#2a1f3d]
                  text-yarn      dark:text-[#c4a8cc]
                  hover:bg-yarn/22 dark:hover:bg-[#3a2e50] transition"
                title="Toggle dark mode"
              >
                {darkMode ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1"  x2="12" y2="3"  /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22"  x2="5.64"  y2="5.64"  /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1"    y1="12"    x2="3"      y2="12"    /><line x1="21"    y1="12"    x2="23"    y2="12"    />
                    <line x1="4.22" y1="19.78" x2="5.64"  y2="18.36" /><line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {isLoggedIn ? (
                <Link
                  to="/account"
                  className="w-7 h-7 rounded-full bg-yarn/15 dark:bg-[#2a1f3d] flex items-center justify-center text-yarn dark:text-[#c4a8cc] font-semibold text-xs hover:bg-yarn/25 transition"
                  title="Your account"
                >
                  {(profile?.name || user?.email || "?").charAt(0).toUpperCase()}
                </Link>
              ) : (
                <button
                  onClick={() => openAuthModal({ mode: "signup" })}
                  className="px-4 py-1.5 rounded-full bg-yarn dark:bg-[#2a1f3d] text-white text-xs font-semibold tracking-wide hover:bg-yarn/90 dark:hover:bg-[#3a2e50] active:scale-[0.98] transition-all"
                >
                  Sign Up
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setOpen(!open)}
              className="sm:hidden text-gray-700 dark:text-[#b0a0c8] focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile dropdown */}
          {open && (
            <div className="sm:hidden mt-4 flex flex-col gap-3 border-t border-gray-200 dark:border-[#2a2040] pt-4 text-sm font-medium text-gray-700 dark:text-[#b0a0c8]">
              <Link
                to="/cart"
                onClick={() => setOpen(false)}
                className="hover:text-gray-900 flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z"
                  />
                </svg>
                Cart
                {totalItems > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-yarn text-white text-[10px] leading-[18px] text-center">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Link>
              <Link to="/shop" onClick={() => setOpen(false)} className="hover:text-gray-900 dark:hover:text-white">
                Shop
              </Link>
              <Link to="/contact" onClick={() => setOpen(false)} className="hover:text-gray-900 dark:hover:text-white">
                Contact
              </Link>

              {isLoggedIn ? (
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="w-fit px-4 py-2 rounded-full bg-yarn dark:bg-[#2a1f3d] text-white text-xs font-semibold tracking-wide hover:bg-yarn/90 dark:hover:bg-[#3a2e50] active:scale-[0.98] transition-all"
                >
                  Account
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    openAuthModal({ mode: "signup" });
                  }}
                  className="w-fit px-4 py-2 rounded-full bg-yarn dark:bg-[#2a1f3d] text-white text-xs font-semibold tracking-wide hover:bg-yarn/90 dark:hover:bg-[#3a2e50] active:scale-[0.98] transition-all"
                >
                  Sign Up
                </button>
              )}

              <button
                onClick={toggleDark}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-[#b0a0c8] hover:text-gray-900 dark:hover:text-white transition"
              >
                {darkMode ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {darkMode ? "Light mode" : "Dark mode"}
              </button>
            </div>
          )}

        </div>
      </div>
    </nav>
  );
}