const gate = { released: false };

export function GET() {
  gate.released = false;
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode("fi"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        controller.enqueue(encoder.encode("rst"));
        while (!gate.released)
          await new Promise((resolve) => setTimeout(resolve, 10));
        controller.enqueue(encoder.encode("second"));
        controller.close();
      },
    }),
  );
}

export function POST() {
  gate.released = true;
  return new Response(null, { status: 204 });
}
