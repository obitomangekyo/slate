import { defineHandler } from "nitro";

export default defineHandler(() =>
  Response.json(
    {
      status: "ok",
      service: "slate-web",
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    { headers: { "cache-control": "no-store" } },
  ),
);
