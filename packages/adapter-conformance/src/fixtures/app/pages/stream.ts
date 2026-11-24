export function GET() {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode("first"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        controller.enqueue(encoder.encode("second"));
        controller.close();
      },
    }),
  );
}
