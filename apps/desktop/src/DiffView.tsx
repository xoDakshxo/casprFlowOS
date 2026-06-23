import { useMemo } from "react";

interface DiffViewProps {
  readonly stat: string;
  readonly patch: string;
}

type DiffLineKind = "file" | "hunk" | "add" | "del" | "meta" | "context";

interface DiffLine {
  readonly key: number;
  readonly kind: DiffLineKind;
  readonly text: string;
}

const classify = (line: string): DiffLineKind => {
  if (line.startsWith("diff --git") || line.startsWith("+++") || line.startsWith("---")) {
    return "file";
  }
  if (line.startsWith("@@")) {
    return "hunk";
  }
  if (line.startsWith("+")) {
    return "add";
  }
  if (line.startsWith("-")) {
    return "del";
  }
  if (line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted")) {
    return "meta";
  }
  return "context";
};

export const DiffView = ({ stat, patch }: DiffViewProps) => {
  const lines = useMemo<readonly DiffLine[]>(() => {
    if (!patch.trim()) {
      return [];
    }
    return patch.split("\n").map((text, index) => ({
      key: index,
      kind: classify(text),
      text,
    }));
  }, [patch]);

  if (lines.length === 0) {
    return <p className="muted-copy">Working tree clean — no unstaged changes.</p>;
  }

  return (
    <div className="diff-view">
      {stat.trim() ? <pre className="diff-stat">{stat.trim()}</pre> : null}
      <div className="diff-body" role="table" aria-label="Unstaged diff">
        {lines.map((line) => (
          <div key={line.key} className={`diff-line diff-${line.kind}`}>
            <span className="diff-gutter" aria-hidden="true">
              {line.kind === "add" ? "+" : line.kind === "del" ? "-" : ""}
            </span>
            <code>{line.text || " "}</code>
          </div>
        ))}
      </div>
    </div>
  );
};
