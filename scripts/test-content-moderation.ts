import {
  assertPostContentAllowed,
  isObjectionableUserText,
} from "../lib/moderation/content-filter";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  assert(isObjectionableUserText("I will kill you"), "direct threats must be blocked");
  assert(isObjectionableUserText("この投稿で殺すぞと脅す"), "Japanese threats must be blocked");
  assert(isObjectionableUserText("adult video"), "explicit sexual content must be blocked");
  assert(isObjectionableUserText("white power"), "hateful slogans must be blocked");
  assert(!isObjectionableUserText("This is a killer product design"), "ordinary product copy must pass");
  assert(!isObjectionableUserText("Nude lipstick shade from the new collection"), "cosmetic shade wording must pass");

  let blocked = false;
  try {
    assertPostContentAllowed("殺してやる");
  } catch {
    blocked = true;
  }
  assert(blocked, "post validation must throw for objectionable text");

  console.log("Content moderation tests passed.");
}

main();
