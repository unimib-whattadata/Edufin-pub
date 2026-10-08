"use client";

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import Image from "next/image";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import type { ButtonProps } from "~/app/_components/ui/button";
import { Button } from "~/app/_components/ui/button";
import MessageLoading from "~/app/_components/ui/message-loading";
import { cn } from "~/app/utils/cn";

const TIMESTAMP_LOCALE = "it-IT" as const;

const TIMESTAMP_OPTIONS = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const;

const AVATAR_SIZE = {
  width: "w-16",
  height: "h-16",
} as const;

type ChatVariant = "received" | "sent";

type ChatLayout = "default" | "ai";

interface BaseChatProps {
  variant?: ChatVariant;
  layout?: ChatLayout;
  className?: string;
}

const chatBubbleVariant = cva("relative group", {
  variants: {
    variant: {
      received: "self-start w-full",
      sent: "self-end w-full",
    },
    layout: {
      default: "",
      ai: "max-w-full w-full",
    },
  },
  defaultVariants: {
    variant: "received",
    layout: "default",
  },
});

const chatBubbleMessageVariants = cva(
  "px-3 py-3 text-aida-ink rounded-2xl border border-aida-border-strong shadow-sm sm:px-4",
  {
    variants: {
      variant: {
        received:
          "bg-aida-bubble-assistant rounded-r-2xl rounded-tl-2xl rounded-bl-none",
        sent: "bg-aida-bubble-user rounded-l-2xl rounded-tr-2xl rounded-br-none",
      },
      layout: {
        default: "",
        ai: "border-t w-full rounded-none bg-transparent",
      },
    },
    defaultVariants: {
      variant: "received",
      layout: "default",
    },
  },
);

const formatTimestamp = (timestamp: string): string => {
  try {
    return new Date(timestamp).toLocaleTimeString(
      TIMESTAMP_LOCALE,
      TIMESTAMP_OPTIONS,
    );
  } catch (error) {
    console.log(error);
    console.warn("Invalid timestamp format:", timestamp);
    return "";
  }
};

interface ChatBubbleContentProps extends BaseChatProps {
  children: React.ReactNode;
}

const ChatBubbleContent = React.forwardRef<
  HTMLDivElement,
  ChatBubbleContentProps
>(({ variant, className, children, ...props }, ref) => {
  if (variant === "sent") {
    return (
      <div ref={ref} className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("flex flex-col", className)} {...props}>
      {children}
    </div>
  );
});
ChatBubbleContent.displayName = "ChatBubbleContent";

interface ChatBubbleProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleVariant> {}

const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant, layout, children, ...props }, ref) => {
    const handleChildProps = useCallback(
      (child: React.ReactNode) => {
        if (React.isValidElement(child) && typeof child.type !== "string") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return React.cloneElement(child, {
            variant,
            layout,
          } as React.ComponentProps<typeof child.type>);
        }
        return child;
      },
      [variant, layout],
    );

    return (
      <div
        className={cn(chatBubbleVariant({ variant, layout, className }))}
        ref={ref}
        {...props}
      >
        {variant === "sent" ? (
          <div className="flex w-full justify-end">
            <div className="flex max-w-[60%] flex-col items-end">
              {React.Children.map(children, handleChildProps)}
            </div>
          </div>
        ) : (
          <div className="flex max-w-[60%] gap-2">
            {React.Children.map(children, handleChildProps)}
          </div>
        )}
      </div>
    );
  },
);
ChatBubble.displayName = "ChatBubble";

interface ChatBubbleAvatarProps extends BaseChatProps {
  src?: string;
  fallback?: string;
}

const ChatBubbleAvatar = React.forwardRef<
  HTMLDivElement,
  ChatBubbleAvatarProps
>(({ src, fallback, className }, ref) => (
  <div ref={ref} className={cn("flex items-end", className)}>
    {src ? (
      <Image
        src={src}
        alt="AIDA"
        width={64}
        height={64}
        className={cn("rounded-2xl object-contain")}
      />
    ) : (
      <span
        className={cn(
          AVATAR_SIZE.width,
          AVATAR_SIZE.height,
          "flex items-center justify-center rounded-2xl text-2xl",
        )}
      >
        {fallback}
      </span>
    )}
  </div>
));
ChatBubbleAvatar.displayName = "ChatBubbleAvatar";

interface ChatBubbleMessageProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleMessageVariants> {
  isLoading?: boolean;
}

const ChatBubbleMessage = React.forwardRef<
  HTMLDivElement,
  ChatBubbleMessageProps
>(
  (
    { className, variant, layout, isLoading = false, children, ...props },
    ref,
  ) => (
    <div
      className={cn(
        chatBubbleMessageVariants({ variant, layout, className }),
        "break-words whitespace-pre-wrap",
      )}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <div className="mt-1 flex items-center space-x-2">
          <MessageLoading />
        </div>
      ) : (
        children
      )}
    </div>
  ),
);
ChatBubbleMessage.displayName = "ChatBubbleMessage";

interface ChatBubbleTimestampProps extends React.HTMLAttributes<HTMLDivElement> {
  timestamp: string;
  variant?: ChatVariant;
}

const ChatBubbleTimestamp = React.forwardRef<
  HTMLDivElement,
  ChatBubbleTimestampProps
>(({ timestamp, className, variant, ...props }, ref) => {
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    if (timestamp) {
      setFormattedTime(formatTimestamp(timestamp));
    }
  }, [timestamp]);

  return (
    <div
      ref={ref}
      className={cn(
        "text-aida-ink-muted mt-1 text-xs",
        variant === "sent" && "text-right",
        className,
      )}
      {...props}
    >
      {formattedTime}
    </div>
  );
});
ChatBubbleTimestamp.displayName = "ChatBubbleTimestamp";

interface ChatBubbleActionProps extends ButtonProps {
  icon: React.ReactNode;
}

const ChatBubbleAction = React.forwardRef<
  HTMLButtonElement,
  ChatBubbleActionProps
>(
  (
    { icon, onClick, className, variant = "ghost", size = "icon", ...props },
    ref,
  ) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      {...props}
    >
      {icon}
    </Button>
  ),
);
ChatBubbleAction.displayName = "ChatBubbleAction";

interface ChatBubbleActionWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ChatVariant;
}

const ChatBubbleActionWrapper = React.forwardRef<
  HTMLDivElement,
  ChatBubbleActionWrapperProps
>(({ variant, className, children, ...props }, ref) => {
  const getPositionClasses = useCallback(() => {
    return variant === "sent"
      ? "-left-1 -translate-x-full flex-row-reverse"
      : "-right-1 translate-x-full";
  }, [variant]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
        getPositionClasses(),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
ChatBubbleActionWrapper.displayName = "ChatBubbleActionWrapper";

export {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleActionWrapper,
  ChatBubbleAvatar,
  ChatBubbleContent,
  ChatBubbleMessage,
  chatBubbleMessageVariants,
  ChatBubbleTimestamp,
  chatBubbleVariant,
  type BaseChatProps,
  type ChatLayout,
  type ChatVariant,
};
