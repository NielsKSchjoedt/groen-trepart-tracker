/**
 * Cloudflare Pages Functions middleware that enforces HTTP Basic Auth
 * on all requests. Remove this file (or the entire functions/ directory)
 * when you're ready for public release.
 *
 * Credentials are hardcoded for pre-release testing only.
 *
 * @example
 *   Browser will prompt for username/password on first visit.
 *   Username: trepart
 *   Password: groen2026
 */

interface CFEventContext {
  request: Request;
  next: () => Promise<Response>;
}

type PagesFunction = (context: CFEventContext) => Promise<Response> | Response;

const BASIC_USER = "trepart";
const BASIC_PASS = "groen2026";

const REALM = "Trepart Tracker (pre-release)";

/**
 * Validates the Authorization header against the hardcoded credentials.
 *
 * @param request - The incoming Request object
 * @returns true if the request carries a valid Basic Auth header
 */
function hasValidAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const encoded = authHeader.slice("Basic ".length);
  const decoded = atob(encoded);
  const [user, ...passParts] = decoded.split(":");
  const pass = passParts.join(":");

  return user === BASIC_USER && pass === BASIC_PASS;
}

/**
 * Returns a 401 response that triggers the browser's native auth dialog.
 *
 * @returns A Response with WWW-Authenticate header
 */
function unauthorizedResponse(): Response {
  return new Response("Adgang nægtet. Log ind for at fortsætte.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

/**
 * Paths that must be publicly accessible regardless of auth — browsers
 * fetch these without forwarding Basic Auth credentials.
 */
const PUBLIC_PATHS = [
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon.svg",
  "/robots.txt",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];

/**
 * Cloudflare Pages middleware handler. Runs before every request.
 * If the request lacks valid Basic Auth credentials, returns a 401
 * challenge. Otherwise, passes through to the next handler.
 *
 * @param context - The Cloudflare Pages EventContext
 * @returns The response (either 401 challenge or the proxied page)
 */
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Allow static assets through without auth — browsers fetch these
  // as sub-resources and don't forward Basic Auth credentials.
  if (PUBLIC_PATHS.includes(url.pathname)) {
    return context.next();
  }

  if (!hasValidAuth(context.request)) {
    return unauthorizedResponse();
  }

  return context.next();
};
