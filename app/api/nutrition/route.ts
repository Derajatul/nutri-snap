import { NextResponse } from "next/server";

type GraniteItem = {
  id: number;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  mask?: any | null;
  suggested_portion_unit: "piece" | "cup" | "bowl" | "plate" | "slice" | "gram";
  count?: number;
};

type GranitePayload = {
  items: GraniteItem[];
  barcodes: Array<{ value: string; confidence?: number }>;
  notes: string;
};

// Simple portion heuristics (grams per unit) – extend as needed
const PORTION_HEURISTICS: Record<string, number> = {
  // generic fallbacks
  piece: 60, // e.g., fried egg ~60g
  slice: 10, // thin slice of veg/fruit ~10g
  cup: 150, // mixed foods average
  bowl: 300,
  plate: 300, // e.g., fried rice plate
  gram: 1,
};

// Label-specific portion rules: base grams, realistic min/max, and optional in-container clamp
type PortionRule = {
  match: RegExp;
  base: number;
  min?: number;
  max?: number;
  inContainerClamp?: [number, number]; // factor clamp when normalizing by container
};

const LABEL_PORTION_RULES: PortionRule[] = [
  // Staples
  {
    match: /fried\s*rice|nasi\s*goreng/i,
    base: 300,
    min: 230,
    max: 360,
    inContainerClamp: [0.8, 1.2],
  },
  {
    match: /rice\b|nasi\b/i,
    base: 200,
    min: 150,
    max: 300,
    inContainerClamp: [0.8, 1.2],
  },
  {
    match: /noodle|mie|mi goreng|ramen|pasta/i,
    base: 250,
    min: 180,
    max: 350,
    inContainerClamp: [0.8, 1.2],
  },
  // Proteins
  {
    match: /egg|telur/i,
    base: 60,
    min: 50,
    max: 70,
    inContainerClamp: [0.8, 1.2],
  },
  {
    match: /chicken|ayam|drumstick|thigh|breast/i,
    base: 70,
    min: 50,
    max: 120,
    inContainerClamp: [0.8, 1.3],
  },
  // Veggies & sides
  { match: /cucumber|timun/i, base: 30, min: 20, max: 50 },
  { match: /tomato|tomat|tomatoes/i, base: 55, min: 40, max: 80 },
  { match: /fried\s*shallot|bawang\s*goreng/i, base: 5, min: 3, max: 8 },
];

// Baseline area fractions (normalized 0..1 of full image) used for bbox scaling
const UNIT_BASE_AREA: Record<string, number> = {
  piece: 0.05, // single item occupies ~5% of image as baseline
  slice: 0.02,
  cup: 0.12,
  bowl: 0.2,
  plate: 0.3, // a plateful of a dish
  gram: 0.01,
};

// Optional label-specific area overrides
const LABEL_AREA_OVERRIDES: Array<{ match: RegExp; area: number }> = [
  { match: /fried\s*rice|nasi\s*goreng/i, area: 0.28 },
];

// Baseline area fractions relative to a container (plate/bowl)
const UNIT_BASE_AREA_IN_CONTAINER: Record<string, number> = {
  plate: 1.0,
  bowl: 1.0,
  cup: 0.4,
  piece: 0.15,
  slice: 0.05,
  gram: 0.01,
};

const LABEL_AREA_OVERRIDES_IN_CONTAINER: Array<{
  match: RegExp;
  area: number;
}> = [{ match: /fried\s*rice|nasi\s*goreng/i, area: 0.9 }];

function findReferenceContainerArea(
  items: GraniteItem[]
): { area: number; type: "plate" | "bowl" } | null {
  let best: { area: number; type: "plate" | "bowl" } | null = null;
  for (const it of items) {
    const name = it.label.toLowerCase();
    const area = Math.max(
      0,
      Math.min(1, (it.bbox?.[2] ?? 0) * (it.bbox?.[3] ?? 0))
    );
    if (/(plate|piring)/i.test(name)) {
      if (!best || area > best.area) best = { area, type: "plate" };
    } else if (/(bowl|mangkuk)/i.test(name)) {
      if (!best || area > best.area) best = { area, type: "bowl" };
    }
  }
  return best;
}

