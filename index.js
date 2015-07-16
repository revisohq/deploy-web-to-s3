require('es6-shim');
var fs = require('fs');
var path = require('path');
var S3Uploader = require('./upload-folder-to-s3');
var getBuildVersion = require('./get-build-version');

module.exports = function(options) {
	var versionPromise = getBuildVersion();
	var bucketUrl = '';

	if(options.bucketFolder) {
		bucketUrl += options.bucketFolder;
		if(!bucketUrl.endsWith('/')) {
			bucketUrl += '/';
		}
	}

	var useVersionAsFolder;
	if(options.addVersionToPath) {
		useVersionAsFolder = versionPromise
			.then(function(version) {
				if(options.versionPrefix) {
					version = options.versionPrefix + '-' + version;
				}
				bucketUrl += version + '/';
			});
	} else {
		useVersionAsFolder = Promise.resolve();
	}

	var aws = options.aws;
	var uploader = new S3Uploader(aws.bucket, aws.key, aws.secret);

	Promise.all([
		useVersionAsFolder,
		addVersionJSON(versionPromise, options.buildFolder),
	])
		.then(function() {
			return uploader(options.buildFolder, {
				pathPrefix: bucketUrl,
				getHeadersForFile: getHeadersForFile,
				gzipExtensions: options.gzipExtensions,
			});
		})
		.catch(function(err) {
			if(err.code == 'ENOENT') {
				return exit('The build-folder does not exist');
			}
			throw err;
		})
		.then(function(files) {
			console.log('%d files uploaded', files.length);
		}, function(err) {
			return exit('Failed with error:\n', err.stack || err.message || err);
		});
};

function addVersionJSON(versionPromise, buildFolder) {
	return versionPromise.then(function(sha) {
		var json = JSON.stringify({ revision: sha, timestamp: new Date().toJSON() });
		return new Promise(function(resolve, reject) {
			fs.writeFile(path.join(buildFolder, 'version.json'), json, function(err) {
				err ? reject(err) : resolve()
			});
		});
	});
}

function getHeadersForFile(file) {
	var opts = {
		'x-amz-acl': 'public-read',
	};
	if(file.includes('index.html') || file.endsWith('.json')) {
		opts['cache-control'] = 'max-age=0';
	}
	return opts;
}

function exit(msg) {
	console.log.apply(console, arguments);
	return new Promise(function(resolve) { resolve(); })
		.then(function() {
			process.exit(1);
		});
}
