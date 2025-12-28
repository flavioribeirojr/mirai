import { jwtVerify, createRemoteJWKSet } from "jose";

export async function handleRequestAuthorization(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return new Response("Missing authorization", { status: 401 });
  }

  const [, token] = authorization.split(" ");

  const JWKS = createRemoteJWKSet(
    new URL("https://splendid-sawfly-13.clerk.accounts.dev/.well-known/jwks.json")
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://splendid-sawfly-13.clerk.accounts.dev",
  });

  // payload.sub === Clerk user ID
  const clerkUserId = payload.sub;
  return clerkUserId;
}
