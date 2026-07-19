import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for the skill's prose files (PLAN.md, TESTS.md, …).
 * Supports headings, bullet/numbered lists, blockquotes, tables' raw rows, bold,
 * and inline code — enough to read the documents without pulling in a md library.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="space-y-3">{renderBlocks(source)}</div>;
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.split(/\r?\n/);
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    out.push(
      list.ordered ? (
        <ol key={out.length} className="ml-5 list-decimal space-y-1 text-ink-muted marker:text-ink-muted">
          {items.map((t, i) => (
            <li key={i} className="pl-1 text-[15px] leading-relaxed">{inline(t)}</li>
          ))}
        </ol>
      ) : (
        <ul key={out.length} className="ml-4 space-y-1">
          {items.map((t, i) => (
            <li key={i} className="relative pl-4 text-[15px] leading-relaxed text-ink-muted before:absolute before:left-0 before:text-leaf before:content-['—']">
              {inline(t)}
            </li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level <= 2) {
        out.push(
          <h4 key={out.length} className="pt-1 font-display text-xl font-semibold tracking-tight text-ink">
            {inline(text)}
          </h4>,
        );
      } else {
        out.push(
          <h5 key={out.length} className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            {inline(text)}
          </h5>,
        );
      }
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    if (line.startsWith(">")) {
      flushList();
      out.push(
        <blockquote key={out.length} className="border-l-2 border-zest pl-4 text-[15px] italic text-ink-muted">
          {inline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      continue;
    }

    flushList();
    out.push(
      <p key={out.length} className="text-[15px] leading-relaxed text-ink-muted">
        {inline(line)}
      </p>,
    );
  }
  flushList();
  return out;
}

/** Inline: **bold**, `code`, and bare links left as text. */
function inline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[13px] text-ink">
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{tok}</Fragment>;
  });
}
