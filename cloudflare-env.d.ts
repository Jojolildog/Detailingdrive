declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DETAILFLOW_OWNER_USER_ID?: string;
    DETAILFLOW_OWNER_EMAIL?: string;
  }
}
