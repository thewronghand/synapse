/**
 * Neuro Agent에서 사용할 모든 Tools
 */

import { listNotesTool } from "./list-notes";
import { readNoteTool } from "./read-note";
import { searchNotesTool } from "./search-notes";
import { createNoteTool } from "./create-note";
import { updateNoteTool } from "./update-note";
import { deleteNoteTool } from "./delete-note";

/**
 * 모든 Tools를 하나의 객체로 export
 * Agent에 등록할 때 이 객체를 사용
 */
export const neuroTools = {
  listNotes: listNotesTool,
  readNote: readNoteTool,
  searchNotes: searchNotesTool,
  createNote: createNoteTool,
  updateNote: updateNoteTool,
  deleteNote: deleteNoteTool,
};
