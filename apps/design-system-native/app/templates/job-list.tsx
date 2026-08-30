import { Text, View } from "react-native";
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";

interface JobRow {
  title: string;
  address: string;
  status: string;
}

const JOBS: JobRow[] = [
  { title: "Kitchen renovation", address: "123 Example St · Jane Smith", status: "In progress" },
  { title: "Deck rebuild", address: "48 Harbor Rd · Miguel Torres", status: "Scheduled" },
  { title: "Bathroom retile", address: "9 Willow Ct · Priya Nair", status: "Awaiting materials" },
];

function JobListDemo() {
  return (
    <View className="w-full gap-3">
      {JOBS.map((job) => (
        <Card key={job.title}>
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle>{job.title}</CardTitle>
              <Badge>{job.status}</Badge>
            </View>
            <CardDescription>{job.address}</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
              Tap to view job details, photos, and notes.
            </Text>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" onPress={() => {}}>
              View job
            </Button>
          </CardFooter>
        </Card>
      ))}
    </View>
  );
}

export function JobListScreen() {
  return (
    <DocScreen>
      <DocTitle>Templates</DocTitle>
      <DocLead>
        Full sample screens composed from real @spine/ui-native components, showing how the pieces fit together in an
        actual Spine mobile screen rather than in isolation — the native counterpart to apps/design-system&apos;s
        Admin dashboard template.
      </DocLead>

      <DocSection title="Today's jobs">
        <DocLead>
          The kind of screen apps/mobile&apos;s Home/Jobs tabs actually need — a field user&apos;s assigned jobs for
          the day, each a Card with a status Badge and a secondary action, matching apps/mobile&apos;s own
          home-screen.tsx integration example but with real job-shaped content instead of a single static card.
        </DocLead>
        <ComponentPreview>
          <JobListDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection title="What web's Templates has that this doesn't (yet)">
        <DocLead>
          apps/design-system&apos;s Templates section composes a full admin dashboard (StatCard, Table, StatusChip,
          a collapsible Sidebar shell) and a first-run empty-state screen. None of those components exist in
          @spine/ui-native yet — only Button, TextField, Card, and Badge are built so far (see Components). This
          screen is built from exactly those four; there&apos;s no native StatCard/Table/StatusChip/EmptyState to
          reach for. Worth revisiting once those land — a job Badge standing in for status here is fine (job status
          isn&apos;t financial), but a real StatusChip is still reserved exclusively for invoice/quote/job financial
          status per Overview → Principles, and doesn&apos;t exist on native today either.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
