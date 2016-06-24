/**
 * Created by Wayne on 2016/3/27.
 */
var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var app = express();
var mongojs = require('mongojs');
var db = mongojs('incidentList',['incidentList','incidentDetailList']);
var bodyParser = require('body-parser');
var async = require('async');
//var ObjectId = mongojs.ObjectId;
var cronJob = require('cron').CronJob;
//var findGeolocation = require('node-geolocation');

var job1 = new cronJob('*/60 * * * * *', function(){
    readArticleList("http://www.gunviolencearchive.org/last-72-hours", function (err, incidentList) {
        if (err) console.error(err.stack);
       // console.log(incidentList);
    });
}, function () {
    console.log("Collection complete.");
  },
  true);
job1.start();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

app.get('/incidentList',function(req,res){
    db.incidentList.find().sort({_id:-1},function(err,docs){
        res.json(docs);
    })
});
app.get('/incidentList/page/:page',function(req,res){
	var params = req.params.page;
	params = parseInt(params)*10;	
    db.incidentList.find().limit(10).skip(params).sort({_id:-1},function(err,docs){
        res.json(docs);
    })
});
app.get('/incidentDetailList/page/:page',function(req,res){
	var params = req.params.page;
	params = parseInt(params)*10;	
    db.incidentDetailList.find().limit(10).skip(params).sort({_id:-1},function(err,docs){
        res.json(docs);
    })
});

app.get('/incidentList/:id',function(req,res){
    var params = req.params.id;
    db.incidentList.find({"_id": params},function(err,docs){
        res.json(docs);
    })
});
app.get('/incidentDetailList/:id',function(req,res){
    var params = req.params.id;
    db.incidentDetailList.find({"_id": params},function(err,docs){
        res.json(docs);
    })
});
app.get('/incidentDetailList',function(req,res){
    db.incidentDetailList.find(function(err,docs){
        res.json(docs);
    })
});
app.post("/incidentlist",function(req,res){
    console.log(req.body);
});
app.listen(3000);
var incidentDetailList = [];
var incidentList = [];
function  readincidentDetail(url, callback) {
    request(url, function (err, res) {
        if (err) return callback(err);
        var $ = cheerio.load(res.body.toString());
        var incidentId = url.replace("http://www.gunviolencearchive.org\/incident\/","");
        $('div #block-system-main').each(function () {
            var title = $(this).children().eq(0).text().trim();
            var address = $(this).children().eq(1).children().eq(2).text().trim();
            var city = $(this).children().eq(1).children().eq(4).text().trim();
            var geolocation0 = $(this).children().eq(1).children().eq(6).text().trim();
            var geolocation1 = $(this).children().eq(1).children().eq(7).text().trim();
            var geolocation2 = $(this).children().eq(1).children().eq(8).text().trim();
            var geolocation3 = $(this).children().eq(1).children().eq(5).text().trim();

            async.series([
                function(done){
                    if(geolocation0.indexOf("Geolocation:") > -1)
                {
                    geolocation = geolocation0.replace("Geolocation:","");
                    //console.log(geolocation);
                }
                    else if(geolocation1.indexOf("Geolocation:") > -1){ geolocation1 = geolocation1.replace("Geolocation:","");}
                    else if(geolocation2.indexOf("Geolocation:") > -1){ geolocation2 = geolocation2.replace("Geolocation:","");}
                    else if(geolocation3.indexOf("Geolocation:") > -1){ geolocation3 = geolocation3.replace("Geolocation:","");}
                    done();
                },
                function(done){
                   var  incidentDetail = {
                    detailTitle: title,
                    detailAddress: address,
                    detailCity: city,
                    detailGeolocation: geolocation,
                    _id:incidentId
                };
                    db.incidentDetailList.insert(incidentDetail);
                    incidentDetailList.push(incidentDetail);
                    done();
                }

            ], function (err) {
                if (err) throw err;
            });
        });
    });
}
//readArticleList("http://www.gunviolencearchive.org/last-72-hours");
function readArticleList(url, callback) {
    request(url, function (err, res) { //url
        if (err) return callback(err);
        var $ = cheerio.load(res.body.toString());
        // insert values in one entity
        async.series([
            function (done) {
                $('td ul li.first a').each(function () {
                    var incidentAddress = $(this).attr('href');
                    var subtext = $(this).parent().parent().parent().parent().children();
                    var date = $(subtext).eq(0).text().trim();
                    var state = $(subtext).eq(1).text().trim();
                    var city = $(subtext).eq(2).text().trim();
                    var address = $(subtext).eq(3).text().trim();
                    var killed = $(subtext).eq(4).text().trim();
                    var injured = $(subtext).eq(5).text().trim();
                    var incidentId = incidentAddress.replace("\/incident\/", "");
                    var incident = {
                        incidentAddressDTO: incidentAddress,
                        dateDTO: date,
                        stateDTO: state,
                        cityDTO: city,
                        addressDTO: address,
                        killedDTO: killed,
                        injuredDTO: injured,
                        _id: incidentId
                    };
                    db.incidentList.insert(incident);
                    incidentList.push(incident);
                    readincidentDetail("http://www.gunviolencearchive.org" + incidentAddress);
                    //console.log(incidentList);
                    //if($('a').attr('title','Go to next page'))
                    //nextUrl = "http://www.gunviolencearchive.org" + $('a').attr('title','Go to next page').attr('href');
                    //else
                    //   nextUrl = false;
                    //var points = $(subtext).eq(0).text();
                });
                done();
            },
            function (done) {
                var nextUrl = $('li.pager-next').children().attr('href');

                console.log(nextUrl);
                if (nextUrl) {
                    var temp = "http://www.gunviolencearchive.org" + nextUrl;
                    readArticleList(temp, function (err, incidentList2) {
                        if (err) return callback(err);
                        callback(null, incidentList.concat(incidentList2));
                    });
                } else {
                    callback(null, incidentList);
                }
                done();
            }
        ], function (err) {
            if (err) throw err;
        });
    });
}



