export function createJsonToolResult<T extends Record<string, unknown>>(
  payload: T,
) {
  return {
    structuredContent: payload,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function createErrorToolResult(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: formatError(error),
      },
    ],
  };
}

export function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
