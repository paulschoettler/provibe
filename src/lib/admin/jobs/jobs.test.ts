import { describe, expect, it } from "vitest";
import {
  backoffMinutes,
  runJobLoop,
  secretsMatch,
  type ClaimedJob,
  type JobRunnerDeps,
} from "./core";

function makeDeps(jobs: ClaimedJob[], failKinds: string[] = [], tick = 0) {
  const queue = [...jobs];
  const log: string[] = [];
  let clock = 0;
  const deps: JobRunnerDeps = {
    claim: async (worker) => {
      log.push(`claim:${worker}`);
      return queue.shift() ?? null;
    },
    complete: async (id) => {
      log.push(`complete:${id}`);
    },
    fail: async (id, error) => {
      log.push(`fail:${id}:${error}`);
      const job = jobs.find((j) => j.id === id)!;
      return job.attempts >= job.max_attempts ? "dead" : "queued";
    },
    dispatch: async (job) => {
      clock += tick;
      if (failKinds.includes(job.kind)) throw new Error(`kaputt ${job.kind}`);
    },
    now: () => clock,
  };
  return { deps, log, queue };
}

const job = (id: string, kind: string, attempts = 1, max = 8): ClaimedJob => ({
  id,
  kind,
  payload: {},
  attempts,
  max_attempts: max,
  order_id: null,
});

describe("Job-Runner", () => {
  it("arbeitet fällige Jobs ab und meldet Erfolg", async () => {
    const { deps, log } = makeDeps([job("a", "invoice.create"), job("b", "order.shipping_mail")]);
    const s = await runJobLoop(deps, { worker: "w1", limit: 10, budgetMs: 1000 });
    expect(s).toMatchObject({
      claimed: 2,
      succeeded: 2,
      retried: 0,
      dead: 0,
      stoppedByDeadline: false,
    });
    expect(log).toEqual(["claim:w1", "complete:a", "claim:w1", "complete:b", "claim:w1"]);
  });

  it("plant Retries und markiert erschöpfte Jobs als dead", async () => {
    const { deps } = makeDeps(
      [job("a", "boom", 2, 8), job("b", "boom", 8, 8), job("c", "ok")],
      ["boom"],
    );
    const s = await runJobLoop(deps, { worker: "w", limit: 10, budgetMs: 1000 });
    expect(s).toMatchObject({ claimed: 3, succeeded: 1, retried: 1, dead: 1 });
    expect(s.results.map((r) => r.status)).toEqual(["retry", "dead", "succeeded"]);
    expect(s.results[0].error).toBe("kaputt boom");
  });

  it("hält limit und Zeitbudget ein, ohne weitere Jobs zu sperren", async () => {
    const many = Array.from({ length: 5 }, (_, i) => job(`j${i}`, "ok"));
    const limited = makeDeps(many);
    expect(
      (await runJobLoop(limited.deps, { worker: "w", limit: 2, budgetMs: 1000 })).claimed,
    ).toBe(2);
    expect(limited.queue).toHaveLength(3);

    const slow = makeDeps(many, [], 400);
    const s = await runJobLoop(slow.deps, { worker: "w", limit: 10, budgetMs: 1000 });
    expect(s.claimed).toBe(3);
    expect(s.stoppedByDeadline).toBe(true);
    expect(slow.queue).toHaveLength(2);
  });

  it("rechnet das Backoff als 2^attempts Minuten mit Obergrenze", () => {
    expect(backoffMinutes(1)).toBe(2);
    expect(backoffMinutes(3)).toBe(8);
    expect(backoffMinutes(8)).toBe(256);
    expect(backoffMinutes(20)).toBe(1440);
    expect(backoffMinutes(-1)).toBe(1);
  });

  it("vergleicht das Secret exakt", () => {
    expect(secretsMatch("abcdef1234567890", "abcdef1234567890")).toBe(true);
    expect(secretsMatch("abcdef1234567891", "abcdef1234567890")).toBe(false);
    expect(secretsMatch("abcdef123456789", "abcdef1234567890")).toBe(false);
    expect(secretsMatch("abcdef12345678900", "abcdef1234567890")).toBe(false);
    expect(secretsMatch(null, "abcdef1234567890")).toBe(false);
    expect(secretsMatch("", "abcdef1234567890")).toBe(false);
  });
});
