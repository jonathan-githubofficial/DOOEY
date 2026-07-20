import { Masthead } from "@/components/masthead";
import { StyleStudio } from "@/features/style";

/** The Style studio space (unit 3.4, ported from src-legacy/pages/Style.tsx). Crib "Elements":
 * the old <> + <div className="mt-8"> wrapper becomes a <view>. */
export function Style() {
  return (
    <view data-testid="page-style">
      <Masthead title="Style studio" />
      <view className="mt-8">
        <StyleStudio />
      </view>
    </view>
  );
}
