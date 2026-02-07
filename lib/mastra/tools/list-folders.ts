import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getFolders } from "@/lib/folder-utils";

/**
 * listFolders Tool
 * 폴더 목록을 조회합니다.
 */
export const listFoldersTool = createTool({
  id: "list-folders",
  description:
    "노트 폴더 목록을 조회합니다. 각 폴더에 몇 개의 노트가 있는지 확인할 수 있습니다.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    folders: z.array(
      z.object({
        name: z.string(),
        noteCount: z.number(),
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async () => {
    try {
      const folders = await getFolders();

      return {
        folders,
        total: folders.length,
        message: `${folders.length}개의 폴더가 있습니다.`,
      };
    } catch (error) {
      console.error("[listFolders] Error:", error);
      return {
        folders: [],
        total: 0,
        message: `폴더 목록 조회 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});
