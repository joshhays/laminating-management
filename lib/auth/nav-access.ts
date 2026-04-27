import type { SiteSession } from "./session";
import { canAccessModule, requiredModuleForPath } from "./path-access";

/** Sidebar / nav: can this session follow a link to `href`? */
export function sessionMayNavTo(session: SiteSession | null, href: string): boolean {
  if (!session) return false;
  const required = requiredModuleForPath(href);
  if (required === null) return true;
  return canAccessModule({
    isAdmin: session.isAdmin,
    modules: session.modules,
    required,
  });
}
