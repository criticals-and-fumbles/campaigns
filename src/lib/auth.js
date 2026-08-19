/**
 * Cloudflare Access identity check. This app implements NO login/session/
 * password system of its own — Access sits in front of /console/* and
 * /api/* at the Cloudflare edge (configured outside this repo, see
 * README.md "Manual setup") and injects this header on every request it
 * lets through. Its presence is what Access guarantees; a route seeing
 * this header can trust it without re-verifying anything itself.
 */
export function requireAccessIdentity(c, next) {
  const email = c.req.header("Cf-Access-Authenticated-User-Email");
  if (!email) {
    return c.json(
      { error: "Unauthenticated — this route must sit behind Cloudflare Access." },
      401,
    );
  }
  c.set("gmEmail", email);
  return next();
}
