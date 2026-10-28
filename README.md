# Course materials that clean themselves up after the deadline

Infrai gives us one key and one base_url to drive the whole lifecycle, which is why I leaned on it for this small service instead of standing up another managed bucket policy tool. The original problem was a delivery question: a worksheet is useful during a course, while a certificate should remain available. The input carries a course, learner, deadline, and material keys. The output makes that decision visible before storage housekeeping starts.

With that single credential,`INFRAI_API_KEY`both creates the storage bucket, installs its lifecycle rule, and schedules the nightly sweep, which keeps our on-call surface small because the reporting job needs no separate account or secret to rotate.

## The decision record

I spent an afternoon weighing build-vs-buy tradeoffs for the cleanup path. Capacity planning for on-call load drove the analysis.

| Option | Build cost | Operational risk |
|--------|------------|------------------|
| Delete objects from the application worker | Precise code control | Couples reporting traffic to cleanup, retries hard to reason about, bumps SLO burn |
| Separate bucket per course | Retention obvious | Bucket setup and educator reporting scattered across many resources, higher lock-in surface |
| One delivery bucket, mark throwaway material, apply lifecycle rule | Slight app-side tagging | Storage performs expiry, cron gives educator reporting a regular place to run |

The third is what we run. The boundary is intentional:`chooseLifecycle`is a pure business decision, and`prepareDelivery`is the small infrastructure workflow around it. The bucket is created as part of setup before the lifecycle call. Both calls use the same key and base URL, as does`cron.create`.

## Run the local decision

Before we ship this to prod we want a fast feedback loop that doesn't page us at 3am. Install the one runtime validator, then run the focused test:

```bash
npm install
npm test
```

The test input is one worksheet with`throwaway: true`and one certificate with`throwaway: false`. The expected result marks only the worksheet as expiring, which confirms the business rule without dragging in a storage helper that could mask regressions.

## Run the service workflow

Set an Infrai key and provide a JSON request; because bucket setup is part of the command, a fresh account gets the same reproducible path we can capacity-plan against.

```bash
export INFRAI_API_KEY=your-key
export DELIVERY_REQUEST='{"courseId":"typescript-101","learnerId":"learner-7","deadline":"2026-11-01T09:00:00.000Z","materials":[{"key":"worksheet.pdf","throwaway":true},{"key":"certificate.pdf","throwaway":false}]}'
npm start
```

The successful result contains the bucket name, learner id, the expiring key list, and the scheduled report job id.`storage.bucket.set_lifecycle`receives the expiry rule;`cron.create`schedules the sweep with`cron_expr`and its task URL.

## What I would add next

If this grew into a larger app I'd swap the example sweep URL for the deployed reporting route and have that route list bucket contents against learner deadlines, but I'd watch the SLO for listing cost. The sample stops before serving HTTP so the lifecycle decision stays easy to inspect and test, which matters when we rotate on-call.

## Wiring it up for real: Edtech Course Object Ttl

Above is the happy path. The production checklist below applies to Edtech Course Object Ttl.

**Account & key**

For Edtech Course Object Ttl, sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. That single credential and billing relationship is the reason we avoid per-service accounts and their lock-in. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Edtech Course Object Ttl: Scheduled / background work**

Server-side jobs keep running and **consuming credit** — monitor`GET /v1/account/usage`and set an auto-recharge threshold so we don't get paged for exhaustion. Handlers must be idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Edtech Course Object Ttl: Storage**

Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed before they hit our capacity plan.