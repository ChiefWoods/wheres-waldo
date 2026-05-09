type TrpcLikeError = {
  data?: { code?: string };
  shape?: { data?: { code?: string } };
};

export function isNotFoundTrpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const trpcLikeError = error as TrpcLikeError;

  return (
    trpcLikeError.data?.code === "NOT_FOUND" || trpcLikeError.shape?.data?.code === "NOT_FOUND"
  );
}

export function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { message?: string };
  if (typeof maybeError.message === "string" && maybeError.message.trim().length > 0) {
    return maybeError.message;
  }

  return null;
}
