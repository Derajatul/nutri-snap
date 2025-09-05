"use client";

import React from "react";
import { ImageUploader } from "@/components/image-uploader";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Sanitize messy JSON-like text from model into valid JSON string
function sanitizeGraniteJson(rawInput: unknown): {
  cleaned: string;
  parsed?: any;
} {
  // Coerce to string
  let raw = typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput);

  // Strip code fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // Keep only the substring between the first '{' and the last '}'
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    raw = raw.slice(start, end + 1);
  }

  // Char-level pass: remove all whitespace outside strings,
  // replace newlines/tabs inside strings with a single space.
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escaped) {
        result += c;
        escaped = false;
      } else if (c === "\\") {
        result += c;
        escaped = true;
      } else if (c === '"') {
        result += c;
        inString = false;
      } else if (c === "\n" || c === "\r" || c === "\t") {
        // normalize to a single space inside strings
        if (result[result.length - 1] !== " ") result += " ";
      } else {
        result += c;
      }
    } else {
      if (c === '"') {
        result += c;
        inString = true;
        escaped = false;
      } else if (c === "\n" || c === "\r" || c === "\t" || c === " ") {
        // drop whitespace outside strings
      } else {
        result += c;
      }
    }
  }

  // Remove trailing commas (commas followed by closing } or ])
  result = result.replace(/,(\s*[}\]])/g, "$1");

  // Remove spaces accidentally introduced into KEYS only: "some key": -> "somekey":
  result = result.replace(/"((?:[^"\\]|\\.)*)"(?=:)/g, (_m, key) => {
    const fixed = String(key).replace(/\s+/g, "");
    return `"${fixed}"`;
  });

  try {
    const parsed = JSON.parse(result);
    return { cleaned: JSON.stringify(parsed, null, 2), parsed };
  } catch {
    // If parsing fails, return the minified-but-cleaned content for debugging
    return { cleaned: result };
  }
}

function normalizeLabel(value: unknown): unknown {
  if (typeof value !== "string") return value;
  // Collapse repeated whitespace to single spaces and trim
  let s = value.replace(/\s+/g, " ").trim();
  // Heuristic: fix splits inside words, e.g., "ch icken" -> "chicken"
  const tokens = s.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (
      i < tokens.length - 1 &&
      tokens[i].length <= 2 &&
      /^[a-z]+$/.test(tokens[i]) &&
      /^[a-z]+$/.test(tokens[i + 1])
    ) {
      out.push(tokens[i] + tokens[i + 1]);
      i++;
    } else {
      out.push(tokens[i]);
    }
  }
  return out.join(" ");
}

function normalizeGraniteData(obj: any): any {
  try {
    const copy = JSON.parse(JSON.stringify(obj));
    if (Array.isArray(copy?.items)) {
      copy.items = copy.items.map((item: any) => ({
        ...item,
        label: normalizeLabel(item?.label),
      }));
    }
    if (typeof copy?.notes === "string") {
      copy.notes = copy.notes.replace(/\s+/g, " ").trim();
    }
    return copy;
  } catch {
    return obj;
  }
}

export function UploadSection() {
  const [file, setFile] = React.useState<File | null>(null);
  const [prompt, setPrompt] = React.useState<string>(
    `You are a vision-to-JSON system.

Rules:
- Output ONLY one valid JSON object.
- Do not include any explanations, descriptions, or text outside the JSON.
- Keys and values must never contain line breaks, extra spaces, or formatting artifacts.
- Use English labels only.
- If no barcodes are detected, return "barcodes": [].
- "bbox" values [x,y,width,height] must be normalized between 0 and 1 and tightly fit each object.
- "suggested_portion_unit" must be one of: ["piece","cup","bowl","plate","slice","gram"].
- The "notes" field must be a single very short sentence, maximum 10 words.

Schema:
{
  "items": [
    {
      "id": <int>,
      "label": <string>,
      "confidence": <float>,
      "bbox": [<float>,<float>,<float>,<float>],
      "mask": null,
      "suggested_portion_unit": <string>
    }
  ],
  "barcodes": [],
  "notes": <string>
}
`
  );
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function analyze() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      if (!file) {
        setError("Pilih gambar terlebih dahulu");
        return;
      }
      const form = new FormData();
      form.append("image", file);
      form.append("prompt", prompt);
      const res = await fetch("/api/vision", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Gagal menganalisis gambar");
      }
  const data = await res.json();
  // API returns a JSON-encoded string; sanitize, normalize labels, and pretty print
      const { cleaned, parsed } = sanitizeGraniteJson(data);
      if (parsed) {
        const normalized = normalizeGraniteData(parsed);
        setResult(JSON.stringify(normalized, null, 2));
      } else {
        setResult(cleaned);
      }
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <ImageUploader label="Foto Makanan" onChange={setFile} />
        {file ? (
          <p className="mt-3 text-sm text-muted-foreground">
            File dipilih: {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="granite-prompt">Prompt Granite Vision</Label>
        <Textarea
          id="granite-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-40"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={analyze} disabled={loading || !file}>
          {loading ? "Menganalisis..." : "Analisis dengan Granite Vision"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>

      {result ? (
        <pre
          className={cn(
            "overflow-auto rounded-md border p-3 text-sm",
            "bg-secondary/50"
          )}
        >
          {result}
        </pre>
      ) : null}
    </div>
  );
}
