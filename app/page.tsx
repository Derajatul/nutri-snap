import { UploadSection } from "@/components/upload-section";
import { MacroCalculator } from "@/components/macro-calculator";

export default function Home() {
  return (
  <main className="mx-auto w-full max-w-3xl lg:max-w-5xl p-6 space-y-6">
      <div>
        <h1 className="mb-3 text-2xl font-semibold">Kalkulator Harian</h1>
        <MacroCalculator />
      </div>
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Upload Gambar</h2>
        <UploadSection />
      </div>
    </main>
  );
}
