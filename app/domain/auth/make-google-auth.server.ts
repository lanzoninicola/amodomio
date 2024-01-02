import { authenticator } from "./google.server";

/**
 *
 * @param request Request object
 * @returns object The user authenticated object (see google.server.ts) or the NodeResponse object required to redirect because the login process failed
 *
 * @example
 *
 * const [failureRedirectResponse, loggedUser] = await tryit(makeGoogleAuth(request))
 *
 * if (failureRedirectResponse || !loggedUser) {
 *  return redirect('/login')
 * }
 *
 * return ok(loggedUser)
 */
export default async function makeGoogleAuth(request: Request) {
  return await authenticator.authenticate("google", request);
}
