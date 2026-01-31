import fs from "fs/promises";
import { getConfigFilePath, getConfigDir } from "@/lib/notes-path";
import type { PhraseSet, PhraseSetStore } from "@/types";

function getFilePath(): string {
  return getConfigFilePath("phrase-sets", "phrase-sets.json");
}

function getDefaultStore(): PhraseSetStore {
  return { phraseSets: [], selectedId: null };
}

// 전체 스토어 로드
export async function loadPhraseSetStore(): Promise<PhraseSetStore> {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return getDefaultStore();
  }
}

// 전체 스토어 저장
async function savePhraseSetStore(store: PhraseSetStore): Promise<void> {
  await fs.mkdir(getConfigDir("phrase-sets"), { recursive: true });
  await fs.writeFile(getFilePath(), JSON.stringify(store, null, 2));
}

// 구문 세트 추가
export async function addPhraseSet(
  name: string,
  phrases: string[]
): Promise<PhraseSet> {
  const store = await loadPhraseSetStore();
  const now = new Date().toISOString();
  const newSet: PhraseSet = {
    id: crypto.randomUUID(),
    name,
    phrases,
    createdAt: now,
    updatedAt: now,
  };
  store.phraseSets.push(newSet);
  await savePhraseSetStore(store);
  return newSet;
}

// 구문 세트 수정
export async function updatePhraseSet(
  id: string,
  updates: { name?: string; phrases?: string[] }
): Promise<PhraseSet | null> {
  const store = await loadPhraseSetStore();
  const idx = store.phraseSets.findIndex((ps) => ps.id === id);
  if (idx === -1) return null;

  if (updates.name !== undefined) store.phraseSets[idx].name = updates.name;
  if (updates.phrases !== undefined)
    store.phraseSets[idx].phrases = updates.phrases;
  store.phraseSets[idx].updatedAt = new Date().toISOString();

  await savePhraseSetStore(store);
  return store.phraseSets[idx];
}

// 구문 세트 삭제
export async function deletePhraseSet(id: string): Promise<boolean> {
  const store = await loadPhraseSetStore();
  const filtered = store.phraseSets.filter((ps) => ps.id !== id);
  if (filtered.length === store.phraseSets.length) return false;

  store.phraseSets = filtered;
  if (store.selectedId === id) store.selectedId = null;

  await savePhraseSetStore(store);
  return true;
}

// 선택 변경
export async function selectPhraseSet(id: string | null): Promise<void> {
  const store = await loadPhraseSetStore();
  store.selectedId = id;
  await savePhraseSetStore(store);
}

// 현재 선택된 세트의 phrases 가져오기 (transcribe API 용)
export async function getSelectedPhrases(): Promise<string[]> {
  const store = await loadPhraseSetStore();
  if (!store.selectedId) return [];
  const selected = store.phraseSets.find(
    (ps) => ps.id === store.selectedId
  );
  return selected?.phrases ?? [];
}
