/** Display label for a film material `code` (from DB). */
export function filmMaterialTypeLabel(
  code: string,
  labelByCode?: Record<string, string> | Map<string, string>,
): string {
  if (!labelByCode) return code;
  if (labelByCode instanceof Map) {
    return labelByCode.get(code) ?? code;
  }
  return labelByCode[code] ?? code;
}
