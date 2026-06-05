/** Shown while lazy route chunks load — avoids blank flash between pages */
export default function PageTransitionFallback() {
  return (
    <div
      className="workspace-route workspace-stage--loading"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="workspace-stage__shimmer" />
    </div>
  );
}
