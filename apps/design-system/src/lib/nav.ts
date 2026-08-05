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
          { title: "Textarea", href: "/components/textarea" },
          { title: "Select", href: "/components/select" },
          { title: "Combobox", href: "/components/combobox" },
          { title: "DatePicker", href: "/components/date-picker" },
          { title: "Checkbox", href: "/components/checkbox" },
          { title: "RadioGroup", href: "/components/radio-group" },
          { title: "Switch", href: "/components/switch" },
          { title: "FormField", href: "/components/form-field" },
          { title: "MoneyInput", href: "/components/money-input" },
          { title: "Popover", href: "/components/popover" },
          { title: "Tooltip", href: "/components/tooltip" },
          { title: "DropdownMenu", href: "/components/dropdown-menu" },
          { title: "Tabs", href: "/components/tabs" },
        ],
      },
      {
        title: "Feedback & status",
        items: [
          { title: "StatusChip", href: "/components/status-chip" },
          { title: "Badge", href: "/components/badge" },
          { title: "Toast", href: "/components/toast" },
          { title: "EmptyState", href: "/components/empty-state" },
          { title: "Skeleton", href: "/components/skeleton" },
        ],
      },
      {
        title: "Data display",
        items: [
          { title: "Card", href: "/components/card" },
          { title: "StatCard", href: "/components/stat-card" },
          { title: "DataList", href: "/components/data-list" },
          { title: "Table", href: "/components/table" },
          { title: "Avatar", href: "/components/avatar" },
          { title: "Breadcrumb", href: "/components/breadcrumb" },
          { title: "Pagination", href: "/components/pagination" },
        ],
      },
      {
        title: "Overlays",
        items: [
          { title: "Dialog", href: "/components/dialog" },
          { title: "Drawer", href: "/components/drawer" },
        ],
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
