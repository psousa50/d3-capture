"use client";

export function MarkdownRenderer({
  content,
  placeholder,
}: {
  content: string;
  placeholder: string;
}) {
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        {placeholder}
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-sm h-full max-w-none overflow-y-auto p-4">
      <div
        dangerouslySetInnerHTML={{
          __html: markdownToHtml(content),
        }}
      />
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- \[x\] (.+)$/gm, '<li class="list-none"><input type="checkbox" checked disabled /> $1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="list-none"><input type="checkbox" disabled /> $1</li>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hulo])/gm, "")
    .replace(/\n/g, "<br />");
}
