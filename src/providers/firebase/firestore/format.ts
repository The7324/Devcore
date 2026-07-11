import type { Value } from "@/providers/firebase/firestore/types";

export function firestoreValueToJson(value: Value | undefined | null): unknown {
  if (value === undefined || value === null) return undefined;
  if (value.nullValue !== undefined) return null;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.bytesValue !== undefined) return value.bytesValue;
  if (value.referenceValue !== undefined) return value.referenceValue;
  if (value.geoPointValue !== undefined) {
    return { _latitude: value.geoPointValue.latitude, _longitude: value.geoPointValue.longitude };
  }
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values ?? []).map(firestoreValueToJson);
  }
  if (value.mapValue !== undefined) {
    return firestoreFieldsToJson(value.mapValue.fields);
  }
  return undefined;
}

export function firestoreFieldsToJson(
  fields: Record<string, Value> | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = firestoreValueToJson(val);
  }
  return result;
}

export function jsonToFirestoreValue(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null };

  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value) && Math.abs(value) < 2 ** 53) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return { timestampValue: value };
    }
    return { stringValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(jsonToFirestoreValue) } };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj._latitude !== undefined && obj._longitude !== undefined) {
      return {
        geoPointValue: {
          latitude: Number(obj._latitude),
          longitude: Number(obj._longitude),
        },
      };
    }
    if (obj._reference !== undefined) {
      return { referenceValue: String(obj._reference) };
    }
    return { mapValue: { fields: jsonFieldsToFirestore(obj) } };
  }

  return { stringValue: String(value) };
}

export function jsonFieldsToFirestore(
  data: Record<string, unknown>,
): Record<string, Value> {
  const result: Record<string, Value> = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = jsonToFirestoreValue(val);
  }
  return result;
}

export function formatDocumentValue(
  value: unknown,
  maxDepth = 3,
  maxLen = 60,
): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.length > maxLen) return `"${value.slice(0, maxLen - 3)}..."`;
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    if (maxDepth <= 0) return `[…]`;
    const items = value.slice(0, 3).map((v) => formatDocumentValue(v, maxDepth - 1, maxLen));
    const suffix = value.length > 3 ? `…+${value.length - 3}` : "";
    return `[${items.join(", ")}${suffix ? ", " + suffix : ""}]`;
  }
  if (typeof value === "object") {
    if (maxDepth <= 0) return "{…}";
    const obj = value as Record<string, unknown>;
    if (obj._latitude !== undefined) return `GeoPoint(${obj._latitude}, ${obj._longitude})`;
    if (obj._reference !== undefined) return `Ref(${obj._reference})`;
    const entries = Object.entries(obj).slice(0, 4);
    const items = entries.map(([k, v]) => `${k}: ${formatDocumentValue(v, maxDepth - 1, maxLen)}`);
    const suffix = Object.keys(obj).length > 4 ? `…+${Object.keys(obj).length - 4}` : "";
    return `{${items.join(", ")}${suffix ? ", " + suffix : ""}}`;
  }
  return String(value);
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function formatTimestamp(iso: string | undefined | null): string {
  if (!iso) return "—";
  if (!ISO_RE.test(iso)) return iso;
  const d = new Date(iso);
  return d.toISOString().slice(0, 10) + " " + d.toISOString().slice(11, 19);
}
