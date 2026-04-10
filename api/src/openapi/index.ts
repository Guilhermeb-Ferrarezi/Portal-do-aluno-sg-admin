import { activityLogsOpenApi } from "./activityLogs";
import { authOpenApi } from "./auth";
import { badgesOpenApi } from "./badges";
import { mergeOpenApiFragments } from "./base";
import { usersOpenApi } from "./users";

export function buildOpenApiSpec() {
  return mergeOpenApiFragments([
    authOpenApi,
    usersOpenApi,
    activityLogsOpenApi,
    badgesOpenApi,
  ]);
}
