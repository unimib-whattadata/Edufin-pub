"use client";

import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/app/_components/ui/form";
import { Button } from "~/app/_components/ui/button";
import { useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "~/lib/utils";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

interface LoginFormValues {
  email: string;
  password: string;
}

interface LoginDialogProps {
  setLogin: Dispatch<SetStateAction<boolean>>;
}

const PasswordInput = ({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <input
        type={show ? "text" : "password"}
        className={cn(
          "border-aida-border-strong bg-aida-surface text-aida-ink placeholder:text-aida-ink-muted focus:ring-aida-focus w-full rounded-2xl border px-4 py-3 focus:ring-2 focus:outline-none",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="text-aida-ink-muted hover:text-aida-ink absolute top-1/2 right-3 -translate-y-1/2"
      >
        {show ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </button>
    </div>
  );
};

export const LoginDialog = ({ setLogin: _setLogin }: LoginDialogProps) => {
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [globalError, setGlobalError] = useState<string | null>(null);

  const onSubmit = async (_data: LoginFormValues) => {
    setGlobalError(null);

    // TODO: Implementare un sistema di autenticazione alternativo ad Appwrite
    // Per ora, il login è disabilitato
    setGlobalError("Sistema di autenticazione non disponibile");
    form.setError("email", { message: " " });
    form.setError("password", { message: " " });
  };

  return (
    <Dialog open={true}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="border-aida-border bg-aida-surface text-aida-ink sm:max-w-[425px] sm:rounded-2xl sm:shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground mb-5 text-2xl">
            Login
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              rules={{ required: "Email is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-aida-ink">Email</FormLabel>
                  <FormControl>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      {...field}
                      className="border-aida-border-strong bg-aida-surface text-aida-ink placeholder:text-aida-ink-muted focus:ring-aida-focus w-full rounded-2xl border px-4 py-3 focus:ring-2 focus:outline-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              rules={{ required: "Password is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-aida-ink">Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {globalError && (
              <p className="text-sm text-red-500">{globalError}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit">Login</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
