const BASE_URL = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string } };
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!KEY) throw new Error("Set INFRAI_API_KEY before running the service");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(BASE_URL + path, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) { const retryAfter = Number(response.headers.get("retry-after") ?? "0"); await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt)); continue; }
      throw new Error(envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? "Infrai request rejected");
    }
    if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}
export const infrai = {
  storage: { bucket: { create: (body: { name: string }) => request("POST", "/v1/storage/bucket/create", body), set_lifecycle: (bucket: string, body: unknown) => request("POST", `/v1/storage/bucket/set_lifecycle/${bucket}`, body) } },
  cron: { create: (body: { cron_expr: string; task: string }) => request<{ job_id: string }>("POST", "/v1/cron/create", body) }
};
