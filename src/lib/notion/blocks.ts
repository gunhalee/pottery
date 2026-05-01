import "server-only";
import { collectPaginatedAPI, isFullBlock } from "@notionhq/client";
import { getNotionClient } from "./client";

export async function getBlockChildren(blockId: string) {
  const notion = getNotionClient();

  const results = await collectPaginatedAPI(notion.blocks.children.list, {
    block_id: blockId,
    page_size: 100,
  });

  return results.filter(isFullBlock);
}
