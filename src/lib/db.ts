import { openDB, type IDBPDatabase } from 'idb';
import type { ChatMessage, SuggestionItem, TranscriptEntry } from '../types';

export interface DBSession {
  id: string;
  created_at: string;
  user_context: string;
  transcript: TranscriptEntry[];
}

const DB_NAME = 'twinmind_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

export async function initializeDatabase(_dbUrl?: string) {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      },
    });
  }
  await dbPromise;
}

export async function saveSessionState(
  _dbUrl: string | undefined, // Ignored since we are fully local
  sessionId: string,
  payload: {
    userContext?: string;
    transcript?: TranscriptEntry[];
    recentSuggestions?: SuggestionItem[];
    chats?: ChatMessage[];
  }
) {
  try {
    if (!dbPromise) await initializeDatabase();
    const db = await dbPromise;
    if (!db) return;

    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    
    // 1. Fetch existing session to merge properties correctly
    const existing = (await store.get(sessionId)) as DBSession | undefined;

    const updatedSession: DBSession = {
      id: sessionId,
      created_at: existing ? existing.created_at : new Date().toISOString(),
      user_context: payload.userContext ?? (existing?.user_context || ''),
      transcript: payload.transcript ?? (existing?.transcript || []),
    };

    await store.put(updatedSession);
    await tx.done;
  } catch (e) {
    console.error('[DB] Error saving session state locally:', e);
  }
}

export async function fetchPastSessions(_dbUrl?: string): Promise<DBSession[]> {
  try {
    if (!dbPromise) await initializeDatabase();
    const db = await dbPromise;
    if (!db) return [];

    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    
    const sessions = (await store.getAll()) as DBSession[];
    // Sort array in memory by descending created_at
    return sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    console.error('[DB] Failed to fetch local sessions', e);
    return [];
  }
}
