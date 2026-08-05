import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function CarouselPage() {
  return (
    <div>
      <DocTitle>Carousel</DocTitle>
      <DocLead>
        A carousel with motion and swipe built using embla-carousel. Job/site photo galleries —
        a horizontally scrolling set of slides with prev/next controls.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Touch/swipe support on mobile.", "Prev/Next controls automatically disable at the ends.", "Options object passes through to embla-carousel directly."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@spine/ui";

export default () => (
  <Carousel>
    <CarouselContent>
      <CarouselItem />
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "options", type: "embla-carousel-react's UseEmblaCarouselType options" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Carousel className="w-72">
  <CarouselContent>
    {photos.map((photo) => (
      <CarouselItem key={photo.id}>
        <img src={photo.url} className="aspect-video rounded-md object-cover" />
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`}
        >
          <Carousel className="w-72">
            <CarouselContent>
              {["Site photo 1", "Site photo 2", "Site photo 3"].map((label) => (
                <CarouselItem key={label}>
                  <div className="flex aspect-video items-center justify-center rounded-md bg-surface-sunken text-[13px] text-on-surface-muted">
                    {label}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the previous/next controls." },
            { keys: "Enter", description: "Activates the focused control." },
          ]}
        />
      </DocSection>
    </div>
  );
}
