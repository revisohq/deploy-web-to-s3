var requestModule = require('request')
var glob = require('glob')
var pathModule = require('path')
var fmerge = require('fmerge')
var fs = require('fs')
var tmp = require('tmp')
var zlib = require('zlib')
var mime = require('mime-types')

var normalizeHeaders = require('./normalize-headers')

var _30daysInSeconds = 30 * 24 * 3600

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

		return listFilesInFolder(path)
			.then(prepareFileInfo)
			.then(gzipIfNeeded)
			.then(uploadFiles)

		function prepareFileInfo(filenames) {
			return filenames.map(function(filename) {
				return {
					filename: filename,
					localPath: pathModule.join(path, filename),
					headers: { 'content-type': mime.lookup(filename) },
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
				return stat(localPath)
					.then(function(stat) {
						var statHeaders = {
							'content-length': stat.size,
							'cache-control': 'max-age=' + _30daysInSeconds,
						}

						var headers = fmerge(normalizeHeaders(statHeaders), normalizeHeaders(fileObject.headers), normalizeHeaders(userHeaders))
						var remoteFilePath = remotePath + fileObject.filename

						instanceOptions.verboseLog('uploading "%s"', fileObject.filename)
						return uploadFile(localPath, remoteFilePath, headers, request)
					})
			}))
				.then(function() {return fileObjects})
		}
	}
}

function listFilesInFolder(path) {
	return new Promise(function(resolve, reject) {
		glob('**/*', { cwd: path, nodir: true }, function(err, files) {
			err ? reject(err) : resolve(files)
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
