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
