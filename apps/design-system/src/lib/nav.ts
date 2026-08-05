export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface TopLevelSection {
  slug: string;
  title: string;
  sections: NavSection[];
}

export const nav: TopLevelSection[] = [
  {
    slug: "overview",
    title: "Overview",
    sections: [
      {
        title: "Getting started",
        items: [
          { title: "Introduction", href: "/overview" },
          { title: "Principles", href: "/overview/principles" },
        ],
      },
    ],
  },
  {
    slug: "foundation",
    title: "Foundation",
    sections: [
      {
        title: "Tokens",
        items: [
          { title: "Color", href: "/foundation/color" },
          { title: "Typography", href: "/foundation/typography" },
          { title: "Spacing", href: "/foundation/spacing" },
          { title: "Icons", href: "/foundation/icons" },
          { title: "Motion", href: "/foundation/motion" },
        ],
      },
    ],
  },
  {
    slug: "layouts",
    title: "Layouts",
    sections: [
      {
        title: "Structural primitives",
        items: [{ title: "Box, Flex, Grid", href: "/layouts/primitives" }],
      },
    ],
  },
  {
    slug: "components",
    title: "Components",
    sections: [
      {
        title: "Primitives",
        items: [
          { title: "Button", href: "/components/button" },
          { title: "Input", href: "/components/input" },
        ],
      },
      {
        title: "Feedback & status",
        items: [{ title: "StatusChip", href: "/components/status-chip" }],
      },
      {
        title: "Data display",
        items: [{ title: "Card", href: "/components/card" }],
      },
    ],
  },
  {
    slug: "templates",
    title: "Templates",
    sections: [
      {
        title: "Sample screens",
        items: [{ title: "Coming soon", href: "/templates" }],
      },
    ],
  },
];

export function flatNavItems(): (NavItem & { section: string })[] {
  return nav.flatMap((top) =>
    top.sections.flatMap((section) =>
      section.items.map((item) => ({ ...item, section: top.title })),
    ),
  );
}