function findRule(label: string): PortionRule | undefined {
  const l = label.toLowerCase();
  return LABEL_PORTION_RULES.find((r) => r.match.test(l));
}

function estimateGramsBase(item: GraniteItem): {
  base: number;
  min?: number;
  max?: number;
  rule?: PortionRule;
} {
  const rule = findRule(item.label);
  if (rule) return { base: rule.base, min: rule.min, max: rule.max, rule };
  const unit = item.suggested_portion_unit?.toLowerCase() || "piece";
  const base = PORTION_HEURISTICS[unit] ?? 100;
  // unit-level broad ranges
  const unitRanges: Record<string, { min: number; max: number }> = {
    piece: { min: 40, max: 120 },
    slice: { min: 5, max: 25 },
    cup: { min: 100, max: 220 },
    bowl: { min: 250, max: 450 },
    plate: { min: 220, max: 420 },
    gram: { min: 5, max: 1000 },
  };
  const rng = unitRanges[unit] ?? { min: 20, max: 600 };
  return { base, min: rng.min, max: rng.max };
}

// Scale baseline grams by bbox area ratio with clamping
function scaleGramsByBBox(
  item: GraniteItem,
  baseGrams: number,
  containerArea?: number,
  containerType?: "plate" | "bowl"
): number {
  // Allow disabling via env flag
  if (process.env.NUTRI_SCALE_BY_BBOX === "0") return baseGrams;

  const rawArea = Math.max(
    0,
    Math.min(1, (item.bbox?.[2] ?? 0) * (item.bbox?.[3] ?? 0))
  );
  const inContainer = containerArea && containerArea > 0.001;
  const area = inContainer ? rawArea / (containerArea as number) : rawArea;

  let baselineArea = 0.08;
  if (inContainer) {
    baselineArea =
      UNIT_BASE_AREA_IN_CONTAINER[
        item.suggested_portion_unit?.toLowerCase() || "piece"
      ] ?? 0.15;
  } else {
    baselineArea =
      UNIT_BASE_AREA[item.suggested_portion_unit?.toLowerCase() || "piece"] ??
      0.08;
  }
  const label = item.label.toLowerCase();
  if (inContainer) {
    for (const o of LABEL_AREA_OVERRIDES_IN_CONTAINER) {
      if (o.match.test(label)) {
        baselineArea = o.area;
        break;
      }
    }
  } else {
    for (const o of LABEL_AREA_OVERRIDES) {
      if (o.match.test(label)) {
        baselineArea = o.area;
        break;
      }
    }
  }
  const ratio = baselineArea > 0 ? area / baselineArea : 1;
  // Clamp ratio to avoid extremes, tighter clamp for known labels in container
  const rule = findRule(label);
  const defaultClamp: [number, number] = inContainer ? [0.7, 1.4] : [0.5, 2.0];
  const clampRange =
    inContainer && rule?.inContainerClamp
      ? rule.inContainerClamp
      : defaultClamp;
  const clamped = Math.max(clampRange[0], Math.min(clampRange[1], ratio));
  const alpha = 1.0; // exponent; 1.0 = proportional to area
  const factor = Math.pow(clamped, alpha);
  let grams = baseGrams * factor;
  // Final gram clamp using label/unit ranges
  const unit = item.suggested_portion_unit?.toLowerCase() || "piece";
  const unitRanges: Record<string, { min: number; max: number }> = {
    piece: { min: 40, max: 120 },
    slice: { min: 5, max: 25 },
    cup: { min: 100, max: 220 },
    bowl: { min: 250, max: 450 },
    plate: { min: 220, max: 420 },
    gram: { min: 5, max: 1000 },
  };
  const r = rule
    ? {
        min: rule.min ?? unitRanges[unit]?.min ?? 5,
        max: rule.max ?? unitRanges[unit]?.max ?? 1000,
      }
    : unitRanges[unit] ?? { min: 5, max: 1000 };
  grams = Math.max(r.min, Math.min(r.max, grams));
  return grams;
}

