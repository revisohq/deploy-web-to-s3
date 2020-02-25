var requestModule = require('request')
var glob = require('glob')
var pathModule = require('path')
var fmerge = require('fmerge')
var fs = require('fs')
var tmp = require('tmp')
var zlib = require('zlib')
var mime = require('mime-types')

// Add license extension. This is often created by webpack
mime.types["license"] = "text/plain"

var normalizeHeaders = require('./normalize-headers')

module.exports = function(bucket, accessKey, secretKey, instanceOptions) {
	var url = 'https://' + bucket + '.s3.amazonaws.com/'

	var request = requestModule.defaults({
		aws: {
			key: accessKey,
			secret: secretKey,
			bucket: bucket,
		},
	})

	return function(path, options) {
		var remotePath = url + (options.pathPrefix || '')
		if(!remotePath.endsWith('/')) {
			remotePath += '/';
		}

		var gzipExtensions = options.gzipExtensions || []
		var exclude = options.exclude || []

		return listFilesInFolder(path, { exclude })
			.then(prepareFileInfo)
			.then(gzipIfNeeded)
			.then(uploadFiles)

		function prepareFileInfo(filenames) {
			return filenames.map(function(filename) {
				var mimeType = mime.lookup(filename)
				if(!mimeType) {
					instanceOptions.verboseLog(`Could not find mime-type for file ${filename}`)
				}
				var contentType = addCharsetToContentType(mimeType)
				return {
					filename: filename,
					localPath: pathModule.join(path, filename),
					headers: { 'content-type': contentType },
				}
			})
		}

		function gzipIfNeeded(fileObjects) {
			return Promise.all(fileObjects.map(function(fileObject) {
				if(shouldGzip(gzipExtensions, fileObject.filename)) {
					// Create a tmp file to gzip to. We do this because amazon
					// requires us to specify a 'content-length'
					return gzipFile(fileObject)
				} else {
					return Promise.resolve(fileObject)
				}
			}))
		}

		function gzipFile(fileObject) {
			return new Promise(function(resolve, reject) {
				tmp.file(function(err, tmpPath, tmpFd) {
					if(err) {
						return reject(err)
					}

					instanceOptions.verboseLog('gzip compressing "%s"', fileObject.filename)

					fs.createReadStream(fileObject.localPath)
						.pipe(zlib.createGzip())
						.pipe(fs.createWriteStream(null, {fd: tmpFd}))
						.on('finish', function() {
							resolve(fmerge(fileObject, {
								localPath: tmpPath,
								headers: { 'content-encoding': 'gzip' },
							}))
						})
						.on('error', reject)
				})
			})
		}

		function uploadFiles(fileObjects) {
			return Promise.all(fileObjects.map(function(fileObject) {
				var userHeaders = options.getHeadersForFile && options.getHeadersForFile(fileObject.filename)
				var localPath = fileObject.localPath
				var cacheControl = options.cacheControl
				return stat(localPath)
					.then(function(stat) {
						var statHeaders = {
							'content-length': stat.size,
							'cache-control': 'max-age=' + cacheControl,
						}

						var headers = fmerge(normalizeHeaders(statHeaders), normalizeHeaders(fileObject.headers), normalizeHeaders(userHeaders))
						var remoteFilePath = remotePath + fileObject.filename

						instanceOptions.verboseLog('uploading "%s"', fileObject.filename)
						return uploadFile(localPath, remoteFilePath, headers, request)
							.then(data => {
								instanceOptions.verboseLog(`done uploading "${fileObject.filename}"`)
								return data
							}, error => {
								instanceOptions.verboseLog(`failed uploading "${fileObject.filename}"`)
								throw error
							})
					})
			}))
				.then(function() {return fileObjects})
		}
	}
}

function listFilesInFolder(path, options) {
	return new Promise(function(resolve, reject) {
		glob('**/*', { cwd: path, nodir: true }, function(err, files) {
			var filteredFiles = files.filter(file => !options.exclude.some(filter => file.includes(filter)))
			err ? reject(err) : resolve(filteredFiles)
		})
	})
}

function shouldGzip(extensions, file) {
	return extensions.some(function(extension) {
		return file.endsWith(extension);
	});
}

function uploadFile(local, remote, headers, request) {
	return new Promise(function(resolve, reject) {

		fs.createReadStream(local).pipe(request.put(remote, {
			headers: headers,
		}, function(err, response) {
			if(err) return reject(err)

			// Temporary redirect. S3 does this sometimes.
			if(response.statusCode == 307) {
				return uploadFile(local, response.headers.location, headers, request)
			}

			if(response.statusCode >= 300) return reject(new Error('Failed to upload "' + remote + '", response: ' + response.body))
			resolve()
		}))
	})
}

function stat(path) {
	return new Promise(function(resolve, reject) {
		fs.stat(path, function(err, stat) {
			err ? reject(err) : resolve(stat)
		})
	})
}

function addCharsetToContentType(mimeType) {
	if(!mimeType || !mimeType.startsWith) {
		return mimeType
	}

	if(mimeType.startsWith('text/') || mimeType == 'application/json' || mimeType == 'application/javascript') {
		mimeType += '; charset=utf-8'
	}

	return mimeType
}
