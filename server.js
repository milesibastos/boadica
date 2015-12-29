/*
  $ npm install
  $ export FIREBASEIO=database.firebaseio.com
  $ node server.js "http://www.boadica.com.br/pesquisa/compu_celular/precos?ClasseProdutoX=1&CodCategoriaX=6&XF=66&curpage=1&ord=P&preco_max=&preco_min=&em_box=&cl="
*/

var _ = require('underscore'),
    http = require('https'),
    Promise = require('promise'),
    Firebase = require("firebase");

var iphones = {};
var firebaseio = process.env.FIREBASEIO || process.argv[3];
var database = new Firebase("https://" + firebaseio + "/boadica/iphones");

function crawler(url) {

  return new Promise(function (fulfill, reject){

    var exit = true;
    url = "https://api.import.io/store/connector/_magic?url=" 
        + encodeURIComponent(url) 
        + "&format=JSON&js=false&_apikey=81b476c53b0a4e76a622ed40252d06dc711f298df1876619a65325e9aa6326f8004f8283eb5bc7e13850b1ccb7acdf773d94abd26fc9d7d6fc87bbe89ab2e51ba75720cbc37dfacfe237a8537c66f2b1";
    console.log(url);

    http.get(url, function (response) {
      var data = "";
      response.setEncoding('utf8');
      response.on('data', function(chunk) {
        data += chunk;
        //console.log(JSON.stringify(data.tables));
      });
      response.on('end', function() {
        var source = JSON.parse(data),
            results = [];

        if(source.tables[0].results[0].preor_value_prices) {
          crawler(source.tables[0].pagination.next).then(map).done(chart);
          results = source.tables[0].results;
          exit = false;
          // console.log("No more item to colect");
        }
        fulfill(results);
        // database.off();
        console.log("Crawled: ", results.length);
        if(exit) process.exit();
      });
      response.on('error', console.error);
    });
  });
}

function map(data) {
  data.forEach(function (item) {

    var description = (item.modelo_values instanceof Array) ? item.modelo_values.join(" ") : item.modelo_values;
    var model = (description) ? description.match(/^iPhone (.*)GB/)[0] : "iPhone";

    if(!iphones[model])
      iphones[model] = {};

    if(!iphones[model][description] || iphones[model][description].price > Number(item.preor_value_prices)) {
      iphones[model][description] =  {
        price: Number(item.preor_value_prices),
        vendedor: item.vendedor_value_1,
        link: item.modelo_link,
        date: new Date().toJSON()
      };
      console.log(">> " + model + ": " + description);
      console.log(iphones[model][description]);
    }
  });

  database.set(iphones);
  return iphones;
}

function chart(data){
  var result = {};

  for(var k in data){
    var min = Number.MAX_VALUE;
    for (var j in data[k]) {
      if(!result[k]) result[k] = {};
      if(data[k][j].price < min) {
        result[k].models = {};
        result[k].models[j] = data[k][j];
        result[k].value = data[k][j].price;
        min = data[k][j].price;
      } else if (data[k][j].price == min) {
        result[k].models[j] = data[k][j];
      }
    }
  }
  var ref = new Firebase("https://" + firebaseio + "/boadica/data/" + new Date().toISOString().slice(0, 10));
  ref.set(result);
  console.log(" >> DONE");
}

crawler(process.argv[2]).then(map).done(chart);