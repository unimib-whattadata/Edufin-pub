export default function MessageLoading() {
  return (
    <div
      className="flex min-h-[20px] items-end justify-center"
      role="status"
      aria-label="AIDA sta scrivendo"
    >
      <div className="flex items-center space-x-1">
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-gray-600 dark:bg-gray-300"
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-gray-600 dark:bg-gray-300"
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className="h-2 w-2 animate-pulse rounded-full bg-gray-600 dark:bg-gray-300"
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
    </div>
  );
}
