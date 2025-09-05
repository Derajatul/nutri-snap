"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Sex = "male" | "female";
type Activity = "sedentary" | "light" | "moderate" | "active" | "very";

type Profile = {
  weight: number; // kg
  height: number; // cm
  age: number; // years
  sex: Sex;
  activity: Activity;
};

const STORAGE_KEY = "nutriSnap.profile.v1";

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = React.useState<T>(initial);
  const loadedRef = React.useRef(false);
  // Load after mount to avoid SSR/client mismatches
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState((prev) => ({ ...(prev as any), ...JSON.parse(raw) }));
    } catch {}
    loadedRef.current = true;
  }, [key]);
  // Save only after initial load
  React.useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

function bmr({ weight, height, age, sex }: Profile) {
  // Mifflin-St Jeor
  const base =
    10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  return Math.max(500, base);
}

function activityFactor(a: Activity) {
  switch (a) {
    case "sedentary":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "active":
      return 1.725;
    case "very":
      return 1.9;
    default:
      return 1.2;
  }
}

function clampNum(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, isFinite(n) ? n : min));
}

export function MacroCalculator() {
  const [profile, setProfile] = useLocalStorage<Profile>(STORAGE_KEY, {
    weight: 70,
    height: 170,
    age: 25,
    sex: "male",
    activity: "moderate",
  });
  // Input strings to avoid jumpy number behavior when clearing/typing
  const [weightInput, setWeightInput] = React.useState<string>(String(70));
  const [heightInput, setHeightInput] = React.useState<string>(String(170));
  const [ageInput, setAgeInput] = React.useState<string>(String(25));

  // Sync inputs whenever profile changes (e.g., after loading from localStorage)
  React.useEffect(() => {
    setWeightInput(String(profile.weight));
    setHeightInput(String(profile.height));
    setAgeInput(String(profile.age));
  }, [profile.weight, profile.height, profile.age]);

  const commitNumber = (
    kind: "weight" | "height" | "age",
    value: string,
    min: number,
    max: number
  ) => {
    const num = Number(value);
    const next = clampNum(num, min, max);
    if (kind === "weight") {
      setProfile({ ...profile, weight: next });
      setWeightInput(String(next));
    } else if (kind === "height") {
      setProfile({ ...profile, height: next });
      setHeightInput(String(next));
    } else {
      setProfile({ ...profile, age: next });
      setAgeInput(String(next));
    }
  };
  // Simple defaults: protein 1.6 g/kg, fat 30% calories, carbs rest
  const proteinG = clampNum(profile.weight * 1.6, 20, 300);
  const kcal = Math.round(bmr(profile) * activityFactor(profile.activity));
  const fatKcal = Math.round(kcal * 0.3);
  const fatG = Math.max(20, Math.round(fatKcal / 9));
  const proteinKcal = Math.round(proteinG * 4);
  const carbKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  const carbG = Math.max(0, Math.round(carbKcal / 4));

  const update = <K extends keyof Profile>(key: K, val: Profile[K]) =>
    setProfile({ ...profile, [key]: val });

  const reset = () =>
    setProfile({
      weight: 70,
      height: 170,
      age: 25,
      sex: "male",
      activity: "moderate",
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalkulator Kebutuhan Harian</CardTitle>
        <CardDescription>
          Input singkat, hasil disimpan otomatis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div className="col-span-1 sm:col-span-1">
            <Label htmlFor="mc-weight">Berat (kg)</Label>
            <input
              id="mc-weight"
              type="number"
              min={20}
              max={300}
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onBlur={() => commitNumber("weight", weightInput, 20, 300)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  commitNumber("weight", weightInput, 20, 300);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <Label htmlFor="mc-height">Tinggi (cm)</Label>
            <input
              id="mc-height"
              type="number"
              min={100}
              max={230}
              inputMode="numeric"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={() => commitNumber("height", heightInput, 100, 230)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  commitNumber("height", heightInput, 100, 230);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <Label htmlFor="mc-age">Usia</Label>
            <input
              id="mc-age"
              type="number"
              min={10}
              max={100}
              inputMode="numeric"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              onBlur={() => commitNumber("age", ageInput, 10, 100)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNumber("age", ageInput, 10, 100);
              }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          </div>
          <div className="col-span-1 sm:col-span-1">
            <Label htmlFor="mc-sex">Gender</Label>
            <select
              id="mc-sex"
              value={profile.sex}
              onChange={(e) => update("sex", e.target.value as Sex)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <Label htmlFor="mc-activity">Aktivitas</Label>
            <select
              id="mc-activity"
              value={profile.activity}
              onChange={(e) => update("activity", e.target.value as Activity)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="sedentary">Sedentari (kantoran)</option>
              <option value="light">Ringan (1-3x/minggu)</option>
              <option value="moderate">Sedang (3-5x/minggu)</option>
              <option value="active">Aktif (6-7x/minggu)</option>
              <option value="very">Sangat aktif (2x/hari)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">Kalori</div>
            <div className="font-medium">{kcal} kcal/hari</div>
          </div>
          <div>
            <div className="text-muted-foreground">Protein</div>
            <div className="font-medium">{proteinG} g</div>
          </div>
          <div>
            <div className="text-muted-foreground">Lemak</div>
            <div className="font-medium">{fatG} g</div>
          </div>
          <div>
            <div className="text-muted-foreground">Karbo</div>
            <div className="font-medium">{carbG} g</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
