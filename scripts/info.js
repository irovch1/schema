const config = require('pelias-config').generate();
const client = require('esclient')(config);

client.info( {}, console.log.bind(console) );
