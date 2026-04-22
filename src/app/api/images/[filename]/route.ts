import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_PATH = path.join(process.cwd(), 'assets/images');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(IMAGES_PATH, filename);
    
    const file = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.gif') contentType = 'image/gif';
    if (ext === '.svg') contentType = 'image/svg+xml';
    if (ext === '.webp') contentType = 'image/webp';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
