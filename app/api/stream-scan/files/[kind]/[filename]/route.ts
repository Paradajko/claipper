import { NextResponse } from "next/server";
import { readStreamScanFile } from "@/lib/stream-scan-server";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4"
};

export async function GET(_: Request, { params }: { params: Promise<{ kind: string; filename: string }> }) {
  const { kind, filename } = await params;
  if (kind !== "videos" && kind !== "audio" && kind !== "drafts") {
    return NextResponse.json({ error: "Invalid file kind." }, { status: 400 });
  }

  try {
    const file = await readStreamScanFile(kind, filename);
    const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    return new NextResponse(file, {
      headers: {
        "content-type": contentTypes[extension] ?? "application/octet-stream",
        "content-disposition": `inline; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
