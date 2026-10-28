import { z } from "zod";
import { infrai } from "./infrai_client.ts";
export const DeliveryRequest = z.object({ courseId: z.string().min(1), learnerId: z.string().min(1), deadline: z.string().datetime(), materials: z.array(z.object({ key: z.string().min(1), throwaway: z.boolean() })).min(1) });
export type DeliveryRequest = z.infer<typeof DeliveryRequest>;
export function chooseLifecycle(request: DeliveryRequest): { key: string; expires: boolean }[] { return request.materials.map(({ key, throwaway }) => ({ key, expires: throwaway })); }
const BUCKET = "course-delivery";
const SWEEP_TASK = "https://example.invalid/edtech/sweep";
export async function prepareDelivery(input: unknown): Promise<{ bucket: string; learnerId: string; expiringKeys: string[]; reportJobId: string }> {
  const request = DeliveryRequest.parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  const expiringKeys = chooseLifecycle(request).filter((item) => item.expires).map((item) => item.key);
  await infrai.storage.bucket.set_lifecycle(BUCKET, { rules: [{ prefix: "", expire_days: 30 }] });
  const report = await infrai.cron.create({ cron_expr: "0 2 * * *", task: SWEEP_TASK });
  return { bucket: BUCKET, learnerId: request.learnerId, expiringKeys, reportJobId: report.job_id };
}
if (import.meta.url === `file://${process.argv[1]}`) { prepareDelivery(JSON.parse(process.env.DELIVERY_REQUEST ?? "{}")).then((result) => console.log(JSON.stringify(result, null, 2))); }
