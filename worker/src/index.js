const USERS = new Set(["hrithik", "madhu", "swaroopa"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Sync-Key",
  "Content-Type": "application/json",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const trackerKey = (user) => `tracker:${user}`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    if (url.pathname !== "/notes") return json({ error: "Not found" }, 404);
    if (!env.SYNC_KEY || request.headers.get("X-Sync-Key") !== env.SYNC_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (request.method === "GET") {
      const user = url.searchParams.get("user");
      if (!USERS.has(user)) return json({ error: "Unknown user" }, 400);
      const tracker = (await env.NOTES.get(trackerKey(user), "json")) || {};
      return json({ user, tracker });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const user = body?.user;
      const tracker = body?.tracker;
      if (!USERS.has(user)) return json({ error: "Unknown user" }, 400);
      if (!tracker || typeof tracker !== "object" || Array.isArray(tracker)) {
        return json({ error: "Invalid tracker" }, 400);
      }
      await env.NOTES.put(trackerKey(user), JSON.stringify(tracker));
      return json({ user, tracker });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
