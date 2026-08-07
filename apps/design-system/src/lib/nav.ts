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
        items: [
          { title: "Box", href: "/layouts/box" },
          { title: "Flex", href: "/layouts/flex" },
          { title: "Grid", href: "/layouts/grid" },
          { title: "Container", href: "/layouts/container" },
          { title: "Section", href: "/layouts/section" },
        ],
      },
      {
        title: "Application shell",
        items: [{ title: "AppShell", href: "/components/app-shell" }],
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
          { title: "ButtonGroup", href: "/components/button-group" },
          { title: "Input", href: "/components/input" },
          { title: "InputGroup", href: "/components/input-group" },
          { title: "Textarea", href: "/components/textarea" },
          { title: "Select", href: "/components/select" },
          { title: "MultiSelect", href: "/components/multi-select" },
          { title: "NativeSelect", href: "/components/native-select" },
          { title: "Combobox", href: "/components/combobox" },
          { title: "Command", href: "/components/command" },
          { title: "DatePicker", href: "/components/date-picker" },
          { title: "Checkbox", href: "/components/checkbox" },
          { title: "RadioGroup", href: "/components/radio-group" },
          { title: "Switch", href: "/components/switch" },
          { title: "Slider", href: "/components/slider" },
          { title: "Toggle", href: "/components/toggle" },
          { title: "ToggleGroup", href: "/components/toggle-group" },
          { title: "Label", href: "/components/label" },
          { title: "FormField", href: "/components/form-field" },
          { title: "Field", href: "/components/field" },
          { title: "Form", href: "/components/form" },
          { title: "MoneyInput", href: "/components/money-input" },
          { title: "OTPField", href: "/components/otp-field" },
          { title: "PasswordToggleField", href: "/components/password-toggle-field" },
          { title: "Popover", href: "/components/popover" },
          { title: "Tooltip", href: "/components/tooltip" },
          { title: "HoverCard", href: "/components/hover-card" },
          { title: "DropdownMenu", href: "/components/dropdown-menu" },
          { title: "ContextMenu", href: "/components/context-menu" },
          { title: "Menubar", href: "/components/menubar" },
          { title: "NavigationMenu", href: "/components/navigation-menu" },
          { title: "Toolbar", href: "/components/toolbar" },
          { title: "Tabs", href: "/components/tabs" },
          { title: "Accordion", href: "/components/accordion" },
          { title: "Collapsible", href: "/components/collapsible" },
          { title: "Separator", href: "/components/separator" },
          { title: "ScrollArea", href: "/components/scroll-area" },
          { title: "AspectRatio", href: "/components/aspect-ratio" },
          { title: "Kbd", href: "/components/kbd" },
          { title: "Typography", href: "/components/typography" },
        ],
      },
      {
        title: "Feedback & status",
        items: [
          { title: "StatusChip", href: "/components/status-chip" },
          { title: "Badge", href: "/components/badge" },
          { title: "Alert", href: "/components/alert" },
          { title: "Toast", href: "/components/toast" },
          { title: "Progress", href: "/components/progress" },
          { title: "Stepper", href: "/components/stepper" },
          { title: "Spinner", href: "/components/spinner" },
          { title: "PageLoader", href: "/components/page-loader" },
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
          { title: "DataTable", href: "/components/data-table" },
          { title: "Calendar", href: "/components/calendar" },
          { title: "Chart", href: "/components/chart" },
          { title: "Carousel", href: "/components/carousel" },
          { title: "Avatar", href: "/components/avatar" },
          { title: "Breadcrumb", href: "/components/breadcrumb" },
          { title: "Pagination", href: "/components/pagination" },
          { title: "PaginationBar", href: "/components/pagination-bar" },
          { title: "Sidebar", href: "/components/sidebar" },
          { title: "Resizable", href: "/components/resizable" },
        ],
      },
      {
        title: "Overlays",
        items: [
          { title: "Dialog", href: "/components/dialog" },
          { title: "AlertDialog", href: "/components/alert-dialog" },
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
        items: [{ title: "Admin dashboard", href: "/templates" }],
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
