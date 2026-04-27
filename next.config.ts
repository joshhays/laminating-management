import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/print-scheduler",
        destination: "/schedule/digital-print",
        permanent: true,
      },
      {
        source: "/print-scheduler/:path*",
        destination: "/schedule/digital-print/:path*",
        permanent: true,
      },
      { source: "/companies", destination: "/crm/accounts", permanent: false },
      { source: "/companies/:id", destination: "/crm/accounts/:id", permanent: false },
    ];
  },
  serverExternalPackages: ["pdf-parse"],
  transpilePackages: [
    "@fullcalendar/react",
    "@fullcalendar/core",
    "@fullcalendar/scrollgrid",
    "@fullcalendar/resource-timegrid",
    "@fullcalendar/interaction",
  ],
  // Production only: avoids Next picking a parent lockfile as the tracing root (e.g. repo under $HOME).
  // Setting this in dev has been linked to stale/mismatched webpack chunks (e.g. missing ./611.js).
  ...(process.env.NODE_ENV === "production"
    ? { outputFileTracingRoot: path.join(__dirname) }
    : {}),
};

export default nextConfig;
