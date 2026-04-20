import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/Config";
import PageContainer from "../components/PageContainer";
import { Typewriter } from "react-simple-typewriter";
import ReactMarkdown from "react-markdown";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function Home() {
  const [selected, setSelected] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsError, setAnnouncementsError] = useState(null);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const snap = await getDocs(collection(db, "announcements"));
        const docs = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setAnnouncements(docs);
        setAnnouncementsError(null);
      } catch (err) {
        console.error("Error fetching announcements:", err);
        setAnnouncementsError("Could not load announcements right now.");
      }
    }
    fetchAnnouncements();
  }, []);

  return (
    <PageContainer>
      {/* 1. Container changed to flex-row on larger screens */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12 px-6 lg:px-20 lg:min-h-[70vh] -mt-11">
        
        {/* 2. Text Content Wrapper (The red box area) */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-4 max-w-xl">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl text-yarn dark:text-[#d4b8e0] leading-tight font-anton">
            Handmade with Love ♡♡♡
          </h1>

        <div className="min-h-[3.2em] sm:min-h-[3.6em] max-w-md flex items-center">
          <div className="text-lg sm:text-xl text-text dark:text-[#c0aad8] max-w-md font-medium">
            <span>
              Cute & affordable crochet pieces made just for{" "}
            </span>

            <span className="text-[#6b4e71] italic font-semibold">
              <Typewriter
                words={[
                  "you.",
                  "your pet.",
                  "your partner.",
                  "your parents.",
                  "your siblings.",
                  "you and your loved ones <3",
                ]}
                loop={1}
                cursor={false}
                typeSpeed={70}
                deleteSpeed={50}
                delaySpeed={800}
              />
            </span>
          </div>
        </div>

          <Link
            to="/shop"
            className="mt-4 inline-block bg-yarn dark:bg-[#2a1f3d] text-white px-10 py-4 rounded-full
                       text-lg hover:scale-105 transition shadow-lg font-raleway text-center
                       hover:bg-white hover:text-yarn dark:hover:bg-[#3a2e50] dark:border dark:border-[#4a3560]"
          >
            Shop Now
          </Link>
        </div>

        {/* 3. Animation/GIF Slot (The star area) */}
          <div className="w-full flex justify-center lg:justify-end">
            <img
              src="/animations/crochet.webp"
              alt="Crochet Animation"
              className="
                w-[260px]
                sm:w-[320px]
                md:w-[380px]
                lg:w-[520px]
                xl:w-[600px]
                lg:scale-110
                xl:scale-120
                lg:-translate-x-3
                xl:-translate-x-5
                h-auto
                object-contain
              "
            />
          </div>

      </div>
      <div className="mt-12 px-6 lg:px-20 max-w-6xl mx-auto 
  bg-[url('/animations/background.jpg')] bg-cover bg-center bg-no-repeat 
  rounded-2xl p-6 sm:p-8">

  <h2 className="text-3xl mb-6 font-raleway text-black dark:text-black">
    Announcements
  </h2>

  {announcementsError && (
    <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {announcementsError}
    </p>
  )}

  {!announcementsError && announcements.length === 0 && (
    <p className="mb-4 text-sm text-text/65 dark:text-[#b9a8ce]">
      No announcements yet.
    </p>
  )}

  {/* Cards */}
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {announcements.map((item) => (
      <div
        key={item.id}
        onClick={() => setSelected(item)}
        className="
          cursor-pointer rounded-xl p-5
          bg-white/70 dark:bg-[#1e1a30]/70
          backdrop-blur-md
          border border-white/40 dark:border-[#3d2f5a]
          shadow-sm hover:shadow-md
          hover:scale-[1.02]
          transition
        "
      >
        <p className="text-xs text-text/60 mb-2">{item.date}</p>

        <h3 className="text-lg font-semibold text-yarn dark:text-[#d4b8e0] mb-2">
          {item.title}
        </h3>

        <p className="text-sm text-text/80 dark:text-[#c0aad8]">
          {item.short}
        </p>
      </div>
    ))}
  </div>

  {/* Modal */}
  {selected && (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={() => setSelected(null)}
    >
      <div
        className="bg-[#FFFDF7] dark:bg-[#16122a] rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-text/50 mb-2">{selected.date}</p>

        <h3 className="text-xl font-semibold text-yarn dark:text-[#d4b8e0] mb-3">
          {selected.title}
        </h3>

        <div className="w-full mx-auto overflow-y-auto max-h-[70vh] prose prose-sm max-w-none break-words leading-relaxed whitespace-pre-wrap text-sm text-text dark:text-[#c0aad8] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:mb-2">
          <ReactMarkdown>
            {selected.full}
          </ReactMarkdown>
        </div>

        <button
          onClick={() => setSelected(null)}
          className="mt-5 w-full bg-yarn text-white py-2 rounded-lg hover:opacity-90 transition"
        >
          Close
        </button>
      </div>
    </div>
  )}
</div>
    </PageContainer>
  );
}