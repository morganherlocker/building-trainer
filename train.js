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

var z = 19;
var url = 'https://a.tiles.mapbox.com/v4/mapbox.satellite/'+z+'/{x}/{y}@2x.png?access_token=pk.eyJ1IjoibW9yZ2FuaGVybG9ja2VyIiwiYSI6Ii1zLU4xOWMifQ.FubD68OEerk74AYCLduMZQ';
var images = require('./images.json')
var q = queue(5)
var net = new brain.NeuralNetwork()

images.forEach(function(image){
  q.defer(getImage, image)
});

q.awaitAll(function(errors, heuristics){
  console.log(JSON.stringify(heuristics))
  net.train(heuristics,{
    log: true,
    learningRate: 0.1,
    logPeriod: 1000,    
    iterations: 100000
  });

  fs.writeFileSync('./net.json', JSON.stringify(net.toJSON()))
})

function getImage(image, done){
  var imageUrl = url.split('{x}').join(image.t.split('/')[0]);
  imageUrl = imageUrl.split('{y}').join(image.t.split('/')[1]);
  getPixels(imageUrl, function(err, pixels){
    console.log(imageUrl)
    var data = {
      input:getHeuristics(pixels).input,
      output: image.b
    }
    if(data.output) data.output = [1]
    else data.output = [0]
    done(null, data)
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