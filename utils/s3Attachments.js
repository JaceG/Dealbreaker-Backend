const AWS = require('aws-sdk');

// The object key of a file in our bucket, or null for any URL outside it (we never delete those).
// Covers the virtual-hosted and path-style URLs the SDK returns as Location.
function keyFromUrl(url, bucket, region) {
	if (!bucket || typeof url !== 'string') return null;
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	if (parsed.protocol !== 'https:') return null;
	const host = parsed.hostname.toLowerCase();
	const regional = region ? [`s3.${region}.amazonaws.com`] : [];
	const s3Hosts = ['s3.amazonaws.com', ...regional];
	let path = parsed.pathname.slice(1);
	if (!s3Hosts.map((h) => `${bucket}.${h}`).includes(host)) {
		if (!s3Hosts.includes(host) || !path.startsWith(`${bucket}/`)) return null;
		path = path.slice(bucket.length + 1);
	}
	try {
		const key = decodeURIComponent(path);
		return key && !key.endsWith('/') ? key : null;
	} catch {
		return null;
	}
}

// Only keys under the owner's id: entries accept any URL, so a URL alone doesn't prove the file is theirs.
// shortcut: files uploaded before keys carried the owner's id are never deleted; clean those up by hand if needed.
const ownedKeys = (urls, ownerId, bucket, region) =>
	[...new Set(urls.map((u) => keyFromUrl(u, bucket, region)).filter(Boolean))].filter((k) =>
		k.startsWith(`${ownerId}/`)
	);

// Deletes the owner's files in our bucket behind these URLs; returns how many S3 reported deleted. Skips S3 when no bucket is set.
async function deleteAttachmentFiles(urls, ownerId) {
	const bucket = process.env.S3_BUCKET_NAME;
	const region = process.env.AWS_REGION;
	if (!ownerId) return 0;
	const keys = ownedKeys(urls, String(ownerId), bucket, region);
	if (!bucket || keys.length === 0) return 0;
	const s3 = new AWS.S3({
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region,
	});
	let deleted = 0;
	for (let i = 0; i < keys.length; i += 1000) {
		const result = await s3
			.deleteObjects({
				Bucket: bucket,
				Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: false },
			})
			.promise();
		deleted += (result.Deleted || []).length;
		if (result.Errors?.length) console.error('S3 delete errors:', result.Errors);
	}
	return deleted;
}

module.exports = { keyFromUrl, ownedKeys, deleteAttachmentFiles };
