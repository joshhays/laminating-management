import { AppModule } from "@prisma/client";

/** Every module a non-admin user can be granted (admins bypass checks). */
export const ALL_APP_MODULES = Object.values(AppModule) as AppModule[];
