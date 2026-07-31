import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReturns } from "@/lib/returns.functions";

export function useReturnsList() {
  const fetchList = useServerFn(listReturns);
  const {
    data: listData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["returns"],
    queryFn: () => fetchList(),
  });

  return {
    data: listData?.entries ?? [],
    isLoading,
    isError,
  };
}