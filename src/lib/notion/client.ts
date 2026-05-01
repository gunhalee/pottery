import "server-only";
import { Client } from "@notionhq/client";
import { getNotionEnv } from "@/lib/config/env";
import { NOTION_API_VERSION } from "./schema";

let notionClient: Client | null = null;

export function getNotionClient() {
  if (notionClient) {
    return notionClient;
  }

  const env = getNotionEnv();

  notionClient = new Client({
    auth: env.token,
    notionVersion: NOTION_API_VERSION,
  });

  return notionClient;
}
