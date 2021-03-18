const { Client, Transport, Connection } = require('@elastic/elasticsearch')
const aws4 = require('aws4')
const AWS = require('aws-sdk')

AWS.config.update({
    profile: 'airlabsdev'
})

function awaitAwsCredentials (awsConfig) {
    return new Promise((resolve, reject) => {
        awsConfig.getCredentials((err) => {
            err ? reject(err) : resolve()
        })
    })
}

class AmazonConnection extends Connection {
    buildRequestObject (params) {
        const req = super.buildRequestObject(params)

        req.service = 'es'

        if (AWS.config.region) {
            req.region = AWS.config.region
        }

        if (!req.headers) {
            req.headers = {}
        }

        // Fix the Host header, since HttpConnector.makeReqParams() appends
        // the port number which will cause signature verification to fail
        req.headers.host = req.hostname

        // This fix allows the connector to work with the older 6.x elastic branch.
        // The problem with that version, is that the Transport object would add a
        // `Content-Length` header (yes with Pascal Case), thus duplicating headers
        // (`Content-Length` and `content-length`), which makes the signature fail.
        let contentLength = 0
        if (params.body) {
            contentLength = Buffer.byteLength(params.body, 'utf8')
            req.body = params.body
        }
        const lengthHeader = 'content-length'
        const headerFound = Object.keys(req.headers).find(
            header => header.toLowerCase() === lengthHeader)
        if (headerFound === undefined) {
            req.headers[lengthHeader] = contentLength
        }

        return aws4.sign(req, AWS.config.credentials)
    }
}

class AmazonTransport extends Transport {
    request (params, options = {}, callback = undefined) {
        // options is optional, so if it is omitted, options will be the callback
        if (typeof options === 'function') {
            callback = options
            options = {}
        }

        // Promise support
        if (callback === undefined || callback === null) {
            return super.request(params, options)
        }

        // Callback support
        super.request(params, options, callback)
    }
}

const peliasConfig = require('pelias-config').generate();
const client = initClient()

function initClient() {
    if(peliasConfig.esclient.node.endsWith(".es.amazonaws.com")) {
        return new Client({
            Connection: AmazonConnection,
            Transport: AmazonTransport,
            node: peliasConfig.esclient.node,
        });
    }

    return new Client({
        node: peliasConfig.esclient.node,
    });
}

module.exports = client;