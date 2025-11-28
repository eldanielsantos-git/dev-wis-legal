import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FileItem {
  name: string;
  path: string;
  bucket: string;
}

async function listAllFiles(
  supabase: any,
  bucketName: string,
  prefix = ""
): Promise<FileItem[]> {
  const allFiles: FileItem[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error(`Error listing files in ${bucketName}/${prefix}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.id === null) {
        const subFiles = await listAllFiles(supabase, bucketName, fullPath);
        allFiles.push(...subFiles);
      } else {
        allFiles.push({
          name: item.name,
          path: fullPath,
          bucket: bucketName,
        });
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allFiles;
}

async function downloadFile(
  supabase: any,
  bucketName: string,
  filePath: string
): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      console.error(`Error downloading ${bucketName}/${filePath}:`, error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.error(`Exception downloading ${bucketName}/${filePath}:`, err);
    return null;
  }
}

async function processBackup(supabase: any, userEmail: string, jobId: string) {
  try {
    const buckets = [
      "avatars",
    ];

    const zip = new JSZip();
    let totalFiles = 0;
    let successCount = 0;
    let failCount = 0;

    for (const bucketName of buckets) {
      console.log(`Processing bucket: ${bucketName}`);

      const files = await listAllFiles(supabase, bucketName);
      console.log(`Found ${files.length} files in ${bucketName}`);

      totalFiles += files.length;

      for (const file of files) {
        const fileData = await downloadFile(supabase, bucketName, file.path);

        if (fileData) {
          const zipPath = `${bucketName}/${file.path}`;
          zip.file(zipPath, fileData);
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    console.log(`Generating ZIP file... (${totalFiles} files, ${successCount} successful)`);

    const zipBlob = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 3 },
    });

    console.log(`ZIP generated successfully. Size: ${zipBlob.length} bytes (${(zipBlob.length / 1024 / 1024).toFixed(2)} MB)`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `storage-backup-${timestamp}.zip`;

    console.log(`Uploading ZIP to backups bucket: ${filename}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('backups')
      .upload(filename, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log(`ZIP uploaded successfully: ${uploadData?.path}`);

    const { data: urlData, error: urlError } = await supabase.storage
      .from('backups')
      .createSignedUrl(filename, 604800);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
    }

    console.log('Updating backup job status...');

    const { error: updateError } = await supabase
      .from('backup_jobs')
      .update({
        status: 'completed',
        total_files: totalFiles,
        success_count: successCount,
        fail_count: failCount,
        filename,
        download_url: urlData?.signedUrl || null,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Error updating backup job:', updateError);
    }

    console.log(`Backup completed: ${filename}`);
  } catch (error) {
    console.error('Backup process error:', error);

    await supabase
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: jobData, error: jobError } = await supabase
      .from('backup_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error('Failed to create backup job');
    }

    processBackup(supabase, user.email!, jobData.id);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobData.id,
        message: "Backup job started. Check backup_jobs table for progress."
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in download-all-storage:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to start backup",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});