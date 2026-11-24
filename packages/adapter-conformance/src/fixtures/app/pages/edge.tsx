export const loader = () => ({
  where:
    typeof process !== "undefined" && process.versions?.node
      ? "node function"
      : "edge function",
});

export default function Edge({
  data,
}: {
  data: Record<string, { where: string }>;
}) {
  return <p>{Object.values(data).find((value) => value?.where)?.where}</p>;
}