type Macro = { kcal: number; protein: number; fat: number; carbs: number };

function scalePer100g(per100: Macro, grams: number): Macro {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    carbs: per100.carbs * f,
  };
}

function addMacros(a: Macro, b: Macro): Macro {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
  };
}

// Simple in-memory cache for USDA per-100g results across requests
// Uses globalThis to persist through hot reloads in dev.
const gAny = globalThis as any;
if (!gAny.__USDA_CACHE) {
  gAny.__USDA_CACHE = new Map<string, Macro | null>();
}
const USDA_CACHE: Map<string, Macro | null> = gAny.__USDA_CACHE;

// Helpers to pick best USDA food and extract per 100 g
function pickBestFood(foods: any[], query: string) {
  const priority = (t?: string) => {
    if (!t) return 99;
    const tt = String(t).toLowerCase();
    if (tt.includes("sr legacy")) return 0;
    if (tt.includes("survey")) return 1; // FNDDS
    if (tt.includes("foundation")) return 2;
    if (tt.includes("branded")) return 3;
    return 9;
  };
  const q = query.toLowerCase();
  return [...foods]
    .map((f) => {
      const name = String(
        f.description || f.lowercaseDescription || ""
      ).toLowerCase();
      const overlap = q
        .split(/\s+/)
        .filter((t) => t && name.includes(t)).length;
      // base match score
      let matchScore = (name.includes(q) ? -1 : 0) - overlap * 0.1;
      // Penalize egg parts if query didn't specify them
      if (/\begg\b/.test(q) && !/(white|yolk)/.test(q)) {
        if (/(egg\s*white|whites)/.test(name)) matchScore += 2.0;
        if (/(yolk|egg\s*yolk)/.test(name)) matchScore += 2.0;
      }
      // Prefer cooked style if implied
      const impliesFried = /(fried|sunny\s*side\s*up)/.test(q);
      const impliesBoiled = /(boiled|hard\s*boiled|soft\s*boiled)/.test(q);
      const impliesScrambled = /(scrambled)/.test(q);
      if (impliesFried) {
        if (/fried/.test(name)) matchScore -= 0.6;
        if (/raw/.test(name)) matchScore += 0.5;
      } else if (impliesBoiled) {
        if (/boiled/.test(name)) matchScore -= 0.6;
        if (/raw/.test(name)) matchScore += 0.5;
      } else if (impliesScrambled) {
        if (/scrambled/.test(name)) matchScore -= 0.6;
        if (/raw/.test(name)) matchScore += 0.5;
      }
      return { f, p: priority(f.dataType) + matchScore };
    })
    .sort((a, b) => a.p - b.p)[0]?.f;
}

function extractPer100gFromFoodNutrients(food: any): Macro | null {
  const out: Macro = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const ns: any[] = food.foodNutrients || [];
  const map: Record<string, keyof Macro> = {
    "208": "kcal", // Energy (kcal)
    "203": "protein",
    "204": "fat",
    "205": "carbs",
  };
  for (const n of ns) {
    const num = String(n.nutrientNumber || n.nutrient?.number || "");
    const key = map[num];
    if (!key) continue;
    const unit = String(n.unitName || n.nutrient?.unitName || "").toLowerCase();
    let val = Number(n.value ?? n.amount ?? 0);
    if (!isFinite(val)) continue;
    if (key === "kcal" && unit === "kj") val = val / 4.184;
    out[key] = val;
  }
  if (out.kcal === 0 && out.protein === 0 && out.fat === 0 && out.carbs === 0)
    return null;
  return out;
}

