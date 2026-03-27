"use client";

const DATADOG_EMBED_SRC =
  "https://p.datadoghq.com/sb/embed/6dae21ee-ecac-11f0-b71d-26b9fe90867e-e6312a9eb4203a2926757f280e920d1e";

export default function WebAnalyticsView() {
  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
          Web Analytics
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200/50 bg-gray-50/50">
          <iframe
            src={DATADOG_EMBED_SRC}
            title="Dashboard Name"
            width={800}
            height={800}
            className="max-w-full block mx-auto"
          />
        </div>
      </div>
    </div>
  );
}
