"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  FormField,
  Input,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from "@spine/ui";
import { AlarmClock, Camera, Laptop, Moon, Sun } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { LogoCropDialog } from "../../../lib/logo-crop-dialog";
import { PHOTO_ACCEPT } from "../../../lib/upload-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Profile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  themePreference: "system" | "light" | "dark" | string;
  meetingReminderLeadMinutes: number | null;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

/** "" represents the null/"use org default" state — ToggleGroup values must be strings. */
const REMINDER_LEAD_OPTIONS = [
  { value: "", label: "Org default" },
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "60 min" },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function ProfileView() {
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedImageSrc, setPickedImageSrc] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    apiClient
      .get<Profile>("/users/me")
      .then((p) => {
        setProfile(p);
        setNameDraft(p.name);
        setEmailDraft(p.email);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load profile."));
  }, []);

  useEffect(() => {
    return () => {
      if (pickedImageSrc) URL.revokeObjectURL(pickedImageSrc);
    };
  }, [pickedImageSrc]);

  function flash(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSavingProfile(true);
    try {
      const body: { name?: string; email?: string } = {};
      if (nameDraft.trim() !== profile.name) body.name = nameDraft.trim();
      if (emailDraft.trim() !== profile.email) body.email = emailDraft.trim();
      if (Object.keys(body).length === 0) return;
      const updated = await apiClient.put<Profile>("/users/me", body);
      setProfile(updated);
      flash("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingPassword(true);
    try {
      await apiClient.put("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      flash("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleThemeChange(value: string) {
    setTheme(value);
    if (!profile) return;
    try {
      const updated = await apiClient.put<Profile>("/users/me/preferences", { themePreference: value });
      setProfile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save theme preference.");
    }
  }

  async function handleReminderLeadChange(value: string) {
    if (!profile) return;
    const minutes = value === "" ? null : Number(value);
    try {
      const updated = await apiClient.put<Profile>("/users/me/meeting-reminder-lead-minutes", {
        meetingReminderLeadMinutes: minutes,
      });
      setProfile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save reminder preference.");
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPickedImageSrc(URL.createObjectURL(file));
  }

  function closeCropDialog() {
    if (pickedImageSrc) URL.revokeObjectURL(pickedImageSrc);
    setPickedImageSrc(null);
  }

  async function handleAvatarCropConfirm(croppedFile: File) {
    setUploadingAvatar(true);
    setError(null);
    try {
      const uploaded = await apiClient.upload<{ id: string }>("/files", croppedFile);
      const updated = await apiClient.put<Profile>("/users/me", { image: `${API_URL}/files/${uploaded.id}` });
      setProfile(updated);
      closeCropDialog();
      flash("Avatar updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload avatar.");
      throw err;
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-8">
        {error ? (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Spinner />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-on-surface">Avatar</h2>
        <button
          type="button"
          disabled={uploadingAvatar}
          onClick={() => inputRef.current?.click()}
          aria-label="Upload avatar"
          className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full"
        >
          <Avatar size="lg" className="h-16 w-16">
            {profile.image && <AvatarImage src={profile.image} alt={profile.name} />}
            <AvatarFallback className="text-[17px]">{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploadingAvatar ? <Spinner size="sm" /> : <Camera size={16} className="text-white" />}
          </span>
        </button>
        <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={handleFileSelected} />
        <LogoCropDialog open={pickedImageSrc !== null} imageSrc={pickedImageSrc} cropShape="round" onCancel={closeCropDialog} onConfirm={handleAvatarCropConfirm} />
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Name & email</h2>
        <FormField label="Name">{(field) => <Input {...field} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} required />}</FormField>
        <FormField label="Email">{(field) => <Input {...field} type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} required />}</FormField>
        <div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? <Spinner size="sm" /> : "Save"}
          </Button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <h2 className="text-[15px] font-semibold text-on-surface">Change password</h2>
        <FormField label="Current password">
          {(field) => <Input {...field} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />}
        </FormField>
        <FormField label="New password">
          {(field) => <Input {...field} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />}
        </FormField>
        <div>
          <Button type="submit" disabled={savingPassword || !currentPassword || newPassword.length < 8}>
            {savingPassword ? <Spinner size="sm" /> : "Change password"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-on-surface">Theme</h2>
        <ToggleGroup type="single" value={profile.themePreference} onValueChange={(v) => v && handleThemeChange(v)} className="w-fit rounded-sm bg-surface-sunken p-0.5">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} className="h-8 gap-1.5 px-3">
              <Icon size={14} />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-on-surface">Meeting reminders</h2>
        <p className="text-[13px] text-on-surface-muted">
          How long before a meeting you&apos;re attending starts should we remind you? Overrides your org&apos;s default.
        </p>
        <ToggleGroup
          type="single"
          value={profile.meetingReminderLeadMinutes === null ? "" : String(profile.meetingReminderLeadMinutes)}
          onValueChange={(v) => v !== undefined && handleReminderLeadChange(v)}
          className="w-fit flex-wrap rounded-sm bg-surface-sunken p-0.5"
        >
          {REMINDER_LEAD_OPTIONS.map(({ value, label }) => (
            <ToggleGroupItem key={value || "org-default"} value={value} aria-label={label} className="h-8 gap-1.5 px-3">
              {value === "" && <AlarmClock size={14} />}
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
