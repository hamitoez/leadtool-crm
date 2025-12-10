/**
 * Authorization Helper - Centralized access control
 *
 * Prevents horizontal privilege escalation by verifying resource ownership
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export interface AuthContext {
  userId: string;
  email: string;
}

/**
 * Get authenticated user context
 * @throws Error if not authenticated
 */
export async function requireAuth(): Promise<AuthContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  return {
    userId: session.user.id,
    email: session.user.email || "",
  };
}

/**
 * Verify user owns a project
 * @param projectId - Project ID to check
 * @param userId - User ID (from session)
 * @returns Project if authorized
 * @throws AuthorizationError if not authorized
 */
export async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, name: true },
  });

  if (!project) {
    throw new AuthorizationError("Project not found", 404);
  }

  if (project.userId !== userId) {
    throw new AuthorizationError("Access denied to this project", 403);
  }

  return project;
}

/**
 * Verify user owns a table (via project)
 * @param tableId - Table ID to check
 * @param userId - User ID (from session)
 * @returns Table with project info if authorized
 * @throws AuthorizationError if not authorized
 */
export async function verifyTableAccess(tableId: string, userId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: {
        select: { userId: true },
      },
    },
  });

  if (!table) {
    throw new AuthorizationError("Table not found", 404);
  }

  if (table.project.userId !== userId) {
    throw new AuthorizationError("Access denied to this table", 403);
  }

  return table;
}

/**
 * Verify user owns a row (via table -> project)
 * @param rowId - Row ID to check
 * @param userId - User ID (from session)
 * @returns Row with table and project info if authorized
 * @throws AuthorizationError if not authorized
 */
export async function verifyRowAccess(rowId: string, userId: string) {
  const row = await prisma.row.findUnique({
    where: { id: rowId },
    select: {
      id: true,
      tableId: true,
      table: {
        select: {
          id: true,
          project: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!row) {
    throw new AuthorizationError("Row not found", 404);
  }

  if (row.table.project.userId !== userId) {
    throw new AuthorizationError("Access denied to this row", 403);
  }

  return row;
}

/**
 * Verify user owns a cell (via row -> table -> project)
 * @param cellId - Cell ID to check
 * @param userId - User ID (from session)
 * @returns Cell with row, table and project info if authorized
 * @throws AuthorizationError if not authorized
 */
export async function verifyCellAccess(cellId: string, userId: string) {
  const cell = await prisma.cell.findUnique({
    where: { id: cellId },
    select: {
      id: true,
      rowId: true,
      columnId: true,
      row: {
        select: {
          table: {
            select: {
              project: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!cell) {
    throw new AuthorizationError("Cell not found", 404);
  }

  if (cell.row.table.project.userId !== userId) {
    throw new AuthorizationError("Access denied to this cell", 403);
  }

  return cell;
}

/**
 * Verify user owns a column (via table -> project)
 * @param columnId - Column ID to check
 * @param userId - User ID (from session)
 * @returns Column with table and project info if authorized
 * @throws AuthorizationError if not authorized
 */
export async function verifyColumnAccess(columnId: string, userId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: {
      id: true,
      tableId: true,
      table: {
        select: {
          project: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!column) {
    throw new AuthorizationError("Column not found", 404);
  }

  if (column.table.project.userId !== userId) {
    throw new AuthorizationError("Access denied to this column", 403);
  }

  return column;
}

/**
 * Custom error class for authorization failures
 */
export class AuthorizationError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/**
 * Check if an error is an AuthorizationError
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}
