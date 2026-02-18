import { useReducer } from "react";
import type {
  AITableState,
  AITableColumnDef,
  AITableRow,
  AITableUseCase,
  AITableCell,
} from "@/lib/ai-table-types";
import { cellKey } from "@/lib/ai-table-types";
import type { CellExecutionResult } from "@/server/tables/column-executor";

// ── Actions ──

type AITableAction =
  | { type: "START_ALL" }
  | { type: "ALL_DONE" }
  | { type: "CELL_RUNNING"; rowId: string; colId: string }
  | {
      type: "CELL_COMPLETE";
      rowId: string;
      colId: string;
      result: CellExecutionResult;
    }
  | { type: "CELL_ERROR"; rowId: string; colId: string; error: string }
  | { type: "CELL_EDIT"; rowId: string; colId: string; value: string }
  | { type: "UPDATE_COLUMN"; column: AITableColumnDef }
  | { type: "REMOVE_COLUMN"; colId: string }
  | { type: "ADD_COLUMN"; column: AITableColumnDef };

// ── Reducer ──

function aiTableReducer(
  state: AITableState,
  action: AITableAction,
): AITableState {
  switch (action.type) {
    case "START_ALL":
      return { ...state, isRunning: true };

    case "ALL_DONE":
      return { ...state, isRunning: false };

    case "CELL_RUNNING": {
      const key = cellKey(action.rowId, action.colId);
      return {
        ...state,
        cells: {
          ...state.cells,
          [key]: {
            rowId: action.rowId,
            columnId: action.colId,
            status: "running",
          },
        },
      };
    }

    case "CELL_COMPLETE": {
      const key = cellKey(action.rowId, action.colId);
      const cell: AITableCell = {
        rowId: action.rowId,
        columnId: action.colId,
        status: "complete",
        result: action.result.result,
        detail: action.result.detail,
        sourceText: action.result.sourceText,
        usage: {
          inputTokens: action.result.usage.inputTokens,
          outputTokens: action.result.usage.outputTokens,
        },
        latencyMs: action.result.latencyMs,
      };
      return {
        ...state,
        cells: { ...state.cells, [key]: cell },
      };
    }

    case "CELL_ERROR": {
      const key = cellKey(action.rowId, action.colId);
      return {
        ...state,
        cells: {
          ...state.cells,
          [key]: {
            rowId: action.rowId,
            columnId: action.colId,
            status: "error",
            error: action.error,
          },
        },
      };
    }

    case "CELL_EDIT": {
      const key = cellKey(action.rowId, action.colId);
      return {
        ...state,
        cells: {
          ...state.cells,
          [key]: {
            rowId: action.rowId,
            columnId: action.colId,
            status: "complete",
            result: action.value,
          },
        },
      };
    }

    case "UPDATE_COLUMN":
      return {
        ...state,
        columns: state.columns.map((c) =>
          c.id === action.column.id ? action.column : c,
        ),
      };

    case "REMOVE_COLUMN": {
      const newCells = { ...state.cells };
      for (const key of Object.keys(newCells)) {
        if (key.endsWith(`:${action.colId}`)) {
          delete newCells[key];
        }
      }
      return {
        ...state,
        columns: state.columns.filter((c) => c.id !== action.colId),
        cells: newCells,
      };
    }

    case "ADD_COLUMN":
      return {
        ...state,
        columns: [...state.columns, action.column],
      };

    default:
      return state;
  }
}

// ── Hook ──

export function useAITableReducer(
  submissionId: string,
  useCase: AITableUseCase,
  rows: AITableRow[],
  columns: AITableColumnDef[],
  savedCells?: Record<string, AITableCell>,
) {
  const initialCells: Record<string, AITableCell> = {};
  for (const row of rows) {
    for (const col of columns) {
      const key = cellKey(row.documentId, col.id);
      initialCells[key] = savedCells?.[key] ?? {
        rowId: row.documentId,
        columnId: col.id,
        status: col.isUserInput ? "complete" : "pending",
        ...(col.isUserInput ? { result: "" } : {}),
      };
    }
  }

  const initialState: AITableState = {
    id: `table-${Date.now()}`,
    submissionId,
    useCase,
    rows,
    columns,
    cells: initialCells,
    isRunning: false,
    createdAt: new Date(),
  };

  return useReducer(aiTableReducer, initialState);
}
