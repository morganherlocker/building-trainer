var turf = require('turf');
var cover = require('tile-cover');
var tilebelt = require('tilebelt');
var queue = require('queue-async');
var getPixels = require('get-pixels');
var zeros = require('zeros');
var brain = require('brain');
var unpack = require('ndarray-unpack');
var kmeans = require("clusterfck").kmeans;
var request = require('request');
var fs = require('fs')

console.log('<link rel="stylesheet" type="text/css" href="style.css">')
var z = 19;
var url = 'https://a.tiles.mapbox.com/v4/mapbox.satellite/'+z+'/{x}/{y}@2x.png?access_token=pk.eyJ1IjoibW9yZ2FuaGVybG9ja2VyIiwiYSI6Ii1zLU4xOWMifQ.FubD68OEerk74AYCLduMZQ';

var z15 = [[5243, 12680, 15], [5245,12669,15],[5244,12666,15]]
//var tiles = cover.tiles(z15, {min_zoom: 19, max_zoom: 19});
var tiles = tilesToZoom(z15, 19)

var q = queue(5)
var net = new brain.NeuralNetwork().fromJSON(require('./net.json'))

var images = tiles.map(function(tile){
  return {
    t: tile.join('/')
  }
})

images.forEach(function(image){
  q.defer(getImage, image)
});

q.awaitAll(function(errors, heuristics){

})

function getImage(image, done){
  var imageUrl = url.split('{x}').join(image.t.split('/')[0]);
  imageUrl = imageUrl.split('{y}').join(image.t.split('/')[1]);
  getPixels(imageUrl, function(err, pixels){
    var input = getHeuristics(pixels).input
    var isBuilding = net.run(input)
    var classification = 'no'
    if(isBuilding >= .5) classification = 'yes'
    console.log('<hr>')
    console.log('<h1>'+Math.round(isBuilding * 100000000) / 1000000+'</h1>')
    console.log('<img class="'+classification+'" src="'+imageUrl+'">')
    
    

    done(null, null)
  })
}

function getHeuristics(pixels){
  var avgpx = avg(pixels)
  var lowpx = low(pixels)
  var highpx = high(pixels)
  var clusters = clusterPixels(pixels)

  var flatClusters = []
  clusters.forEach(function(cluster){
    flatClusters = flatClusters.concat(cluster)
  })

  var input = avgpx.concat(lowpx)
    .concat(highpx)
    .map(function(num){ return num / 255})
  input.concat(flatClusters)

  return {
    input: input,
    avgpx: avgpx,
    lowpx: lowpx,
    highpx: highpx,
    clusters: clusters
  }
}

function avg (pixels) {
  var shape = pixels.shape.slice();
  var total = shape[0] * shape[1]
  var r = 0;
  var g = 0;
  var b = 0;
  for(var x = 0; x < shape[0]; x++) {
    for(var y = 0; y < shape[1]; y++) {
      r += pixels.get(x,y,0);
      g += pixels.get(x,y,1);
      b += pixels.get(x,y,2);
    }
  }
  return [r/total, g/total, b/total].map(Math.round);
}

function low (pixels) {
  var shape = pixels.shape.slice();
  var r = Infinity;
  var g = Infinity;
  var b = Infinity;
  for(var x = 0; x < shape[0]; x++) {
    for(var y = 0; y < shape[1]; y++) {
      if(r > pixels.get(x,y,0)) r = pixels.get(x,y,0)
      if(g > pixels.get(x,y,1)) g = pixels.get(x,y,1)
      if(b > pixels.get(x,y,2)) b = pixels.get(x,y,2)
    }
  }
  return [r,g,b];
}

function high (pixels) {
  var shape = pixels.shape.slice();
  var r = -Infinity;
  var g = -Infinity;
  var b = -Infinity;
  for(var x = 0; x < shape[0]; x++) {
    for(var y = 0; y < shape[1]; y++) {
      if(r < pixels.get(x,y,0)) r = pixels.get(x,y,0)
      if(g < pixels.get(x,y,1)) g = pixels.get(x,y,1)
      if(b < pixels.get(x,y,2)) b = pixels.get(x,y,2)
    }
  }
  return [r,g,b];
}

function clusterPixels (pixels) {
  var shape = pixels.shape.slice();
  var totalPixels = shape[0] * shape[1]
  var sampleRate = 10
  var samplePixels = totalPixels / sampleRate

  var pxArray = []
  for(var x = 0; x < shape[0]; x+=sampleRate) {
    for(var y = 0; y < shape[1]; y+=sampleRate) {
      pxArray.push([
        pixels.get(x,y,0),
        pixels.get(x,y,1),
        pixels.get(x,y,2)
      ])
    }
  }

  var clusters = kmeans(pxArray, 8)
  clusters = clusters.map(function(cluster){
    var r = 0;
    var g = 0;
    var b = 0;
    cluster.forEach(function(color){
      r += color[0]
      g += color[1]
      b += color[2]
    })
    return [r/cluster.length, g/cluster.length, b/cluster.length, (cluster.length / samplePixels)].map(Math.round)  
  })
  clusters = clusters.sort(function(a, b){
    return b[3] - a[3]
  })

  return clusters
}

function tilesToZoom(tiles, zoom) {
  var newTiles = zoomTiles(tiles, zoom);
  return newTiles;

  function zoomTiles(zoomedTiles) {
    if(zoomedTiles[0][2] === zoom){
      return zoomedTiles;
    } else if(zoomedTiles[0][2] < zoom){
      var oneIn = [];
      zoomedTiles.forEach(function(tile){
        oneIn = oneIn.concat(tilebelt.getChildren(tile));
      });
      return zoomTiles(oneIn);
    } else {
      var zoomedTiles = zoomedTiles.map(function(tile){
        var centroid =
          turf.centroid(
            turf.bboxPolygon(
              tilebelt.tileToBBOX(tile)
            )
          );
        return tilebelt.pointToTile(
          centroid.geometry.coordinates[0],
          centroid.geometry.coordinates[1], zoom);
      });
      return zoomedTiles;
    }
  }
}