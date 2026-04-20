import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import type { WriteBatch } from "firebase/firestore";
import { db } from "../firebase";

export const BACKUP_COLLECTIONS = [
  "foods",
  "weighins",
  "workouts",
  "plans",
  "favorites",
  "recentFoods",
  "mealPresets",
  "mealTemplates",
  "water",
] as const;

export type BackupCollectionName = (typeof BACKUP_COLLECTIONS)[number];

export type BackupDocEntry = {
  id: string;
  data: Record<string, unknown>;
};

export type UserBackupPayload = {
  version: 1;
  exportedAt: string;
  user: {
    uid: string;
    email: string | null;
  };
  root: Record<string, unknown>;
  collections: Record<BackupCollectionName, BackupDocEntry[]>;
};

const BACKUP_COLLECTION_SET = new Set<string>(BACKUP_COLLECTIONS);

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const createEmptyCollections = (): Record<BackupCollectionName, BackupDocEntry[]> =>
  BACKUP_COLLECTIONS.reduce((acc, collectionName) => {
    acc[collectionName] = [];
    return acc;
  }, {} as Record<BackupCollectionName, BackupDocEntry[]>);

const utf8ToBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToUtf8 = (value: string): string => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const encodePayload = (value: unknown): string => utf8ToBase64(JSON.stringify(value));

const decodePayload = (value: string): unknown => JSON.parse(base64ToUtf8(value));

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error("Invalid CSV format: unterminated quoted field.");
  }

  result.push(current);
  return result;
};

const parseCsvRows = (csv: string): string[][] => {
  const lines = csv
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    throw new Error("CSV file is empty.");
  }

  return lines.map(parseCsvLine);
};

export const fetchUserBackupPayload = async (
  uid: string,
  email: string | null
): Promise<UserBackupPayload> => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const collections = createEmptyCollections();

  await Promise.all(
    BACKUP_COLLECTIONS.map(async (collectionName) => {
      const snap = await getDocs(collection(db, "users", uid, collectionName));
      collections[collectionName] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        data: toRecord(docSnap.data()),
      }));
    })
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    user: { uid, email },
    root: toRecord(userSnap.data()),
    collections,
  };
};

export const backupPayloadToCsv = (payload: UserBackupPayload): string => {
  const rows: string[][] = [];
  rows.push(["type", "collection", "docId", "payloadBase64"]);
  rows.push([
    "meta",
    "backup",
    "header",
    encodePayload({
      version: payload.version,
      exportedAt: payload.exportedAt,
      user: payload.user,
    }),
  ]);
  rows.push(["root", "users", "root", encodePayload(payload.root)]);

  BACKUP_COLLECTIONS.forEach((collectionName) => {
    payload.collections[collectionName].forEach((entry) => {
      rows.push(["doc", collectionName, entry.id, encodePayload(entry.data)]);
    });
  });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
};

