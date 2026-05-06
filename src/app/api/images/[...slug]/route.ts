import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { getStoredVaultPath } from '@/lib/notes';

export async function generateStaticParams() {
  return [{ slug: ['dummy'] }];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug: slugArray } = await params;
    // Join parts and decode. We use path.sep to handle different OS
    const rawPath = slugArray.join(path.sep);
    const decodedPath = decodeURIComponent(rawPath);
    
    const vaultPath = getStoredVaultPath() || path.join(process.cwd(), 'assets/notes');
    
    // Determine the final absolute path
    let filePath = '';
    if (path.isAbsolute(decodedPath)) {
      filePath = decodedPath;
    } else {
      filePath = path.join(vaultPath, decodedPath);
    }
    
    // Security check: Ensure the file is actually an image
    const ext = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    
    if (!imageExtensions.includes(ext)) {
      return new NextResponse('Invalid file type', { status: 400 });
    }

    // Fallback: If direct path doesn't exist, try looking in an 'assets' folder
    if (!fssync.existsSync(filePath)) {
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);
      const assetsPath = path.join(dirName, 'assets', fileName);
      
      if (fssync.existsSync(assetsPath)) {
        filePath = assetsPath;
      } else {
        console.error('Image not found at path:', filePath, 'nor at', assetsPath);
        return new NextResponse('Image not found', { status: 404 });
      }
    }
    
    const fileBuffer = await fs.readFile(filePath);
    
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.webp') contentType = 'image/webp';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
