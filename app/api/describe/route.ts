import Replicate from "replicate";

export async function POST(request: Request) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return new Response("Vision API token not configured", { status: 500 });
    }
    const body = await request.formData();

    const prompt = "Describe this image";
    const replicate = new Replicate({ auth: token });

    const input: Record<string, any> = {
      prompt,
      max_new_tokens: 256,
      temperature: 0.2,
      top_p: 0.9,
    };

    const out = await replicate.run("ibm-granite/granite-3.3-8b-instruct", {
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
