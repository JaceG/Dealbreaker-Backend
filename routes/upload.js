const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const path = require('path')

// Configure AWS S3
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const region = process.env.AWS_REGION
const bucketName = process.env.S3_BUCKET_NAME

console.log('AWS S3 Configuration:')
console.log('- Using accessKeyId:', accessKeyId)
console.log('- Region:', region)
console.log('- Bucket:', bucketName)

const s3 = new AWS.S3({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
  region: region
})

// Configure multer for S3 upload
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${path.basename(file.originalname)}`
      cb(null, fileName)
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

// Route for file uploads to S3
router.post('/', upload.single('file'), (req, res) => {
  console.log(
    'Upload request received:',
    req.file ? 'File included' : 'No file'
  )

  try {
    if (!req.file) {
      console.log('No file found in request')
      return res.status(400).json({ message: 'No file uploaded' })
    }

    console.log('File upload successful:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      key: req.file.key,
      location: req.file.location
    })

    // Return the file location
    return res.status(200).json({
      message: 'File uploaded successfully',
      url: req.file.location,
      key: req.file.key
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res
      .status(500)
      .json({ message: 'Upload failed', error: error.message })
  }
})

// Direct upload with provided key and bucket
router.post('/custom', (req, res) => {
  console.log('Custom upload request received')

  const { file, bucket, key } = req.body

  console.log('Custom upload params:', {
    hasFile: !!file,
    fileLength: file ? file.length : 0,
    bucket,
    key
  })

  if (!file || !bucket || !key) {
    console.log('Missing parameters for custom upload')
    return res.status(400).json({ message: 'Missing required parameters' })
  }

  // Convert base64 to buffer
  const fileBuffer = Buffer.from(file.replace(/^data:.*;base64,/, ''), 'base64')

  const params = {
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: path.extname(key).startsWith('.')
      ? `image/${path.extname(key).substring(1)}`
      : 'application/octet-stream'
  }

  s3.upload(params, (err, data) => {
    if (err) {
      console.error('S3 upload error:', err)
      return res
        .status(500)
        .json({ message: 'S3 upload failed', error: err.message })
    }

    return res.status(200).json({
      message: 'File uploaded successfully',
      url: data.Location,
      key: data.Key
    })
  })
})

// Add a new simple upload route that doesn't use multer-s3
router.post('/direct', (req, res) => {
  console.log('Direct upload request received')

  // Use multer's memory storage for temporary file handling
  const memoryStorage = multer.memoryStorage()
  const memoryUpload = multer({
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  })

  // Process the upload
  memoryUpload.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err)
      return res
        .status(400)
        .json({ message: 'Upload failed', error: err.message })
    }

    if (!req.file) {
      console.log('No file found in request')
      return res.status(400).json({ message: 'No file uploaded' })
    }

    console.log('File received in memory:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    })

    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${path.basename(req.file.originalname)}`

    // Set up S3 upload parameters
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }

    console.log('Uploading to S3 with params:', {
      Bucket: params.Bucket,
      Key: params.Key,
      ContentType: params.ContentType,
      BodySize: params.Body.length
    })

    // Upload to S3
    s3.upload(params, function (s3Err, data) {
      if (s3Err) {
        console.error('S3 upload error:', s3Err)
        return res.status(500).json({
          message: 'S3 upload failed',
          error: s3Err.message,
          code: s3Err.code
        })
      }

      console.log('S3 upload successful:', data.Location)

      // Return the file URL
      return res.status(200).json({
        message: 'File uploaded successfully',
        url: data.Location,
        key: data.Key
      })
    })
  })
})

module.exports = router
