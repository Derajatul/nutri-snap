import { UploadSection } from "@/components/upload-section";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Upload Gambar</h1>
      <UploadSection />
    </main>
  );
}
