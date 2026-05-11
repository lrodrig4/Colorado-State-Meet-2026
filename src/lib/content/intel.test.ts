import assert from "node:assert/strict";
import test from "node:test";
import {
  featuredIntelPosts,
  getIntelPostBySlug,
  intelPosts,
} from "@/lib/content/intel";

test("intel posts expose unique slugs and published dates", () => {
  const slugs = new Set(intelPosts.map((post) => post.slug));

  assert.equal(slugs.size, intelPosts.length);
  assert.ok(intelPosts.length >= 4);
  assert.ok(intelPosts.every((post) => /^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt)));
});

test("featured intel posts preserve published order and cap the result", () => {
  const posts = featuredIntelPosts(2);

  assert.equal(posts.length, 2);
  assert.equal(posts[0]?.title, "5A Boys State Bubble");
  assert.equal(posts[1]?.title, "4A Girls Team Watch");
});

test("getIntelPostBySlug returns the matching post", () => {
  const post = getIntelPostBySlug("5a-boys-state-bubble");

  assert.equal(post?.title, "5A Boys State Bubble");
  assert.ok(post?.sections.length);
});
