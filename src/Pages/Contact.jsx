import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";

const CONTACT_DRAFT_KEY = "silly-stitch-contact-draft";

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

export default function Contact() {
  const email = "thesillystitch27@gmail.com";
  const [contactDraft] = useState(() => readFromStorage(CONTACT_DRAFT_KEY, {}));
  const [name, setName] = useState(contactDraft.name || "");
  const [phone, setPhone] = useState(contactDraft.phone || "");
  const [message, setMessage] = useState(contactDraft.message || "");
  const [lastSavedAt, setLastSavedAt] = useState(contactDraft.savedAt || null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const timeout = setTimeout(() => {
      const hasValue = name.trim().length > 0 || phone.trim().length > 0 || message.trim().length > 0;

      if (!hasValue) {
        window.localStorage.removeItem(CONTACT_DRAFT_KEY);
        setLastSavedAt(null);
        return;
      }

      const payload = {
        name,
        phone,
        message,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(CONTACT_DRAFT_KEY, JSON.stringify(payload));
      setLastSavedAt(payload.savedAt);
    }, 500);

    return () => clearTimeout(timeout);
  }, [name, phone, message]);

  function handleEmailSubmit(e) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedMessage) return;

    const subject = `Formal Enquiry/Help Request - ${trimmedName}`;
    const body = [
      "This message is for formal communication regarding confusion, enquiry, or help.",
      "",
      `Name: ${trimmedName}`,
      `Phone: ${trimmedPhone || "Not provided"}`,
      "Product name (if relevant):",
      "Color preference (if relevant):",
      "Delivery timeline (if relevant):",
      "",
      "Message:",
      trimmedMessage,
    ].join("\n");

    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(mailtoLink, "_self");

    setTimeout(() => {
      alert("If your email app didn’t open, please make sure Gmail or a mail app is set as default.");
    }, 1500);
  }

  return (
    <PageContainer>
      <div className="max-w-xl mx-auto bg-[#FFFDF7] dark:bg-[#16122a] rounded-2xl shadow-sm px-6 py-8 sm:px-8 sm:py-10">

        {/* ✨ Heading */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-center text-yarn dark:text-[#d4b8e0] mb-2">
          Get in touch
        </h1>

        <div className="w-12 h-[2px] bg-yarn/40 mx-auto mb-5 rounded-full"></div>

        <p className="text-center text-sm sm:text-base text-text dark:text-[#c0aad8] mb-2">
          Questions, queries, or need help with an order?
        </p>

        <p className="text-center text-xs sm:text-sm text-text/60 dark:text-[#a78dbd] mb-6">
          This space is just for support! For placing orders, head over to the shop ✿
        </p>

        {/* Instagram */}
        <a
          href="https://instagram.com/theSilly.Stitch"
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center text-sm sm:text-base font-medium text-yarn dark:text-[#d4b8e0] underline underline-offset-4 hover:opacity-80 transition mb-6"
        >
          ⌁ Send a DM on Instagram (faster replies)
        </a>

        {/* Email section */}
        <p className="text-sm text-text/80 dark:text-[#cbb6dd] mb-2 font-medium">
          Send an email
        </p>

        <p className="text-xs sm:text-sm text-text/60 dark:text-[#a78dbd] mb-4">
          We’ll prefill everything for you, just add your details.
        </p>

        {/* Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <p className="text-xs text-text/55 dark:text-[#9b82b0]">
            {lastSavedAt ? `Saved ✓ ${formatSavedTime(lastSavedAt)}` : "Autosave active"}
          </p>

          <input
            name="name"
            placeholder="Your name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-cream/60 dark:bg-[#1e1a30] px-4 py-3 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878] focus:outline-none focus:ring-1 focus:ring-yarn/40"
          />

          <input
            name="phone"
            placeholder="Phone number (optional)"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg bg-cream/60 dark:bg-[#1e1a30] px-4 py-3 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878] focus:outline-none focus:ring-1 focus:ring-yarn/40"
          />

          <textarea
            name="message"
            placeholder="Your message"
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg bg-cream/60 dark:bg-[#1e1a30] px-4 py-3 text-sm text-text dark:text-[#e0d4f0] placeholder:text-text/40 dark:placeholder:text-[#6a5878] focus:outline-none focus:ring-1 focus:ring-yarn/40"
          />

          <button
            type="submit"
            className="w-full rounded-lg bg-yarn dark:bg-[#2a1f3d] text-white dark:text-[#e0d4f0] px-4 py-3 text-sm font-semibold hover:opacity-90 transition"
          >
            Send Email
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-text/50 dark:text-[#8a729f] mt-6">
          Or email directly at <span className="underline">{email}</span>
        </p>
      </div>
    </PageContainer>
  );
}