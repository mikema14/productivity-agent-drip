import { homedir } from "os";
import { join } from "path";

export const DB_PATH = join(
  homedir(),
  "Library",
  "Application Support",
  "drip",
  "productivity.db"
);

export const USER_ID = 28668;
export const ACTIVITY_ID = 95;
