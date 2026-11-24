// Cloudflare Pages Function: API jwèt yo egzekite dirèkteman sou Pages.
// Backend handler la pataje menm runtime Web APIs; pa gen Worker apa pou deplwaye.
import handler from '../../worker/src/index.js';

export async function onRequest({ request, env }) {
  return handler.fetch(request, env);
}
