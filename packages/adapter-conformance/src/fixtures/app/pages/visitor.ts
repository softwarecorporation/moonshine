export function GET(request: Request) {
  return new Response(
    request.headers.get("authorization") ??
      request.headers.get("cookie") ??
      request.headers.get("x-visitor") ??
      "anonymous",
  );
}
