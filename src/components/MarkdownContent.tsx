import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const LINK_CLASS =
  'font-medium text-primary underline underline-offset-2 hover:text-primary/80';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2
      className="mt-10 mb-3 text-2xl font-semibold text-foreground tracking-tight first:mt-0"
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2
      className="mt-10 mb-3 text-xl font-semibold text-foreground tracking-tight first:mt-0"
      style={{ fontFamily: "'Fraunces', serif" }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-base font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 mb-2 text-sm font-semibold text-foreground">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 leading-relaxed text-foreground/90 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-2 pl-5 text-foreground/90 [&_ul]:mt-2 [&_ul]:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 text-foreground/90 [&_ol]:mt-2 [&_ol]:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => {
    // Internal videnscenter (and other in-app) links navigate via the router
    // instead of opening a new tab with a full page reload.
    if (href && href.startsWith('/')) {
      return (
        <Link to={href} className={LINK_CLASS}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[20rem] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60 text-left">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top text-foreground/90">{children}</td>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-medium text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{children}</pre>
  ),
};

/** Strip a leading `# title` line when it repeats the page heading. */
function stripDuplicateMarkdownTitle(body: string, title: string): string {
  const match = body.match(/^#\s+(.+?)(?:\r?\n|$)/);
  if (!match) return body;
  if (match[1].trim().toLowerCase() !== title.trim().toLowerCase()) return body;
  return body.slice(match[0].length).trimStart();
}

interface MarkdownContentProps {
  children: string;
  /** When set, skip a leading `# title` that matches this string. */
  skipTitle?: string;
  className?: string;
}

export function MarkdownContent({ children, skipTitle, className = '' }: MarkdownContentProps) {
  const source = useMemo(
    () => (skipTitle ? stripDuplicateMarkdownTitle(children, skipTitle) : children),
    [children, skipTitle],
  );

  return (
    <div className={`markdown-content text-[15px] ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
