import { cn } from "@/lib/utils";

export function Loader({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn("qubrix-loader", size === "sm" && "qubrix-loader-sm", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

