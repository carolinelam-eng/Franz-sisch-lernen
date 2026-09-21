import { expect, test, vi } from "vitest";
import type { PublishedCollection } from "../../src/content/types";
import { ContentClientError, SupabaseContentClient } from "../../src/content/contentClient";

const rawKey = "abcdefghijklmnopqrstuvwxyzABCDEF";
const published: PublishedCollection = {
  collectionId: "class-7b",
  version: 1,
  publishedAt: "2026-09-20T10:00:00.000Z",
  lists: [],
};

function request(data: unknown, error: { message: string } | null = null) {
  const promise = Promise.resolve({ data, error });
  return Object.assign(promise, { abortSignal: vi.fn(() => promise) });
}

test("calls only the published collection RPC and validates its response", async () => {
  const rpc = vi.fn(() => request(published));
  const client = new SupabaseContentClient({ rpc });

  await expect(client.fetchCollection(rawKey)).resolves.toEqual(published);
  expect(rpc).toHaveBeenCalledWith("get_published_collection", { p_subscription_key: rawKey });
});

test("passes an abort signal to the Supabase request", async () => {
  const result = request(published);
  const client = new SupabaseContentClient({ rpc: vi.fn(() => result) });
  const controller = new AbortController();

  await client.fetchCollection(rawKey, controller.signal);

  expect(result.abortSignal).toHaveBeenCalledWith(controller.signal);
});

test("maps a missing collection to a safe error without exposing the key", async () => {
  const client = new SupabaseContentClient({ rpc: vi.fn(() => request(null)) });

  const error = await client.fetchCollection(rawKey).catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(ContentClientError);
  expect(error).toMatchObject({ code: "not-found" });
  expect(String(error)).not.toContain(rawKey);
});

test("rejects malformed server data with a safe error", async () => {
  const client = new SupabaseContentClient({ rpc: vi.fn(() => request({ collectionId: rawKey })) });

  const error = await client.fetchCollection(rawKey).catch((reason: unknown) => reason);

  expect(error).toMatchObject({ code: "invalid-response" });
  expect(String(error)).not.toContain(rawKey);
});

test("maps remote failures without exposing server details or the key", async () => {
  const client = new SupabaseContentClient({ rpc: vi.fn(() => request(null, { message: `secret ${rawKey}` })) });

  const error = await client.fetchCollection(rawKey).catch((reason: unknown) => reason);

  expect(error).toMatchObject({ code: "remote" });
  expect(String(error)).not.toContain(rawKey);
});
