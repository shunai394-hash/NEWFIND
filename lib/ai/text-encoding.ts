function hasMojibake(value: string): boolean {
  return /(?:Ã.|Â.|ã.|â.|ð.|Ñ.|Ð.|æ.|ç.|è.|é.|ê.|ë.|ì.|í.|î.|ï.|ñ.|ò.|ó.|ô.|õ.|ö.|ø.|ù.|ú.|û.|ü.|ý.|þ.|繧|縺|蜿|譁|譫|莨|逡|遘|髫|闔|譁|譬)/u.test(
    value,
  );
}

export function repairMojibake<T>(value: T): T {
  if (typeof value !== "string") {
    return value;
  }

  if (!hasMojibake(value)) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");

    if (
      repaired &&
      repaired !== value &&
      !repaired.includes("\uFFFD")
    ) {
      return repaired as T;
    }
  } catch {
    // Keep the original value when repair fails.
  }

  return value;
}
