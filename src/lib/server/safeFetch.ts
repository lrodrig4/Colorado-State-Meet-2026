import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type SafeTextFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  userAgent?: string;
  allowedContentTypes?: readonly string[];
  maxRedirects?: number;
};

const defaultAllowedContentTypes = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
  "application/xml",
];

const defaultUserAgent =
  "ColoradoDistanceQualifierTracker/0.1 (+https://vercel.app)";

export function parseSafeHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("URL must be absolute and valid.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SafeFetchError("URL must use http or https.");
  }

  if (url.username || url.password) {
    throw new SafeFetchError("URL credentials are not allowed.");
  }

  if (!url.hostname || url.hostname.length > 253) {
    throw new SafeFetchError("URL host is invalid.");
  }

  return url;
}

export async function fetchSafeText(
  rawUrl: string,
  options: SafeTextFetchOptions = {},
): Promise<{ text: string; finalUrl: string; response: Response }> {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = parseSafeHttpUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicUrl(currentUrl);
    const response = await fetchWithTimeout(currentUrl, options);

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SafeFetchError("Redirect response is missing a location.", 502);
      }
      if (redirectCount === maxRedirects) {
        throw new SafeFetchError("Too many redirects.", 508);
      }
      currentUrl = parseSafeHttpUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new SafeFetchError(
        `Fetch failed with ${response.status} ${response.statusText}.`,
        502,
      );
    }

    validateContentType(
      response,
      options.allowedContentTypes,
      options.maxBytes ?? 1_000_000,
    );
    return {
      text: await readTextWithLimit(response, options.maxBytes ?? 1_000_000),
      finalUrl: currentUrl.toString(),
      response,
    };
  }

  throw new SafeFetchError("Too many redirects.", 508);
}

export async function assertPublicUrl(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literalIpVersion = isIP(host);
  const addresses = literalIpVersion
    ? [{ address: host, family: literalIpVersion }]
    : await lookupPublicAddresses(host);

  if (addresses.length === 0) {
    throw new SafeFetchError("URL host could not be resolved.");
  }

  for (const address of addresses) {
    if (isPrivateAddress(address.address)) {
      throw new SafeFetchError("Private, loopback, and link-local hosts are not allowed.");
    }
  }
}

export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isPrivateIpv4(address);
  }
  if (version === 6) {
    return isPrivateIpv6(address);
  }
  return true;
}

async function lookupPublicAddresses(hostname: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new SafeFetchError("URL host lookup timed out.", 408)),
          3_000,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof SafeFetchError) {
      throw error;
    }
    throw new SafeFetchError("URL host could not be resolved.");
  } finally {
    clearTimeout(timeout);
  }
}

function fetchWithTimeout(url: URL, options: SafeTextFetchOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  return fetch(url, {
    headers: {
      "user-agent": options.userAgent ?? defaultUserAgent,
    },
    redirect: "manual",
    signal: controller.signal,
  })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SafeFetchError("Remote fetch timed out.", 408);
      }
      throw error;
    })
    .finally(() => clearTimeout(timeout));
}

function validateContentType(
  response: Response,
  allowedContentTypes: readonly string[] = defaultAllowedContentTypes,
  maxBytes = 1_000_000,
) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new SafeFetchError("Remote response is too large.", 413);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    contentType &&
    !allowedContentTypes.some((allowed) => contentType.includes(allowed))
  ) {
    throw new SafeFetchError("Remote response content type is not supported.", 415);
  }
}

async function readTextWithLimit(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError("Remote response is too large.", 413);
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }

  return false;
}
