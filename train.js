var turf = require('turf');
var cover = require('tile-cover');
var tilebelt = require('tilebelt');

module.exports = function trace(layers, tile, done){
  var buildings = layers.streets.building

  var result = {
    buildings: buildings,
    images: []
  }
  done(null, result)
}