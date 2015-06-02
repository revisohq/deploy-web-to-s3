var child_process = require('child_process');

module.exports = function() {
	return getDescribe()
		.catch(getSha);
}

module.exports.getSha = getSha;

function getDescribe() {
	return new Promise(function(resolve, reject) {
		child_process.exec('git describe', function(err, data) {
			err ? reject(err) : resolve(data.trim());
		});
	});
}

function getSha(e) {
	return new Promise(function(resolve, reject) {
		child_process.exec('git log -1 --format=%h', function(err, data) {
			err ? reject(err) : resolve(data.trim());
		});
	});
}
