"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mail, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Button, FormField, Input, Spinner, useConfirm } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useAccount, type Account } from "../../../lib/account-context";
import { LogoCropDialog } from "../../../lib/logo-crop-dialog";
import { PHOTO_ACCEPT } from "../../../lib/upload-types";
import { useToast } from "../../../components/toast-host";
import { useSettingsSaved } from "../../../lib/settings-dirty";
import { ChangeEmailDialog } from "../../../components/change-email-dialog";
import { initials } from "../../../lib/initials";
import { AccountCard, AccountPaneHeader } from "./account-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-SET-30, US-AUTH-19 (D-236) — Settings › Your account › Profile: the
 * photo (shown in the sidebar and menu), the name (Save only once it
 * changes) and the sign-in email, changed through `ChangeEmailDialog`.
 */
export function AccountProfilePane() {
  const { account, setAccount } = useAccount();
  const toast = useToast();
  const markSaved = useSettingsSaved();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (account) setName(account.name);
  }, [account?.name]);

  if (!account) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  const changed = name.trim() !== "" && name.trim() !== account.name;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!changed) return;
    setSaving(true);
    setError(null);
    try {
      setAccount(await apiClient.put<Account>("/users/me", { name: name.trim() }));
      markSaved();
      toast("Profile updated.", "Your team sees your new name.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPicked(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (picked) URL.revokeObjectURL(picked);
    setPicked(null);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const uploaded = await apiClient.upload<{ id: string }>("/files", file);
      setAccount(await apiClient.put<Account>("/users/me", { image: `${API_URL}/files/${uploaded.id}` }));
      closeCrop();
      toast("Photo updated.", "It shows in the sidebar and on what you change.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the photo. Try again.");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    const ok = await confirm({ title: "Remove your photo?", description: "Your initials show instead, everywhere your photo was.", confirmLabel: "Remove photo", danger: true });
    if (!ok) return;
    try {
      setAccount(await apiClient.put<Account>("/users/me", { image: null }));
      toast("Photo removed.", "Your initials show instead.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the photo. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-profile">
      <AccountPaneHeader title="Profile" description="How you appear to your team and on what you send. Only you can change these." />
      {error && <p className="text-[13px] text-overdue" role="alert">{error}</p>}
      <AccountCard title="Photo" description="Shown in the sidebar, on records you change and on the team list.">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar size="lg" className="h-16 w-16">
            {account.image && <AvatarImage src={account.image} alt="" />}
            <AvatarFallback className="text-[17px]">{initials(account.name)}</AvatarFallback>
          </Avatar>
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
            {uploading ? <Spinner size="sm" /> : <Camera size={14} aria-hidden />}
            {account.image ? "Change photo" : "Upload photo"}
          </Button>
          {account.image && (
            <Button variant="secondary" size="sm" onClick={() => void removePhoto()}>
              <Trash2 size={14} aria-hidden />
              Remove photo
            </Button>
          )}
        </div>
        <p className="mt-2.5 text-[12.5px] text-on-surface-muted">PNG or JPEG up to 10 MB. You can crop it after choosing.</p>
        <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden" aria-label="Choose a photo" onChange={pick} />
        <LogoCropDialog open={picked !== null} imageSrc={picked} cropShape="round" onCancel={closeCrop} onConfirm={upload} />
      </AccountCard>
      <AccountCard title="Name" description="Your full name, as your team knows you.">
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <FormField label="Name">{(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />}</FormField>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!changed || saving}>
              {saving ? <Spinner size="sm" /> : "Save"}
            </Button>
          </div>
        </form>
      </AccountCard>
      <AccountCard title="Sign-in email" description="Where Spine sends your sign-in links, invites and digests.">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-on-surface" data-testid="account-email">
              {account.email}
            </p>
            <p className="text-[12.5px] text-on-surface-muted">You sign in with this address.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setChangingEmail(true)}>
            <Mail size={14} aria-hidden />
            Change email
          </Button>
        </div>
      </AccountCard>
      <ChangeEmailDialog
        open={changingEmail}
        onOpenChange={setChangingEmail}
        onChanged={(next) => {
          setAccount(next);
          toast(`Your sign-in email is now ${next.email}.`, "We told your old address it changed.");
        }}
      />
      {dialog}
    </div>
  );
}
