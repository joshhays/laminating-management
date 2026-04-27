import { NextResponse } from "next/server";
import { parseFilmInventoryCsvText } from "@/lib/film-inventory-csv";
import { applyFilmInventoryImport } from "@/lib/film-inventory-import";
import { ensureFilmMaterialTypeDefaults } from "@/lib/film-material-service";

export async function POST(request: Request) {
  try {
    await ensureFilmMaterialTypeDefaults();
    const ct = request.headers.get("content-type") ?? "";
    let text: string;
    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Attach a CSV file with form field "file".' },
          { status: 400 },
        );
      }
      text = await file.text();
    } else {
      text = await request.text();
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty file or body." }, { status: 400 });
    }
    const parsed = parseFilmInventoryCsvText(text);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const result = await applyFilmInventoryImport(parsed.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not import CSV." }, { status: 400 });
  }
}
