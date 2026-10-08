import Image from "next/image";
import { cn } from "~/lib/utils";

interface LogoOfficialProps {
  className?: string;
}

export const LogoOfficial = ({ className }: LogoOfficialProps) => {
  return (
    <Image
      src="/logo-aief-official.png"
      alt="Logo AIEF"
      width={160}
      height={82}
      className={cn("h-auto w-40 object-contain", className)}
      priority={false}
    />
  );
};
