// ─────────────────────────────────────────────────────────────────────────────
//  Projects Service
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "../../config/database";
import { AppError } from "../../utils/app-error";

interface ProjectRow {
  project_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

export interface CreateProjectDto {
  organizationId: string;
  name: string;
  description?: string;
  ownerId: string;
}

/**
 * Verifies the caller owns the organization before operating on projects.
 */
async function assertOrgOwnership(
  organizationId: string,
  ownerId: string
): Promise<void> {
  const result = await query(
    "SELECT 1 FROM organizations WHERE organization_id = $1 AND owner_id = $2",
    [organizationId, ownerId]
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.forbidden(
      "You do not have access to this organization"
    );
  }
}

export async function createProject(dto: CreateProjectDto) {
  await assertOrgOwnership(dto.organizationId, dto.ownerId);

  const result = await query<ProjectRow>(
    `INSERT INTO projects (organization_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING project_id, organization_id, name, description, created_at`,
    [dto.organizationId, dto.name.trim(), dto.description?.trim() ?? null]
  );
  return result.rows[0];
}

export async function listProjects(organizationId: string, ownerId: string) {
  await assertOrgOwnership(organizationId, ownerId);

  const result = await query<ProjectRow>(
    `SELECT project_id, organization_id, name, description, created_at
     FROM projects
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return result.rows;
}

export async function getProject(
  projectId: string,
  ownerId: string
) {
  const result = await query<ProjectRow>(
    `SELECT p.project_id, p.organization_id, p.name, p.description, p.created_at
     FROM projects p
     JOIN organizations o ON o.organization_id = p.organization_id
     WHERE p.project_id = $1 AND o.owner_id = $2`,
    [projectId, ownerId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Project");
  }
  return result.rows[0];
}

export async function updateProject(
  projectId: string,
  ownerId: string,
  data: { name?: string; description?: string }
) {
  const result = await query<ProjectRow>(
    `UPDATE projects p
     SET
       name = COALESCE($1, p.name),
       description = COALESCE($2, p.description)
     FROM organizations o
     WHERE p.project_id = $3
       AND p.organization_id = o.organization_id
       AND o.owner_id = $4
     RETURNING p.project_id, p.organization_id, p.name, p.description, p.created_at`,
    [data.name?.trim(), data.description?.trim(), projectId, ownerId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Project");
  }
  return result.rows[0];
}

export async function deleteProject(
  projectId: string,
  ownerId: string
): Promise<void> {
  const result = await query(
    `DELETE FROM projects p
     USING organizations o
     WHERE p.project_id = $1
       AND p.organization_id = o.organization_id
       AND o.owner_id = $2`,
    [projectId, ownerId]
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.notFound("Project");
  }
}
