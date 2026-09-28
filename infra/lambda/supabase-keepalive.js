const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase keepalive configuration is missing.");
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/guideline_desk_keepalive`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Supabase keepalive failed (${response.status}): ${await response.text()}`);
  }

  console.log("Supabase keepalive succeeded", { at: new Date().toISOString() });
  return { statusCode: 200 };
};
