// Single gateway between the browser and JSONBin.
// The master key and admin password live only in Netlify env vars —
// this function is the only thing that ever sees them.

const JSONBIN_BASE = "https://api.jsonbin.io/v3/b";

exports.handler = async (event) => {
  const { JSONBIN_MASTER_KEY, JSONBIN_BIN_ID, ADMIN_PASSWORD } = process.env;

  if (event.httpMethod === "GET") {
    try {
      const res = await fetch(`${JSONBIN_BASE}/${JSONBIN_BIN_ID}/latest`, {
        headers: {
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Bin-Meta": "false"
        }
      });

      if (!res.ok) {
        return jsonResponse(502, { error: "Could not load products." });
      }

      const data = await res.json();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60"
        },
        body: JSON.stringify(data)
      };
    } catch (err) {
      return jsonResponse(502, { error: "Could not load products." });
    }
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (err) {
      return jsonResponse(400, { error: "Invalid request body." });
    }

    const { password, products, action } = payload;

    if (typeof password !== "string" || password !== ADMIN_PASSWORD) {
      return jsonResponse(401, { error: "Wrong password." });
    }
    if (action === "verify") {
      return jsonResponse(200, { ok: true });
    }
    if (!Array.isArray(products)) {
      return jsonResponse(400, { error: "Products must be a list." });
    }

    try {
      const res = await fetch(`${JSONBIN_BASE}/${JSONBIN_BIN_ID}`, {
        method: "PUT",
        headers: {
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ products, updatedAt: new Date().toISOString() })
      });

      if (!res.ok) {
        return jsonResponse(502, { error: "Could not save products." });
      }

      return jsonResponse(200, { ok: true });
    } catch (err) {
      return jsonResponse(502, { error: "Could not save products." });
    }
  }

  return jsonResponse(405, { error: "Method not allowed." });
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
