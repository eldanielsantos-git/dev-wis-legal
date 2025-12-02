#!/usr/bin/env node

/**
 * Script para baixar backup completo do Storage do Supabase
 *
 * Uso:
 *   node download-storage-backup.js seu-email@example.com sua-senha
 *
 * O arquivo storage-backup.zip será salvo no diretório atual
 */

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://rslpleprodloodfsaext.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2RsbG9vZGZzYWV4dCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU4OTA0MjgzLCJleHAiOjIwNzQ0ODAyODN9.YeW_8xSIPjFqHCEyVwfzjHRl47eD-w8W3dPq3vX1R-k';

// Função para fazer requisição HTTPS
function httpsRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${buffer.toString()}`));
        } else {
          resolve({ buffer, headers: res.headers, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// Fazer login e obter token
async function login(email, password) {
  console.log('🔐 Fazendo login...');

  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const data = JSON.stringify({ email, password });

  const response = await httpsRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    }
  }, data);

  const result = JSON.parse(response.buffer.toString());

  if (!result.access_token) {
    throw new Error('Login falhou: ' + JSON.stringify(result));
  }

  console.log('✅ Login realizado com sucesso');
  return result.access_token;
}

// Baixar backup do storage
async function downloadBackup(accessToken) {
  console.log('📦 Iniciando download do backup...');
  console.log('⏳ Isso pode levar alguns minutos...');

  const url = `${SUPABASE_URL}/functions/v1/download-all-storage`;

  const response = await httpsRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const filename = 'storage-backup.zip';
  fs.writeFileSync(filename, response.buffer);

  const sizeMB = (response.buffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Backup baixado com sucesso!`);
  console.log(`📁 Arquivo: ${filename}`);
  console.log(`💾 Tamanho: ${sizeMB} MB`);
}

// Main
async function main() {
  const [,, email, password] = process.argv;

  if (!email || !password) {
    console.error('❌ Uso: node download-storage-backup.js email senha');
    process.exit(1);
  }

  try {
    const accessToken = await login(email, password);
    await downloadBackup(accessToken);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
