"use client";

import React from "react";
import { ImageUploader } from "@/components/image-uploader";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Donut } from "@/components/ui/donut";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [loadingPhase, setLoadingPhase] = React.useState<
    "idle" | "vision" | "nutrition"
  >("idle");
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nutrition, setNutrition] = React.useState<any | null>(null);
  const [summary, setSummary] = React.useState<string>("");
  const [advice, setAdvice] = React.useState<string[]>([]);
  const [adjustedGrams, setAdjustedGrams] = React.useState<
    Record<number, number>
  >({});
  const [adjustedCount, setAdjustedCount] = React.useState<
    Record<number, number>
  >({});
  const [adjustedGPU, setAdjustedGPU] = React.useState<Record<number, number>>(
    {}
  );

  function recalcNutrition(
    base: any,
    gramsOverrides: Record<number, number>,
    countOverrides?: Record<number, number>,
    gpuOverrides?: Record<number, number>
  ) {
    try {
      if (!base?.items) return base;
      const items = base.items.map((it: any) => {
        const count = Math.max(
          1,
          Math.round(countOverrides?.[it.id] ?? it.count ?? 1)
        );
        const gramsPerUnit = Math.max(
          0,
          gpuOverrides?.[it.id] ??
            it.gramsPerUnit ??
            Math.max(0, it.grams / Math.max(1, it.count || 1))
        );
        const grams = gramsOverrides[it.id] ?? gramsPerUnit * count;
        if (!it.per100g) return { ...it, grams };
        const f = grams / 100;
        const estimated = {
          kcal: it.per100g.kcal * f,
          protein: it.per100g.protein * f,
          fat: it.per100g.fat * f,
          carbs: it.per100g.carbs * f,
        };
        return { ...it, grams, gramsPerUnit, count, estimated };
      });
      const total = items.reduce(
        (acc: any, cur: any) => ({
          kcal: acc.kcal + (cur.estimated?.kcal || 0),
          protein: acc.protein + (cur.estimated?.protein || 0),
          fat: acc.fat + (cur.estimated?.fat || 0),
          carbs: acc.carbs + (cur.estimated?.carbs || 0),
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 }
      );
      return { ...base, items, total };
    } catch {
      return base;
    }
  }

  async function analyze() {
    try {
      setLoadingPhase("vision");
      setError(null);
      setResult(null);
      setNutrition(null);
      setSummary("");
      setAdvice([]);
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
        const pretty = JSON.stringify(normalized, null, 2);
        setResult(pretty);
        // Trigger nutrition mapping
        try {
          setLoadingPhase("nutrition");
          const nutRes = await fetch("/api/nutrition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(normalized),
          });
          if (nutRes.ok) {
            const nut = await nutRes.json();
            setNutrition(nut);
            setAdjustedGrams({});
            setAdjustedCount({});
            setAdjustedGPU({});
            // End loading for UX as soon as nutrition is ready
            setLoadingPhase("idle");
            // Kick off summary + advice in the background (non-blocking)
            (async () => {
              try {
                const sumRes = await fetch("/api/describe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    items: nut.items,
                    notes: (parsed as any)?.notes ?? "",
                    total: nut.total,
                  }),
                });
                if (sumRes.ok) {
                  const s = await sumRes.json();
                  if (s?.summary && typeof s.summary === "string")
                    setSummary(s.summary);
                  if (Array.isArray(s?.advice)) setAdvice(s.advice);
                }
              } catch {}
            })();
          } else {
            const t = await nutRes.text();
            console.error("nutrition error:", t);
          }
        } catch (e) {
          console.error("nutrition fetch failed", e);
        }
      } else {
        setResult(cleaned);
      }
    } catch (e: any) {
      setError(e?.message || "Terjadi kesalahan");
    } finally {
      // If nutrition already set the phase to idle above, this will be a no-op
      setLoadingPhase("idle");
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

      {false && (
        <div className="space-y-2">
          <Label htmlFor="granite-prompt">Prompt Granite Vision</Label>
          <Textarea
            id="granite-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-40"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={analyze} disabled={loadingPhase !== "idle" || !file}>
          {loadingPhase === "vision"
            ? "Sedang menganalisis gambar..."
            : loadingPhase === "nutrition"
            ? "Sedang menganalisis nutrisi..."
            : "Analisis Gambar & Nutrisi"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>

      {false &&
        (result ? (
          <pre
            className={cn(
              "overflow-auto rounded-md border p-3 text-sm",
              "bg-secondary/50"
            )}
          >
            {result}
          </pre>
        ) : null)}

      {nutrition ? (
        <div className="space-y-4">
          {summary ? (
            <Card>
              <CardHeader>
                <CardTitle>Ringkasan</CardTitle>
                <CardDescription>{summary}</CardDescription>
              </CardHeader>
              {advice?.length ? (
                <CardContent>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {advice.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Ringkasan</CardTitle>
                <CardDescription>
                  <Skeleton as="span" className="h-4 w-3/4 align-middle" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton as="span" className="block h-3 w-5/6" />
                  <Skeleton as="span" className="block h-3 w-2/3" />
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Total Nutrition</CardTitle>
              <CardDescription>Per estimated portions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Calories
                    </div>
                    <div className="text-lg font-semibold">
                      {Math.round(nutrition.total.kcal)} kcal
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <Donut
                    value={nutrition.total.protein}
                    max={150}
                    label="Protein"
                    unit="g"
                    colorClassName="text-blue-600 dark:text-blue-500"
                  />
                </div>
                <div className="flex items-center justify-center">
                  <Donut
                    value={nutrition.total.fat}
                    max={120}
                    label="Fat"
                    unit="g"
                    colorClassName="text-amber-600 dark:text-amber-500"
                  />
                </div>
                <div className="flex items-center justify-center">
                  <Donut
                    value={nutrition.total.carbs}
                    max={300}
                    label="Carbs"
                    unit="g"
                    colorClassName="text-emerald-600 dark:text-emerald-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {nutrition.items?.map((it: any) => (
              <Card key={it.id}>
                <CardHeader>
                  <CardTitle className="text-base">{it.label}</CardTitle>
                  <CardDescription>
                    Estimated portion:{" "}
                    {it.count
                      ? `${it.count} × ${Math.round(
                          it.gramsPerUnit ?? it.grams / it.count
                        )} g`
                      : `${it.grams} g`}{" "}
                    ({Math.round(it.grams)} g total)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <label
                        className="text-muted-foreground"
                        htmlFor={`count-${it.id}`}
                      >
                        Count:
                      </label>
                      <input
                        id={`count-${it.id}`}
                        type="number"
                        min={1}
                        className="h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={adjustedCount[it.id] ?? it.count ?? 1}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value || 1));
                          const next = { ...adjustedCount, [it.id]: v };
                          setAdjustedCount(next);
                          setNutrition((prev: any) =>
                            prev
                              ? recalcNutrition(
                                  prev,
                                  adjustedGrams,
                                  next,
                                  adjustedGPU
                                )
                              : prev
                          );
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className="text-muted-foreground"
                        htmlFor={`gpu-${it.id}`}
                      >
                        g / unit:
                      </label>
                      <input
                        id={`gpu-${it.id}`}
                        type="number"
                        min={0}
                        className="h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={
                          adjustedGPU[it.id] ??
                          it.gramsPerUnit ??
                          Math.round(it.grams / Math.max(1, it.count || 1))
                        }
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          const next = { ...adjustedGPU, [it.id]: v };
                          setAdjustedGPU(next);
                          setNutrition((prev: any) =>
                            prev
                              ? recalcNutrition(
                                  prev,
                                  adjustedGrams,
                                  adjustedCount,
                                  next
                                )
                              : prev
                          );
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className="text-muted-foreground"
                        htmlFor={`grams-${it.id}`}
                      >
                        Total grams:
                      </label>
                      <input
                        id={`grams-${it.id}`}
                        type="number"
                        min={0}
                        className="h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={adjustedGrams[it.id] ?? it.grams}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value || 0));
                          const next = { ...adjustedGrams, [it.id]: v };
                          setAdjustedGrams(next);
                          setNutrition((prev: any) =>
                            prev
                              ? recalcNutrition(
                                  prev,
                                  next,
                                  adjustedCount,
                                  adjustedGPU
                                )
                              : prev
                          );
                        }}
                      />
                    </div>
                  </div>
                  {it.estimated ? (
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">Calories</div>
                        <div className="font-medium">
                          {Math.round(it.estimated.kcal)} kcal
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Protein</div>
                        <div className="font-medium">
                          {it.estimated.protein.toFixed(1)} g
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fat</div>
                        <div className="font-medium">
                          {it.estimated.fat.toFixed(1)} g
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Carbs</div>
                        <div className="font-medium">
                          {it.estimated.carbs.toFixed(1)} g
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No nutrition match found.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : loadingPhase !== "idle" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
              <CardDescription>
                <Skeleton as="span" className="h-4 w-3/4 align-middle" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton as="span" className="block h-3 w-5/6" />
                <Skeleton as="span" className="block h-3 w-2/3" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Nutrition</CardTitle>
              <CardDescription>Per estimated portions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Calories
                    </div>
                    <div className="text-lg font-semibold">
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <Skeleton className="h-24 w-24 rounded-full" />
                </div>
                <div className="flex items-center justify-center">
                  <Skeleton className="h-24 w-24 rounded-full" />
                </div>
                <div className="flex items-center justify-center">
                  <Skeleton className="h-24 w-24 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <Skeleton as="span" className="h-4 w-1/3 align-middle" />
                  </CardTitle>
                  <CardDescription>
                    <Skeleton as="span" className="h-3 w-1/2 align-middle" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <div key={j}>
                        <div className="text-muted-foreground">
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="font-medium">
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
