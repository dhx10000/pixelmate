import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ACCEPTED.has(file.type)) {
    return Response.json(
      { error: `File type '${file.type}' is not supported` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "File exceeds the 10 MB limit" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const fileId = randomUUID();

  const uploadDir = join(tmpdir(), "pixelmate-uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(
    join(uploadDir, `${fileId}.${ext}`),
    Buffer.from(await file.arrayBuffer())
  );

  return Response.json({
    file_id: fileId,
    ext,
    filename: file.name,
    type: file.type,
    size: file.size,
  });
}
