// Explicit Cloudflare Pages route for authenticated points rounds.
import handler from '../../_shared/handler.js';
export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
