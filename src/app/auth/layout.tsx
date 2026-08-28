import Header from "@/src/components/Header/Header";
import Footer from "@/src/components/Footer/Footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] text-zinc-900">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-grow items-start justify-center px-4 py-10 sm:px-5 sm:py-14 md:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
