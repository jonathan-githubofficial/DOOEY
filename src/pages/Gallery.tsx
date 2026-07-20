// Temporary app root for layer L2 (design system) - the E2E surface for this whole layer,
// tagged @l2 (e2e/gallery.spec.ts). Renders every unit-2.3 primitive plus the color/radius/
// shadow tokens, both font families/weights (unit 2.1), and the paper grain (unit 2.2). Unit
// 2.4 adds an Icons section afterward - do not treat this file as closed. Unit 3.1 replaces
// the app root with the real router/guard and moves this behind a /gallery route.
import { cn } from "@/lib/cn";
import { GrainOverlay } from "@/components/grain-overlay";
import { Backdrop } from "@/features/style/components/Backdrop";
import { Panel, Eyebrow, StampButton, Stamp } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight } from "@/components/icons/lucide";
import { FolderShell } from "@/components/icons/folder-shell";
import { Squiggle } from "@/components/icons/ornaments/squiggle";

const COLOR_TOKENS = ["paper", "surface", "ink", "ink-muted", "rule", "leaf", "zest", "sky", "clay", "honey"];

export function Gallery() {
  return (
    <view className="relative min-h-screen bg-paper p-6">
      <Backdrop />
      <GrainOverlay className="fixed inset-0 -z-10" />

      <text className="font-display font-black text-3xl text-ink" data-testid="gallery-title">
        Gallery
      </text>

      <view className="mt-6 flex flex-col gap-3" data-testid="gallery-tokens">
        {COLOR_TOKENS.map((t) => (
          <view key={t} className="flex items-center gap-3">
            <view className={cn("h-8 w-8 rounded-full border border-rule", `bg-${t}`)} />
            <text className="font-sans text-sm text-ink">{t}</text>
          </view>
        ))}
      </view>

      <view className="mt-6 flex flex-col gap-2" data-testid="gallery-fonts">
        <text className="font-sans font-normal text-base text-ink">Outfit 400 regular</text>
        <text className="font-sans font-medium text-base text-ink">Outfit 500 medium</text>
        <text className="font-sans font-semibold text-base text-ink">Outfit 600 semibold</text>
        <text className="font-sans font-bold text-base text-ink">Outfit 700 bold</text>
        <text className="font-display font-bold text-2xl text-ink">Fraunces 700 bold</text>
        <text className="font-display font-black text-2xl text-ink">Fraunces 900 black</text>
      </view>

      <Panel className="mt-6" data-testid="gallery-panel">
        <Eyebrow>Panel + Eyebrow</Eyebrow>
        <text className="mt-2 font-sans text-base text-ink">Soft-shadow, grained surface.</text>
      </Panel>

      <view className="mt-6 flex flex-wrap items-center gap-3" data-testid="gallery-stamps">
        <StampButton>stamp button</StampButton>
        <StampButton accent>accent</StampButton>
        <Stamp className="border-leaf text-leaf">done</Stamp>
      </view>

      <view className="mt-6 flex flex-wrap gap-3" data-testid="gallery-buttons">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="accent">Accent</Button>
        <Button disabled>Disabled</Button>
      </view>

      <Card className="mt-6" data-testid="gallery-card">
        <CardHeader>
          <CardTitle>Card title</CardTitle>
        </CardHeader>
        <CardContent>
          <text className="font-sans text-sm text-ink">Card content.</text>
        </CardContent>
      </Card>

      <view className="mt-6" data-testid="gallery-input">
        <Input placeholder="Type here" />
      </view>

      <view className="mt-6 flex flex-col gap-3" data-testid="gallery-icons">
        <view className="flex gap-3">
          <Plus className="h-5 w-5 text-ink" />
          <Trash2 className="h-5 w-5 text-clay" />
          <ChevronRight className="h-5 w-5 text-ink-muted" />
        </view>
        <view className="relative h-16 w-16" data-testid="gallery-folder-shell">
          <FolderShell fill="hsl(var(--zest))" />
        </view>
        {/* Squiggle (like FolderShell) only takes fill/className, not arbitrary rest props
            (SPEC step 5 pins that contract) - so the testid goes on a wrapping <view>,
            matching the FolderShell pattern just above rather than a bare pass-through prop. */}
        <view data-testid="gallery-squiggle">
          <Squiggle className="h-2 w-24 text-zest" />
        </view>
      </view>
    </view>
  );
}
