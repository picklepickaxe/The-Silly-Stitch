export default function PageContainer({ children, variant }) {
  if (variant === "tight") {
    return (
      <div className="px-8 min-h-screen bg-cream dark:bg-[#0f0d1a] transition-colors duration-300">
        {children}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-cream dark:bg-[#0f0d1a] px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto py-10">
        {children}
      </div>
    </div>
  );
}
