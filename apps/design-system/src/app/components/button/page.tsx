import { Button } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";

export default function ButtonPage() {
  return (
    <div>
      <h1 id="button" className="mb-4 mt-0 text-[28px] font-bold tracking-tight text-on-surface">
        Button
      </h1>
      <p className="my-4 text-[14px] leading-relaxed text-on-surface">
        Triggers an action. One primary (filled) action per screen — everything else is
        secondary, ghost, or a plain link.
      </p>

      <h2
        id="variants"
        className="mb-3 mt-10 scroll-mt-20 text-[20px] font-semibold tracking-tight text-on-surface"
      >
        Variants
      </h2>
      <ComponentPreview
        code={`<Button variant="primary">Save invoice</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Void invoice</Button>
<Button variant="ghost">Dismiss</Button>`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Save invoice</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Void invoice</Button>
          <Button variant="ghost">Dismiss</Button>
        </div>
      </ComponentPreview>

      <h2
        id="sizes"
        className="mb-3 mt-10 scroll-mt-20 text-[20px] font-semibold tracking-tight text-on-surface"
      >
        Sizes
      </h2>
      <p className="my-4 text-[14px] leading-relaxed text-on-surface">
        <code className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[12.5px]">
          touch
        </code>{" "}
        meets the 44px minimum required for the mobile field-companion app.
      </p>
      <ComponentPreview
        code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="touch">Touch (44px)</Button>`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="touch">Touch (44px)</Button>
        </div>
      </ComponentPreview>

      <h2
        id="disabled"
        className="mb-3 mt-10 scroll-mt-20 text-[20px] font-semibold tracking-tight text-on-surface"
      >
        Disabled
      </h2>
      <p className="my-4 text-[14px] leading-relaxed text-on-surface">
        Disabled buttons use the border color rather than a dimmed fill, so they stay
        unambiguous in bright light.
      </p>
      <ComponentPreview code={`<Button disabled>Save invoice</Button>`}>
        <Button disabled>Save invoice</Button>
      </ComponentPreview>

      <h2
        id="api"
        className="mb-3 mt-10 scroll-mt-20 text-[20px] font-semibold tracking-tight text-on-surface"
      >
        API
      </h2>
      <div className="my-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface-sunken">
            <tr>
              <th className="px-4 py-2 font-medium text-on-surface-muted">Prop</th>
              <th className="px-4 py-2 font-medium text-on-surface-muted">Type</th>
              <th className="px-4 py-2 font-medium text-on-surface-muted">Default</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-4 py-2 font-mono text-[12.5px]">variant</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">
                primary | secondary | danger | ghost
              </td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">primary</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-2 font-mono text-[12.5px]">size</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">
                default | sm | touch | icon
              </td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">default</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-[12.5px]">asChild</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">boolean</td>
              <td className="px-4 py-2 font-mono text-[12.5px] text-on-surface-muted">false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock language="bash" code={`import { Button } from "@spine/ui";`} />
    </div>
  );
}
