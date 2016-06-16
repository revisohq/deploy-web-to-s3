#!/usr/bin/env node

require('es6-shim');

var deployer = require('../index');

var buildFolder = process.argv[2];

if(!buildFolder) {
	exit('Usage: deploy <build folder>');
	return;
}

if(!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
	exit('You must give `AWS_ACCESS_KEY` and `AWS_SECRET_KEY` as ENV ' +
		'variables for accessing the S3 bucket.');
	return;
}

if(!process.env.AWS_BUCKET) {
	exit('You must set the `AWS_BUCKET` ENV variable.');
	return;
}

var gzipExtensions = null;
if(process.env.AWS_GZIP_EXTENSIONS) {
	gzipExtensions = process.env.AWS_GZIP_EXTENSIONS.split(',');
}

var exclude = null
if(process.env.AWS_EXCLUDE) {
	exclude = process.env.AWS_EXCLUDE.split(',')
}

deployer({
	aws: {
		bucket: process.env.AWS_BUCKET,
		key: process.env.AWS_ACCESS_KEY,
		secret: process.env.AWS_SECRET_KEY,
	},
	buildFolder: buildFolder,
	bucketFolder: process.env.AWS_BUCKET_FOLDER || null,
	addVersionToPath: process.env.AWS_ADD_VERSION_TO_PATH == 'true',
	versionPrefix: process.env.AWS_VERSION_PREFIX || null,
	gzipExtensions: gzipExtensions,
	exclude,
});

function exit(msg) {
	console.log.apply(console, arguments);
	return new Promise(function(resolve) { resolve(); })
		.then(function() {
			process.exit(1);
		});
}
