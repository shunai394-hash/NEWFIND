/**
 * Deterministic check: DISCOVERY → INVESTIGATING → VERIFIED → shouldPost
 * plus comment threading helpers used by the portalized CommentSheet.
 */
import assert from "node:assert/strict";
import { nextInvestigationStatus } from "../lib/ai/investigation-status";
import { parentAuthorUsername, threadComments } from "../lib/comments/thread";

function step(
  label: string,
  input: Parameters<typeof nextInvestigationStatus>[0],
) {
  const result = nextInvestigationStatus(input);
  console.log(
    `${label}: status=${result.status} shouldPost=${result.shouldPost} next=${result.nextAction}`,
  );
  return result;
}

function main() {
  console.log("=== Investigation lifecycle ===");

  const first = step("pass1 POST (first sight)", {
    decision: "POST",
    previous: null,
    evidenceCount: 1,
    scoresTotal: 90,
    qualityOk: true,
  });
  assert.equal(first.status, "DISCOVERY");
  assert.equal(first.shouldPost, false);

  const second = step("pass2 POST (from DISCOVERY)", {
    decision: "POST",
    previous: "DISCOVERY",
    evidenceCount: 2,
    scoresTotal: 75,
    qualityOk: true,
  });
  // evidenceCount>=2 + quality + POST from DISCOVERY → VERIFIED
  assert.equal(second.status, "VERIFIED");
  assert.equal(second.shouldPost, true);

  const viaInvestigate = step("pass1 INVESTIGATE_MORE", {
    decision: "INVESTIGATE_MORE",
    previous: null,
    evidenceCount: 1,
    scoresTotal: 50,
    qualityOk: true,
    qualityReason: "LOW_EVIDENCE",
  });
  assert.equal(viaInvestigate.status, "DISCOVERY");
  assert.equal(viaInvestigate.shouldPost, false);

  const investigating = step("pass2 keep investigating", {
    decision: "INVESTIGATE_MORE",
    previous: "DISCOVERY",
    evidenceCount: 2,
    scoresTotal: 55,
    qualityOk: true,
    qualityReason: "LOW_EVIDENCE",
  });
  assert.equal(investigating.status, "INVESTIGATING");
  assert.equal(investigating.shouldPost, false);

  const verified = step("pass3 POST after INVESTIGATING", {
    decision: "POST",
    previous: "INVESTIGATING",
    evidenceCount: 3,
    scoresTotal: 80,
    qualityOk: true,
  });
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.shouldPost, true);

  console.log("=== Comment threading ===");
  const comments = [
    {
      id: "c1",
      parentCommentId: null as string | null,
      author: { username: "mei" },
      body: "root",
    },
    {
      id: "c2",
      parentCommentId: "c1",
      author: { username: "yuna" },
      body: "@mei に返信",
    },
    {
      id: "c3",
      parentCommentId: "c2",
      author: { username: "isla" },
      body: "nested",
    },
  ];
  const threads = threadComments(comments);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.replies.length, 1);
  assert.equal(threads[0]!.replies[0]!.replies.length, 1);
  assert.equal(parentAuthorUsername(comments, "c1"), "mei");
  assert.equal(parentAuthorUsername(comments, "c2"), "yuna");

  console.log("OK: DISCOVERY → INVESTIGATING → VERIFIED → shouldPost");
  console.log("OK: comment threads + parentAuthorUsername");
}

main();