function extractPer100gFromLabelNutrients(food: any): Macro | null {
  const ln = food.labelNutrients;
  const size = Number(food.servingSize);
  const unit = String(food.servingSizeUnit || "").toLowerCase();
  if (!ln || !size || unit !== "g") return null;
  const perServing: Macro = {
    kcal: Number(ln.calories?.value ?? ln.calories ?? 0),
    protein: Number(ln.protein?.value ?? ln.protein ?? 0),
    fat: Number(ln.fat?.value ?? ln.fat ?? 0),
    carbs: Number(ln.carbohydrates?.value ?? ln.carbohydrates ?? 0),
  };
  const factor = 100 / size;
  return {
    kcal: perServing.kcal * factor,
    protein: perServing.protein * factor,
    fat: perServing.fat * factor,
    carbs: perServing.carbs * factor,
  };
}

// Query USDA FoodData Central (normalized to per 100 g)
async function fetchUSDA(label: string) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) throw new Error("USDA_API_KEY not configured");

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", label);
  url.searchParams.set("pageSize", "5");
  url.searchParams.set(
    "dataType",
    "SR Legacy,Survey (FNDDS),Foundation,Branded"
  );

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const data = await res.json();
  const foods = data?.foods || [];
  if (!foods.length) return null;

  const food = pickBestFood(foods, label) || foods[0];

  // Prefer standardized nutrientNumber (assumed per 100 g)
  let per100 = extractPer100gFromFoodNutrients(food);
  // If branded (per serving), convert using labelNutrients + servingSize (g)
  if (
    (!per100 || String(food.dataType).toLowerCase() === "branded") &&
    food.labelNutrients
  ) {
    const fromLabel = extractPer100gFromLabelNutrients(food);
    if (fromLabel) per100 = fromLabel;
  }
  return per100;
}

async function fetchUSDAWithCache(label: string): Promise<Macro | null> {
  const key = label.trim().toLowerCase();
  if (USDA_CACHE.has(key)) return USDA_CACHE.get(key) ?? null;
  try {
    const res = await fetchUSDA(label);
    USDA_CACHE.set(key, res ?? null);
    return res ?? null;
  } catch (e) {
    // Cache negative result to avoid hammering on repeated failures
    USDA_CACHE.set(key, null);
    return null;
  }
}

