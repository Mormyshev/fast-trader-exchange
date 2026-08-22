import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";

export default function TosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <Header />
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 py-8 sm:py-10 md:py-14">
        {children}
      </main>
      <Footer />
    </div>
  );
}
