import { readFile } from "fs/promises";

import { config } from "./config.js";
import { assertReadable } from "./process-utils.js";
import type {
  LocalGraphqlConnectionInfo,
  LocalSiteLifecycleMutationResult,
} from "./types.js";

interface LocalGraphqlError {
  message?: string;
}

interface LocalGraphqlResponse<T> {
  data?: T;
  errors?: LocalGraphqlError[];
}

export async function startLocalSite(siteId: string) {
  return runSiteLifecycleMutation("startSite", siteId);
}

export async function stopLocalSite(siteId: string) {
  return runSiteLifecycleMutation("stopSite", siteId);
}

export function formatLocalGraphqlErrors(errors: LocalGraphqlError[] = []) {
  const messages = errors
    .map((error) => error.message?.trim())
    .filter((message): message is string => Boolean(message));

  return messages.join("; ") || "Local GraphQL request failed.";
}

async function runSiteLifecycleMutation(
  mutationName: "startSite" | "stopSite",
  siteId: string,
) {
  const query = `mutation ($siteID: ID!) { ${mutationName}(id: $siteID) { id name status } }`;
  const payload = await requestLocalGraphql<
    Record<"startSite" | "stopSite", LocalSiteLifecycleMutationResult>
  >(query, { siteID: siteId });
  const result = payload[mutationName];

  if (!result) {
    throw new Error(`Local GraphQL did not return '${mutationName}' data.`);
  }

  return result;
}

async function requestLocalGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
) {
  const connection = await readLocalGraphqlConnectionInfo();

  let response: Response;
  try {
    response = await fetch(connection.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.authToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to reach Local's GraphQL API at ${connection.url}. Make sure the Local app is running. ${message}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Local GraphQL API responded with HTTP ${response.status} ${response.statusText}.`,
    );
  }

  const payload = (await response.json()) as LocalGraphqlResponse<T>;

  if (payload.errors?.length) {
    throw new Error(formatLocalGraphqlErrors(payload.errors));
  }

  if (!payload.data) {
    throw new Error("Local GraphQL API returned no data.");
  }

  return payload.data;
}

async function readLocalGraphqlConnectionInfo() {
  await assertReadable(
    config.localGraphqlConnectionInfoJson,
    "Local GraphQL connection info is not readable. Open the Local app first",
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(config.localGraphqlConnectionInfoJson, "utf8"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read Local GraphQL connection info from '${config.localGraphqlConnectionInfoJson}': ${message}`,
    );
  }

  if (!isLocalGraphqlConnectionInfo(parsed)) {
    throw new Error(
      `Local GraphQL connection info is invalid: ${config.localGraphqlConnectionInfoJson}`,
    );
  }

  return parsed;
}

function isLocalGraphqlConnectionInfo(
  value: unknown,
): value is LocalGraphqlConnectionInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LocalGraphqlConnectionInfo>;
  return (
    typeof candidate.port === "number" &&
    typeof candidate.authToken === "string" &&
    typeof candidate.url === "string"
  );
}
