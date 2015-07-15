deploy-web-to-s3
================

A tool for easily recursively uploading a directory with client-side files to S3.


Usage
-----

	export AWS_BUCKET=<bucket name>
	export AWS_ACCESS_KEY=<access key>
	export AWS_SECRET_KEY=<secret key>

	deploy-web-to-s3 <folder to upload>


Assumptions
-----------

All files in the provided build-folder will be uploaded.

Any files ending with `.json` or called `index.html` (both case-sensitive) will
have no cache, all other files will have a 30-day cache header.

A file called `version.json` will be added to the root of the folder. This file
contains the current git-sha and the current timestamp.


Required Options
----------------

### AWS_BUCKET

The name of the bucket.


### AWS_ACCESS_KEY

Access key for IAM user.


### AWS_SECRET_KEY

Secret key for IAM user.


Optional Options
----------------

The options allow customization of the URL. If enabled, the URL for uploads
will be as follows: `https://bucket.s3.amazonaws.com[/AWS_BUCKET_FOLDER][/[AWS_VERSION_PREFIX-]GIT_DESCRIBE]/...`

### AWS_BUCKET_FOLDER

A folder within the bucket. Defaults to the root.

	export AWS_BUCKET_FOLDER=some-folder


### AWS_ADD_VERSION_TO_PATH

Bool for determining if the version should be appended to the url as a
directory. The version is determined by running `git describe` in the current
working directory.

	export AWS_ADD_VERSION_TO_PATH=true


### AWS_VERSION_PREFIX

A static prefix to add before the version. It is only used if
`AWS_ADD_VERSION_TO_PATH` is set to true.

	export AWS_ADD_VERSION_TO_PATH=true
	export AWS_VERSION_PREFIX=some-prefix

### AWS_GZIP_EXTENSIONS

A list of file extensions that should be gzipped before uploaded to S3.
Gzipped files will have their `content-encoding` set to `gzip` when served.
Note: This also means that user agents that does not support the `gzip` content
encoding will not be able to receive this file as S3 doesn't support automatic 
content negotiation.

	export AWS_GZIP_EXTENSIONS=.js,.css
