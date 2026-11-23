/**
 * What a form action returns instead of calling redirect().
 *
 * After a redirect() Next makes a request to itself for the next page, and on this host that request
 * sometimes fails. The browser is then handed an empty reply and shows a system error even though the
 * action had already done its work. Returning the address lets the form move on by itself
 * (useFollowRedirect), with nothing for the server to fetch.
 */
export const goTo = (to: string): { redirectTo: string; error?: string; ok?: string } => ({ redirectTo: to });
