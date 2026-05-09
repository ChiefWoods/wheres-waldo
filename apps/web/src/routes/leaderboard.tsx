import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { useMemo } from "react";

import { leaderboardQueryOptions, sceneListQueryOptions } from "@/lib/query-options";
import { defaultSceneSlug, scenes } from "@/lib/scenes";
import { type LeaderboardRow } from "@/lib/trpc-client";

type LeaderboardSearch = {
  scene?: string;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE = 1;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const SKELETON_ROW_COUNT = 5;
const RANK_TROPHY_BY_POSITION: Record<number, string> = {
  1: "/assets/trophy/gold.svg",
  2: "/assets/trophy/silver.svg",
  3: "/assets/trophy/bronze.svg",
};

const columnHelper = createColumnHelper<LeaderboardRow>();

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parsePageSize(value: unknown, fallback: number) {
  const parsed = parsePositiveInt(value, fallback);
  if (!PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
    return fallback;
  }

  return parsed;
}

function validateLeaderboardSearch(search: Record<string, unknown>): LeaderboardSearch {
  const parsedScene = typeof search.scene === "string" ? search.scene : undefined;

  return {
    scene: parsedScene ?? defaultSceneSlug,
    page: parsePositiveInt(search.page, DEFAULT_PAGE),
    pageSize: parsePageSize(search.pageSize, DEFAULT_PAGE_SIZE),
  };
}

function formatElapsed(elapsedMs: number | null) {
  if (elapsedMs === null || elapsedMs < 0) {
    return "N/A";
  }

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = elapsedMs % 1000;

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

const leaderboardColumns = [
  columnHelper.display({
    id: "rank",
    header: "Rank",
    cell: (info) => {
      const { pageIndex, pageSize } = info.table.getState().pagination;
      const rank = pageIndex * pageSize + info.row.index + 1;
      const trophyIcon = RANK_TROPHY_BY_POSITION[rank];

      return (
        <div className="flex items-center gap-2">
          <span>{rank}</span>
          {trophyIcon && (
            <img src={trophyIcon} alt="trophy" aria-hidden className="size-4 shrink-0" />
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("elapsedMs", {
    header: "Time",
    cell: (info) => formatElapsed(info.getValue()),
  }),
  columnHelper.accessor("attempts", {
    header: "Attempts",
    cell: (info) => info.getValue(),
  }),
];

export const Route = createFileRoute("/leaderboard")({
  validateSearch: validateLeaderboardSearch,
  component: LeaderboardRoute,
});

function LeaderboardRoute() {
  const navigate = useNavigate({ from: "/leaderboard" });
  const search = Route.useSearch();
  const selectedSceneSlug = search.scene ?? defaultSceneSlug;
  const sceneListQuery = useQuery({
    ...sceneListQueryOptions,
  });

  const sceneSlugToId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const scene of sceneListQuery.data ?? []) {
      map[scene.slug] = scene.id;
    }
    return map;
  }, [sceneListQuery.data]);

  const selectedSceneId = selectedSceneSlug ? sceneSlugToId[selectedSceneSlug] : undefined;

  const leaderboardQuery = useQuery({
    ...leaderboardQueryOptions(selectedSceneId, search.page, search.pageSize),
    placeholderData: keepPreviousData,
  });

  const paginationState = useMemo<PaginationState>(
    () => ({
      pageIndex: search.page - 1,
      pageSize: search.pageSize,
    }),
    [search.page, search.pageSize],
  );

  const tableData = useMemo(() => leaderboardQuery.data?.rows ?? [], [leaderboardQuery.data?.rows]);

  const totalPages = useMemo(() => {
    const totalRows = leaderboardQuery.data?.total ?? 0;
    return Math.max(1, Math.ceil(totalRows / search.pageSize));
  }, [leaderboardQuery.data?.total, search.pageSize]);

  const table = useReactTable({
    data: tableData,
    columns: leaderboardColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: {
      pagination: paginationState,
    },
    onPaginationChange: (updater) => {
      const nextPagination = typeof updater === "function" ? updater(paginationState) : updater;
      navigate({
        search: (prev) => ({
          ...prev,
          page: nextPagination.pageIndex + 1,
          pageSize: nextPagination.pageSize,
        }),
      });
    },
  });

  const isTableLoading =
    sceneListQuery.isPending ||
    leaderboardQuery.isPending ||
    (leaderboardQuery.isFetching && leaderboardQuery.isPlaceholderData);

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      </div>

      <Tabs
        value={selectedSceneSlug}
        onValueChange={(nextSceneSlug) =>
          navigate({
            search: (prev) => ({
              ...prev,
              scene: nextSceneSlug,
              page: DEFAULT_PAGE,
            }),
          })
        }
      >
        <div className="overflow-x-auto pb-1">
          <TabsList variant="line" className="min-w-max gap-2 bg-transparent p-0">
            {scenes.map((scene) => (
              <TabsTrigger
                key={scene.slug}
                value={scene.slug}
                className="min-w-36 rounded-md border px-3"
              >
                {scene.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {sceneListQuery.isError && (
        <p className="text-destructive text-sm" role="alert">
          Failed to load scenes from server.
        </p>
      )}
      {leaderboardQuery.isError && (
        <p className="text-destructive text-sm" role="alert">
          Failed to load leaderboard.
        </p>
      )}

      <div className="bg-card text-card-foreground border-border rounded-lg border p-3">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {!header.isPlaceholder &&
                      flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isTableLoading ? (
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                  No leaderboard entries for this scene yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </p>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(nextValue) => {
              table.setPagination({
                pageIndex: 0,
                pageSize: Number(nextValue),
              });
            }}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={leaderboardQuery.isFetching || !table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            size="sm"
            disabled={leaderboardQuery.isFetching || !table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
