module.exports = function(headers) {
	if(!headers) return headers
	return Object.keys(headers).reduce(function(normalizedHeaders, header) {
		normalizedHeaders[header.toLowerCase()] = headers[header]
		return normalizedHeaders
	}, {})
}
