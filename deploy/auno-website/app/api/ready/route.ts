export async function GET() {
  return Response.json(
    { ready: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
