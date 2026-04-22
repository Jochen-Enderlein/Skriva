import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_PATH = path.join(process.cwd(), 'assets/images');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const filePath = path.join(IMAGES_PATH, fileName);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ 
      url: `/api/images/${fileName}`,
      fileName 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
