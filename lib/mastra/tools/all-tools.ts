/**
 * Neuro Agent에서 사용할 모든 Tools
 */

import { listFoldersTool } from "@/lib/mastra/tools/list-folders";
import { listNotesTool } from "@/lib/mastra/tools/list-notes";
import { readNoteTool } from "@/lib/mastra/tools/read-note";
import { searchNotesTool } from "@/lib/mastra/tools/search-notes";
import { createNoteTool } from "@/lib/mastra/tools/create-note";
import { updateNoteTool } from "@/lib/mastra/tools/update-note";
import { deleteNoteTool } from "@/lib/mastra/tools/delete-note";
import { moveNoteTool } from "@/lib/mastra/tools/move-note";
import { deleteFolderTool } from "@/lib/mastra/tools/delete-folder";
import { graphSearchTool } from "@/lib/mastra/tools/graph-search";

/**
 * 모든 Tools를 하나의 객체로 export
 * Agent에 등록할 때 이 객체를 사용
 */
export const neuroTools = {
  listFolders: listFoldersTool,
  listNotes: listNotesTool,
  readNote: readNoteTool,
  searchNotes: searchNotesTool,
  createNote: createNoteTool,
  updateNote: updateNoteTool,
  deleteNote: deleteNoteTool,
  moveNote: moveNoteTool,
  deleteFolder: deleteFolderTool,
  graphSearch: graphSearchTool,
};
