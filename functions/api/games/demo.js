// Explicit Cloudflare Pages route for points-only demo rounds.
import handler from '../../_shared/handler.js';
export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
