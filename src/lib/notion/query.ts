import "server-only";
import {
  collectPaginatedAPI,
  isFullPage,
  type PageObjectResponse,
  type QueryDataSourceParameters,
} from "@notionhq/client";
import { getNotionClient } from "./client";

type QueryPagesInput = Omit<QueryDataSourceParameters, "start_cursor">;

export async function queryDataSourcePages(
  input: QueryPagesInput,
): Promise<PageObjectResponse[]> {
  const notion = getNotionClient();

  const results = await collectPaginatedAPI(notion.dataSources.query, {
    ...input,
    page_size: input.page_size ?? 100,
  });

  return results.filter(isFullPage);
}

export async function queryFirstDataSourcePage(input: QueryPagesInput) {
  const pages = await queryDataSourcePages({
    ...input,
    page_size: 1,
  });

  return pages[0] ?? null;
}
