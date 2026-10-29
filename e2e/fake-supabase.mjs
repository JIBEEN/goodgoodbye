// 테스트 전용 Supabase(PostgREST + Storage) 흉내. SQL 마이그레이션의 규칙을 JS로 그대로 옮겼다.
import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";

let db;
const reset = () => {
  db = {
    letters: [],
    project: { id: randomUUID(), title: "팀장님께 전하는 마음", background_image_path: null, background_upload_state: "empty",
      upload_reserved_at: null, upload_reservation_id: null, layout_seed: randomBytes(8).toString("hex") },
    rate: new Map(),
    objects: new Map(),
    failNextUpload: false,
  };
};
reset();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const pick = (row, select) => {
  if (!select || select === "*") return row;
  const cols = select.split(",").map((c) => c.trim());
  return Object.fromEntries(cols.map((c) => [c, row[c]]));
};
const err = (res, status, code, message, details = "") => send(res, status, { code, message, details, hint: null });

function applyFilters(rows, params) {
  return rows.filter((r) => {
    for (const [k, v] of params) {
      if (["select", "order", "limit"].includes(k)) continue;
      if (v.startsWith("eq.") && String(r[k]) !== v.slice(3)) return false;
    }
    return true;
  });
}
function respondRows(req, res, rows, status = 200) {
  const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (wantsObject) {
    if (rows.length !== 1) return err(res, 406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${rows.length} rows`);
    return send(res, status, rows[0]);
  }
  return send(res, status, rows);
}

const rpc = {
  reserve_background() {
    const p = db.project;
    const expired = p.background_upload_state === "reserved" && Date.now() - p.upload_reserved_at > 120000;
    if (p.background_upload_state === "empty" || expired) {
      p.background_upload_state = "reserved"; p.upload_reserved_at = Date.now(); p.upload_reservation_id = randomUUID();
      return p.upload_reservation_id;
    }
    return null;
  },
  release_background({ p_reservation }) {
    const p = db.project;
    if (p.upload_reservation_id === p_reservation && p.background_upload_state === "reserved") {
      p.background_upload_state = "empty"; p.upload_reserved_at = null; p.upload_reservation_id = null; return true;
    }
    return false;
  },
  complete_background({ p_reservation, p_path }) {
    const p = db.project;
    if (p.upload_reservation_id === p_reservation && p.background_upload_state === "reserved") {
      p.background_upload_state = "completed"; p.background_image_path = p_path; p.upload_reservation_id = null; return true;
    }
    return false;
  },
  rate_limit_hit({ p_key, p_limit, p_window_seconds }) {
    const now = Date.now(); const cur = db.rate.get(p_key);
    if (!cur || now - cur.start > p_window_seconds * 1000) { db.rate.set(p_key, { start: now, count: 1 }); return true; }
    cur.count++; return cur.count <= p_limit;
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  try {
    if (url.pathname === "/__reset") { reset(); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__resetRate") { db.rate.clear(); return send(res, 200, {}); }
    if (url.pathname === "/__state") return send(res, 200, { ...db, rate: [...db.rate], objects: [...db.objects.keys()] });
    if (url.pathname === "/__failNextUpload") { db.failNextUpload = true; return send(res, 200, {}); }
    if (url.pathname === "/__expireReservation") { db.project.upload_reserved_at = Date.now() - 200000; return send(res, 200, {}); }

    const body = raw.length && (req.headers["content-type"] ?? "").includes("json") ? JSON.parse(raw.toString()) : null;
    const select = url.searchParams.get("select");

    const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (rpcMatch) return send(res, 200, rpc[rpcMatch[1]](body ?? {}));

    if (url.pathname === "/rest/v1/letters") {
      if (req.method === "GET") {
        let rows = applyFilters(db.letters, url.searchParams);
        if (url.searchParams.get("order") === "slot_number.asc") rows = [...rows].sort((a, b) => a.slot_number - b.slot_number);
        return respondRows(req, res, rows.map((r) => pick(r, select)));
      }
      if (req.method === "POST") {
        if (db.letters.some((l) => l.slot_number === body.slot_number))
          return err(res, 409, "23505", 'duplicate key value violates unique constraint "letters_slot_number_key"');
        if (body.slot_number < 1 || body.slot_number > 5) return err(res, 400, "23514", "check constraint");
        const now = new Date().toISOString().replace("Z", "123+00:00");
        const row = { id: randomUUID(), created_at: now, updated_at: now, ...body };
        db.letters.push(row);
        return respondRows(req, res, [pick(row, select)], 201);
      }
      if (req.method === "PATCH") {
        const rows = applyFilters(db.letters, url.searchParams);
        rows.forEach((r) => Object.assign(r, body, body.updated_at ? { updated_at: body.updated_at.replace("Z", "123+00:00") } : {}));
        return respondRows(req, res, rows.map((r) => pick(r, select)));
      }
      if (req.method === "DELETE") {
        const rows = applyFilters(db.letters, url.searchParams);
        db.letters = db.letters.filter((l) => !rows.includes(l));
        return respondRows(req, res, rows.map((r) => pick(r, select)));
      }
    }
    if (url.pathname === "/rest/v1/project_settings" && req.method === "GET") {
      return respondRows(req, res, [pick(db.project, select)]);
    }
    const pub = url.pathname.match(/^\/storage\/v1\/object\/public\/backgrounds\/(.+)$/);
    if (pub && req.method === "GET") { const b = db.objects.get(decodeURIComponent(pub[1])); if (!b) return err(res, 404, "NF", "nf"); res.writeHead(200, { "content-type": "image/webp", "access-control-allow-origin": "*" }); return res.end(b); }
    const obj = url.pathname.match(/^\/storage\/v1\/object\/backgrounds\/(.+)$/);
    if (obj && req.method === "POST") {
      if (db.failNextUpload) { db.failNextUpload = false; return send(res, 500, { statusCode: "500", error: "boom", message: "storage down" }); }
      db.objects.set(decodeURIComponent(obj[1]), raw);
      return send(res, 200, { Key: `backgrounds/${obj[1]}`, Id: randomUUID() });
    }
    if (url.pathname === "/storage/v1/object/backgrounds" && req.method === "DELETE") {
      body.prefixes.forEach((p) => db.objects.delete(p)); return send(res, 200, []);
    }
    err(res, 404, "NOPE", `${req.method} ${url.pathname}`);
  } catch (e) { send(res, 500, { message: String(e) }); }
}).listen(54321, () => console.log("fake supabase on 54321"));
