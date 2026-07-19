import { Masthead } from "@/components/masthead";
import { StyleStudio } from "@/features/style";

export function Style() {
  return (
    <>
      <Masthead title="Style studio" />
      <div className="mt-8">
        <StyleStudio />
      </div>
    </>
  );
}
