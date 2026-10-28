import test from "node:test";
import assert from "node:assert/strict";
import { chooseLifecycle } from "./course_delivery.ts";
test("expires only throwaway course material", () => { const result = chooseLifecycle({ courseId: "typescript-101", learnerId: "learner-7", deadline: "2026-11-01T09:00:00.000Z", materials: [{ key: "worksheet.pdf", throwaway: true }, { key: "certificate.pdf", throwaway: false }] }); assert.deepEqual(result, [{ key: "worksheet.pdf", expires: true }, { key: "certificate.pdf", expires: false }]); });
