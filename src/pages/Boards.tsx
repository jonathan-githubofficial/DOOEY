import { Link } from "@tanstack/react-router";
import { Masthead } from "@/components/masthead";
import { Panel, Eyebrow } from "@/components/surface";
import { PageDoodle } from "@/features/style";
import { BoardsList } from "@/features/boards";
import { useAuthStore } from "@/stores";

export function Boards() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <>
      <Masthead avatar={<PageDoodle page="boards" />} title="Boards" />
      {isAuthenticated ? <BoardsList /> : <SignedOut />}
    </>
  );
}

function SignedOut() {
  return (
    <Panel className="mt-8 p-8 md:p-10">
      <Eyebrow>boards</Eyebrow>
      <h2 className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        A place to think in pictures.
      </h2>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
        <Link to="/account" className="text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>{" "}
        to make free-form boards — notes, links, photos and doodles, arranged your way.
      </p>
    </Panel>
  );
}
