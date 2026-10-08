import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/lib/utils";

interface MarkdownRendererProps {
  content: string;
  variant?: "default" | "chat";
  className?: string;
}

const AIDA_WELCOME_PREFIX = "Benvenuto!\nSono **Aida**";

function cleanMarkdown(text: string): string {
  if (!text) return "";
  if (text.startsWith("Benvenuto!\nSono **Aida**")) return text;

  return (
    // Normalizza i newline senza trasformare ogni paragrafo in una riga vuota.
    text
      .replace(/\r\n?/g, "\n")
      .replace(/\t+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/gm, "")
      .replace(/^\n+|\n+$/g, "")
      .trim()
  );
}

export function MarkdownRenderer({
  content,
  variant = "default",
  className,
}: MarkdownRendererProps) {
  const cleanedContent = cleanMarkdown(content);
  const isWelcomeMessage = content.startsWith(AIDA_WELCOME_PREFIX);
  const normalizedContent = isWelcomeMessage
    ? cleanedContent
        .replace(/^Benvenuto!\n/, "# Benvenuto!\n\n")
        .replace(
          /\n\nCome posso aiutarti\?\nFammi una domanda\.?$/,
          "\n\n## Come posso aiutarti?\n\nFammi una domanda.",
        )
    : cleanedContent;

  return (
    <div
      className={cn(
        "text-aida-ink max-w-none font-sans text-sm leading-5",
        "[&>ol]:my-2 [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:my-2",
        "[&_li]:m-0 [&_li>p]:m-0",
        variant === "chat" &&
          "text-base leading-[1.6] tracking-[0.005em] dark:leading-[1.7] dark:font-medium dark:tracking-[0.01em] [&>p+p]:mt-3",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-aida-ink mt-0 mb-2 text-lg leading-tight font-bold">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-aida-ink mt-3 mb-1 text-base leading-tight font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-aida-ink mt-3 mb-1 text-sm leading-tight font-semibold first:mt-0">
              {children}
            </h3>
          ),

          p: ({ children }) => <p className="m-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),

          li: ({ children }) => <li className="m-0">{children}</li>,
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-aida-link underline underline-offset-2 transition-all duration-200 hover:underline-offset-4"
            >
              {children}
            </a>
          ),
        }}
      >
        {normalizedContent}
      </Markdown>
    </div>
  );
}
