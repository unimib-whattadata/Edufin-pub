import * as React from "react"

import { cn } from "~/lib/utils"

interface InputProps extends React.ComponentProps<"textarea"> {
  autoResize?: boolean;
}

function Input({ className, autoResize = true, ...props }: InputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    if (textareaRef.current && autoResize) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [autoResize]);

  React.useEffect(() => {
    adjustHeight();
  }, [adjustHeight, props.value]);

  return (
    <textarea
      ref={textareaRef}
      data-slot="input"
      className={cn(
        "file:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-400 selection:bg-blue-200 selection:text-blue-900 bg-transparent border-none text-gray-900 dark:text-gray-100 flex w-full min-w-0 rounded-2xl px-4 py-3 text-base shadow-none transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:ring-0 focus-visible:border-none aria-invalid:ring-0 aria-invalid:border-none resize-none overflow-hidden",
        className
      )}
      rows={1}
      onInput={adjustHeight}
      {...props}
    />
  )
}

export { Input }
