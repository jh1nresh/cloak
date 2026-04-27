export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-7 w-7 border-2",
    lg: "h-10 w-10 border-2",
  };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-primary/25 border-t-primary`}
    />
  );
}
