import { createClient } from "@supabase/supabase-js";
import type { PublishedCollection } from "./types";
import { validatePublishedCollection } from "./mergePublishedCollection";

export interface ContentClient {
  fetchCollection(key: string, signal?: AbortSignal): Promise<PublishedCollection>;
}

export type ContentClientErrorCode = "not-found" | "invalid-response" | "remote" | "network";

export class ContentClientError extends Error {
  constructor(public readonly code: ContentClientErrorCode) {
    super(code === "not-found" ? "Die Sammlung wurde nicht gefunden." : "Die Sammlung konnte nicht geladen werden.");
    this.name = "ContentClientError";
  }
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface RpcRequest extends PromiseLike<RpcResult> {
  abortSignal?(signal: AbortSignal): PromiseLike<RpcResult>;
}

export interface RpcInvoker {
  rpc(functionName: string, parameters: Record<string, string>): RpcRequest;
}

export class SupabaseContentClient implements ContentClient {
  constructor(private readonly client: RpcInvoker) {}

  async fetchCollection(key: string, signal?: AbortSignal): Promise<PublishedCollection> {
    let response: RpcResult;
    try {
      const request = this.client.rpc("get_published_collection", { p_subscription_key: key });
      response = await (signal && request.abortSignal ? request.abortSignal(signal) : request);
    } catch {
      throw new ContentClientError("network");
    }

    if (response.error) throw new ContentClientError("remote");
    if (response.data === null) throw new ContentClientError("not-found");
    try {
      validatePublishedCollection(response.data);
      return response.data;
    } catch (error) {
      if (error instanceof ContentClientError) throw error;
      throw new ContentClientError("invalid-response");
    }
  }
}

export function createSupabaseContentClient(url: string, anonKey: string): ContentClient {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const invoker: RpcInvoker = {
    rpc(functionName, parameters) {
      return client.rpc(functionName, parameters) as unknown as RpcRequest;
    },
  };
  return new SupabaseContentClient(invoker);
}
