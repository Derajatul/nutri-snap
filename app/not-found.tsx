import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Custom 404 page (App Router not-found.tsx)
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Halaman Tidak Ditemukan</CardTitle>
          <CardDescription>Kami tidak menemukan halaman yang kamu minta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            URL mungkin salah atau konten sudah dipindahkan.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className="inline-flex">
              <Button variant="default" className="w-full sm:w-auto">
                Kembali ke Beranda
              </Button>
            </Link>
            <Link href="/" className="inline-flex">
              <Button variant="secondary" className="w-full sm:w-auto">
                Analisis Makanan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 text-xs text-muted-foreground">
        404 • Nutri Snap
      </div>
    </main>
  );
}
