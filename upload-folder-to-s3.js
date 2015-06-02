var requestModule = require('request')
var glob = require('glob')
var pathModule = require('path')
var merge = require('fmerge')
var fs = require('fs')

var _30daysInSeconds = 30 * 24 * 3600

module.exports = function(bucket, accessKey, secretKey) {
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
		return listFilesInFolder(path)
			.then(function(files) {
				return Promise.all(files.map(function(file) {
					var userHeaders = options.getHeadersForFile && options.getHeadersForFile(file)

					var localPath = pathModule.join(path, file)
					return stat(localPath)
						.then(function(stat) {
							var suggestedHeaders = {
								'content-length': stat.size,
								'cache-control': 'max-age=' + _30daysInSeconds,
							}
							var headers = merge(suggestedHeaders, userHeaders)
							return uploadFile(localPath, remotePath + file, headers, request)
						})
				}))
			})
	}
}

function listFilesInFolder(path) {
	return new Promise(function(resolve, reject) {
		glob('**/*', { cwd: path, nodir: true }, function(err, files) {
			err ? reject(err) : resolve(files)
		})
	})
}

function uploadFile(local, remote, headers, request) {
	return new Promise(function(resolve, reject) {
		fs.createReadStream(local).pipe(request.put(remote, {
			headers: headers,
		}, function(err, response) {
			if(err) return reject(err)
			if(response.statusCode >= 300) return reject(new Error('Bad status: ' + response.statusCode))
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
