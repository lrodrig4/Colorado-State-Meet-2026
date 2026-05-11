import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eventDefinitions } from "@/lib/data/events";
import type { EventKey, Gender } from "@/types/domain";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonObject(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<Record<string, unknown>> {
  const maxBytes = options.maxBytes ?? 64_000;
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiRequestError("Content-Type must be application/json.", 415);
  }

  if (contentLength > maxBytes) {
    throw new ApiRequestError("Request body is too large.", 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new ApiRequestError("Request body is too large.", 413);
  }

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiRequestError("Request body must be valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new ApiRequestError("Request body must be a JSON object.");
  }

  return parsed;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return apiError(error.message, error.status);
  }

  console.error(error);
  return apiError("Unexpected server error.", 500);
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
  options: { maxLength?: number; trim?: boolean } = {},
) {
  const value = body[field];
  if (typeof value !== "string") {
    throw new ApiRequestError(`${field} is required.`);
  }

  const normalized = options.trim === false ? value : value.trim();
  if (!normalized) {
    throw new ApiRequestError(`${field} is required.`);
  }

  if (options.maxLength && normalized.length > options.maxLength) {
    throw new ApiRequestError(`${field} is too long.`);
  }

  return normalized;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  options: { maxLength?: number; trim?: boolean } = {},
) {
  const value = body[field];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return requiredString(body, field, options);
}

export function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
  fallback: boolean,
) {
  const value = body[field];
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new ApiRequestError(`${field} must be a boolean.`);
  }

  return value;
}

export function optionalStringArray(
  body: Record<string, unknown>,
  field: string,
  options: { allowedValues?: readonly string[]; maxItems?: number } = {},
) {
  const value = body[field];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ApiRequestError(`${field} must be an array.`);
  }

  if (options.maxItems && value.length > options.maxItems) {
    throw new ApiRequestError(`${field} has too many items.`);
  }

  const values = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new ApiRequestError(`${field} must contain only strings.`);
    }
    return item.trim();
  });

  if (options.allowedValues) {
    const allowed = new Set(options.allowedValues);
    const unknown = values.find((item) => !allowed.has(item));
    if (unknown) {
      throw new ApiRequestError(`${field} contains an unknown value: ${unknown}.`);
    }
  }

  return values;
}

export function requiredIsoDate(body: Record<string, unknown>, field: string) {
  const value = requiredString(body, field, { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiRequestError(`${field} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiRequestError(`${field} must be a valid calendar date.`);
  }

  return value;
}

export function optionalEnum<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowedValues: readonly T[],
) {
  const value = body[field];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new ApiRequestError(`${field} must be one of: ${allowedValues.join(", ")}.`);
  }

  return value as T;
}

const genders = ["Boys", "Girls"] as const satisfies readonly Gender[];
const events = eventDefinitions.map((definition) => definition.event);

export function optionalGender(body: Record<string, unknown>, field = "gender") {
  return optionalEnum(body, field, genders);
}

export function optionalEvent(body: Record<string, unknown>, field = "event") {
  return optionalEnum(body, field, events as readonly EventKey[]);
}

export function requireCronRequest(request: Request) {
  return requireBearerSecret(request, {
    envNames: ["CRON_SECRET"],
    missingProductionMessage: "CRON_SECRET must be configured in production.",
  });
}

export function requireAdminRequest(request: Request) {
  return requireBearerSecret(request, {
    envNames: ["ADMIN_API_SECRET", "CRON_SECRET"],
    missingProductionMessage:
      "ADMIN_API_SECRET or CRON_SECRET must be configured in production.",
  });
}

function requireBearerSecret(
  request: Request,
  options: { envNames: string[]; missingProductionMessage: string },
) {
  const secrets = options.envNames
    .map((name) => process.env[name])
    .filter((secret): secret is string => Boolean(secret));

  if (secrets.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return apiError(options.missingProductionMessage, 503);
    }
    return undefined;
  }

  const token = bearerToken(request);
  if (!token || !secrets.some((secret) => constantTimeEqual(token, secret))) {
    return apiError("Unauthorized.", 401);
  }

  return undefined;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1];
}

function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
