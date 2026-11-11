export function PageLoading({
  title = 'Loading',
  home = false,
}: {
  title?: string;
  home?: boolean;
}) {
  return (
    <div
      className={home ? 'home-stage' : 'page-grid page-grid-narrow'}
      aria-busy="true"
      aria-label={`Loading ${home ? 'your lesson' : title.toLowerCase()}`}
    >
      <div className={home ? 'home-column space-y-6' : 'space-y-6'}>
        <span role="status" className="sr-only">
          Loading {home ? 'your lesson' : title.toLowerCase()}…
        </span>
        {!home && <h1 className="page-title mt-16">{title}</h1>}
        <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
          {home && <div className="bg-card h-18 rounded-[28px]" />}
          <div className="content-panel panel-padding min-h-80 space-y-6">
            <div className="bg-secondary h-4 w-24 rounded" />
            <div className="bg-secondary h-8 w-3/4 rounded" />
            <div className="bg-secondary h-4 w-full rounded" />
            <div className="bg-secondary h-4 w-2/3 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
