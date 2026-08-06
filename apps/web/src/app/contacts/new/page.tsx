import { AppShellHeader } from "@spine/ui";
import { AppLayout } from "../../../components/app-layout";
import { getSession } from "../../../lib/get-session";
import { NAV_SECTIONS } from "../../../lib/nav-sections";
import { ContactForm } from "../contact-form";

export default async function NewContactPage() {
  const session = await getSession();

  return (
    <AppLayout
      sections={NAV_SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Contacts", href: "/contacts" }, { label: "New" }]}
        title="Add contact"
        description="Name, type and how to reach them — you can add contact persons and addresses after saving."
      />
      <ContactForm />
    </AppLayout>
  );
}
