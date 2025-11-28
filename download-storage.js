/**
 * Script para baixar todos os arquivos de todos os buckets do Supabase Storage
 *
 * Uso:
 * 1. npm install @supabase/supabase-js
 * 2. Defina as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 3. node download-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zvlqcxiwsrziuodiotar.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não definida!');
  console.log('\nDefina a variável de ambiente:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key_aqui"');
  process.exit(1);
}

// Criar cliente Supabase com service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Lista de buckets para baixar
const BUCKETS = [
  'blog-img',
  'chat-audios',
  'processos',
  'avatars',
  'assets',
  'legal-documents',
  'files'
];

// Diretório de saída
const OUTPUT_DIR = path.join(__dirname, 'storage_backup');

/**
 * Cria um diretório se não existir
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Baixa um arquivo via HTTPS
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

/**
 * Lista todos os arquivos de um bucket recursivamente
 */
async function listAllFiles(bucketName, prefix = '') {
  const allFiles = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error(`❌ Erro ao listar arquivos em ${bucketName}/${prefix}:`, error.message);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.id === null) {
        // É uma pasta, listar recursivamente
        const subFiles = await listAllFiles(bucketName, fullPath);
        allFiles.push(...subFiles);
      } else {
        // É um arquivo
        allFiles.push({
          name: item.name,
          path: fullPath,
          size: item.metadata?.size || 0,
          createdAt: item.created_at,
          updatedAt: item.updated_at
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

/**
 * Baixa todos os arquivos de um bucket
 */
async function downloadBucket(bucketName) {
  console.log(`\n📦 Processando bucket: ${bucketName}`);

  const bucketDir = path.join(OUTPUT_DIR, bucketName);
  ensureDir(bucketDir);

  // Listar todos os arquivos
  console.log('   📋 Listando arquivos...');
  const files = await listAllFiles(bucketName);

  if (files.length === 0) {
    console.log('   ⚠️  Bucket vazio');
    return { bucket: bucketName, total: 0, downloaded: 0, failed: 0, skipped: 0 };
  }

  console.log(`   ✅ Encontrados ${files.length} arquivos`);

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    // Criar diretório para o arquivo
    const filePath = path.join(bucketDir, file.path);
    const fileDir = path.dirname(filePath);
    ensureDir(fileDir);

    // Verificar se o arquivo já existe
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size === file.size) {
        console.log(`   ⏭️  ${progress} Pulando (já existe): ${file.path}`);
        skipped++;
        continue;
      }
    }

    try {
      // Obter URL pública assinada
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .createSignedUrl(file.path, 60); // 60 segundos

      if (error) {
        console.error(`   ❌ ${progress} Erro ao obter URL: ${file.path}`, error.message);
        failed++;
        continue;
      }

      // Baixar o arquivo
      await downloadFile(data.signedUrl, filePath);

      const sizeKB = (file.size / 1024).toFixed(2);
      console.log(`   ✅ ${progress} Baixado: ${file.path} (${sizeKB} KB)`);
      downloaded++;

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      console.error(`   ❌ ${progress} Erro ao baixar: ${file.path}`, err.message);
      failed++;
    }
  }

  return {
    bucket: bucketName,
    total: files.length,
    downloaded,
    failed,
    skipped
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando download de todos os buckets do Supabase Storage\n');
  console.log(`📁 Diretório de saída: ${OUTPUT_DIR}\n`);

  ensureDir(OUTPUT_DIR);

  const results = [];
  const startTime = Date.now();

  for (const bucket of BUCKETS) {
    try {
      const result = await downloadBucket(bucket);
      results.push(result);
    } catch (err) {
      console.error(`❌ Erro ao processar bucket ${bucket}:`, err.message);
      results.push({
        bucket,
        total: 0,
        downloaded: 0,
        failed: 0,
        skipped: 0,
        error: err.message
      });
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DO DOWNLOAD');
  console.log('='.repeat(60));

  let totalFiles = 0;
  let totalDownloaded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  results.forEach(result => {
    totalFiles += result.total;
    totalDownloaded += result.downloaded;
    totalFailed += result.failed;
    totalSkipped += result.skipped;

    console.log(`\n📦 ${result.bucket}:`);
    console.log(`   Total: ${result.total} arquivos`);
    console.log(`   ✅ Baixados: ${result.downloaded}`);
    console.log(`   ⏭️  Pulados: ${result.skipped}`);
    console.log(`   ❌ Falhas: ${result.failed}`);

    if (result.error) {
      console.log(`   ⚠️  Erro: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📈 TOTAIS:');
  console.log(`   Total de arquivos: ${totalFiles}`);
  console.log(`   ✅ Baixados: ${totalDownloaded}`);
  console.log(`   ⏭️  Pulados: ${totalSkipped}`);
  console.log(`   ❌ Falhas: ${totalFailed}`);
  console.log(`   ⏱️  Tempo: ${duration}s`);
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    console.log('\n⚠️  Alguns arquivos falharam. Execute novamente para tentar baixá-los.');
  } else if (totalDownloaded > 0) {
    console.log('\n✅ Todos os arquivos foram baixados com sucesso!');
  } else if (totalSkipped === totalFiles) {
    console.log('\n✅ Todos os arquivos já estavam baixados!');
  }

  console.log(`\n📁 Arquivos salvos em: ${OUTPUT_DIR}`);
}

// Executar
main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
