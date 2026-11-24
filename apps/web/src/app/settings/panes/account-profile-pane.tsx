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
import { useT } from "../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-SET-30, US-AUTH-19 (D-236) — Settings › Your account › Profile: the
 * photo (shown in the sidebar and menu), the name (Save only once it
 * changes) and the sign-in email, changed through `ChangeEmailDialog`.
 */
export function AccountProfilePane() {
  const t = useT();
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
      toast(t("settings.profile.updated"), t("settings.profile.updatedDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profile.nameError"));
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
      toast(t("settings.profile.photoUpdated"), t("settings.profile.photoUpdatedDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profile.uploadError"));
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    const ok = await confirm({ title: t("settings.profile.removeConfirm.title"), description: t("settings.profile.removeConfirm.description"), confirmLabel: t("settings.profile.removePhoto"), danger: true });
    if (!ok) return;
    try {
      setAccount(await apiClient.put<Account>("/users/me", { image: null }));
      toast(t("settings.profile.photoRemoved"), t("settings.profile.photoRemovedDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profile.removeError"));
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-profile">
      <AccountPaneHeader title={t("settings.profile.title")} description={t("settings.profile.description")} />
      {error && <p className="text-[13px] text-overdue" role="alert">{error}</p>}
      <AccountCard title={t("settings.profile.photoTitle")} description={t("settings.profile.photoDescription")}>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar size="lg" className="h-16 w-16">
            {account.image && <AvatarImage src={account.image} alt="" />}
            <AvatarFallback className="text-[17px]">{initials(account.name)}</AvatarFallback>
          </Avatar>
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
            {uploading ? <Spinner size="sm" /> : <Camera size={14} aria-hidden />}
            {account.image ? t("settings.profile.changePhoto") : t("settings.profile.uploadPhoto")}
          </Button>
          {account.image && (
            <Button variant="secondary" size="sm" onClick={() => void removePhoto()}>
              <Trash2 size={14} aria-hidden />
              {t("settings.profile.removePhoto")}
            </Button>
          )}
        </div>
        <p className="mt-2.5 text-[12.5px] text-on-surface-muted">{t("settings.profile.photoHint")}</p>
        <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden" aria-label={t("settings.profile.choosePhoto")} onChange={pick} />
        <LogoCropDialog open={picked !== null} imageSrc={picked} cropShape="round" onCancel={closeCrop} onConfirm={upload} />
      </AccountCard>
      <AccountCard title={t("settings.profile.nameTitle")} description={t("settings.profile.nameDescription")}>
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <FormField label={t("settings.profile.nameTitle")}>{(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />}</FormField>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!changed || saving}>
              {saving ? <Spinner size="sm" /> : t("settings.common.save")}
            </Button>
          </div>
        </form>
      </AccountCard>
      <AccountCard title={t("settings.profile.emailTitle")} description={t("settings.profile.emailDescription")}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-on-surface" data-testid="account-email">
              {account.email}
            </p>
            <p className="text-[12.5px] text-on-surface-muted">{t("settings.profile.emailHint")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setChangingEmail(true)}>
            <Mail size={14} aria-hidden />
            {t("settings.profile.changeEmail")}
          </Button>
        </div>
      </AccountCard>
      <ChangeEmailDialog
        open={changingEmail}
        onOpenChange={setChangingEmail}
        onChanged={(next) => {
          setAccount(next);
          toast(t("settings.profile.emailChanged", { email: next.email }), t("settings.profile.emailChangedDescription"));
        }}
      />
      {dialog}
    </div>
  );
}
