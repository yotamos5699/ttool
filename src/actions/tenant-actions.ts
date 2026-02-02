"use server";

import { db } from "@/dbs/drizzle";
import { tenants, type Tenant } from "@/dbs/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/* ----------------------------------
 * Types
 * ---------------------------------- */

export interface TenantCreateInput {
  name: string;
  slug: string;
}

export interface TenantUpdateInput {
  name?: string;
  slug?: string;
  active?: boolean;
}

/* ----------------------------------
 * Create Tenant
 * ---------------------------------- */

export async function createTenant(data: TenantCreateInput): Promise<Tenant> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: data.name,
      slug: data.slug,
    })
    .returning();

  return tenant;
}

/* ----------------------------------
 * Get Tenant by ID
 * ---------------------------------- */

export async function getTenant(id: number): Promise<Tenant | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });
  return tenant ?? null;
}

/* ----------------------------------
 * Get Tenant by Slug
 * ---------------------------------- */

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  return tenant ?? null;
}

/* ----------------------------------
 * Get All Tenants
 * ---------------------------------- */

export async function getTenants(options?: { activeOnly?: boolean }): Promise<Tenant[]> {
  const conditions = [];

  if (options?.activeOnly) {
    conditions.push(eq(tenants.active, true));
  }

  return db.query.tenants.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (t, { asc }) => [asc(t.name)],
  });
}

/* ----------------------------------
 * Update Tenant
 * ---------------------------------- */

export async function updateTenant(
  id: number,
  data: TenantUpdateInput
): Promise<Tenant | null> {
  const existing = await getTenant(id);
  if (!existing) return null;

  const [updated] = await db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();

  return updated;
}

/* ----------------------------------
 * Delete Tenant
 * ---------------------------------- */

export async function deleteTenant(id: number): Promise<boolean> {
  const existing = await getTenant(id);
  if (!existing) return false;

  await db.delete(tenants).where(eq(tenants.id, id));
  return true;
}

/* ----------------------------------
 * Get or Create Default Tenant
 * ---------------------------------- */

export async function getOrCreateDefaultTenant(): Promise<Tenant> {
  const DEFAULT_SLUG = "default";

  let tenant = await getTenantBySlug(DEFAULT_SLUG);

  if (!tenant) {
    tenant = await createTenant({
      name: "Default Tenant",
      slug: DEFAULT_SLUG,
    });
  }

  return tenant;
}
