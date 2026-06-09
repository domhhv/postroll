import { z } from 'zod';

import { GatewayError, switchWorkspace } from '#lib/api';

export const runtime = 'nodejs';

const switchRequestSchema = z.object({
  workspaceId: z.uuid(),
});

/**
 * Switch the session's active workspace. A Route Handler (not a Server Action)
 * so it can be called with a plain fetch and is free to mutate the session
 * cookie — switchWorkspace verifies membership via the gateway before writing.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = switchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ message: 'A valid workspaceId is required.' }, { status: 400 });
  }

  try {
    const workspace = await switchWorkspace(parsed.data.workspaceId);

    return Response.json({ workspace });
  } catch (error) {
    if (error instanceof GatewayError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    return Response.json({ message: 'Something went wrong.' }, { status: 500 });
  }
}
