import Replicate from "replicate";

export async function POST(request: Request) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return new Response("Instruct API token not configured", { status: 500 });
    }

    const payload = await request.json().catch(() => ({}));
    const { items = [], notes = "", total } = payload || {};

    const system = `You are a concise Indonesian assistant for a nutrition app. Always return ONLY valid JSON with the exact schema: { "summary": string, "advice": string[] }.`;
    const user = `Jelaskan secara singkat apa yang pengguna makan berdasarkan output Granite Vision berikut, lalu berikan saran singkat agar lebih sehat dan kebutuhan nutrisi terpenuhi.
Syarat:
- Bahasa Indonesia, nada ramah.
- Mulai dengan frasa: "Kamu makan ...".
- Sebutkan item utama dan jumlah (jika ada count), gabungkan item kecil seperlunya.
- Jika total kalori tersedia, sebutkan dengan frasa "sekitar X kcal" (pembulatan ke puluhan terdekat).
- Jangan menebak hal yang tidak ada di data. Jangan sertakan penjelasan lain.
Saran (advice):
- Berikan 2–4 butir saran praktis, singkat (maks 12 kata per butir).
- Contoh: tambah protein tanpa lemak, tambah sayur, kurangi gorengan/minyak, minum air putih.
- Personalisasi berdasarkan item/total bila masuk akal (tanpa klaim medis).

Data:
items: ${JSON.stringify(items)}
notes: ${JSON.stringify(notes)}
total: ${JSON.stringify(total ?? null)}

Kembalikan hanya JSON dengan schema tepat: {"summary": string, "advice": string[]}.`;

    const replicate = new Replicate({ auth: token });
    const out = await replicate.run("ibm-granite/granite-3.3-8b-instruct", {
      input: {
        prompt: `${system}\n\n${user}`,
        max_new_tokens: 140,
        temperature: 0.1,
        top_p: 0.9,
      },
    });

    const text = Array.isArray(out)
      ? out.join("")
      : typeof out === "string"
      ? out
      : JSON.stringify(out);

    // Try to parse to ensure it's valid JSON with { summary, advice }
    let json: any = null;
    try {
      json = JSON.parse(text);
      if (!json || typeof json.summary !== "string")
        throw new Error("bad shape");
    } catch {
      json = { summary: text?.toString?.() || "", advice: [] };
    }
    if (!Array.isArray(json.advice)) json.advice = [];

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("/api/describe error:", error);
    return new Response(JSON.stringify({ summary: "" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
