// ─────────────────────────────────────────────────────────────────────────────
//  Organizations Service
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "../../config/database";
import { AppError } from "../../utils/app-error";

interface OrganizationRow {
  organization_id: string;
  owner_id: string;
  name: string;
  created_at: Date;
}

export interface CreateOrganizationDto {
  name: string;
  ownerId: string;
}

export async function createOrganization(dto: CreateOrganizationDto) {
  const result = await query<OrganizationRow>(
    `INSERT INTO organizations (owner_id, name)
     VALUES ($1, $2)
     RETURNING organization_id, owner_id, name, created_at`,
    [dto.ownerId, dto.name.trim()]
  );
  return result.rows[0];
}

export async function listOrganizations(ownerId: string) {
  const result = await query<OrganizationRow>(
    `SELECT organization_id, owner_id, name, created_at
     FROM organizations
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [ownerId]
  );
  return result.rows;
}

export async function getOrganization(organizationId: string, ownerId: string) {
  const result = await query<OrganizationRow>(
    `SELECT organization_id, owner_id, name, created_at
     FROM organizations
     WHERE organization_id = $1 AND owner_id = $2`,
    [organizationId, ownerId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Organization");
  }
  return result.rows[0];
}

export async function updateOrganization(
  organizationId: string,
  ownerId: string,
  name: string
) {
  const result = await query<OrganizationRow>(
    `UPDATE organizations
     SET name = $1
     WHERE organization_id = $2 AND owner_id = $3
     RETURNING organization_id, owner_id, name, created_at`,
    [name.trim(), organizationId, ownerId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("Organization");
  }
  return result.rows[0];
}

export async function deleteOrganization(
  organizationId: string,
  ownerId: string
): Promise<void> {
  const result = await query(
    "DELETE FROM organizations WHERE organization_id = $1 AND owner_id = $2",
    [organizationId, ownerId]
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw AppError.notFound("Organization");
  }
}
