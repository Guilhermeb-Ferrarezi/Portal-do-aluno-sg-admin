import { activityLogsOpenApi } from "./activityLogs";
import { authOpenApi } from "./auth";
import { apiTokensOpenApi } from "./apiTokens";
import { badgesOpenApi } from "./badges";
import { goalsOpenApi } from "./goals";
import { mergeOpenApiFragments } from "./base";
import { presenceOpenApi } from "./presence";
import { usersOpenApi } from "./users";

export function buildOpenApiSpec() {
  return mergeOpenApiFragments([
    authOpenApi,
    apiTokensOpenApi,
    usersOpenApi,
    activityLogsOpenApi,
    badgesOpenApi,
    goalsOpenApi,
    presenceOpenApi,
  ]);
}