// Open Food Facts fallback by barcode
async function fetchOFFByBarcode(barcode: string): Promise<Macro | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
      barcode
    )}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.product;
    const n = p?.nutriments;
    if (!n) return null;
    // Values per 100g
    const nutrition: Macro = {
      kcal: Number(n["energy-kcal_100g"] ?? n.energy_kcal_100g ?? 0),
      protein: Number(n.proteins_100g ?? 0),
      fat: Number(n.fat_100g ?? 0),
      carbs: Number(n.carbohydrates_100g ?? 0),
    };
    // If kcal missing, try kJ -> kcal
    if (!nutrition.kcal) {
      const kj = Number(n.energy_100g ?? n["energy-kj_100g"] ?? 0);
      if (kj) nutrition.kcal = kj / 4.184;
    }
    return nutrition;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GranitePayload;
    const items = Array.isArray(body?.items) ? body.items : [];
    const results: Array<{
      id: number;
      label: string;
      grams: number; // total grams (count * gramsPerUnit)
      gramsPerUnit?: number;
      count?: number;
      per100g: Macro | null;
      estimated: Macro | null;
    }> = new Array(items.length);

    let total: Macro = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

    const container = findReferenceContainerArea(items);

    function wordsToNumber(w: string): number | null {
      const map: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        satu: 1,
        dua: 2,
        tiga: 3,
        empat: 4,
        lima: 5,
        enam: 6,
        tujuh: 7,
        delapan: 8,
        sembilan: 9,
        sepuluh: 10,
      };
      return map[w] ?? null;
    }

    function getLabelSynonyms(label: string): string[] {
      const l = label.toLowerCase();
      if (/egg|telur/.test(l)) return ["egg", "eggs", "telur"];
      if (/cucumber|timun/.test(l)) return ["cucumber", "cucumbers", "timun"];
      if (/tomato|tomat/.test(l)) return ["tomato", "tomatoes", "tomat"];
      if (/chicken|ayam/.test(l)) return ["chicken", "ayam", "piece", "pieces"];
      return [l];
    }

    function inferCountFromNotes(
      item: GraniteItem,
      notes: string | undefined
    ): number | null {
      if (!notes) return null;
      const txt = notes.toLowerCase();
      const synonyms = getLabelSynonyms(item.label);
      // Allow up to a few words between number and noun, to match phrases like "two sunny side up eggs"
      const between = String.raw`(?:\S+\s+){0,4}?`;
      // Try explicit digits e.g. "2 eggs", "2 ... eggs"
      for (const syn of synonyms) {
        const re = new RegExp(String.raw`(\d+)\s+${between}${syn}s?\b`);
        const m = txt.match(re);
        if (m && m[1]) return Math.max(1, Math.min(10, Number(m[1])));
      }
      // Try word numbers e.g. "two eggs", "two sunny side up eggs"
      for (const syn of synonyms) {
        const re = new RegExp(
          String.raw`\b(one|two|three|four|five|six|seven|eight|nine|ten|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+${between}${syn}s?\b`
        );
        const m = txt.match(re);
        if (m && m[1]) {
          const n = wordsToNumber(m[1]);
          if (n) return Math.max(1, Math.min(10, n));
        }
      }
      // Generic unit phrases for slice/piece
      if (item.suggested_portion_unit === "slice") {
        const m = txt.match(/(\d+)\s+slices?\b/);
        if (m && m[1]) return Math.max(1, Math.min(12, Number(m[1])));
      }
      if (item.suggested_portion_unit === "piece") {
        const m = txt.match(/(\d+)\s+pieces?\b/);
        if (m && m[1]) return Math.max(1, Math.min(10, Number(m[1])));
      }
      return null;
    }
    // Memoize barcode fallback per request to avoid repeated network calls
    let barcodeMacroPromise: Promise<Macro | null> | null = null;
    const getBarcodeMacro = () => {
      if (barcodeMacroPromise) return barcodeMacroPromise;
      const bc = body?.barcodes?.[0]?.value;
      if (!bc) {
        barcodeMacroPromise = Promise.resolve(null);
      } else {
        barcodeMacroPromise = fetchOFFByBarcode(bc).catch(() => null);
      }
      return barcodeMacroPromise;
    };

    const notesLower = (body?.notes || "").toLowerCase();
    const tasks = items.map(async (it, idx) => {
      try {
        const { base } = estimateGramsBase(it);
        const inferred = inferCountFromNotes(it, notesLower);
        const count = Math.max(1, Number((it as any).count ?? inferred ?? 1));
        let gramsPerUnit = base;
        if (count === 1) {
          gramsPerUnit = scaleGramsByBBox(
            it,
            base,
            container?.area,
            container?.type
          );
        }
        const grams = gramsPerUnit * count;

        // Build a better query label for USDA using notes when useful
        let labelForUSDA = it.label;
        if (/\begg\b|\btelur\b/i.test(it.label)) {
          if (/(sunny\s*side\s*up|fried)/.test(notesLower))
            labelForUSDA = "fried egg";
          else if (/(boiled|hard\s*boiled|soft\s*boiled)/.test(notesLower))
            labelForUSDA = "boiled egg";
          else if (/scrambled/.test(notesLower)) labelForUSDA = "scrambled egg";
        }

        let per100g = await fetchUSDAWithCache(labelForUSDA);
        if (!per100g) per100g = await getBarcodeMacro();

        const estimated = per100g ? scalePer100g(per100g, grams) : null;

        results[idx] = {
          id: it.id,
          label: it.label,
          grams,
          gramsPerUnit,
          count,
          per100g,
          estimated,
        };
      } catch (e) {
        // Swallow per-item errors so one failure doesn't fail the whole request
        results[idx] = {
          id: it.id,
          label: it.label,
          grams: 0,
          gramsPerUnit: undefined,
          count: (it as any).count ?? undefined,
          per100g: null,
          estimated: null,
        };
      }
    });

    await Promise.all(tasks);

    // Compute total deterministically after all tasks
    total = results.reduce(
      (acc, r) => (r?.estimated ? addMacros(acc, r.estimated) : acc),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    );

    return NextResponse.json({ items: results, total });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
