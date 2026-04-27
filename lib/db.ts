import { Pool } from "pg";

export type User = {
  id: string;
  avatar_url: string;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
};

export type Garment = {
  id: string;
  source_url: string;
  image_url: string;
  title: string | null;
  brand: string | null;
  price: string | null;
  domain: string | null;
  created_at: string;
  updated_at: string;
};

export type TryOnStatus =
  | "queued"
  | "processing"
  | "finalizing"
  | "completed"
  | "failed";

export type TryOn = {
  id: string;
  user_id: string | null;
  garment_id: string | null;
  garment_url: string | null;
  result_url: string | null;
  status: TryOnStatus;
  fashn_prediction_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds: number;
};

type GlobalWithPg = typeof globalThis & {
  cloakPgPool?: Pool;
};

const globalWithPg = globalThis as GlobalWithPg;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalWithPg.cloakPgPool) {
    globalWithPg.cloakPgPool = new Pool({
      connectionString,
      ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
    });
  }

  return globalWithPg.cloakPgPool;
}

export async function createUser(input: {
  id: string;
  avatarUrl: string;
  heightCm: number | null;
  weightKg: number | null;
}) {
  const { rows } = await getPool().query<User>(
    `insert into users (id, avatar_url, height_cm, weight_kg)
     values ($1, $2, $3, $4)
     returning *`,
    [input.id, input.avatarUrl, input.heightCm, input.weightKg]
  );

  return rows[0] || null;
}

export async function getUserById(id: string) {
  const { rows } = await getPool().query<Pick<User, "id" | "avatar_url">>(
    "select id, avatar_url from users where id = $1",
    [id]
  );

  return rows[0] || null;
}

export async function listGarments(limit: number) {
  const { rows } = await getPool().query<Garment>(
    `select *
     from garments
     order by created_at desc
     limit $1`,
    [limit]
  );

  return rows;
}

export async function getGarmentById(id: string) {
  const { rows } = await getPool().query<Pick<Garment, "id" | "image_url">>(
    "select id, image_url from garments where id = $1",
    [id]
  );

  return rows[0] || null;
}

export async function upsertGarment(input: {
  sourceUrl: string;
  imageUrl: string;
  title: string | null;
  brand: string | null;
  price: string | null;
  domain: string | null;
}) {
  const { rows } = await getPool().query<Garment>(
    `insert into garments (source_url, image_url, title, brand, price, domain)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (source_url) do update set
       image_url = excluded.image_url,
       title = excluded.title,
       brand = excluded.brand,
       price = excluded.price,
       domain = excluded.domain,
       updated_at = now()
     returning *`,
    [
      input.sourceUrl,
      input.imageUrl,
      input.title,
      input.brand,
      input.price,
      input.domain,
    ]
  );

  return rows[0] || null;
}

export async function insertTryOn(input: {
  id: string;
  userId: string;
  garmentId: string | null;
  garmentUrl: string | null;
}) {
  const { rows } = await getPool().query<TryOn>(
    `insert into tryons (id, user_id, garment_id, garment_url, result_url, status)
     values ($1, $2, $3, $4, null, 'queued')
     returning *`,
    [input.id, input.userId, input.garmentId, input.garmentUrl]
  );

  return rows[0] || null;
}

export async function getTryOnById(id: string) {
  const { rows } = await getPool().query<TryOn>(
    "select * from tryons where id = $1",
    [id]
  );

  return rows[0] || null;
}

export async function updateTryOn(
  id: string,
  fields: Partial<
    Pick<
      TryOn,
      "status" | "result_url" | "fashn_prediction_id" | "error_message"
    >
  >
) {
  const allowedColumns = new Set([
    "status",
    "result_url",
    "fashn_prediction_id",
    "error_message",
  ]);
  const entries = Object.entries(fields).filter(
    ([, value]) => value !== undefined
  );

  if (!entries.length) {
    return getTryOnById(id);
  }

  for (const [key] of entries) {
    if (!allowedColumns.has(key)) {
      throw new Error(`Invalid try-on update column: ${key}`);
    }
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const { rows } = await getPool().query<TryOn>(
    `update tryons
     set ${assignments.join(", ")}, updated_at = now()
     where id = $1
     returning *`,
    [id, ...values]
  );

  return rows[0] || null;
}

export async function lockTryOnForFinalizing(id: string) {
  const { rows } = await getPool().query<TryOn>(
    `update tryons
     set status = 'finalizing', updated_at = now()
     where id = $1
       and status = 'processing'
       and result_url is null
     returning *`,
    [id]
  );

  return rows[0] || null;
}

export async function checkPersistentRateLimit(input: {
  key: string;
  maxRequests: number;
  windowSeconds: number;
}) {
  const { rows } = await getPool().query<RateLimitResult>(
    `with upserted as (
       insert into rate_limits (key, count, reset_at)
       values ($1, 1, now() + ($3::text || ' seconds')::interval)
       on conflict (key) do update set
         count = case
           when rate_limits.reset_at <= now() then 1
           else rate_limits.count + 1
         end,
         reset_at = case
           when rate_limits.reset_at <= now()
             then now() + ($3::text || ' seconds')::interval
           else rate_limits.reset_at
         end
       returning count, reset_at
     )
     select
       count <= $2 as allowed,
       greatest(0, ceil(extract(epoch from reset_at - now())))::int as retry_after_seconds
     from upserted`,
    [input.key, input.maxRequests, input.windowSeconds]
  );

  return rows[0] || null;
}

function shouldUseSsl() {
  return (
    process.env.DATABASE_SSL === "true" ||
    process.env.PGSSLMODE === "require"
  );
}
