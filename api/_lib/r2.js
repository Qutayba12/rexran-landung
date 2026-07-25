// Shared Cloudflare R2 (S3-compatible) helper. R2 has free, unlimited egress,
// so serving media never hits a bandwidth cap the way Vercel Blob did.
//
// The browser can't upload straight to R2 with our secret key, so these helpers
// mint a short-lived PRESIGNED PUT url that the browser uploads to directly
// (bypassing the serverless body-size limit), then we store the object's public
// url. Only `host` is signed, so the browser is free to send its own
// Content-Type header and R2 stores the object with it (needed for playback).
import { AwsClient } from 'aws4fetch'

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env

export function r2Configured() {
  return Boolean(
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_BASE_URL,
  )
}

let _client
function client() {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    })
  }
  return _client
}

// Collapse a filename to safe key characters while keeping its extension.
function safeName(name) {
  const cleaned = String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
  return cleaned || 'file'
}

// A collision-proof object key under an optional prefix (e.g. "media/").
export function buildKey(prefix, filename) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now()}-${rand}-${safeName(filename)}`
}

// Presign a PUT for `key`; returns the upload url (short-lived) and the object's
// permanent public url.
export async function presignPut(key) {
  const base = R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?X-Amz-Expires=3600`
  const signed = await client().sign(endpoint, { method: 'PUT', aws: { signQuery: true } })
  return { uploadUrl: signed.url, publicUrl: `${base}/${key}` }
}
