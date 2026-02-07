/**
 * Neuro Agent에서 사용할 모든 Tools
 */

import { listFoldersTool } from "./list-folders";
import { listNotesTool } from "./list-notes";
import { readNoteTool } from "./read-note";
import { searchNotesTool } from "./search-notes";
import { createNoteTool } from "./create-note";
import { updateNoteTool } from "./update-note";
import { deleteNoteTool } from "./delete-note";
import { moveNoteTool } from "./move-note";
import { deleteFolderTool } from "./delete-folder";

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
};
