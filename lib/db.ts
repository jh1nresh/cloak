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
  image_classification: ImageClassification;
  recommended_pipeline: RecommendedPipeline;
  title: string | null;
  brand: string | null;
  price: string | null;
  domain: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageClassification =
  | "on_model"
  | "flat_product"
  | "editorial"
  | "logo"
  | "unknown";

export type RecommendedPipeline = "model_swap" | "tryon";

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
  pipeline: RecommendedPipeline;
  saved_item_id: string | null;
  source_image_url: string | null;
  result_url: string | null;
  status: TryOnStatus;
  fashn_prediction_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedItem = {
  id: string;
  user_id: string | null;
  source_type: "url" | "image" | "screenshot" | "text";
  source_url: string | null;
  source_domain: string | null;
  title: string | null;
  brand: string | null;
  price: string | null;
  status: "saved" | "analyzing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemImage = {
  id: string;
  saved_item_id: string;
  image_url: string;
  width: number | null;
  height: number | null;
  rank: number;
  classification: ImageClassification;
  selected_for_generation: boolean;
  created_at: string;
};

export type Look = {
  id: string;
  user_id: string | null;
  saved_item_id: string | null;
  source_image_id: string | null;
  tryon_id: string | null;
  pipeline: "model_swap" | "tryon" | "motion";
  status: TryOnStatus;
  provider: string | null;
  provider_job_id: string | null;
  result_url: string | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type TasteEventType =
  | "save"
  | "skip"
  | "buy_click"
  | "share"
  | "regenerate"
  | "compare_original";

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
  const { rows } = await getPool().query<
    Pick<Garment, "id" | "image_url" | "recommended_pipeline">
  >(
    "select id, image_url, recommended_pipeline from garments where id = $1",
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
  imageClassification?: ImageClassification;
  recommendedPipeline?: RecommendedPipeline;
}) {
  const { rows } = await getPool().query<Garment>(
    `insert into garments (
       source_url,
       image_url,
       title,
       brand,
       price,
       domain,
       image_classification,
       recommended_pipeline
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (source_url) do update set
       image_url = excluded.image_url,
       title = excluded.title,
       brand = excluded.brand,
       price = excluded.price,
       domain = excluded.domain,
       image_classification = excluded.image_classification,
       recommended_pipeline = excluded.recommended_pipeline,
       updated_at = now()
     returning *`,
    [
      input.sourceUrl,
      input.imageUrl,
      input.title,
      input.brand,
      input.price,
      input.domain,
      input.imageClassification || "unknown",
      input.recommendedPipeline || "tryon",
    ]
  );

  return rows[0] || null;
}

export async function insertTryOn(input: {
  id: string;
  userId: string;
  garmentId: string | null;
  garmentUrl: string | null;
  pipeline?: RecommendedPipeline;
  savedItemId?: string | null;
  sourceImageUrl?: string | null;
}) {
  const { rows } = await getPool().query<TryOn>(
    `insert into tryons (
       id,
       user_id,
       garment_id,
       garment_url,
       pipeline,
       saved_item_id,
       source_image_url,
       result_url,
       status
     )
     values ($1, $2, $3, $4, $5, $6, $7, null, 'queued')
     returning *`,
    [
      input.id,
      input.userId,
      input.garmentId,
      input.garmentUrl,
      input.pipeline || "tryon",
      input.savedItemId || null,
      input.sourceImageUrl || input.garmentUrl,
    ]
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

export async function createSavedItem(input: {
  userId: string | null;
  sourceType: SavedItem["source_type"];
  sourceUrl: string | null;
  sourceDomain: string | null;
  title: string | null;
  brand: string | null;
  price: string | null;
  status?: SavedItem["status"];
  errorMessage?: string | null;
}) {
  const { rows } = await getPool().query<SavedItem>(
    `insert into saved_items (
       user_id,
       source_type,
       source_url,
       source_domain,
       title,
       brand,
       price,
       status,
       error_message
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      input.userId,
      input.sourceType,
      input.sourceUrl,
      input.sourceDomain,
      input.title,
      input.brand,
      input.price,
      input.status || "ready",
      input.errorMessage || null,
    ]
  );

  return rows[0] || null;
}

export async function getSavedItemById(id: string) {
  const { rows } = await getPool().query<Pick<SavedItem, "id" | "user_id">>(
    "select id, user_id from saved_items where id = $1",
    [id]
  );

  return rows[0] || null;
}

export async function insertItemImages(
  savedItemId: string,
  images: Array<{
    imageUrl: string;
    width: number | null;
    height: number | null;
    rank: number;
    classification: ImageClassification;
    selectedForGeneration: boolean;
  }>
) {
  if (!images.length) return [];

  const values: unknown[] = [];
  const placeholders = images.map((image, index) => {
    const base = index * 7;
    values.push(
      savedItemId,
      image.imageUrl,
      image.width,
      image.height,
      image.rank,
      image.classification,
      image.selectedForGeneration
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
      base + 5
    }, $${base + 6}, $${base + 7})`;
  });

  const { rows } = await getPool().query<ItemImage>(
    `insert into item_images (
       saved_item_id,
       image_url,
       width,
       height,
       rank,
       classification,
       selected_for_generation
     )
     values ${placeholders.join(", ")}
     returning *`,
    values
  );

  return rows;
}

export async function insertLook(input: {
  id: string;
  userId: string;
  savedItemId: string | null;
  sourceImageId: string | null;
  tryonId: string;
  pipeline: "model_swap" | "tryon";
  provider: string;
  providerJobId: string | null;
}) {
  const { rows } = await getPool().query<Look>(
    `insert into looks (
       id,
       user_id,
       saved_item_id,
       source_image_id,
       tryon_id,
       pipeline,
       status,
       provider,
       provider_job_id
     )
     values ($1, $2, $3, $4, $5, $6, 'processing', $7, $8)
     returning *`,
    [
      input.id,
      input.userId,
      input.savedItemId,
      input.sourceImageId,
      input.tryonId,
      input.pipeline,
      input.provider,
      input.providerJobId,
    ]
  );

  return rows[0] || null;
}

export async function updateLookByTryOnId(
  tryonId: string,
  fields: Partial<Pick<Look, "status" | "result_url" | "provider_job_id" | "error_message">>
) {
  const allowedColumns = new Set([
    "status",
    "result_url",
    "provider_job_id",
    "error_message",
  ]);
  const entries = Object.entries(fields).filter(
    ([, value]) => value !== undefined
  );

  if (!entries.length) return null;

  for (const [key] of entries) {
    if (!allowedColumns.has(key)) {
      throw new Error(`Invalid look update column: ${key}`);
    }
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);
  const { rows } = await getPool().query<Look>(
    `update looks
     set ${assignments.join(", ")}, updated_at = now()
     where tryon_id = $1
     returning *`,
    [tryonId, ...values]
  );

  return rows[0] || null;
}

export async function insertTasteEvent(input: {
  userId: string;
  savedItemId?: string | null;
  lookId?: string | null;
  garmentId?: string | null;
  tryonId?: string | null;
  eventType: TasteEventType;
  metadata?: Record<string, unknown>;
}) {
  const { rows } = await getPool().query<{ id: string }>(
    `insert into taste_events (
       user_id,
       saved_item_id,
       look_id,
       garment_id,
       tryon_id,
       event_type,
       metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning id`,
    [
      input.userId,
      input.savedItemId || null,
      input.lookId || null,
      input.garmentId || null,
      input.tryonId || null,
      input.eventType,
      JSON.stringify(input.metadata || {}),
    ]
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
