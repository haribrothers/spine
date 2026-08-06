"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage, Spinner } from "@spine/ui";
import { Camera } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type { SpineFile } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * A clickable avatar/logo slot — Phase 1's file-upload endpoint wired into
 * Phase 3's contact detail header. Clicking opens a native file picker,
 * uploads via `POST /files` (multipart), then calls `onUploaded` with the
 * new file's id so the caller can persist it onto `contact.logoFileId` via
 * the existing `PUT /contacts/:id`. `GET /files/:id` 302-redirects to a
 * signed URL — used directly as the `<img src>`, since the browser follows
 * the redirect transparently and the API's own session cookie already
 * authenticates the request (no separate token to thread through).
 */
export function ContactLogo({
  name,
  fileId,
  size = "lg",
  editable,
  onUploaded,
}: {
  name: string;
  fileId: string | null;
  size?: "md" | "lg";
  editable: boolean;
  onUploaded: (file: SpineFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await apiClient.upload<SpineFile>("/files", file);
      onUploaded(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo.");
    } finally {
      setUploading(false);
    }
  }

  const dimension = size === "lg" ? "h-14 w-14" : "h-10 w-10";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!editable || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={editable ? "Upload logo" : undefined}
        className={`group relative ${dimension} shrink-0 overflow-hidden rounded-full ${editable ? "cursor-pointer" : "cursor-default"}`}
      >
        <Avatar size="lg" className={dimension}>
          {fileId && <AvatarImage src={`${API_URL}/files/${fileId}`} alt={name} />}
          <AvatarFallback className="text-[15px]">{initials(name) || "?"}</AvatarFallback>
        </Avatar>
        {editable && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Spinner size="sm" /> : <Camera size={16} className="text-white" />}
          </span>
        )}
      </button>
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      )}
      {error && <span className="text-[11px] text-overdue">{error}</span>}
    </div>
  );
}
