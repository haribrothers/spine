import type { MDXComponents } from "mdx/types";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ColorSwatchGrid } from "@/components/color-swatch";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Heading({ level, children }: { level: 1 | 2 | 3; children: React.ReactNode }) {
  const id = typeof children === "string" ? slugify(children) : undefined;
  const sizes = {
    1: "mb-4 mt-0 text-[28px] font-bold tracking-tight text-on-surface",
    2: "mb-3 mt-10 text-[20px] font-semibold tracking-tight text-on-surface scroll-mt-20",
    3: "mb-2 mt-8 text-[16px] font-semibold text-on-surface scroll-mt-20",
  } as const;
  const Tag = `h${level}` as const;
  return (
    <Tag id={id} className={sizes[level]}>
      {children}
    </Tag>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <Heading level={1} {...props} />,
    h2: (props) => <Heading level={2} {...props} />,
    h3: (props) => <Heading level={3} {...props} />,
    p: (props) => <p className="my-4 text-[14px] leading-relaxed text-on-surface" {...props} />,
    ul: (props) => <ul className="my-4 list-disc space-y-1 pl-5 text-[14px]" {...props} />,
    li: (props) => <li className="text-on-surface" {...props} />,
    code: (props) => (
      <code
        className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]"
        {...props}
      />
    ),
    a: (props) => <a className="text-primary underline underline-offset-2" {...props} />,
    ComponentPreview,
    CodeBlock,
    ColorSwatchGrid,
    ...components,
  };
}
