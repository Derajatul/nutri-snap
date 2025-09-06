"use client";

import React from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id?: string;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  onChange?: (file: File | null) => void;
  value?: File | null;
};

export function ImageUploader({
  id,
  accept = "image/*",
  maxSizeMB = 5,
  className,
  onChange,
  value,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(value ?? null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Camera feature removed

  React.useEffect(() => {
    if (value !== undefined) setFile(value);
  }, [value]);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      onChange?.(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange?.(file);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Camera logic removed

  function validate(f: File) {
    if (!f.type.startsWith("image/")) {
      return "File harus berupa gambar";
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (f.size > maxBytes) {
      return `Ukuran maksimal ${maxSizeMB}MB`;
    }
    return null;
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(f);
    // Reset the input value so selecting the same file again still fires onChange
    if (inputRef.current) inputRef.current.value = "";
  }

  function clear() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center",
          dragActive
            ? "border-ring bg-accent/50"
            : "border-input hover:bg-accent/40"
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        {preview ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-72 w-auto rounded-md object-contain"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              aria-label="Hapus gambar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-input bg-secondary">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Tarik & lepas atau pilih gambar
              </p>
              <p className="text-xs">PNG, JPG, WEBP hingga {maxSizeMB}MB</p>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Upload className="mr-2 h-4 w-4" /> Pilih file
              </Button>
            </div>
          </div>
        )}

        <Input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          // capture attribute removed with camera feature
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label={"Upload Image"}
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