export const parseBackupPayloadCsv = (csv: string): UserBackupPayload => {
  const rows = parseCsvRows(csv);
  const [header, ...dataRows] = rows;

  if (
    header.length !== 4 ||
    header[0] !== "type" ||
    header[1] !== "collection" ||
    header[2] !== "docId" ||
    header[3] !== "payloadBase64"
  ) {
    throw new Error("Invalid CSV header. Use a MacroPal backup CSV file.");
  }

  let meta: { version?: number; exportedAt?: string; user?: { uid?: string; email?: string | null } } | null = null;
  let root: Record<string, unknown> | null = null;
  const collections = createEmptyCollections();

  for (const [index, row] of dataRows.entries()) {
    if (row.length !== 4) {
      throw new Error(`Invalid CSV row at line ${index + 2}.`);
    }

    const [type, collectionName, docId, payloadBase64] = row;
    if (!payloadBase64) {
      throw new Error(`Missing payload at line ${index + 2}.`);
    }

    if (type === "meta" && collectionName === "backup" && docId === "header") {
      meta = toRecord(decodePayload(payloadBase64)) as {
        version?: number;
        exportedAt?: string;
        user?: { uid?: string; email?: string | null };
      };
      continue;
    }

    if (type === "root" && collectionName === "users" && docId === "root") {
      root = toRecord(decodePayload(payloadBase64));
      continue;
    }

    if (type === "doc") {
      if (!BACKUP_COLLECTION_SET.has(collectionName)) {
        throw new Error(`Unsupported collection "${collectionName}" in CSV.`);
      }
      if (!docId) {
        throw new Error(`Missing document id at line ${index + 2}.`);
      }
      collections[collectionName as BackupCollectionName].push({
        id: docId,
        data: toRecord(decodePayload(payloadBase64)),
      });
      continue;
    }

    throw new Error(`Unsupported CSV row type "${type}" at line ${index + 2}.`);
  }

  if (!meta) {
    throw new Error("CSV is missing backup metadata.");
  }
  if (meta.version !== 1) {
    throw new Error("Unsupported backup version.");
  }
  if (!root) {
    throw new Error("CSV is missing user root data.");
  }

  const uid = typeof meta.user?.uid === "string" ? meta.user.uid : "";
  if (!uid) {
    throw new Error("CSV backup is missing user id metadata.");
  }

  return {
    version: 1,
    exportedAt:
      typeof meta.exportedAt === "string" && meta.exportedAt.length > 0
        ? meta.exportedAt
        : new Date().toISOString(),
    user: {
      uid,
      email: meta.user?.email ?? null,
    },
    root,
    collections,
  };
};

const commitBatchOperations = async (
  operations: Array<(batch: WriteBatch) => void>
) => {
  const maxOpsPerBatch = 400;
  let batch = writeBatch(db);
  let opCount = 0;

  const commitCurrentBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  };

  for (const operation of operations) {
    operation(batch);
    opCount += 1;
    if (opCount >= maxOpsPerBatch) {
      await commitCurrentBatch();
    }
  }

  await commitCurrentBatch();
};

export const resetAndImportUserBackup = async (
  uid: string,
  payload: UserBackupPayload
) => {
  const deleteOperations: Array<(batch: WriteBatch) => void> = [];

  for (const collectionName of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, "users", uid, collectionName));
    snap.docs.forEach((docSnap) => {
      deleteOperations.push((batch) => batch.delete(docSnap.ref));
    });
  }

  await commitBatchOperations(deleteOperations);
  await setDoc(doc(db, "users", uid), toRecord(payload.root));

  const setOperations: Array<(batch: WriteBatch) => void> = [];
  for (const collectionName of BACKUP_COLLECTIONS) {
    payload.collections[collectionName].forEach((entry) => {
      const ref = doc(db, "users", uid, collectionName, entry.id);
      setOperations.push((batch) => batch.set(ref, toRecord(entry.data)));
    });
  }

  await commitBatchOperations(setOperations);
};

export const summarizeBackup = (payload: UserBackupPayload) => {
  const counts = BACKUP_COLLECTIONS.map((collectionName) => ({
    collectionName,
    count: payload.collections[collectionName].length,
  }));
  const totalDocs = counts.reduce((sum, entry) => sum + entry.count, 0);
  return { counts, totalDocs };
};

export const buildSimplePdfDocument = (content: string) => {
  const escaped = content
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
  const lines = escaped.split("\n");
  const textBlock = lines
    .map((line, idx) => `${idx === 0 ? "" : "T* "}(${line}) Tj`)
    .join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj"
  );
  objects.push(
    `4 0 obj << /Length ${textBlock.length + 63} >> stream\nBT\n/F1 12 Tf\n72 760 Td\n14 TL\n${textBlock}\nET\nendstream\nendobj`
  );
  objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");

  let offset = 0;
  const xref = ["0000000000 65535 f "];
  const body = objects
    .map((obj) => {
      const entry = `${offset}`.padStart(10, "0") + " 00000 n ";
      xref.push(entry);
      const chunk = `${obj}\n`;
      offset += chunk.length;
      return chunk;
    })
    .join("");

  const xrefOffset = offset;
  const xrefTable = `xref\n0 ${xref.length}\n${xref.join("\n")}\n`;
  const trailer = `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return `%PDF-1.4\n${body}${xrefTable}${trailer}`;
};
