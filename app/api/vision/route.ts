import Replicate from "replicate";

export async function POST(request: Request) {
  try {
    const token = process.env.VISION_API_TOKEN;
    if (!token) {
      return new Response("Vision API token not configured", { status: 500 });
    }
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return new Response("No image provided", { status: 400 });
    }
    const prompt = form.get("prompt") || "Describe this image";
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(image.type)) {
      return new Response("Invalid image type", { status: 400 });
    }
    const replicate = new Replicate({ auth: token });
    const uploaded = await replicate.files.create(image);
    const imageUrl = uploaded.urls.get;
    if (!imageUrl || typeof imageUrl !== "string") {
      return new Response("Failed to upload image", { status: 500 });
    }

    const input: Record<string, any> = {
      image: imageUrl,
      prompt,
      max_new_tokens: 256,
      temperature: 0.2,
      top_p: 0.9,
    };

    const out = await replicate.run("ibm-granite/granite-vision-3.3-2b", {
      input,
    });
    const text = Array.isArray(out)
      ? out.join("")
      : typeof out === "string"
      ? out
      : JSON.stringify(out);

    const json = text;
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("/api/replicate/vision error:", error);
    return new Response("Error processing image", { status: 500 });
  }
}
