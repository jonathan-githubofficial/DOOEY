import { Masthead } from "@/components/masthead";
import { PageDoodle } from "@/features/style";
import { LearningSection, ImportButton } from "@/features/learning";

export function Projects() {
  return (
    <>
      {/* The doodle key stays "learning" — it's the stored data key, and
          renaming it would orphan everyone's saved page doodle. */}
      <Masthead avatar={<PageDoodle page="learning" />} title="Projects">
        <ImportButton />
      </Masthead>
      <LearningSection className="mt-8" />
    </>
  );
}
