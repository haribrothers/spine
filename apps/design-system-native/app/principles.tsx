import { DocScreen } from "../src/components/doc-section";
import { DocTitle, DocLead, DocSection } from "../src/components/doc-page";

export function PrinciplesScreen() {
  return (
    <DocScreen>
      <DocTitle>Principles</DocTitle>
      <DocLead>
        Rules every component and screen in Spine&apos;s native apps follows, not just suggestions. Where a
        component&apos;s own doc page repeats one of these, it&apos;s because that component is where the rule is
        actually enforced.
      </DocLead>

      <DocSection title="One primary action per screen">
        <DocLead>
          The primary (filled) Button variant is reserved for the single most important action on a screen —
          everything else is secondary, ghost, or a plain link. A screen with two primary buttons is a bug, not a
          design choice: it forces the user to guess which action actually matters.
        </DocLead>
      </DocSection>

      <DocSection title="Financial status is a reserved palette">
        <DocLead>
          Paid, due-soon, overdue, and draft each have exactly one meaning across the entire product. They are never
          repurposed for a generic badge, count, or tag — that&apos;s what Badge is for.
        </DocLead>
        <DocLead>
          Color is never the sole carrier of that meaning either — status always renders with a text label alongside
          its color, so it reads correctly for colorblind users.
        </DocLead>
      </DocSection>

      <DocSection title="Every token is overridable">
        <DocLead>
          A self-hoster reskins Spine by overriding the theme tokens in each app&apos;s tailwind.config.js — never by
          editing component source. No component hardcodes a hex color or a spacing value; everything traces back to
          a token shared with @spine/ui on web.
        </DocLead>
      </DocSection>

      <DocSection title="44×44pt touch targets">
        <DocLead>
          Every interactive control meets the 44×44pt minimum touch target, since field users on apps/mobile are
          frequently one-handed or wearing gloves on a job site. This isn&apos;t a special mobile-only footnote here
          the way it is on web — it&apos;s the default everywhere in this library. Button&apos;s default size already
          meets it; most other interactive components (Checkbox, RadioGroup, Switch) meet it via padding even at
          their default visual size.
        </DocLead>
      </DocSection>

      <DocSection title="Borders and tonal steps, not shadows, for structure">
        <DocLead>
          Depth is conveyed through borders and a single tonal step (surface vs. background), not drop shadows — a
          Card is a bordered surface, not a floating shadowed box. Shadows are reserved for genuinely temporary,
          layered UI, like the FloatingTabBar&apos;s own elevation.
        </DocLead>
      </DocSection>

      <DocSection title="Never a blank screen with no next action">
        <DocLead>
          Every zero-results list and first-run screen shows an icon, a message, and a primary action rather than a
          bare blank area — an owner should never open a screen and see nothing with no indication of what to do
          next.
        </DocLead>
      </DocSection>

      <DocSection title="Motion confirms, it doesn't decorate">
        <DocLead>
          Motion in Spine exists to confirm a state changed — a tab switching, a sheet opening, the FloatingTabBar
          highlight sliding to the newly selected tab — never to delight or draw attention to itself.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
