"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { DocumentTypeBadge } from "@/components/ppap/DocumentTypeBadge";
import { cellKey } from "@/lib/ai-table-types";
import { createConcurrencyLimiter } from "@/lib/concurrency";
import { useSplitView } from "@/lib/split-view-context";
import { useAITableReducer } from "@/components/tables/useAITableReducer";
import { AITableToolbar } from "@/components/tables/AITableToolbar";
import { AITableColumnHeader } from "@/components/tables/AITableColumnHeader";
import { AITableCellDisplay } from "@/components/tables/AITableCellDisplay";
import { AITableCellDetail } from "@/components/tables/AITableCellDetail";
import { AITableAddColumn } from "@/components/tables/AITableAddColumn";
import type {
  AITableColumnDef,
  AITableRow,
  AITableUseCase,
} from "@/lib/ai-table-types";

const limiter = createConcurrencyLimiter(6);

interface AITableProps {
  submissionId: string;
  messageId?: string;
  savedSessionId?: string;
  useCase: AITableUseCase;
  initialRows: AITableRow[];
  initialColumns: AITableColumnDef[];
  initialCells?: Record<string, import("@/lib/ai-table-types").AITableCell>;
}

export function AITable({
  submissionId,
  messageId,
  savedSessionId: initialSessionId,
  useCase,
  initialRows,
  initialColumns,
  initialCells,
}: AITableProps) {
  const t = useTranslations("tables");
  const { openOverlay } = useSplitView();
  const [pendingSave, setPendingSave] = useState(false);
  const sessionIdRef = useRef<string | undefined>(initialSessionId);
  const [state, dispatch] = useAITableReducer(
    submissionId,
    useCase,
    initialRows,
    initialColumns,
    initialCells,
  );

  const executeSingleCell = useCallback(
    async (rowId: string, col: AITableColumnDef) => {
      dispatch({ type: "CELL_RUNNING", rowId, colId: col.id });
      try {
        const result = await limiter(() =>
          trpc.tables.executeCell.mutate({
            documentId: rowId,
            submissionId,
            column: col,
          }),
        );
        dispatch({
          type: "CELL_COMPLETE",
          rowId,
          colId: col.id,
          result,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Execution failed";
        dispatch({
          type: "CELL_ERROR",
          rowId,
          colId: col.id,
          error: message,
        });
      }
    },
    [submissionId, dispatch],
  );

  const runColumn = useCallback(
    async (col: AITableColumnDef) => {
      const promises = state.rows.map((row) =>
        executeSingleCell(row.documentId, col),
      );
      await Promise.allSettled(promises);
      setPendingSave(true);
    },
    [state.rows, executeSingleCell],
  );

  const runAll = useCallback(async () => {
    dispatch({ type: "START_ALL" });
    const aiColumns = state.columns.filter((col) => !col.isUserInput);
    const promises = state.rows.flatMap((row) =>
      aiColumns.map((col) =>
        executeSingleCell(row.documentId, col),
      ),
    );
    await Promise.allSettled(promises);
    dispatch({ type: "ALL_DONE" });
    setPendingSave(true);
  }, [state.rows, state.columns, executeSingleCell, dispatch]);

  // Auto-run all cells on mount (skip if pre-populated with saved data)
  const hasRun = useRef(false);
  const hasSavedCells = useRef(!!initialCells && Object.keys(initialCells).length > 0);
  const runAllRef = useRef(runAll);
  runAllRef.current = runAll;
  useEffect(() => {
    if (hasSavedCells.current) return;
    if (!hasRun.current && state.rows.length > 0 && state.columns.length > 0) {
      hasRun.current = true;
      runAllRef.current();
    }
  }, [state.rows.length, state.columns.length]);

  // Effect-based save — runs after React has flushed all CELL_COMPLETE dispatches
  useEffect(() => {
    if (!pendingSave) return;
    setPendingSave(false);
    (async () => {
      try {
        const session = await trpc.tables.saveSession.mutate({
          id: sessionIdRef.current,
          submissionId,
          messageId,
          useCase: useCase as unknown as Record<string, unknown>,
          columns: state.columns as unknown as Record<string, unknown>[],
          results: state.cells,
        });
        sessionIdRef.current = session.id;
        if (messageId && session?.id) {
          try {
            await trpc.chat.updateMessageMetadata.mutate({
              messageId,
              sessionId: session.id,
            });
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }
    })();
  }, [pendingSave, state.columns, state.cells, submissionId, messageId, useCase]);

  const handleCellClick = useCallback(
    (rowId: string, col: AITableColumnDef) => {
      const key = cellKey(rowId, col.id);
      const cell = state.cells[key];
      if (!cell || cell.status !== "complete") return;
      const row = state.rows.find((r) => r.documentId === rowId);
      if (!row) return;
      openOverlay(
        <AITableCellDetail cell={cell} row={row} column={col} />,
      );
    },
    [state.cells, state.rows, openOverlay],
  );

  const handleCellEdit = useCallback(
    (rowId: string, colId: string, value: string) => {
      dispatch({ type: "CELL_EDIT", rowId, colId, value });
      setPendingSave(true);
    },
    [dispatch],
  );

  const handleExport = useCallback(() => {
    const headers = ["Document", "Type", ...state.columns.map((c) => c.name)];
    const rows = state.rows.map((row) => {
      const cells = state.columns.map((col) => {
        const cell = state.cells[cellKey(row.documentId, col.id)];
        return cell?.status === "complete"
          ? (cell.result ?? "").replace(/"/g, '""')
          : "";
      });
      return [
        row.filename,
        row.documentType ?? "",
        ...cells,
      ];
    });

    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${useCase.name.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.rows, state.columns, state.cells, useCase.name]);

  return (
    <div className="my-2 space-y-2">
      <AITableToolbar
        title={useCase.name}
        description={useCase.description}
        state={state}
        onExport={handleExport}
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border-b border-r border-border px-2 py-1 text-left font-medium last:border-r-0">
                {t("document")}
              </th>
              {state.columns.map((col) => (
                <th
                  key={col.id}
                  className="border-b border-r border-border px-2 py-1 text-left font-medium last:border-r-0"
                >
                  <AITableColumnHeader
                    column={col}
                    onConfigure={(updated) =>
                      dispatch({ type: "UPDATE_COLUMN", column: updated })
                    }
                    onRemove={() =>
                      dispatch({ type: "REMOVE_COLUMN", colId: col.id })
                    }
                    onRefresh={(updated) => runColumn(updated)}
                  />
                </th>
              ))}
              <th className="border-b border-border px-1 py-1">
                <AITableAddColumn
                  onAdd={(column) => {
                    dispatch({ type: "ADD_COLUMN", column });
                    if (!column.isUserInput) {
                      runColumn(column);
                    }
                  }}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, ri) => (
              <tr
                key={row.documentId}
                className={ri % 2 === 1 ? "bg-muted/25" : ""}
              >
                <td className="border-b border-r border-border px-2 py-1 font-medium last:border-r-0">
                  <div className="flex items-center gap-1.5">
                    <span className="max-w-[140px] truncate">
                      {row.filename}
                    </span>
                    {row.documentType && (
                      <DocumentTypeBadge type={row.documentType} />
                    )}
                  </div>
                </td>
                {state.columns.map((col) => {
                  const key = cellKey(row.documentId, col.id);
                  const cell = state.cells[key];
                  return (
                    <td
                      key={col.id}
                      className="border-b border-r border-border px-2 py-1 last:border-r-0"
                    >
                      <AITableCellDisplay
                        cell={cell}
                        outputFormat={col.outputFormat}
                        isUserInput={col.isUserInput}
                        onClick={() =>
                          handleCellClick(row.documentId, col)
                        }
                        onEdit={(value) =>
                          handleCellEdit(row.documentId, col.id, value)
                        }
                      />
                    </td>
                  );
                })}
                <td className="border-b border-border px-1 py-1" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
